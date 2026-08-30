import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../lib/api.js";
import { ScreenTitle } from "../components/AppShell.jsx";

const MOODS = ["radiant", "steady", "tender", "restless", "heavy", "numb"];
const WEEKDAY_LETTERS = { en: ["M", "T", "W", "T", "F", "S", "S"], pt: ["S", "T", "Q", "Q", "S", "S", "D"] };

function monthRange(date) {
  // A day of buffer on each side absorbs the local-to-UTC shift when this
  // range is sent as UTC ISO strings, entries from the adjacent month that
  // slip in are harmless, dayKey() below only ever matches a visible cell.
  const from = new Date(date.getFullYear(), date.getMonth(), 0);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 1, 23, 59, 59);
  return { from, to };
}

// Local calendar day, not the UTC day. occurred_at comes back from the
// server as a UTC instant, going through toISOString() here would shift an
// evening entry into the next UTC day for any timezone ahead of UTC,
// silently moving it to the wrong cell (or off the visible month entirely).
function dayKey(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function Calendar() {
  const { language, t } = useLanguage();
  const [month, setMonth] = useState(() => new Date());
  const [entries, setEntries] = useState([]);
  const [tieBreakDay, setTieBreakDay] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    const { from, to } = monthRange(month);
    api
      .get(`/api/entries?from=${from.toISOString()}&to=${to.toISOString()}`)
      .then(setEntries)
      .catch(() => setEntries([]));

    api
      .get(`/api/calendar-overrides?year=${month.getFullYear()}&month=${month.getMonth() + 1}`)
      .then(setOverrides)
      .catch(() => setOverrides({}));
  }, [month]);

  async function resolveTieBreak(day, mood) {
    setOverrides((prev) => ({ ...prev, [day]: mood }));
    setTieBreakDay(null);
    try {
      await api.put("/api/calendar-overrides", { day, mood });
    } catch {
      // Keep the optimistic local choice even if the save fails, the next
      // month load will reconcile with the server either way.
    }
  }

  const byDay = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      if (!entry.mood) continue;
      const key = dayKey(entry.occurred_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry.mood);
    }
    return map;
  }, [entries]);

  const entriesByDay = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      const key = dayKey(entry.occurred_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
    }
    for (const list of map.values()) list.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
    return map;
  }, [entries]);

  function predominantMood(moods) {
    const counts = {};
    for (const m of moods) counts[m] = (counts[m] || 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const isDivergent = new Set(moods).size > 1 && sorted[0][1] === sorted[1]?.[1];
    return { mood: sorted[0][0], isDivergent };
  }

  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  // Monday-first grid, matching the reference's weekday header.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const monthLabel = month.toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", { month: "long", year: "numeric" });

  return (
    <div className="calendar-page">
      <div className="calendar-title-row">
        <button type="button" className="calendar-arrow" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          ‹
        </button>
        <ScreenTitle
          eyebrow={monthLabel}
          title={language === "pt" ? "Seu mês" : "Your month"}
          sub={language === "pt" ? "Cada dia recebe a cor do humor que o definiu. Dias divididos são marcados." : "Each day takes the colour of its defining mood. Mixed days are marked."}
        />
        <button type="button" className="calendar-arrow" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          ›
        </button>
      </div>

      <div className="calendar-grid glass">
        <div className="calendar-weekdays">
          {WEEKDAY_LETTERS[language === "pt" ? "pt" : "en"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="calendar-cells">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} className="calendar-cell empty" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNumber = i + 1;
            const date = new Date(month.getFullYear(), month.getMonth(), dayNumber);
            const key = dayKey(date);
            const moods = byDay.get(key) || [];
            const override = overrides[key];
            const result = moods.length ? predominantMood(moods) : null;
            const finalMood = override || result?.mood;

            return (
              <button
                key={key}
                type="button"
                disabled={!finalMood}
                className={`calendar-cell ${finalMood ? `mood-${finalMood}` : ""}`}
                onClick={() => {
                  if (result?.isDivergent && !override) {
                    setTieBreakDay({ key, moods });
                  } else if (finalMood) {
                    setDayDetail({ key, entries: entriesByDay.get(key) || [] });
                  }
                }}
              >
                {dayNumber}
                {result?.isDivergent && <span className="calendar-divergent-mark" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mood-legend">
        {MOODS.map((m) => (
          <span key={m} className="legend-item">
            <span className={`legend-dot mood-${m}`} />
            {t.moods[m]}
          </span>
        ))}
      </div>

      {dayDetail && (
        <div className="sheet-backdrop" onClick={() => setDayDetail(null)}>
          <div className="sheet glass" onClick={(e) => e.stopPropagation()}>
            <p className="about-me-eyebrow">{dayDetail.key}</p>
            <h2>{language === "pt" ? "O que foi escrito nesse dia" : "What was written that day"}</h2>
            <div className="day-detail-list">
              {dayDetail.entries.length === 0 && (
                <p className="sheet-sub">{language === "pt" ? "Nenhuma entrada com texto nesse dia." : "No entries with text on this day."}</p>
              )}
              {dayDetail.entries.map((entry) => (
                <div key={entry.id} className="day-detail-entry">
                  <div className="day-detail-entry-head">
                    <span className={`legend-dot mood-${entry.mood || "numb"}`} />
                    <span className="day-detail-moment">{t.moments[entry.moment]?.label || entry.moment}</span>
                    <span className="day-detail-time">
                      {new Date(entry.occurred_at).toLocaleTimeString(language === "pt" ? "pt-BR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {entry.text_content && <p className="day-detail-text">{entry.text_content}</p>}
                  {entry.bullets?.length > 0 && (
                    <ul className="day-detail-bullets">
                      {entry.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {!entry.text_content && !(entry.bullets?.length > 0) && (
                    <p className="day-detail-text sheet-sub">{language === "pt" ? "Só o humor foi registrado." : "Only a mood was logged."}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tieBreakDay && (
        <div className="sheet-backdrop" onClick={() => setTieBreakDay(null)}>
          <div className="sheet glass" onClick={(e) => e.stopPropagation()}>
            <p className="about-me-eyebrow">{tieBreakDay.key}</p>
            <h2>{language === "pt" ? "Esse dia puxou pra dois lados." : "This day pulled in two directions."}</h2>
            <p className="sheet-sub">
              {language === "pt" ? "Qual representa melhor esse dia? Você decide." : "Which one best represents it? You decide."}
            </p>
            <div className="sheet-mood-list">
              {[...new Set(tieBreakDay.moods)].map((m) => (
                <button key={m} type="button" onClick={() => resolveTieBreak(tieBreakDay.key, m)}>
                  <span className={`legend-dot mood-${m}`} />
                  {t.moods[m]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
