/**
 * prefers-reduced-motion, as React state (P2.2). The shells pass its
 * negation to the canvas `animate` prop (and any component modeling
 * the consumer-decides pattern, like CoverageMeter), so a visitor's
 * OS-level motion setting quiets layout transitions across the whole
 * playground. Live-updates when the media query flips.
 */
import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(QUERY).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
