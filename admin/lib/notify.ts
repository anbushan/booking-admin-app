import { prisma } from "./prisma";
import { sendPush } from "./fcm";

// Mirrors backend/src/lib/notify.js's "the Notification row is the
// source of truth" rule — written whether or not push succeeds, so a
// user who denied push permission (or push just isn't configured
// right for them) still sees it in-app. Admin actions that need to
// tell a user something (a vehicle got approved, a promo broadcast)
// use this instead of calling sendPush directly.
export async function notify(userId: string, type: string, title: string, body: string, bookingId: string | null = null) {
  const record = await prisma.notification.create({
    data: { userId, type, title, body, bookingId },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.fcmToken) {
    try {
      await sendPush(user.fcmToken, title, body, { type, bookingId: bookingId || "" });
      await prisma.notification.update({ where: { id: record.id }, data: { pushSent: true } });
    } catch (err: any) {
      console.error("Admin push failed, in-app notification still recorded:", err.message);
    }
  }

  return record;
}
