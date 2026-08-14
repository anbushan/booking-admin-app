import { Router } from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate, isNonEmptyString, isEmail, isOneOf } from "../lib/validate.js";
import { serializeUser } from "../lib/serializeUser.js";
import { r2, R2_BUCKET } from "../lib/r2.js";
import { photoViewUrl } from "../lib/photo.js";

const router = Router();
const UPLOAD_URL_TTL_SECONDS = 600; // 10 min

// PUT /api/users/me — completes registration (name/email/role) after
// first-time OTP verification.
router.put("/me", requireAuth, async (req, res) => {
  const { name, email, role, whatsappOptIn } = req.body;

  const errors = validate(req.body, [
    { field: "name", check: (v) => isNonEmptyString(v, 100), message: "Name is required." },
    { field: "email", check: isEmail, message: "Enter a valid email address.", optional: true },
    { field: "role", check: (v) => isOneOf(v, ["DRIVER", "PASSENGER"]), message: "Role must be DRIVER or PASSENGER." },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      name,
      email,
      role,
      isDriver: role === "DRIVER" ? true : req.user.isDriver,
      isPassenger: role === "PASSENGER" ? true : req.user.isPassenger,
      // Left untouched (keeps whatever it already was) when the caller
      // doesn't send it at all, rather than silently resetting consent
      // to false on every unrelated profile edit — only actually
      // updated when explicitly present in the request body.
      ...(whatsappOptIn === undefined ? {} : { whatsappOptIn: !!whatsappOptIn }),
    },
  });
  res.json(serializeUser(updated));
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({ ...serializeUser(req.user), photoViewUrl: await photoViewUrl(req.user.photoR2Key) });
});

// POST /api/users/me/photo-upload-url — same private-bucket pattern as
// documents.routes.js: the client PUTs bytes straight to R2 using the
// signed URL this returns. Saves photoR2Key onto the user immediately
// (not after a separate "confirm" step) — same eager-write convention
// documents.routes.js already uses, since a failed upload just means
// the old photo (or none) keeps showing until they retry.
router.post("/me/photo-upload-url", requireAuth, async (req, res) => {
  const r2Key = `${req.user.id}/profile-photo-${Date.now()}`;
  const command = new PutObjectCommand({ Bucket: R2_BUCKET, Key: r2Key });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });

  await prisma.user.update({ where: { id: req.user.id }, data: { photoR2Key: r2Key } });

  res.json({ r2Key, uploadUrl });
});

// PUT /api/users/me/role — switches which profile (driver/passenger) is
// active on this account, or activates the other one for the first time
// if this phone hasn't used it before. Deliberately not a new JWT/login —
// requireAuth always re-reads role from the DB on every request (see
// middleware/auth.js), so flipping this column is the entire effect; the
// client just needs to know to re-fetch the profile and re-route into
// the right home screen afterward.
router.put("/me/role", requireAuth, async (req, res) => {
  const { role } = req.body;
  const errors = validate(req.body, [
    { field: "role", check: (v) => isOneOf(v, ["DRIVER", "PASSENGER"]), message: "Role must be DRIVER or PASSENGER." },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      role,
      isDriver: role === "DRIVER" ? true : req.user.isDriver,
      isPassenger: role === "PASSENGER" ? true : req.user.isPassenger,
    },
  });
  res.json(serializeUser(updated));
});

// Bookings/rides/refunds in a state where deleting the account out from
// under them would leave the other party stranded (a driver mid-trip, a
// payment mid-refund, a request no one will ever accept/reject) — shared
// by the eligibility check and the delete endpoint itself, since the
// delete endpoint re-checks server-side rather than trusting whatever
// the client saw a moment earlier.
const ACTIVE_BOOKING_STATUSES = ["BOOKED", "AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING", "CONFIRMED", "IN_PROGRESS"];
const ACTIVE_RIDE_STATUSES = ["PUBLISHED", "IN_PROGRESS"];
const ACTIVE_REFUND_STATUSES = ["INITIATED", "PROCESSING"];

