import { prisma } from "../lib/prisma.js";
import { notify } from "../lib/notify.js";
import { clearChatForBooking } from "../lib/chat.js";
import { mapLimit } from "../lib/concurrency.js";
import { releaseSeatHold } from "../lib/segments.js";

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

  // Each stale booking is independent of every other, so they're worked
  // off in parallel rather than one at a time — bounded (see
  // lib/concurrency.js) since this is a fallback sweep and the stale set
  // can spike after a real outage, not just its usual trickle.
  await mapLimit(stale, 8, async (booking) => {
    const expiryReason = booking.status === "AWAITING_PAYMENT" ? "PAYMENT_WINDOW" : "NO_DRIVER_RESPONSE";

    await prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED", expiryReason } });
    await releaseSeatHold(booking.rideId, booking.seatsBooked);
    await clearChatForBooking(booking.id);

    if (expiryReason === "PAYMENT_WINDOW") {
      await notify(booking.passengerId, "BOOKING_EXPIRED", "You didn't pay in time",
        "Your booking request expired because the platform fee wasn't paid in time. Search again for another ride.", booking.id);
    } else {
      await notify(booking.passengerId, "BOOKING_EXPIRED", "Driver didn't respond",
        "Your booking request expired. Search again for another ride.", booking.id);
    }
  });

  if (stale.length) console.log(`Expired ${stale.length} stale booking(s).`);
}
