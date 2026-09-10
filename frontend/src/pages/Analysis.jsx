import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { pickLine } from "../lib/toastCopy.js";
import { ScreenTitle } from "../components/AppShell.jsx";
import { AnalysisSkeleton } from "../components/Skeleton.jsx";

const FREE_DAILY_ANALYSIS_LIMIT = 5;

// Local calendar day, matching Calendar.jsx's dayKey(): occurred_at/created_at
// come back as UTC instants, going through toISOString() would shift a late
// entry into the next day for any timezone ahead of UTC.
function dayKey(dateLike) {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Monday-start calendar week containing a given day key (UPDATES.md round 5
// #4's week-by-week navigation), used to bucket the already-day-grouped
// timeline one level further.
function weekKey(dayKeyStr) {
  const [y, m, d] = dayKeyStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = (dow + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);
  return dayKey(date);
}

const MOMENTS = ["morning", "afternoon", "night", "decompress"];
const MOODS = [1, 2, 3, 4, 5, 6];

// 'processing' (UPDATES.md round 4 #4) is treated exactly like 'pending' in
// this UI, both just mean "still being read", the distinction only matters
// to the backend's claim/lock logic.
function isStillReading(status) {
  return status === "pending" || status === "processing";
}

export function Analysis() {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [analyses, setAnalyses] = useState(null);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [verdicts, setVerdicts] = useState({});
  // History filter (UPDATES.md round 3 #3): the timeline is already every
  // past analysis in chronological order, what was missing was a way to
  // narrow it down instead of scrolling the whole chronicle.
  const [momentFilter, setMomentFilter] = useState("all");
  const [moodFilter, setMoodFilter] = useState("all");
  // Failed-card actions (UPDATES.md round 4 #3).
  const [retryingEntryId, setRetryingEntryId] = useState(null);
  const [viewEntryId, setViewEntryId] = useState(null);
  // Delete-on-reject confirmation (UPDATES.md round 4 #4).
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // Week-by-week navigation (UPDATES.md round 5 #4): 0 is the most recent
  // week with any content, higher indices step backward into older weeks.
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  useEffect(() => {
    api
      .get("/api/analysis")
      .then((data) => {
        setAnalyses(data.analyses);
        // Seeds "True"/"That's not it" from whatever corrections already
        // exist server side (UPDATES.md round 5 #4), so a verdict survives a
        // reload instead of resetting to unanswered every time.
        const seeded = {};
        for (const a of data.analyses) {
          for (const obs of a.observations) {
            if (obs.verdict) seeded[obs.id] = obs.verdict;
          }
        }
        setVerdicts(seeded);
      })
      .catch((err) => setError(err.message));
    api
      .get("/api/entries")
      .then((data) => setEntries(data))
      .catch(() => {});
  }, []);

  // Filters narrow which weeks have visible content, jumping back to the
  // most recent one on every change avoids landing on a now-empty week.
  useEffect(() => {
    setSelectedWeekIndex(0);
  }, [momentFilter, moodFilter]);

  async function handleCorrection(analysisId, observationId, verdict) {
    setVerdicts((prev) => ({ ...prev, [observationId]: verdict }));
    try {
      await api.post("/api/corrections", { insightId: observationId, verdict });
      showToast(pickLine(verdict === "confirmed" ? t.toasts.correctionConfirmed : t.toasts.correctionRejected), "success");
      if (verdict === "rejected") setConfirmDeleteId(analysisId);
    } catch {
      setVerdicts((prev) => ({ ...prev, [observationId]: null }));
    }
  }

  async function handleConfirmDelete() {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.del(`/api/analysis/${id}`);
      setAnalyses((prev) => (prev || []).filter((a) => a.id !== id));
      showToast(pickLine(t.toasts.analysisDeleted), "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function retryAnalysis(entryId) {
    setRetryingEntryId(entryId);
    try {
      await api.post(`/api/analysis/${entryId}/retry`);
      setEntries((prev) => (prev || []).map((e) => (e.id === entryId ? { ...e, analysis_status: "processing" } : e)));
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setRetryingEntryId(null);
    }
  }

  async function dismissEntry(entryId) {
    try {
      await api.post(`/api/analysis/${entryId}/dismiss`);
      setEntries((prev) => (prev || []).map((e) => (e.id === entryId ? { ...e, analysis_status: "skipped" } : e)));
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  const groups = useMemo(() => {
    if (!analyses) return [];
    const map = new Map();
    const analyzedEntryIds = new Set();
    const matchesFilters = (moment, mood) =>
      (momentFilter === "all" || moment === momentFilter) && (moodFilter === "all" || mood === Number(moodFilter));

    for (const analysis of analyses) {
      analyzedEntryIds.add(analysis.entryId);
      if (!matchesFilters(analysis.moment, analysis.mood)) continue;
      const key = dayKey(analysis.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ kind: "ready", createdAt: analysis.createdAt, analysis });
    }
    // Entries that haven't produced a card yet: still processing, or the
    // model/JSON failed. Distinct from "skipped" (no key configured, or the
    // daily cap already hit), which stays silent rather than looking broken
    // (UPDATES.md #5).
    for (const entry of entries || []) {
      if (analyzedEntryIds.has(entry.id)) continue;
      if (!isStillReading(entry.analysis_status) && entry.analysis_status !== "failed") continue;
      if (!matchesFilters(entry.moment, entry.mood)) continue;
      const key = dayKey(entry.occurred_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        kind: isStillReading(entry.analysis_status) ? "pending" : "failed",
        createdAt: entry.occurred_at,
        entryId: entry.id,
      });
    }
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        items: items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [analyses, entries, momentFilter, moodFilter]);

  // Week-by-week navigation (UPDATES.md round 5 #4): the day-grouped
  // timeline used to be one continuous scroll, this buckets it into
  // Monday-start calendar weeks so arrows can step between them instead.
  const weeks = useMemo(() => {
    const map = new Map();
    for (const group of groups) {
      const wk = weekKey(group.key);
      if (!map.has(wk)) map.set(wk, []);
      map.get(wk).push(group);
    }
    return [...map.entries()]
      .map(([start, dayGroups]) => ({ start, dayGroups }))
      .sort((a, b) => b.start.localeCompare(a.start));
  }, [groups]);

  const currentWeek = weeks[Math.min(selectedWeekIndex, Math.max(weeks.length - 1, 0))] || null;

  const todayKey = dayKey(new Date());
  const todayCount = (analyses || []).filter((a) => dayKey(a.createdAt) === todayKey).length;
  const viewedEntry = viewEntryId ? (entries || []).find((e) => e.id === viewEntryId) : null;

  function formatDay(key) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  function formatWeekRange(startKey) {
    const [y, m, d] = startKey.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const locale = language === "pt" ? "pt-BR" : "en-US";
    const sameMonth = start.getMonth() === end.getMonth();
    const startLabel = start.toLocaleDateString(locale, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
    const endLabel = end.toLocaleDateString(locale, { day: "numeric", month: "short" });
    return `${startLabel} – ${endLabel}`;
  }

  return (
    <div className="analysis-page">
      <ScreenTitle eyebrow={t.analysis.eyebrow} title={t.analysis.title} sub={t.analysis.note} />

      {error && <p className="form-error">{error}</p>}

      {!analyses && !error && <AnalysisSkeleton />}

      {analyses && analyses.length > 0 && (
        <div className="analysis-filters">
          <select className="glass" value={momentFilter} onChange={(e) => setMomentFilter(e.target.value)}>
            <option value="all">{t.analysis.filterAllMoments}</option>
            {MOMENTS.map((m) => (
              <option key={m} value={m}>
                {t.moments[m].label}
              </option>
            ))}
          </select>
          <select className="glass" value={moodFilter} onChange={(e) => setMoodFilter(e.target.value)}>
            <option value="all">{t.analysis.filterAllMoods}</option>
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {t.moods[m]}
              </option>
            ))}
          </select>
        </div>
      )}

      {analyses && weeks.length === 0 && !error && <p>{t.analysis.empty}</p>}

      {todayCount >= FREE_DAILY_ANALYSIS_LIMIT && <p className="analysis-limit-note">{t.analysis.limitReached}</p>}

      {weeks.length > 0 && (
        <div className="analysis-week-nav">
          <button
            type="button"
            className="analysis-week-arrow"
            onClick={() => setSelectedWeekIndex((i) => Math.min(i + 1, weeks.length - 1))}
            disabled={selectedWeekIndex >= weeks.length - 1}
            aria-label={t.analysis.previousWeek}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="analysis-week-label">{currentWeek && formatWeekRange(currentWeek.start)}</span>
          <button
            type="button"
            className="analysis-week-arrow"
            onClick={() => setSelectedWeekIndex((i) => Math.max(i - 1, 0))}
            disabled={selectedWeekIndex === 0}
            aria-label={t.analysis.nextWeek}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {currentWeek && currentWeek.dayGroups.length === 0 && <p className="page-note">{t.analysis.emptyWeek}</p>}

      <div className="analysis-timeline">
        {(currentWeek?.dayGroups || []).map((group) => (
          <section key={group.key} className="analysis-day-group">
            <p className="analysis-chapter-mark">{t.analysis.chapterMark}</p>
            <h2 className="analysis-day-header">{formatDay(group.key)}</h2>
            {group.items.map((item) => {
              if (item.kind === "pending") {
                return (
                  <article key={`pending-${item.entryId}`} className="analysis-card glass analysis-card-pending">
                    <span className="analysis-pending-dot" aria-hidden="true" />
                    <p>{t.analysis.pending}</p>
                  </article>
                );
              }
              if (item.kind === "failed") {
                const isRetrying = retryingEntryId === item.entryId;
                return (
                  <article key={`failed-${item.entryId}`} className="analysis-card glass analysis-card-failed">
                    <button
                      type="button"
                      className="analysis-card-dismiss"
                      onClick={() => dismissEntry(item.entryId)}
                      aria-label={t.analysis.dismiss}
                    >
                      ×
                    </button>
                    <p>{t.analysis.failed}</p>
                    <div className="analysis-failed-actions">
                      <button type="button" className="analysis-action-view" onClick={() => setViewEntryId(item.entryId)}>
                        {t.analysis.viewEntry}
                      </button>
                      <button
                        type="button"
                        className="analysis-action-retry"
                        onClick={() => retryAnalysis(item.entryId)}
                        disabled={isRetrying}
                      >
                        {isRetrying ? t.analysis.retrying : t.analysis.retryAnalysis}
                      </button>
                    </div>
                  </article>
                );
              }
              const analysis = item.analysis;
              return (
              <article key={analysis.id} className="analysis-card glass">
                <div className="analysis-card-head">
                  <h3>{analysis.title}</h3>
                  {analysis.mood && (
                    <span className={`analysis-mood-badge mood-${analysis.mood}`}>{t.moods[analysis.mood]}</span>
                  )}
                  {analysis.mode === "mindfulness" && (
                    <span className="analysis-mood-badge analysis-mindfulness-badge">{t.analysis.mindfulnessTag}</span>
                  )}
                </div>
                <ul className="analysis-observations">
                  {analysis.observations.map((obs) => {
                    const verdict = verdicts[obs.id];
                    return (
                      <li key={obs.id} className="analysis-observation">
                        <p>{obs.body}</p>
                        <span className="correction-buttons">
                          <button
                            type="button"
                            className={verdict === "rejected" ? "active" : ""}
                            onClick={() => handleCorrection(analysis.id, obs.id, "rejected")}
                          >
                            {t.analysis.correctionWrong}
                          </button>
                          <button
                            type="button"
                            className={`accent ${verdict === "confirmed" ? "active" : ""}`}
                            onClick={() => handleCorrection(analysis.id, obs.id, "confirmed")}
                          >
                            {t.analysis.correctionTrue}
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
              );
            })}
          </section>
        ))}
      </div>

      {viewedEntry && (
        <div className="modal-backdrop" onClick={() => setViewEntryId(null)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setViewEntryId(null)}
              aria-label={language === "pt" ? "Fechar" : "Close"}
            >
              ×
            </button>
            <p className="about-me-eyebrow">{t.moments[viewedEntry.moment]?.label || viewedEntry.moment}</p>
            <h2>
              {new Date(viewedEntry.occurred_at).toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            {viewedEntry.text_content && <p className="day-detail-text">{viewedEntry.text_content}</p>}
            {viewedEntry.bullets?.length > 0 && (
              <ul className="day-detail-bullets">
                {viewedEntry.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {!viewedEntry.text_content && !(viewedEntry.bullets?.length > 0) && (
              <p className="day-detail-text sheet-sub">
                {language === "pt" ? "Só o humor foi registrado." : "Only a mood was logged."}
              </p>
            )}
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <h2>{t.analysis.deleteConfirmTitle}</h2>
            <p>{t.analysis.deleteConfirmBody}</p>
            <div className="correction-form-actions">
              <button type="button" className="button-ghost" onClick={() => setConfirmDeleteId(null)}>
                {t.analysis.deleteConfirmCancel}
              </button>
              <button type="button" className="button-primary" onClick={handleConfirmDelete}>
                {t.analysis.deleteConfirmAction}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
