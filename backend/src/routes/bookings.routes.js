import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { redis, acquireLock } from "../lib/redis.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import { getIO } from "../lib/socket.js";
import { refundIfPaid } from "../lib/refunds.js";
import { getAppConfig } from "../lib/appConfig.js";
import { issueDriverStrike, isDriverStrikeBlocked } from "../lib/strikes.js";
import { clearChatForBooking } from "../lib/chat.js";
import { isWithinIndia } from "../lib/geo.js";
import { decodePolyline, progressAlongRouteKm, MATCH_RADIUS_KM } from "../lib/directions.js";
import { availableSeatsForInterval, recomputeRideSeatsAvailable, releaseSeatHold, proratedFarePerSeat } from "../lib/segments.js";
import { validate, isNonEmptyString, isLat, isLng, isPositiveInt } from "../lib/validate.js";
import { profilePhotoViewUrl, profilePhotoViewUrlsByUser } from "../lib/photo.js";
import { verifiedDriverIdsBatch, isVehicleRcVerified, verifiedPassengerIdsBatch, isPassengerVerified } from "../lib/verification.js";
import { applyAvailableCredit, markCreditsUsed } from "../lib/credits.js";

const router = Router();

// Attaches unreadMessageCount to each booking — a message counts as
// unread for the caller if it was sent by the *other* party after the
// caller's own lastReadAt column (see chat.routes.js PUT /:bookingId/read).
// One batched query for the whole list rather than a per-booking round
// trip; volume is naturally small since chat only exists during the
// CONFIRMED window and gets wiped at both ends of it (see lib/chat.js),
// so there's rarely more than a handful of live messages across all of a
// user's active bookings at once.
async function attachUnreadCounts(bookings, userId, readAtField) {
  const bookingIds = bookings.map((b) => b.id);
  if (!bookingIds.length) return bookings;

  const messages = await prisma.chatMessage.findMany({
    where: { bookingId: { in: bookingIds }, senderId: { not: userId } },
    select: { bookingId: true, createdAt: true },
  });
  const messagesByBooking = new Map();
  for (const m of messages) {
    if (!messagesByBooking.has(m.bookingId)) messagesByBooking.set(m.bookingId, []);
    messagesByBooking.get(m.bookingId).push(m.createdAt);
  }

  return bookings.map((b) => {
    const lastReadAt = b[readAtField];
    const unreadMessageCount = (messagesByBooking.get(b.id) || []).filter(
      (createdAt) => !lastReadAt || createdAt > lastReadAt
    ).length;
    return { ...b, unreadMessageCount };
  });
}

// Resolves each booking's `ride.driver.photoViewUrl` in one batched pass
// (unique drivers only, same driver often repeats across a list) —
// requires the caller's `include` to have selected `driver.photoR2Key`
// and `driver.photoBase64`.
async function attachDriverPhotos(bookings) {
  const drivers = bookings.map((b) => b.ride.driver).filter(Boolean);
  const urlById = await profilePhotoViewUrlsByUser(drivers);
  return bookings.map((b) => ({
    ...b,
    ride: { ...b.ride, driver: { ...b.ride.driver, photoViewUrl: urlById.get(b.ride.driver.id) || null } },
  }));
}

