import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../lib/api.js";
import { ScreenTitle } from "../components/AppShell.jsx";

// Local calendar day, same pattern as Calendar.jsx/Analysis.jsx's dayKey():
// generatedAt comes back as a UTC instant, going through toISOString() would
// shift a late generation into the next day for any timezone ahead of UTC.
function dayKey(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Its own page instead of an inline expandable section (UPDATES.md round 5
// #5): history organized as one card at a time with arrow navigation, so it
// stays legible no matter how many generations pile up. The most recent
// generation is already shown on About me itself, so this starts at the day
// right before it.
export function AboutMeHistory() {
  const { t, language } = useLanguage();
  const [generations, setGenerations] = useState(null);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    api
      .get("/api/about-me/history")
      .then((result) => setGenerations(result.generations || []))
      .catch((err) => setError(err.message));
  }, []);

  // Grouped by calendar day, not by exact generation timestamp (UPDATES.md
  // round 7: "agrupar por dia de forma organizada, hoje às vezes gera várias
  // entradas separadas pro mesmo dia"). A single day can carry more than one
  // raw generation batch (an older bug regenerated on every entry instead of
  // waiting for two, see routes/aboutMe.js), those now merge into one day
  // card instead of showing as separate entries. `generations` comes back
  // newest first, so the first batch seen for a given day is that day's most
  // recent timestamp, used as the display time for the merged card.
  const byDay = useMemo(() => {
    if (!generations) return null;
    const map = new Map();
    for (const gen of generations) {
      const key = dayKey(gen.generatedAt);
      if (!map.has(key)) {
        map.set(key, { day: key, generatedAt: gen.generatedAt, light: [], dark: [] });
      }
      const bucket = map.get(key);
      bucket.light.push(...gen.light);
      bucket.dark.push(...gen.dark);
    }
    return [...map.values()];
  }, [generations]);

  // Skips the most recent day (already shown on the About me page itself),
  // not just the most recent raw generation, now that same-day generations
  // are merged above.
  const pastDays = byDay?.slice(1) ?? null;

  function formatGeneratedAt(dateLike) {
    return new Date(dateLike).toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const current = pastDays?.[index] || null;

  return (
    <div className="about-me-history-page">
      <ScreenTitle eyebrow={t.aboutMe.title} title={t.aboutMe.history} />

      <Link to="/about-me" className="about-me-history-back">
        <span aria-hidden="true">←</span> {t.common.back}
      </Link>

      {error && <p className="form-error">{error}</p>}
      {!pastDays && !error && <p className="page-note">{t.common.loading}</p>}
      {pastDays && pastDays.length === 0 && <p className="page-note">{t.aboutMe.historyEmpty}</p>}

      {current && (
        <>
          <div className="about-me-history-nav">
            <button
              type="button"
              className="analysis-week-arrow"
              onClick={() => setIndex((i) => Math.min(i + 1, pastDays.length - 1))}
              disabled={index >= pastDays.length - 1}
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
