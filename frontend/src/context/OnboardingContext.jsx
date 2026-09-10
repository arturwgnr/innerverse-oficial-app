import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";

const OnboardingContext = createContext(null);

// A transient failure here (network blip, backend restarting via
// --watch) used to fall straight into "not completed", sending a
// returning user back through onboarding and re-upserting over their real
// answers (UPDATES.md: "Loading screen antes de decidir onboarding vs.
// app"). A couple of quick retries absorb the common transient case; only
// once those are exhausted does this surface a real error state instead of
// guessing completed:true or completed:false.
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Single shared fetch instead of a plain hook every consumer re-runs on its
// own: preferredName (UPDATES.md round 3 #2, "use that name throughout the
// app") is read from lots of places (greetings, Oracle copy), a context
// means one request instead of one per page. Only refetches when auth state
// changes (or retry() is called), callers that need the fresh value right
// after onboarding completes reload the page rather than waiting on a
// refetch here (see Onboarding.jsx's handleFinish).
export function OnboardingProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState({ loading: true, completed: false, preferredName: null, error: false });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus({ loading: false, completed: false, preferredName: null, error: false });
      return;
    }
    let cancelled = false;
    setStatus((prev) => ({ ...prev, loading: true, error: false }));

    async function load() {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const data = await api.get("/api/onboarding/status");
          if (!cancelled) {
            setStatus({ loading: false, completed: data.completed, preferredName: data.preferredName || null, error: false });
          }
          return;
        } catch {
          if (cancelled) return;
          if (attempt < MAX_RETRIES) {
            await sleep(RETRY_DELAY_MS);
            continue;
          }
          // Retries exhausted: a real error state, never a silent guess.
          // RouteGuards.jsx checks this before completed, so it can never
          // bounce an existing user into onboarding on a transient blip.
          setStatus({ loading: false, completed: false, preferredName: null, error: true });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, retryToken]);

  return (
    <OnboardingContext.Provider value={{ ...status, retry: () => setRetryToken((t) => t + 1) }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingStatus() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboardingStatus must be used within OnboardingProvider");
  return ctx;
}
