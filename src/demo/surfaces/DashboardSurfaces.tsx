/**
 * Capability-surface wrappers (P1.4): the decision dashboards mounted
 * behind the playground's landing routing. The dashboards themselves
 * live in examples/decision-dashboards as importable components (they
 * are the capability-first counterpart to the domain-story shells);
 * these wrappers add only the back bar, so the dashboards stay
 * consumable as plain components by adopters while becoming reachable
 * from `pnpm run dev` and the deployed Pages playground.
 */
import {
  AnalyticsDashboard,
  SchemaDashboard,
} from "../../../examples/decision-dashboards/src";

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
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
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

export function SchemaSurface({ onBack }: { onBack: () => void }) {
  return (
    <SurfaceFrame
      title="Schema Dashboard"
      subtitle="schema, matrix, sankey, and the RDF paradigm"
      accent="#5cb8e4"
      onBack={onBack}
    >
      <SchemaDashboard />
    </SurfaceFrame>
  );
}
