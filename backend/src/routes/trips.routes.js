import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import { sendSmsViaMsg91 } from "../lib/msg91.js";
import { clearChatForBooking } from "../lib/chat.js";
import { closeRideIfNoActiveBookings } from "../lib/rideLifecycle.js";
import { validate, isLat, isLng } from "../lib/validate.js";

const router = Router();

function generateTripOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

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

  res.json({ bookingId: updated.id }); // OTP itself goes to the passenger's own screen, not this response
});

// POST /api/trips/:bookingId/verify-otp — driver enters EITHER what the
// passenger read aloud (the 4-digit OTP) OR the passenger's Booking ID —
// either one is enough to start the trip. Accepts `otp` (legacy field
// name, kept for backward compat) or `code` (either kind of value).
router.post("/:bookingId/verify-otp", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const code = String(req.body.code ?? req.body.otp ?? "").trim();
  if (!code) {
    return res.status(400).json({ error: "Enter the passenger's OTP or Booking ID." });
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

  const matchesOtp = booking.tripOtp && code === booking.tripOtp;
  const matchesBookingId = code.toLowerCase() === booking.id.toLowerCase();
  if (!matchesOtp && !matchesBookingId) {
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
router.put("/:bookingId/location", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const { lat, lng } = req.body;
  if (!isLat(lat) || !isLng(lng)) {
    return res.status(400).json({ error: "Invalid coordinates." });
  }
  const updated = await prisma.booking.update({
    where: { id: req.params.bookingId },
    data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
  });
  res.json({ success: true, lastLocationAt: updated.lastLocationAt });
});

// GET /api/trips/:bookingId/track — passenger polls this; client computes
// "reconnecting" state itself if lastLocationAt is more than ~90s old.
router.get("/:bookingId/track", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: { include: { driver: { select: { id: true, name: true } } } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

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

  const fullFare = Number(booking.ride.pricePerSeat) * booking.seatsBooked;
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
router.post("/:bookingId/sos", requireAuth, async (req, res) => {
  const { lat, lng } = req.body;
  if (!isLat(lat) || !isLng(lng)) {
    return res.status(400).json({ error: "Invalid coordinates." });
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
