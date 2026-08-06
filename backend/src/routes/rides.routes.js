import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { refundIfPaid } from "../lib/refunds.js";
import { notify } from "../lib/notify.js";
import { getAppConfig } from "../lib/appConfig.js";
import { isDriverStrikeBlocked, issueDriverStrike } from "../lib/strikes.js";
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
function computeFareCap(sourceLat, sourceLng, destLat, destLng, fareCapPerKmInr) {
  const distanceKm = haversineKm(sourceLat, sourceLng, destLat, destLng);
  return Math.round(distanceKm * fareCapPerKmInr);
}

// POST /api/rides — driver publishes a ride
router.post("/", requireAuth, requireRole("DRIVER"), async (req, res) => {
  if (isDriverStrikeBlocked(req.user)) {
    return res.status(403).json({ error: "Your account is temporarily blocked from publishing new rides." });
  }

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

  const config = await getAppConfig();
  const fareCap = computeFareCap(sourceLat, sourceLng, destLat, destLng, config.fareCapPerKmInr);
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
      maxDetourKm: maxDetourKm ?? config.defaultMaxDetourKm,
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
    const config = await getAppConfig();
    const fareCap = computeFareCap(ride.sourceLat, ride.sourceLng, ride.destLat, ride.destLng, config.fareCapPerKmInr);
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

// DELETE /api/rides/:id — driver cancels; any BOOKED/AWAITING_PAYMENT/
// CONFIRMED bookings need their own cancellation/refund/strike handling
// (same cancellation-matrix rules as a single-booking driver-cancel —
// see bookings.routes.js /:id/driver-cancel), flagged here rather than
// silently orphaned.
router.delete("/:id", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    include: { bookings: { where: { status: { in: ["BOOKED", "AWAITING_PAYMENT", "CONFIRMED"] } } } },
  });
  if (!ride || ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Ride not found." });
  }

  const config = await getAppConfig();
  const now = new Date();

  await prisma.ride.update({ where: { id: req.params.id }, data: { status: "CANCELLED" } });

  let strikeWorthy = false;
  for (const booking of ride.bookings) {
    let cancelReason = "DRIVER_WITHDRAWN";
    if (booking.status === "CONFIRMED" && booking.platformFeePaidAt) {
      const elapsedMinutes = (now - new Date(booking.platformFeePaidAt)) / 60000;
      const withinGrace = elapsedMinutes <= config.graceCancelWindowMinutes;
      cancelReason = withinGrace ? "DRIVER_REQUEST_GRACE" : "DRIVER_REQUEST_LATE";
      if (!withinGrace) strikeWorthy = true;
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledBy: "DRIVER", cancelReason, cancelledAt: now },
    });
    // refundIfPaid is a safe no-op for bookings that never had a platform
    // fee captured (still BOOKED/AWAITING_PAYMENT).
    await refundIfPaid(booking.id).catch((err) =>
      console.error(`Refund check failed for booking ${booking.id}:`, err.message)
    );
    await notify(booking.passengerId, "RIDE_CANCELLED", "Ride cancelled",
      "The driver cancelled this ride. Please search for another one.");
  }

  // One strike for the whole ride cancellation, not one per affected
  // passenger — consistent with how a no-show is scored.
  if (strikeWorthy) {
    await issueDriverStrike(req.user.id, { rideId: req.params.id, reason: "DRIVER_LATE_CANCEL" });
  }

  res.json({ success: true, affectedBookings: ride.bookings.length });
});

// GET /api/rides/earnings — driver's earnings summary + recent completed
// trips. "Earnings" here is the remaining fare (the cash/UPI amount
// settled directly with the passenger) — the platform fee never reaches
// the driver, so it's excluded from this total.
router.get("/earnings", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const completedBookings = await prisma.booking.findMany({
    where: {
      status: "COMPLETED",
      tripCompletedAt: { gte: startOfMonth },
      ride: { driverId: req.user.id },
    },
    include: { ride: true },
    orderBy: { tripCompletedAt: "desc" },
  });

  const totalThisMonth = completedBookings.reduce(
    (sum, b) => sum + Number(b.remainingFareAmount || 0),
    0
  );
  const avgPerTrip = completedBookings.length ? totalThisMonth / completedBookings.length : 0;

  res.json({
    totalThisMonth,
    tripsCompleted: completedBookings.length,
    avgPerTrip: Math.round(avgPerTrip),
    recentTrips: completedBookings
      .slice(0, 10)
      .map((b) => ({
        id: b.id,
        route: `${b.ride.sourceAddress} to ${b.ride.destAddress}`,
        amount: Number(b.remainingFareAmount || 0),
        status: b.status,
        cashCollected: !!b.remainingFareCollectedAt,
      })),
  });
});

export default router;
