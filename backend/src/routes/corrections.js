import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { mergeProfile } from "../services/profileMerge.js";

const router = Router();

// "That's not it" / "True" on any insight card becomes its own record, linked to
// the insight (and the entry that produced it, when relevant). This is the clean
// mirror correction loop from JOURNAL.md section 5 and 6.
const correctionSchema = z.object({
  insightId: z.string().uuid(),
  entryId: z.string().uuid().optional(),
  verdict: z.enum(["confirmed", "rejected"]),
  userNote: z.string().optional(),
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = correctionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { insightId, entryId, verdict, userNote } = parsed.data;

  const { rows } = await pool.query(
    `insert into corrections (user_id, insight_id, entry_id, verdict, user_note)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [req.user.id, insightId, entryId || null, verdict, userNote || null]
  );

  res.status(201).json(rows[0]);

  // mergeProfile calls Gemini now, not OpenRouter.
  if (process.env.GEMINI_API_KEY) {
    updateProfileFromCorrection({ userId: req.user.id, insightId, verdict, userNote }).catch((err) =>
      console.error("Failed to fold correction into profile:", err)
    );
  }
});

async function updateProfileFromCorrection({ userId, insightId, verdict, userNote }) {
  const [{ rows: insightRows }, { rows: profileRows }] = await Promise.all([
    pool.query("select kind, category, title, body from insights where id = $1", [insightId]),
    pool.query("select profile from living_profiles where user_id = $1", [userId]),
  ]);

  const insight = insightRows[0];
  if (!insight) return;

  const profile = await mergeProfile({
    currentProfile: profileRows[0]?.profile || {},
    evidence: { insight, verdict, userNote },
    evidenceType: "correction",
  });

  await pool.query(
    `insert into living_profiles (user_id, profile)
     values ($1, $2)
     on conflict (user_id) do update set profile = excluded.profile, updated_at = now()`,
    [userId, profile]
  );
}

export default router;
