import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../lib/api.js";
import { ScreenTitle } from "../components/AppShell.jsx";
import { Skeleton } from "../components/Skeleton.jsx";

const MOODS = [1, 2, 3, 4, 5, 6];
const MOMENTS = ["morning", "afternoon", "night", "decompress"];

// Plain CSS bar charts, no charting library (EDITS.md round 2 #1's
// navigation overhaul asks for a Stats page "shown as charts"; the app
// stays dependency-light everywhere else, this follows that). Mood bars
// reuse the same --mood-1..6 tokens as the calendar and Fast mode, so the
// red-to-green thermometer means the same thing here as everywhere else.
export function Stats() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/api/stats")
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="stats-page">
        <ScreenTitle eyebrow={t.stats.eyebrow} title={t.stats.title} />
        <p className="form-error">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="stats-page">
        <ScreenTitle eyebrow={t.stats.eyebrow} title={t.stats.title} />
        <div className="stats-summary-row" aria-busy="true">
          <Skeleton style={{ height: 88 }} />
          <Skeleton style={{ height: 88 }} />
        </div>
        <Skeleton style={{ height: 220, marginTop: "var(--space-6)" }} />
      </div>
    );
  }

  const moodCounts = Object.fromEntries(MOODS.map((m) => [m, 0]));
  for (const row of stats.byMood) moodCounts[row.mood] = row.count;
  const maxMoodCount = Math.max(1, ...Object.values(moodCounts));

  const momentCounts = Object.fromEntries(MOMENTS.map((m) => [m, 0]));
  for (const row of stats.byMoment) momentCounts[row.moment] = row.count;
  const maxMomentCount = Math.max(1, ...Object.values(momentCounts));

  const maxWeekly = Math.max(1, ...stats.weekly.map((w) => w.count));

  return (
    <div className="stats-page">
      <ScreenTitle eyebrow={t.stats.eyebrow} title={t.stats.title} sub={t.stats.note} />

      <div className="stats-summary-row">
        <div className="stats-summary-card glass">
          <p className="stats-summary-value">{stats.totalEntries}</p>
          <p className="stats-summary-label">{t.stats.totalEntries}</p>
        </div>
        <div className="stats-summary-card glass">
          <p className="stats-summary-value">{stats.currentStreak}</p>
          <p className="stats-summary-label">{t.stats.currentStreak}</p>
        </div>
      </div>

      <section className="stats-chart-card glass">
        <h2>{t.stats.moodFrequency}</h2>
        <div className="stats-bar-chart stats-bar-chart-horizontal">
          {MOODS.map((m) => (
            <div key={m} className="stats-hbar-row">
              <span className="stats-hbar-label">{t.moods[m]}</span>
              <div className="stats-hbar-track">
                <div
                  className={`stats-hbar-fill mood-${m}`}
                  style={{ width: `${(moodCounts[m] / maxMoodCount) * 100}%` }}
                />
              </div>
              <span className="stats-hbar-count">{moodCounts[m]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="stats-chart-card glass">
        <h2>{t.stats.momentBreakdown}</h2>
        <div className="stats-bar-chart stats-bar-chart-vertical">
          {MOMENTS.map((m) => (
            <div key={m} className="stats-vbar-col">
              <span className="stats-vbar-count">{momentCounts[m]}</span>
              <div className="stats-vbar-track">
                <div
                  className="stats-vbar-fill"
                  style={{ height: `${(momentCounts[m] / maxMomentCount) * 100}%` }}
                />
              </div>
              <span className="stats-vbar-label">{t.moments[m].label}</span>
            </div>
          ))}
        </div>
      </section>

      {stats.weekly.length > 0 && (
        <section className="stats-chart-card glass">
          <h2>{t.stats.weeklyTrend}</h2>
          <div className="stats-bar-chart stats-bar-chart-vertical stats-weekly">
            {stats.weekly.map((w) => (
              <div key={w.weekStart} className="stats-vbar-col">
                <span className="stats-vbar-count">{w.count}</span>
                <div className="stats-vbar-track">
                  <div className="stats-vbar-fill" style={{ height: `${(w.count / maxWeekly) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
