import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../lib/api.js";
import { ScreenTitle } from "../components/AppShell.jsx";
import { Oracle } from "../components/Oracle.jsx";

export function Patterns() {
  const { t } = useLanguage();
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);
  const [verdicts, setVerdicts] = useState({});

  useEffect(() => {
    api
      .get("/api/patterns")
      .then((data) => setInsights(data.insights))
      .catch((err) => setError(err.message));
  }, []);

  async function handleCorrection(insightId, verdict) {
    setVerdicts((prev) => ({ ...prev, [insightId]: verdict }));
    try {
      await api.post("/api/corrections", { insightId, verdict });
    } catch {
      setVerdicts((prev) => ({ ...prev, [insightId]: null }));
    }
  }

  const summary = insights?.find((i) => i.kind === "pattern_summary");
  const cards = insights?.filter((i) => i.kind === "pattern_card") || [];

  return (
    <div className="patterns-page">
      <ScreenTitle eyebrow={t.patterns.eyebrow} title={t.patterns.title} sub={t.patterns.note} />

      {error && <p className="form-error">{error}</p>}

      {summary && (
        <section className="patterns-summary glass">
          <Oracle size={44} variant="main" float={false} />
          <p>{summary.body}</p>
        </section>
      )}

      {insights && cards.length === 0 && !error && <p>{t.patterns.empty}</p>}

      <div className="pattern-cards">
        {cards.map((card) => {
          const verdict = verdicts[card.id];
          return (
            <article key={card.id} className="pattern-card glass">
              <span className="pattern-category">{card.category}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <div className="pattern-meta">
                <span className="pattern-confidence">
                  {t.patterns.confidence[card.confidence]} · {card.supporting_entry_count} {t.patterns.entries}
                </span>
                <span className="correction-buttons">
                  <button
                    type="button"
                    className={verdict === "rejected" ? "active" : ""}
                    onClick={() => handleCorrection(card.id, "rejected")}
                  >
                    {t.patterns.correctionWrong}
                  </button>
                  <button
                    type="button"
                    className={`accent ${verdict === "confirmed" ? "active" : ""}`}
                    onClick={() => handleCorrection(card.id, "confirmed")}
                  >
                    {t.patterns.correctionTrue}
                  </button>
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <p className="patterns-footnote">{t.patterns.footnote}</p>
    </div>
  );
}
