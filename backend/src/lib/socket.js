import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";
import { notify } from "./notify.js";
import { photoViewUrl } from "./photo.js";

// Wire this up in index.js:
//   import http from "http";
//   import { attachSocketServer } from "./lib/socket.js";
//   const server = http.createServer(app);
//   attachSocketServer(server);
//   server.listen(PORT, ...);   // instead of app.listen(...)
// Set once attachSocketServer runs (server startup) — exported so REST
// routes (trips.routes.js starting a trip, anything else that needs to
// push a live event) can reach the same socket server without every
// route needing its own reference threaded through from index.js.
let ioInstance = null;

export function getIO() {
  return ioInstance;
}

export function attachSocketServer(httpServer) {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  ioInstance = io;

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Every connected socket sits in its own personal room the whole
    // time it's connected, not just while a specific chat screen has
    // called "join" — badge counts and app-wide events (a new message
    // from ANY booking, a trip starting) need to reach whoever's
    // signed in regardless of which screen they're actually looking
    // at, not just someone with that one booking's room open.
    socket.join(`user:${socket.userId}`);

    socket.on("join", (bookingId) => {
      socket.join(`booking:${bookingId}`);
    });

    // type: "TEXT" (default) | "LOCATION" | "IMAGE" — for a LOCATION
    // message, text is "lat,lng"; for IMAGE, text is the R2 key the
    // client already uploaded to via POST /api/chat/:bookingId/
    // image-upload-url (see chat.routes.js) — same "reuse the text
    // column" convention both follow instead of new columns.
    //
    // This is the path the app actually sends through (ChatDetailScreen
    // emits "message:send", it never calls the REST POST) — so this is
    // the one place that has to notify the other side, not just the
    // REST route's own copy of this logic. `io.to(...).emit(...)` only
    // reaches someone with this exact booking's room currently joined
    // (i.e. the chat screen open right now); anyone who's backgrounded
    // the app or is anywhere else in it never heard a thing about a new
    // message until they happened to open this conversation again.
    socket.on("message:send", async ({ bookingId, text, type }) => {
      const message = await prisma.chatMessage.create({
        data: { bookingId, senderId: socket.userId, text, type: type || "TEXT" },
      });
      // Resolved before emitting (not left for the client to fetch
      // separately) so an IMAGE message renders immediately on both
      // sides the instant it arrives, same as TEXT/LOCATION already do.
      const outgoing = type === "IMAGE" ? { ...message, imageUrl: await photoViewUrl(text) } : message;
      io.to(`booking:${bookingId}`).emit("message:receive", outgoing);

      try {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { ride: { select: { driverId: true } } },
        });
        if (booking) {
          const recipientId = socket.userId === booking.passengerId ? booking.ride.driverId : booking.passengerId;
          const sender = await prisma.user.findUnique({ where: { id: socket.userId }, select: { name: true } });
          const preview = type === "LOCATION" ? "Shared their location" : type === "IMAGE" ? "📷 Sent a photo" : text.length > 80 ? `${text.slice(0, 80)}…` : text;
          await notify(recipientId, "NEW_MESSAGE", `New message from ${sender?.name || "them"}`, preview, bookingId);
          // Separate from "message:receive" above (booking-room only,
          // reaches someone with this exact chat screen open) — this
          // reaches the recipient wherever they are in the app right
          // now, so an unread badge can update without them having
          // opened this conversation.
          io.to(`user:${recipientId}`).emit("chat:new", { bookingId });
        }
      } catch (err) {
        // Best-effort — a failed notification shouldn't stop the message
        // itself from having already sent and delivered over the socket.
        console.error("Chat message notify failed:", err.message);
      }
    });

    socket.on("typing", ({ bookingId }) => {
      socket.to(`booking:${bookingId}`).emit("typing", { userId: socket.userId });
    });
  });

  return io;
}
