import { callClaudeJson } from "./claude.js";

const SYSTEM_PROMPT = `You suggest small evolutions to a journaling app's question set for one moment of the day, based on what the app has learned about a specific user. Never propose a fixed topical track (finance, relationships, career, etc), that goes against this product's design, the questions stay general purpose. Keep questions short, direct, and in the same tone as the existing ones. Write the rationale as a short message addressed directly to the user explaining what you noticed. Respond with JSON only, no prose, no markdown fences, in this exact shape: { "rationale": string, "questions": string[] }.`;

export async function generateQuestionProposal({ moment, currentQuestions, livingProfile }) {
  const userMessage = JSON.stringify({ moment, current_questions: currentQuestions, living_profile: livingProfile || {} });

  return callClaudeJson({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 700,
  });
}
