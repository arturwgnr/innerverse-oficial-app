import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../lib/api.js";
import { ScreenTitle } from "../components/AppShell.jsx";

// Its own page instead of an inline expandable section (UPDATES.md round 5
// #5): history organized as one card at a time with arrow navigation, so it
// stays legible no matter how many generations pile up. The most recent
// generation is already shown on About me itself, so this starts at the
// generation right before it.
export function AboutMeHistory() {
  const { t, language } = useLanguage();
  const [generations, setGenerations] = useState(null);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    api
      .get("/api/about-me/history")
      .then((result) => setGenerations((result.generations || []).slice(1)))
      .catch((err) => setError(err.message));
  }, []);

  function formatGeneratedAt(dateLike) {
    return new Date(dateLike).toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const current = generations?.[index] || null;

  return (
    <div className="about-me-history-page">
      <ScreenTitle eyebrow={t.aboutMe.title} title={t.aboutMe.history} />

      <Link to="/about-me" className="about-me-history-back">
        <span aria-hidden="true">←</span> {t.common.back}
      </Link>

      {error && <p className="form-error">{error}</p>}
      {!generations && !error && <p className="page-note">{t.common.loading}</p>}
      {generations && generations.length === 0 && <p className="page-note">{t.aboutMe.historyEmpty}</p>}

      {current && (
        <>
          <div className="about-me-history-nav">
            <button
              type="button"
              className="analysis-week-arrow"
              onClick={() => setIndex((i) => Math.min(i + 1, generations.length - 1))}
              disabled={index >= generations.length - 1}
              aria-label={t.aboutMe.previousReading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="about-me-history-nav-label">{formatGeneratedAt(current.generatedAt)}</span>
            <button
              type="button"
              className="analysis-week-arrow"
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index === 0}
              aria-label={t.aboutMe.nextReading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <article className="about-me-history-entry glass">
            <div className="about-me-history-columns">
              <div>
                <p className="about-me-history-heading">{t.aboutMe.light}</p>
                <ul>
                  {current.light.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="about-me-history-heading">{t.aboutMe.dark}</p>
                <ul>
                  {current.dark.map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        </>
      )}
    </div>
  );
}
