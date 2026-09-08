const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Claude called through OpenRouter's OpenAI-compatible endpoint (see
// OPENROUTER_API_KEY / OPENROUTER_MODEL in .env.example), rather than the
// Anthropic API directly. Every prompt instructs Claude to never use an em
// dash in generated copy, per the project wide writing rule in CLAUDE.md.
const NO_EM_DASH_RULE =
  "Never use the em dash character in your response, under any circumstance. Use a period, comma, or parentheses instead.";

export async function callClaude({ system, messages, maxTokens = 1024, model }) {
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
      model: model || process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5",
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

// Strips a ```json fence around a response, if the model added one despite
// being told not to. Anything else is left untouched for JSON.parse to judge.
function stripCodeFence(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

// Same call as callClaude, but for prompts that must return JSON: parses the
// response and, if that fails, retries once with a stricter instruction
// instead of giving up immediately (UPDATES.md #5, entries were silently
// dropped whenever the model returned non-JSON prose around the object).
export async function callClaudeJson({ system, messages, maxTokens = 1024, model }) {
  const first = await callClaude({ system, messages, maxTokens, model });
  try {
    return JSON.parse(stripCodeFence(first));
  } catch {
    const retry = await callClaude({
      system,
      messages: [
        ...messages,
        { role: "assistant", content: first },
        {
          role: "user",
          content:
            "That response was not valid JSON. Respond again with ONLY the JSON object, no prose, no markdown fences, no explanation.",
        },
      ],
      maxTokens,
      model,
    });
    try {
      return JSON.parse(stripCodeFence(retry));
    } catch {
      throw new Error(`Response did not return valid JSON after a retry: ${retry.slice(0, 200)}`);
    }
  }
}
