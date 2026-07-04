/**
 * DemoLanding: scenario gallery with cards.
 *
 * Dark gradient background, scenario cards with accent borders,
 * hover elevation, click to enter full app view.
 */

// ── Scenario Definitions ────────────────────────────────────────────

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  accentGlow: string;
  icon: string;
  tags: string[];
}

/**
 * Capability surfaces: where the scenarios above are domain stories,
 * these foreground the toolkit surface the stories do not (analytics
 * panels, schema/matrix/sankey views). They live in
 * examples/decision-dashboards as plain importable components; the
 * landing routes to thin wrappers around them.
 */
export const CAPABILITY_SURFACES: Scenario[] = [
  {
    id: "analytics-dashboard",
    title: "Analytics Dashboard",
    subtitle: "Charts, stats, algorithms, derived properties, coverage",
    description:
      "The supply network under the analytic surface: linked charts and stats, algorithm runs ingested as node properties, a derived-property panel, subgraph export, and origin-declaration coverage rendered with CoverageMeter.",
    accent: "#e3b341",
    accentGlow: "rgba(227, 179, 65, 0.15)",
    icon: "\u2237",
    tags: ["StatsPanel + charts", "AlgorithmPanel", "CoverageMeter"],
  },
  {
    id: "schema-dashboard",
    title: "Schema Dashboard",
    subtitle: "Structure views over the same graphs",
    description:
      "Schema extraction, adjacency matrix, and sankey flow over the satellite and supply fixtures, with the RDF paradigm notes alongside: the structural counterpart to the analytics surface.",
    accent: "#5cb8e4",
    accentGlow: "rgba(92, 184, 228, 0.15)",
    icon: "\u229e",
    tags: ["SchemaView", "MatrixView", "SankeyView"],
  },
];

export const SCENARIOS: Scenario[] = [
  {
    id: "auditor",
    title: "Provenance Auditor",
    subtitle: "PROV-O audit trail with SHACL",
    description:
      "Audit a PROV-O trail of artifacts, activities, and agents. SHACL flags provenance defects as violations and warnings and projects them onto the graph; a timeline lists every generation, start, and end; and a dual-range slider filters both the timeline and the graph to a time window.",
    accent: "#2dd4bf",
    accentGlow: "rgba(45, 212, 191, 0.15)",
    icon: "◈",
    tags: ["PROV-O", "SHACL", "timeline slider"],
  },
  {
    id: "mbse",
    title: "MBSE Satellite Workbench",
    subtitle: "Cameo-style containment tree driving four diagram types",
    description:
      "Browse a satellite model the way a systems engineer does: a containment tree of packages, blocks, constraint blocks, and requirements, where opening a diagram projects it into the structural renderer. BDD with typed compartments and composition, IBD with parts, ports, and connectors, parametrics with binding connectors, and a requirement breakdown with satisfy traces.",
    accent: "#f97316",
    accentGlow: "rgba(249, 115, 22, 0.15)",
    icon: "◫",
    tags: [
      "BDD / IBD / parametric / req",
      "containment tree",
      "structural renderer",
    ],
  },
  {
    id: "supply-chain",
    title: "Supply Chain Digital Thread",
    subtitle: "Multi-source consolidation with gap analysis",
    description:
      "Consolidate ERP, supplier, certification, sourcing, and logistics records into one provenance-tagged graph. SHACL flags parts with no certified supplier; analytics surface sole-source parts and single points of failure; color by region, tier, or component and trace a supplier's path to final assembly.",
    accent: "#f4923b",
    accentGlow: "rgba(244, 146, 59, 0.15)",
    icon: "⬡",
    tags: ["multi-source", "SHACL gaps", "clustering"],
  },
  {
    id: "biomedical",
    title: "Biomedical Knowledge Graph",
    subtitle: "RDF ontology with in-browser SPARQL",
    description:
      "Query an RDF gene / protein / disease / drug / pathway graph with a curated in-browser SPARQL executor. Browse the class ontology and its object and data properties, run the default queries or edit your own, and see numeric results in a linked bar or scatter panel whose bars select the matching node.",
    accent: "#b17ef0",
    accentGlow: "rgba(177, 126, 240, 0.15)",
    icon: "◉",
    tags: ["RDF", "SPARQL", "ontology explorer"],
  },
];

