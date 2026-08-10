import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate, isNonEmptyString, isEmail, isOneOf } from "../lib/validate.js";
import { serializeUser } from "../lib/serializeUser.js";

const router = Router();

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
  res.json(serializeUser(req.user));
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
    select: { id: true, name: true, photoUrl: true, ratingAvg: true, role: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json(user);
});

export default router;
