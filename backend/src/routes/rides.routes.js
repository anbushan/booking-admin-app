import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { refundIfPaid } from "../lib/refunds.js";
import { notify } from "../lib/notify.js";
import { getAppConfig } from "../lib/appConfig.js";
import { isDriverStrikeBlocked } from "../lib/strikes.js";
import { clearChatForBooking } from "../lib/chat.js";
import { isWithinIndia } from "../lib/geo.js";
import { getRouteAlternatives, decodePolyline, pointToPolylineDistanceKm, progressAlongRouteKm } from "../lib/directions.js";
import { validate, isLat, isLng, isNonEmptyString, isFutureDate, isPositiveInt, isPositiveNumber } from "../lib/validate.js";
import { photoViewUrl, photoViewUrlsByUser } from "../lib/photo.js";

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
// routeDistanceKm (real Directions API distance, when a route's been
// computed) takes priority over the straight-line guess when given — an
// actual driving distance is always at least the straight-line one, so
// this only ever makes the cap more generous, never stricter, relative
// to what a ride without route data gets.
function computeFareCap(sourceLat, sourceLng, destLat, destLng, fareCapPerKmInr, routeDistanceKm) {
  const distanceKm = routeDistanceKm ?? haversineKm(sourceLat, sourceLng, destLat, destLng);
  return Math.round(distanceKm * fareCapPerKmInr);
}

// Rough ETA off the same straight-line distance already used for the
// fare cap — an assumed average speed, not a real route/traffic-aware
// estimate. Only used as a fallback now, for a ride published before
// route computation existed (or where Directions couldn't resolve a
// route) — a ride with a stored routeDurationMinutes uses that instead
// (real Directions API duration), passed in as `ride` below.
const ASSUMED_AVG_SPEED_KMH = 40;

// dropProgressKm, when given, is a specific searching passenger's own
// drop point's distance-along-the-route (see matchRideSegment) — the
// returned duration/arrival is THIS PASSENGER's, not the ride's full
// source-to-destination trip. Without it (no destination searched, or
// this ride has no stored route to measure progress against), this is
// the ride's own full-route estimate, same as before.
function estimateArrival(ride, dropProgressKm) {
  let durationMinutes;
  if (dropProgressKm != null && ride.routeDurationMinutes != null && ride.routeDistanceKm) {
    durationMinutes = Math.round(ride.routeDurationMinutes * (dropProgressKm / ride.routeDistanceKm));
  } else if (ride.routeDurationMinutes != null) {
    durationMinutes = ride.routeDurationMinutes;
  } else {
    durationMinutes = Math.round((haversineKm(ride.sourceLat, ride.sourceLng, ride.destLat, ride.destLng) / ASSUMED_AVG_SPEED_KMH) * 60);
  }
  return {
    estimatedDurationMinutes: durationMinutes,
    estimatedArrivalAt: new Date(new Date(ride.travelDate).getTime() + durationMinutes * 60 * 1000),
  };
}

