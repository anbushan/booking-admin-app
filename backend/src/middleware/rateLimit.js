import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../lib/redis.js";

// Redis-backed (not the in-memory default) for the same reason userCache/
// appConfig/signedUrlCache moved to Redis: this backend runs as several
// PM2 worker processes behind Nginx (see ecosystem.config.js). The
// in-memory store express-rate-limit uses by default counts requests
// per-process — with N workers, a "100 requests / 5 min" limit would
// actually allow up to N×100, since each worker keeps its own counter
// and Nginx round-robins requests between them. Redis gives every worker
// one shared counter, so the limit means what it says regardless of how
// many workers are running.
function makeLimiter({ windowMs, max, message, keyPrefix }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // adds RateLimit-* response headers
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: `rl:${keyPrefix}:`,
    }),
    message: { error: message },
    // Default keying is req.ip; requires `app.set("trust proxy", ...)`
    // in index.js (Nginx sits in front) or every request would key off
    // Nginx's own address instead of the real client IP.
  });
}

// Global safety net, mounted once for every route in index.js. Generous
// on purpose — this exists to blunt scripted abuse/DoS-shaped traffic,
// not to constrain normal app usage (the mobile app's own polling, at
// its tightest, is a few requests every few seconds per user, well
// under this).
export const generalLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  max: 600,
  message: "Too many requests. Please slow down and try again shortly.",
  keyPrefix: "general",
});

// OTP send/verify are the classic abuse target for a phone-auth flow —
// each send-otp call spends a real SMS credit, and unlimited verify-otp
// attempts turn a 6-digit OTP into a brute-forceable secret. Both routes
// already have their own phone-keyed guards (see auth.routes.js: a
// resend cooldown and a max-attempts counter, both scoped to the phone
// number in the request body) — this is a *different*, complementary
// layer scoped to IP instead, closing the gap where the phone-keyed
// guards don't help at all: one IP cycling through many different phone
// numbers to drain SMS credits or brute-force OTPs at scale.
export const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many attempts from this device. Please try again in a few minutes.",
  keyPrefix: "auth",
});

// Payment initiation/webhook-adjacent routes — not as hot a target as
// OTP (no SMS cost, and Razorpay's own dashboard/webhook signature
// verification is the real backstop against forged calls) but still
// worth bounding tighter than the general default against scripted
// retry storms against a paid endpoint.
export const paymentsLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: "Too many payment requests. Please wait a moment and try again.",
  keyPrefix: "payments",
});
