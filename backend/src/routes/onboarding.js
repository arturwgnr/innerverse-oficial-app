import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { mergeProfile, buildOnboardingProfileSeed } from "../services/profileMerge.js";

const router = Router();

const onboardingSchema = z.object({
  preferredName: z.string().trim().min(1),
  birthDate: z.string().date(),
  responses: z.record(z.string(), z.any()),
});

router.get("/status", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "select preferred_name from onboarding_responses where user_id = $1",
    [req.user.id]
  );
  res.json({ completed: rows.length > 0, preferredName: rows[0]?.preferred_name || null });
});

// AI enrichment happens after the response, not before it (EDITS.md round 3,
// "onboarding gets stuck": this used to await mergeProfile, a Gemini call,
// before responding at all, and Gemini's free tier 429 retry/backoff in
// callGemini can legitimately take 10s of seconds. That made the whole
// "Enter my innerverse" tap feel frozen. The raw seed profile is saved
// immediately, synchronously, so the client can move on right away, the
// richer AI merge fills in afterward same as a normal entry save does.
async function enrichProfileInBackground({ userId, seed }) {
  if (!process.env.GEMINI_API_KEY) return;
  try {
    const profile = await mergeProfile({
      currentProfile: {},
      evidence: seed,
      evidenceType: "onboarding",
    });
    await pool.query(
      `insert into living_profiles (user_id, profile)
       values ($1, $2)
       on conflict (user_id) do update set profile = excluded.profile, updated_at = now()`,
      [userId, profile]
    );
  } catch (err) {
    console.warn("Onboarding profile enrichment failed, raw seed profile stays in place:", err.message);
  }
}

router.post("/", requireAuth, async (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { preferredName, birthDate, responses } = parsed.data;

  // Defense in depth (EDITS.md round 5: onboarding only runs once per user).
  // The frontend route guard is the primary defense, this stops a resubmit
  // from an already-onboarded user from silently overwriting real answers
  // even if that guard is ever bypassed.
  const existing = await pool.query("select 1 from onboarding_responses where user_id = $1", [req.user.id]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: "Onboarding already completed. Edit answers from Settings instead." });
  }

  await pool.query(
    `insert into onboarding_responses (user_id, preferred_name, birth_date, responses)
     values ($1, $2, $3, $4)
     on conflict (user_id) do update set preferred_name = excluded.preferred_name, birth_date = excluded.birth_date, responses = excluded.responses`,
    [req.user.id, preferredName, birthDate, responses]
  );

  const seed = buildOnboardingProfileSeed({ preferredName, birthDate, responses });

  // Raw seed saved right away, synchronously, so the profile row exists
  // (and reads sensibly) the instant onboarding completes, not only once
  // the background AI merge below finishes.
  await pool.query(
    `insert into living_profiles (user_id, profile)
     values ($1, $2)
     on conflict (user_id) do update set profile = excluded.profile, updated_at = now()`,
    [req.user.id, seed]
  );

  res.status(201).json({ completed: true });

  enrichProfileInBackground({ userId: req.user.id, seed });
});

export default router;
