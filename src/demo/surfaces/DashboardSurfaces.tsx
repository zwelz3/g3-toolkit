/**
 * Capability-surface wrappers (P1.4): the decision dashboards mounted
 * behind the playground's landing routing. The dashboards themselves
 * live in examples/decision-dashboards as importable components (they
 * are the capability-first counterpart to the domain-story shells);
 * these wrappers add only the back bar, so the dashboards stay
 * consumable as plain components by adopters while becoming reachable
 * from `pnpm run dev` and the deployed Pages playground.
 */
import { AnalyticsDashboard } from "../../../examples/decision-dashboards/src";

export function SurfaceFrame({
  title,
  subtitle,
  accent,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        minHeight: 0,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 14px",
          borderBottom: `1px solid ${accent}`,
          flex: "0 0 auto",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            font: "inherit",
            fontSize: 12,
            padding: "3px 10px",
            border: `1px solid ${accent}`,
            borderRadius: 4,
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          {"\u2190"} Scenarios
        </button>
        <div>
          <b style={{ fontSize: 14 }}>{title}</b>{" "}
          <span style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</span>
        </div>
      </header>
      {/* 12.3 root cause: this wrapper was flexed but NOT a flex
          container, so a child's flex:1 was inert and its height fell
          back to content (the workbench's 60% fill, dock growth, and
          SPARQL overflow-scroll were all this). display:flex makes
          both child idioms work: flex:1 (workbench) and height:100%
          (scale). overflow stays as the last-resort containment. */}
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function AnalyticsSurface({ onBack }: { onBack: () => void }) {
  return (
    <SurfaceFrame
      title="Analytics Dashboard"
      subtitle="charts, stats, algorithms, derived properties, coverage"
      accent="#e3b341"
      onBack={onBack}
    >
      <AnalyticsDashboard />
    </SurfaceFrame>
  );
}
