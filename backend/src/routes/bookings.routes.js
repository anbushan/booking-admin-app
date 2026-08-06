import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { redis, acquireLock } from "../lib/redis.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import { refundIfPaid } from "../lib/refunds.js";
import { getAppConfig } from "../lib/appConfig.js";
import { issueDriverStrike, isDriverStrikeBlocked } from "../lib/strikes.js";
import { validate, isNonEmptyString, isLat, isLng, isPositiveInt } from "../lib/validate.js";

const router = Router();

// POST /api/bookings — passenger books a seat.
// Wrapped in a distributed lock keyed by rideId so two simultaneous
// bookings on the last seat can't both succeed (the race condition
// flagged earlier in the plan).
router.post("/", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  if (req.user.bookingCooldownUntil && new Date(req.user.bookingCooldownUntil) > new Date()) {
    return res.status(403).json({
      error: `You're temporarily blocked from booking due to repeated late cancellations. Try again after ${new Date(req.user.bookingCooldownUntil).toLocaleString()}.`,
    });
  }

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

    const { bookingExpiryMinutes } = await getAppConfig();
    const expiresAt = new Date(Date.now() + bookingExpiryMinutes * 60 * 1000);

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
    await redis.set(`booking-expiry:${booking.id}`, "1", "PX", bookingExpiryMinutes * 60 * 1000);

    await notify(ride.driverId, "NEW_BOOKING_REQUEST", "New booking request",
      `A passenger requested ${seatsBooked} seat(s) on your ride.`);

    res.status(201).json(booking);
  } finally {
    await release();
  }
});

// PUT /api/bookings/:id/accept — driver approves. This no longer confirms
// the booking outright: it starts the platform-fee payment window
// (AWAITING_PAYMENT). The booking only becomes CONFIRMED once the fee is
// actually captured — see payments.routes.js webhook handler.
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
  if (isDriverStrikeBlocked(req.user)) {
    return res.status(403).json({ error: "Your account is temporarily blocked from accepting new bookings." });
  }

  const config = await getAppConfig();
  const platformFeeAmount = (Number(booking.ride.pricePerSeat) * booking.seatsBooked * config.platformFeePercent) / 100;
  const expiresAt = new Date(Date.now() + config.paymentWindowMinutes * 60 * 1000);

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "AWAITING_PAYMENT", expiresAt, expiryReason: null, platformFeeAmount },
  });

  // Same TTL-key-plus-cron-sweep pattern as the driver-response expiry
  // (see cron/expireBookings.js, which now sweeps both cases).
  await redis.set(`payment-window:${booking.id}`, "1", "PX", config.paymentWindowMinutes * 60 * 1000);

  await notify(booking.passengerId, "BOOKING_ACCEPTED", "Booking accepted — pay to confirm",
    `The driver accepted your request. Pay the platform fee (Rs ${platformFeeAmount.toFixed(0)}) within ${config.paymentWindowMinutes} minutes to lock your seat.`);

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

