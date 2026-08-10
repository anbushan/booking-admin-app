import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/calls/initiate — bridges a call between the two parties on
// a booking via a call-masking proxy. Neither side ever sees the other's
// real number at the app layer.
router.post("/initiate", requireAuth, async (req, res) => {
  const { bookingId, calleeRole } = req.body; // calleeRole: "DRIVER" | "PASSENGER"

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { ride: { include: { driver: true } }, passenger: true },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

  const caller = req.user;
  const callee = calleeRole === "DRIVER" ? booking.ride.driver : booking.passenger;

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

// POST /api/calls/webhook — call-proxy provider's status callback
router.post("/webhook", async (req, res) => {
  const { callLogId, status, durationSec } = req.body;
  if (!callLogId) return res.status(400).json({ error: "Missing call reference." });

  await prisma.callLog.update({
    where: { id: callLogId },
    data: { status, durationSec },
  });

  res.json({ success: true });
});

// GET /api/calls/history/:bookingId
router.get("/history/:bookingId", requireAuth, async (req, res) => {
  const logs = await prisma.callLog.findMany({
    where: { bookingId: req.params.bookingId },
    orderBy: { createdAt: "desc" },
  });
  res.json(logs);
});

export default router;
