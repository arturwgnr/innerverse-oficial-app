import { useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { getCurrentMoment } from "../lib/moments.js";
import { api } from "../lib/api.js";
import { ScreenTitle } from "../components/AppShell.jsx";

const MOODS = ["radiant", "steady", "tender", "restless", "heavy", "numb"];
const MOOD_GLYPHS = { radiant: "☀", steady: "●", tender: "♡", restless: "≈", heavy: "▽", numb: "○" };

export function Fast() {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [mood, setMood] = useState(null);
  const [bullets, setBullets] = useState([""]);
  const [saving, setSaving] = useState(false);

  function updateBullet(index, value) {
    setBullets((prev) => prev.map((b, i) => (i === index ? value : b)));
  }

  function addBullet() {
    setBullets((prev) => [...prev, ""]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!mood) return;
    setSaving(true);
    try {
      await api.post("/api/entries", {
        moment: getCurrentMoment(),
        mode: "fast",
        language,
        mood,
        bullets: bullets.map((b) => b.trim()).filter(Boolean),
        occurredAt: new Date().toISOString(),
      });
      setMood(null);
      setBullets([""]);
      showToast(language === "pt" ? "Registrado." : "Logged.", "success");
    } catch (err) {
      showToast(err.message, "error");
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
              className={`fast-mood-cell glass ${mood === m ? "active" : ""}`}
              onClick={() => setMood(m)}
            >
              <span className={`fast-mood-glyph mood-${m}`}>{MOOD_GLYPHS[m]}</span>
              <span className="fast-mood-label">{t.moods[m]}</span>
            </button>
          ))}
        </div>

        <p className="fast-bullets-eyebrow">{t.fastMode.bulletsPrompt}</p>
        <div className="fast-bullets">
          {bullets.map((bullet, index) => (
            <input
              key={index}
              className="glass"
              value={bullet}
              onChange={(e) => updateBullet(index, e.target.value)}
              placeholder="..."
            />
          ))}
          <button type="button" className="fast-add-bullet" onClick={addBullet}>
            + {t.fastMode.addBullet}
          </button>
        </div>

        <button type="submit" className="button-primary fast-save" disabled={!mood || saving}>
          {saving ? t.common.loading : t.fastMode.save}
        </button>
      </form>
    </div>
  );
}
