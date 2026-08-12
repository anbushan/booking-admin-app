import { Router } from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import { r2, R2_BUCKET } from "../lib/r2.js";
import { photoViewUrl } from "../lib/photo.js";

const router = Router();
const UPLOAD_URL_TTL_SECONDS = 600; // 10 min — matches users.routes.js/vehicles.routes.js

// A chat IMAGE message reuses the existing `text` column to hold the R2
// key, same convention LOCATION already established (text = "lat,lng"
// instead of a new lat/lng column pair) — no schema change needed. This
// resolves that key into an actual short-lived viewable URL for the
// client to render, the same way photoViewUrl already does everywhere
// else a stored R2 key needs to become an <Image> src.
async function attachImageUrls(messages) {
  return Promise.all(
    messages.map(async (m) => (m.type === "IMAGE" ? { ...m, imageUrl: await photoViewUrl(m.text) } : m))
  );
}

// A conversation is scoped to a booking — driver and passenger only,
// which keeps the chat list simple (no generic DM system needed for MVP).
// Shared by every route below: resolves which of the two participants
// (if either) the caller is, so GET/POST/read-marking all enforce the
// same "you have to actually be on this booking" check with one
// implementation instead of three slightly-different ones.
async function resolveParticipant(bookingId, userId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { ride: { select: { driverId: true } } },
  });
  if (!booking) return null;
  if (booking.passengerId === userId) return { booking, role: "PASSENGER" };
  if (booking.ride.driverId === userId) return { booking, role: "DRIVER" };
  return null;
}

router.get("/:bookingId/messages", requireAuth, async (req, res) => {
  const participant = await resolveParticipant(req.params.bookingId, req.user.id);
  if (!participant) return res.status(404).json({ error: "Booking not found." });

  const messages = await prisma.chatMessage.findMany({
    where: { bookingId: req.params.bookingId },
    orderBy: { createdAt: "asc" },
  });
  res.json(await attachImageUrls(messages));
});

// POST /api/chat/:bookingId/image-upload-url — same presigned-PUT
// pattern as users.routes.js's profile-photo upload: the client PUTs
// bytes straight to R2 using the signed URL this returns, then sends the
// r2Key (not the bytes) as the message's `text` over the socket. Same
// participant + CONFIRMED-window gate as actually sending a message —
// no point letting someone stage an upload for a conversation they
// couldn't send into anyway.
router.post("/:bookingId/image-upload-url", requireAuth, async (req, res) => {
  const participant = await resolveParticipant(req.params.bookingId, req.user.id);
  if (!participant) return res.status(404).json({ error: "Booking not found." });
  if (participant.booking.status !== "CONFIRMED") {
    return res.status(400).json({ error: "This conversation isn't open right now." });
  }

  const r2Key = `chat/${req.params.bookingId}/${Date.now()}-${req.user.id}`;
  const command = new PutObjectCommand({ Bucket: R2_BUCKET, Key: r2Key });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  res.json({ r2Key, uploadUrl });
});

router.post("/:bookingId/messages", requireAuth, async (req, res) => {
  const participant = await resolveParticipant(req.params.bookingId, req.user.id);
  if (!participant) return res.status(404).json({ error: "Booking not found." });

  // Chat is only open for the pre-trip coordination window — from the
  // platform fee being paid (CONFIRMED) to the trip actually starting.
  // The mobile client already hides the composer outside that window,
  // but that's UI-only; without this check the endpoint itself would
  // accept a message for any booking in any state (including a
  // long-completed one), which is what actually enforces "read only".
  if (participant.booking.status !== "CONFIRMED") {
    return res.status(400).json({ error: "This conversation isn't open right now." });
  }

  const { text, type } = req.body;
  const message = await prisma.chatMessage.create({
    data: { bookingId: req.params.bookingId, senderId: req.user.id, text, type: type || "TEXT" },
  });

  // Realtime delivery happens via Socket.IO (see lib/socket.js) for
  // whoever's actively connected — but that's it. Nothing here ever
  // told the other side a message had arrived if their app wasn't open
  // and connected right then, so a driver/passenger who'd backgrounded
  // the app simply never found out. notify() covers both: an in-app
  // Notification row (shows in the list, drives the badge, works even
  // with push permission denied) and a push if they have a token on file.
  const recipientId = participant.role === "PASSENGER" ? participant.booking.ride.driverId : participant.booking.passengerId;
  const sender = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
  const preview = message.type === "LOCATION" ? "Shared their location" : message.type === "IMAGE" ? "📷 Sent a photo" : text.length > 80 ? `${text.slice(0, 80)}…` : text;
  await notify(recipientId, "NEW_MESSAGE", `New message from ${sender?.name || "them"}`, preview, req.params.bookingId);

  // Realtime delivery happens via Socket.IO (see lib/socket.js) — this
  // REST endpoint is the durable write path / fallback for clients not
  // currently connected to the socket.
  res.status(201).json(message.type === "IMAGE" ? { ...message, imageUrl: await photoViewUrl(message.text) } : message);
});

// PUT /api/chats/:bookingId/read — called when a side opens this
// booking's conversation. Just stamps "I've seen everything up to now"
// on whichever of the two read-state columns is theirs — the unread
// count shown elsewhere (GET /api/bookings/my, /driver-active) is
// derived by comparing this against message timestamps, not stored as
// a running counter.
router.put("/:bookingId/read", requireAuth, async (req, res) => {
  const participant = await resolveParticipant(req.params.bookingId, req.user.id);
  if (!participant) return res.status(404).json({ error: "Booking not found." });

  const field = participant.role === "PASSENGER" ? "passengerLastReadAt" : "driverLastReadAt";
  await prisma.booking.update({ where: { id: req.params.bookingId }, data: { [field]: new Date() } });
  res.json({ success: true });
});

export default router;
