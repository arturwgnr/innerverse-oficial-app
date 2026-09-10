import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { Oracle } from "../components/Oracle.jsx";
import { useInView } from "../hooks/useInView.js";
import { MOMENTS } from "../lib/moments.js";

const MOODS = [1, 2, 3, 4, 5, 6];

function Reveal({ children, className = "", delay = 0 }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? "in-view" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// Cycles the hero preview card through a few lines (EDITS.md round 2 #2), so
// it reads like the app already mid-use ("Yesterday, ..." / "Tomorrow, ...")
// instead of a single static mockup line.
function HeroBubble({ lines }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Slower now (EDITS.md round 3: hold each line longer before swapping,
    // was cycling too fast at 4s to actually read).
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % lines.length),
      7000,
    );
    return () => clearInterval(timer);
  }, [lines.length]);

  const current = lines[index];
  return (
    <div className="hero-visual-bubble glass">
      <p key={`${index}-label`} className="hero-visual-bubble-label">
        {current.label}
      </p>
      <p key={`${index}-quote`} className="hero-visual-bubble-quote">
        &ldquo;{current.quote}&rdquo;
      </p>
    </div>
  );
}

export function Landing() {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  // Active-section nav highlighting (UPDATES.md round 6 #2's visual pass):
  // the nav link matching whatever section is actually in view lights up as
  // the visitor scrolls, instead of the links sitting static regardless of
  // where they are on the page.
  const [activeSection, setActiveSection] = useState("");
  // Tap-to-explore on the moment cards (UPDATES.md "Seção 3": the section
  // read as static, only fading in on scroll). Reuses the same colorful
  // hover wash as its payoff, so a tap gives touch visitors (no hover at
  // all) the same reveal a mouse visitor gets, instead of the section only
  // ever coming alive for desktop.
  const [activeMoment, setActiveMoment] = useState(null);

  // .landing scrolls itself (overflow-y:auto), not the window, so a plain
  // window scroll listener never fires here. Without a surface once scrolled
  // past the hero, the nav stayed invisible for the rest of the page and its
  // links sat directly on top of section text (EDITS.md round 2 #2).
  useEffect(() => {
    const el = document.querySelector(".landing");
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 20);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const root = document.querySelector(".landing");
    const sections = ["how-it-works", "why-it-works", "oracle"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!root || sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (mostVisible) setActiveSection(mostVisible.target.id);
      },
      { root, threshold: [0.35, 0.6] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // Subtle mouse-tracking tilt on the hero screenshot frame (UPDATES.md
  // round 6 #2's "more interactive/immersive" ask), gated to fine pointers,
  // reset smoothly on leave rather than snapping back.
  function handleHeroVisualMove(event) {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    event.currentTarget.style.setProperty("--tilt-x", `${(-py * 8).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${(px * 8).toFixed(2)}deg`);
  }

  function handleHeroVisualLeave(event) {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div className="landing">
      <a className="visually-hidden" href="#hero">
        Skip to content
      </a>

      <header
        className={`landing-nav ${scrolled ? "landing-nav-scrolled glass" : ""}`}
      >
        <div className="landing-nav-inner container">
          {/* Was `<Link to="/">`, a no-op click since this page already is
              "/" (UPDATES.md): now scrolls smoothly to the top, matching the
              footer's own "back to top" link. */}
          <a href="#hero" className="landing-nav-brand">
            <span className="landing-nav-logo" aria-hidden="true">
              ✦
            </span>
            {t.common.appName}
          </a>
          <nav className="landing-nav-links">
            <a href="#how-it-works" className={activeSection === "how-it-works" ? "active" : ""}>
              {t.landing.nav.linkHowItWorks}
            </a>
            <a href="#why-it-works" className={activeSection === "why-it-works" ? "active" : ""}>
              {t.landing.nav.linkFeatures}
            </a>
            <a href="#oracle" className={activeSection === "oracle" ? "active" : ""}>
              {t.landing.nav.linkOracle}
            </a>
          </nav>
          <div className="landing-nav-actions">
            {/* Language toggle removed (UPDATES.md round 5 #1): app stays
                English only until further notice. LanguageContext and the
                locale files themselves stay in place, this is UI only. */}
            <Link className="button-primary landing-nav-cta" to="/today">
              {t.landing.nav.cta}
            </Link>
          </div>
        </div>
      </header>

      <section id="hero" className="landing-section hero-section nebula grain">
        <div className="hero-grid container">
          <Reveal>
            <p className="eyebrow hero-eyebrow">
              <span className="hero-eyebrow-dot" aria-hidden="true" />
              {t.landing.hero.eyebrow}
            </p>
            <h1 className="hero-title">
              {t.landing.hero.title}
              <span className="text-iridescent">
                {t.landing.hero.titleAccent}
              </span>
            </h1>
            <p className="hero-body">{t.landing.hero.body}</p>
            <div className="hero-cta-row">
              <div className="hero-cta-buttons">
                <Link className="button-primary" to="/login?mode=signup">
                  {t.landing.hero.cta}
                </Link>
                <a className="hero-secondary-cta" href="#how-it-works">
                  {t.landing.hero.secondaryCta}{" "}
                  <span className="hero-secondary-cta-arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              </div>
            </div>
            <p className="hero-caption">{t.landing.hero.badges.join(" · ")}</p>
          </Reveal>

          <Reveal delay={150} className="hero-visual-wrap">
            <div className="hero-visual" onMouseMove={handleHeroVisualMove} onMouseLeave={handleHeroVisualLeave}>
              <div className="hero-visual-frame grain" />
              <HeroBubble lines={t.landing.hero.previewLines} />
              {/* Enlarged, sitting upright at the frame's bottom-left corner
                  (follow-up fix: the top-right tilted placement read as
                  leaning/off, not a deliberate sticker). */}
              <Oracle size={190} className="hero-visual-oracle" />
            </div>
          </Reveal>
        </div>
      </section>

      <section id="why-it-works" className="landing-section why-section">
        <Reveal className="container why-content">
          <p className="eyebrow">{t.landing.whyJournaling.eyebrow}</p>
          <h2>{t.landing.whyJournaling.title}</h2>
          <p className="why-accent text-iridescent">
            {t.landing.whyJournaling.titleAccent}
          </p>

          <div className="why-features">
            {t.landing.whyJournaling.features.map((feature, i) => (
              <Reveal
                key={feature.title}
                delay={i * 90}
                className="why-feature-card glass"
              >
                <span className="why-feature-icon" aria-hidden="true">
                  {feature.icon}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </section>

      <section id="how-it-works" className="landing-section moments-section">
        <div className="container">
          <Reveal>
            <p className="eyebrow">{t.landing.moments.eyebrow}</p>
            <h2 className="moments-title">{t.landing.moments.title}</h2>
          </Reveal>

          <div className="moments-grid">
            {MOMENTS.map((m, i) => (
              <Reveal key={m} delay={i * 90}>
                {/* A button, not a static div (UPDATES.md "Seção 3"): tapping
                    toggles the same colorful wash .active gets in CSS, so
                    the card genuinely invites exploring each moment instead
                    of only reacting to a mouse hover. */}
                <button
                  type="button"
                  className={`moment-preview-card glass ${activeMoment === m ? "active" : ""}`}
                  data-moment={m}
                  onClick={() => setActiveMoment((prev) => (prev === m ? null : m))}
                >
                  <p className="moment-preview-window">{t.moments[m].window}</p>
                  <h3>{t.moments[m].label}</h3>
                  <p>{t.moments[m].tagline}</p>
                </button>
              </Reveal>
            ))}
          </div>

          <Reveal delay={360} className="moments-mood-legend-wrap">
            <p className="moments-mood-legend-label">
              {t.landing.moments.moodLegendLabel}
            </p>
            <div className="mood-legend">
              {MOODS.map((m) => (
                <span key={m} className="legend-item">
                  <span className={`legend-dot mood-${m}`} />
                  {t.moods[m]}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section
        id="oracle"
        className="landing-section oracle-section nebula grain"
        data-moment="decompress"
      >
        {/* Reverted to the original two-column grid (UPDATES.md round 6 #2):
            round 5 #2's tilted corner-sticker treatment was meant for the
            hero mascot below, not this section, it landed here by mistake. */}
        <div className="oracle-grid container">
          <Reveal className="oracle-section-oracle">
            <div className="oracle-stage nebula grain">
              <Oracle size={220} variant="hi" className="oracle-section-hero" />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <p className="eyebrow">{t.landing.oracleSection.eyebrow}</p>
            <div className="oracle-quote glass">
              <p>{t.landing.oracleSection.quote}</p>
              <p className="oracle-quote-sub">
                {t.landing.oracleSection.quoteSub}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="landing-section closing-section">
        <Reveal className="container closing-content">
          {/* Title removed (UPDATES.md), paragraph and CTAs kept. */}
          <p className="closing-lede">{t.landing.closing.body}</p>
          <div className="closing-cta-buttons">
            <Link className="button-primary" to="/login?mode=signup">
              {t.landing.hero.cta}
            </Link>
            <Link className="closing-signin" to="/login">
              {t.common.signIn}
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-accent" aria-hidden="true" />
        <div className="container footer-grid">
          <div className="footer-brand">
            <span className="landing-nav-brand">
              <span className="landing-nav-logo" aria-hidden="true">
                ✦
              </span>
              {t.common.appName}
            </span>
            <p>{t.landing.footer.tagline}</p>
            <p className="footer-promise">{t.landing.footer.promise}</p>
          </div>
          <div className="footer-nav-columns">
            <nav className="footer-links">
              <p className="footer-links-heading">
                {t.landing.footer.exploreHeading}
              </p>
              <a href="#why-it-works">{t.landing.footer.whyItWorks}</a>
              <a href="#how-it-works">{t.landing.footer.howItWorks}</a>
              <a href="#oracle">{t.landing.footer.oracle}</a>
            </nav>
            <nav className="footer-links">
              <p className="footer-links-heading">
                {t.landing.footer.accountHeading}
              </p>
              <Link to="/login">{t.common.signIn}</Link>
              <Link to="/today">{t.landing.nav.cta}</Link>
            </nav>
          </div>
        </div>
        <div className="container footer-bottom-row">
          <p className="footer-bottom">
            &copy; {new Date().getFullYear()} {t.landing.footer.copyright}
          </p>
          {/* Real SVG arrow instead of the unicode "↑" that used to be baked
              into the copy string (UPDATES.md footer redesign), same
              treatment already used for icons elsewhere in the app. */}
          <a href="#hero" className="footer-top-link">
            {t.landing.footer.backToTop}
            <span className="footer-top-link-icon" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </a>
        </div>
      </footer>
    </div>
  );
}
