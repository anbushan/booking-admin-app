import { prisma } from "./prisma.js";
import { notify } from "./notify.js";
import { getAppConfig } from "./appConfig.js";

// The single spot where a passenger's UserCredit balance actually takes
// effect — called once, from bookings.routes.js PUT /:id/accept, at the
// exact moment platformFeeAmount is frozen. Never re-applied at
// charge/retry time (payments.routes.js just charges whatever
// platformFeeAmount already is, unchanged) — that's deliberate: exactly
// one place this can ever happen per booking, so there's no risk of a
// retry re-discounting an already-discounted fee.
//
// Oldest credit first, and a credit is consumed in full the moment it's
// applied at all — no partial-credit carryover if the discount exceeds
// the fee. Keeps the ledger simple; credit amounts are small (tens of
// rupees) specifically so this doesn't waste much in practice.
export async function applyAvailableCredit(passengerId, rawFeeAmount) {
  if (rawFeeAmount <= 0) return { finalAmount: rawFeeAmount, creditAppliedInr: 0 };

  const credits = await prisma.userCredit.findMany({
    where: { userId: passengerId, status: "AVAILABLE" },
    orderBy: { createdAt: "asc" },
  });
  if (credits.length === 0) return { finalAmount: rawFeeAmount, creditAppliedInr: 0 };

  // A full-waiver credit (MVP promo codes — see promoCodes.routes.js)
  // zeroes the fee outright regardless of its own amountInr, ahead of
  // and instead of the usual sum-oldest-first loop below. Checked as a
  // find, not just credits[0], so a waiver doesn't get skipped just for
  // sitting behind an older partial credit in the queue.
  const waiver = credits.find((c) => c.fullWaiver);
  if (waiver) {
    return { finalAmount: 0, creditAppliedInr: rawFeeAmount, usedCreditIds: [waiver.id] };
  }

  let remaining = rawFeeAmount;
  let creditAppliedInr = 0;
  const usedCreditIds = [];
  for (const credit of credits) {
    if (remaining <= 0) break;
    creditAppliedInr += Math.min(Number(credit.amountInr), remaining);
    remaining -= Number(credit.amountInr);
    usedCreditIds.push(credit.id);
  }

  return { finalAmount: Math.max(0, remaining), creditAppliedInr, usedCreditIds };
}

// Second half of applyAvailableCredit above — marks the credits it
// picked as spent, once the booking row that used them actually exists
// (accept's own update happens in the same call site, right after this).
// Split into two steps because the credit *decision* has to happen
// before the fee amount is known/stored, but the credit *write* needs
// the bookingId to stamp usedOnBookingId with.
export async function markCreditsUsed(usedCreditIds, bookingId) {
  if (!usedCreditIds?.length) return;
  await prisma.userCredit.updateMany({
    where: { id: { in: usedCreditIds } },
    data: { status: "USED", usedAt: new Date(), usedOnBookingId: bookingId },
  });
}

// Called after a platform fee payment is confirmed (payments.routes.js
// confirmPlatformFeePayment) — checks whether this passenger was
// somebody's referee and, if this is genuinely their first-ever paid
// ride, credits the referrer and closes out the Referral. Real usage,
// not just a signup, is what earns the referrer their reward — a
// referee who never actually takes a ride was never worth anything to
// refer in the first place.
export async function maybeCompleteReferral(refereeId) {
  const referral = await prisma.referral.findUnique({ where: { refereeId } });
  if (!referral || referral.status !== "PENDING") return;

  // Runs after this booking's own platformFeePaidAt update, so "first
  // ever" means exactly 1 paid booking exists right now, not 0.
  const paidCount = await prisma.booking.count({
    where: { passengerId: refereeId, platformFeePaidAt: { not: null } },
  });
  if (paidCount !== 1) return;

  const config = await getAppConfig();
  const referrerCredit = await prisma.userCredit.create({
    data: { userId: referral.referrerId, amountInr: config.referralRewardInr, source: "REFERRAL_REFERRER", sourceId: referral.id },
  });
  await prisma.referral.update({
    where: { id: referral.id },
    data: { status: "COMPLETED", completedAt: new Date(), referrerCreditId: referrerCredit.id },
  });
  await notify(
    referral.referrerId,
    "REFERRAL_COMPLETED",
    "Your referral earned you a reward!",
    `Someone you referred took their first ride — you've earned Rs ${config.referralRewardInr} credit toward your next platform fee.`
  );
}
