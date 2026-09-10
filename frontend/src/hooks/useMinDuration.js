import { useEffect, useRef, useState } from "react";

// Keeps a transient screen visible for at least `minMs` once it starts, even
// if the real thing it's covering for resolves much faster (RouteGuards.jsx:
// "Entering your Innerverse" was flashing on and off almost instantly on a
// warm session/cache, this smooths that into a real, deliberate beat).
// Never delays anything that was never actually active, a guard whose
// underlying check is already resolved by the time it mounts shows nothing.
export function useMinDuration(isActive, minMs) {
  const [shown, setShown] = useState(isActive);
  const startedAt = useRef(isActive ? Date.now() : null);

  useEffect(() => {
    if (isActive) {
      startedAt.current = Date.now();
      setShown(true);
      return;
    }
    if (!shown) return;
    const elapsed = Date.now() - (startedAt.current || Date.now());
    const remaining = Math.max(0, minMs - elapsed);
    const timer = setTimeout(() => setShown(false), remaining);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return shown;
}
