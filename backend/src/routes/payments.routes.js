import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import { razorpay } from "../lib/razorpay.js";
import { getAppConfig } from "../lib/appConfig.js";
import { isPositiveNumber } from "../lib/validate.js";
import { confirmDriverVerificationPayment, confirmVehicleVerificationPayment, confirmPassengerVerificationPayment } from "../lib/verification.js";
import { getIO } from "../lib/socket.js";

const router = Router();

function addWorkingDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++; // skip weekends
  }
  return result;
}

// Shared by the real webhook (payment.captured) and the dev-only
// mock-confirm endpoint below — same status transition and notifications
// either way, so a test run behaves identically to a real payment from
// this point on.
async function confirmPlatformFeePayment(booking, paymentId) {
  const now = new Date();
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED", platformFeePaidAt: now, razorpayPaymentId: paymentId },
  });
  // This is also the moment the shared 30-min grace-cancel window
  // starts for both sides (see bookings.routes.js cancel handlers).
  await notify(booking.passengerId, "PAYMENT_SUCCESSFUL", "Booking confirmed",
    "Your platform fee payment went through — your seat is locked in.", booking.id);
  await notify(booking.ride.driverId, "BOOKING_CONFIRMED", "Booking confirmed",
    "The passenger paid the platform fee — booking is locked in.", booking.id);

  // Previously the passenger only found out via the push notification
  // above (easy to miss/delayed) or by happening to still be sitting on
  // PaymentScreen's own bounded poll (times out after ~20s) — nothing
  // told them the instant it actually cleared if they'd already
  // navigated elsewhere. Same live-event pattern trips.routes.js
  // already uses for "trip:started" — reaches the passenger wherever
  // they currently are in the app, not just this one screen.
  getIO()?.to(`user:${booking.passengerId}`).emit("payment:confirmed", { bookingId: booking.id });
}

// POST /api/payments/:bookingId/charge — called by the passenger right
// after the driver accepts, to pay the platform fee (NOT the full fare —
// the remaining fare is settled directly with the driver, cash/UPI,
// after the trip; see trips.routes.js /complete).
router.post("/:bookingId/charge", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.passengerId !== req.user.id) {
    return res.status(403).json({ error: "Not permitted." });
  }
  if (!["AWAITING_PAYMENT", "PAYMENT_PENDING"].includes(booking.status)) {
    return res.status(400).json({ error: "This booking isn't awaiting payment." });
  }

  const amount = Number(booking.platformFeeAmount);

  // Razorpay rejects an order below ₹1 (100 paise) outright — an admin
  // dropping platformFeePercent to 0, or a fare small enough that the
  // computed fee rounds to nothing, would otherwise leave the passenger
  // stuck on a "Pay" button that 500s the moment it's tapped, with no
  // way to ever confirm the booking. Same flow either way (still goes
  // through this same charge call from the same screen) — just skips
  // straight to confirmed instead of opening a Razorpay order for ₹0.
  if (amount <= 0) {
    await confirmPlatformFeePayment(booking, `free_${booking.id}`);
    return res.json({ free: true, amount: 0, status: "CONFIRMED" });
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100), // paise
    currency: "INR",
    receipt: booking.id,
    notes: { bookingId: booking.id }, // read back by the webhook handler below
  });

  await prisma.booking.update({ where: { id: booking.id }, data: { status: "CHARGE_ATTEMPTED" } });

  res.json({ orderId: order.id, amount, keyId: process.env.RAZORPAY_KEY_ID });
});

