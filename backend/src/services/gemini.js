const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Same project wide writing rule as claude.js, duplicated rather than
// imported: services/claude.js stays untouched as the manual fallback path
// (see UPDATES.md, "model provider decision"), so nothing here should
// depend on it.
const NO_EM_DASH_RULE =
  "Never use the em dash character in your response, under any circumstance. Use a period, comma, or parentheses instead.";

const ROLE_MAP = { user: "user", assistant: "model" };

// Free tier is capped at 5 requests/minute (see UPDATES.md "Analysis quality
// and reliability"), a 429 there is routine, not exceptional, so it is worth
// riding out rather than failing the whole call on the first hit. Gemini's
// 429 body already tells us how long to wait (RetryInfo.retryDelay, e.g.
// "42s"), so honor that instead of guessing a backoff schedule.
const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;

function parseRetryDelayMs(errorBody) {
  try {
    const parsed = JSON.parse(errorBody);
    const retryInfo = parsed?.error?.details?.find(
      (d) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
    );
    const retryDelay = retryInfo?.retryDelay; // e.g. "42s"
    if (typeof retryDelay === "string" && retryDelay.endsWith("s")) {
      const seconds = Number.parseFloat(retryDelay.slice(0, -1));
      if (Number.isFinite(seconds)) return Math.ceil(seconds * 1000);
    }
  } catch {
    // fall through to the default below, errorBody was not JSON or had no RetryInfo
  }
  return DEFAULT_RETRY_DELAY_MS;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  // Fallback key (UPDATES.md round 5): a second Google Cloud project's key,
  // only ever tried once the primary key's own retries are exhausted on a
  // 429. Quotas are scoped per project, not per key (confirmed against
  // Google's docs, see UPDATES.md "second API key as fallback"), so a fresh
  // project has its own untouched 5 req/min pool. Not used on a 503, that is
  // the model itself overloaded, a different key in a different project
  // gets no fresher a model. GEMINI_API_KEY_FALLBACK stays unset (and this
  // list collapses to just the primary key) until a second key is added.
  const apiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_FALLBACK].filter(Boolean);
  if (apiKeys.length === 0) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const systemText = system ? `${system}\n\n${NO_EM_DASH_RULE}` : NO_EM_DASH_RULE;
  const resolvedModel = model || process.env.GEMINI_MODEL || "gemini-3.6-flash";

  const generationConfig = {
    maxOutputTokens: maxTokens,
    responseMimeType: "application/json",
    // Minimizes extended "thinking" so it does not eat into the same
    // maxOutputTokens budget as the actual answer (the same failure mode
    // that broke deepseek-r1:free on OpenRouter, see UPDATES.md). Gemini 3.x
    // models (gemini-3.6-flash and newer) use thinkingLevel ("minimal" is
    // the closest equivalent to off), NOT thinkingBudget: that field is only
    // for the older Gemini 2.5 family and is silently invalid on Gemini 3,
    // which caused the "400 INVALID_ARGUMENT" errors we hit. gemini-2.5-flash
    // is also no longer issuable to new API keys, so gemini-3.6-flash with
    // thinkingLevel is the only currently working combination.
    thinkingConfig: { thinkingLevel: "minimal" },
  };
  if (responseSchema) generationConfig.responseSchema = responseSchema;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemText }] },
    contents: messages.map((m) => ({
      role: ROLE_MAP[m.role] || "user",
      parts: [{ text: m.content }],
    })),
    generationConfig,
  });

  let response;
  let errorBody;
  for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
    const apiKey = apiKeys[keyIndex];
    const isLastKey = keyIndex === apiKeys.length - 1;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      response = await fetch(`${API_BASE}/${resolvedModel}:generateContent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body,
      });

      if (response.ok || response.status !== 429) break;

      errorBody = await response.text();
      if (attempt === MAX_RETRIES) break;

      const delayMs = parseRetryDelayMs(errorBody);
      console.warn(
        `Gemini 429 (rate limited) on key ${keyIndex + 1}/${apiKeys.length}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(delayMs);
    }

    if (response.ok || response.status !== 429) break;
    if (!isLastKey) {
      console.warn(`Gemini still rate limited after retries on key ${keyIndex + 1}/${apiKeys.length}, switching to fallback key.`);
    }
  }

  if (!response.ok) {
    const finalErrorBody = errorBody ?? (await response.text());
    throw new Error(`Gemini API error ${response.status}: ${finalErrorBody}`);
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
