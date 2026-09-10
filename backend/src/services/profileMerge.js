import { callLLMJson } from "./llm.js";

const MERGE_SYSTEM_PROMPT = `You maintain a living profile for a journaling app called Innerverse.
The profile is a compact JSON object (never longer than roughly 2500 tokens) describing
who the user is, based only on evidence from their entries and their own corrections.
You will be given the current profile JSON and a new piece of evidence (a journal entry,
an onboarding answer set, or a correction the user made to a past insight).
Return the FULL updated profile JSON, merged, deduplicated, and trimmed to stay lean.
Never invent facts that are not supported by the evidence you were given or already in the profile.
If a correction contradicts something in the profile, prefer the correction, it is ground truth.
Respond with JSON only, no prose, no markdown fences.`;

export async function mergeProfile({ currentProfile, evidence, evidenceType }) {
  const userMessage = JSON.stringify({
    current_profile: currentProfile || {},
    evidence_type: evidenceType,
    evidence,
  });

  // No responseSchema on purpose: the profile is deliberately open ended
  // (see prompt above, "compact JSON object... no fixed fields"), forcing a
  // fixed shape here would fight the whole design. responseMimeType alone
  // (set inside callGemini) still guarantees syntactically valid JSON.
  // cheap: true on OpenRouter fallback (UPDATES.md "Prompt: fallback
  // automático Gemini -> OpenRouter (Claude)"): this runs on every single
  // entry, the high volume/low stakes background call OPENROUTER_MODEL_CHEAP
  // exists for.
  return callLLMJson({
    system: MERGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 3000,
    cheap: true,
  });
}

export function buildOnboardingProfileSeed({ preferredName, birthDate, responses }) {
  return {
    preferred_name: preferredName,
    birth_date: birthDate,
    onboarding_answers: responses,
  };
}
