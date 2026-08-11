import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/calls/initiate — bridges a call between the two parties on
// a booking via a call-masking proxy. Neither side ever sees the other's
// real number at the app layer.
//
// SECURITY: previously had no check that the caller was actually one of
// the two parties on the booking — any authenticated user could supply
// any bookingId and calleeRole and get back the callee's phone number.
// Worse than it sounds: since CALL_PROXY_ENABLED is unset in production
// (no real masking provider wired up yet — see the fallback below),
// proxyNumber IS the real number, so this handed out any user's actual
// phone number to any other logged-in stranger who could guess or obtain
// a bookingId. Now requires the caller be the booking's passenger or
// driver, and calleeRole is derived from that (not trusted from the
// body) so a caller can't request their own number back as "callee".
router.post("/initiate", requireAuth, async (req, res) => {
  const { bookingId } = req.body;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { ride: { include: { driver: true } }, passenger: true },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

  const isPassenger = booking.passengerId === req.user.id;
  const isDriver = booking.ride.driverId === req.user.id;
  if (!isPassenger && !isDriver) {
    return res.status(403).json({ error: "Not permitted." });
  }

  const caller = req.user;
  const callee = isPassenger ? booking.ride.driver : booking.passenger;

  if (process.env.CALL_PROXY_ENABLED !== "true") {
    // No real masking provider configured (this is the actual state in
    // production right now, not just local dev — CALL_PROXY_ENABLED is
    // unset there too) — this used to return a literal, undialable
    // placeholder string, which is why tapping "Call" never opened
    // anything. Falls back to the callee's real number so the button
    // actually works; there's no masking to speak of either way until
    // a real provider is wired up in the branch below.
    const log = await prisma.callLog.create({
      data: {
        bookingId,
        callerId: caller.id,
        calleeId: callee.id,
        proxyNumber: callee.phone,
        status: "INITIATED",
      },
    });
    return res.json({ proxyNumber: log.proxyNumber, callLogId: log.id, mocked: true });
  }

  // TODO: real Exotel/Knowlarity call-bridging API call, e.g.:
  //   const response = await fetch("https://api.exotel.com/v1/Accounts/{sid}/Calls/connect.json", {
  //     method: "POST",
  //     headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString("base64")}` },
  //     body: new URLSearchParams({ From: caller.phone, To: callee.phone, CallerId: exotelVirtualNumber }),
  //   });
  // No real masking provider is wired up yet — CALL_PROXY_ENABLED=true
  // used to just return a literal, undialable placeholder string here,
  // which is why the in-app call button never actually opened anything.
  // Falling back to the callee's real number keeps the button working
  // (a direct call, no number-masking) until the above is built; at
  // that point this becomes the mocked proxyNumber instead.
  const proxyNumber = callee.phone;

  const log = await prisma.callLog.create({
    data: { bookingId, callerId: caller.id, calleeId: callee.id, proxyNumber, status: "INITIATED" },
  });

  res.json({ proxyNumber, callLogId: log.id });
});

// POST /api/calls/webhook — call-proxy provider's status callback.
//
// SECURITY NOTE (not fixed here, deliberately): unlike the Razorpay
// webhook, this has no signature verification — it's wide open to
// anyone who knows or guesses a callLogId. Left as-is because there's no
// real provider secret to verify against yet (see the TODO above this
// file's /initiate handler — Exotel/Knowlarity integration isn't wired
// up, so this path is currently unreachable in production). Whoever
// wires up the real provider should add signature verification at the
// same time, the way payments.routes.js's webhook already does. Added a
// not-found guard below so a bad callLogId 404s cleanly instead of
// throwing an unhandled Prisma error.
router.post("/webhook", async (req, res) => {
  const { callLogId, status, durationSec } = req.body;
  if (!callLogId) return res.status(400).json({ error: "Missing call reference." });

  try {
    await prisma.callLog.update({
      where: { id: callLogId },
      data: { status, durationSec },
    });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Call log not found." });
    throw err;
  }

  res.json({ success: true });
});

// GET /api/calls/history/:bookingId
//
// SECURITY: previously returned call metadata (who called whom, when,
// how long) for any bookingId with no check the caller was a party to
// it.
router.get("/history/:bookingId", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: { select: { driverId: true } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.passengerId !== req.user.id && booking.ride.driverId !== req.user.id) {
    return res.status(403).json({ error: "Not permitted." });
  }

  const logs = await prisma.callLog.findMany({
    where: { bookingId: req.params.bookingId },
    orderBy: { createdAt: "desc" },
  });
  res.json(logs);
});

export default router;
