import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { refundIfPaid } from "../lib/refunds.js";
import { notify } from "../lib/notify.js";
import { validate, isLat, isLng, isNonEmptyString, isFutureDate, isPositiveInt, isPositiveNumber } from "../lib/validate.js";

const router = Router();

// Rough point-to-line-segment distance in km (haversine-based).
// Good enough for a "within N km of the route" check without a full
// polyline decode — swap for a proper polyline distance check once
// you're storing Google's encoded route polyline per ride.
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fare cap — the regulatory line between genuine cost-sharing carpooling
// (exempt from taxi-aggregator licensing in most Indian states) and an
// unlicensed commercial passenger service. A driver setting price freely
// with no ceiling tied to actual trip cost looks like the latter. This
// caps pricePerSeat at a generous per-km rate covering fuel, tolls, and
// wear — not a tight commercial fare, just an upper bound that keeps the
// "cost-sharing, not profit" framing defensible.
const FARE_CAP_PER_KM_INR = Number(process.env.FARE_CAP_PER_KM_INR || 12);

function computeFareCap(sourceLat, sourceLng, destLat, destLng) {
  const distanceKm = haversineKm(sourceLat, sourceLng, destLat, destLng);
  return Math.round(distanceKm * FARE_CAP_PER_KM_INR);
}

// POST /api/rides — driver publishes a ride
router.post("/", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const {
    sourceLat, sourceLng, sourceAddress,
    destLat, destLng, destAddress,
    travelDate, seatsAvailable, pricePerSeat,
    maxDetourKm, preferences,
  } = req.body;

  const errors = validate(req.body, [
    { field: "sourceLat", check: isLat, message: "Source location is invalid." },
    { field: "sourceLng", check: isLng, message: "Source location is invalid." },
    { field: "sourceAddress", check: (v) => isNonEmptyString(v, 300), message: "Source address is required." },
    { field: "destLat", check: isLat, message: "Destination location is invalid." },
    { field: "destLng", check: isLng, message: "Destination location is invalid." },
    { field: "destAddress", check: (v) => isNonEmptyString(v, 300), message: "Destination address is required." },
    { field: "travelDate", check: isFutureDate, message: "Travel date must be in the future." },
    { field: "seatsAvailable", check: (v) => isPositiveInt(v) && v <= 8, message: "Seats must be between 1 and 8." },
    { field: "pricePerSeat", check: isPositiveNumber, message: "Price per seat must be greater than 0." },
    { field: "maxDetourKm", check: (v) => isPositiveNumber(v) && v <= 20, message: "Max detour must be between 0 and 20 km.", optional: true },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const fareCap = computeFareCap(sourceLat, sourceLng, destLat, destLng);
  if (Number(pricePerSeat) > fareCap) {
    return res.status(400).json({
      error: `Price per seat can't exceed Rs ${fareCap} for this distance — this keeps the ride classified as cost-sharing rather than a commercial fare.`,
      fareCap,
    });
  }

  const ride = await prisma.ride.create({
    data: {
      driverId: req.user.id,
      sourceLat, sourceLng, sourceAddress,
      destLat, destLng, destAddress,
      travelDate: new Date(travelDate),
      seatsAvailable,
      pricePerSeat,
      maxDetourKm: maxDetourKm ?? Number(process.env.DEFAULT_MAX_DETOUR_KM || 3),
      preferences: preferences || {},
    },
  });

  res.status(201).json(ride);
});

// GET /api/rides/search?source=&destination=&date=&seats=
// NOTE: this is a naive bounding-radius search for MVP. Swap in a proper
// geo-index (PostGIS or a Redis geo set) once ride volume grows.
router.get("/search", requireAuth, async (req, res) => {
  const { sourceLat, sourceLng, date, seats } = req.query;
  const radiusKm = 5;

  const candidates = await prisma.ride.findMany({
    where: {
      status: "PUBLISHED",
      seatsAvailable: { gte: Number(seats || 1) },
      travelDate: date
        ? {
            gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
            lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
          }
        : undefined,
    },
    include: { driver: { select: { id: true, name: true, ratingAvg: true, photoUrl: true } } },
    orderBy: { travelDate: "asc" },
  });

  const results = sourceLat && sourceLng
    ? candidates.filter(
        (r) => haversineKm(Number(sourceLat), Number(sourceLng), r.sourceLat, r.sourceLng) <= radiusKm
      )
    : candidates;

  res.json(results);
});

// GET /api/rides/:id/details
router.get("/:id/details", requireAuth, async (req, res) => {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    include: { driver: true },
  });
  if (!ride) return res.status(404).json({ error: "Ride not found." });
  res.json(ride);
});

// POST /api/rides/:id/validate-pickup — checks a passenger-proposed
// pickup point against the ride's allowed detour.
router.post("/:id/validate-pickup", requireAuth, async (req, res) => {
  const { lat, lng } = req.body;
  const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
  if (!ride) return res.status(404).json({ error: "Ride not found." });

  const detourKm = haversineKm(ride.sourceLat, ride.sourceLng, lat, lng);
  res.json({ valid: detourKm <= ride.maxDetourKm, detourKm: Number(detourKm.toFixed(2)) });
});

