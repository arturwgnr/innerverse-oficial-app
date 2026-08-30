// Real mascot art (JOURNAL.md section 9), synced from /fotos at the project
// root into public/oracle by `npm run sync-oracle` (also runs automatically
// before dev/build). Falls back to the "main" variant if a size hasn't been
// dropped in yet, so a missing file never breaks a page.
//
// Variants are chosen deliberately per screen context, not randomly:
// - "main": neutral default, brand moments, small nav-level appearances.
// - "notes": writing focused contexts (Today's arrival screen, onboarding).
// - "meditating": calm/reflective contexts (Decompress, Night's closing tone,
//   "thinking" states while an analysis is running).
// - "onboarding": presenting/explaining pose, only for the onboarding intro.
// - "hi": waving, an invitation (the mindfulness card/page).
//
// Size is set as a CSS custom property, not inline width/height, so a
// wrapping class (e.g. .hero-oracle) can shrink it responsively per
// viewport with a plain media query instead of fighting inline styles.
const VARIANT_FILES = {
  main: "/oracle/oracle-main.png",
  notes: "/oracle/oracle-notes.png",
  meditating: "/oracle/oracle-meditating.png",
  onboarding: "/oracle/oracle-onboarding.png",
  hi: "/oracle/oracle-hi.png",
};

export function Oracle({ size = 84, variant = "main", float = true, className = "", alt = "The Oracle" }) {
  const src = VARIANT_FILES[variant] ?? VARIANT_FILES.main;

  return (
    <div className={`oracle-wrap ${className}`} style={{ "--oracle-size": `${size}px` }}>
      <div className="oracle-glow" />
      <img
        src={src}
        alt={alt}
        className={`oracle ${float ? "oracle-float" : ""}`}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = VARIANT_FILES.main;
        }}
      />
    </div>
  );
}
