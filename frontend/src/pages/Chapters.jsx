import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../lib/api.js";
import { ScreenTitle } from "../components/AppShell.jsx";

// "O que você viveu" (UPDATES.md round 7 adicional): periodic chapters,
// each covering a 10-entry stretch, an archive that only grows (unlike
// Chronicle.jsx's single always-current narrative). Visiting this page is
// what actually triggers the next chapter's generation once enough entries
// exist (see routes/chapters.js), the sidebar's glow (AppShell.jsx) only
// ever teases that something is close, it never generates anything itself.
export function Chapters() {
  const { t, language } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    api
      .get("/api/chapters")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const chapters = data?.chapters || [];
  // Newest first for browsing, same convention as About Me's history page,
  // numbering itself still comes from the backend's ascending order.
  const ordered = [...chapters].reverse();
  const current = ordered[index] || null;

  function formatRange(startDate, endDate) {
    const locale = language === "pt" ? "pt-BR" : "en-US";
    const opts = { day: "numeric", month: "short" };
    const start = new Date(startDate).toLocaleDateString(locale, opts);
    const end = new Date(endDate).toLocaleDateString(locale, opts);
    return start === end ? start : `${start} - ${end}`;
  }

  function countdownMessage(count) {
    if (count === 0) return t.chapters.countdownReady;
    if (count === 1) return t.chapters.countdownOne;
    return t.chapters.countdownMany.replace("{count}", count);
  }

  return (
    <div className="chapters-page">
      <ScreenTitle eyebrow={t.chapters.eyebrow} title={t.chapters.title} sub={t.chapters.note} />

      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="page-note">{t.common.loading}</p>}

      {data && typeof data.entriesUntilNext === "number" && (
        <p className="chapters-countdown">{countdownMessage(data.entriesUntilNext)}</p>
      )}

      {data && chapters.length === 0 && <p className="page-note">{t.chapters.empty}</p>}

      {current && (
        <>
          <div className="about-me-history-nav">
            <button
              type="button"
              className="analysis-week-arrow"
              onClick={() => setIndex((i) => Math.min(i + 1, ordered.length - 1))}
              disabled={index >= ordered.length - 1}
              aria-label={t.chapters.previousChapter}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="about-me-history-nav-label">{formatRange(current.periodStart, current.periodEnd)}</span>
            <button
              type="button"
              className="analysis-week-arrow"
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index === 0}
              aria-label={t.chapters.nextChapter}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <article className="chapter-card glass">
            <p className="analysis-chapter-mark">{t.chapters.chapterLabel.replace("{number}", current.number)}</p>
            <h2>{current.title}</h2>
            {current.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </article>
        </>
      )}
    </div>
  );
}
