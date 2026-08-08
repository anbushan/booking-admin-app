import { prisma } from "../lib/prisma.js";
import { notify } from "../lib/notify.js";
import { refundIfPaid } from "../lib/refunds.js";
import { getAppConfig } from "../lib/appConfig.js";
import { issueDriverStrike } from "../lib/strikes.js";
import { clearChatForBooking } from "../lib/chat.js";
import { closeRideIfNoActiveBookings } from "../lib/rideLifecycle.js";

// Runs on an interval from index.js. A driver no-show is a per-RIDE
// event — if the driver never shows up, every passenger booked on that
// ride is affected equally — so bookings are grouped by ride and the
// driver gets exactly one strike per incident, not one per passenger.
export async function checkNoShows() {
  const { noShowGraceMinutes } = await getAppConfig();
  const cutoff = new Date(Date.now() - noShowGraceMinutes * 60 * 1000);

  const overdue = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      tripStartedAt: null,
      ride: { travelDate: { lt: cutoff } },
    },
    include: { ride: true },
  });
  if (!overdue.length) return;

  const byRide = new Map();
  for (const booking of overdue) {
    if (!byRide.has(booking.rideId)) byRide.set(booking.rideId, []);
    byRide.get(booking.rideId).push(booking);
  }

  for (const [rideId, bookings] of byRide) {
    const now = new Date();
    for (const booking of bookings) {
      await prisma.$transaction([
        prisma.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED", cancelledBy: "SYSTEM", cancelReason: "NO_SHOW_DRIVER", cancelledAt: now },
        }),
        prisma.ride.update({
          where: { id: booking.rideId },
          data: { seatsAvailable: { increment: booking.seatsBooked } },
        }),
      ]);
      await clearChatForBooking(booking.id);
      await refundIfPaid(booking.id).catch((err) =>
        console.error(`Refund check failed for booking ${booking.id}:`, err.message)
      );
      await notify(booking.passengerId, "NO_SHOW_CANCELLED", "Driver didn't show up",
        "Your driver didn't arrive. Your booking was cancelled and any platform fee refunded.", booking.id);
    }

    // Without this, the ride stayed "PUBLISHED" forever after a
    // no-show — still editable/cancellable via the normal driver flow,
    // and in principle still bookable, despite the departure time
    // already having passed and every booking on it just having been
    // auto-cancelled.
    await closeRideIfNoActiveBookings(rideId, "CANCELLED");

    const driverId = bookings[0].ride.driverId;
    await issueDriverStrike(driverId, { rideId, reason: "NO_SHOW" });
    await notify(driverId, "NO_SHOW_CANCELLED", "Ride auto-cancelled — no-show",
      "Your ride was auto-cancelled because it wasn't started within the no-show grace period after departure time.", bookings[0].id);
  }

  console.log(`Auto-cancelled ${overdue.length} no-show booking(s) across ${byRide.size} ride(s).`);
}
