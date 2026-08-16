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
/** Visibility gating (LR-7/LR-8, owner review 2026-07-22):
 *  - Scale is HIDDEN in dev: React's dev-build prop serialization
 *    makes the surface misleadingly slow there (see the verdict in
 *    ScaleSurface.tsx); it ships in prod/preview where it is clean.
 *  - Style Lab is DEV-ONLY: it is an engineering comparison
 *    harness, not a product example.
 *  Vitest sets DEV=true, so unit tests see the dev set (Style Lab
 *  visible, Scale hidden); the production e2e smoke walks the prod
 *  set (Scale visible, Style Lab absent). */
function surfaceVisibleHere(id: string): boolean {
  // The e2e flag exposes everything in any build: the MR-7 Style
  // Lab acceptance oracles run against the production bundle and
  // keep their surface, and the owner can opt in for debugging via
  // ?e2e=1. Default prod visitors see the gated set.
  if (
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).has("e2e")
  ) {
    return true;
  }
  if (id === "scale") return !import.meta.env.DEV;
  if (id === "style-lab") return import.meta.env.DEV;
  return true;
}

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
    id: "scale",
    title: "Scale",
    subtitle: "8,000 nodes, clustered live to supernodes",
    description:
      "A generated 8,000-node graph collapsed in-browser by Louvain community detection: the renderer sees ~40 supernodes sized by member count while the full graph stays in the UGM. Drill into any cluster for its working-set-capped member subgraph. The header shows the real measured clustering time.",
    accent: "#7ee081",
    accentGlow: "rgba(126, 224, 129, 0.15)",
    icon: "\u2b22",
    tags: ["collapseByCluster", "Louvain", "drill-in"],
  },
  {
    id: "style-lab",
    title: "Style Lab",
    subtitle: "Engine vs stylesheet, parity computed live",
    description:
      "Engineering conformance surface for the style-resolution engine: one fixture intent rendered through the legacy Cytoscape stylesheet and through the engine's bypass projection side by side, with parity computed from cytoscape's own resolved styles, the engine-only attribute report (halo, glyphs, taper awaiting the SVG adapter), and a LOD schedule probe.",
    accent: "#74c0fc",
    accentGlow: "rgba(116, 192, 252, 0.15)",
    icon: "\u29c9",
    tags: ["StyleEngine", "parity oracle", "LOD schedule"],
  },
  {
    id: "ontology-workbench",
    title: "Ontology Workbench",
    subtitle: "Protege-style browsing, SHACL, SPARQL, and a demo reasoner",
    description:
      "Full ontology browsing (classes, properties, individuals, axioms, annotations) over a seeded spacecraft ontology, with an Asserted|Inferred toggle backed by a demo RDFS-plus reasoner. Class hierarchy and k-hop neighborhood canvases, class-scoped instance graphs with a table view, the core SHACL structural pipeline (ELK, cardinality rows, per-row validation severity), scoped SPARQL with presets, and Turtle/JSON-LD import.",
    accent: "#7048e8",
    accentGlow: "rgba(112, 72, 232, 0.15)",
    icon: "\u2726",
    tags: ["RDFS-plus", "SHACL", "SPARQL", "import"],
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
    tags: ["containment tree", "structural renderer"],
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
          and selection-linked panels for RDF and property-graph data. Pick a
          scenario to see the pieces working together.
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
            ["3", "renderers"],
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
      {/* LR-1: 'Capability surfaces' header removed (owner review
          2026-07-22); the cards keep their own grid. VR-29 (owner
          re-verify 2026-07-28): the removed header WAS the visual
          separation between the grids: a divider rule + breathing
          room restores it without reintroducing text. */}
      {/* VR-29 v2 (owner 2026-07-28): breathing room only, no
          divider line. */}
      <div aria-hidden style={{ height: 40 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 20,
          maxWidth: 760,
          width: "100%",
        }}
      >
        {CAPABILITY_SURFACES.filter((sc) => surfaceVisibleHere(sc.id)).map(
          (scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onClick={() => onSelect(scenario)}
            />
          ),
        )}
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
        {/* LR-5: scope disclaimer (owner review 2026-07-22). */}
        <p style={{ margin: "0 0 14px", maxWidth: 620 }}>
          These examples are not fully engineered applications: they demonstrate
          the basics of wiring toolkit components together.
        </p>
        <span style={{ fontFamily: "var(--g3t-font-mono, monospace)" }}>
          npm run storybook
        </span>{" "}
        for individual component exploration
        {/* LR-3: repo link. URL is a PLACEHOLDER pending the owner's
            real repo location (flagged in the owner queue). */}
        <div style={{ marginTop: 14 }}>
          <a
            href="https://github.com/zwelz3/g3-toolkit"
            target="_blank"
            rel="noreferrer"
            data-testid="landing-repo-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#94a3b8",
              textDecoration: "none",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            Source on GitHub
          </a>
        </div>
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