// Same as attachDriverPhotos but for `passenger.photoViewUrl` — requires
// `passenger.photoR2Key`/`passenger.photoBase64` to have been selected.
async function attachPassengerPhotos(bookings) {
  const passengers = bookings.map((b) => b.passenger).filter(Boolean);
  const urlById = await profilePhotoViewUrlsByUser(passengers);
  return bookings.map((b) => ({
    ...b,
    passenger: { ...b.passenger, photoViewUrl: urlById.get(b.passenger.id) || null },
  }));
}

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

  const {
    rideId, seatsBooked, pickupLat, pickupLng, pickupAddress, isCustomPickup,
    // Previously accepted nowhere — every booking silently defaulted to
    // the ride's own destination regardless of what the passenger
    // actually searched/matched on. Optional here (older clients, or a
    // ride with no route to project onto, still work exactly as before).
    dropLat, dropLng, dropAddress, isCustomDrop,
  } = req.body;

  const errors = validate(req.body, [
    { field: "rideId", check: isNonEmptyString, message: "Ride is required." },
    { field: "seatsBooked", check: (v) => isPositiveInt(v) && v <= 8, message: "Seats booked must be between 1 and 8." },
    { field: "pickupLat", check: isLat, message: "Pickup location is invalid." },
    { field: "pickupLng", check: isLng, message: "Pickup location is invalid." },
    { field: "pickupAddress", check: (v) => isNonEmptyString(v, 300), message: "Pickup address is required." },
    { field: "dropLat", check: isLat, message: "Drop location is invalid.", optional: true },
    { field: "dropLng", check: isLng, message: "Drop location is invalid.", optional: true },
    { field: "dropAddress", check: (v) => isNonEmptyString(v, 300), message: "Drop address is invalid.", optional: true },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  // The ride's own source/destination were already checked at publish
  // time, but a custom pickup point (isCustomPickup) is passenger-picked
  // and could in principle be dropped anywhere, so it's worth its own check.
  if (!(await isWithinIndia(pickupLat, pickupLng))) {
    return res.status(400).json({ error: "Pickup location must be within India." });
  }

  const release = await acquireLock(`ride-seats:${rideId}`, 5000);
  if (!release) {
    return res.status(409).json({ error: "Ride is busy, please try again." });
  }

  try {
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride || ride.status !== "PUBLISHED") {
      return res.status(400).json({ error: "Ride is not available." });
    }
    // Same phone number can hold both driver and passenger history (role
    // is just "currently active" — see auth.routes.js's dual-role flow),
    // so this is the same User row publishing the ride and now booking
    // it back to itself. Block it server-side, not just in the UI.
    if (ride.driverId === req.user.id) {
      return res.status(400).json({ error: "You can't book your own ride." });
    }

    // This passenger's own pickup/drop projected onto the ride's route —
    // null on either side (no stored polyline, or the point doesn't
    // project within the match radius) falls back to "occupies the rest
    // of the route from wherever it can determine," never to "occupies
    // nothing" — see lib/segments.js resolveInterval. Same projection
    // math search matching already uses (rides.routes.js matchRideSegment),
    // just computed once and stored instead of recomputed per search.
    let pickupProgressKm = null;
    let dropProgressKm = null;
    if (ride.routePolyline) {
      const points = decodePolyline(ride.routePolyline);
      const pickup = progressAlongRouteKm(pickupLat, pickupLng, points);
      if (pickup.distanceKm <= MATCH_RADIUS_KM) pickupProgressKm = pickup.progressKm;
      if (dropLat != null && dropLng != null) {
        const drop = progressAlongRouteKm(dropLat, dropLng, points);
        if (drop.distanceKm <= MATCH_RADIUS_KM) dropProgressKm = drop.progressKm;
      }
    }

    // Rides published before segment-aware booking shipped (totalSeats
    // null) keep the exact old flat-pool check forever — every booking
    // on one of those counts against the same single number regardless
    // of segment, exactly as it always did.
    if (ride.totalSeats == null) {
      if (ride.seatsAvailable < seatsBooked) {
        return res.status(400).json({ error: "Not enough seats left." });
      }
    } else {
      const available = await availableSeatsForInterval(
        ride,
        pickupProgressKm ?? 0,
        dropProgressKm ?? ride.routeDistanceKm ?? Infinity
      );
      if (available < seatsBooked) {
        return res.status(400).json({ error: "Not enough seats left on this stretch of the route." });
      }
    }

    const { bookingExpiryMinutes } = await getAppConfig();
    const expiresAt = new Date(Date.now() + bookingExpiryMinutes * 60 * 1000);

    const booking = await prisma.booking.create({
      data: {
        rideId,
        passengerId: req.user.id,
        seatsBooked,
        pickupLat, pickupLng, pickupAddress,
        isCustomPickup: !!isCustomPickup,
        ...(dropLat != null && dropLng != null && dropAddress ? { dropLat, dropLng, dropAddress, isCustomDrop: !!isCustomDrop } : {}),
        pickupProgressKm, dropProgressKm,
        expiresAt,
      },
    });

    if (ride.totalSeats == null) {
      // Legacy flat-pool ride — same relative decrement as always.
      await prisma.ride.update({ where: { id: rideId }, data: { seatsAvailable: { decrement: seatsBooked } } });
    } else {
      // New-style ride — seatsAvailable is a derived display figure now,
      // not a counter; refresh it from the real, segment-aware picture
      // rather than decrementing a number that no longer has a single
      // well-defined "the" value across the whole route.
      await recomputeRideSeatsAvailable(rideId);
    }

    // Fallback sweep also runs a background cron (see cron/expireBookings.js);
    // this Redis TTL fires the fast path.
    await redis.set(`booking-expiry:${booking.id}`, "1", "PX", bookingExpiryMinutes * 60 * 1000);

    await notify(ride.driverId, "NEW_BOOKING_REQUEST", "New booking request",
      `A passenger requested ${seatsBooked} seat(s) on your ride.`, booking.id);
    // Reaches the driver's bottom-nav "Requests" badge (and anywhere
    // else listening) wherever they are in the app right now — without
    // this, a new request only ever showed up the next time that badge
    // happened to refetch on its own (screen focus, an unrelated
    // chat:new event), same class of staleness chat:new itself was
    // built to fix for messages.
    getIO()?.to(`user:${ride.driverId}`).emit("booking:updated");

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
  // proratedFarePerSeat falls back to the full ride price whenever this
  // booking has no resolved segment (legacy ride, or pickup/drop
  // couldn't be projected) — same amount this always charged before.
  const fare = proratedFarePerSeat(booking.ride, booking.pickupProgressKm, booking.dropProgressKm) * booking.seatsBooked;
  const rawFeeAmount = (fare * config.platformFeePercent) / 100;

  // The one place a passenger's referral/promo credit ever takes effect
  // — see lib/credits.js. Never re-applied later (charge/retry just
  // charge whatever platformFeeAmount already is), so this can only
  // happen once per booking.
  const { finalAmount: platformFeeAmount, creditAppliedInr, usedCreditIds } = await applyAvailableCredit(booking.passengerId, rawFeeAmount);
  const expiresAt = new Date(Date.now() + config.paymentWindowMinutes * 60 * 1000);

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "AWAITING_PAYMENT", expiresAt, expiryReason: null, platformFeeAmount },
  });
  await markCreditsUsed(usedCreditIds, booking.id);

  // Same TTL-key-plus-cron-sweep pattern as the driver-response expiry
  // (see cron/expireBookings.js, which now sweeps both cases).
  await redis.set(`payment-window:${booking.id}`, "1", "PX", config.paymentWindowMinutes * 60 * 1000);

  const feeMessage = creditAppliedInr > 0
    ? `The driver accepted your request. Rs ${creditAppliedInr.toFixed(0)} credit was applied — pay the remaining Rs ${platformFeeAmount.toFixed(0)} within ${config.paymentWindowMinutes} minutes to lock your seat.`
    : `The driver accepted your request. Pay the platform fee (Rs ${platformFeeAmount.toFixed(0)}) within ${config.paymentWindowMinutes} minutes to lock your seat.`;
  await notify(booking.passengerId, "BOOKING_ACCEPTED", "Booking accepted — pay to confirm", feeMessage, booking.id);
  getIO()?.to(`user:${booking.passengerId}`).emit("booking:updated");

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
  // Without this, a driver could reject a booking that's already past
  // BOOKED (e.g. CONFIRMED, IN_PROGRESS, even COMPLETED) — the seat
  // increment below would double-count against ride.seatsAvailable, and
  // a paid/confirmed booking could get silently flipped back to
  // REJECTED. Same guard `accept` already has, just missing here.
  if (booking.status !== "BOOKED") {
    return res.status(400).json({ error: `Cannot reject a booking in status ${booking.status}.` });
  }

  await prisma.booking.update({ where: { id: booking.id }, data: { status: "REJECTED" } });
  await releaseSeatHold(booking.rideId, booking.seatsBooked);

  await clearChatForBooking(booking.id);

  await notify(booking.passengerId, "BOOKING_REJECTED", "Booking rejected",
    "The driver couldn't accept your request. Search again for another ride.", booking.id);
  getIO()?.to(`user:${booking.passengerId}`).emit("booking:updated");

  res.json({ success: true });
});

