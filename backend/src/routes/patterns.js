import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { analyzePatterns } from "../services/patternsAnalysis.js";

const router = Router();

async function fetchTodaysInsights(userId) {
  const { rows } = await pool.query(
    `select id, kind, category, title, body, confidence, supporting_entry_count, generated_at
     from insights
     where user_id = $1
       and kind in ('pattern_summary', 'pattern_card')
       and generated_at::date = now()::date
     order by generated_at asc`,
    [userId]
  );
  return rows;
}

router.get("/", requireAuth, async (req, res) => {
  // Free plan: patterns analysis runs at most once a day, cached rows are reused otherwise.
  const cached = await fetchTodaysInsights(req.user.id);
  if (cached.length > 0) {
    return res.json({ cached: true, insights: cached });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: "Pattern analysis requires OPENROUTER_API_KEY to be configured" });
  }

  const [{ rows: entries }, { rows: profileRows }] = await Promise.all([
    pool.query(
      `select moment, mode, language, text_content, mood, bullets, occurred_at
       from entries where user_id = $1 order by occurred_at desc limit 200`,
      [req.user.id]
    ),
    pool.query("select profile from living_profiles where user_id = $1", [req.user.id]),
  ]);

  let analysis;
  try {
    analysis = await analyzePatterns({
      entries,
      livingProfile: profileRows[0]?.profile,
    });
  } catch (err) {
    console.warn("Pattern analysis failed:", err.message);
    return res.status(502).json({ error: "Pattern analysis is temporarily unavailable, try again later." });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const { rows: summaryRows } = await client.query(
      `insert into insights (user_id, kind, body) values ($1, 'pattern_summary', $2) returning *`,
      [req.user.id, analysis.opening_summary]
    );

    const cardRows = [];
    for (const card of analysis.cards) {
      const { rows } = await client.query(
        `insert into insights (user_id, kind, category, title, body, confidence, supporting_entry_count)
         values ($1, 'pattern_card', $2, $3, $4, $5, $6)
         returning *`,
        [req.user.id, card.category, card.title, card.body, card.confidence, card.supporting_entry_count]
      );
      cardRows.push(rows[0]);
    }

    await client.query("commit");
    res.json({ cached: false, insights: [...summaryRows, ...cardRows] });
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
});

export default router;
