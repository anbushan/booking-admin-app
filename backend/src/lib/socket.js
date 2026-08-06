import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";

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

    socket.on("message:send", async ({ bookingId, text }) => {
      const message = await prisma.chatMessage.create({
        data: { bookingId, senderId: socket.userId, text },
      });
      io.to(`booking:${bookingId}`).emit("message:receive", message);
    });

    socket.on("typing", ({ bookingId }) => {
      socket.to(`booking:${bookingId}`).emit("typing", { userId: socket.userId });
    });
  });

  return io;
}
