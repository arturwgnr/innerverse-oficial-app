import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { generateChronicle } from "../services/narrative.js";

const router = Router();

// Waits for 5 new entries since the last generation before regenerating
// (UPDATES.md round 7 adicional), same "don't regenerate on every single
// entry in isolation" reasoning as About Me's own 2-entry threshold
// (routes/aboutMe.js), just a wider window since this is a much bigger,
// slower-moving picture of the person than About Me's light/dark cards.
const ENTRY_THRESHOLD = 5;

// "Quem é {user}", a flowing narrative in the Oracle's voice (see
// services/narrative.js), read from the profile the user's own name links
// to. Single row per user (period_type = 'meta', period_start null), see
// schema.sql for why this can't use a plain ON CONFLICT upsert.
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.id;

  const { rows: existingRows } = await pool.query(
    `select id, content, insight_id, updated_at
     from narrative_summaries
     where user_id = $1 and period_type = 'meta' and period_start is null`,
    [userId]
  );
  const existing = existingRows[0] || null;

  const { rows: countRows } = await pool.query(
    existing
      ? "select count(*)::int as count from entries where user_id = $1 and written_at > $2"
      : "select count(*)::int as count from entries where user_id = $1",
    existing ? [userId, existing.updated_at] : [userId]
  );
  const newCount = countRows[0].count;

  function respondCached() {
    res.json({
      ready: true,
      cached: true,
      paragraphs: existing.content.split("\n\n"),
      insightId: existing.insight_id,
      generatedAt: existing.updated_at,
    });
  }

  if (!existing && newCount < ENTRY_THRESHOLD) {
    return res.json({ ready: false, entriesNeeded: ENTRY_THRESHOLD - newCount });
  }
  if (existing && newCount < ENTRY_THRESHOLD) {
    return respondCached();
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    if (existing) return respondCached();
    return res.status(503).json({ error: "The chronicle requires an LLM key to be configured" });
  }

  const [{ rows: profileRows }, { rows: recentAnalyses }] = await Promise.all([
    pool.query("select profile from living_profiles where user_id = $1", [userId]),
    pool.query("select title from entry_analyses where user_id = $1 order by created_at desc limit 5", [userId]),
  ]);

  let result;
  try {
    result = await generateChronicle({
      livingProfile: profileRows[0]?.profile,
      recentTitles: recentAnalyses.map((r) => r.title),
    });
  } catch (err) {
    console.warn("Chronicle generation failed:", err.message);
    if (existing) return respondCached();
    return res.status(502).json({ error: "The chronicle is temporarily unavailable, try again later." });
  }

  const content = result.paragraphs.join("\n\n");

  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows: insightRows } = await client.query(
      `insert into insights (user_id, kind, body) values ($1, 'chronicle', $2) returning id`,
      [userId, content]
    );
    const insightId = insightRows[0].id;

    // Explicit update-or-insert, not ON CONFLICT (see schema.sql's note on
    // narrative_summaries.insight_id): this table's unique constraint can't
    // dedupe on a genuinely NULL period_start.
    if (existing) {
      await client.query(
        `update narrative_summaries set content = $1, insight_id = $2, updated_at = now() where id = $3`,
        [content, insightId, existing.id]
      );
    } else {
      await client.query(
        `insert into narrative_summaries (user_id, period_type, period_start, content, insight_id)
         values ($1, 'meta', null, $2, $3)`,
        [userId, content, insightId]
      );
    }
    await client.query("commit");
    res.json({ ready: true, cached: false, paragraphs: result.paragraphs, insightId, generatedAt: new Date() });
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
});

export default router;
