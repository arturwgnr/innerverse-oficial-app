import { useLanguage } from "../context/LanguageContext.jsx";

// Segmented control, not two bare buttons: a single surface track with one
// active segment, flag plus a short label (CLAUDE.md language section).
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
        <span className="language-flag">🇺🇸</span>
        US
      </button>
      <button
        type="button"
        className={language === "pt" ? "active" : ""}
        onClick={() => setLanguage("pt")}
        aria-pressed={language === "pt"}
        title="Português"
      >
        <span className="language-flag">🇧🇷</span>
        BR
      </button>
    </div>
  );
}
