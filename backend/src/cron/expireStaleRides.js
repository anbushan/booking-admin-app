import { prisma } from "../lib/prisma.js";
import { notify } from "../lib/notify.js";
import { clearChatForBooking } from "../lib/chat.js";
import { getAppConfig } from "../lib/appConfig.js";

// Runs on an interval from index.js. Catches a ride that just never got
// used — nobody ever booked it, or every booking on it expired/was
// rejected before the fee got paid — and so has no "no-show" story (no
// one to strike), but was otherwise sitting PUBLISHED forever with
// nothing else ever flipping its status. Any ride whose trip actually
// started (IN_PROGRESS) or where a driver no-showed a paid booking is
// already handled elsewhere (verify-otp / checkNoShows.js) and won't
// still be PUBLISHED by the time this runs.
export async function expireStaleRides() {
  const { noShowGraceMinutes } = await getAppConfig();
  const cutoff = new Date(Date.now() - noShowGraceMinutes * 60 * 1000);

  const staleRides = await prisma.ride.findMany({
    where: { status: "PUBLISHED", travelDate: { lt: cutoff } },
    include: {
      bookings: { where: { status: { in: ["BOOKED", "AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING"] } } },
    },
  });
  if (!staleRides.length) return;

  for (const ride of staleRides) {
    // Clean up any dangling request that hadn't hit its own expiry yet
    // (e.g. a ride booked minutes before its own departure time, where
    // the driver-response/payment window is still technically open even
    // though departure has already passed).
    for (const booking of ride.bookings) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "EXPIRED", expiryReason: "NO_DRIVER_RESPONSE" },
      });
      await clearChatForBooking(booking.id);
      await notify(booking.passengerId, "BOOKING_EXPIRED", "Ride no longer available",
        "This ride's departure time has passed. Search again for another ride.", booking.id);
    }
    await prisma.ride.update({ where: { id: ride.id }, data: { status: "EXPIRED" } });
  }

  console.log(`Expired ${staleRides.length} unused ride(s) past their departure time.`);
}