// PUT /api/bookings/:id/cancel — passenger-initiated. Only valid pre-trip
// (AWAITING_PAYMENT/CONFIRMED) — once a trip has started or been charged,
// this isn't the right endpoint; a dispute/refund request would be the
// equivalent for a trip that already happened.
//
// Cancellation rule (deliberately simple — no grace window on the
// passenger side): the platform fee is either paid or it isn't.
//  - AWAITING_PAYMENT (fee never charged): free withdrawal, no penalty.
//  - CONFIRMED (fee already paid): no refund, period — and it always
//    counts toward the passenger's repeat-cancel cooldown, no matter how
//    soon after paying they cancel.
//
// Driver-initiated cancellation (see /:id/driver-cancel) is unrelated —
// the passenger didn't do anything wrong when the driver cancels, so
// that path still refunds in full regardless of timing.
// PUT /api/bookings/:id/cancel — passenger-initiated, self-service. Only
// valid pre-payment (AWAITING_PAYMENT) now — once the fee is actually
// paid (CONFIRMED), a passenger can no longer back out of this on their
// own. That used to be allowed (forfeiting the fee, no refund, counting
// toward the repeat-cancel cooldown), but offering a "cancel" button
// that never refunds anything and only ever hurts the passenger's own
// standing wasn't doing anyone a favor — once paid, the seat is locked
// in for real.
router.put("/:id/cancel", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking || booking.passengerId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.status !== "AWAITING_PAYMENT") {
    return res.status(400).json({ error: `Cannot cancel a booking in status ${booking.status}.` });
  }

  const now = new Date();

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED", cancelledBy: "PASSENGER", cancelReason: "PASSENGER_WITHDRAWN", cancelledAt: now },
  });
  await releaseSeatHold(booking.rideId, booking.seatsBooked);
  await clearChatForBooking(booking.id);
  // Safe no-op — nothing was ever charged at this stage.
  await refundIfPaid(booking.id).catch((err) =>
    console.error(`Refund check failed for booking ${booking.id}:`, err.message)
  );

  res.json({ success: true, refunded: true });
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

  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED", cancelledBy: "DRIVER", cancelReason, cancelledAt: now },
  });
  await releaseSeatHold(booking.rideId, booking.seatsBooked);
  await clearChatForBooking(booking.id);

  // Full refund regardless of timing once a fee was actually charged —
  // safe no-op if the booking was still AWAITING_PAYMENT.
  await refundIfPaid(booking.id).catch((err) =>
    console.error(`Refund check failed for booking ${booking.id}:`, err.message)
  );

  if (strikeWorthy) {
    await issueDriverStrike(req.user.id, { bookingId: booking.id, rideId: booking.rideId, reason: "DRIVER_LATE_CANCEL" });
  }

  await notify(booking.passengerId, "BOOKING_CANCELLED_BY_DRIVER", "Driver cancelled your booking",
    "The driver cancelled this booking. Any platform fee you paid has been refunded.", booking.id);

  res.json({ success: true });
});

