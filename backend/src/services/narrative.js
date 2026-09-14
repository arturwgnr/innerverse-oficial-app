import { callLLMJson } from "./llm.js";

// Round 7 (adicional): "Quem é {user}", a flowing narrative in the Oracle's
// voice describing who this person is, built from their living_profile
// (the compact structured summary profileMerge.js already maintains), not
// their raw entries. This is a different prompt from profileMerge.js on
// purpose (that one exists to keep the profile JSON itself accurate, this
// one exists to turn it into prose a person actually reads), and different
// from the entry analysis prompt in analysis.js (that one is grounded in
// one specific entry, this one is grounded in the accumulated profile as a
// whole).
const CHRONICLE_SYSTEM_PROMPT = `You write a flowing narrative for a journaling app called Innerverse, in the voice of
"the Oracle", a companion that has been paying attention to this person across everything they have written. This is
not a report and not a list of bullet points, it is prose: a few connected paragraphs describing who this person is,
based only on the living_profile you are given (a compact structured summary the app has built up about them over
time) and, when it helps ground something concrete, a few recent chapter titles from their analysis history as
texture, never as the main substance.

Follow the "clean mirror" principle: honest, never softened into empty flattery, and never inventing anything not
actually supported by the profile you were given. Warm in tone, but plain and specific in substance, the mystical
register is about how this is written, not license to be vague or overly poetic. Ground every real claim in
something the profile actually contains, if the profile is thin, say less, do not pad with generalities that could
describe anyone.

Return JSON with this exact shape:
{
  "paragraphs": [string] // 3 to 5 paragraphs, each 2 to 4 sentences, forming one connected narrative about who this person is
}
Respond with JSON only, no prose, no markdown fences.`;

const CHRONICLE_SCHEMA = {
  type: "OBJECT",
  properties: {
    paragraphs: { type: "ARRAY", items: { type: "STRING" }, minItems: 2, maxItems: 5 },
  },
  required: ["paragraphs"],
};

export async function generateChronicle({ livingProfile, recentTitles }) {
  const userMessage = JSON.stringify({
    living_profile: livingProfile || {},
    recent_chapter_titles: recentTitles || [],
  });

  return callLLMJson({
    system: CHRONICLE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 900,
    responseSchema: CHRONICLE_SCHEMA,
  });
}

// Round 7 (adicional): periodic chapters, "what you lived", a more
// elaborate chapter covering a specific stretch of the journey (10 entries
// worth), built from the entry_analyses already generated for those entries
// (titles + paragraphs), not their raw text and not the living_profile.
// Cheaper than re-reading raw entries, and keeps the chapter consistent
// with whatever already passed through the "clean mirror" once at the
// per-entry level, this just finds the throughline across several of those
// readings instead of writing a brand new one from scratch.
const CHAPTER_SYSTEM_PROMPT = `You write one chapter of an ongoing chronicle for a journaling app called Innerverse,
"History Mode", covering a specific stretch of this person's life as reflected in the deep analyses already written
about their entries during that stretch. You are given a list of those analyses (each with its own chapter-heading
title and paragraphs), your job is to weave them into ONE cohesive new chapter looking back across all of them
together, finding the throughline connecting them, not concatenating or summarizing them one at a time.

Follow the "clean mirror" principle: honest, never softened into flattery, grounded only in what the analyses you
were given actually say, never inventing anything beyond that. The title is a chapter heading in the same evocative,
chronicle register as the analyses themselves (for example "The Weight Before Dawn" or "A Quiet Turning"), specific
to what THIS stretch actually held, never a generic label like "Chapter Summary" or "Recent Entries".

Return JSON with this exact shape:
{
  "title": string, // a chapter-heading-style title, evocative but specific to this stretch, see above
  "paragraphs": [string] // 2 to 4 paragraphs, forming one connected reading across this whole stretch
}
Respond with JSON only, no prose, no markdown fences.`;

const CHAPTER_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    paragraphs: { type: "ARRAY", items: { type: "STRING" }, minItems: 1, maxItems: 4 },
  },
  required: ["title", "paragraphs"],
};

export async function generateChapter({ analyses }) {
  const userMessage = JSON.stringify({ analyses });

  // cheap: true (UPDATES.md's OPENROUTER_MODEL_CHEAP distinction) would
  // undersell this one on the OpenRouter fallback path, it is meant to feel
  // like a real chapter, not a background bookkeeping call.
  return callLLMJson({
    system: CHAPTER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 900,
    responseSchema: CHAPTER_SCHEMA,
  });
}
