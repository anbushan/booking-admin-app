import { prisma } from "./prisma.js";
import { refundIfPaid } from "./refunds.js";
import { notify } from "./notify.js";
import { clearChatForBooking } from "./chat.js";

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

// Extracted from rides.routes.js's DELETE /:id so a recurring series'
// stop action (recurringRides.routes.js) can reuse the exact same
// cancellation rules and side effects (refund/notify/chat-clear) —
// only the caller's response shape differs: DELETE /:id turns a
// `blocked` result into a 400 with an explanatory message, while
// stopping a series just skips whatever it can't cancel and leaves
// those occurrences for the driver to handle individually, same as
// this always could for a one-off ride.
//
// `ride` must already be fetched with
// `bookings: { where: { status: { in: ["BOOKED", "AWAITING_PAYMENT", "CONFIRMED"] } } }`
// included (both call sites already need that shape for their own
// checks, so this doesn't re-query for it).
export async function attemptCancelRide(ride) {
  if (ride.bookings.some((b) => b.status === "CONFIRMED")) {
    return { cancelled: false, reason: "CONFIRMED_BOOKING" };
  }

  const activeTrip = await prisma.booking.findFirst({ where: { rideId: ride.id, status: "IN_PROGRESS" } });
  if (activeTrip) {
    return { cancelled: false, reason: "TRIP_IN_PROGRESS" };
  }

  const now = new Date();
  await prisma.ride.update({ where: { id: ride.id }, data: { status: "CANCELLED" } });

  // Only BOOKED/AWAITING_PAYMENT bookings can reach here now — the guard
  // above already rejected outright if any booking was CONFIRMED — so
  // nobody being cancelled here has actually paid yet: no refund needed
  // (refundIfPaid stays a safe no-op regardless), no grace-window/strike
  // logic applies, same as a plain withdrawn request.
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

  return { cancelled: true, affectedBookings: ride.bookings.length };
}
