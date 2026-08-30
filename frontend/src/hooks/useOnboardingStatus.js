import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export function useOnboardingStatus() {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState({ loading: true, completed: false });

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus({ loading: false, completed: false });
      return;
    }
    let cancelled = false;
    api
      .get("/api/onboarding/status")
      .then((data) => {
        if (!cancelled) setStatus({ loading: false, completed: data.completed });
      })
      .catch(() => {
        if (!cancelled) setStatus({ loading: false, completed: false });
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return status;
}
