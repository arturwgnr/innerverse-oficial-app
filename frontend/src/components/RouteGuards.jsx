import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useOnboardingStatus } from "../context/OnboardingContext.jsx";
import { useMinDuration } from "../hooks/useMinDuration.js";
import { EnteringScreen } from "./EnteringScreen.jsx";

// The branded "Entering your Innerverse" screen stays up for at least this
// long once it appears, even if the underlying check resolves almost
// instantly (a warm/cached session), so it never just flashes on and off.
const MIN_ENTERING_MS = 1500;

export function RequireAuth() {
  const { isAuthenticated, isPending } = useAuth();
  const location = useLocation();
  const showEntering = useMinDuration(isPending, MIN_ENTERING_MS);

  if (showEntering) return <EnteringScreen />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
}

// First login goes straight to onboarding before Today/Calendar/Fast/Analysis/About me.
export function RequireOnboarding() {
  const { loading, completed, error, retry } = useOnboardingStatus();
  const showEntering = useMinDuration(loading, MIN_ENTERING_MS);

  if (showEntering) return <EnteringScreen />;
  // Checked before `completed` (UPDATES.md "Loading screen antes de decidir
  // onboarding vs. app"): a transient failure used to silently read as
  // "not completed" here and bounce an already-onboarded user back into
  // onboarding. Now it surfaces a real retry screen instead of guessing.
  if (error) return <EnteringScreen error onRetry={retry} />;
  if (!completed) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}

// Onboarding only ever runs once per user (EDITS.md round 5): once completed,
// hitting /onboarding directly (URL, back button) must not re-run it, that
// upserts over real answers. Later edits happen through Settings only.
export function RequireNotOnboarded() {
  const { loading, completed, error, retry } = useOnboardingStatus();
  const showEntering = useMinDuration(loading, MIN_ENTERING_MS);

  if (showEntering) return <EnteringScreen />;
  if (error) return <EnteringScreen error onRetry={retry} />;
  if (completed) return <Navigate to="/today" replace />;

  return <Outlet />;
}
