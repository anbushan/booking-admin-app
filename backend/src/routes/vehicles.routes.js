import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate, isNonEmptyString, isPositiveInt } from "../lib/validate.js";

const router = Router();

const REG_NUMBER_PATTERN = /^[A-Z0-9]{4,12}$/;

router.get("/", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const vehicles = await prisma.vehicle.findMany({ where: { driverId: req.user.id } });
  res.json(vehicles);
});

router.post("/", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const { make, model, regNumber, color, seatCapacity } = req.body;

  const errors = validate(req.body, [
    { field: "make", check: (v) => isNonEmptyString(v, 50), message: "Make is required." },
    { field: "model", check: (v) => isNonEmptyString(v, 50), message: "Model is required." },
    { field: "regNumber", check: (v) => typeof v === "string" && REG_NUMBER_PATTERN.test(v.toUpperCase()), message: "Enter a valid registration number." },
    { field: "color", check: (v) => isNonEmptyString(v, 30), message: "Invalid color.", optional: true },
    { field: "seatCapacity", check: (v) => isPositiveInt(v) && v <= 10, message: "Seats must be between 1 and 10.", optional: true },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const vehicle = await prisma.vehicle.create({
    data: { driverId: req.user.id, make, model, regNumber: regNumber.toUpperCase(), color, seatCapacity },
  });
  res.status(201).json(vehicle);
});

router.put("/:id", requireAuth, requireRole("DRIVER"), async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
  if (!vehicle || vehicle.driverId !== req.user.id) {
    return res.status(404).json({ error: "Vehicle not found." });
  }

  const { make, model, regNumber, color, seatCapacity } = req.body;
  const errors = validate(req.body, [
    { field: "make", check: (v) => isNonEmptyString(v, 50), message: "Make is required.", optional: true },
    { field: "model", check: (v) => isNonEmptyString(v, 50), message: "Model is required.", optional: true },
    { field: "regNumber", check: (v) => typeof v === "string" && REG_NUMBER_PATTERN.test(v.toUpperCase()), message: "Enter a valid registration number.", optional: true },
    { field: "color", check: (v) => isNonEmptyString(v, 30), message: "Invalid color.", optional: true },
    { field: "seatCapacity", check: (v) => isPositiveInt(v) && v <= 10, message: "Seats must be between 1 and 10.", optional: true },
  ]);
  if (errors.length) return res.status(400).json({ errors });

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
