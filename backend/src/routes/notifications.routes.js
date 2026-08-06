import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications);
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
