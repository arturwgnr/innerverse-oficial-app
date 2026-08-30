import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { generateQuestionProposal } from "../services/questionProposals.js";

const router = Router();

const MOMENTS = ["morning", "afternoon", "night", "decompress"];

router.get("/", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "select profile, updated_at from living_profiles where user_id = $1",
    [req.user.id]
  );
  res.json(rows[0] || { profile: {}, updated_at: null });
});

// The active, user approved question set for one moment. Empty means the
// app still uses the generic starting templates for that moment.
router.get("/question-set/:moment", requireAuth, async (req, res) => {
  if (!MOMENTS.includes(req.params.moment)) return res.status(400).json({ error: "invalid moment" });

  const { rows } = await pool.query(
    "select questions from question_sets where user_id = $1 and moment = $2",
    [req.user.id, req.params.moment]
  );
  res.json(rows[0]?.questions ?? []);
});

// The AI observed something and proposes a structural change. Never applied
// automatically, always lands here as pending until the user responds.
router.post("/question-proposals/generate", requireAuth, async (req, res) => {
  const { moment } = req.body;
  if (!MOMENTS.includes(moment)) return res.status(400).json({ error: "invalid moment" });

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(503).json({ error: "Question suggestions require OPENROUTER_API_KEY to be configured" });
  }

  const [{ rows: currentRows }, { rows: profileRows }] = await Promise.all([
    pool.query("select questions from question_sets where user_id = $1 and moment = $2", [req.user.id, moment]),
    pool.query("select profile from living_profiles where user_id = $1", [req.user.id]),
  ]);

  const suggestion = await generateQuestionProposal({
    moment,
    currentQuestions: currentRows[0]?.questions ?? [],
    livingProfile: profileRows[0]?.profile,
  });

  const { rows } = await pool.query(
    `insert into question_proposals (user_id, moment, proposed_questions, rationale)
     values ($1, $2, $3, $4) returning *`,
    [req.user.id, moment, JSON.stringify(suggestion.questions), suggestion.rationale]
  );

  res.status(201).json(rows[0]);
});

// Structural question changes always require explicit user approval, never applied silently.
router.get("/question-proposals", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `select id, moment, proposed_questions, rationale, status, created_at
     from question_proposals
     where user_id = $1 and status = 'pending'
     order by created_at desc`,
    [req.user.id]
  );
  res.json(rows);
});

const respondSchema = z.object({
  action: z.enum(["accept", "edit", "reject"]),
  editedQuestions: z.array(z.string()).optional(),
});

router.post("/question-proposals/:id/respond", requireAuth, async (req, res) => {
  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { action, editedQuestions } = parsed.data;

  const status = action === "accept" ? "accepted" : action === "edit" ? "edited_accepted" : "rejected";
  const finalQuestions = action === "edit" ? JSON.stringify(editedQuestions || []) : null;

  const { rows } = await pool.query(
    `update question_proposals
     set status = $1,
         proposed_questions = coalesce($2::jsonb, proposed_questions),
         resolved_at = now()
     where id = $3 and user_id = $4
     returning *`,
    [status, finalQuestions, req.params.id, req.user.id]
  );

  const proposal = rows[0];
  if (!proposal) {
    return res.status(404).json({ error: "Proposal not found" });
  }

  if (action !== "reject") {
    await pool.query(
      `insert into question_sets (user_id, moment, questions, updated_at)
       values ($1, $2, $3, now())
       on conflict (user_id, moment) do update set questions = excluded.questions, updated_at = now()`,
      [req.user.id, proposal.moment, JSON.stringify(proposal.proposed_questions)]
    );
  }

  res.json(proposal);
});

export default router;
