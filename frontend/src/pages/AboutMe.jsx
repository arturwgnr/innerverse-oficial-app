import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { pickLine } from "../lib/toastCopy.js";
import { Oracle } from "../components/Oracle.jsx";
import { AboutMeSkeleton } from "../components/Skeleton.jsx";

export function AboutMe() {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showCorrectForm, setShowCorrectForm] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");
  const [sendingCorrection, setSendingCorrection] = useState(false);
  const [daysAway, setDaysAway] = useState(null);
  // Closing line variety (UPDATES.md round 5 #5): picked once per visit
  // instead of the same two fixed sentences forever.
  const closingLine = useMemo(() => pickLine(t.aboutMe.closingLines), [t]);

  useEffect(() => {
    // React StrictMode fires this effect twice in dev, so a stray failure
    // from one of the two calls (e.g. a transient AI parse error) must not
    // stick around next to a successful result from the other.
    api
      .get("/api/about-me")
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => setError(err.message));

    // Real gap since the last entry, not a hardcoded placeholder
    // (UPDATES.md #6). Entries come back newest first.
    api
      .get("/api/entries")
      .then((entries) => {
        if (!entries?.length) return;
        const last = new Date(entries[0].occurred_at);
        const gapMs = Date.now() - last.getTime();
        setDaysAway(Math.max(0, Math.floor(gapMs / (1000 * 60 * 60 * 24))));
      })
      .catch(() => {});
  }, []);

  async function handleSendCorrection(event) {
    event.preventDefault();
    setSendingCorrection(true);
    try {
      const items = [...(data?.light || []), ...(data?.dark || [])];
      await Promise.all(
        items.map((item) =>
          api.post("/api/corrections", {
            insightId: item.id,
            verdict: "rejected",
            userNote: correctionNote,
          })
        )
      );
      showToast(pickLine(t.toasts.aboutMeCorrectionSent), "success");
      setShowCorrectForm(false);
      setCorrectionNote("");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSendingCorrection(false);
    }
  }

  const pct = data?.knowledgePercent ?? 0;

  return (
    <div className="about-me-page">
      <div className="about-me-hero">
        <Oracle size={168} variant="meditating" className="about-me-oracle" />
        <p className="about-me-eyebrow">{language === "pt" ? "Seu oráculo" : "Your oracle"}</p>
        <h1>
          {language === "pt" ? "Eu conheço " : "I know "}
          <span className="text-iridescent">{pct}%</span>
          {language === "pt" ? " de você" : " of you"}
        </h1>
        <p className="about-me-hero-sub">
          {language === "pt"
            ? "Não é uma nota. Só o quanto do seu universo já ficou nítido até agora."
            : "Not a score. Just how much of your universe has come into focus so far."}
        </p>
        <div className="knowledge-bar">
          <div className="knowledge-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {!data && !error && <AboutMeSkeleton />}

      {data && (
        <>
          <div className="about-me-columns">
            <section className="about-me-column glass">
              <p className="about-me-eyebrow">{t.aboutMe.light}</p>
              <ul>
                {data.light.map((item) => (
                  <li key={item.id}>
                    <span className="about-me-dot about-me-dot-light" />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="about-me-column glass about-me-dark">
              <p className="about-me-eyebrow">{t.aboutMe.dark}</p>
              <ul>
                {data.dark.map((item) => (
                  <li key={item.id}>
                    <span className="about-me-dot about-me-dot-dark" />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {!showCorrectForm && (
            <button type="button" className="about-me-correct" onClick={() => setShowCorrectForm(true)}>
              {t.aboutMe.correctAll}
            </button>
          )}

          {showCorrectForm && (
            <form className="correction-form glass" onSubmit={handleSendCorrection}>
              <textarea
                rows={3}
                required
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                placeholder={t.aboutMe.correctionPlaceholder}
              />
              <div className="correction-form-actions">
                <button type="button" className="button-ghost" onClick={() => setShowCorrectForm(false)}>
                  {t.common.back}
                </button>
                <button type="submit" className="button-primary" disabled={sendingCorrection}>
                  {sendingCorrection ? t.common.loading : t.common.send}
                </button>
              </div>
            </form>
          )}

          {/* History moved to its own page (UPDATES.md round 5 #5), organized
              as cards with arrow navigation instead of an inline expandable
              list that could grow without bound. */}
          <Link to="/about-me/history" className="about-me-history-toggle">
            {t.aboutMe.seePastReadings}
            <span aria-hidden="true">→</span>
          </Link>
        </>
      )}

      <section className="about-me-quote glass">
        <p>
          {daysAway !== null && daysAway >= 2 ? t.aboutMe.awayMessage.replace("{days}", daysAway) : closingLine.main}
        </p>
        <p className="about-me-quote-sub">
          {daysAway !== null && daysAway >= 2 ? t.aboutMe.everyEntry : closingLine.sub}
        </p>
      </section>
    </div>
  );
}
