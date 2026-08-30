import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { analyzeAboutMe, computeKnowledgePercent } from "../services/patternsAnalysis.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const [{ rows: cached }, { rows: countRows }] = await Promise.all([
    pool.query(
      `select id, kind, title, body, generated_at
       from insights
       where user_id = $1 and kind in ('about_me_light', 'about_me_dark')
         and generated_at > now() - interval '7 days'
       order by generated_at desc`,
      [req.user.id]
    ),
    pool.query("select count(*)::int as count from entries where user_id = $1", [req.user.id]),
  ]);

  // Computed fresh every time from the real entry count (see
  // computeKnowledgePercent), never an LLM guess and never stale cached
  // data, whether or not the light/dark write-up itself is cached.
  const knowledgePercent = computeKnowledgePercent(countRows[0]?.count ?? 0);

  if (cached.length > 0) {
    return res.json({
      cached: true,
      knowledgePercent,
      light: cached.filter((row) => row.kind === "about_me_light"),
      dark: cached.filter((row) => row.kind === "about_me_dark"),
    });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: "About Me analysis requires OPENROUTER_API_KEY to be configured" });
  }

  const [{ rows: entries }, { rows: profileRows }] = await Promise.all([
    pool.query(
      `select moment, mode, text_content, mood, bullets, occurred_at
       from entries where user_id = $1 order by occurred_at desc limit 200`,
      [req.user.id]
    ),
    pool.query("select profile from living_profiles where user_id = $1", [req.user.id]),
  ]);

  let analysis;
  try {
    analysis = await analyzeAboutMe({ entries, livingProfile: profileRows[0]?.profile });
  } catch (err) {
    console.warn("About Me analysis failed:", err.message);
    return res.status(502).json({ error: "About Me analysis is temporarily unavailable, try again later." });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const light = [];
    const dark = [];
    for (const item of analysis.light) {
      const { rows } = await client.query(
        `insert into insights (user_id, kind, title, body) values ($1, 'about_me_light', $2, $3) returning *`,
        [req.user.id, item.title, item.body]
      );
      light.push(rows[0]);
    }
    for (const item of analysis.dark) {
      const { rows } = await client.query(
        `insert into insights (user_id, kind, title, body) values ($1, 'about_me_dark', $2, $3) returning *`,
        [req.user.id, item.title, item.body]
      );
      dark.push(rows[0]);
    }
    await client.query(
      `insert into living_profiles (user_id, knowledge_pct)
       values ($1, $2)
       on conflict (user_id) do update set knowledge_pct = excluded.knowledge_pct, updated_at = now()`,
      [req.user.id, knowledgePercent]
    );
    await client.query("commit");
    res.json({ cached: false, knowledgePercent, light, dark });
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
});

export default router;
