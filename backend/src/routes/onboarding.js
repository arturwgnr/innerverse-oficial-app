import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { mergeProfile, buildOnboardingProfileSeed } from "../services/profileMerge.js";

const router = Router();

const onboardingSchema = z.object({
  birthDate: z.string().date(),
  responses: z.record(z.string(), z.any()),
});

router.get("/status", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "select 1 from onboarding_responses where user_id = $1",
    [req.user.id]
  );
  res.json({ completed: rows.length > 0 });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { birthDate, responses } = parsed.data;

  await pool.query(
    `insert into onboarding_responses (user_id, birth_date, responses)
     values ($1, $2, $3)
     on conflict (user_id) do update set birth_date = excluded.birth_date, responses = excluded.responses`,
    [req.user.id, birthDate, responses]
  );

  const seed = buildOnboardingProfileSeed({ birthDate, responses });

  // The onboarding record above is already saved. An AI provider hiccup
  // (rate limit, no credits, network blip) must degrade to the raw seed
  // profile, not fail the whole request, that's throwing away real data
  // the user just gave us over a step that is a nice-to-have enrichment.
  let profile = seed;
  if (process.env.OPENROUTER_API_KEY) {
    try {
      profile = await mergeProfile({
        currentProfile: {},
        evidence: seed,
        evidenceType: "onboarding",
      });
    } catch (err) {
      console.warn("Onboarding profile merge failed, falling back to raw seed:", err.message);
    }
  }

  await pool.query(
    `insert into living_profiles (user_id, profile)
     values ($1, $2)
     on conflict (user_id) do update set profile = excluded.profile, updated_at = now()`,
    [req.user.id, profile]
  );

  res.status(201).json({ completed: true });
});

export default router;
