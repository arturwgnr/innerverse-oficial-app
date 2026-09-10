import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { maybeGenerateEntryAnalysis } from "./entries.js";

const router = Router();

// Recovers entries whose analysis job never actually ran: it's scheduled via
// an in-memory delayed call in routes/entries.js (POST /entries), which does
// not survive a dev-server restart (node --watch) or a process crash in that
// window, leaving analysis_status stuck at 'pending' forever with nothing to
// ever retry it (UPDATES.md round 3, "analysis regenerating instead of
// loading saved result" bug report; the user-visible symptom, a card stuck
// forever on "Reading this one now"). Reopening the Analysis page is the
// natural place to sweep for these and retry, not awaited so the page still
// loads immediately off whatever is already saved.
// Also sweeps stale 'processing' rows (UPDATES.md round 4 #4): a claimed
// entry whose generation call never finished (crash, restart mid-flight)
// would otherwise sit at 'processing' forever with nothing to ever retry it.
// Reset to 'pending' first so maybeGenerateEntryAnalysis's own atomic claim
// picks it up cleanly rather than calling it on a 'processing' row directly.
async function recoverStuckAnalyses(userId) {
  const { rows } = await pool.query(
    `select id, moment, mode, text_content, mood, bullets, occurred_at
     from entries
     where user_id = $1
       and (
         (analysis_status = 'pending' and updated_at < now() - interval '2 minutes')
         or (analysis_status = 'processing' and updated_at < now() - interval '5 minutes')
       )`,
    [userId]
  );
  for (const entry of rows) {
    await pool.query("update entries set analysis_status = 'pending' where id = $1", [entry.id]);
    maybeGenerateEntryAnalysis({ userId, entry });
  }
}

// Day-grouped timeline: every entry_analyses row plus its observations
// (insights.kind = 'entry_analysis_observation'), most recent first.
// Grouping into calendar days happens client side (see Analysis.jsx),
// same local-date approach as the Calendar page, to avoid the UTC shift
// that once misplaced entries into the wrong day. Also joins the source
// entry's moment/mood, UPDATES.md round 3 #3's history filter needs both
// and neither was exposed here before.
// The lateral join to corrections (UPDATES.md round 5 #4) surfaces each
// observation's latest verdict, so "True"/"That's not it" survives a
// reload instead of resetting to unanswered every time (verdicts were
// already being recorded, just never read back into this response).
router.get("/", requireAuth, async (req, res) => {
  recoverStuckAnalyses(req.user.id);

  const { rows } = await pool.query(
    `select ea.id as analysis_id, ea.title, ea.entry_id, ea.created_at,
            e.moment, e.mood, e.mode,
            i.id as observation_id, i.body as observation_body, i.position,
            c.verdict as observation_verdict
     from entry_analyses ea
     join entries e on e.id = ea.entry_id
     left join insights i on i.analysis_id = ea.id
     left join lateral (
       select verdict from corrections
       where insight_id = i.id
       order by created_at desc
       limit 1
     ) c on true
     where ea.user_id = $1
     order by ea.created_at desc, i.position asc`,
    [req.user.id]
  );

  const analysesById = new Map();
  for (const row of rows) {
    if (!analysesById.has(row.analysis_id)) {
      analysesById.set(row.analysis_id, {
        id: row.analysis_id,
        title: row.title,
        entryId: row.entry_id,
        createdAt: row.created_at,
        moment: row.moment,
        mood: row.mood,
        // UPDATES.md round 6: pause/mindfulness entries get their own tag in
        // the Analysis timeline, same treatment as the mood tags.
        mode: row.mode,
        observations: [],
      });
    }
    if (row.observation_id) {
      analysesById.get(row.analysis_id).observations.push({
        id: row.observation_id,
        body: row.observation_body,
        verdict: row.observation_verdict || null,
      });
    }
  }

  res.json({ analyses: [...analysesById.values()] });
});

// Manual retry path for a card stuck at 'failed' (UPDATES.md round 4 #3):
// the automatic recoverStuckAnalyses() sweep above only ever catches rows
// still at 'pending', a 'failed' row needs its own explicit endpoint since
// nothing else ever revisits it.
router.post("/:entryId/retry", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `select id, moment, mode, text_content, mood, bullets, occurred_at
     from entries where id = $1 and user_id = $2 and analysis_status = 'failed'`,
    [req.params.entryId, req.user.id]
  );
  const entry = rows[0];
  if (!entry) {
    return res.status(404).json({ error: "This entry isn't eligible for a retry right now." });
  }
  await pool.query("update entries set analysis_status = 'pending' where id = $1", [entry.id]);
  res.json({ status: "pending" });
  maybeGenerateEntryAnalysis({ userId: req.user.id, entry });
});

// Dismisses a failed card without retrying (UPDATES.md round 4 #3's "×"):
// 'skipped' is the same silent, non-broken-looking status already used for
// entries that never got a deep read for other reasons (no API key, daily
// cap), so it simply stops showing up in the timeline.
router.post("/:entryId/dismiss", requireAuth, async (req, res) => {
  const { rowCount } = await pool.query(
    `update entries set analysis_status = 'skipped' where id = $1 and user_id = $2 and analysis_status = 'failed'`,
    [req.params.entryId, req.user.id]
  );
  if (rowCount === 0) {
    return res.status(404).json({ error: "This entry isn't eligible to dismiss right now." });
  }
  res.json({ status: "skipped" });
});

// Removes an analysis entirely (UPDATES.md round 4 #4's "That's not it"
// delete confirmation). Cascades to its insights rows via the FK, the
// correction record itself (routes/corrections.js) is written separately
// and survives this, it's tied to the insight id, not the analysis.
router.delete("/:analysisId", requireAuth, async (req, res) => {
  const { rowCount } = await pool.query(
    `delete from entry_analyses where id = $1 and user_id = $2`,
    [req.params.analysisId, req.user.id]
  );
  if (rowCount === 0) {
    return res.status(404).json({ error: "Analysis not found." });
  }
  res.status(204).end();
});

export default router;
