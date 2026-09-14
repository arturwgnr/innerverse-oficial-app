import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { generateChapter } from "../services/narrative.js";

const router = Router();

// User-driven reveal, not an auto-generate-on-visit (UPDATES.md round 7
// adicional, revised): at REVEAL_THRESHOLD uncovered entries, a "a new
// chapter awaits" button appears on the Chapters page and the user decides
// when to click it. If they never do, AUTO_GENERATE_THRESHOLD is the safety
// net, generating on their behalf so entries never pile up unread forever.
// Either way the chapter covers every uncovered entry at generation time,
// not a fixed-size batch, so a chapter revealed early is smaller than one
// that hit the safety net.
const REVEAL_THRESHOLD = 4;
const AUTO_GENERATE_THRESHOLD = 10;

// Entries not yet covered by any existing chapter: everything after the
// most recent chapter's period_end, or everything if no chapter exists yet.
async function uncoveredEntries(userId) {
  const { rows: lastChapterRows } = await pool.query(
    `select max(period_end) as last_end from narrative_summaries where user_id = $1 and period_type = 'month'`,
    [userId]
  );
  const lastEnd = lastChapterRows[0]?.last_end || null;
  const { rows } = await pool.query(
    lastEnd
      ? "select id, occurred_at from entries where user_id = $1 and occurred_at > $2 order by occurred_at asc"
      : "select id, occurred_at from entries where user_id = $1 order by occurred_at asc",
    lastEnd ? [userId, lastEnd] : [userId]
  );
  return rows;
}

// Generates one chapter covering every entry in `batch` (all of it, not a
// fixed slice), from their entry_analyses (titles + insight paragraphs),
// never the raw entry text or the living_profile, see services/narrative.js.
async function generateChapterFromBatch(userId, batch) {
  const entryIds = batch.map((e) => e.id);
  const { rows } = await pool.query(
    `select ea.id as analysis_id, ea.title, i.body, i.position
     from entry_analyses ea
     left join insights i on i.analysis_id = ea.id
     where ea.entry_id = any($1::uuid[])
     order by ea.created_at asc, i.position asc`,
    [entryIds]
  );
  // Grouped into {title, paragraphs} per analysis, not flat rows with the
  // title repeated once per paragraph, a cleaner shape matching what the
  // prompt actually describes receiving.
  const analysesById = new Map();
  for (const row of rows) {
    if (!analysesById.has(row.analysis_id)) {
      analysesById.set(row.analysis_id, { title: row.title, paragraphs: [] });
    }
    if (row.body) analysesById.get(row.analysis_id).paragraphs.push(row.body);
  }
  const analyses = [...analysesById.values()];

  const result = await generateChapter({ analyses });
  await pool.query(
    `insert into narrative_summaries (user_id, period_type, period_start, period_end, content)
     values ($1, 'month', $2, $3, $4)`,
    [userId, batch[0].occurred_at, batch[batch.length - 1].occurred_at, JSON.stringify(result)]
  );
}

function loadChapters(userId) {
  return pool
    .query(
      `select id, period_start, period_end, content, created_at
       from narrative_summaries
       where user_id = $1 and period_type = 'month'
       order by period_start asc`,
      [userId]
    )
    .then(({ rows }) =>
      rows.map((row, i) => {
        const parsed = JSON.parse(row.content);
        return {
          id: row.id,
          number: i + 1,
          title: parsed.title,
          paragraphs: parsed.paragraphs,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          createdAt: row.created_at,
        };
      })
    );
}

// Lightweight, no LLM call, no chapter content: just whether a chapter is
// ready to reveal, for the sidebar's subtle "the Oracle is writing"
// indicator (AppShell.jsx), polled far more often than anyone actually
// opens the chapters page itself.
router.get("/countdown", requireAuth, async (req, res) => {
  const uncovered = await uncoveredEntries(req.user.id);
  res.json({
    uncoveredCount: uncovered.length,
    canReveal: uncovered.length >= REVEAL_THRESHOLD,
    revealThreshold: REVEAL_THRESHOLD,
  });
});

// "What you lived", periodic chapters covering a stretch of the journey,
// each its own row (period_type = 'month', reusing the field name loosely,
// not a literal calendar month), an archive that only grows, unlike the
// chronicle's single upserted row. Numbered by position (oldest = Chapter
// 1) rather than a stored column, computed here from period_start order.
// Only the safety net auto-generates here, a deliberate reveal always goes
// through POST /reveal below instead.
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.id;
  let uncovered = await uncoveredEntries(userId);

  if (uncovered.length >= AUTO_GENERATE_THRESHOLD && (process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY)) {
    try {
      await generateChapterFromBatch(userId, uncovered);
      uncovered = await uncoveredEntries(userId);
    } catch (err) {
      // A missed chapter this visit isn't fatal, the same uncovered entries
      // are still there next time and will retry, either via the safety
      // net again or a manual reveal.
      console.warn("Chapter auto-generation failed:", err.message);
    }
  }

  const chapters = await loadChapters(userId);
  res.json({
    chapters,
    uncoveredCount: uncovered.length,
    canReveal: uncovered.length >= REVEAL_THRESHOLD,
    revealThreshold: REVEAL_THRESHOLD,
  });
});

// The user-initiated "a new chapter awaits" click: covers every uncovered
// entry that exists right now, not just the REVEAL_THRESHOLD minimum, so
// clicking early never leaves a gap behind.
router.post("/reveal", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const uncovered = await uncoveredEntries(userId);

  if (uncovered.length < REVEAL_THRESHOLD) {
    return res.status(400).json({ error: "Not enough new entries yet for a chapter to reveal." });
  }
  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: "Chapter generation requires an LLM key to be configured" });
  }

  try {
    await generateChapterFromBatch(userId, uncovered);
  } catch (err) {
    console.warn("Chapter reveal failed:", err.message);
    return res.status(502).json({ error: "The chapter couldn't be written just now, try again in a moment." });
  }

  const chapters = await loadChapters(userId);
  res.json({ chapters, uncoveredCount: 0, canReveal: false, revealThreshold: REVEAL_THRESHOLD });
});

export default router;