// POST /api/rides/route-options — before actually publishing, the driver
// sees a few possible routes to the destination (Google routing
// alternatives, each with a derived stop list) and picks one. Always
// shown, even for a plain point-to-point trip with no meaningful
// alternative shape — Directions returning just one route in that case
// is expected, not an error; the picker just shows one card.
router.post("/route-options", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const { sourceLat, sourceLng, sourceAddress, destLat, destLng, destAddress } = req.body;

  const errors = validate(req.body, [
    { field: "sourceLat", check: isLat, message: "Source location is invalid." },
    { field: "sourceLng", check: isLng, message: "Source location is invalid." },
    { field: "destLat", check: isLat, message: "Destination location is invalid." },
    { field: "destLng", check: isLng, message: "Destination location is invalid." },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const alternatives = await getRouteAlternatives(sourceLat, sourceLng, destLat, destLng, sourceAddress, destAddress);
  res.json({ alternatives });
});

// POST /api/rides — driver publishes a ride
router.post("/", requireAuth, requireRole("DRIVER"), async (req, res) => {
  if (isDriverStrikeBlocked(req.user)) {
    return res.status(403).json({ error: "Your account is temporarily blocked from publishing new rides." });
  }

  const {
    sourceLat, sourceLng, sourceAddress,
    destLat, destLng, destAddress,
    travelDate, seatsAvailable, pricePerSeat,
    maxDetourKm, preferences, vehicleId,
    // Supplied once the driver picks one of the alternatives from
    // POST /route-options — all optional so a direct API call that
    // skips the picker still works exactly as before (straight-line
    // fare cap/ETA, no stored route).
    routePolyline, routeStops, routeDistanceKm, routeDurationMinutes,
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

  const [sourceInIndia, destInIndia] = await Promise.all([
    isWithinIndia(sourceLat, sourceLng),
    isWithinIndia(destLat, destLng),
  ]);
  if (!sourceInIndia || !destInIndia) {
    return res.status(400).json({ error: "Rides are only available within India right now." });
  }

  // A driver must own a vehicle before publishing — otherwise there's
  // nothing for the passenger to be picked up in. If they own more than
  // one, they have to say which this ride uses (search shows the real
  // vehicle per ride, not a guess); with exactly one, it's auto-picked.
  // Only APPROVED vehicles count here — a vehicle sits PENDING until an
  // admin reviews it (see vehicles.routes.js POST /), so a driver who
  // just added one can't immediately publish with it.
  const allVehicles = await prisma.vehicle.findMany({ where: { driverId: req.user.id } });
  if (!allVehicles.length) {
    return res.status(400).json({ error: "Add a vehicle before publishing a ride." });
  }
  const vehicles = allVehicles.filter((v) => v.status === "APPROVED");
  if (!vehicles.length) {
    return res.status(400).json({ error: "Your vehicle hasn't been approved yet — you can publish once it's reviewed." });
  }
  let vehicle;
  if (vehicles.length === 1) {
    vehicle = vehicles[0];
  } else {
    vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      return res.status(400).json({ error: "Select which vehicle this ride uses." });
    }
  }
  if (vehicle.seatCapacity != null && Number(seatsAvailable) > vehicle.seatCapacity) {
    return res.status(400).json({ error: `${vehicle.make} ${vehicle.model} only seats ${vehicle.seatCapacity}.` });
  }

  // Can't publish a new ride while literally out driving another one.
  const activeTrip = await prisma.booking.findFirst({
    where: { status: "IN_PROGRESS", ride: { driverId: req.user.id } },
  });
  if (activeTrip) {
    return res.status(400).json({ error: "You're currently on a trip — finish it before publishing a new ride." });
  }

  // Nor publish a second ride at the exact same departure time as one
  // already live.
  const clash = await prisma.ride.findFirst({
    where: { driverId: req.user.id, status: "PUBLISHED", travelDate: new Date(travelDate) },
  });
  if (clash) {
    return res.status(400).json({ error: "You already have a ride scheduled at this exact time." });
  }

  const config = await getAppConfig();
  const fareCap = computeFareCap(sourceLat, sourceLng, destLat, destLng, config.fareCapPerKmInr, routeDistanceKm);
  if (Number(pricePerSeat) > fareCap) {
    return res.status(400).json({
      error: `Price per seat can't exceed Rs ${fareCap} for this distance — this keeps the ride classified as cost-sharing rather than a commercial fare.`,
      fareCap,
    });
  }

  const ride = await prisma.ride.create({
    data: {
      driverId: req.user.id,
      vehicleId: vehicle.id,
      sourceLat, sourceLng, sourceAddress,
      destLat, destLng, destAddress,
      ...(routePolyline && { routePolyline }),
      ...(routeStops && { routeStops }),
      ...(routeDistanceKm != null && { routeDistanceKm }),
      ...(routeDurationMinutes != null && { routeDurationMinutes }),
      travelDate: new Date(travelDate),
      seatsAvailable,
      pricePerSeat,
      maxDetourKm: maxDetourKm ?? config.defaultMaxDetourKm,
      preferences: preferences || {},
    },
  });

  res.status(201).json(ride);
});

// GET /api/rides/search?source=&destination=&date=&seats=&startTime=&endTime=
// NOTE: this is a naive bounding-radius search for MVP. Swap in a proper
// geo-index (PostGIS or a Redis geo set) once ride volume grows.
//
// startTime/endTime are optional "HH:mm" (24h) bounds that narrow the
// date's whole-day window down to a departure-time range — e.g.
// startTime=09:00&endTime=11:00 on top of date=2026-08-10 only returns
// rides departing between 9 and 11am that day. Without them, behavior is
// unchanged (whole day).
function parseHHmm(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

// A ride's own source/dest points are always in matching range of
// themselves — used as the fallback "route" for a ride published before
// route computation existed (no stored routePolyline), so the match
// logic below has one shape to deal with either way.
//
// Returns null on no match, or the passenger's own match info on a hit —
// used by the caller to show *this passenger's* arrival at their own
// drop point (see estimateArrival below), not the ride's full-route
// endpoint, which is what made a route that legitimately passes near a
// searched destination look like it was headed somewhere else entirely.
//
// radiusKm is deliberately a bit more forgiving than the 3-20km
// maxDetourKm a driver sets for pickup detours — this is matching two
// *independent* geocoding lookups of what's meant to be the same real
// place (the driver's publish-time search and the passenger's own
// search), and small towns in particular can resolve to noticeably
// different centroids between two separate lookups even for identical
// typed text. Too tight here produces false "no rides found" misses
// more often than it filters out genuinely irrelevant rides.
function matchRideSegment(ride, pickupLat, pickupLng, dropLat, dropLng, radiusKm) {
  if (!pickupLat || !pickupLng) return {};

  if (ride.routePolyline) {
    const points = decodePolyline(ride.routePolyline);
    const pickup = progressAlongRouteKm(Number(pickupLat), Number(pickupLng), points);
    if (pickup.distanceKm > radiusKm) return null;
    if (dropLat && dropLng) {
      const drop = progressAlongRouteKm(Number(dropLat), Number(dropLng), points);
      if (drop.distanceKm > radiusKm) return null;
      if (drop.progressKm <= pickup.progressKm) return null; // wrong direction
      return { pickupProgressKm: pickup.progressKm, dropProgressKm: drop.progressKm };
    }
    return { pickupProgressKm: pickup.progressKm };
  }

  // Legacy ride, no stored route — exactly today's straight-line check.
  if (haversineKm(Number(pickupLat), Number(pickupLng), ride.sourceLat, ride.sourceLng) > radiusKm) return null;
  if (dropLat && dropLng) {
    if (haversineKm(Number(dropLat), Number(dropLng), ride.destLat, ride.destLng) > radiusKm) return null;
  }
  return {};
}

// GET /api/rides/popular-locations — the most frequently searched-for
// pickup/drop points across everyone's rides, for LocationSearchScreen's
// "Top searches" list. Derived from existing Ride rows (source AND dest
// addresses, unioned) rather than a dedicated search-log table — no new
// writes needed on every keystroke, and a location only counts once
// someone actually published a ride to/from it, which is a better signal
// of a genuinely popular place than raw autocomplete traffic would be.
router.get("/popular-locations", requireAuth, async (req, res) => {
  const rows = await prisma.$queryRaw`
    SELECT address, MAX(lat) AS lat, MAX(lng) AS lng, COUNT(*)::int AS count
    FROM (
      SELECT "sourceAddress" AS address, "sourceLat" AS lat, "sourceLng" AS lng FROM "Ride"
      UNION ALL
      SELECT "destAddress" AS address, "destLat" AS lat, "destLng" AS lng FROM "Ride"
    ) t
    GROUP BY address
    ORDER BY count DESC
    LIMIT 8
  `;
  res.json(rows.map((r) => ({ address: r.address, lat: Number(r.lat), lng: Number(r.lng), count: r.count })));
});

// GET /api/rides/popular-routes — the most-published source→destination
// pairs, for Home's "Popular routes" shortcut (tap one, jump straight
// into search with both ends already filled in) — a step up from
// popular-locations above, which only knows single points, not pairs.
router.get("/popular-routes", requireAuth, async (req, res) => {
  const rows = await prisma.$queryRaw`
    SELECT
      "sourceAddress" AS "sourceAddress", MAX("sourceLat") AS "sourceLat", MAX("sourceLng") AS "sourceLng",
      "destAddress" AS "destAddress", MAX("destLat") AS "destLat", MAX("destLng") AS "destLng",
      COUNT(*)::int AS count
    FROM "Ride"
    GROUP BY "sourceAddress", "destAddress"
    ORDER BY count DESC
    LIMIT 5
  `;
  res.json(
    rows.map((r) => ({
      sourceAddress: r.sourceAddress,
      sourceLat: Number(r.sourceLat),
      sourceLng: Number(r.sourceLng),
      destAddress: r.destAddress,
      destLat: Number(r.destLat),
      destLng: Number(r.destLng),
      count: r.count,
    }))
  );
});

router.get("/search", requireAuth, async (req, res) => {
  const { sourceLat, sourceLng, destLat, destLng, date, seats, startTime, endTime } = req.query;
  const radiusKm = 8;

  let travelDateFilter;
  if (date) {
    const start = parseHHmm(startTime);
    const end = parseHHmm(endTime);
    const dayStart = new Date(date);
    dayStart.setHours(start ? start.hours : 0, start ? start.minutes : 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(end ? end.hours : 23, end ? end.minutes : 59, 59, 999);
    travelDateFilter = { gte: dayStart, lte: dayEnd };
  }

  // Full rides are still returned (not hidden) — the client marks them
  // "Full" and disables booking, rather than a passenger being unable to
  // tell the difference between "no ride exists" and "it's full."
  const candidates = await prisma.ride.findMany({
    where: {
      status: "PUBLISHED",
      travelDate: travelDateFilter,
    },
    include: {
      driver: { select: { id: true, name: true, ratingAvg: true, photoR2Key: true } },
      vehicle: { select: { make: true, model: true, seatCapacity: true } },
    },
    orderBy: { travelDate: "asc" },
  });

  // Computed once per candidate, reused for both the filter and the
  // personalized-ETA map below instead of recomputing the same
  // point-to-polyline math twice.
  const matchInfoByRideId = new Map();
  const inRadius = candidates.filter((r) => {
    const match = matchRideSegment(r, sourceLat, sourceLng, destLat, destLng, radiusKm);
    if (!match) return false;
    matchInfoByRideId.set(r.id, match);
    return true;
  });

  // Batch the "is this driver verified" check (docs uploaded, all
  // APPROVED) across every unique driver in the result set instead of
  // querying per-ride — same definition used in the admin driver page.
  const driverIds = [...new Set(inRadius.map((r) => r.driverId))];
  const docs = await prisma.document.findMany({ where: { userId: { in: driverIds } } });
  const docsByDriver = new Map();
  for (const doc of docs) {
    if (!docsByDriver.has(doc.userId)) docsByDriver.set(doc.userId, []);
    docsByDriver.get(doc.userId).push(doc);
  }
  const verifiedDriverIds = new Set(
    driverIds.filter((id) => {
      const list = docsByDriver.get(id) || [];
      return list.length > 0 && list.every((d) => d.status === "APPROVED");
    })
  );

  // Same batch-per-unique-driver approach as verifiedDriverIds above —
  // resolves each driver's signed photo URL once even if they have
  // multiple rides in the result set.
  const photoUrlByDriverId = await photoViewUrlsByUser(
    driverIds.map((id) => ({ id, photoR2Key: inRadius.find((r) => r.driverId === id)?.driver?.photoR2Key }))
  );

  const minSeats = Number(seats || 1);
  const results = inRadius.map((r) => ({
    ...r,
    driver: { ...r.driver, photoViewUrl: photoUrlByDriverId.get(r.driverId) || null },
    seatsFull: r.seatsAvailable < minSeats,
    // Same phone number can hold both driver and passenger history (role
    // is just "currently active" — see auth.routes.js's dual-role flow),
    // so a driver's own published ride can otherwise surface in their
    // own passenger search. Flagged rather than filtered out, same as
    // seatsFull, so the client can show it read-only instead of pretending
    // it doesn't exist.
    isOwnRide: r.driverId === req.user.id,
    driverVerified: verifiedDriverIds.has(r.driverId),
    ...estimateArrival(r, matchInfoByRideId.get(r.id)?.dropProgressKm),
  }));

  res.json(results);
});

// GET /api/rides/:id/details
router.get("/:id/details", requireAuth, async (req, res) => {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    include: { driver: true, vehicle: true },
  });
  if (!ride) return res.status(404).json({ error: "Ride not found." });
  res.json({
    ...ride,
    driver: { ...ride.driver, photoViewUrl: await photoViewUrl(ride.driver.photoR2Key) },
    ...estimateArrival(ride),
  });
});

// POST /api/rides/:id/validate-pickup — checks a passenger-proposed
// pickup point against the ride's allowed detour.
router.post("/:id/validate-pickup", requireAuth, async (req, res) => {
  const { lat, lng } = req.body;
  const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
  if (!ride) return res.status(404).json({ error: "Ride not found." });

  // A route-bearing ride checks the detour against the whole path, not
  // just the literal starting point — a pickup near the middle of the
  // route is exactly the case this feature exists for. A legacy ride
  // with no stored route keeps today's source-point-only check.
  const detourKm = ride.routePolyline
    ? pointToPolylineDistanceKm(lat, lng, decodePolyline(ride.routePolyline))
    : haversineKm(ride.sourceLat, ride.sourceLng, lat, lng);
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
    include: { passenger: { select: { name: true, ratingAvg: true, photoR2Key: true } } },
    orderBy: { createdAt: "asc" },
  });

  const withPhotos = await Promise.all(
    bookings.map(async (b) => ({
      ...b,
      passenger: { ...b.passenger, photoViewUrl: await photoViewUrl(b.passenger.photoR2Key) },
    }))
  );

  res.json(withPhotos);
});

