import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { sendOtpViaMsg91 } from "../lib/msg91.js";
import { isPhone } from "../lib/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { serializeUser } from "../lib/serializeUser.js";

const router = Router();

const OTP_TTL_SECONDS = 300; // 5 minutes
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_VERIFY_ATTEMPTS = 5;

// Passcode login is deliberately weaker than OTP (a static code that
// doesn't expire on its own), so it gets its own, stricter lockout
// instead of reusing OTP's constants — more attempts wasted per guess
// isn't the risk here, an attacker having unlimited TIME to guess is.
const PASSCODE_MAX_ATTEMPTS = 5;
const PASSCODE_LOCKOUT_SECONDS = 900; // 15 minutes

function signInResponse(user, isNewUser) {
  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
  return {
    success: true,
    isNewUser,
    chooseRole: !isNewUser && user.isDriver && user.isPassenger,
    token,
    user: serializeUser(user),
  };
}

function isDevTestNumber(phone) {
  // Double-gate, deliberately: both conditions must hold, so a
  // misconfigured NODE_ENV alone can never unlock the static OTP.
  const whitelist = (process.env.DEV_TEST_NUMBERS || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  return process.env.NODE_ENV === "development" && whitelist.includes(phone);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/send-otp
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!isPhone(phone)) {
    return res.status(400).json({ error: "Enter a valid 10-digit phone number." });
  }

  const cooldownKey = `otp:cooldown:${phone}`;
  const cooling = await redis.get(cooldownKey);
  if (cooling) {
    return res.status(429).json({ error: "Please wait before requesting another OTP." });
  }

  let otp;
  if (isDevTestNumber(phone)) {
    otp = process.env.DEV_STATIC_OTP || "123456";
    // no MSG91 call — no SMS credits spent
  } else {
    otp = generateOtp();
    try {
      await sendOtpViaMsg91(phone, otp);
    } catch (err) {
      // Express 4 doesn't catch rejections thrown inside an async handler —
      // left unguarded, this takes down the entire process for every user,
      // not just this request (e.g. any real signup attempt while MSG91
      // isn't configured). Fail this one request instead.
      console.error(`send-otp failed for ${phone}:`, err.message);
      return res.status(502).json({ error: "Couldn't send the verification code. Please try again." });
    }
  }

  await redis.set(`otp:${phone}`, otp, "EX", OTP_TTL_SECONDS);
  await redis.set(`otp:attempts:${phone}`, 0, "EX", OTP_TTL_SECONDS);
  await redis.set(cooldownKey, "1", "EX", RESEND_COOLDOWN_SECONDS);

  return res.json({
    success: true,
    message: isDevTestNumber(phone) ? "OTP sent (dev mode - static)" : "OTP sent",
  });
});

// POST /api/auth/verify-otp
// Same verification path for both signup and login — the branch happens
// below, after OTP is confirmed, based on whether the user already exists.
router.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  if (!isPhone(phone) || !/^\d{4,6}$/.test(otp || "")) {
    return res.status(400).json({ error: "Enter a valid phone number and OTP." });
  }

  const attemptsKey = `otp:attempts:${phone}`;
  const attempts = Number((await redis.get(attemptsKey)) || 0);
  if (attempts >= MAX_VERIFY_ATTEMPTS) {
    return res.status(429).json({ error: "Too many attempts. Request a new OTP." });
  }

  const storedOtp = await redis.get(`otp:${phone}`);
  if (!storedOtp) {
    return res.status(400).json({ error: "OTP expired. Request a new one." });
  }

  if (storedOtp !== otp) {
    await redis.incr(attemptsKey);
    return res.status(400).json({ error: "Incorrect OTP." });
  }

  await redis.del(`otp:${phone}`);
  await redis.del(attemptsKey);

  let user = await prisma.user.findUnique({ where: { phone } });
  const isNewUser = !user;

  if (!user) {
    user = await prisma.user.create({ data: { phone } });
  }

  if (user.disabled) {
    return res.status(403).json({ error: "This account has been suspended." });
  }

  return res.json(signInResponse(user, isNewUser));
});

function generatePasscode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/passcode/generate — requires being logged in already
// (via OTP), since this is meant to save a *returning* login, not be a
// way to get in the first time. Returns the plaintext code exactly
// once; only the bcrypt hash is ever kept after this response, so
// there's no "forgot my passcode, show it again" — generating a new one
// is the only recovery, and it replaces (invalidates) the old one.
router.post("/passcode/generate", requireAuth, async (req, res) => {
  const passcode = generatePasscode();
  const passcodeHash = await bcrypt.hash(passcode, 10);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passcodeHash, passcodeCreatedAt: new Date() },
  });
  res.json({ passcode, phone: req.user.phone });
});

// POST /api/auth/passcode/revoke — turns the downloaded file into a
// dead end without touching OTP login at all, for whenever a user
// suspects theirs leaked (lost the device it was saved on, etc.).
router.post("/passcode/revoke", requireAuth, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passcodeHash: null, passcodeCreatedAt: null },
  });
  res.json({ success: true });
});

// POST /api/auth/verify-passcode — the alternative login path itself.
// Same lockout shape as verify-otp (a Redis attempts counter), but with
// its own longer, non-self-expiring cooldown — see PASSCODE_MAX_ATTEMPTS
// above for why a static, non-expiring code needs a stricter guard than
// an OTP that's already gone in 5 minutes regardless.
router.post("/verify-passcode", async (req, res) => {
  const { phone, passcode } = req.body;
  if (!isPhone(phone) || !/^\d{6}$/.test(passcode || "")) {
    return res.status(400).json({ error: "Enter a valid phone number and passcode." });
  }

  const attemptsKey = `passcode:attempts:${phone}`;
  const attempts = Number((await redis.get(attemptsKey)) || 0);
  if (attempts >= PASSCODE_MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Too many attempts. Try again later, or log in with OTP instead." });
  }

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || !user.passcodeHash) {
    // Same generic error either way — confirming "this number has no
    // passcode set up" to an unauthenticated caller is its own leak.
    await redis.set(attemptsKey, attempts + 1, "EX", PASSCODE_LOCKOUT_SECONDS);
    return res.status(400).json({ error: "Incorrect passcode." });
  }

  const valid = await bcrypt.compare(passcode, user.passcodeHash);
  if (!valid) {
    await redis.set(attemptsKey, attempts + 1, "EX", PASSCODE_LOCKOUT_SECONDS);
    return res.status(400).json({ error: "Incorrect passcode." });
  }

  if (user.disabled) {
    return res.status(403).json({ error: "This account has been suspended." });
  }

  await redis.del(attemptsKey);
  return res.json(signInResponse(user, false));
});

export default router;
