// App-wide loading placeholder system (UPDATES.md round 3 #2): a blank
// screen, opaque overlay, or bare spinner is never allowed while content is
// still loading, a shimmering block shaped like the real thing about to
// appear always is. `Skeleton` is the raw primitive, everything else below
// composes it into the actual shape of a specific page's content so the
// placeholder reads as "this is being written" rather than "something is
// broken/missing".

export function Skeleton({ className = "", style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

// Mirrors AboutMe.jsx's two-column light/dark layout (About Me page, while
// GET /api/about-me is still in flight).
export function AboutMeSkeleton() {
  return (
    <div className="about-me-columns" aria-busy="true">
      {[0, 1].map((col) => (
        <section key={col} className="about-me-column glass">
          <Skeleton className="skeleton-text" style={{ width: "40%" }} />
          <ul>
            {[0, 1, 2].map((row) => (
              <li key={row}>
                <Skeleton className="skeleton-circle" style={{ width: 6, height: 6, marginTop: 6 }} />
                <div style={{ flex: 1 }}>
                  <Skeleton className="skeleton-text" style={{ width: "55%" }} />
                  <Skeleton className="skeleton-text" style={{ width: "90%" }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// Mirrors Analysis.jsx's day-grouped timeline of analysis cards, for the
// initial GET /api/analysis fetch (the per-entry "still analyzing" pulse dot
// that already exists on individual cards stays separate from this, it
// covers a different moment: this is "the list itself hasn't loaded yet",
// that one is "this specific entry's analysis hasn't finished yet").
export function AnalysisSkeleton() {
  return (
    <div className="analysis-timeline" aria-busy="true">
      <section className="analysis-day-group">
        <Skeleton className="skeleton-text" style={{ width: "30%", height: "1.1rem" }} />
        {[0, 1].map((card) => (
          <article key={card} className="analysis-card glass">
            <Skeleton className="skeleton-text" style={{ width: "60%", height: "1rem" }} />
            <Skeleton className="skeleton-text" style={{ width: "100%" }} />
            <Skeleton className="skeleton-text" style={{ width: "85%" }} />
          </article>
        ))}
      </section>
    </div>
  );
}

// Mirrors Calendar.jsx's month grid (EDITS.md round 2 #5): a shimmering
// placeholder shaped like the actual 7-column grid instead of a spinner, so
// mood colours don't just pop in abruptly once the fetch resolves.
export function CalendarSkeleton() {
  return (
    <div className="calendar-grid glass" aria-busy="true">
      <div className="calendar-weekdays">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="skeleton-text" style={{ width: "60%", margin: "0 auto" }} />
        ))}
      </div>
      <div className="calendar-cells">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} style={{ aspectRatio: 1, borderRadius: "var(--radius-lg)" }} />
        ))}
      </div>
    </div>
  );
}
