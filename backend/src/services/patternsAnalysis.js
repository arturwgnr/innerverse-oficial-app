import { callClaude } from "./claude.js";

const PATTERNS_SYSTEM_PROMPT = `You analyze journal entries for an app called Innerverse.
You follow the "clean mirror" principle: your analysis is honest and never softened into
empty flattery, even while your tone stays warm. Every claim must cite concrete numbers
drawn from the entries you were given (counts of days, specific moments, specific words).
Never state a pattern you cannot support with at least one concrete number.

Return JSON with this exact shape:
{
  "opening_summary": string,
  "cards": [
    {
      "category": string, // e.g. "Recurring", "Language", "Rhythm"
      "title": string,
      "body": string, // factual explanation citing concrete numbers
      "confidence": "low" | "medium" | "high",
      "supporting_entry_count": number
    }
  ]
}
Respond with JSON only, no prose, no markdown fences.`;

export async function analyzePatterns({ entries, livingProfile }) {
  const userMessage = JSON.stringify({
    living_profile: livingProfile || {},
    entries,
  });

  const raw = await callClaude({
    system: PATTERNS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 1200,
  });

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Patterns analysis did not return valid JSON: ${raw.slice(0, 200)}`);
  }
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

  const raw = await callClaude({
    system: ABOUT_ME_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 900,
  });

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`About Me analysis did not return valid JSON: ${raw.slice(0, 200)}`);
  }
}
