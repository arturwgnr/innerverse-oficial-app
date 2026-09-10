import { useEffect, useState } from "react";
import { NavLink, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { MomentProvider, useMoment } from "../context/MomentContext.jsx";
import { signOut } from "../lib/authClient.js";
import { api } from "../lib/api.js";
import { flushEntryQueue } from "../lib/entryQueue.js";
import { pickLine } from "../lib/toastCopy.js";
import { NotificationsBell } from "./NotificationsBell.jsx";

// Reduced to four bottom nav items plus a center "add" shortcut (EDITS.md
// round 2 #1, Hick's Law: fewer choices in the spot used most often).
// Calendar and Settings moved into the sidebar instead. Fast and Analysis
// swapped (UPDATES.md round 4 #2).
const NAV_ITEMS = [
  { to: "/today", key: "home", glyph: "⌂" },
  { to: "/analysis", key: "analysis", glyph: "∿" },
  { to: "/fast", key: "fast", glyph: "◈" },
  { to: "/about-me", key: "aboutMe", glyph: "✦" },
];

// "Início" added as the first item (UPDATES.md round 4 #5), plain glyphs
// replaced with real SVG icons (round 4 #5's visual pass) instead of the
// crude ▦ ▥ ⚙ characters, same treatment the bottom nav's "+" already got.
const SIDEBAR_ITEMS = [
  { to: "/today", key: "home" },
  { to: "/calendar", key: "calendar" },
  { to: "/stats", key: "stats" },
  { to: "/settings", key: "settings" },
];

function SidebarIcon({ itemKey }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true };
  switch (itemKey) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 10v9a1 1 0 0 0 1 1h3v-5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V20h3a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="4" y="5.5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3.5v4M16 3.5v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "stats":
      return (
        <svg {...common}>
          <path d="M5 20V11M12 20V4M19 20v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

// Real SVG icon (UPDATES.md round 4 #6), same treatment as the sign-out icon
// and the bottom nav's "+", replacing the old hand-rolled 3-<span> bars.
function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 4.5H7a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 7 19.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 12h10.5M17.5 8.5 21 12l-3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Save-resilience queue flush (UPDATES.md round 4 #3): retries any entry
  // that failed to save outright, on app load and again whenever the browser
  // comes back online, instead of leaving it stuck in localStorage until the
  // next successful manual save happens to trigger a retry.
  useEffect(() => {
    async function flush() {
      const flushed = await flushEntryQueue((body) => api.post("/api/entries", body));
      if (flushed > 0) showToast(pickLine(t.toasts.entryQueueFlushed), "success");
    }
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    // Explicit navigate, not left to RequireAuth to figure out: without
    // this, signing out from inside the shell landed on /login (whatever
    // the auth guard redirects an unauthenticated visitor to), not the
    // marketing page (EDITS.md round 2 #1).
    navigate("/", { replace: true });
  }

  return (
    <div className="app-shell nebula grain" data-moment={moment}>
      <div className="app-shell-inner">
        <header className="app-topbar glass">
          <button type="button" className="app-hamburger" onClick={() => setMenuOpen(true)} aria-label={t.nav.menu}>
            <HamburgerIcon />
          </button>
          <span className="app-topbar-brand">{t.common.appName}</span>
          <NotificationsBell />
          {/* Same sign-out action as the sidebar, also reachable straight
              from the top bar without opening the menu (EDITS.md round 5). */}
          <button type="button" className="app-topbar-signout" onClick={handleSignOut} aria-label={t.common.signOut}>
            <SignOutIcon />
          </button>
        </header>

        {/* Real sidebar, not a centered modal dropdown (EDITS.md round 3).
            Solid background (no .glass translucency, that was the source of
            the seam/gap artifact along its edge), square corners, edge to
            edge on its own bounds, narrowed from half the viewport width
            (UPDATES.md round 4 #5, see .app-sidebar in components.css). Sign
            out lives at the bottom (EDITS.md round 5: a round 3 note said
            move it to the top, that was a mistake, reverted, bottom is
            correct). */}
        <div className={`app-sidebar-backdrop ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden={!menuOpen}>
          <aside className={`app-sidebar ${menuOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="app-sidebar-head">
              <span className="app-topbar-brand">{t.common.appName}</span>
              <button type="button" className="modal-close" onClick={() => setMenuOpen(false)} aria-label={t.common.back}>
                ×
              </button>
            </div>
            <nav className="app-sidebar-links">
              {SIDEBAR_ITEMS.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={active ? "active" : ""}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="app-sidebar-link-glyph">
                      <SidebarIcon itemKey={item.key} />
                    </span>
                    {t.nav[item.key]}
                  </NavLink>
                );
              })}
            </nav>
            <button type="button" className="app-sidebar-signout" onClick={handleSignOut}>
              <span className="app-sidebar-signout-glyph" aria-hidden="true">
                <SignOutIcon />
              </span>
              {t.common.signOut}
            </button>
          </aside>
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
            {NAV_ITEMS.slice(0, 2).map((item) => {
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

            <li className="bottom-nav-item bottom-nav-item-add">
              <Link to="/today?compose=1" className="bottom-nav-add" aria-label={t.nav.addEntry}>
                {/* A real icon, not a raw "+" character (EDITS.md round 3:
                    the text glyph read as too small/weak, inconsistent
                    across fonts). Stroke width set to look right at this
                    button's size rather than a generic icon default. */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </Link>
            </li>

            {NAV_ITEMS.slice(2).map((item) => {
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
