/**
 * Demo router: landing page ↔ application shell.
 *
 * Default view (npm run dev): landing page with scenario cards.
 * Clicking a card renders the full app with that dataset.
 */

import { useState, useEffect } from "react";
import { DemoLanding, type Scenario } from "./DemoLanding";
import { MbseShell } from "./mbse/MbseShell";
import { SupplyThreadShell } from "./supply/ThreadShell";
import { BioShell } from "./bio/BioShell";
import { AnalyticsSurface, SchemaSurface } from "./surfaces/DashboardSurfaces";
import { ScaleSurface } from "./scale/ScaleSurface";
import { AuditShell } from "./audit/AuditShell";
import { useThemeStore } from "@g3t/react";
import { injectDesignTokens } from "@g3t/react";
import "@g3t/react";

/** Map scenario IDs to dedicated demo shells. */
const SHELL_MAP: Record<string, React.ComponentType<{ onBack: () => void }>> = {
  mbse: MbseShell,
  auditor: AuditShell,
  "supply-chain": SupplyThreadShell,
  biomedical: BioShell,
  "analytics-dashboard": AnalyticsSurface,
  "schema-dashboard": SchemaSurface,
  scale: ScaleSurface,
};

export function Demo() {
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    useThemeStore.getState().setTheme("dark");
    injectDesignTokens(true);
  }, []);

  useEffect(() => {
    injectDesignTokens(theme.id === "dark");
  }, [theme]);

  if (activeScenario) {
    const Shell = SHELL_MAP[activeScenario.id];
    if (Shell) {
      return <Shell onBack={() => setActiveScenario(null)} />;
    }
    // Every shipped scenario has a dedicated shell; fall back to the
    // landing if an unknown id is somehow active.
    setActiveScenario(null);
    return null;
  }

  return <DemoLanding onSelect={setActiveScenario} />;
}
