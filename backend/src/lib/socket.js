import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";
import { notify } from "./notify.js";

// Wire this up in index.js:
//   import http from "http";
//   import { attachSocketServer } from "./lib/socket.js";
//   const server = http.createServer(app);
//   attachSocketServer(server);
//   server.listen(PORT, ...);   // instead of app.listen(...)
export function attachSocketServer(httpServer) {
  const io = new Server(httpServer, { cors: { origin: "*" } });

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
    socket.on("join", (bookingId) => {
      socket.join(`booking:${bookingId}`);
    });

    // type: "TEXT" (default) | "LOCATION" — for a LOCATION message, text
    // is "lat,lng" rather than a chat string (see lib/chat.js).
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
      io.to(`booking:${bookingId}`).emit("message:receive", message);

      try {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { ride: { select: { driverId: true } } },
        });
        if (booking) {
          const recipientId = socket.userId === booking.passengerId ? booking.ride.driverId : booking.passengerId;
          const sender = await prisma.user.findUnique({ where: { id: socket.userId }, select: { name: true } });
          const preview = type === "LOCATION" ? "Shared their location" : text.length > 80 ? `${text.slice(0, 80)}…` : text;
          await notify(recipientId, "NEW_MESSAGE", `New message from ${sender?.name || "them"}`, preview, bookingId);
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
