import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const uploadsDir = path.join(process.cwd(), "uploads", "audio");

// Local disk storage for audio journal entries during development. Swap for
// object storage (S3 or similar) before running this in production.
router.post("/audio", requireAuth, upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided" });
  }

  await mkdir(uploadsDir, { recursive: true });
  const filename = `${req.user.id}-${randomUUID()}.webm`;
  await writeFile(path.join(uploadsDir, filename), req.file.buffer);

  res.status(201).json({ audioUrl: `/uploads/audio/${filename}` });
});

export default router;