// GET /api/rides/:id/bookings — driver's incoming requests for one ride
router.get("/:id/bookings", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
  if (!ride || ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Ride not found." });
  }

  const bookings = await prisma.booking.findMany({
    where: { rideId: req.params.id, status: "BOOKED" },
    include: { passenger: { select: { name: true, ratingAvg: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json(bookings);
});

router.get("/my", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const rides = await prisma.ride.findMany({
    where: { driverId: req.user.id },
    orderBy: { travelDate: "desc" },
  });
  res.json(rides);
});

// PUT /api/rides/:id — driver edits a ride they haven't started yet
router.put("/:id", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
  if (!ride || ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Ride not found." });
  }
  if (ride.status !== "PUBLISHED") {
    return res.status(400).json({ error: "Only a published ride can be edited." });
  }

  const { pricePerSeat, seatsAvailable, travelDate, preferences, maxDetourKm } = req.body;

  const errors = validate(req.body, [
    { field: "pricePerSeat", check: isPositiveNumber, message: "Price per seat must be greater than 0.", optional: true },
    { field: "seatsAvailable", check: (v) => isPositiveInt(v) && v <= 8, message: "Seats must be between 1 and 8.", optional: true },
    { field: "travelDate", check: isFutureDate, message: "Travel date must be in the future.", optional: true },
    { field: "maxDetourKm", check: (v) => isPositiveNumber(v) && v <= 20, message: "Max detour must be between 0 and 20 km.", optional: true },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  if (pricePerSeat !== undefined) {
    const fareCap = computeFareCap(ride.sourceLat, ride.sourceLng, ride.destLat, ride.destLng);
    if (Number(pricePerSeat) > fareCap) {
      return res.status(400).json({
        error: `Price per seat can't exceed Rs ${fareCap} for this distance.`,
        fareCap,
      });
    }
  }

  const updated = await prisma.ride.update({
    where: { id: req.params.id },
    data: {
      ...(pricePerSeat !== undefined && { pricePerSeat }),
      ...(seatsAvailable !== undefined && { seatsAvailable }),
      ...(travelDate !== undefined && { travelDate: new Date(travelDate) }),
      ...(preferences !== undefined && { preferences }),
      ...(maxDetourKm !== undefined && { maxDetourKm }),
    },
  });
  res.json(updated);
});

// DELETE /api/rides/:id — driver cancels; any CONFIRMED bookings need
// their own cancellation/refund handling, flagged here rather than
// silently orphaned.
router.delete("/:id", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    include: { bookings: { where: { status: { in: ["BOOKED", "CONFIRMED"] } } } },
  });
  if (!ride || ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Ride not found." });
  }

  const affectedBookingIds = ride.bookings.map((b) => b.id);

  await prisma.$transaction([
    prisma.ride.update({ where: { id: req.params.id }, data: { status: "CANCELLED" } }),
    prisma.booking.updateMany({
      where: { rideId: req.params.id, status: { in: ["BOOKED", "CONFIRMED"] } },
      data: { status: "CANCELLED" },
    }),
  ]);

  // refundIfPaid is a safe no-op for bookings that were never charged —
  // covers the edge case where a booking reached CHARGE_ATTEMPTED before
  // the driver cancelled.
  for (const bookingId of affectedBookingIds) {
    await refundIfPaid(bookingId).catch((err) =>
      console.error(`Refund check failed for booking ${bookingId}:`, err.message)
    );
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (booking) {
      await notify(booking.passengerId, "RIDE_CANCELLED", "Ride cancelled",
        "The driver cancelled this ride. Please search for another one.");
    }
  }

  res.json({ success: true, affectedBookings: affectedBookingIds.length });
});

// GET /api/rides/earnings — driver's earnings summary + recent paid trips
router.get("/earnings", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const paidBookings = await prisma.booking.findMany({
    where: {
      status: "PAID",
      tripCompletedAt: { gte: startOfMonth },
      ride: { driverId: req.user.id },
    },
    include: { ride: true },
    orderBy: { tripCompletedAt: "desc" },
  });

  const pendingBookings = await prisma.booking.findMany({
    where: { status: { in: ["CHARGE_ATTEMPTED", "PAYMENT_PENDING"] }, ride: { driverId: req.user.id } },
    include: { ride: true },
  });

  const totalThisMonth = paidBookings.reduce(
    (sum, b) => sum + Number(b.ride.pricePerSeat) * b.seatsBooked,
    0
  );
  const avgPerTrip = paidBookings.length ? totalThisMonth / paidBookings.length : 0;

  res.json({
    totalThisMonth,
    tripsCompleted: paidBookings.length,
    avgPerTrip: Math.round(avgPerTrip),
    recentTrips: [...paidBookings, ...pendingBookings]
      .sort((a, b) => (b.tripCompletedAt || 0) > (a.tripCompletedAt || 0) ? 1 : -1)
      .slice(0, 10)
      .map((b) => ({
        id: b.id,
        route: `${b.ride.sourceAddress} to ${b.ride.destAddress}`,
        amount: Number(b.ride.pricePerSeat) * b.seatsBooked,
        status: b.status,
      })),
  });
});

export default router;
