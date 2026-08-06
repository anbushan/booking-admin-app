import { prisma } from "../lib/prisma.js";
import { notify } from "../lib/notify.js";

// Runs on an interval from index.js. Redis TTL is the fast path for
// expiring an unanswered booking request or a lapsed payment window;
// this sweep is the fallback in case that event is ever missed (process
// restart mid-TTL, etc).
//
// Two cases share this exact "status + expiresAt < now -> EXPIRED,
// release seat, notify" shape: a driver never responding (BOOKED), and a
// passenger never paying the platform fee in time (AWAITING_PAYMENT).
// expiryReason is what lets the notification copy differ between them.
export async function expireStaleBookings() {
  const stale = await prisma.booking.findMany({
    where: { status: { in: ["BOOKED", "AWAITING_PAYMENT"] }, expiresAt: { lt: new Date() } },
  });

  for (const booking of stale) {
    const expiryReason = booking.status === "AWAITING_PAYMENT" ? "PAYMENT_WINDOW" : "NO_DRIVER_RESPONSE";

    await prisma.$transaction([
      prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED", expiryReason } }),
      prisma.ride.update({
        where: { id: booking.rideId },
        data: { seatsAvailable: { increment: booking.seatsBooked } },
      }),
    ]);

    if (expiryReason === "PAYMENT_WINDOW") {
      await notify(booking.passengerId, "BOOKING_EXPIRED", "You didn't pay in time",
        "Your booking request expired because the platform fee wasn't paid in time. Search again for another ride.");
    } else {
      await notify(booking.passengerId, "BOOKING_EXPIRED", "Driver didn't respond",
        "Your booking request expired. Search again for another ride.");
    }
  }

  if (stale.length) console.log(`Expired ${stale.length} stale booking(s).`);
}
