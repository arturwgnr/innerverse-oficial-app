import { useLanguage } from "../context/LanguageContext.jsx";

// UPDATES.md round 4: a failed initial load on About me/Analysis used to
// blank the whole page and dump a raw, hardcoded-looking red string where
// the content should be. This is the in-context replacement, a small card
// (not a page takeover) with the already-friendly Oracle-voiced message
// (see lib/api.js) plus a real way forward, instead of a dead end.
export function LoadError({ message, onRetry }) {
  const { t } = useLanguage();

  return (
    <div className="load-error glass">
      <p>{message}</p>
      <button type="button" className="load-error-retry" onClick={onRetry}>
        {t.common.retry}
      </button>
    </div>
  );
}
