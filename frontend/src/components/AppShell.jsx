import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { MomentProvider, useMoment } from "../context/MomentContext.jsx";
import { LanguageToggle } from "./LanguageToggle.jsx";
import { signOut } from "../lib/authClient.js";

// Glyphs match /references/dashboard's app-shell.tsx exactly, a floating
// pill tab bar rather than a conventional top navbar.
const NAV_ITEMS = [
  { to: "/today", key: "today", glyph: "◐" },
  { to: "/calendar", key: "calendar", glyph: "▦" },
  { to: "/fast", key: "fast", glyph: "◈" },
  { to: "/patterns", key: "patterns", glyph: "∿" },
  { to: "/about-me", key: "aboutMe", glyph: "✦" },
];

export function AppShell() {
  return (
    <MomentProvider>
      <AppShellInner />
    </MomentProvider>
  );
}

function AppShellInner() {
  const { t } = useLanguage();
  const { moment } = useMoment();
  const location = useLocation();

  return (
    <div className="app-shell nebula grain" data-moment={moment}>
      <div className="app-shell-inner">
        <div className="app-utility-row">
          <LanguageToggle />
          <button type="button" className="app-utility-signout" onClick={() => signOut()}>
            {t.common.signOut}
          </button>
        </div>

        <main className="app-content">
          <Outlet />
        </main>

        {/* Reserves the nav's footprint as real flex space, so .app-content
            (flex: 1) is sized to stop above it, content can never render
            behind the fixed nav no matter how short the page or how far
            it's scrolled. */}
        <div className="bottom-nav-spacer" aria-hidden="true" />

        <nav className="bottom-nav">
          <ul className="bottom-nav-list">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.to;
              return (
                <li key={item.to} className="bottom-nav-item">
                  <NavLink to={item.to} className={active ? "active" : ""}>
                    <span className="bottom-nav-glyph">{item.glyph}</span>
                    {t.nav[item.key]}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export function ScreenTitle({ eyebrow, title, sub }) {
  return (
    <header className="screen-title">
      {eyebrow && <p className="screen-title-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {sub && <p className="screen-title-sub">{sub}</p>}
    </header>
  );
}