// POST /api/payments/:bookingId/mock-confirm — stand-in for a real
// Razorpay Checkout + webhook round trip. react-native-razorpay is a
// native module that can't run in Expo Go or a web preview (same
// constraint noted elsewhere for react-native-maps and
// @react-native-community/datetimepicker), so there's no way to drive a
// real payment sheet during that kind of testing. This does exactly what
// the webhook's payment.captured branch does, skipping the parts that
// require an actual Razorpay checkout session.
//
// Was gated on NODE_ENV === "development" alone. Same underlying
// incident as auth.routes.js's isDevTestNumber: Railway's NODE_ENV had
// been sitting on "development" in production by mistake, then got
// fixed to "production" — which correctly closed this endpoint off too,
// but that then blocked legitimate testing of the payment flow (e.g. on
// a device without a working webhook — see the RAZORPAY_WEBHOOK_SECRET
// gap this same session found) with no way to turn it back on without
// reopening NODE_ENV itself. Same fix: its own dedicated env var,
// independent of NODE_ENV, defaulting to off.
router.post("/:bookingId/mock-confirm", requireAuth, async (req, res) => {
  if (process.env.ALLOW_MOCK_PAYMENT_CONFIRM !== "true") {
    return res.status(404).json({ error: "Not found." });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking || booking.passengerId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (!["AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING"].includes(booking.status)) {
    return res.status(400).json({ error: "This booking isn't awaiting payment." });
  }

  await confirmPlatformFeePayment(booking, `mock_${booking.id}`);
  res.json({ success: true, status: "CONFIRMED" });
});

// POST /api/payments/webhook/razorpay — MUST be idempotent, since Razorpay
// can redeliver webhooks. We check current status before crediting again.
//
// One webhook covers four unrelated payment kinds now, told apart by
// which `notes` key the order was created with: a booking's platform
// fee (notes.bookingId, the original/only kind until now), a driver's
// license fee (notes.driverVerificationId), a vehicle's RC fee
// (notes.vehicleVerificationId), or a passenger's Aadhaar fee
// (notes.passengerVerificationId) — see verification.routes.js's
// charge endpoints for where each is set.
router.post("/webhook/razorpay", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "")
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (signature !== expected) {
    return res.status(400).json({ error: "Invalid signature." });
  }

  const { event, payload } = req.body;
  const notes = payload?.payment?.entity?.notes || {};
  const paymentId = payload?.payment?.entity?.id;
  const amountInr = payload?.payment?.entity?.amount != null ? payload.payment.entity.amount / 100 : null;

  if (notes.bookingId) {
    const bookingId = notes.bookingId;
    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { ride: true } });
    if (!booking) return res.status(404).json({ error: "Booking not found." });

    // Idempotency guard — a redelivered webhook must not double-process.
    if (booking.platformFeePaidAt) {
      return res.json({ success: true, alreadyProcessed: true });
    }

    if (event === "payment.captured") {
      await confirmPlatformFeePayment(booking, paymentId);
    } else if (event === "payment.failed") {
      await prisma.booking.update({ where: { id: bookingId }, data: { status: "PAYMENT_PENDING" } });
      await notify(booking.passengerId, "PAYMENT_FAILED", "Payment failed",
        "We couldn't process your payment. Please retry from your booking.", booking.id);
    }
  } else if (notes.driverVerificationId) {
    const dv = await prisma.driverVerification.findUnique({ where: { id: notes.driverVerificationId } });
    if (!dv) return res.status(404).json({ error: "Driver verification not found." });
    if (dv.paymentStatus === "PAID") return res.json({ success: true, alreadyProcessed: true });

    if (event === "payment.captured") {
      await confirmDriverVerificationPayment(dv.id, paymentId, amountInr);
      // Same live-push pattern as a booking's platform fee above — a
      // real Razorpay payment otherwise only shows up the next time
      // VerifyDriverScreen happens to refetch (on refocus), which for a
      // driver sitting right there waiting is the same "did it even go
      // through?" gap the booking-fee push was already built to close.
      getIO()?.to(`user:${dv.driverId}`).emit("verification:paymentConfirmed", { kind: "driver" });
    }
    // payment.failed here just leaves paymentStatus at CHARGE_ATTEMPTED —
    // the driver can retry from the same screen, same as a booking's
    // PAYMENT_PENDING retry path but without a separate status name
    // needed (there's no "seat" waiting to be released on a failure here).
  } else if (notes.vehicleVerificationId) {
    const vv = await prisma.vehicleVerification.findUnique({ where: { id: notes.vehicleVerificationId }, include: { vehicle: true } });
    if (!vv) return res.status(404).json({ error: "Vehicle verification not found." });
    if (vv.paymentStatus === "PAID") return res.json({ success: true, alreadyProcessed: true });

    if (event === "payment.captured") {
      await confirmVehicleVerificationPayment(vv.id, paymentId, amountInr);
      getIO()?.to(`user:${vv.vehicle.driverId}`).emit("verification:paymentConfirmed", { kind: "vehicle", vehicleId: vv.vehicleId });
    }
  } else if (notes.passengerVerificationId) {
    const pv = await prisma.passengerVerification.findUnique({ where: { id: notes.passengerVerificationId } });
    if (!pv) return res.status(404).json({ error: "Passenger verification not found." });
    if (pv.paymentStatus === "PAID") return res.json({ success: true, alreadyProcessed: true });

    if (event === "payment.captured") {
      await confirmPassengerVerificationPayment(pv.id, paymentId, amountInr);
      getIO()?.to(`user:${pv.userId}`).emit("verification:paymentConfirmed", { kind: "passenger" });
    }
  } else {
    return res.status(400).json({ error: "Missing payment reference." });
  }

  res.json({ success: true });
});

