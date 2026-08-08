import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { NON_TERMINAL_BOOKING_STATUSES } from "../lib/rideLifecycle.js";

const router = Router();

// Active-trip-only: a notification tied to a booking (almost all of
// them are) only shows while that booking is still active — once it's
// completed/cancelled/expired/etc., the notification about it is no
// longer relevant and drops out of the list. Account-level notices
// (driver strikes, passenger cooldown) have no bookingId and always
// show. Nothing gets deleted here, just filtered out of what this
// endpoint returns — admin's own view of the data is untouched.
router.get("/", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const bookingIds = [...new Set(notifications.map((n) => n.bookingId).filter(Boolean))];
  const activeBookings = bookingIds.length
    ? await prisma.booking.findMany({
        where: { id: { in: bookingIds }, status: { in: NON_TERMINAL_BOOKING_STATUSES } },
        select: { id: true },
      })
    : [];
  const activeBookingIds = new Set(activeBookings.map((b) => b.id));

  const active = notifications.filter((n) => !n.bookingId || activeBookingIds.has(n.bookingId));
  res.json(active);
});

router.put("/:id/read", requireAuth, async (req, res) => {
  const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notif || notif.userId !== req.user.id) {
    return res.status(404).json({ error: "Notification not found." });
  }
  const updated = await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  });
  res.json(updated);
});

// POST /api/notifications/register-device — tolerates a missing/null
// token gracefully, since in-app notifications work regardless of
// whether push permission was granted (see plan section 11L).
router.post("/register-device", requireAuth, async (req, res) => {
  const { fcmToken } = req.body;
  await prisma.user.update({
    where: { id: req.user.id },
    data: { fcmToken: fcmToken || null },
  });
  res.json({ success: true, pushEnabled: !!fcmToken });
});

export default router;
