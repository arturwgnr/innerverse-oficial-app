import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { analyzeAboutMe, computeKnowledgePercent } from "../services/analysis.js";

const router = Router();

// History browser (UPDATES.md round 4 #1): every past generation's light/dark
// insights already sit in this table untouched, GET / only ever surfaced the
// newest batch. Grouped by their shared generated_at timestamp (see the
// write path below), oldest first is the natural chronicle order to read
// forward, but this returns newest first so the frontend can decide.
router.get("/history", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `select id, kind, title, body, generated_at
     from insights
     where user_id = $1 and kind in ('about_me_light', 'about_me_dark')
     order by generated_at desc`,
    [req.user.id]
  );

  const byDate = new Map();
  for (const row of rows) {
    const key = row.generated_at.toISOString();
    if (!byDate.has(key)) {
      byDate.set(key, { generatedAt: row.generated_at, light: [], dark: [] });
    }
    byDate.get(key)[row.kind === "about_me_light" ? "light" : "dark"].push(row);
  }

  res.json({ generations: [...byDate.values()] });
});

router.get("/", requireAuth, async (req, res) => {
  const [{ rows: countRows }, { rows: profileMetaRows }] = await Promise.all([
    pool.query("select count(*)::int as count from entries where user_id = $1", [req.user.id]),
    pool.query("select about_me_generated_at from living_profiles where user_id = $1", [req.user.id]),
  ]);

  // Computed fresh every time from the real entry count (see
  // computeKnowledgePercent), never an LLM guess and never stale cached
  // data, whether or not the light/dark write-up itself is cached.
  const knowledgePercent = computeKnowledgePercent(countRows[0]?.count ?? 0);
  const generatedAt = profileMetaRows[0]?.about_me_generated_at ?? null;

  if (generatedAt) {
    const { rows: newerEntries } = await pool.query(
      "select 1 from entries where user_id = $1 and written_at > $2 limit 1",
      [req.user.id, generatedAt]
    );
    // Stale the moment a new entry was written since the last generation,
    // not on a fixed time window (UPDATES.md #6: the old 7 day window kept
    // this frozen at whatever generated the very first time, often right
    // after onboarding with zero entries).
    if (newerEntries.length === 0) {
      const { rows: cached } = await pool.query(
        `select id, kind, title, body, generated_at
         from insights
         where user_id = $1 and kind in ('about_me_light', 'about_me_dark') and generated_at >= $2
         order by generated_at desc`,
        [req.user.id, generatedAt]
      );
      if (cached.length > 0) {
        return res.json({
          cached: true,
          knowledgePercent,
          light: cached.filter((row) => row.kind === "about_me_light"),
          dark: cached.filter((row) => row.kind === "about_me_dark"),
        });
      }
    }
  }

  // analyzeAboutMe calls Gemini now, not OpenRouter.
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: "About Me analysis requires GEMINI_API_KEY to be configured" });
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

  // One shared timestamp for this whole generation, inserted explicitly
  // rather than left to each row's own `now()` default. Otherwise the
  // about_me_generated_at marker (set after all rows are inserted) could
  // land a hair later than the rows themselves and filter them all out of
  // the cache read on the very next request.
  const newGeneratedAt = new Date();

  const client = await pool.connect();
  try {
    await client.query("begin");
    const light = [];
    const dark = [];
    for (const item of analysis.light) {
      const { rows } = await client.query(
        `insert into insights (user_id, kind, title, body, generated_at) values ($1, 'about_me_light', $2, $3, $4) returning *`,
        [req.user.id, item.title, item.body, newGeneratedAt]
      );
      light.push(rows[0]);
    }
    for (const item of analysis.dark) {
      const { rows } = await client.query(
        `insert into insights (user_id, kind, title, body, generated_at) values ($1, 'about_me_dark', $2, $3, $4) returning *`,
        [req.user.id, item.title, item.body, newGeneratedAt]
      );
      dark.push(rows[0]);
    }
    await client.query(
      `insert into living_profiles (user_id, knowledge_pct, about_me_generated_at)
       values ($1, $2, $3)
       on conflict (user_id) do update set
         knowledge_pct = excluded.knowledge_pct,
         about_me_generated_at = excluded.about_me_generated_at,
         updated_at = now()`,
      [req.user.id, knowledgePercent, newGeneratedAt]
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
