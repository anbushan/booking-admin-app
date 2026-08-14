import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import { sendSmsViaMsg91 } from "../lib/msg91.js";
import { clearChatForBooking } from "../lib/chat.js";
import { closeRideIfNoActiveBookings } from "../lib/rideLifecycle.js";
import { validate, isLat, isLng } from "../lib/validate.js";
import { getIO } from "../lib/socket.js";
import { proratedFarePerSeat } from "../lib/segments.js";
import { photoViewUrl } from "../lib/photo.js";
import { verifiedPassengerIdsBatch } from "../lib/verification.js";

const router = Router();

function generateTripOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// A single next-step label per booking, so the mobile manifest screen
// never has to re-derive "what does this driver still need to do here"
// from raw status/timestamp fields itself — one source of truth for
// that logic, shared with whatever other client ever reads this.
//   AWAITING_START  — not yet told this passenger's pickup has begun
//   AWAITING_OTP    — pickup started, waiting on the passenger's code
//   IN_PROGRESS     — picked up, riding; next action is drop-off
//   COMPLETED       — already dropped off
function manifestAction(booking) {
  if (booking.status === "COMPLETED") return "COMPLETED";
  if (booking.status === "IN_PROGRESS") return "IN_PROGRESS";
  if (booking.tripOtp) return "AWAITING_OTP";
  return "AWAITING_START";
}

// GET /api/trips/ride/:rideId/manifest — every passenger currently
// relevant to this specific drive (confirmed-but-not-started, mid-trip,
// or already dropped off), ordered by where they board along the route
// — the driver's single view of "who's next" once a ride can carry more
// than one concurrent passenger (see lib/segments.js). A ride that's
// only ever had one passenger at a time degrades to exactly the old
// single-booking flow: one entry, one obvious next action.
router.get("/ride/:rideId/manifest", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const ride = await prisma.ride.findUnique({ where: { id: req.params.rideId } });
  if (!ride || ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Ride not found." });
  }

  const bookings = await prisma.booking.findMany({
    where: { rideId: ride.id, status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
    include: { passenger: { select: { id: true, name: true, ratingAvg: true, photoR2Key: true } } },
    // Bookings with no resolved pickup point (legacy/no-route rides) sort
    // first — nulls last would push a single-passenger legacy ride's one
    // and only stop to the bottom for no reason.
    orderBy: [{ pickupProgressKm: "asc" }, { createdAt: "asc" }],
  });

  const verifiedPassengerIds = await verifiedPassengerIdsBatch(bookings.map((b) => b.passenger.id));

  const stops = await Promise.all(
    bookings.map(async (b) => ({
      id: b.id,
      action: manifestAction(b),
      seatsBooked: b.seatsBooked,
      pickupAddress: b.pickupAddress,
      dropAddress: b.dropAddress || ride.destAddress,
      pickupProgressKm: b.pickupProgressKm,
      dropProgressKm: b.dropProgressKm,
      passenger: {
        id: b.passenger.id,
        name: b.passenger.name,
        ratingAvg: b.passenger.ratingAvg,
        photoViewUrl: await photoViewUrl(b.passenger.photoR2Key),
        passengerVerified: verifiedPassengerIds.has(b.passenger.id),
      },
    }))
  );

  res.json({ rideId: ride.id, totalSeats: ride.totalSeats, stops });
});

// POST /api/trips/:bookingId/start — driver initiates, generates an OTP
// the passenger reads aloud (not sent by SMS — see plan section on Rapido
// architecture notes; showing it in-app avoids depending on SMS delivery
// at a possibly low-signal pickup point).
router.post("/:bookingId/start", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.status !== "CONFIRMED") {
    return res.status(400).json({ error: "Booking must be confirmed before starting the trip." });
  }

  const tripOtp = generateTripOtp();
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { tripOtp },
  });

  await notify(booking.passengerId, "DRIVER_ARRIVED", "Your driver has arrived",
    "Share the pickup code shown in the app to start your trip.", booking.id);

  // Live push into the passenger's app, wherever they currently are in
  // it — push notifications alone would need them to tap it (and
  // depend on FCM being configured/permission granted); this fires
  // regardless, as long as their app is open and connected.
  getIO()?.to(`user:${booking.passengerId}`).emit("trip:started", { bookingId: booking.id });

  res.json({ bookingId: updated.id }); // OTP itself goes to the passenger's own screen, not this response
});

