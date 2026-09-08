import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Day-grouped timeline: every entry_analyses row plus its observations
// (insights.kind = 'entry_analysis_observation'), most recent first.
// Grouping into calendar days happens client side (see Analysis.jsx),
// same local-date approach as the Calendar page, to avoid the UTC shift
// that once misplaced entries into the wrong day.
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `select ea.id as analysis_id, ea.title, ea.entry_id, ea.created_at,
            i.id as observation_id, i.body as observation_body, i.position
     from entry_analyses ea
     left join insights i on i.analysis_id = ea.id
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
        observations: [],
      });
    }
    if (row.observation_id) {
      analysesById.get(row.analysis_id).observations.push({ id: row.observation_id, body: row.observation_body });
    }
  }

  res.json({ analyses: [...analysesById.values()] });
});

export default router;
