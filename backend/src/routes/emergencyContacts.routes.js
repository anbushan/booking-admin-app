import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { validate, isNonEmptyString, isPhone } from "../lib/validate.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const contacts = await prisma.emergencyContact.findMany({ where: { userId: req.user.id } });
  res.json(contacts);
});

router.post("/", requireAuth, async (req, res) => {
  const { name, phone, relation, isPrimary } = req.body;

  const errors = validate(req.body, [
    { field: "name", check: (v) => isNonEmptyString(v, 100), message: "Name is required." },
    { field: "phone", check: isPhone, message: "Enter a valid 10-digit phone number." },
    { field: "relation", check: (v) => isNonEmptyString(v, 50), message: "Invalid relation.", optional: true },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  if (isPrimary) {
    // Only one primary contact at a time — demote any existing one.
    await prisma.emergencyContact.updateMany({
      where: { userId: req.user.id, isPrimary: true },
      data: { isPrimary: false },
    });
  }
  const contact = await prisma.emergencyContact.create({
    data: { userId: req.user.id, name, phone, relation, isPrimary: !!isPrimary },
  });
  res.status(201).json(contact);
});

router.put("/:id", requireAuth, async (req, res) => {
  const contact = await prisma.emergencyContact.findUnique({ where: { id: req.params.id } });
  if (!contact || contact.userId !== req.user.id) {
    return res.status(404).json({ error: "Contact not found." });
  }

  const { name, phone, relation, isPrimary } = req.body;
  const errors = validate(req.body, [
    { field: "name", check: (v) => isNonEmptyString(v, 100), message: "Name is required.", optional: true },
    { field: "phone", check: isPhone, message: "Enter a valid 10-digit phone number.", optional: true },
    { field: "relation", check: (v) => isNonEmptyString(v, 50), message: "Invalid relation.", optional: true },
  ]);
  if (errors.length) return res.status(400).json({ errors });

  const updated = await prisma.emergencyContact.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(relation !== undefined && { relation }),
      ...(isPrimary !== undefined && { isPrimary: !!isPrimary }),
    },
  });
  res.json(updated);
});

router.delete("/:id", requireAuth, async (req, res) => {
  const contact = await prisma.emergencyContact.findUnique({ where: { id: req.params.id } });
  if (!contact || contact.userId !== req.user.id) {
    return res.status(404).json({ error: "Contact not found." });
  }
  await prisma.emergencyContact.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
