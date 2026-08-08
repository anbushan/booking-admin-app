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

  // Previously unguarded entirely — any authenticated user could POST any
  // bookingId/toUserId pair and it would just insert, letting anyone tank
  // or inflate a stranger's rating with a review for a trip they were
  // never on. This ties the review to the actual booking: the requester
  // must have really been the passenger or driver on it, toUserId must be
  // the *other* party on that same booking (not just any user), and the
  // trip must actually be finished — matches the only two places the
  // mobile app ever offers this (post-trip, from LiveTracking/Earnings).
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { ride: true },
  });
  if (!booking) {
    return res.status(404).json({ error: "Booking not found." });
  }
  const isPassenger = booking.passengerId === req.user.id;
  const isDriver = booking.ride.driverId === req.user.id;
  if (!isPassenger && !isDriver) {
    return res.status(403).json({ error: "You weren't part of this booking." });
  }
  const expectedToUserId = isPassenger ? booking.ride.driverId : booking.passengerId;
  if (toUserId !== expectedToUserId) {
    return res.status(400).json({ error: "You can only review the other person on this booking." });
  }
  if (booking.status !== "COMPLETED") {
    return res.status(400).json({ error: "You can only review a completed trip." });
  }
  const existing = await prisma.review.findFirst({
    where: { bookingId, fromUserId: req.user.id },
  });
  if (existing) {
    return res.status(409).json({ error: "You've already reviewed this trip." });
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
