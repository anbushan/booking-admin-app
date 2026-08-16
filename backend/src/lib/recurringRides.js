import { prisma } from "./prisma.js";
import { isDriverStrikeBlocked } from "./strikes.js";

// Matches SearchOptionsModal.tsx's own DAYS_AHEAD exactly — a recurring
// ride should be searchable exactly as far out as the date picker lets
// a passenger look, no further and no less. Re-run on every generation
// tick (see cron/generateRecurringRides.js), which keeps this a rolling
// window rather than a one-time batch: each tick tops it back up to 14
// days out as today's date moves forward.
const GENERATION_HORIZON_DAYS = 14;

function combineDateAndTime(date, hhmm) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
}

// Generates whatever occurrences of one template are missing from the
// rolling window, and only those — safe to call repeatedly (on every
// cron tick, and once synchronously right after a template is created)
// without ever creating a duplicate for a date that's already been
// generated.
export async function generateOccurrencesForTemplate(template) {
  // Same gate POST /rides applies to a one-off publish — a
  // strike-blocked driver shouldn't have new rides appearing on their
  // behalf just because a recurring series is still ticking along.
  const driver = await prisma.user.findUnique({
    where: { id: template.driverId },
    select: { strikeBlockedUntil: true },
  });
  if (driver && isDriverStrikeBlocked(driver)) return { created: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(template.startDate);
  start.setHours(0, 0, 0, 0);
  const end = template.endDate ? new Date(template.endDate) : null;
  if (end) end.setHours(23, 59, 59, 999);

  const candidateTravelDates = [];
  for (let i = 0; i < GENERATION_HORIZON_DAYS; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() + i);
    if (day < start) continue;
    if (end && day > end) continue;
    if (!template.daysOfWeek.includes(day.getDay())) continue;
    const travelDate = combineDateAndTime(day, template.departureTime);
    // Never generate an occurrence whose departure time has already
    // passed today — that would create an unbookable, already-past ride
    // sitting in the driver's history for no reason.
    if (travelDate <= new Date()) continue;
    candidateTravelDates.push(travelDate);
  }
  if (!candidateTravelDates.length) return { created: 0 };

  // Checked regardless of the existing row's status (PUBLISHED,
  // CANCELLED, whatever) — this is the whole correctness point of the
  // feature: if the driver cancelled just this one occurrence via the
  // normal single-ride cancel flow, a Ride row for that exact date
  // still exists (just CANCELLED), so it's correctly skipped here
  // rather than silently recreated on the next tick.
  const existing = await prisma.ride.findMany({
    where: { recurringTemplateId: template.id, travelDate: { in: candidateTravelDates } },
    select: { travelDate: true },
  });
  const existingTimes = new Set(existing.map((r) => r.travelDate.getTime()));

  let created = 0;
  for (const travelDate of candidateTravelDates) {
    if (existingTimes.has(travelDate.getTime())) continue;

    // Same "no second ride at the exact same time" rule POST /rides
    // already enforces for a one-off publish — a driver could otherwise
    // end up with a manually-published ride clashing with a
    // series-generated one.
    const clash = await prisma.ride.findFirst({
      where: { driverId: template.driverId, status: "PUBLISHED", travelDate },
    });
    if (clash) continue;

    await prisma.ride.create({
      data: {
        driverId: template.driverId,
        vehicleId: template.vehicleId,
        sourceLat: template.sourceLat, sourceLng: template.sourceLng, sourceAddress: template.sourceAddress,
        destLat: template.destLat, destLng: template.destLng, destAddress: template.destAddress,
        ...(template.routePolyline && { routePolyline: template.routePolyline }),
        ...(template.routeStops && { routeStops: template.routeStops }),
        ...(template.routeDistanceKm != null && { routeDistanceKm: template.routeDistanceKm }),
        ...(template.routeDurationMinutes != null && { routeDurationMinutes: template.routeDurationMinutes }),
        travelDate,
        seatsAvailable: template.seatsAvailable,
        totalSeats: template.seatsAvailable,
        pricePerSeat: template.pricePerSeat,
        maxDetourKm: template.maxDetourKm,
        preferences: template.preferences,
        recurringTemplateId: template.id,
      },
    });
    created++;
  }
  return { created };
}

// Called from the cron job (roughly hourly, see index.js) for every
// active template. Each template is wrapped in its own try/catch so
// one broken/edge-case template (a deleted vehicle, a malformed
// daysOfWeek from some future migration bug) can't take the whole job
// down and stop every other driver's series from generating.
export async function generateAllActiveRecurringRides() {
  const templates = await prisma.recurringRideTemplate.findMany({ where: { active: true } });
  let ridesCreated = 0;
  for (const template of templates) {
    try {
      const { created } = await generateOccurrencesForTemplate(template);
      ridesCreated += created;
    } catch (err) {
      console.error(`Recurring ride generation failed for template ${template.id}:`, err.message);
    }
  }
  return { templatesProcessed: templates.length, ridesCreated };
}
