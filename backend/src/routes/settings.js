import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Account-level settings (EDITS.md round 2 #1's navigation overhaul: a real
// Settings screen instead of scattered controls). Name/birth date live on
// onboarding_responses (the same row onboarding itself writes), password and
// email stay entirely on Better Auth's own endpoints, this route never
// touches those.
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "select preferred_name, birth_date from onboarding_responses where user_id = $1",
    [req.user.id]
  );
  const row = rows[0];
  res.json({
    preferredName: row?.preferred_name || null,
    birthDate: row?.birth_date ? row.birth_date.toISOString().slice(0, 10) : null,
  });
});

const settingsSchema = z.object({
  preferredName: z.string().trim().min(1).optional(),
  birthDate: z.string().date().optional(),
});

router.put("/", requireAuth, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { preferredName, birthDate } = parsed.data;
  if (!preferredName && !birthDate) return res.status(400).json({ error: "Nothing to update" });

  const { rows } = await pool.query(
    `update onboarding_responses
     set preferred_name = coalesce($1, preferred_name),
         birth_date = coalesce($2, birth_date)
     where user_id = $3
     returning preferred_name, birth_date`,
    [preferredName || null, birthDate || null, req.user.id]
  );

  const row = rows[0];
  if (!row) return res.status(404).json({ error: "Complete onboarding first" });

  res.json({
    preferredName: row.preferred_name,
    birthDate: row.birth_date ? row.birth_date.toISOString().slice(0, 10) : null,
  });
});

export default router;
