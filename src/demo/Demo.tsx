/**
 * Demo router: landing page ↔ application shell.
 *
 * Default view (npm run dev): landing page with scenario cards.
 * Clicking a card renders the full app with that dataset.
 *
 * Shells are CODE-SPLIT (G3L Round 49): eleven lazy chunks instead
 * of one bundle carrying every example, which was the source of the
 * >500 kB chunk warning. The landing paints from a small chunk; a
 * shell's code loads on selection (the production-smoke spec's
 * 15 s mount window covers the fetch).
 *
 * A chunk fetch can FAIL (offline, a stale index against a redeployed
 * Pages build), and a rejected lazy throws during render. With only a
 * <Suspense> here that took the whole app down to a blank page, so the
 * boundary below is not decoration: it is the difference between a
 * message with a retry and nothing at all.
 */

import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { DemoLanding, type Scenario } from "./DemoLanding";
import { useThemeStore, ViewErrorBoundary } from "@g3t/react";
import { injectDesignTokens } from "@g3t/react";
import "@g3t/react";

type ShellLoader = () => Promise<{
  default: React.ComponentType<{ onBack: () => void }>;
}>;

/**
 * Map scenario IDs to dedicated demo shells, held as LOADERS rather
 * than ready-made lazy components: React.lazy caches a rejected import
 * forever, so retrying a failed chunk fetch means building a new lazy
 * from the loader. A module-level `lazy(...)` can only ever re-throw.
 */
const SHELL_MAP: Record<string, ShellLoader> = {
  mbse: () =>
    import("./mbse/MbseShell").then((m) => ({ default: m.MbseShell })),
  auditor: () =>
    import("./audit/AuditShell").then((m) => ({ default: m.AuditShell })),
  "supply-chain": () =>
    import("./supply/ThreadShell").then((m) => ({
      default: m.SupplyThreadShell,
    })),
  biomedical: () =>
    import("./bio/BioShell").then((m) => ({ default: m.BioShell })),
  "analytics-dashboard": () =>
    import("./surfaces/DashboardSurfaces").then((m) => ({
      default: m.AnalyticsSurface,
    })),
  scale: () =>
    import("./scale/ScaleSurface").then((m) => ({ default: m.ScaleSurface })),
  "ontology-workbench": () =>
    import("./ontology/OntologyShell").then((m) => ({
      default: m.OntologyShell,
    })),
  "style-lab": () =>
    import("./stylelab/StyleLabShell").then((m) => ({
      default: m.StyleLabShell,
    })),
  "routing-lab": () =>
    import("./routing/RoutingShell").then((m) => ({ default: m.RoutingShell })),
  "rdf12-hyperarcs": () =>
    import("./rdf12/Rdf12Shell").then((m) => ({ default: m.Rdf12Shell })),
  legibility: () =>
    import("./legibility/LegibilityShell").then((m) => ({
      default: m.LegibilityShell,
    })),
  "routing-explain": () =>
    import("./routing-explain/RoutingExplainShell").then((m) => ({
      default: m.RoutingExplainShell,
    })),
};

export function Demo() {
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [attempt, setAttempt] = useState(0);
  const theme = useThemeStore((s) => s.theme);

  const loader = activeScenario ? SHELL_MAP[activeScenario.id] : undefined;
  const Shell = useMemo(
    () => (loader ? lazy(loader) : null),
    // `attempt` is deliberately a dependency with no use in the body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loader, attempt],
  );

  useEffect(() => {
    useThemeStore.getState().setTheme("dark");
    injectDesignTokens(true);
  }, []);

  useEffect(() => {
    injectDesignTokens(theme.id === "dark");
  }, [theme]);

  if (activeScenario) {
    if (Shell) {
      return (
        <ViewErrorBoundary
          fallback={({ error, retry }) => (
            <div style={{ padding: 24 }}>
              <p>
                {activeScenario.title} did not load: {error.message}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAttempt((n) => n + 1);
                  retry();
                }}
              >
                Retry
              </button>{" "}
              <button type="button" onClick={() => setActiveScenario(null)}>
                Back to examples
              </button>
            </div>
          )}
        >
          <Suspense fallback={<p style={{ padding: 24 }}>Loading example…</p>}>
            {/* react-hooks/static-components guards against a component
                whose identity churns every render and so resets its
                state. That is not this: the useMemo above pins the
                identity to (loader, attempt), and the only thing that
                bumps attempt is the retry button, where a remount is the
                entire point. A module-level lazy() cannot be retried at
                all: it caches its rejection. */}
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Shell onBack={() => setActiveScenario(null)} />
          </Suspense>
        </ViewErrorBoundary>
      );
    }
    // Every shipped scenario has a dedicated shell; fall back to the
    // landing if an unknown id is somehow active.
    setActiveScenario(null);
    return null;
  }

  return <DemoLanding onSelect={setActiveScenario} />;
}
