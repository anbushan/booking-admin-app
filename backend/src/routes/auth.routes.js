import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { sendOtpViaMsg91 } from "../lib/msg91.js";
import { isPhone } from "../lib/validate.js";

const router = Router();

const OTP_TTL_SECONDS = 300; // 5 minutes
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_VERIFY_ATTEMPTS = 5;

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

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  return res.json({
    success: true,
    isNewUser, // true -> client should route to Register screen; false -> Home
    token,
    user,
  });
});

export default router;
