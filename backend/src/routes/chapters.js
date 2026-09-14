import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { generateChapter } from "../services/narrative.js";

const router = Router();

// Triggers every 10 new entries (UPDATES.md round 7 adicional), a separate
// counter from the general chronicle's 5-entry threshold, each chapter
// covers exactly this many entries.
const CHAPTER_SIZE = 10;

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

// Lightweight, no LLM call, no chapter content: just how many entries are
// left before the next chapter unlocks, for the sidebar's subtle "the
// Oracle is writing" indicator (AppShell.jsx), polled far more often than
// anyone actually opens the chapters page itself.
router.get("/countdown", requireAuth, async (req, res) => {
  const uncovered = await uncoveredEntries(req.user.id);
  res.json({ entriesUntilNext: Math.max(0, CHAPTER_SIZE - uncovered.length) });
});

// "What you lived", periodic chapters covering a stretch of the journey
// (see services/narrative.js), each its own row (period_type = 'month',
// reusing the field name loosely, not a literal calendar month), an archive
// that only grows, unlike the chronicle's single upserted row. Numbered by
// position (oldest = Chapter 1) rather than a stored column, computed here
// from period_start order.
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const uncovered = await uncoveredEntries(userId);

  if (uncovered.length >= CHAPTER_SIZE && (process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY)) {
    const batch = uncovered.slice(0, CHAPTER_SIZE);
    const entryIds = batch.map((e) => e.id);
    try {
      const { rows } = await pool.query(
        `select ea.id as analysis_id, ea.title, i.body, i.position
         from entry_analyses ea
         left join insights i on i.analysis_id = ea.id
         where ea.entry_id = any($1::uuid[])
         order by ea.created_at asc, i.position asc`,
        [entryIds]
      );
      // Grouped into {title, paragraphs} per analysis, not flat rows with
      // the title repeated once per paragraph, a cleaner shape matching
      // what the prompt actually describes receiving.
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
    } catch (err) {
      // A missed chapter this visit isn't fatal, the same uncovered entries
      // are still there next time uncoveredEntries() runs and will retry.
      console.warn("Chapter generation failed:", err.message);
    }
  }

  const { rows: chapterRows } = await pool.query(
    `select id, period_start, period_end, content, created_at
     from narrative_summaries
     where user_id = $1 and period_type = 'month'
     order by period_start asc`,
    [userId]
  );

  const chapters = chapterRows.map((row, i) => {
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
  });

  const remaining = await uncoveredEntries(userId);
  res.json({ chapters, entriesUntilNext: Math.max(0, CHAPTER_SIZE - remaining.length) });
});

export default router;
