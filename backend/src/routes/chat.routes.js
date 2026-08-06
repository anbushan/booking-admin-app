import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// A conversation is scoped to a booking — driver and passenger only,
// which keeps the chat list simple (no generic DM system needed for MVP).
router.get("/:bookingId/messages", requireAuth, async (req, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { bookingId: req.params.bookingId },
    orderBy: { createdAt: "asc" },
  });
  res.json(messages);
});

router.post("/:bookingId/messages", requireAuth, async (req, res) => {
  const { text } = req.body;
  const message = await prisma.chatMessage.create({
    data: { bookingId: req.params.bookingId, senderId: req.user.id, text },
  });
  // Realtime delivery happens via Socket.IO (see lib/socket.js) — this
  // REST endpoint is the durable write path / fallback for clients not
  // currently connected to the socket.
  res.status(201).json(message);
});

export default router;