// ── Landing Page Component ──────────────────────────────────────────

export function DemoLanding({
  onSelect,
}: {
  onSelect: (scenario: Scenario) => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(99,102,241,0.12), transparent 60%), linear-gradient(170deg, #0a0e17 0%, #111827 55%, #0f172a 100%)",
        color: "#e2e8f0",
        fontFamily: "var(--g3t-font, 'IBM Plex Sans', sans-serif)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "72px 24px 48px",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 36, maxWidth: 640 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#818cf8",
            marginBottom: 18,
            padding: "4px 12px",
            border: "1px solid rgba(129,140,248,0.3)",
            borderRadius: 9999,
            background: "rgba(129,140,248,0.08)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#818cf8",
              display: "inline-block",
            }}
          />
          g3-toolkit
        </div>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 300,
            letterSpacing: "-0.025em",
            margin: "0 0 18px 0",
            lineHeight: 1.1,
            background:
              "linear-gradient(135deg, #f1f5f9 0%, #818cf8 55%, #38bdf8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Composable graph visualization
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#94a3b8",
            maxWidth: 560,
            lineHeight: 1.65,
            margin: "0 auto",
          }}
        >
          A toolkit of composable views, a declarative visual-encoding grammar,
          and selection-linked panels for RDF, property-graph, and holonic data.
          Pick a scenario to see the pieces working together.
        </p>

        {/* Capability strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 0,
            marginTop: 28,
          }}
        >
          {[
            ["10+", "linked views"],
            ["5", "layout engines"],
            ["SHACL", "validation"],
            ["RDF · LPG", "+ holonic"],
          ].map(([big, small], i) => (
            <div
              key={big}
              style={{
                padding: "0 20px",
                borderLeft:
                  i === 0 ? "none" : "1px solid rgba(100,116,139,0.25)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>
                {big}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#64748b",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                {small}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scenario cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
          maxWidth: 760,
          width: "100%",
        }}
      >
        {SCENARIOS.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            onClick={() => onSelect(scenario)}
          />
        ))}
      </div>
      <h2
        style={{
          margin: "28px 0 4px",
          fontSize: 15,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          opacity: 0.75,
        }}
      >
        Capability surfaces
      </h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.65 }}>
        The scenarios above are domain stories; these foreground the toolkit
        surface directly.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
          maxWidth: 760,
          width: "100%",
        }}
      >
        {CAPABILITY_SURFACES.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            onClick={() => onSelect(scenario)}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 56,
          fontSize: 12,
          color: "#475569",
          textAlign: "center",
        }}
      >
        <span style={{ fontFamily: "var(--g3t-font-mono, monospace)" }}>
          npm run storybook
        </span>{" "}
        for individual component exploration
      </div>
    </div>
  );
}

// ── Scenario Card ───────────────────────────────────────────────────

function ScenarioCard({
  scenario,
  onClick,
}: {
  scenario: Scenario;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "rgba(15, 23, 42, 0.6)",
        border: "1px solid rgba(100, 116, 139, 0.2)",
        borderLeft: `3px solid ${scenario.accent}`,
        borderRadius: 8,
        padding: "20px 24px",
        cursor: "pointer",
        transition: "all 200ms ease",
        color: "inherit",
        fontFamily: "inherit",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = scenario.accentGlow;
        el.style.borderColor = `${scenario.accent}40`;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = `0 8px 32px ${scenario.accent}15`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "rgba(15, 23, 42, 0.6)";
        el.style.borderColor = "rgba(100, 116, 139, 0.2)";
        el.style.transform = "none";
        el.style.boxShadow = "none";
      }}
    >
      {/* Icon */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 20,
          fontSize: 28,
          color: scenario.accent,
          opacity: 0.4,
        }}
      >
        {scenario.icon}
      </div>

      {/* Content */}
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
        {scenario.title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: scenario.accent,
          fontWeight: 500,
          letterSpacing: "0.02em",
          marginBottom: 10,
        }}
      >
        {scenario.subtitle}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#94a3b8",
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        {scenario.description}
      </div>

      {/* Tags */}
      <div style={{ display: "flex", gap: 8 }}>
        {scenario.tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 9999,
              background: "rgba(100, 116, 139, 0.15)",
              color: "#94a3b8",
              letterSpacing: "0.02em",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}