// POST /api/trips/:bookingId/verify-otp — driver enters the 4-digit code
// the passenger read aloud. Accepts `otp` (legacy field name, kept for
// backward compat) or `code`.
//
// SECURITY: this used to also accept the booking's own ID as a stand-in
// for the OTP ("matchesBookingId"). That was a real bypass, not a
// theoretical one — `req.params.bookingId` IS `booking.id` by
// construction (it's how the row above got fetched), so the calling
// driver already has the one value that would satisfy that check before
// they even send the request. Any driver could start any of their own
// confirmed trips instantly, with zero passenger interaction, by just
// echoing the URL's own bookingId back as "code" — which defeated the
// entire point of the OTP (proving the passenger is physically present
// at pickup). The mobile app never exposed this path either (StartTrip-
// Screen only ever collects the 4-digit OTP), so removing it changes no
// legitimate behavior.
router.post("/:bookingId/verify-otp", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const code = String(req.body.code ?? req.body.otp ?? "").trim();
  if (!code) {
    return res.status(400).json({ error: "Enter the passenger's OTP." });
  }
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.status !== "CONFIRMED") {
    return res.status(400).json({ error: "Booking must be confirmed before starting the trip." });
  }

  if (!booking.tripOtp || code !== booking.tripOtp) {
    return res.status(400).json({ error: "Incorrect code." });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "IN_PROGRESS", otpVerifiedAt: new Date(), tripStartedAt: new Date() },
  });

  // Chat's job was pre-trip coordination (finding each other at pickup)
  // — once the trip is actually under way they're together in the same
  // vehicle, so the conversation closes here too, not just at the end.
  await clearChatForBooking(booking.id);

  // The ride itself stops being PUBLISHED the moment any trip on it
  // starts — otherwise it stays searchable/bookable by new passengers,
  // and the driver's "Edit ride"/"Cancel ride" (gated on PUBLISHED)
  // stay available for a ride that's literally already underway.
  if (booking.ride.status === "PUBLISHED") {
    await prisma.ride.update({ where: { id: booking.rideId }, data: { status: "IN_PROGRESS" } });
  }

  res.json(updated);
});

// PUT /api/trips/:bookingId/location — periodic GPS ping from the driver app
//
// SECURITY: previously updated whichever bookingId was in the URL with no
// check that the caller was actually that ride's driver — any
// authenticated driver could overwrite any booking's GPS trail (their
// own or a stranger's). Scoped the same way every other driver-only
// mutation in this file already is.
router.put("/:bookingId/location", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const { lat, lng } = req.body;
  if (!isLat(lat) || !isLng(lng)) {
    return res.status(400).json({ error: "Invalid coordinates." });
  }
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: { select: { driverId: true } } },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  // One GPS ping is the driver's real position for the whole car, not
  // just whichever single booking the mobile app happened to open this
  // screen with — under segment-aware booking there can be several
  // passengers concurrently IN_PROGRESS on the same ride (one picked up
  // at A, another mid-route at A1, etc.), and every one of them is
  // relying on their own LiveTrackingScreen poll to move. Previously
  // only the one bookingId in the URL ever got updated, so a second
  // concurrent passenger's map silently went stale the whole trip.
  const now = new Date();
  await prisma.booking.updateMany({
    where: { rideId: booking.rideId, status: "IN_PROGRESS" },
    data: { lastLat: lat, lastLng: lng, lastLocationAt: now },
  });
  res.json({ success: true, lastLocationAt: now });
});

// GET /api/trips/:bookingId/track — passenger polls this; client computes
// "reconnecting" state itself if lastLocationAt is more than ~90s old.
//
// SECURITY: previously returned live GPS coordinates, driver identity,
// and the amount owed for any bookingId the caller could supply, with no
// check they were actually the passenger or driver on it. Scoped to
// participants only, same pattern chat.routes.js's resolveParticipant
// already uses.
router.get("/:bookingId/track", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: { include: { driver: { select: { id: true, name: true } } } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  const isPassenger = booking.passengerId === req.user.id;
  const isDriver = booking.ride.driverId === req.user.id;
  if (!isPassenger && !isDriver) {
    return res.status(403).json({ error: "Not permitted." });
  }

  res.json({
    lat: booking.lastLat,
    lng: booking.lastLng,
    lastLocationAt: booking.lastLocationAt,
    status: booking.status,
    // Under the upfront-fee model the passenger is already paid up by
    // the time they're on this screen (tracking only happens once
    // IN_PROGRESS). What they still owe is the cash/UPI amount due to
    // the driver, set once the trip is marked COMPLETED — included here
    // so the client can navigate straight to a "pay the driver" summary
    // without a second round trip.
    amount: booking.remainingFareAmount != null ? Number(booking.remainingFareAmount) : null,
    // Included so the passenger's client can go straight from "trip
    // completed" into rating the driver, without a second round trip at
    // exactly the moment the trip just ended.
    driverId: booking.ride.driver.id,
    driverName: booking.ride.driver.name,
  });
});

