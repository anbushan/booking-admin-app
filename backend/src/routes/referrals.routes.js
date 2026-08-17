import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getAppConfig } from "../lib/appConfig.js";
import { validate, isNonEmptyString } from "../lib/validate.js";

const router = Router();

// Excludes visually-ambiguous characters (0/O, 1/I/L) — this gets read
// aloud and typed in by hand a lot more than a normal ID ever would.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function generateCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// GET /api/referrals/me — this user's own shareable code (generated
// lazily on first request, not at signup, so an account created before
// this feature existed still gets one the moment it's actually needed),
// plus referral stats and current spendable credit balance.
router.get("/me", requireAuth, async (req, res) => {
  let user = await prisma.user.findUnique({ where: { id: req.user.id } });

  if (!user.referralCode) {
    // Collision odds at this alphabet/length are vanishingly small, but
    // retry a handful of times rather than trust a single draw against
    // the unique constraint under real concurrency.
    for (let attempt = 0; attempt < 5 && !user.referralCode; attempt++) {
      try {
        user = await prisma.user.update({ where: { id: req.user.id }, data: { referralCode: generateCode() } });
      } catch (err) {
        if (err.code !== "P2002") throw err; // unique constraint — try again
      }
    }
  }

  const [referrals, creditAgg] = await Promise.all([
    prisma.referral.findMany({
      where: { referrerId: req.user.id },
      include: { referee: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userCredit.aggregate({ where: { userId: req.user.id, status: "AVAILABLE" }, _sum: { amountInr: true } }),
  ]);

  const config = await getAppConfig();
  res.json({
    referralCode: user.referralCode,
    rewardInr: config.referralRewardInr,
    refereeRewardInr: config.refereeRewardInr,
    availableCreditInr: Number(creditAgg._sum.amountInr || 0),
    referrals: referrals.map((r) => ({
      id: r.id,
      status: r.status,
      refereeName: r.referee.name || r.referee.phone,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    })),
  });
});

// POST /api/referrals/redeem — a new-ish user enters someone else's
// code. Grants the referee their credit immediately; the referrer only
// gets theirs once the referee completes a real, paid first ride (see
// maybeCompleteReferral in lib/credits.js, triggered from
// payments.routes.js) — a signup alone isn't worth anything to have
// referred.
router.post("/redeem", requireAuth, async (req, res) => {
  const { code } = req.body;
  const errors = validate({ code }, [{ field: "code", check: isNonEmptyString, message: "Enter a referral code." }]);
  if (errors.length) return res.status(400).json({ errors });

  const referrer = await prisma.user.findUnique({ where: { referralCode: String(code).toUpperCase().trim() } });
  if (!referrer) return res.status(400).json({ error: "That referral code doesn't exist." });
  if (referrer.id === req.user.id) return res.status(400).json({ error: "You can't refer yourself." });

  const existing = await prisma.referral.findUnique({ where: { refereeId: req.user.id } });
  if (existing) return res.status(400).json({ error: "You've already used a referral code." });

  // Same "this is genuinely a new-ish user" spirit as a first-ride promo
  // code — someone who's already an active rider redeeming a code long
  // after the fact isn't who this program is for.
  const priorPaidCount = await prisma.booking.count({ where: { passengerId: req.user.id, platformFeePaidAt: { not: null } } });
  if (priorPaidCount > 0) {
    return res.status(400).json({ error: "Referral codes are only for new riders, before your first paid ride." });
  }

  const config = await getAppConfig();
  const credit = await prisma.userCredit.create({
    data: { userId: req.user.id, amountInr: config.refereeRewardInr, source: "REFERRAL_REFEREE" },
  });
  await prisma.referral.create({
    data: { referrerId: referrer.id, refereeId: req.user.id, refereeCreditId: credit.id },
  });

  res.json({ success: true, creditAppliedInr: config.refereeRewardInr });
});

export default router;
