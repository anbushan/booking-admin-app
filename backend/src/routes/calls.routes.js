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
    // Dev-mode mock — same pattern as the static-OTP bypass, keeps local
    // development free of real Exotel/Knowlarity charges.
    const log = await prisma.callLog.create({
      data: {
        bookingId,
        callerId: caller.id,
        calleeId: callee.id,
        proxyNumber: "+91-DEV-MOCK-0000",
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
  const proxyNumber = "+91-EXOTEL-PLACEHOLDER";

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
