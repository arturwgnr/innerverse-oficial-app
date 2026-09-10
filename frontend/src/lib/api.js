import en from "../locales/en.js";
import pt from "../locales/pt.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const dictionaries = { en, pt };
const LANGUAGE_STORAGE_KEY = "innerverse.language";

// Not a component, so it can't use LanguageContext. Reads the same
// localStorage key that context persists to, so error copy still matches
// whatever language the user picked.
function currentDictionary() {
  const stored = typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
  return dictionaries[stored] || dictionaries.en;
}

async function request(path, { method = "GET", body, headers } = {}) {
  const t = currentDictionary();
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body instanceof FormData ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // The browser/network layer throwing (offline, unreachable server, CORS)
    // surfaces as raw wording like "Failed to fetch", never meant for a non
    // technical reader (UPDATES.md #2). Always a plain, friendly message here.
    throw new Error(t.common.networkError);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    // Only trust a plain string from our own API as user-facing copy. Any
    // other shape (validation error objects, a bare statusText, no body at
    // all) falls back to friendly copy instead of being dumped raw.
    const message = typeof error?.error === "string" ? error.error : t.common.genericError;
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  del: (path) => request(path, { method: "DELETE" }),
};
