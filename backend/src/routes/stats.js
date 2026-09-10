import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Aggregate metrics for the Stats page (EDITS.md round 2 #1's navigation
// overhaul: "entry counts, frequency of each mood, and other relevant
// metrics, shown as charts"). Everything here is plain SQL aggregation, no
// AI call, cheap enough to recompute on every visit rather than caching.
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.id;

  const [totalRows, moodRows, momentRows, weeklyRows, streakRows] = await Promise.all([
    pool.query("select count(*)::int as count from entries where user_id = $1", [userId]),
    pool.query(
      `select mood, count(*)::int as count from entries
       where user_id = $1 and mood is not null
       group by mood order by mood`,
      [userId]
    ),
    pool.query(
      `select moment, count(*)::int as count from entries
       where user_id = $1 group by moment`,
      [userId]
    ),
    // Last 8 calendar weeks (Monday-start), including weeks with zero entries
    // so the chart doesn't silently skip a quiet week.
    pool.query(
      `select date_trunc('week', occurred_at)::date as week_start, count(*)::int as count
       from entries
       where user_id = $1 and occurred_at >= now() - interval '8 weeks'
       group by week_start
       order by week_start`,
      [userId]
    ),
    // Distinct local calendar days with at least one entry, most recent
    // first, used below to compute a simple consecutive-day streak.
    pool.query(
      `select distinct occurred_at::date as day from entries
       where user_id = $1
       order by day desc
       limit 400`,
      [userId]
    ),
  ]);

  const daySet = new Set(streakRows.rows.map((r) => r.day.toISOString().slice(0, 10)));
  let streak = 0;
  if (daySet.size) {
    const cursor = new Date();
    // No entry yet today doesn't break a streak still in progress, start
    // counting from yesterday instead.
    if (!daySet.has(cursor.toISOString().slice(0, 10))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  res.json({
    totalEntries: totalRows.rows[0].count,
    byMood: moodRows.rows.map((r) => ({ mood: r.mood, count: r.count })),
    byMoment: momentRows.rows.map((r) => ({ moment: r.moment, count: r.count })),
    weekly: weeklyRows.rows.map((r) => ({ weekStart: r.week_start.toISOString().slice(0, 10), count: r.count })),
    currentStreak: streak,
  });
});

export default router;
