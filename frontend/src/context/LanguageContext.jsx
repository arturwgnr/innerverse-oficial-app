import { createContext, useContext, useMemo, useState, useCallback } from "react";
import en from "../locales/en.js";
import pt from "../locales/pt.js";

const dictionaries = { en, pt };
const LanguageContext = createContext(null);
const STORAGE_KEY = "innerverse.language";

function getInitialLanguage() {
  const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (stored === "en" || stored === "pt") return stored;
  return "en";
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((next) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useMemo(() => dictionaries[language], [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
