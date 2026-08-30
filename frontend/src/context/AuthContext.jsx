import { createContext, useContext, useMemo } from "react";
import { useSession } from "../lib/authClient.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { data, isPending, error } = useSession();

  const value = useMemo(
    () => ({
      user: data?.user || null,
      isAuthenticated: Boolean(data?.user),
      isPending,
      error,
    }),
    [data, isPending, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
