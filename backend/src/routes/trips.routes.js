import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { notify } from "../lib/notify.js";
import { sendSmsViaMsg91 } from "../lib/msg91.js";
import { validate, isLat, isLng } from "../lib/validate.js";

const router = Router();

function generateTripOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// POST /api/trips/:bookingId/start — driver initiates, generates an OTP
// the passenger reads aloud (not sent by SMS — see plan section on Rapido
// architecture notes; showing it in-app avoids depending on SMS delivery
// at a possibly low-signal pickup point).
router.post("/:bookingId/start", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.status !== "CONFIRMED") {
    return res.status(400).json({ error: "Booking must be confirmed before starting the trip." });
  }

  const tripOtp = generateTripOtp();
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { tripOtp },
  });

  await notify(booking.passengerId, "DRIVER_ARRIVED", "Your driver has arrived",
    "Share the pickup code shown in the app to start your trip.");

  res.json({ bookingId: updated.id }); // OTP itself goes to the passenger's own screen, not this response
});

// POST /api/trips/:bookingId/verify-otp — driver enters what passenger read aloud
router.post("/:bookingId/verify-otp", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const { otp } = req.body;
  if (!/^\d{4,6}$/.test(otp || "")) {
    return res.status(400).json({ error: "Enter a valid code." });
  }
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  if (booking.tripOtp !== otp) {
    return res.status(400).json({ error: "Incorrect code." });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "IN_PROGRESS", otpVerifiedAt: new Date(), tripStartedAt: new Date() },
  });

  res.json(updated);
});

// PUT /api/trips/:bookingId/location — periodic GPS ping from the driver app
router.put("/:bookingId/location", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const { lat, lng } = req.body;
  if (!isLat(lat) || !isLng(lng)) {
    return res.status(400).json({ error: "Invalid coordinates." });
  }
  const updated = await prisma.booking.update({
    where: { id: req.params.bookingId },
    data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
  });
  res.json({ success: true, lastLocationAt: updated.lastLocationAt });
});

// GET /api/trips/:bookingId/track — passenger polls this; client computes
// "reconnecting" state itself if lastLocationAt is more than ~90s old.
router.get("/:bookingId/track", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found." });

  res.json({
    lat: booking.lastLat,
    lng: booking.lastLng,
    lastLocationAt: booking.lastLocationAt,
    status: booking.status,
    // Included so the passenger's client can navigate straight to
    // PaymentScreen with the right amount the moment status flips to
    // CHARGE_ATTEMPTED, without a second round trip.
    amount: Number(booking.ride.pricePerSeat) * booking.seatsBooked,
  });
});

// POST /api/trips/:bookingId/complete — triggers the (post-trip) charge
// attempt; actual Razorpay call lives in payments.routes.js and is
// invoked from here.
router.post("/:bookingId/complete", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
    include: { ride: true },
  });
  if (!booking || booking.ride.driverId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CHARGE_ATTEMPTED", tripCompletedAt: new Date() },
  });

  // See payments.routes.js — /api/payments/:bookingId/charge is called
  // by the client immediately after this, or triggered server-side here
  // via a direct function call once the Razorpay order flow is wired up.

  res.json(updated);
});

// POST /api/trips/:bookingId/sos
router.post("/:bookingId/sos", requireAuth, async (req, res) => {
  const { lat, lng } = req.body;
  if (!isLat(lat) || !isLng(lng)) {
    return res.status(400).json({ error: "Invalid coordinates." });
  }
  const contacts = await prisma.emergencyContact.findMany({ where: { userId: req.user.id } });

  const alert = await prisma.sosAlert.create({
    data: {
      bookingId: req.params.bookingId,
      triggeredBy: req.user.id,
      lat, lng,
      contactedIds: contacts.map((c) => c.id),
    },
  });

  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
  const results = await Promise.allSettled(
    contacts.map((contact) =>
      sendSmsViaMsg91(contact.phone, process.env.MSG91_SOS_TEMPLATE_ID, {
        VAR1: req.user.name || "Someone",
        VAR2: mapsLink,
      })
    )
  );
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length) {
    console.error(`SOS alert ${alert.id}: ${failures.length} contact SMS send(s) failed.`);
  }

  res.json({ success: true, alertId: alert.id, contactsNotified: contacts.length - failures.length });
});

// GET /api/trips/:bookingId/otp — passenger's own screen reads the code
// generated when the driver tapped "Start trip". Scoped to the booking's
// own passenger so nobody else can read it.
router.get("/:bookingId/otp", requireAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.bookingId } });
  if (!booking || booking.passengerId !== req.user.id) {
    return res.status(404).json({ error: "Booking not found." });
  }
  res.json({ otp: booking.tripOtp });
});

export default router;
