import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { LanguageToggle } from "../components/LanguageToggle.jsx";
import { Oracle } from "../components/Oracle.jsx";
import { useInView } from "../hooks/useInView.js";
import { MOMENTS } from "../lib/moments.js";
import { CleanMirrorDemo } from "../components/CleanMirrorDemo.jsx";

function Reveal({ children, className = "", delay = 0 }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className={`reveal ${inView ? "in-view" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function Landing() {
  const { t, language } = useLanguage();

  return (
    <div className="landing">
      <a className="visually-hidden" href="#hero">
        Skip to content
      </a>

      <header className="landing-nav">
        <Link to="/" className="landing-nav-brand">
          {t.common.appName}
        </Link>
        <div className="landing-nav-actions">
          <LanguageToggle />
          <Link className="button-primary landing-nav-cta" to="/login">
            {t.landing.hero.cta}
          </Link>
        </div>
      </header>

      <section id="hero" className="landing-section hero-section nebula grain">
        <div className="hero-grid container">
          <Reveal>
            <p className="eyebrow">{t.landing.hero.eyebrow}</p>
            <h1 className="hero-title">
              {t.landing.hero.title}
              <br />
              <span className="text-iridescent">{t.landing.hero.titleAccent}</span>
            </h1>
            <p className="hero-body">{t.landing.hero.body}</p>
            <div className="hero-cta-row">
              <Link className="button-primary" to="/login">
                {t.landing.hero.cta}
              </Link>
              <p className="hero-cta-note">{t.landing.hero.ctaNote}</p>
            </div>
          </Reveal>

          <Reveal delay={150} className="hero-oracle-wrap">
            <Oracle size={220} className="hero-oracle" />
          </Reveal>
        </div>
      </section>

      <section id="why-it-works" className="landing-section why-section">
        <Reveal className="container why-content">
          <p className="eyebrow">{t.landing.whyJournaling.eyebrow}</p>
          <h2>{t.landing.whyJournaling.title}</h2>
          <p className="why-accent text-iridescent">{t.landing.whyJournaling.titleAccent}</p>
          <p className="lede">{t.landing.whyJournaling.body}</p>
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
                <div className="moment-preview-card glass nebula" data-moment={m}>
                  <p className="moment-preview-window">{t.moments[m].window}</p>
                  <h3>{t.moments[m].label}</h3>
                  <p>{t.moments[m].tagline}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section mirror-section">
        <Reveal className="container">
          <CleanMirrorDemo language={language} />
        </Reveal>
      </section>

      <section id="oracle" className="landing-section oracle-section nebula grain" data-moment="decompress">
        <div className="oracle-grid container">
          <Reveal className="oracle-section-oracle">
            <Oracle size={220} className="oracle-section-hero" />
          </Reveal>
          <Reveal delay={120}>
            <p className="eyebrow">{t.landing.oracleSection.eyebrow}</p>
            <div className="oracle-quote glass">
              <p>{t.landing.oracleSection.quote}</p>
              <p className="oracle-quote-sub">{t.landing.oracleSection.quoteSub}</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="landing-section closing-section">
        <Reveal className="container closing-content">
          <h2>{t.landing.closing.title}</h2>
          <p className="lede">{t.landing.closing.body}</p>
          <Link className="button-primary" to="/login">
            {t.landing.hero.cta}
          </Link>
        </Reveal>
      </section>

      <footer className="landing-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <span className="landing-nav-brand">{t.common.appName}</span>
            <p>{t.landing.footer.tagline}</p>
          </div>
          <nav className="footer-links">
            <a href="#why-it-works">{t.landing.footer.whyItWorks}</a>
            <a href="#how-it-works">{t.landing.footer.howItWorks}</a>
            <a href="#oracle">{t.landing.footer.oracle}</a>
            <Link to="/login">{t.common.signIn}</Link>
          </nav>
        </div>
        <p className="container footer-bottom">
          &copy; {new Date().getFullYear()} {t.landing.footer.copyright}
        </p>
      </footer>
    </div>
  );
}
