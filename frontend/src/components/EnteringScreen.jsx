import { useLanguage } from "../context/LanguageContext.jsx";
import { Oracle } from "./Oracle.jsx";

// Branded transition screen (UPDATES.md "Loading screen antes de decidir
// onboarding vs. app"): shown by RouteGuards.jsx while RequireAuth/
// RequireOnboarding/RequireNotOnboarded are still deciding where a visitor
// lands, instead of the generic RouteSkeleton. Same nebula/grain "cosmos in
// daylight" treatment as Login/Onboarding/Mindfulness, not a blank screen or
// a bare spinner. Pass `error` + `onRetry` once the onboarding-status check
// has exhausted its own retries (see OnboardingContext.jsx), never silently
// guessed at, a real state the user can act on.
export function EnteringScreen({ error, onRetry }) {
  const { t } = useLanguage();

  return (
    <div className="entering-screen nebula grain" data-moment="decompress">
      <div className="entering-card">
        <Oracle size={140} variant="meditating" className="entering-oracle" float={!error} />
        {error ? (
          <>
            <h1>{t.entering.errorTitle}</h1>
            <p className="entering-note">{t.entering.errorNote}</p>
            <button type="button" className="button-primary entering-retry" onClick={onRetry}>
              {t.entering.retry}
            </button>
          </>
        ) : (
          <>
            <h1>{t.entering.title}</h1>
            <p className="entering-note">{t.entering.note}</p>
          </>
        )}
      </div>
    </div>
  );
}
