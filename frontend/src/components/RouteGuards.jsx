import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useOnboardingStatus } from "../hooks/useOnboardingStatus.js";

export function RequireAuth() {
  const { isAuthenticated, isPending } = useAuth();
  const location = useLocation();

  if (isPending) return null;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

  return <Outlet />;
}

// First login goes straight to onboarding before Today/Calendar/Fast/Patterns/About me.
export function RequireOnboarding() {
  const { loading, completed } = useOnboardingStatus();

  if (loading) return null;
  if (!completed) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
