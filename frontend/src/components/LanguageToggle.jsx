import { useLanguage } from "../context/LanguageContext.jsx";

// Segmented control, not two bare buttons: a single surface track with one
// active segment. Plain text labels only, no flag imagery (EDITS.md round 2
// #1: the flag emoji don't render as flags on Windows, just raw glyph
// characters, so a country flag was never a reliable way to indicate
// language here to begin with).
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="language-toggle glass" role="group" aria-label="Language">
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        title="English"
      >
        English
      </button>
      <button
        type="button"
        className={language === "pt" ? "active" : ""}
        onClick={() => setLanguage("pt")}
        aria-pressed={language === "pt"}
        title="Português"
      >
        Português
      </button>
    </div>
  );
}
