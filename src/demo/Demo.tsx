/**
 * Demo router: landing page ↔ application shell.
 *
 * Default view (npm run dev): landing page with scenario cards.
 * Clicking a card renders the full app with that dataset.
 */

import { useState, useEffect } from "react";
import { DemoLanding, type Scenario } from "./DemoLanding";
import { DemoApp } from "./DemoApp";
import { HealthcareDemo } from "./shells/HealthcareDemo";
import { DataScientistDemo } from "./shells/DataScientistDemo";
import { AnalyticsDemo } from "./shells/AnalyticsDemo";
import { AuditorDemo, MBSEDemo } from "./shells/AuditorMBSEDemo";
import { CyberDemo, SupplyChainDemo } from "./shells/CyberSupplyDemo";
import { useThemeStore } from "@g3t/react";
import { injectDesignTokens } from "@g3t/react";
import "@g3t/react";

/** Map scenario IDs to dedicated demo shells. */
const SHELL_MAP: Record<string, React.ComponentType<{ onBack: () => void }>> = {
  healthcare: HealthcareDemo,
  "data-scientist": DataScientistDemo,
  analytics: AnalyticsDemo,
  auditor: AuditorDemo,
  mbse: MBSEDemo,
  cyber: CyberDemo,
  "supply-chain": SupplyChainDemo,
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
    return (
      <DemoApp
        scenario={activeScenario}
        onBack={() => setActiveScenario(null)}
      />
    );
  }

  return <DemoLanding onSelect={setActiveScenario} />;
}
