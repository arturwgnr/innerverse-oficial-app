import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { embedText } from "../services/voyage.js";
import { mergeProfile } from "../services/profileMerge.js";
import { generateEntryAnalysis } from "../services/analysis.js";
import { describeMood } from "../lib/moods.js";

const FREE_DAILY_ANALYSIS_LIMIT = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const router = Router();

const MOMENTS = ["morning", "afternoon", "night", "decompress"];

const entrySchema = z.object({
  moment: z.enum(MOMENTS),
  mode: z.enum(["full", "fast", "mindfulness"]),
  language: z.enum(["en", "pt"]),
  prompt: z.string().optional(),
  textContent: z.string().optional(),
  audioUrl: z.string().optional(),
  mood: z.number().int().min(1).max(6).optional(),
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

    // mergeProfile calls Gemini now, not OpenRouter (UPDATES.md "model
    // provider decision").
    if (process.env.GEMINI_API_KEY) {
      const { rows } = await pool.query(
        "select profile from living_profiles where user_id = $1",
        [userId]
      );
      const currentProfile = rows[0]?.profile || {};
      const profile = await mergeProfile({
        currentProfile,
        evidence: { ...entry, mood: describeMood(entry.mood) },
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

// Deep, standalone analysis of this one entry (UPDATES.md: replaces the old
// cross-entry Patterns feature entirely). Free plan: at most 5 a day (one
// per moment logged plus 2 spare, see UPDATES.md "Analysis quality and
// reliability"), the day boundary is the same simple `now()::date` server
// date used elsewhere in this codebase for daily caps. Entries past the cap
// are still saved, they just don't get a deep read that day.
export async function maybeGenerateEntryAnalysis({ userId, entry }) {
  // generateEntryAnalysis calls Gemini now, not OpenRouter.
  if (!process.env.GEMINI_API_KEY) {
    await pool.query("update entries set analysis_status = 'skipped' where id = $1", [entry.id]);
    return;
  }
  try {
    // Claims the entry before doing any real work: flips analysis_status to
    // 'processing' (not just updated_at) so a concurrent caller (the recovery
    // sweep in routes/analysis.js, fired on every page reopen, or a manual
    // retry request) sees a non-'pending' row and backs off, instead of both
    // firing Gemini and inserting two analyses for the same entry
    // (UPDATES.md round 3's "analysis regenerating" bug, and round 4 #4's
    // follow-up: bumping only updated_at still let a second sweep re-claim a
    // slow, still-pending call once its own staleness window passed).
    const claim = await pool.query(
      `update entries set analysis_status = 'processing', updated_at = now() where id = $1 and analysis_status = 'pending' returning id`,
      [entry.id]
    );
    if (claim.rowCount === 0) return;

    const { rows: countRows } = await pool.query(
      `select count(*)::int as count from entry_analyses where user_id = $1 and created_at::date = now()::date`,
      [userId]
    );
    if (countRows[0].count >= FREE_DAILY_ANALYSIS_LIMIT) {
      await pool.query("update entries set analysis_status = 'skipped' where id = $1", [entry.id]);
      return;
    }

    const [{ rows: profileRows }, { rows: recentEntries }] = await Promise.all([
      pool.query("select profile from living_profiles where user_id = $1", [userId]),
      pool.query(
        `select moment, mode, text_content, mood, bullets, occurred_at
         from entries where user_id = $1 and id != $2 order by occurred_at desc limit 10`,
        [userId, entry.id]
      ),
    ]);

    const analysis = await generateEntryAnalysis({
      entry,
      livingProfile: profileRows[0]?.profile,
      recentEntries,
    });

    const client = await pool.connect();
    try {
      await client.query("begin");
      const { rows: analysisRows } = await client.query(
        `insert into entry_analyses (user_id, entry_id, title) values ($1, $2, $3) returning id`,
        [userId, entry.id, analysis.title]
      );
      const analysisId = analysisRows[0].id;
      for (const [position, paragraph] of analysis.paragraphs.entries()) {
        await client.query(
          `insert into insights (user_id, kind, title, body, entry_id, analysis_id, position)
           values ($1, 'entry_analysis_observation', $2, $3, $4, $5, $6)`,
          [userId, analysis.title, paragraph, entry.id, analysisId, position]
        );
      }
      await client.query("update entries set analysis_status = 'ready' where id = $1", [entry.id]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Entry analysis generation failed:", err);
    await pool.query("update entries set analysis_status = 'failed' where id = $1", [entry.id]);
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

  // Staggered on purpose: both calls hit Gemini's free tier, capped at 5
  // requests/minute (UPDATES.md "Analysis quality and reliability"). Firing
  // them in the same instant spent 2 of those 5 on a single entry save
  // alone, this spaces them out instead.
  updateMemoryInBackground({ userId: req.user.id, entry });
  sleep(4000).then(() => maybeGenerateEntryAnalysis({ userId: req.user.id, entry }));
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
            is_retroactive, occurred_at, written_at, analysis_status
     from entries
     where ${conditions.join(" and ")}
     order by occurred_at desc`,
    params
  );

  res.json(rows);
});

export default router;
