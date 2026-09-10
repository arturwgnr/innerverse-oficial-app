import { callGemini } from "./gemini.js";
import { callClaudeJson } from "./claude.js";

// Unified entry point for the structured-JSON LLM calls (UPDATES.md "Prompt:
// fallback automático Gemini -> OpenRouter (Claude)"). Tries Gemini first,
// gemini.js's own primary/fallback-key retry logic runs untouched inside
// that call. Gemini only ever throws here once it is truly out of options
// (both keys exhausted on 429, or a persistent non-429 error like a 5xx),
// so any exception from callGemini is treated the same way: the last
// resilience layer before the caller gives up, falling through to Claude
// via OpenRouter, this is the final line of defense keeping analyses
// generating even if Gemini itself is down or fully saturated.
//
// `model` is a Gemini-model override only (forwarded to callGemini exactly
// like before), it never carries over to the OpenRouter fallback call, the
// two providers use unrelated model-naming schemes and none of today's
// callers pass this anyway. `cheap` selects OPENROUTER_MODEL_CHEAP over
// OPENROUTER_MODEL for the fallback, matching the distinction already
// documented in .env.example: the cheap model is for high volume, low
// stakes background calls (profile merge on every entry), the flagship
// model is reserved for the deep analysis the user actually reads (entry
// analysis, About Me).
export async function callLLMJson({ system, messages, maxTokens, model, responseSchema, cheap = false }) {
  try {
    const result = await callGemini({ system, messages, maxTokens, model, responseSchema });
    console.log("LLM call served by Gemini.");
    return result;
  } catch (geminiErr) {
    if (!process.env.OPENROUTER_API_KEY) {
      // No fallback configured, skip this layer silently (per UPDATES.md)
      // and let the original Gemini failure surface to the caller exactly
      // as it did before this layer existed.
      throw geminiErr;
    }

    console.warn("Gemini call failed, falling back to OpenRouter/Claude:", geminiErr.message);
    const fallbackModel = cheap ? process.env.OPENROUTER_MODEL_CHEAP || process.env.OPENROUTER_MODEL : process.env.OPENROUTER_MODEL;

    try {
      const result = await callClaudeJson({ system, messages, maxTokens, model: fallbackModel });
      console.log("LLM call served by OpenRouter (Claude fallback).");
      return result;
    } catch (claudeErr) {
      console.error("OpenRouter/Claude fallback also failed:", claudeErr.message);
      // The Gemini failure is the more informative one for whoever reads
      // this in the logs later (it is the reason the fallback fired at
      // all), the Claude failure is already logged above.
      throw geminiErr;
    }
  }
}
