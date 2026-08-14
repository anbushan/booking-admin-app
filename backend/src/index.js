import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";

// Express 4 doesn't catch promise rejections thrown inside an async route
// handler — by default Node treats an unhandled rejection as fatal and
// kills the whole process, taking down every in-flight request for every
// user, not just whichever route actually failed. This is a safety net
// for any route that doesn't (or forgets to) wrap its own async body in
// try/catch: log it and keep the server alive rather than crash. It does
// NOT replace fixing individual routes — the failing request itself still
// hangs without a response until it times out client-side — but it stops
// one bad request from taking the whole API down.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (server staying up):", reason);
});

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import vehiclesRoutes from "./routes/vehicles.routes.js";
import ridesRoutes from "./routes/rides.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import tripsRoutes from "./routes/trips.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import emergencyContactsRoutes from "./routes/emergencyContacts.routes.js";
import documentsRoutes from "./routes/documents.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import placesRoutes from "./routes/places.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import reviewsRoutes from "./routes/reviews.routes.js";
import callsRoutes from "./routes/calls.routes.js";
import i18nRoutes from "./routes/i18n.routes.js";
import statusRoutes from "./routes/status.routes.js";
import verificationRoutes from "./routes/verification.routes.js";
import { expireStaleBookings } from "./cron/expireBookings.js";
import { checkNoShows } from "./cron/checkNoShows.js";
import { expireStaleRides } from "./cron/expireStaleRides.js";
import { attachSocketServer } from "./lib/socket.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/rides", ridesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/trips", tripsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/emergency-contacts", emergencyContactsRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/geocode", placesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/calls", callsRoutes);
app.use("/api/i18n", i18nRoutes);
app.use("/api/app-status", statusRoutes);
app.use("/api/verification", verificationRoutes);

const PORT = process.env.PORT || 4000;

// Wrapping the Express app in a plain http.Server so Socket.IO can attach
// to the same port — chat needs a persistent connection, REST doesn't.
const server = http.createServer(app);
attachSocketServer(server);

server.listen(PORT, () => {
  console.log(`Carpool API + Socket.IO listening on port ${PORT} (${process.env.NODE_ENV})`);
});

// Fallback sweep for booking auto-expiry (driver-response window and
// platform-fee payment window) — every 2 minutes.
setInterval(expireStaleBookings, 2 * 60 * 1000);

// No-show auto-cancel needs tighter tolerance than the expiry sweep
// since it's keyed off a real-world departure time, not a fixed TTL.
setInterval(checkNoShows, 60 * 1000);

// Runs right after checkNoShows on the same cadence — by the time this
// fires, any ride whose no-show story needed handling already has been,
// so anything still PUBLISHED past its departure time genuinely never
// got used.
setInterval(expireStaleRides, 60 * 1000);
