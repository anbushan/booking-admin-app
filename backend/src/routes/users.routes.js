import { Router } from "express";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate, isNonEmptyString, isEmail, isOneOf } from "../lib/validate.js";
import { serializeUser } from "../lib/serializeUser.js";
import { r2, R2_BUCKET } from "../lib/r2.js";

const router = Router();
const UPLOAD_URL_TTL_SECONDS = 600; // 10 min
const VIEW_URL_TTL_SECONDS = 300; // 5 min — never long-lived, matches documents.routes.js

async function photoViewUrl(photoR2Key) {
  if (!photoR2Key) return null;
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: photoR2Key });
  return getSignedUrl(r2, command, { expiresIn: VIEW_URL_TTL_SECONDS });
}

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
