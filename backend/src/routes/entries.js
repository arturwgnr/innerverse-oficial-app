import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { embedText } from "../services/voyage.js";
import { mergeProfile } from "../services/profileMerge.js";

const router = Router();

const MOODS = ["radiant", "steady", "tender", "restless", "heavy", "numb"];
const MOMENTS = ["morning", "afternoon", "night", "decompress"];

const entrySchema = z.object({
  moment: z.enum(MOMENTS),
  mode: z.enum(["full", "fast"]),
  language: z.enum(["en", "pt"]),
  prompt: z.string().optional(),
  textContent: z.string().optional(),
  audioUrl: z.string().optional(),
  mood: z.enum(MOODS).optional(),
  bullets: z.array(z.string()).optional(),
  occurredAt: z.string().datetime(),
});

function isRetroactive(occurredAt) {
  const occurred = new Date(occurredAt);
  const now = new Date();
  return now.getTime() - occurred.getTime() > 1000 * 60 * 60 * 12;
}

async function updateMemoryInBackground({ userId, entry }) {
  try {
    if (process.env.VOYAGE_API_KEY && entry.text_content) {
      const embedding = await embedText(entry.text_content);
      await pool.query("update entries set embedding = $1 where id = $2", [
        `[${embedding.join(",")}]`,
        entry.id,
      ]);
    }

    if (process.env.OPENROUTER_API_KEY) {
      const { rows } = await pool.query(
        "select profile from living_profiles where user_id = $1",
        [userId]
      );
      const currentProfile = rows[0]?.profile || {};
      const profile = await mergeProfile({
        currentProfile,
        evidence: entry,
        evidenceType: "entry",
      });
      await pool.query(
        `insert into living_profiles (user_id, profile)
         values ($1, $2)
         on conflict (user_id) do update set profile = excluded.profile, updated_at = now()`,
        [userId, profile]
      );
    }
  } catch (err) {
    console.error("Background memory update failed:", err);
  }
}

router.post("/", requireAuth, async (req, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const data = parsed.data;
  const retroactive = isRetroactive(data.occurredAt);

  const { rows } = await pool.query(
    `insert into entries
      (user_id, moment, mode, language, prompt, text_content, audio_url, mood, bullets, is_retroactive, occurred_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning *`,
    [
      req.user.id,
      data.moment,
      data.mode,
      data.language,
      data.prompt || null,
      data.textContent || null,
      data.audioUrl || null,
      data.mood || null,
      data.bullets ? JSON.stringify(data.bullets) : null,
      retroactive,
      data.occurredAt,
    ]
  );

  const entry = rows[0];
  res.status(201).json(entry);

  updateMemoryInBackground({ userId: req.user.id, entry });
});

router.get("/", requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const conditions = ["user_id = $1"];
  const params = [req.user.id];

  if (from) {
    params.push(from);
    conditions.push(`occurred_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`occurred_at <= $${params.length}`);
  }

  const { rows } = await pool.query(
    `select id, moment, mode, language, prompt, text_content, audio_url, mood, bullets,
            is_retroactive, occurred_at, written_at
     from entries
     where ${conditions.join(" and ")}
     order by occurred_at desc`,
    params
  );

  res.json(rows);
});

export default router;