// POST /api/refunds/:bookingId/initiate — actually reverses the captured
// Razorpay payment, not just a database-only record. Only meaningful once
// the platform fee has been captured (there's a real razorpayPaymentId
// to refund).
//
// SECURITY: previously `requireAuth` only — no role check, no ownership
// check, and `amount` came straight from the request body with no
// validation at all. Any logged-in passenger or driver could POST any
// bookingId (theirs or not) with an arbitrary amount and this would
// actually call Razorpay to refund it. Nothing in the app ever called
// this route — admin's own refunds page (app/refunds/page.tsx) only
// updates the status of a Refund row that already exists; every real
// refund is created by refundIfPaid() (lib/refunds.js), triggered
// server-side by cancellation/no-show logic, never over HTTP — so this
// was a live, unused, exploitable door with real money behind it.
// Restricted to ADMIN, and amount is now clamped to what was actually
// captured rather than trusted verbatim from the request body.
router.post("/refunds/:bookingId/initiate", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { amount } = req.body;
  const now = new Date();
  const { refundWorkingDays } = await getAppConfig();

  const booking = await prisma.booking.findUnique({ where: { id: req.params.bookingId } });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

  const maxRefundable = Number(booking.platformFeeAmount || 0);
  if (!isPositiveNumber(amount) || amount > maxRefundable) {
    return res.status(400).json({ error: `Amount must be between 0 and Rs ${maxRefundable} (the amount actually charged).` });
  }

  let razorpayRefundId = null;
  if (booking.razorpayPaymentId) {
    const rzpRefund = await razorpay.payments.refund(booking.razorpayPaymentId, {
      amount: Math.round(amount * 100),
      notes: { bookingId: booking.id },
    });
    razorpayRefundId = rzpRefund.id;
  }
  // If there's no razorpayPaymentId, the platform fee was never charged
  // (e.g. driver cancelled before the passenger paid) — nothing to
  // reverse on Razorpay's side, so we still record the Refund row for
  // visibility but leave razorpayRefundId null.

  const refund = await prisma.refund.create({
    data: {
      bookingId: req.params.bookingId,
      amount,
      estimatedCompletionAt: addWorkingDays(now, refundWorkingDays),
      razorpayRefundId,
    },
  });

  await notify(booking.passengerId, "REFUND_UPDATE", "Refund initiated",
    `Your refund of Rs ${amount} will be credited within ${refundWorkingDays} working days.`, booking.id);

  res.status(201).json(refund);
});

// GET /api/payments/:bookingId/status
router.get("/:bookingId/status", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: { select: { driverId: true } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.passengerId !== req.user.id && booking.ride.driverId !== req.user.id) {
    return res.status(403).json({ error: "Not permitted." });
  }
  res.json({ status: booking.status });
});

// GET /api/payments/my-history — every booking where the passenger
// actually paid a platform fee in-app (regardless of what happened to
// the booking afterwards), not the old PAID/PAYMENT_PENDING status pair.
router.get("/my-history", requireAuth, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: {
      passengerId: req.user.id,
      OR: [{ platformFeePaidAt: { not: null } }, { status: "PAYMENT_PENDING" }],
    },
    include: { ride: true, refund: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(bookings);
});

// POST /api/payments/:bookingId/retry — re-attempts a failed platform-fee charge
router.post("/:bookingId/retry", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking || booking.passengerId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.status !== "PAYMENT_PENDING") {
    return res.status(400).json({ error: "This booking isn't awaiting a retry." });
  }

  const amount = Number(booking.platformFeeAmount);

  // Same free-fee guard as /charge above — a retry can only exist because
  // an earlier attempt actually failed, but if the fee's since been
  // dropped to free (or was always going to round to 0) there's nothing
  // left to retry against a payment gateway that won't accept it.
  if (amount <= 0) {
    await confirmPlatformFeePayment(booking, `free_${booking.id}`);
    return res.json({ free: true, amount: 0, status: "CONFIRMED" });
  }

  await prisma.booking.update({ where: { id: booking.id }, data: { status: "CHARGE_ATTEMPTED" } });

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt: `${booking.id}-retry-${Date.now()}`,
    notes: { bookingId: booking.id },
  });

  res.json({ orderId: order.id, amount, keyId: process.env.RAZORPAY_KEY_ID });
});

// GET /api/refunds/:id/status
router.get("/refunds/:id/status", requireAuth, async (req, res) => {
  const refund = await prisma.refund.findUnique({
    where: { id: req.params.id },
    include: { booking: { select: { passengerId: true, ride: { select: { driverId: true } } } } },
  });
  if (!refund) return res.status(404).json({ error: "Refund not found." });
  if (refund.booking.passengerId !== req.user.id && refund.booking.ride.driverId !== req.user.id) {
    return res.status(403).json({ error: "Not permitted." });
  }
  const { booking, ...refundOnly } = refund;
  res.json(refundOnly);
});

export default router;