// POST /api/trips/:bookingId/stop — either party can close out a ride
// that's been abandoned/stopped mid-way, for any reason. This is
// distinct from a pre-trip cancel: the trip already started, so there's
// no refund/strike logic here (the platform fee already covered the
// matching service that was rendered) — it just closes the ride for
// both sides so the passenger can search and rebook fresh.
router.post("/:bookingId/stop", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

  const isPassenger = booking.passengerId === req.user.id;
  const isDriver = booking.ride.driverId === req.user.id;
  if (!isPassenger && !isDriver) {
    return res.status(403).json({ error: "Not permitted." });
  }
  if (booking.status !== "IN_PROGRESS") {
    return res.status(400).json({ error: "Only an in-progress trip can be stopped." });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "STOPPED", tripStoppedAt: new Date() },
  });
  await clearChatForBooking(booking.id);
  // Abnormal end — if nothing else is still active on this ride, close
  // it as CANCELLED (not COMPLETED; the trip didn't finish normally).
  await closeRideIfNoActiveBookings(booking.rideId, "CANCELLED");

  const otherPartyId = isPassenger ? booking.ride.driverId : booking.passengerId;
  await notify(otherPartyId, "RIDE_STOPPED", "Ride closed",
    "This ride was stopped before reaching the destination. It's been closed — you can search and rebook.", booking.id);

  res.json(updated);
});

// POST /api/trips/:bookingId/complete — driver marks the trip done. No
// in-app charge happens here anymore: the platform fee was already
// captured up front, and the remaining fare is settled directly between
// passenger and driver (cash/UPI) — this just records what's owed for
// display on both sides.
router.post("/:bookingId/complete", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.status !== "IN_PROGRESS") {
    return res.status(400).json({ error: "Only an in-progress trip can be completed." });
  }

  // Same prorated-by-segment fare the platform fee was already computed
  // from at accept time (bookings.routes.js PUT /:id/accept) — using the
  // ride's full pricePerSeat here would double-count the segment discount
  // this passenger already got: they'd owe the platform fee on their
  // actual (shorter) segment but the remaining cash/UPI amount on the
  // ride's full length.
  const fullFare = proratedFarePerSeat(booking.ride, booking.pickupProgressKm, booking.dropProgressKm) * booking.seatsBooked;
  const remainingFareAmount = fullFare - Number(booking.platformFeeAmount || 0);

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "COMPLETED", tripCompletedAt: new Date(), remainingFareAmount },
  });
  await clearChatForBooking(booking.id);
  await closeRideIfNoActiveBookings(booking.rideId, "COMPLETED");

  await notify(booking.passengerId, "TRIP_COMPLETED", "Trip completed",
    `Please pay Rs ${remainingFareAmount.toFixed(0)} directly to your driver (cash/UPI).`, booking.id);

  res.json(updated);
});

// PUT /api/trips/:bookingId/collect-cash — driver's own bookkeeping:
// confirms the remaining fare was collected directly from the passenger.
// Purely informational (no payment processing involved).
router.put("/:bookingId/collect-cash", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.status !== "COMPLETED") {
    return res.status(400).json({ error: "Trip must be completed first." });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { remainingFareCollectedAt: new Date() },
  });

  res.json(updated);
});

// POST /api/trips/:bookingId/sos
//
// SECURITY: previously created the SosAlert against whatever bookingId
// was in the URL with no check the caller was actually on that booking —
// the SMS itself still only ever went to the caller's own emergency
// contacts (scoped by req.user.id, unaffected by this), but the alert
// record ended up spoof-attached to a trip the caller had nothing to do
// with, polluting SOS records tied to a real passenger/driver who never
// triggered anything.
router.post("/:bookingId/sos", requireAuth, async (req, res) => {
  const { lat, lng } = req.body;
  if (!isLat(lat) || !isLng(lng)) {
    return res.status(400).json({ error: "Invalid coordinates." });
  }
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: { select: { driverId: true } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  const isPassenger = booking.passengerId === req.user.id;
  const isDriver = booking.ride.driverId === req.user.id;
  if (!isPassenger && !isDriver) {
    return res.status(403).json({ error: "Not permitted." });
  }

  const contacts = await prisma.emergencyContact.findMany({ where: { userId: req.user.id } });

  const alert = await prisma.sosAlert.create({
    data: {
      bookingId: req.params.bookingId,
      triggeredBy: req.user.id,
      lat, lng,
      contactedIds: contacts.map((c) => c.id),
    },
  });

  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  const results = await Promise.allSettled(
    contacts.map((contact) =>
      sendSmsViaMsg91(contact.phone, process.env.MSG91_SOS_TEMPLATE_ID, {
        VAR1: req.user.name || "Someone",
        VAR2: mapsLink,
      })
    )
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length) {
    console.error(`SOS alert ${alert.id}: ${failures.length} contact SMS send(s) failed.`);
  }

  res.json({ success: true, alertId: alert.id, contactsNotified: contacts.length - failures.length });
});

// GET /api/trips/:bookingId/otp — passenger's own screen reads the code
// generated when the driver tapped "Start trip". Scoped to the booking's
// own passenger so nobody else can read it.
router.get("/:bookingId/otp", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.bookingId } });
  if (!booking || booking.passengerId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  res.json({ otp: booking.tripOtp });
});

export default router;
