import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// Broadcast "what's new" notifications (topbar bell icon), same rows for
// every user, `read` computed per the requesting user via the left join
// against notification_reads.
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `select n.id, n.title, n.body, n.created_at,
            (nr.user_id is not null) as read
     from notifications n
     left join notification_reads nr on nr.notification_id = n.id and nr.user_id = $1
     order by n.created_at desc`,
    [req.user.id]
  );
  res.json(rows);
});

// Marks every current notification read for this user in one go, called
// when the bell panel opens rather than requiring a request per item.
router.post("/read-all", requireAuth, async (req, res) => {
  await pool.query(
    `insert into notification_reads (user_id, notification_id)
     select $1, id from notifications
     on conflict (user_id, notification_id) do nothing`,
    [req.user.id]
  );
  res.status(204).end();
});

export default router;
