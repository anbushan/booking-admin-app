import { prisma } from "./prisma.js";
import { sendPush } from "./fcm.js";

// The Notification row is the source of truth — it's written whether or
// not FCM push succeeds, so a user who denied push permission still sees
// every update in-app (see plan section 11L).
//
// bookingId is optional — pass it for anything about a specific trip
// (almost everything) so the notifications list can hide it once that
// booking is no longer active. Leave it out only for account-level
// notices (driver strikes, passenger cooldown) that aren't about any
// one booking and should always show.
export async function notify(userId, type, title, body, bookingId = null) {
  const record = await prisma.notification.create({
    data: { userId, type, title, body, bookingId },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.fcmToken) {
    try {
      // type/bookingId ride along as the FCM data payload — tapping
      // the OS notification reads these back out (see mobile's
      // AppSocketBridge) to land on the actual relevant screen
      // (ChatDetail, TripOtp, BookingDetail, ...) instead of just
      // opening the app to wherever it was.
      await sendPush(user.fcmToken, title, body, { type, bookingId: bookingId || "" });
      await prisma.notification.update({ where: { id: record.id }, data: { pushSent: true } });
    } catch (err) {
      // Push failing is not fatal — the in-app row already exists.
      console.error("FCM push failed, in-app notification still recorded:", err.message);
    }
  }
  // No fcmToken on file (push permission denied or never registered) —
  // in-app notification is already saved, nothing more to do.

  return record;
}