async function findDeletionBlockers(userId) {
  const blockers = [];

  const activeBookingCount = await prisma.booking.count({
    where: { passengerId: userId, status: { in: ACTIVE_BOOKING_STATUSES } },
  });
  if (activeBookingCount > 0) {
    blockers.push(
      activeBookingCount === 1
        ? "You have an active booking. Cancel or complete it first."
        : `You have ${activeBookingCount} active bookings. Cancel or complete them first.`
    );
  }

  const activeRideCount = await prisma.ride.count({
    where: { driverId: userId, status: { in: ACTIVE_RIDE_STATUSES } },
  });
  if (activeRideCount > 0) {
    blockers.push(
      activeRideCount === 1
        ? "You have a published or in-progress ride. Cancel or complete it first."
        : `You have ${activeRideCount} published or in-progress rides. Cancel or complete them first.`
    );
  }

  const activeRefundCount = await prisma.refund.count({
    where: { status: { in: ACTIVE_REFUND_STATUSES }, booking: { passengerId: userId } },
  });
  if (activeRefundCount > 0) {
    blockers.push("A refund to you is still processing. Please wait for it to complete first.");
  }

  return blockers;
}

// GET /api/users/me/deletion-check — lets the app show exactly what's
// blocking deletion (if anything) before the user commits to the
// confirm screen, instead of only finding out after tapping delete.
router.get("/me/deletion-check", requireAuth, async (req, res) => {
  const blockers = await findDeletionBlockers(req.user.id);
  res.json({ canDelete: blockers.length === 0, blockers });
});

// DELETE /api/users/me — self-service account deletion. Soft-delete,
// not a real row drop: other users' ride/booking/rating history
// references this row (see schema.prisma's deletedAt comment), so
// hard-deleting would either cascade-wipe their history or fail on the
// foreign keys. Blocks login the same way an admin-disabled account
// already does (disabled=true, checked in middleware/auth.js and at
// login in auth.routes.js), and scrubs the PII this account directly
// owns — historical trip/rating records tied to *other* users keep
// existing, just without anything left here that identifies who this
// was.
router.delete("/me", requireAuth, async (req, res) => {
  const blockers = await findDeletionBlockers(req.user.id);
  if (blockers.length > 0) {
    return res.status(409).json({ error: "Account can't be deleted yet.", blockers });
  }

  // A paid Eko verification check (license/RC/Aadhaar) leaves the most
  // sensitive PII this app ever holds — full name, DOB, address, and
  // (for Aadhaar) a government ID number — sitting in a *Json column,
  // which the general field-by-field scrub above doesn't touch. None of
  // it is referenced by anything else (unlike Vehicle/Ride/Booking,
  // which other users' trip history depends on), so it's deleted
  // outright, same as emergencyContact below, rather than merely
  // unlinked from the now-anonymized account.
  const ownedVehicleIds = (
    await prisma.vehicle.findMany({ where: { driverId: req.user.id }, select: { id: true } })
  ).map((v) => v.id);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: req.user.id },
      data: {
        disabled: true,
        deletedAt: new Date(),
        name: null,
        email: null,
        photoR2Key: null,
        fcmToken: null,
        passcodeHash: null,
        passcodeCreatedAt: null,
        whatsappOptIn: false,
      },
    }),
    // Fully theirs, nothing else references it — deleted outright
    // rather than scrubbed in place.
    prisma.emergencyContact.deleteMany({ where: { userId: req.user.id } }),
    prisma.driverVerification.deleteMany({ where: { driverId: req.user.id } }),
    prisma.passengerVerification.deleteMany({ where: { userId: req.user.id } }),
    ...(ownedVehicleIds.length
      ? [prisma.vehicleVerification.deleteMany({ where: { vehicleId: { in: ownedVehicleIds } } })]
      : []),
  ]);

  res.json({ deleted: true });
});

// GET /api/users/:id/public — shown to the other party in a booking
router.get("/:id/public", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, photoR2Key: true, ratingAvg: true, role: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: "User not found." });
  const { photoR2Key, ...rest } = user;
  res.json({ ...rest, photoViewUrl: await photoViewUrl(photoR2Key) });
});

export default router;
