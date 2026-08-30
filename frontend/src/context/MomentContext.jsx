import { createContext, useContext, useMemo, useState } from "react";
import { getCurrentMoment } from "../lib/moments.js";

// Shared across every authenticated screen (mirrors /references/dashboard's
// MomentProvider): one active moment, auto detected on load, manually
// switchable from Today, and the tint every internal screen inherits, not
// just Today itself.
const MomentContext = createContext(null);

export function MomentProvider({ children }) {
  const detected = useMemo(() => getCurrentMoment(), []);
  const [moment, setMoment] = useState(detected);

  const value = useMemo(() => ({ moment, setMoment, detected, isManual: moment !== detected }), [moment, detected]);

  return <MomentContext.Provider value={value}>{children}</MomentContext.Provider>;
}

export function useMoment() {
  const ctx = useContext(MomentContext);
  if (!ctx) throw new Error("useMoment must be used within MomentProvider");
  return ctx;
}
