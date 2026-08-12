import { prisma } from "./prisma.js";

// Segment-aware (interval) seat allocation — the BlaBlaCar-style model
// where a single physical seat can be sold to several different
// passengers across one ride, as long as their pickup->drop stretches
// never overlap in space. Contrast with the old model (still used for
// every ride published before this shipped): one flat seatsAvailable
// counter, decremented per booking regardless of how much of the route
// that passenger actually rides.
//
// A ride opts into this model by having `totalSeats` set (done once, at
// publish time — see rides.routes.js POST /). `totalSeats == null` means
// "this ride predates segment-aware booking, keep the old flat-pool
// behavior forever" — every call site in this file and its callers
// branches on that before doing anything interval-based, so a ride's
// behavior never silently changes after the fact.

// Statuses that actually hold a seat right now. Deliberately the same
// set the mobile app's own ACTIVE_STATUSES/IN_FLIGHT_BOOKING_STATUSES
// lists already use (HistoryScreen.tsx, MyRequestsScreen.tsx) — a
// booking still needs to count against capacity from the moment it's
// requested (BOOKED), not just once paid, or two passengers could both
// be accepted onto the same already-full segment during the accept
// window.
export const SEAT_HOLDING_STATUSES = [
  "BOOKED",
  "AWAITING_PAYMENT",
  "CHARGE_ATTEMPTED",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
];

// Pure math, no DB — kept separate so it's cheaply unit-testable.
// `intervals` is [{ start, end, seats }, ...] for every OTHER booking
// already holding a seat on this ride. Returns the minimum number of
// free seats across the whole [requestStart, requestEnd) stretch — i.e.
// the bottleneck sub-segment, since a request has to fit everywhere it
// passes through, not just on average.
//
// Sampling at the midpoint of each breakpoint-bounded sub-interval
// (rather than checking every existing interval's endpoints directly
// against the request) means it doesn't matter how many other bookings
// overlap in how many different ways — this always finds the true worst
// point without a combinatorial case analysis.
export function computeAvailability(capacity, intervals, requestStart, requestEnd) {
  if (requestEnd <= requestStart) return capacity; // zero-length request, nothing to check

  const breakpoints = new Set([requestStart, requestEnd]);
  for (const iv of intervals) {
    if (iv.start > requestStart && iv.start < requestEnd) breakpoints.add(iv.start);
    if (iv.end > requestStart && iv.end < requestEnd) breakpoints.add(iv.end);
  }
  const sorted = [...breakpoints].sort((a, b) => a - b);

  let minAvailable = capacity;
  for (let i = 0; i < sorted.length - 1; i++) {
    const mid = (sorted[i] + sorted[i + 1]) / 2;
    const occupied = intervals.reduce((sum, iv) => (iv.start <= mid && mid < iv.end ? sum + iv.seats : sum), 0);
    minAvailable = Math.min(minAvailable, capacity - occupied);
  }
  return minAvailable;
}

// A booking's own interval on the ride's route, in km-from-source. Falls
// back to "occupies the whole route" whenever the specific projection is
// missing — a booking made before this feature existed, a custom point
// Directions couldn't project, or a ride with no stored polyline at all.
// Deliberately conservative: better to under-sell capacity on an
// ambiguous booking than to double-book a segment.
export function resolveInterval(ride, booking) {
  const routeEnd = ride.routeDistanceKm ?? Infinity;
  const start = booking.pickupProgressKm ?? 0;
  const end = booking.dropProgressKm ?? routeEnd;
  return { start, end };
}