router.get("/my", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const rides = await prisma.ride.findMany({
    where: { driverId: req.user.id },
    orderBy: { travelDate: "desc" },
    include: { bookings: { where: { status: "CONFIRMED" }, select: { id: true } } },
  });
  // hasConfirmedBooking — whether "Cancel ride" is still available at
  // all (see DELETE /:id's own guard, which enforces the same rule
  // server-side regardless of what the client shows).
  res.json(rides.map(({ bookings, ...ride }) => ({ ...ride, hasConfirmedBooking: bookings.length > 0 })));
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
    const fareCap = computeFareCap(ride.sourceLat, ride.sourceLng, ride.destLat, ride.destLng, config.fareCapPerKmInr, ride.routeDistanceKm);
    if (Number(pricePerSeat) > fareCap) {
      return res.status(400).json({
        error: `Price per seat can't exceed Rs ${fareCap} for this distance.`,
        fareCap,
      });
    }
  }

  if (seatsAvailable !== undefined && ride.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: ride.vehicleId } });
    if (vehicle?.seatCapacity != null && Number(seatsAvailable) > vehicle.seatCapacity) {
      return res.status(400).json({ error: `${vehicle.make} ${vehicle.model} only seats ${vehicle.seatCapacity}.` });
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

// DELETE /api/rides/:id — driver cancels the whole ride. Blocked once
// any passenger has actually paid (CONFIRMED) — wiping out a ride out
// from under someone who's already locked in and paid isn't something a
// driver gets to do unilaterally anymore; at that point the ride can
// only be edited (remaining open seats/price/time), or a specific
// passenger removed individually via bookings.routes.js
// /:id/driver-cancel, which still carries its own refund/strike
// consequences. A ride with only pending (BOOKED/AWAITING_PAYMENT, never
// paid) requests is still freely cancellable — nobody's committed
// anything yet.
router.delete("/:id", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    include: { bookings: { where: { status: { in: ["BOOKED", "AWAITING_PAYMENT", "CONFIRMED"] } } } },
  });
  if (!ride || ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Ride not found." });
  }

  if (ride.bookings.some((b) => b.status === "CONFIRMED")) {
    return res.status(400).json({
      error: "A passenger has already paid and locked in a seat — this ride can only be edited now, not cancelled outright. Remove a specific passenger from Booking requests if you need to.",
    });
  }

  // Belt-and-suspenders alongside the ride.status flip in
  // trips.routes.js verify-otp: a ride shouldn't be cancellable while
  // the driver is literally mid-trip with a passenger, regardless of
  // what the ride's own status currently says.
  const activeTrip = await prisma.booking.findFirst({ where: { rideId: req.params.id, status: "IN_PROGRESS" } });
  if (activeTrip) {
    return res.status(400).json({ error: "Can't cancel a ride with a trip in progress." });
  }

  const now = new Date();

  await prisma.ride.update({ where: { id: req.params.id }, data: { status: "CANCELLED" } });

  // Only BOOKED/AWAITING_PAYMENT bookings can reach here now — the guard
  // above already rejects the request outright if any booking is
  // CONFIRMED — so nobody being cancelled here has actually paid yet:
  // no refund needed (refundIfPaid stays a safe no-op regardless), no
  // grace-window/strike logic applies, same as a plain withdrawn request.
  // One affected booking's cancel work is independent of every other's,
  // so they run in parallel instead of one at a time — the previous
  // sequential loop meant a ride with N pending requests took N times as
  // long to cancel as one with a single request.
  await Promise.all(
    ride.bookings.map(async (booking) => {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED", cancelledBy: "DRIVER", cancelReason: "DRIVER_WITHDRAWN", cancelledAt: now },
      });
      await clearChatForBooking(booking.id);
      await refundIfPaid(booking.id).catch((err) =>
        console.error(`Refund check failed for booking ${booking.id}:`, err.message)
      );
      await notify(booking.passengerId, "RIDE_CANCELLED", "Ride cancelled",
        "The driver cancelled this ride. Please search for another one.", booking.id);
    })
  );

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
    include: { ride: true, passenger: { select: { id: true, name: true } } },
    orderBy: { tripCompletedAt: "desc" },
  });

  const totalThisMonth = completedBookings.reduce(
    (sum, b) => sum + Number(b.remainingFareAmount || 0),
    0
  );
  const avgPerTrip = completedBookings.length ? totalThisMonth / completedBookings.length : 0;

  // Cash/UPI a driver has already earned but hasn't tapped "mark
  // collected" for yet — computed across every completed booking this
  // month, not just the 10 shown in recentTrips, so it stays accurate
  // even once a driver has more than 10 trips in a month.
  const uncollected = completedBookings.filter((b) => !b.remainingFareCollectedAt);
  const pendingCollectionAmount = uncollected.reduce(
    (sum, b) => sum + Number(b.remainingFareAmount || 0),
    0
  );

  res.json({
    totalThisMonth,
    tripsCompleted: completedBookings.length,
    avgPerTrip: Math.round(avgPerTrip),
    pendingCollectionAmount,
    pendingCollectionCount: uncollected.length,
    recentTrips: completedBookings
      .slice(0, 10)
      .map((b) => ({
        id: b.id,
        route: `${b.ride.sourceAddress} to ${b.ride.destAddress}`,
        amount: Number(b.remainingFareAmount || 0),
        status: b.status,
        cashCollected: !!b.remainingFareCollectedAt,
        completedAt: b.tripCompletedAt,
        passengerId: b.passenger.id,
        passengerName: b.passenger.name,
      })),
  });
});

export default router;
