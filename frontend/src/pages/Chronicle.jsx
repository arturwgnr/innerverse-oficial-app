import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useOnboardingStatus } from "../context/OnboardingContext.jsx";
import { api } from "../lib/api.js";
import { pickLine } from "../lib/toastCopy.js";
import { Oracle } from "../components/Oracle.jsx";
import { ScreenTitle } from "../components/AppShell.jsx";

// "Quem é {user}" (UPDATES.md round 7 adicional): reached by tapping the
// user's own name on Today, a flowing narrative in the Oracle's voice, not
// insight cards like About Me. Accepts the same "That's not it" correction
// mechanism as the rest of the app's insights, via the insight row the
// backend links to this chronicle (see routes/chronicle.js).
export function Chronicle() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { preferredName } = useOnboardingStatus();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showCorrectForm, setShowCorrectForm] = useState(false);
  const [correctionNote, setCorrectionNote] = useState("");
  const [sendingCorrection, setSendingCorrection] = useState(false);

  useEffect(() => {
    api
      .get("/api/chronicle")
      .then((result) => {
        setData(result);
        setError(null);
        // Subtle nudge, same pattern as About Me's own update toast, only
        // fires the moment this request actually triggered a regeneration.
        if (result.ready && result.cached === false) {
          showToast(pickLine(t.toasts.chronicleUpdated), "success");
        }
      })
      .catch((err) => setError(err.message));
    // Runs once on mount only, showToast/t are stable enough in practice
    // for this one-shot check, same pattern already used on About Me.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSendCorrection(event) {
    event.preventDefault();
    if (!data?.insightId) return;
    setSendingCorrection(true);
    try {
      await api.post("/api/corrections", {
        insightId: data.insightId,
        verdict: "rejected",
        userNote: correctionNote,
      });
      showToast(pickLine(t.toasts.aboutMeCorrectionSent), "success");
      setShowCorrectForm(false);
      setCorrectionNote("");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSendingCorrection(false);
    }
  }

  // Falls back to the fixed eyebrow copy rather than a name-shaped title
  // with a blank in it while OnboardingContext is still resolving.
  const title = preferredName ? t.chronicle.title.replace("{name}", preferredName) : t.chronicle.eyebrow;

  return (
    <div className="chronicle-page">
      <ScreenTitle eyebrow={t.chronicle.eyebrow} title={title} sub={t.chronicle.note} />

      {error && <p className="form-error">{error}</p>}

      {!data && !error && <p className="page-note">{t.common.loading}</p>}

      {data && !data.ready && (
        <section className="chronicle-not-ready glass">
          <Oracle size={72} variant="meditating" float={false} />
          <h2>{t.chronicle.notReadyTitle}</h2>
          <p>
            {data.entriesNeeded === 1
              ? t.chronicle.notReadyBody
              : t.chronicle.notReadyBodyPlural.replace("{count}", data.entriesNeeded)}
          </p>
        </section>
      )}

      {data?.ready && (
        <>
          <article className="chronicle-content glass">
            {data.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </article>

          {!showCorrectForm && (
            <button type="button" className="about-me-correct" onClick={() => setShowCorrectForm(true)}>
              {t.chronicle.correctAll}
            </button>
          )}

          {showCorrectForm && (
            <form className="correction-form glass" onSubmit={handleSendCorrection}>
              <textarea
                rows={3}
                required
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                placeholder={t.chronicle.correctionPlaceholder}
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
        </>
      )}
    </div>
  );
}
