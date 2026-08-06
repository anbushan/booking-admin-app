import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { redis, acquireLock } from "../lib/redis.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import { refundIfPaid } from "../lib/refunds.js";
import { validate, isNonEmptyString, isLat, isLng, isPositiveInt } from "../lib/validate.js";

const router = Router();
const EXPIRY_MINUTES = Number(process.env.BOOKING_EXPIRY_MINUTES || 20);

// POST /api/bookings — passenger books a seat.
// Wrapped in a distributed lock keyed by rideId so two simultaneous
// bookings on the last seat can't both succeed (the race condition
// flagged earlier in the plan).
router.post("/", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  const { rideId, seatsBooked, pickupLat, pickupLng, pickupAddress, isCustomPickup } = req.body;

  const errors = validate(req.body, [
    { field: "rideId", check: isNonEmptyString, message: "Ride is required." },
    { field: "seatsBooked", check: (v) => isPositiveInt(v) && v <= 8, message: "Seats booked must be between 1 and 8." },
    { field: "pickupLat", check: isLat, message: "Pickup location is invalid." },
    { field: "pickupLng", check: isLng, message: "Pickup location is invalid." },
    { field: "pickupAddress", check: (v) => isNonEmptyString(v, 300), message: "Pickup address is required." },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const release = await acquireLock(`ride-seats:${rideId}`, 5000);
  if (!release) {
    return res.status(409).json({ error: "Ride is busy, please try again." });
  }

  try {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== "PUBLISHED") {
      return res.status(400).json({ error: "Ride is not available." });
    }
    if (ride.seatsAvailable < seatsBooked) {
      return res.status(400).json({ error: "Not enough seats left." });
    }

    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

    const [booking] = await prisma.$transaction([
      prisma.booking.create({
        data: {
          rideId,
          passengerId: req.user.id,
          seatsBooked,
          pickupLat, pickupLng, pickupAddress,
          isCustomPickup: !!isCustomPickup,
          expiresAt,
        },
      }),
      prisma.ride.update({
        where: { id: rideId },
        data: { seatsAvailable: { decrement: seatsBooked } },
      }),
    ]);

    // Fallback sweep also runs a background cron (see cron/expireBookings.js);
    // this Redis TTL fires the fast path.
    await redis.set(`booking-expiry:${booking.id}`, "1", "PX", EXPIRY_MINUTES * 60 * 1000);

    await notify(ride.driverId, "NEW_BOOKING_REQUEST", "New booking request",
      `A passenger requested ${seatsBooked} seat(s) on your ride.`);

    res.status(201).json(booking);
  } finally {
    await release();
  }
});

// PUT /api/bookings/:id/accept
router.put("/:id/accept", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { ride: true },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.status !== "BOOKED") {
    return res.status(400).json({ error: `Cannot accept a booking in status ${booking.status}.` });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED", expiresAt: null },
  });

  await notify(booking.passengerId, "BOOKING_ACCEPTED", "Booking accepted",
    "Your ride is confirmed.");

  res.json(updated);
});

// PUT /api/bookings/:id/reject
router.put("/:id/reject", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { ride: true },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }

  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { status: "REJECTED" } }),
    prisma.ride.update({
      where: { id: booking.rideId },
      data: { seatsAvailable: { increment: booking.seatsBooked } },
    }),
  ]);

  await notify(booking.passengerId, "BOOKING_REJECTED", "Booking rejected",
    "The driver couldn't accept your request. Search again for another ride.");

  res.json({ success: true });
});

// PUT /api/bookings/:id/cancel — passenger-initiated
// PUT /api/bookings/:id/cancel — passenger-initiated. Only valid pre-trip
// (BOOKED/CONFIRMED) — once a trip has started or been charged, this
// isn't the right endpoint; a dispute/refund request would be the
// equivalent for a trip that already happened.
router.put("/:id/cancel", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.passengerId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (!["BOOKED", "CONFIRMED"].includes(booking.status)) {
    return res.status(400).json({ error: `Cannot cancel a booking in status ${booking.status}.` });
  }

  await prisma.$transaction([
    prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } }),
    prisma.ride.update({
      where: { id: booking.rideId },
      data: { seatsAvailable: { increment: booking.seatsBooked } },
    }),
  ]);

  // Safe no-op if nothing was ever charged — kept here as a guard in
  // case status transitions ever change (e.g. a future pre-auth model).
  await refundIfPaid(booking.id).catch((err) =>
    console.error(`Refund check failed for booking ${booking.id}:`, err.message)
  );

  res.json({ success: true });
});

// GET /api/bookings/my — passenger's booking history
router.get("/my", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { passengerId: req.user.id },
    include: { ride: { include: { driver: { select: { name: true, ratingAvg: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(bookings);
});

// GET /api/bookings/driver-pending — every pending (BOOKED, awaiting
// accept/reject) request across all of a driver's rides in one list, for
// a single approve/reject inbox rather than having to open each ride
// individually (see GET /api/rides/:id/bookings for the per-ride view
// that's still linked from each ride card).
router.get("/driver-pending", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { status: "BOOKED", ride: { driverId: req.user.id } },
    include: {
      ride: { select: { id: true, sourceAddress: true, destAddress: true } },
      passenger: { select: { name: true, ratingAvg: true } },
    },
    orderBy: { expiresAt: "asc" },
  });
  res.json(bookings);
});

// GET /api/bookings/driver-active — every active-ish booking across all
// of a driver's rides, used to populate the driver's chat conversation
// list (the passenger side already has this via /bookings/my).
router.get("/driver-active", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "IN_PROGRESS", "PAID"] },
      ride: { driverId: req.user.id },
    },
    include: {
      ride: { select: { sourceAddress: true, destAddress: true } },
      passenger: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(bookings);
});

// GET /api/bookings/:id — single booking detail, scoped to the
// passenger who owns it or the driver whose ride it belongs to. This is
// the base endpoint that lets mobile deep-link into a specific booking
// (e.g. from a push notification) instead of relying on navigation
// params carried over from a list fetch.
router.get("/:id", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: {
      ride: { include: { driver: { select: { id: true, name: true, phone: true, ratingAvg: true } } } },
      passenger: { select: { id: true, name: true, phone: true, ratingAvg: true } },
      refund: true,
    },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

  const isPassenger = booking.passengerId === req.user.id;
  const isDriver = booking.ride.driverId === req.user.id;
  if (!isPassenger && !isDriver) {
    return res.status(403).json({ error: "Not permitted." });
  }

  res.json(booking);
});

export default router;
