import { prisma } from "./prisma.js";
import { notify } from "./notify.js";
import { getAppConfig } from "./appConfig.js";

// Call whenever a driver does something strike-worthy: a late cancel
// (past the grace window) or a no-show. Records the incident, then
// re-evaluates the driver's rolling-window strike count against the
// admin-configured tiers and notifies/blocks as needed.
//
// Strike count is a count() query over DriverStrike rows in the rolling
// window, not a counter column on User — that way changing
// strikeRollingWindowDays in AppConfig re-evaluates correctly for
// existing strikes instead of needing a backfill.
export async function issueDriverStrike(driverId, { bookingId, rideId, reason }) {
  const config = await getAppConfig();

  await prisma.driverStrike.create({
    data: { driverId, bookingId: bookingId || null, rideId: rideId || null, reason },
  });

  const rollingCutoff = new Date(Date.now() - config.strikeRollingWindowDays * 24 * 60 * 60 * 1000);
  const count = await prisma.driverStrike.count({
    where: { driverId, createdAt: { gte: rollingCutoff } },
  });

  if (count === config.strikeBlockThreshold) {
    const blockedUntil = new Date(Date.now() + config.strikeBlockDays * 24 * 60 * 60 * 1000);
    await prisma.user.update({ where: { id: driverId }, data: { strikeBlockedUntil: blockedUntil } });
    await notify(driverId, "DRIVER_STRIKE_BLOCKED", "Account temporarily blocked",
      `Repeated cancellations/no-shows have blocked your account for ${config.strikeBlockDays} day(s). It lifts automatically.`);
  } else if (count === config.strikeFinalWarningThreshold) {
    await prisma.user.update({ where: { id: driverId }, data: { strikeFlagged: true } });
    await notify(driverId, "DRIVER_STRIKE_FINAL_WARNING", "Final warning",
      "You're close to a temporary account block due to repeated cancellations/no-shows. Please honor accepted bookings.");
  } else if (count === config.strikeWarningThreshold) {
    await notify(driverId, "DRIVER_STRIKE_WARNING", "Cancellation warning",
      "Repeated late cancellations/no-shows can lead to a temporary account block. Please honor accepted bookings.");
  }

  return count;
}

// Shared guard for any route that requires the driver to be in good
// standing (accepting a booking, publishing a ride). A plain timestamp
// comparison means the block auto-lifts with no separate unblock job.
export function isDriverStrikeBlocked(user) {
  return !!(user.strikeBlockedUntil && new Date(user.strikeBlockedUntil) > new Date());
}
