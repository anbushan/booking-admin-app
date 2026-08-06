import { prisma } from "./prisma.js";
import { razorpay } from "./razorpay.js";
import { notify } from "./notify.js";

const REFUND_WORKING_DAYS = Number(process.env.REFUND_WORKING_DAYS || 3);

function addWorkingDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

// Call this whenever a booking is being cancelled and might already have
// been charged. Safe to call on any booking — it's a no-op if the
// booking was never paid (nothing to reverse), and only creates a
// Refund row when there's actually money to give back.
export async function refundIfPaid(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { ride: true, refund: true },
  });
  if (!booking) return null;
  if (booking.refund) return booking.refund; // already refunded, don't double-process
  if (!["PAID", "CHARGE_ATTEMPTED", "PAYMENT_PENDING"].includes(booking.status)) {
    return null; // never charged, nothing to refund
  }

  const amount = Number(booking.ride.pricePerSeat) * booking.seatsBooked;
  const now = new Date();

  let razorpayRefundId = null;
  if (booking.razorpayPaymentId) {
    const rzpRefund = await razorpay.payments.refund(booking.razorpayPaymentId, {
      amount: Math.round(amount * 100),
      notes: { bookingId: booking.id, reason: "cancellation" },
    });
    razorpayRefundId = rzpRefund.id;
  }

  const refund = await prisma.refund.create({
    data: {
      bookingId,
      amount,
      estimatedCompletionAt: addWorkingDays(now, REFUND_WORKING_DAYS),
      razorpayRefundId,
    },
  });

  await notify(
    booking.passengerId,
    "REFUND_UPDATE",
    "Refund initiated",
    `Your trip was cancelled. Rs ${amount} will be credited within ${REFUND_WORKING_DAYS} working days.`
  );

  return refund;
}
