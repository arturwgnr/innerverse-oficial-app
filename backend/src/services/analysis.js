import { callGemini } from "./gemini.js";

// Deep, standalone analysis of a single journal entry (replaces the old
// cross-entry Patterns concept, see CLAUDE.md/UPDATES.md). Grounded in the
// living profile (accumulated context) so it reads the entry in light of
// what the app already knows, not in isolation, but the analysis itself
// must be specific to this entry, never a generic recap of the user's history.
const ENTRY_ANALYSIS_SYSTEM_PROMPT = `You write a deep, standalone analysis of a single journal entry for an
app called Innerverse. You follow the "clean mirror" principle: your analysis is honest and
never softened into empty flattery, even while your tone stays warm. Ground every observation in
something actually present in the entry or in a real contrast with the user's living profile,
never a vague generality. Some entries are "fast" mode: only a mood and a few short bullets, no
full text, in that case keep the analysis appropriately brief and grounded only in what's
actually there, don't invent depth from nothing.

Return JSON with this exact shape:
{
  "title": string, // unique and specific to what THIS entry actually reveals, never a generic
                    // label like "Morning Analysis" or "Entry from Aug 30"
  "observations": [string, string] // 2 to 4 short, honest, standalone observations
}
Respond with JSON only, no prose, no markdown fences.`;

const ENTRY_ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    observations: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["title", "observations"],
};

export async function generateEntryAnalysis({ entry, livingProfile, recentEntries }) {
  const userMessage = JSON.stringify({
    living_profile: livingProfile || {},
    recent_entries: recentEntries || [],
    entry: {
      moment: entry.moment,
      mode: entry.mode,
      text_content: entry.text_content,
      mood: entry.mood,
      bullets: entry.bullets,
      occurred_at: entry.occurred_at,
    },
  });

  return callGemini({
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

// Gradual on purpose (UPDATES.md #10): a handful of entries should read as a
// small but real start, not a trivial jump, and the curve should still feel
// far from "done" well into regular use. ~6% at 5 entries, ~22% at 20,
// ~46% at 50, ~71% at 100, ~92% at 200, asymptotic toward (but never
// reaching) 100.
export function computeKnowledgePercent(entryCount) {
  const value = 99 * (1 - Math.exp(-entryCount / 80));
  return Math.round(value);
}

export async function analyzeAboutMe({ entries, livingProfile }) {
  const userMessage = JSON.stringify({
    living_profile: livingProfile || {},
    entries,
  });

  return callGemini({
    system: ABOUT_ME_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 900,
    responseSchema: ABOUT_ME_SCHEMA,
  });
}
