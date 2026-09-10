import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import { api } from "../lib/api.js";

// Topbar "what's new" bell (user request): broadcast notifications, same
// rows for every user, each dated so people can see exactly when something
// shipped. Content is hand-authored directly in the database for now (see
// schema.sql's seeded example row), no authoring UI yet.
export function NotificationsBell() {
  const { t, language } = useLanguage();
  const [notifications, setNotifications] = useState(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    api
      .get("/api/notifications")
      .then(setNotifications)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  function togglePanel() {
    const opening = !open;
    setOpen(opening);
    // Marks everything read the moment the panel opens, not per item, so the
    // badge clears as soon as the user has actually seen the list.
    if (opening && notifications?.some((n) => !n.read)) {
      api
        .post("/api/notifications/read-all")
        .then(() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))))
        .catch(() => {});
    }
  }

  function formatDate(dateLike) {
    return new Date(dateLike).toLocaleDateString(language === "pt" ? "pt-BR" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const unreadCount = (notifications || []).filter((n) => !n.read).length;

  return (
    <div className="notifications-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="app-topbar-notifications"
        onClick={togglePanel}
        aria-label={t.nav.notifications}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 9.5a6 6 0 0 1 12 0v3.6l1.6 3.2a1 1 0 0 1-.9 1.4H5.3a1 1 0 0 1-.9-1.4L6 13.1z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && <span className="notifications-badge" aria-hidden="true" />}
      </button>

      {open && (
        <div className="notifications-panel glass">
          <p className="notifications-panel-heading">{t.notifications.heading}</p>
          {!notifications && <p className="page-note">{t.common.loading}</p>}
          {notifications && notifications.length === 0 && <p className="page-note">{t.notifications.empty}</p>}
          <ul className="notifications-list">
            {(notifications || []).map((n) => (
              <li key={n.id} className="notifications-item">
                <p className="notifications-item-date">{formatDate(n.created_at)}</p>
                <p className="notifications-item-title">{n.title}</p>
                <p className="notifications-item-body">{n.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
