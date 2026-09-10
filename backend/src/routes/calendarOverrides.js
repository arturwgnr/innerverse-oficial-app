import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// One row per divergent day the user has already resolved, so the calendar
// does not ask the tie break question again on every visit.
router.get("/", requireAuth, async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: "year and month are required" });

  const start = `${year}-${String(month).padStart(2, "0")}-01`;

  const { rows } = await pool.query(
    `select day, mood from day_mood_overrides
     where user_id = $1 and day >= $2::date and day < ($2::date + interval '1 month')`,
    [req.user.id, start]
  );

  const overrides = {};
  for (const row of rows) overrides[row.day.toISOString().slice(0, 10)] = row.mood;
  res.json(overrides);
});

const overrideSchema = z.object({ day: z.string().date(), mood: z.number().int().min(1).max(6) });

router.put("/", requireAuth, async (req, res) => {
  const parsed = overrideSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { day, mood } = parsed.data;
  await pool.query(
    `insert into day_mood_overrides (user_id, day, mood, updated_at)
     values ($1, $2, $3, now())
     on conflict (user_id, day) do update set mood = excluded.mood, updated_at = now()`,
    [req.user.id, day, mood]
  );

  res.json({ ok: true });
});

export default router;
