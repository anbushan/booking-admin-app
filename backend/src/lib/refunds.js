import { prisma } from "./prisma.js";
import { razorpay } from "./razorpay.js";
import { notify } from "./notify.js";
import { getAppConfig } from "./appConfig.js";

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
//
// Only the platform fee is ever charged in-app (the remaining fare is
// settled directly between passenger and driver), so that's the only
// amount there is to refund — never the full fare.
export async function refundIfPaid(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { ride: true, refund: true },
  });
  if (!booking) return null;
  if (booking.refund) return booking.refund; // already refunded, don't double-process
  if (!booking.platformFeePaidAt || !booking.platformFeeAmount) {
    return null; // fee never charged/captured, nothing to refund
  }

  const amount = Number(booking.platformFeeAmount);
  const now = new Date();
  const { refundWorkingDays } = await getAppConfig();

  // A booking paid via the dev-only mock-confirm endpoint (see
  // payments.routes.js) has a fake razorpayPaymentId ("mock_...") —
  // calling the real refund API with that throws (not a real Razorpay
  // payment), which used to abort this whole function before the Refund
  // row below ever got created. Skip the real call for those so the
  // dev/test flow still closes the loop (refund record + notification),
  // just without an actual razorpayRefundId.
  let razorpayRefundId = null;
  const isMockPayment = booking.razorpayPaymentId?.startsWith("mock_");
  if (booking.razorpayPaymentId && !isMockPayment) {
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
      estimatedCompletionAt: addWorkingDays(now, refundWorkingDays),
      razorpayRefundId,
    },
  });

  await notify(
    booking.passengerId,
    "REFUND_UPDATE",
    "Refund initiated",
    `Your trip was cancelled. Rs ${amount} will be credited within ${refundWorkingDays} working days.`,
    bookingId
  );

  return refund;
}