async function getHoldingBookings(rideId, excludeBookingId) {
  return prisma.booking.findMany({
    where: {
      rideId,
      status: { in: SEAT_HOLDING_STATUSES },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { id: true, seatsBooked: true, pickupProgressKm: true, dropProgressKm: true },
  });
}

// How many seats are free across [pickupKm, dropKm) on this ride right
// now, accounting for every other currently-active booking's own
// interval — not just a flat count. Only meaningful for a ride with
// totalSeats set; callers are expected to have already branched on that.
export async function availableSeatsForInterval(ride, pickupKm, dropKm, excludeBookingId) {
  const holding = await getHoldingBookings(ride.id, excludeBookingId);
  const intervals = holding.map((b) => ({ ...resolveInterval(ride, b), seats: b.seatsBooked }));
  return computeAvailability(ride.totalSeats, intervals, pickupKm, dropKm ?? ride.routeDistanceKm ?? Infinity);
}

// Refreshes the ride's own seatsAvailable to the bottleneck figure across
// its ENTIRE route — this is what search results / ride details / the
// driver's own booking list keep reading via the same field name they
// always have, so none of them needed to change to show a real,
// segment-aware number instead of a flat one. Called after every booking
// create/cancel/reject/expire on a totalSeats-having ride (see call
// sites in bookings.routes.js/trips.routes.js/cron).
export async function recomputeRideSeatsAvailable(rideId) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride || ride.totalSeats == null) return; // legacy ride — flat increment/decrement handles it, not this
  const available = await availableSeatsForInterval(ride, 0, ride.routeDistanceKm ?? Infinity);
  await prisma.ride.update({ where: { id: rideId }, data: { seatsAvailable: Math.max(0, available) } });
}

// Single call every reject/cancel/expire path uses to give a booking's
// seat(s) back — branches the same way booking-create does, so callers
// don't each need their own totalSeats check. A booking's own status has
// already been flipped to a non-holding one (REJECTED/CANCELLED/EXPIRED)
// by the time this runs, so recomputeRideSeatsAvailable naturally excludes
// it from the next capacity read without needing to be told which
// booking just freed up.
export async function releaseSeatHold(rideId, seatsBooked) {
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride) return;
  if (ride.totalSeats == null) {
    await prisma.ride.update({ where: { id: rideId }, data: { seatsAvailable: { increment: seatsBooked } } });
  } else {
    await recomputeRideSeatsAvailable(rideId);
  }
}

// The most seats committed at any single point along the route right
// now — what a driver editing seatsAvailable downward on an already-
// booked ride isn't allowed to go below (rides.routes.js PUT /:id).
// Computed independently of ride.totalSeats (an arbitrarily large
// stand-in capacity, then inverted) so it stays correct even while the
// caller is in the middle of deciding what the new totalSeats should be.
export async function peakOccupancy(ride) {
  const holding = await getHoldingBookings(ride.id);
  const intervals = holding.map((b) => ({ ...resolveInterval(ride, b), seats: b.seatsBooked }));
  const routeEnd = ride.routeDistanceKm ?? Infinity;
  const STAND_IN_CAPACITY = 1000;
  return STAND_IN_CAPACITY - computeAvailability(STAND_IN_CAPACITY, intervals, 0, routeEnd);
}

// A short hop rounding down to a handful of rupees doesn't cover a
// driver's own time/fuel to make the stop worthwhile, and reads as
// "basically free" to a passenger in a way that feels like a bug, not a
// deal. Same role as a minimum-fare floor on any per-km pricing model.
const MIN_SEGMENT_FARE_INR = 10;

// What a specific passenger actually owes per seat for THEIR segment,
// not the ride's full-route price — ride.pricePerSeat was always set by
// the driver for the whole A->B trip; someone riding a fraction of it
// pays that same fraction (floored at MIN_SEGMENT_FARE_INR), never the
// full amount. Falls back to the full pricePerSeat whenever a segment
// can't be determined (no stored route, or this booking predates
// pickupProgressKm/dropProgressKm existing) — exactly the old behavior,
// unchanged, for anything segment-aware booking doesn't yet cover.
export function proratedFarePerSeat(ride, pickupProgressKm, dropProgressKm) {
  const fullFare = Number(ride.pricePerSeat);
  if (pickupProgressKm == null || dropProgressKm == null || !ride.routeDistanceKm) return fullFare;
  const segmentKm = dropProgressKm - pickupProgressKm;
  if (segmentKm <= 0) return fullFare;
  const prorated = fullFare * (segmentKm / ride.routeDistanceKm);
  return Math.max(Math.round(prorated), Math.min(MIN_SEGMENT_FARE_INR, fullFare));
}
