import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Custom reason keywords a user has added on top of Fast mode's default set
// (UPDATES.md round 3 #5). The defaults themselves are not stored here, they
// are a fixed, translated list owned by the frontend, this only tracks what
// a specific user has added so it can be offered again on their next log.
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "select label from reason_keywords where user_id = $1 order by created_at asc",
    [req.user.id]
  );
  res.json({ custom: rows.map((r) => r.label) });
});

router.post("/", requireAuth, async (req, res) => {
  const label = typeof req.body.label === "string" ? req.body.label.trim() : "";
  if (!label) return res.status(400).json({ error: "label is required" });

  await pool.query(
    `insert into reason_keywords (user_id, label) values ($1, $2)
     on conflict (user_id, label) do nothing`,
    [req.user.id, label]
  );

  res.status(201).json({ label });
});

export default router;
