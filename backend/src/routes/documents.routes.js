import { Router } from "express";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { r2, R2_BUCKET } from "../lib/r2.js";

const router = Router();
const UPLOAD_URL_TTL_SECONDS = 600; // 10 min
const VIEW_URL_TTL_SECONDS = 300; // 5 min — never long-lived, per plan section 11J

// POST /api/documents/upload-url — returns a short-lived signed R2 PUT
// URL. File bytes go straight from the client to R2, never through this
// API server.
router.post("/upload-url", requireAuth, async (req, res) => {
  const { docType } = req.body; // LICENSE, RC, INSURANCE
  if (!["LICENSE", "RC", "INSURANCE"].includes(docType)) {
    return res.status(400).json({ error: "Invalid document type." });
  }

  const r2Key = `${req.user.id}/${docType}-${Date.now()}`;

  const doc = await prisma.document.create({
    data: { userId: req.user.id, docType, r2Key, status: "PENDING" },
  });

  const command = new PutObjectCommand({ Bucket: R2_BUCKET, Key: r2Key });
  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });

  res.json({ documentId: doc.id, uploadUrl });
});

// GET /api/documents/:id/view-url — fresh signed view URL, owner or admin only
router.get("/:id/view-url", requireAuth, async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "Document not found." });
  if (doc.userId !== req.user.id && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Not permitted." });
  }

  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: doc.r2Key });
  const viewUrl = await getSignedUrl(r2, command, { expiresIn: VIEW_URL_TTL_SECONDS });

  res.json({ viewUrl });
});

// GET /api/documents/user/:userId — driver's own uploaded docs (or admin
// checking a specific driver's set), used to render verification status.
router.get("/user/:userId", requireAuth, async (req, res) => {
  if (req.params.userId !== req.user.id && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Not permitted." });
  }
  const docs = await prisma.document.findMany({ where: { userId: req.params.userId } });
  res.json(docs);
});

export default router;
