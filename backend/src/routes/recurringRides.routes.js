import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getAppConfig } from "../lib/appConfig.js";
import { isDriverStrikeBlocked } from "../lib/strikes.js";
import { attemptCancelRide } from "../lib/rideLifecycle.js";
import { isWithinIndia } from "../lib/geo.js";
import { validate, isLat, isLng, isNonEmptyString, isPositiveInt, isPositiveNumber, isValidDate } from "../lib/validate.js";
import { computeFareCap } from "../lib/fareCap.js";
import { generateOccurrencesForTemplate } from "../lib/recurringRides.js";

const router = Router();

const DEPARTURE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidDaysOfWeek(value) {
  return Array.isArray(value) && value.length > 0 && value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

function isTodayOrLater(value) {
  if (!isValidDate(value)) return false;
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

// POST /api/recurring-rides — driver sets up a repeating series. Same
// validation as rides.routes.js POST / (geofence, vehicle ownership/
// capacity, fare cap, strike block) — a recurring series is really just
// "publish this same ride over and over," so it has to clear the exact
// same bar a one-off publish does.
router.post("/", requireAuth, requireRole("DRIVER"), async (req, res) => {
  if (isDriverStrikeBlocked(req.user)) {
    return res.status(403).json({ error: "Your account is temporarily blocked from publishing new rides." });
  }

  const {
    sourceLat, sourceLng, sourceAddress,
    destLat, destLng, destAddress,
    departureTime, seatsAvailable, pricePerSeat,
    maxDetourKm, preferences, vehicleId,
    daysOfWeek, startDate, endDate,
    routePolyline, routeStops, routeDistanceKm, routeDurationMinutes,
  } = req.body;

  const errors = validate(req.body, [
    { field: "sourceLat", check: isLat, message: "Source location is invalid." },
    { field: "sourceLng", check: isLng, message: "Source location is invalid." },
    { field: "sourceAddress", check: (v) => isNonEmptyString(v, 300), message: "Source address is required." },
    { field: "destLat", check: isLat, message: "Destination location is invalid." },
    { field: "destLng", check: isLng, message: "Destination location is invalid." },
    { field: "destAddress", check: (v) => isNonEmptyString(v, 300), message: "Destination address is required." },
    { field: "departureTime", check: (v) => DEPARTURE_TIME_PATTERN.test(v), message: "Enter a valid departure time." },
    { field: "seatsAvailable", check: (v) => isPositiveInt(v) && v <= 8, message: "Seats must be between 1 and 8." },
    { field: "pricePerSeat", check: isPositiveNumber, message: "Price per seat must be greater than 0." },
    { field: "maxDetourKm", check: (v) => isPositiveNumber(v) && v <= 20, message: "Max detour must be between 0 and 20 km.", optional: true },
    { field: "daysOfWeek", check: isValidDaysOfWeek, message: "Pick at least one day this ride repeats on." },
    { field: "startDate", check: isTodayOrLater, message: "Start date can't be in the past." },
    { field: "endDate", check: (v) => isValidDate(v) && new Date(v) > new Date(startDate), message: "End date must be after the start date.", optional: true },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const [sourceInIndia, destInIndia] = await Promise.all([
    isWithinIndia(sourceLat, sourceLng),
    isWithinIndia(destLat, destLng),
  ]);
  if (!sourceInIndia || !destInIndia) {
    return res.status(400).json({ error: "Rides are only available within India right now." });
  }

  // Same vehicle-resolution rule as a one-off publish — see
  // rides.routes.js POST / for the identical reasoning (verification is
  // a trust badge, not a publish gate).
  const vehicles = await prisma.vehicle.findMany({ where: { driverId: req.user.id } });
  if (!vehicles.length) {
    return res.status(400).json({ error: "Add a vehicle before setting up a recurring ride." });
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

  const config = await getAppConfig();
  const fareCap = computeFareCap(sourceLat, sourceLng, destLat, destLng, config.fareCapPerKmInr, routeDistanceKm);
  if (Number(pricePerSeat) > fareCap) {
    return res.status(400).json({
      error: `Price per seat can't exceed Rs ${fareCap} for this distance — this keeps the ride classified as cost-sharing rather than a commercial fare.`,
      fareCap,
    });
  }

  const template = await prisma.recurringRideTemplate.create({
    data: {
      driverId: req.user.id,
      vehicleId: vehicle.id,
      sourceLat, sourceLng, sourceAddress,
      destLat, destLng, destAddress,
      ...(routePolyline && { routePolyline }),
      ...(routeStops && { routeStops }),
      ...(routeDistanceKm != null && { routeDistanceKm }),
      ...(routeDurationMinutes != null && { routeDurationMinutes }),
      departureTime,
      seatsAvailable,
      pricePerSeat,
      maxDetourKm: maxDetourKm ?? config.defaultMaxDetourKm,
      preferences: preferences || {},
      daysOfWeek,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
  });

  // Generated once, synchronously, right here — so the driver sees
  // tomorrow's (or today's) occurrence appear immediately instead of
  // waiting for the next hourly cron tick.
  const { created } = await generateOccurrencesForTemplate(template);

  res.status(201).json({ template, ridesGenerated: created });
});

// GET /api/recurring-rides — driver's own series, each with a small
// preview of upcoming generated occurrences so the management screen
// doesn't need a second round trip per template.
router.get("/", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const templates = await prisma.recurringRideTemplate.findMany({
    where: { driverId: req.user.id },
    orderBy: { createdAt: "desc" },
  });

  const withUpcoming = await Promise.all(
    templates.map(async (template) => {
      const upcoming = await prisma.ride.findMany({
        where: { recurringTemplateId: template.id, status: "PUBLISHED", travelDate: { gte: new Date() } },
        orderBy: { travelDate: "asc" },
        take: 5,
        select: { id: true, travelDate: true, seatsAvailable: true },
      });
      return { ...template, upcoming };
    })
  );

  res.json(withUpcoming);
});

// PATCH /api/recurring-rides/:id — pause/resume only for v1. Editing
// price/seats/preferences mid-series is a natural follow-up but adds
// real complexity (does an edit touch already-generated future rides,
// or only new ones?) — deliberately left out rather than built halfway.
router.patch("/:id", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const { active } = req.body;
  if (typeof active !== "boolean") {
    return res.status(400).json({ error: "Nothing to update." });
  }
  const template = await prisma.recurringRideTemplate.findUnique({ where: { id: req.params.id } });
  if (!template || template.driverId !== req.user.id) {
    return res.status(404).json({ error: "Recurring ride not found." });
  }

  const updated = await prisma.recurringRideTemplate.update({ where: { id: template.id }, data: { active } });

  // Resuming immediately backfills the rolling window rather than
  // waiting for the next hourly tick — same reasoning as the
  // synchronous generation on create above.
  let ridesGenerated = 0;
  if (active) {
    ({ created: ridesGenerated } = await generateOccurrencesForTemplate(updated));
  }

  res.json({ template: updated, ridesGenerated });
});

// DELETE /api/recurring-rides/:id — stops the series for good (no
// resuming a stopped one — that's what PATCH active:false/true is for)
// and cancels whatever future, not-yet-CONFIRMED occurrences it already
// generated, reusing the exact same cancellation rules/side effects a
// one-off ride's own DELETE /api/rides/:id uses (see
// lib/rideLifecycle.js attemptCancelRide). A future occurrence that
// already has a paying passenger is left for the driver to handle
// individually via Edit ride — same as it already would be for a
// one-off ride with a CONFIRMED booking.
router.delete("/:id", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const template = await prisma.recurringRideTemplate.findUnique({ where: { id: req.params.id } });
  if (!template || template.driverId !== req.user.id) {
    return res.status(404).json({ error: "Recurring ride not found." });
  }

  await prisma.recurringRideTemplate.update({ where: { id: template.id }, data: { active: false } });

  const futureRides = await prisma.ride.findMany({
    where: { recurringTemplateId: template.id, status: "PUBLISHED", travelDate: { gte: new Date() } },
    include: { bookings: { where: { status: { in: ["BOOKED", "AWAITING_PAYMENT", "CONFIRMED"] } } } },
  });

  let cancelled = 0;
  let left = 0;
  for (const ride of futureRides) {
    const result = await attemptCancelRide(ride);
    if (result.cancelled) cancelled++;
    else left++;
  }

  res.json({ success: true, cancelledRides: cancelled, leftForDriver: left });
});

export default router;
