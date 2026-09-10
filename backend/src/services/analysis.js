import { callLLMJson } from "./llm.js";
import { describeMood } from "../lib/moods.js";

// Deep, standalone analysis of a single journal entry (replaces the old
// cross-entry Patterns concept, see CLAUDE.md/UPDATES.md). Grounded in the
// living profile (accumulated context) so it reads the entry in light of
// what the app already knows, not in isolation, but the analysis itself
// must be specific to this entry, never a generic recap of the user's history.
//
// Shape is a short connected narrative, not a flat list of disconnected
// one-liners (UPDATES.md "Analysis quality and reliability", 2026-09-08):
// Artur compared the old flat observations against a much richer narrative
// reading he used to get manually from a Claude chat, and the gap was the
// output shape, generateEntryAnalysis already gets the full living_profile
// and recent entries. This does not need to reach that length or structure
// (that belongs to the still unbuilt weekly/monthly synthesis layer from
// JOURNAL.md section 6), it just needs the 1 to 2 paragraphs it does return
// to read as one throughline instead of isolated bullet points.
// "History Mode" (UPDATES.md round 3 #2): the title is where the narrative
// framing lives, it should read like a chapter heading in a chronicle
// unfolding about this person's life, not a report label. The paragraphs
// underneath stay exactly as honest and specific as before, narrative
// framing is presentation on top of that substance, never a license to
// soften or invent drama that is not actually in the entry.
const ENTRY_ANALYSIS_SYSTEM_PROMPT = `You write a deep, standalone analysis of a single journal entry for an
app called Innerverse, styled as one entry in a chronicle being written about this person's life as it
happens, "History Mode". You follow the "clean mirror" principle: your analysis is honest and never
softened into empty flattery, even while your tone stays warm. Ground everything in something actually
present in the entry or in a real contrast with the user's living profile and recent entries, never a vague
generality. Some entries are "fast" mode: only a mood and a few short bullets, no full text, in that case
keep the analysis appropriately brief and grounded only in what's actually there, don't invent depth from
nothing. Some entries are "mindfulness" mode: a brief reflection written right after a guided meditation
session, not a regular journal entry, read it in that gentler, more settled register, don't treat it like an
account of the person's whole day.

The title is a chapter heading, not a report label: evocative and a little poetic, in the register of "The
Weight Before Dawn" or "A Quiet Turning" or "What the Silence Held", never a flat descriptor like "Morning
Analysis" or "Entry from Aug 30" or "Work Stress Update". It still has to be genuinely specific to what
THIS entry reveals, an evocative title grounded in nothing is worse than a plain one, the chronicle framing
is about how it's written, not permission to go generic-poetic or invent a drama that isn't actually there.

Write the analysis itself as a short connected narrative, not a list of disconnected observations. Each
paragraph should read today's entry through the living_profile and recent_entries you were given, and if
you write two paragraphs, the second should build on or complicate the first, not restate it from a
different angle or introduce an unrelated point. It does not need to be long: it needs to be impactful and
useful from the very first read, one genuinely specific insight beats several generic ones. This part stays
plain and direct, the poetic register belongs to the title alone, do not let the prose itself turn purple.

Return JSON with this exact shape:
{
  "title": string, // a chapter-heading-style title, evocative but specific to this entry, see above
  "paragraphs": [string] // 1 to 2 paragraphs, each 2 to 4 sentences, forming one connected reading
}
Respond with JSON only, no prose, no markdown fences.`;

const ENTRY_ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    paragraphs: { type: "ARRAY", items: { type: "STRING" }, minItems: 1, maxItems: 2 },
  },
  required: ["title", "paragraphs"],
};

export async function generateEntryAnalysis({ entry, livingProfile, recentEntries }) {
  // mood is a bare 1-6 integer on the row (UPDATES.md round 3 #2), described
  // here (e.g. "Bright (5/6)") so a fresh model call has the same context a
  // reader with the app's own locale files would, instead of an unexplained
  // number.
  const userMessage = JSON.stringify({
    living_profile: livingProfile || {},
    recent_entries: (recentEntries || []).map((e) => ({ ...e, mood: describeMood(e.mood) })),
    entry: {
      moment: entry.moment,
      mode: entry.mode,
      text_content: entry.text_content,
      mood: describeMood(entry.mood),
      bullets: entry.bullets,
      occurred_at: entry.occurred_at,
    },
  });

  // Flagship OpenRouter model on fallback (not the cheap one): this is the
  // deep analysis the user actually reads, see UPDATES.md "Prompt: fallback
  // automático Gemini -> OpenRouter (Claude)".
  return callLLMJson({
    system: ENTRY_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 500,
    responseSchema: ENTRY_ANALYSIS_SCHEMA,
  });
}

// knowledge_percent used to be an LLM guess, dropped because it climbed
// erratically (8% after a handful of entries one run, something else the
// next). It's now computed deterministically from entry count, see
// computeKnowledgePercent() in this file, so it can only move predictably.
const ABOUT_ME_SYSTEM_PROMPT = `You summarize what an app called Innerverse has come to understand about a
user, based only on their journal entries and living profile. Split understandings into two
dimensions: "light" (genuine strengths and patterns that are already going well) and "dark"
(blind spots, things the user may be avoiding facing). Stay honest per the clean mirror
principle, never flatten a blind spot into something falsely positive, but deliver it without
unnecessary weight.

Return JSON with this exact shape:
{
  "light": [ { "title": string, "body": string } ],
  "dark": [ { "title": string, "body": string } ]
}
Respond with JSON only, no prose, no markdown fences.`;

const ABOUT_ME_SCHEMA = {
  type: "OBJECT",
  properties: {
    light: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { title: { type: "STRING" }, body: { type: "STRING" } },
        required: ["title", "body"],
      },
    },
    dark: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { title: { type: "STRING" }, body: { type: "STRING" } },
        required: ["title", "body"],
      },
    },
  },
  required: ["light", "dark"],
};

// Gradual on purpose (UPDATES.md #10, slowed further in round 4 #2: ~12
// entries was landing near 14%, founder wanted closer to 7%). Denominator
// widened from 80 to 160, same asymptotic shape, just a slower early climb.
// ~4% at 5 entries, ~7% at 12, ~12% at 20, ~28% at 50, ~46% at 100, ~71% at
// 200, asymptotic toward (but never reaching) 100.
export function computeKnowledgePercent(entryCount) {
  const value = 99 * (1 - Math.exp(-entryCount / 160));
  return Math.round(value);
}

export async function analyzeAboutMe({ entries, livingProfile }) {
  const userMessage = JSON.stringify({
    living_profile: livingProfile || {},
    entries: entries.map((e) => ({ ...e, mood: describeMood(e.mood) })),
  });

  // Flagship OpenRouter model on fallback, same reasoning as
  // generateEntryAnalysis above: also deep, user-facing content.
  return callLLMJson({
    system: ABOUT_ME_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 900,
    responseSchema: ABOUT_ME_SCHEMA,
  });
}
