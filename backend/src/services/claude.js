const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Claude called through OpenRouter's OpenAI-compatible endpoint (see
// OPENROUTER_API_KEY / OPENROUTER_MODEL in .env.example), rather than the
// Anthropic API directly. Every prompt instructs Claude to never use an em
// dash in generated copy, per the project wide writing rule in CLAUDE.md.
const NO_EM_DASH_RULE =
  "Never use the em dash character in your response, under any circumstance. Use a period, comma, or parentheses instead.";

export async function callClaude({ system, messages, maxTokens = 1024 }) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const systemContent = system ? `${system}\n\n${NO_EM_DASH_RULE}` : NO_EM_DASH_RULE;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      // Optional, recommended by OpenRouter for attribution on their dashboard.
      "http-referer": process.env.FRONTEND_URL || "http://localhost:5173",
      "x-title": "Innerverse",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5",
      max_tokens: maxTokens,
      messages: [{ role: "system", content: systemContent }, ...messages],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error(`OpenRouter response had no choices: ${JSON.stringify(data)}`);
  }

  return choice.message.content;
}
