import { Router } from "express";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate, isNonEmptyString, isPositiveInt } from "../lib/validate.js";
import { r2, R2_BUCKET } from "../lib/r2.js";

const router = Router();

const REG_NUMBER_PATTERN = /^[A-Z0-9]{4,12}$/;
const UPLOAD_URL_TTL_SECONDS = 600; // 10 min
const VIEW_URL_TTL_SECONDS = 300; // 5 min — never long-lived, matches documents.routes.js

// POST /api/vehicles/upload-url — same private-bucket pattern as
// documents.routes.js, scoped under the driver's own id + which of the
// three vehicle assets this is. No Vehicle row needs to exist yet —
// the client uploads first, then includes the r2Key it gets back in
// the actual POST / create call below.
router.post("/upload-url", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const { kind } = req.body; // PHOTO, RC, DL
  if (!["PHOTO", "RC", "DL"].includes(kind)) {
    return res.status(400).json({ error: "Invalid upload kind." });
  }

  const r2Key = `${req.user.id}/vehicle-${kind}-${Date.now()}`;
  const command = new PutObjectCommand({ Bucket: R2_BUCKET, Key: r2Key });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });

  res.json({ r2Key, uploadUrl });
});

router.get("/", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const vehicles = await prisma.vehicle.findMany({ where: { driverId: req.user.id } });
  res.json(vehicles);
});

router.post("/", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const { make, model, regNumber, color, seatCapacity, photoR2Key, rcR2Key, dlR2Key } = req.body;

  const errors = validate(req.body, [
    { field: "make", check: (v) => isNonEmptyString(v, 50), message: "Make is required." },
    { field: "model", check: (v) => isNonEmptyString(v, 50), message: "Model is required." },
    { field: "regNumber", check: (v) => typeof v === "string" && REG_NUMBER_PATTERN.test(v.toUpperCase()), message: "Enter a valid registration number." },
    { field: "color", check: (v) => isNonEmptyString(v, 30), message: "Invalid color.", optional: true },
    { field: "seatCapacity", check: (v) => isPositiveInt(v) && v <= 10, message: "Seats must be between 1 and 10.", optional: true },
    // RC required, DL and a car photo are not — matches the mobile
    // form's own required/optional labeling.
    { field: "rcR2Key", check: (v) => isNonEmptyString(v, 300), message: "Upload your vehicle's RC book before saving." },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const vehicle = await prisma.vehicle.create({
    data: {
      driverId: req.user.id, make, model, regNumber: regNumber.toUpperCase(), color, seatCapacity,
      photoR2Key, rcR2Key,
      ...(dlR2Key ? { dlR2Key } : {}),
      // status defaults to PENDING — can't be used to publish a ride
      // (see rides.routes.js's create-ride check) until an admin
      // reviews and approves it from the vehicle verification queue.
    },
  });
  res.status(201).json(vehicle);
});

// GET /api/vehicles/:id/view-urls — fresh signed view URLs for
// whichever of the three assets this vehicle actually has, owner or
// admin only. Same shape as documents.routes.js's :id/view-url, just
// three at once since a review (driver checking their own submission,
// or admin reviewing it) usually wants to see all of them together.
router.get("/:id/view-urls", requireAuth, async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
  if (!vehicle) return res.status(404).json({ error: "Vehicle not found." });
  if (vehicle.driverId !== req.user.id && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Not permitted." });
  }

  async function signedUrl(key) {
    if (!key) return null;
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    return getSignedUrl(r2, command, { expiresIn: VIEW_URL_TTL_SECONDS });
  }

  const [photoViewUrl, rcViewUrl, dlViewUrl] = await Promise.all([
    signedUrl(vehicle.photoR2Key),
    signedUrl(vehicle.rcR2Key),
    signedUrl(vehicle.dlR2Key),
  ]);

  res.json({ photoViewUrl, rcViewUrl, dlViewUrl });
});

router.put("/:id", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
  if (!vehicle || vehicle.driverId !== req.user.id) {
    return res.status(404).json({ error: "Vehicle not found." });
  }

  const { make, model, regNumber, color, seatCapacity, photoR2Key, rcR2Key, dlR2Key } = req.body;
  const errors = validate(req.body, [
    { field: "make", check: (v) => isNonEmptyString(v, 50), message: "Make is required.", optional: true },
    { field: "model", check: (v) => isNonEmptyString(v, 50), message: "Model is required.", optional: true },
    { field: "regNumber", check: (v) => typeof v === "string" && REG_NUMBER_PATTERN.test(v.toUpperCase()), message: "Enter a valid registration number.", optional: true },
    { field: "color", check: (v) => isNonEmptyString(v, 30), message: "Invalid color.", optional: true },
    { field: "seatCapacity", check: (v) => isPositiveInt(v) && v <= 10, message: "Seats must be between 1 and 10.", optional: true },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  // Re-uploading any document counts as a resubmission — most relevant
  // for a REJECTED vehicle (the whole point of showing the driver why
  // it was rejected is so they can fix it and try again), but applies
  // any time a document changes: back to PENDING for another look,
  // rejectionReason cleared since it no longer describes what's here now.
  const resubmitting = photoR2Key !== undefined || rcR2Key !== undefined || dlR2Key !== undefined;

  // Whitelisted fields only — never spread req.body directly into
  // Prisma's update data, since that would let a caller set arbitrary
  // columns (mass-assignment).
  const updated = await prisma.vehicle.update({
    where: { id: req.params.id },
    data: {
      ...(make !== undefined && { make }),
      ...(model !== undefined && { model }),
      ...(regNumber !== undefined && { regNumber: regNumber.toUpperCase() }),
      ...(color !== undefined && { color }),
      ...(seatCapacity !== undefined && { seatCapacity }),
      ...(photoR2Key !== undefined && { photoR2Key }),
      ...(rcR2Key !== undefined && { rcR2Key }),
      ...(dlR2Key !== undefined && { dlR2Key }),
      ...(resubmitting && { status: "PENDING", rejectionReason: null, reviewedAt: null, reviewedBy: null }),
    },
  });
  res.json(updated);
});

router.delete("/:id", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
  if (!vehicle || vehicle.driverId !== req.user.id) {
    return res.status(404).json({ error: "Vehicle not found." });
  }

  // Ride.vehicleId is ON DELETE SET NULL, so this would otherwise
  // silently succeed and leave a live ride with no vehicle at all —
  // stripping the vehicle info passengers already saw in search, and
  // undermining the "must have a vehicle to publish" rule retroactively.
  const activeRide = await prisma.ride.findFirst({
    where: { vehicleId: req.params.id, status: { in: ["PUBLISHED", "IN_PROGRESS"] } },
  });
  if (activeRide) {
    return res.status(400).json({ error: "Can't delete a vehicle that's assigned to an active ride." });
  }

  await prisma.vehicle.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
