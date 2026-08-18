import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate, isNonEmptyString } from "../lib/validate.js";

const router = Router();

// POST /api/promo-codes/redeem — codes themselves are admin-managed
// (created directly in the admin app against the same DB, same pattern
// as AppConfig/notification templates — see admin/app/promo-codes).
// This is the only backend involvement: validating and granting the
// UserCredit, since that's a real money-shaped action worth having in
// one place with the same ledger referrals use.
router.post("/redeem", requireAuth, async (req, res) => {
  const { code } = req.body;
  const errors = validate({ code }, [{ field: "code", check: isNonEmptyString, message: "Enter a promo code." }]);
  if (errors.length) return res.status(400).json({ errors });

  const promo = await prisma.promoCode.findUnique({ where: { code: String(code).toUpperCase().trim() } });
  if (!promo || !promo.active) return res.status(400).json({ error: "That code isn't valid." });
  if (promo.expiresAt && promo.expiresAt < new Date()) return res.status(400).json({ error: "That code has expired." });
  if (promo.maxRedemptions != null && promo.redemptionCount >= promo.maxRedemptions) {
    return res.status(400).json({ error: "That code has already been fully claimed." });
  }

  const already = await prisma.promoCodeRedemption.findUnique({
    where: { promoCodeId_userId: { promoCodeId: promo.id, userId: req.user.id } },
  });
  if (already) return res.status(400).json({ error: "You've already used this code." });

  if (promo.firstRideOnly) {
    const paidCount = await prisma.booking.count({ where: { passengerId: req.user.id, platformFeePaidAt: { not: null } } });
    if (paidCount > 0) return res.status(400).json({ error: "This code is only for your first ride." });
  }

  const credit = await prisma.userCredit.create({
    data: {
      userId: req.user.id,
      // fullWaiver credits carry amountInr: 0 — the real "how much does
      // this cover" answer for those is "the entire fee, whatever it
      // is", which applyAvailableCredit reads off the fullWaiver flag,
      // not this number. discountInr on a fullWaiver code is otherwise
      // unused (the admin form still has a required field to fill).
      amountInr: promo.fullWaiver ? 0 : promo.discountInr,
      fullWaiver: promo.fullWaiver,
      source: "PROMO_CODE",
      sourceId: promo.id,
    },
  });
  await prisma.$transaction([
    prisma.promoCodeRedemption.create({ data: { promoCodeId: promo.id, userId: req.user.id, creditId: credit.id } }),
    prisma.promoCode.update({ where: { id: promo.id }, data: { redemptionCount: { increment: 1 } } }),
  ]);

  res.json({
    success: true,
    fullWaiver: promo.fullWaiver,
    creditAppliedInr: promo.fullWaiver ? null : Number(promo.discountInr),
  });
});

export default router;
