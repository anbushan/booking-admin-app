import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate, isNonEmptyString, isEmail, isOneOf } from "../lib/validate.js";

const router = Router();

// PUT /api/users/me — completes registration (name/email/role) after
// first-time OTP verification.
router.put("/me", requireAuth, async (req, res) => {
  const { name, email, role } = req.body;

  const errors = validate(req.body, [
    { field: "name", check: (v) => isNonEmptyString(v, 100), message: "Name is required." },
    { field: "email", check: isEmail, message: "Enter a valid email address.", optional: true },
    { field: "role", check: (v) => isOneOf(v, ["DRIVER", "PASSENGER"]), message: "Role must be DRIVER or PASSENGER." },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: { name, email, role },
  });
  res.json(updated);
});

router.get("/me", requireAuth, async (req, res) => {
  res.json(req.user);
});

// GET /api/users/:id/public — shown to the other party in a booking
router.get("/:id/public", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, photoUrl: true, ratingAvg: true, role: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
});

export default router;
