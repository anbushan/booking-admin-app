import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate, isNonEmptyString, isInRange } from "../lib/validate.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { bookingId, toUserId, rating, comment } = req.body;

  const errors = validate(req.body, [
    { field: "bookingId", check: isNonEmptyString, message: "Booking is required." },
    { field: "toUserId", check: isNonEmptyString, message: "Reviewed user is required." },
    { field: "rating", check: (v) => isInRange(v, 1, 5) && Number.isInteger(v), message: "Rating must be a whole number between 1 and 5." },
    { field: "comment", check: (v) => isNonEmptyString(v, 1000), message: "Comment is too long.", optional: true },
  ]);
  if (errors.length) return res.status(400).json({ errors });
  if (toUserId === req.user.id) {
    return res.status(400).json({ error: "You can't review yourself." });
  }

  const review = await prisma.review.create({
    data: { bookingId, fromUserId: req.user.id, toUserId, rating, comment },
  });

  // Recompute the reviewed user's average rating.
  const agg = await prisma.review.aggregate({
    where: { toUserId },
    _avg: { rating: true },
  });
  await prisma.user.update({
    where: { id: toUserId },
    data: { ratingAvg: agg._avg.rating || rating },
  });

  res.status(201).json(review);
});

router.get("/user/:userId", requireAuth, async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { toUserId: req.params.userId, flagged: false },
    include: { fromUser: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(reviews);
});

export default router;
