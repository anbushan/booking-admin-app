import { prisma } from "../lib/prisma.js";
import { notify } from "../lib/notify.js";

// Runs on an interval from index.js. Redis TTL is the fast path for
// expiring an unanswered booking request; this sweep is the fallback
// in case that event is ever missed (process restart mid-TTL, etc).
export async function expireStaleBookings() {
  const stale = await prisma.booking.findMany({
    where: { status: "BOOKED", expiresAt: { lt: new Date() } },
  });

  for (const booking of stale) {
    await prisma.$transaction([
      prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } }),
      prisma.ride.update({
        where: { id: booking.rideId },
        data: { seatsAvailable: { increment: booking.seatsBooked } },
      }),
    ]);
    await notify(booking.passengerId, "BOOKING_EXPIRED", "Driver didn't respond",
      "Your booking request expired. Search again for another ride.");
  }

  if (stale.length) console.log(`Expired ${stale.length} stale booking(s).`);
}