// GET /api/bookings/my — passenger's booking history
router.get("/my", requireAuth, requireRole("PASSENGER"), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { passengerId: req.user.id },
    include: { ride: { include: { driver: { select: { id: true, name: true, ratingAvg: true, photoR2Key: true, photoBase64: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const withPhotos = await attachUnreadCounts(await attachDriverPhotos(bookings), req.user.id, "passengerLastReadAt");
  const verifiedDriverIds = await verifiedDriverIdsBatch(withPhotos.map((b) => b.ride.driverId));
  // What this passenger actually owes per seat for their own matched
  // segment — the "total fare" shown before a driver has even accepted
  // (and so before platformFeeAmount exists yet) previously showed the
  // ride's full-route price regardless of how much of it this booking
  // actually covers (HistoryScreen.tsx). Falls back to the full ride
  // price server-side for a legacy/no-route ride, same as everywhere
  // else this is computed.
  res.json(withPhotos.map((b) => ({
    ...b,
    segmentPricePerSeat: proratedFarePerSeat(b.ride, b.pickupProgressKm, b.dropProgressKm),
    ride: { ...b.ride, driverVerified: verifiedDriverIds.has(b.ride.driverId) },
  })));
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
      // travelDate is what the client groups requests by — a driver
      // with several published rides otherwise sees every pending
      // request from every ride interleaved in one flat list, with no
      // visual separation of which request belongs to which trip.
      ride: { select: { id: true, sourceAddress: true, destAddress: true, travelDate: true } },
      passenger: { select: { id: true, name: true, ratingAvg: true, photoR2Key: true, photoBase64: true } },
    },
    orderBy: { expiresAt: "asc" },
  });
  const withPhotos = await attachPassengerPhotos(bookings);
  const verifiedPassengerIds = await verifiedPassengerIdsBatch(withPhotos.map((b) => b.passenger.id));
  res.json(withPhotos.map((b) => ({
    ...b,
    passenger: { ...b.passenger, passengerVerified: verifiedPassengerIds.has(b.passenger.id) },
  })));
});

// GET /api/bookings/driver-active — every active-ish booking across all
// of a driver's rides. Used for the driver's chat conversation list and
// the payment-queue screen (PAYMENT_PENDING/CHARGE_ATTEMPTED are a
// passenger's fee payment failing/in-flight after acceptance — still
// worth the driver seeing, same as AWAITING_PAYMENT) (the passenger side
// already has the equivalent via /bookings/my).
router.get("/driver-active", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
      ride: { driverId: req.user.id },
    },
    include: {
      // travelDate — same reason as /driver-pending above: this feeds
      // Payment queue and Start trip now, both grouped by which ride
      // each booking belongs to.
      ride: { select: { sourceAddress: true, destAddress: true, travelDate: true } },
      passenger: { select: { id: true, name: true, photoR2Key: true, photoBase64: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const withUnread = await attachUnreadCounts(await attachPassengerPhotos(bookings), req.user.id, "driverLastReadAt");
  const verifiedPassengerIds = await verifiedPassengerIdsBatch(withUnread.map((b) => b.passenger.id));
  res.json(withUnread.map((b) => ({
    ...b,
    passenger: { ...b.passenger, passengerVerified: verifiedPassengerIds.has(b.passenger.id) },
  })));
});

// GET /api/bookings/active-trip — the caller's own current IN_PROGRESS
// booking, whichever side of it they're on. Used right after app launch
// (see HomeScreen) to resume straight into live tracking if the trip is
// still going — a crash, force-quit, or reinstall while IN_PROGRESS
// otherwise loses track of it entirely, since nothing else brings the
// user back to that screen on its own.
router.get("/active-trip", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findFirst({
    where: {
      status: "IN_PROGRESS",
      OR: [{ passengerId: req.user.id }, { ride: { driverId: req.user.id } }],
    },
    include: { ride: { select: { driverId: true } } },
  });
  if (!booking) return res.json(null);

  const role = booking.passengerId === req.user.id ? "PASSENGER" : "DRIVER";
  res.json({ bookingId: booking.id, role });
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
      ride: { include: { driver: { select: { id: true, name: true, phone: true, ratingAvg: true, photoR2Key: true, photoBase64: true } }, vehicle: true } },
      passenger: { select: { id: true, name: true, phone: true, ratingAvg: true, photoR2Key: true, photoBase64: true } },
      refund: true,
    },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

  const isPassenger = booking.passengerId === req.user.id;
  const isDriver = booking.ride.driverId === req.user.id;
  if (!isPassenger && !isDriver) {
    return res.status(403).json({ error: "Not permitted." });
  }

  // The review (if any) the OTHER party on this booking left about the
  // person currently viewing — only ever exists once the trip's done and
  // RateReviewScreen was actually used, so this is commonly null. Scoped
  // to toUserId === req.user.id rather than returning every review tied
  // to the booking, since the reviewer shouldn't see their own
  // just-submitted rating reflected back as if it were feedback on them.
  const reviewForMe = await prisma.review.findFirst({
    where: { bookingId: booking.id, toUserId: req.user.id },
    include: { fromUser: { select: { name: true } } },
  });

  const licenseVerified = (await verifiedDriverIdsBatch([booking.ride.driverId])).has(booking.ride.driverId);
  const rcVerified = await isVehicleRcVerified(booking.ride.vehicle);
  const passengerVerified = await isPassengerVerified(booking.passenger.id);

  res.json({
    ...booking,
    ride: {
      ...booking.ride,
      driver: { ...booking.ride.driver, photoViewUrl: await profilePhotoViewUrl(booking.ride.driver) },
      driverVerified: licenseVerified,
      licenseVerified,
      rcVerified,
    },
    passenger: { ...booking.passenger, photoViewUrl: await profilePhotoViewUrl(booking.passenger), passengerVerified },
    // What this specific booking's passenger owes per seat for their own
    // matched segment — see rides.routes.js GET /:id/details for the
    // same computation pre-booking. BookingDetailScreen.tsx shows this
    // instead of the ride's full-route price.
    segmentPricePerSeat: proratedFarePerSeat(booking.ride, booking.pickupProgressKm, booking.dropProgressKm),
    reviewForMe: reviewForMe
      ? {
          rating: reviewForMe.rating,
          comment: reviewForMe.comment,
          fromUserName: reviewForMe.fromUser.name,
          createdAt: reviewForMe.createdAt,
        }
      : null,
  });
});

export default router;
