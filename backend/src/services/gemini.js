const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Same project wide writing rule as claude.js, duplicated rather than
// imported: services/claude.js stays untouched as the manual fallback path
// (see UPDATES.md, "model provider decision"), so nothing here should
// depend on it.
const NO_EM_DASH_RULE =
  "Never use the em dash character in your response, under any circumstance. Use a period, comma, or parentheses instead.";

const ROLE_MAP = { user: "user", assistant: "model" };

// Primary LLM call for entry analysis, About Me, and profile merge
// (UPDATES.md: OpenRouter kept hitting 402s with a real Claude model, and
// swapping to a free OpenRouter reasoning model broke JSON output because
// the model spent its whole maxTokens budget "thinking" before answering).
// Gemini's free tier needs no credit card and has native structured JSON
// output, which fixes the invalid JSON failure mode at the source instead
// of only retrying after it happens.
//
// responseSchema is optional: pass one when the caller has a fixed shape
// (entry analysis, About Me), omit it when the output is deliberately
// open ended (profile merge has no fixed fields by design), responseMimeType
// alone is still enough to guarantee syntactically valid JSON either way.
export async function callGemini({ system, messages, maxTokens = 1024, model, responseSchema }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const systemText = system ? `${system}\n\n${NO_EM_DASH_RULE}` : NO_EM_DASH_RULE;
  const resolvedModel = model || process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const generationConfig = {
    maxOutputTokens: maxTokens,
    responseMimeType: "application/json",
    // Disables extended "thinking" (supported on the 2.5 flash family this
    // default targets). Otherwise thinking tokens come out of the same
    // maxOutputTokens budget as the actual answer, exactly the failure mode
    // that broke deepseek-r1:free on OpenRouter (see UPDATES.md), just with
    // a different provider.
    thinkingConfig: { thinkingBudget: 0 },
  };
  if (responseSchema) generationConfig.responseSchema = responseSchema;

  const response = await fetch(`${API_BASE}/${resolvedModel}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: messages.map((m) => ({
        role: ROLE_MAP[m.role] || "user",
        parts: [{ text: m.content }],
      })),
      generationConfig,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text || "").join("");

  if (!text) {
    throw new Error(
      `Gemini response had no text (finishReason: ${candidate?.finishReason}): ${JSON.stringify(data).slice(0, 300)}`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini response did not return valid JSON: ${text.slice(0, 200)}`);
  }
}
