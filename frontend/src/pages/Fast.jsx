import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { getCurrentMoment } from "../lib/moments.js";
import { api } from "../lib/api.js";
import { enqueueEntry } from "../lib/entryQueue.js";
import { pickLine } from "../lib/toastCopy.js";
import { ScreenTitle } from "../components/AppShell.jsx";

// Ordered 1 (worst) to 6 (best), UPDATES.md round 3 #2's thermostatic scale,
// weather-register display labels live in locales/*.js under `moods`.
const MOODS = [1, 2, 3, 4, 5, 6];
const MOOD_GLYPHS = { 1: "▽", 2: "♡", 3: "○", 4: "≈", 5: "●", 6: "☀" };

export function Fast() {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [mood, setMood] = useState(null);
  // Reason picker (UPDATES.md round 3 #5), replaces the old free-text "quick
  // notes" bullets: a small default keyword set plus whatever the user has
  // added before (persisted server side, see routes/reasons.js), still saved
  // into the entry as `bullets`, that field's shape on the backend never
  // changed, only how it gets populated on this screen.
  const [customReasons, setCustomReasons] = useState([]);
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [newReason, setNewReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/api/reasons")
      .then((data) => setCustomReasons(data.custom))
      .catch(() => {});
  }, []);

  const reasons = [...t.fastMode.defaultReasons, ...customReasons.filter((r) => !t.fastMode.defaultReasons.includes(r))];

  function toggleReason(reason) {
    setSelectedReasons((prev) => (prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]));
  }

  async function handleAddReason() {
    const label = newReason.trim();
    if (!label) return;
    setNewReason("");
    setCustomReasons((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setSelectedReasons((prev) => (prev.includes(label) ? prev : [...prev, label]));
    try {
      await api.post("/api/reasons", { label });
    } catch {
      // Still usable for this entry even if the save-for-reuse call fails,
      // it just won't be offered again next time.
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!mood) return;
    setSaving(true);
    const payload = {
      moment: getCurrentMoment(),
      mode: "fast",
      language,
      mood,
      bullets: selectedReasons,
      occurredAt: new Date().toISOString(),
    };
    try {
      await api.post("/api/entries", payload);
      setMood(null);
      setSelectedReasons([]);
      showToast(pickLine(t.toasts.fastSaved), "success");
    } catch (err) {
      // Same queue-and-retry resilience as the full entry flow, see
      // Today.jsx's handleSubmit and AppShell.jsx's flush on load/reconnect.
      enqueueEntry(payload);
      setMood(null);
      setSelectedReasons([]);
      showToast(pickLine(t.toasts.entryQueued), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fast-page">
      <ScreenTitle eyebrow={t.fastMode.title} title={t.fastMode.moodPrompt} sub={t.fastMode.subtitle} />

      <form onSubmit={handleSubmit}>
        <div className="fast-mood-grid">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              className={`fast-mood-cell glass mood-tint-${m} ${mood === m ? "active" : ""}`}
              onClick={() => setMood(m)}
            >
              <span className={`fast-mood-glyph mood-${m}`}>{MOOD_GLYPHS[m]}</span>
              <span className="fast-mood-label">{t.moods[m]}</span>
            </button>
          ))}
        </div>

        <p className="fast-bullets-eyebrow">{t.fastMode.reasonsPrompt}</p>
        <p className="fast-reasons-sub">{t.fastMode.reasonsSub}</p>
        <div className="fast-reasons">
          {reasons.map((reason) => (
            <button
              key={reason}
              type="button"
              className={`fast-reason-chip glass ${selectedReasons.includes(reason) ? "active" : ""}`}
              onClick={() => toggleReason(reason)}
            >
              {reason}
            </button>
          ))}
        </div>
        <div className="fast-add-reason">
          <input
            className="glass"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddReason();
              }
            }}
            placeholder={t.fastMode.addReasonPlaceholder}
          />
          <button type="button" className="button-secondary" onClick={handleAddReason}>
            {t.fastMode.addReason}
          </button>
        </div>

        <button type="submit" className="button-primary fast-save" disabled={!mood || saving}>
          {saving ? t.common.loading : t.fastMode.save}
        </button>
      </form>
    </div>
  );
}
