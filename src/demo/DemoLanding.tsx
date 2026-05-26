/**
 * DemoLanding: scenario gallery with cards.
 *
 * Dark gradient background, scenario cards with accent borders,
 * hover elevation, click to enter full app view.
 */

import type { UGM } from "@core/ugm";
import {
  buildIntelGraph,
  buildSupplyChainGraph,
  buildBiomedicalGraph,
  buildCyberGraph,
} from "./fixtures/scenarios";
import { buildHealthcareUGM } from "./fixtures/healthcare";
import { buildAnalyticsUGM } from "./fixtures/analytics";
import {
  buildMBSEUGM,
  buildDataSciUGM,
  buildAuditorUGM,
} from "./fixtures/additional";

// ── Scenario Definitions ────────────────────────────────────────────

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  accentGlow: string;
  icon: string;
  buildGraph: () => UGM;
  tags: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "healthcare",
    title: "Healthcare Ontology Explorer",
    subtitle: "RDF ontology with SHACL validation",
    description:
      "Browse an ICD-10 disease ontology with drugs, genes, pathways, patients, and hospitals. Validate data quality with SHACL shapes. Navigate between tree, graph, and table views.",
    accent: "#22c55e",
    accentGlow: "rgba(34, 197, 94, 0.15)",
    icon: "✚",
    buildGraph: buildHealthcareUGM,
    tags: ["40 entities", "45 relationships", "7 types", "SHACL"],
  },
  {
    id: "analytics",
    title: "Graph Analytics Workbench",
    subtitle: "Full analytical pipeline on citation data",
    description:
      "Load an academic citation network, explore with charts (degree vs pagerank, papers by topic), run algorithms, compute derived properties, and build visual analytical pipelines.",
    accent: "#8b5cf6",
    accentGlow: "rgba(139, 92, 246, 0.15)",
    icon: "⊛",
    buildGraph: buildAnalyticsUGM,
    tags: ["55 entities", "70 relationships", "6 types", "algorithms"],
  },
  {
    id: "data-scientist",
    title: "Data Scientist Dashboard",
    subtitle: "Explore, filter, chart, derive",
    description:
      "Explore a 50-node social network with charts (degree vs pagerank), property filters, visual encoding, derived properties, and undo/redo. The full DataPipeline workflow.",
    accent: "#06b6d4",
    accentGlow: "rgba(6, 182, 212, 0.15)",
    icon: "◈",
    buildGraph: buildDataSciUGM,
    tags: ["50 entities", "80 relationships", "charts", "filters"],
  },
  {
    id: "mbse",
    title: "MBSE Satellite System",
    subtitle: "SysML packages, blocks, and requirements",
    description:
      "Navigate a satellite communication system model with package tree, block dependencies, requirement traces, and interface connections. Search and context menu navigation.",
    accent: "#f97316",
    accentGlow: "rgba(249, 115, 22, 0.15)",
    icon: "◫",
    buildGraph: buildMBSEUGM,
    tags: ["38 entities", "32 relationships", "tree+graph"],
  },
  {
    id: "auditor",
    title: "Auditor Provenance Certification",
    subtitle: "PROV-O chain with temporal validation",
    description:
      "Verify the provenance chain of a regulated ML pipeline. Timeline shows activity sequence, SHACL validates provenance metadata, diff compares with previous certification.",
    accent: "#ec4899",
    accentGlow: "rgba(236, 72, 153, 0.15)",
    icon: "◈",
    buildGraph: buildAuditorUGM,
    tags: ["30 entities", "35 relationships", "PROV-O", "SHACL"],
  },
  {
    id: "intel",
    title: "Counter-Threat Intelligence",
    subtitle: "Network analysis and link discovery",
    description:
      "Track a transnational threat network across 8 operatives, 3 organizations, 5 cities, and 4 events. Map financial flows, travel patterns, and communication links to identify the handler.",
    accent: "#22d3ee",
    accentGlow: "rgba(34, 211, 238, 0.15)",
    icon: "◈",
    buildGraph: buildIntelGraph,
    tags: ["20 entities", "21 relationships", "5 types"],
  },
  {
    id: "supply-chain",
    title: "Supply Chain Risk",
    subtitle: "Dependency mapping and risk propagation",
    description:
      "Monitor a semiconductor supply chain from rare-earth extraction through fabrication to final assembly. Identify single points of failure and geopolitical risk concentration across 5 ports.",
    accent: "#f59e0b",
    accentGlow: "rgba(245, 158, 11, 0.15)",
    icon: "⬡",
    buildGraph: buildSupplyChainGraph,
    tags: ["12 entities", "13 relationships", "4 types"],
  },
  {
    id: "biomedical",
    title: "Biomedical Knowledge Graph",
    subtitle: "Gene-disease-drug interaction network",
    description:
      "Explore oncology pathways connecting driver genes (BRCA1, TP53, EGFR, KRAS) to diseases, proteins, drugs, and signaling pathways. Identify therapeutic targets and drug repurposing candidates.",
    accent: "#a78bfa",
    accentGlow: "rgba(167, 139, 250, 0.15)",
    icon: "◉",
    buildGraph: buildBiomedicalGraph,
    tags: ["18 entities", "20 relationships", "5 types"],
  },
  {
    id: "cyber",
    title: "Cyber Threat Landscape",
    subtitle: "APT tracking and infrastructure mapping",
    description:
      "Map advanced persistent threats (APT28, APT41, Lazarus) across campaigns, malware deployments, C2 infrastructure, exploited vulnerabilities, and targeted sectors.",
    accent: "#f43f5e",
    accentGlow: "rgba(244, 63, 94, 0.15)",
    icon: "◆",
    buildGraph: buildCyberGraph,
    tags: ["18 entities", "18 relationships", "6 types"],
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
          "linear-gradient(170deg, #0a0e17 0%, #111827 50%, #0f172a 100%)",
        color: "#e2e8f0",
        fontFamily: "var(--g3t-font, 'IBM Plex Sans', sans-serif)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "64px 24px",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#64748b",
            marginBottom: 12,
          }}
        >
          g3-toolkit
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 300,
            letterSpacing: "-0.02em",
            margin: "0 0 16px 0",
            background: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Composable Graph Visualization
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "#94a3b8",
            maxWidth: 520,
            lineHeight: 1.6,
            margin: "0 auto",
          }}
        >
          12 interactive views, 4 layout engines, RDF/LPG/Holonic paradigms.
          Select a scenario to explore.
        </p>
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

      {/* Footer */}
      <div
        style={{
          marginTop: 64,
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