// PUT /api/bookings/:id/cancel — passenger-initiated. Only valid pre-trip
// (AWAITING_PAYMENT/CONFIRMED) — once a trip has started or been charged,
// this isn't the right endpoint; a dispute/refund request would be the
// equivalent for a trip that already happened.
//
// Cancellation matrix:
//  - AWAITING_PAYMENT (fee never charged): free withdrawal, no penalty.
//  - CONFIRMED, within the grace window (graceCancelWindowMinutes of
//    platformFeePaidAt): full refund, no penalty.
//  - CONFIRMED, past the grace window: no refund, and counts toward the
//    passenger's repeat-cancel cooldown.
router.put("/:id/cancel", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.passengerId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (!["AWAITING_PAYMENT", "CONFIRMED"].includes(booking.status)) {
    return res.status(400).json({ error: `Cannot cancel a booking in status ${booking.status}.` });
  }

  const config = await getAppConfig();
  const now = new Date();
  let cancelReason = "PASSENGER_WITHDRAWN";
  let withinGrace = true;

  if (booking.status === "CONFIRMED" && booking.platformFeePaidAt) {
    const elapsedMinutes = (now - new Date(booking.platformFeePaidAt)) / 60000;
    withinGrace = elapsedMinutes <= config.graceCancelWindowMinutes;
    cancelReason = withinGrace ? "PASSENGER_REQUEST_GRACE" : "PASSENGER_REQUEST_LATE";
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledBy: "PASSENGER", cancelReason, cancelledAt: now },
    }),
    prisma.ride.update({
      where: { id: booking.rideId },
      data: { seatsAvailable: { increment: booking.seatsBooked } },
    }),
  ]);

  if (withinGrace) {
    // Safe no-op if nothing was ever charged (e.g. still AWAITING_PAYMENT).
    await refundIfPaid(booking.id).catch((err) =>
      console.error(`Refund check failed for booking ${booking.id}:`, err.message)
    );
  } else {
    // Past the grace window: no refund. Count late cancels in the rolling
    // cooldown window and apply the cooldown once the threshold is hit.
    const cutoff = new Date(now.getTime() - config.passengerCooldownWindowDays * 24 * 60 * 60 * 1000);
    const lateCancelCount = await prisma.booking.count({
      where: {
        passengerId: req.user.id,
        cancelledBy: "PASSENGER",
        cancelReason: "PASSENGER_REQUEST_LATE",
        cancelledAt: { gte: cutoff },
      },
    });
    if (lateCancelCount >= config.passengerCooldownCancelCount) {
      const cooldownUntil = new Date(now.getTime() + config.passengerCooldownHours * 60 * 60 * 1000);
      await prisma.user.update({ where: { id: req.user.id }, data: { bookingCooldownUntil: cooldownUntil } });
      await notify(req.user.id, "PASSENGER_COOLDOWN_APPLIED", "Booking cooldown applied",
        `Repeated late cancellations have paused your ability to book for ${config.passengerCooldownHours} hours.`);
    }
  }

  res.json({ success: true, refunded: withinGrace });
});

// PUT /api/bookings/:id/driver-cancel — driver-initiated. Mirrors the
// passenger cancel matrix, but the "past grace window" penalty is a
// strike on the driver rather than a cooldown, and refund is always full
// once the fee was actually charged (only the timing changes whether a
// strike also gets issued).
router.put("/:id/driver-cancel", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { ride: true },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (!["AWAITING_PAYMENT", "CONFIRMED"].includes(booking.status)) {
    return res.status(400).json({ error: `Cannot cancel a booking in status ${booking.status}.` });
  }

  const config = await getAppConfig();
  const now = new Date();
  let cancelReason = "DRIVER_WITHDRAWN";
  let strikeWorthy = false;

  if (booking.status === "CONFIRMED" && booking.platformFeePaidAt) {
    const elapsedMinutes = (now - new Date(booking.platformFeePaidAt)) / 60000;
    const withinGrace = elapsedMinutes <= config.graceCancelWindowMinutes;
    cancelReason = withinGrace ? "DRIVER_REQUEST_GRACE" : "DRIVER_REQUEST_LATE";
    strikeWorthy = !withinGrace;
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", cancelledBy: "DRIVER", cancelReason, cancelledAt: now },
    }),
    prisma.ride.update({
      where: { id: booking.rideId },
      data: { seatsAvailable: { increment: booking.seatsBooked } },
    }),
  ]);

  // Full refund regardless of timing once a fee was actually charged —
  // safe no-op if the booking was still AWAITING_PAYMENT.
  await refundIfPaid(booking.id).catch((err) =>
    console.error(`Refund check failed for booking ${booking.id}:`, err.message)
  );

  if (strikeWorthy) {
    await issueDriverStrike(req.user.id, { bookingId: booking.id, rideId: booking.rideId, reason: "DRIVER_LATE_CANCEL" });
  }

  await notify(booking.passengerId, "BOOKING_CANCELLED_BY_DRIVER", "Driver cancelled your booking",
    "The driver cancelled this booking. Any platform fee you paid has been refunded.");

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
      status: { in: ["AWAITING_PAYMENT", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
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
