import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import { razorpay } from "../lib/razorpay.js";
import { getAppConfig } from "../lib/appConfig.js";

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

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100), // paise
    currency: "INR",
    receipt: booking.id,
    notes: { bookingId: booking.id }, // read back by the webhook handler below
  });

  await prisma.booking.update({ where: { id: booking.id }, data: { status: "CHARGE_ATTEMPTED" } });

  res.json({ orderId: order.id, amount, keyId: process.env.RAZORPAY_KEY_ID });
});

// POST /api/payments/:bookingId/mock-confirm — dev-only stand-in for a
// real Razorpay Checkout + webhook round trip. react-native-razorpay is
// a native module that can't run in Expo Go or a web preview (same
// constraint noted elsewhere for react-native-maps and
// @react-native-community/datetimepicker), so there's no way to drive a
// real payment sheet during that kind of testing. This does exactly what
// the webhook's payment.captured branch does, skipping the parts that
// require an actual Razorpay checkout session. Gated on NODE_ENV alone
// (not a second flag) is deliberate here — unlike the OTP bypass, this
// endpoint only ever *helps* a booking along a path it could already
// reach for free (no charge is simulated, no money-adjacent bypass), and
// it's inert in any non-development deploy.
router.post("/:bookingId/mock-confirm", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV !== "development") {
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
  const bookingId = payload?.payment?.entity?.notes?.bookingId;
  if (!bookingId) return res.status(400).json({ error: "Missing booking reference." });

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { ride: true } });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

  // Idempotency guard — a redelivered webhook must not double-process.
  if (booking.platformFeePaidAt) {
    return res.json({ success: true, alreadyProcessed: true });
  }

  if (event === "payment.captured") {
    await confirmPlatformFeePayment(booking, payload.payment.entity.id);
  } else if (event === "payment.failed") {
    await prisma.booking.update({ where: { id: bookingId }, data: { status: "PAYMENT_PENDING" } });
    await notify(booking.passengerId, "PAYMENT_FAILED", "Payment failed",
      "We couldn't process your payment. Please retry from your booking.", booking.id);
  }

  res.json({ success: true });
});

// POST /api/refunds/:bookingId/initiate — actually reverses the captured
// Razorpay payment, not just a database-only record. Only meaningful once
// the platform fee has been captured (there's a real razorpayPaymentId
// to refund).
router.post("/refunds/:bookingId/initiate", requireAuth, async (req, res) => {
  const { amount } = req.body;
  const now = new Date();
  const { refundWorkingDays } = await getAppConfig();

  const booking = await prisma.booking.findUnique({ where: { id: req.params.bookingId } });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

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
  const booking = await prisma.booking.findUnique({ where: { id: req.params.bookingId } });
  if (!booking) return res.status(404).json({ error: "Booking not found." });
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
  const refund = await prisma.refund.findUnique({ where: { id: req.params.id } });
  if (!refund) return res.status(404).json({ error: "Refund not found." });
  res.json(refund);
});

export default router;
