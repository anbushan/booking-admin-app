import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import { razorpay } from "../lib/razorpay.js";

const router = Router();
const REFUND_WORKING_DAYS = Number(process.env.REFUND_WORKING_DAYS || 3);

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

// POST /api/payments/:bookingId/charge — called right after trip completion.
router.post("/:bookingId/charge", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.passengerId !== req.user.id) {
    return res.status(403).json({ error: "Not permitted." });
  }

  const amount = Number(booking.ride.pricePerSeat) * booking.seatsBooked;

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100), // paise
    currency: "INR",
    receipt: booking.id,
    notes: { bookingId: booking.id }, // read back by the webhook handler below
  });

  res.json({ orderId: order.id, amount, keyId: process.env.RAZORPAY_KEY_ID });
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

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

  // Idempotency guard — a redelivered webhook must not double-credit.
  if (booking.status === "PAID") {
    return res.json({ success: true, alreadyProcessed: true });
  }

  if (event === "payment.captured") {
    const paymentId = payload.payment.entity.id;
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "PAID", razorpayPaymentId: paymentId },
    });
    await notify(booking.passengerId, "PAYMENT_SUCCESSFUL", "Payment successful",
      "Your trip payment went through.");
    // Driver payout only happens here, on confirmed capture — never on
    // "trip complete" alone, per the plan's payment state machine.
  } else if (event === "payment.failed") {
    await prisma.booking.update({ where: { id: bookingId }, data: { status: "PAYMENT_PENDING" } });
    await notify(booking.passengerId, "PAYMENT_FAILED", "Payment failed",
      "We couldn't process your payment. Please retry from your booking.");
  }

  res.json({ success: true });
});

// POST /api/refunds/:bookingId/initiate — actually reverses the captured
// Razorpay payment, not just a database-only record. Only meaningful once
// a booking has reached PAID (there's a real razorpayPaymentId to refund).
router.post("/refunds/:bookingId/initiate", requireAuth, async (req, res) => {
  const { amount } = req.body;
  const now = new Date();

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
  // If there's no razorpayPaymentId, the booking was never charged (e.g.
  // driver cancelled before trip-complete) — nothing to reverse on
  // Razorpay's side, so we still record the Refund row for visibility
  // but leave razorpayRefundId null.

  const refund = await prisma.refund.create({
    data: {
      bookingId: req.params.bookingId,
      amount,
      estimatedCompletionAt: addWorkingDays(now, REFUND_WORKING_DAYS),
      razorpayRefundId,
    },
  });

  await notify(booking.passengerId, "REFUND_UPDATE", "Refund initiated",
    `Your refund of Rs ${amount} will be credited within ${REFUND_WORKING_DAYS} working days.`);

  res.status(201).json(refund);
});

// GET /api/payments/:bookingId/status
router.get("/:bookingId/status", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.bookingId } });
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  res.json({ status: booking.status });
});

// GET /api/payments/my-history
router.get("/my-history", requireAuth, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { passengerId: req.user.id, status: { in: ["PAID", "PAYMENT_PENDING"] } },
    include: { ride: true, refund: true },
    orderBy: { tripCompletedAt: "desc" },
  });
  res.json(bookings);
});

// POST /api/payments/:bookingId/retry — re-attempts a failed charge
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

  const amount = Number(booking.ride.pricePerSeat) * booking.seatsBooked;
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
