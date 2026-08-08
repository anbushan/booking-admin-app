import { prisma } from "./prisma.js";

// Any status that isn't a dead end for the booking — used to decide
// whether a ride still has "life" in it (another passenger still
// pending/confirmed/mid-trip) before closing the ride out entirely.
export const NON_TERMINAL_BOOKING_STATUSES = [
  "BOOKED", "AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING", "CONFIRMED", "IN_PROGRESS",
];

// Called whenever a booking on a ride reaches a terminal state (trip
// completed, stopped, or auto-cancelled for a no-show). A ride can carry
// more than one passenger's booking, so it only actually closes once
// none of them are still active — otherwise one passenger's booking
// ending shouldn't yank the ride out from under another who's still
// mid-trip (or hasn't started yet).
export async function closeRideIfNoActiveBookings(rideId, finalStatus) {
  const stillActive = await prisma.booking.findFirst({
    where: { rideId, status: { in: NON_TERMINAL_BOOKING_STATUSES } },
  });
  if (!stillActive) {
    await prisma.ride.update({ where: { id: rideId }, data: { status: finalStatus } });
  }
}
