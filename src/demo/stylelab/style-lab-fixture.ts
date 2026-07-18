/**
 * Style Lab fixture: ONE styling intent expressed through BOTH paths,
 * so the panes and the parity oracle compare like against like.
 *
 * The intent (deliberately exercising every engine layer):
 * - theme: light-token base fill/stroke/label colors
 * - rules: riskLevel presence-gated coloring (three nodes LACK the
 *   field ON PURPOSE: the STY-003 gating proof), category=hub border
 *   emphasis, critical edges dashed+bold
 * - classes: "muted" opacity bundle (applied to two elements)
 * - states: ":selected" border overlay (one node, selected in both
 *   panes)
 * - engine-only zone: halo on high-risk hubs, glyph on flagged nodes,
 *   tapered critical edges: attributes Cytoscape cannot express,
 *   surfaced honestly by the projection report, rendered only when
 *   the F1 SVG adapter lands
 *
 * SHARED_VALUES is the single source both expressions read; the
 * legacy stylesheet and the engine config below are two projections
 * of it, and the parity test compares cytoscape-COMPUTED styles of
 * the two paths key by key.
 */
import {
  LIGHT_TOKENS,
  themeFromTokens,
  UGM,
  type StyleEngineConfig,
  type StyleElement,
} from "@g3t/core";

export const SHARED_VALUES = {
  baseNodeFill: LIGHT_TOKENS.color.surface,
  baseNodeStroke: LIGHT_TOKENS.color.border,
  baseNodeStrokeWidth: 1,
  baseEdgeStroke: LIGHT_TOKENS.color.textSecondary,
  baseEdgeWidth: 1.5,
  riskHigh: LIGHT_TOKENS.color.danger,
  riskLow: "#2f9e44",
  hubBorder: LIGHT_TOKENS.color.accent,
  hubBorderWidth: 3,
  mutedOpacity: 0.35,
  selectedBorder: LIGHT_TOKENS.color.warning,
  selectedBorderWidth: 4,
  criticalWidth: 3,
  criticalDash: [6, 3] as const,
  // Label channels, pinned after MR-7's browser finding (engine-pane
  // labels judged missing/muted): both paths now express the SAME
  // label styling from these values, and the label channels joined
  // PARITY_KEYS so the oracle can never go blind on them again.
  nodeLabelColor: LIGHT_TOKENS.color.textPrimary,
  nodeLabelSize: 12,
  nodeLabelHalo: LIGHT_TOKENS.color.canvas,
  nodeLabelHaloWidth: 2,
  edgeLabelColor: LIGHT_TOKENS.color.textPrimary,
  edgeLabelSize: 10,
  // Third-review finding ("all edge labels weirdly muted"): edge
  // labels sat directly on their lines with no halo, reading washed
  // out next to the halo'd node labels. Both paths now halo edge
  // labels too, and the size steps up one point.
  edgeLabelHalo: LIGHT_TOKENS.color.canvas,
  edgeLabelHaloWidth: 2,
} as const;

/** Elements the lab selects/mutes in BOTH panes (via onReady). */
export const MUTED_IDS = ["n5", "e3"] as const;
export const SELECTED_ID = "n7";

export interface StyleLabNodeSpec {
  id: string;
  name: string;
  riskLevel?: "high" | "low";
  category?: "hub" | "leaf";
  flagged?: boolean;
}

export const LAB_NODES: readonly StyleLabNodeSpec[] = [
  {
    id: "n1",
    name: "Alpha",
    riskLevel: "high",
    category: "hub",
    flagged: true,
  },
  { id: "n2", name: "Bravo", riskLevel: "low", category: "leaf" },
  { id: "n3", name: "Charlie", riskLevel: "high", category: "leaf" },
  { id: "n4", name: "Delta", riskLevel: "low", category: "hub" },
  // riskLevel ABSENT on purpose: STY-003 gating proof (base fill).
  { id: "n5", name: "Echo", category: "leaf" },
  { id: "n6", name: "Foxtrot" },
  { id: "n7", name: "Golf", riskLevel: "low" },
  { id: "n8", name: "Hotel", flagged: true },
];

export interface StyleLabEdgeSpec {
  id: string;
  source: string;
  target: string;
  kind?: "critical" | "normal";
}

export const LAB_EDGES: readonly StyleLabEdgeSpec[] = [
  { id: "e1", source: "n1", target: "n2", kind: "critical" },
  { id: "e2", source: "n1", target: "n3" },
  { id: "e3", source: "n4", target: "n5", kind: "normal" },
  { id: "e4", source: "n4", target: "n6", kind: "critical" },
  { id: "e5", source: "n7", target: "n8" },
  { id: "e6", source: "n3", target: "n7" },
];

/** The fixture as a UGM (both panes render this). */
export function buildStyleLabUgm(): UGM {
  const ugm = new UGM();
  for (const n of LAB_NODES) {
    ugm.addNode(n.id, {
      types: ["LabNode"],
      properties: {
        name: n.name,
        ...(n.riskLevel !== undefined ? { riskLevel: n.riskLevel } : {}),
        ...(n.category !== undefined ? { category: n.category } : {}),
        ...(n.flagged !== undefined ? { flagged: n.flagged } : {}),
      },
    });
  }
  for (const e of LAB_EDGES) {
    ugm.addEdge(e.source, e.target, {
      type: "linksTo",
      properties: { ...(e.kind !== undefined ? { kind: e.kind } : {}) },
    });
  }
  return ugm;
}

/** The engine pane's input, built FROM the live cytoscape instance so
 *  element ids always match whatever the UGM conversion minted (edge
 *  ids are converter-generated). The natural adapter direction: the
 *  engine styles whatever the canvas actually holds. */
export function styleElementsFromCy(cy: {
  elements: () => {
    forEach: (
      fn: (ele: {
        id: () => string;
        isNode: () => boolean;
        data: (k: string) => unknown;
      }) => void,
    ) => void;
  };
}): StyleElement[] {
  const fields = ["name", "riskLevel", "category", "flagged", "kind"] as const;
  const elements: StyleElement[] = [];
  cy.elements().forEach((ele) => {
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const v = ele.data(f);
      if (v !== undefined) data[f] = v;
    }
    elements.push({
      id: ele.id(),
      kind: ele.isNode() ? "node" : "edge",
      data,
    });
  });
  return elements;
}

/**
 * PATH A: the legacy Cytoscape stylesheet, [field]-scoped per the
 * standing doctrine (a mapped selector never fires on an element
 * without the field).
 */
export function styleLabLegacyStylesheet(): {
  selector: string;
  style: Record<string, string | number>;
}[] {
  const v = SHARED_VALUES;
  return [
    {
      selector: "node",
      style: {
        "background-color": v.baseNodeFill,
        "border-color": v.baseNodeStroke,
        "border-width": v.baseNodeStrokeWidth,
      },
    },
    {
      selector: "edge",
      style: {
        "line-color": v.baseEdgeStroke,
        width: v.baseEdgeWidth,
        "target-arrow-color": v.baseEdgeStroke,
        "source-arrow-color": v.baseEdgeStroke,
      },
    },
    {
      selector: "node",
      style: {
        color: v.nodeLabelColor,
        "font-size": v.nodeLabelSize,
        "text-outline-color": v.nodeLabelHalo,
        "text-outline-width": v.nodeLabelHaloWidth,
      },
    },
    {
      selector: "edge",
      style: {
        color: v.edgeLabelColor,
        "font-size": v.edgeLabelSize,
        "text-outline-color": v.edgeLabelHalo,
        "text-outline-width": v.edgeLabelHaloWidth,
      },
    },
    {
      selector: 'node[riskLevel = "high"]',
      style: { "background-color": v.riskHigh },
    },
    {
      selector: 'node[riskLevel = "low"]',
      style: { "background-color": v.riskLow },
    },
    {
      selector: 'node[category = "hub"]',
      style: { "border-color": v.hubBorder, "border-width": v.hubBorderWidth },
    },
    {
      selector: ".lab-muted",
      style: { opacity: v.mutedOpacity },
    },
    {
      selector: "node:selected",
      style: {
        "border-color": v.selectedBorder,
        "border-width": v.selectedBorderWidth,
      },
    },
    {
      selector: 'edge[kind = "critical"]',
      style: {
        width: v.criticalWidth,
        "line-style": "dashed",
        "line-dash-pattern": v.criticalDash.join(" "),
      },
    },
  ];
}

/**
 * PATH B: the engine configuration expressing the SAME intent, plus
 * the engine-only zone (halo/glyph/taper) Cytoscape cannot render.
 */
export function styleLabEngineConfig(): StyleEngineConfig {
  const v = SHARED_VALUES;
  return {
    theme: themeFromTokens(LIGHT_TOKENS),
    rules: [
      // The theme layer already carries base fill/stroke; these two
      // pin the fixture's EXACT base values so the parity oracle is
      // insensitive to future token edits.
      {
        id: "base-node",
        selector: { kind: "node" },
        attributes: {
          fill: v.baseNodeFill,
          stroke: v.baseNodeStroke,
          strokeWidth: v.baseNodeStrokeWidth,
          // Matches the canvas default so the panes agree on
          // silhouette and shape can join the parity keys.
          shape: "ellipse",
          labelColor: v.nodeLabelColor,
          labelSize: v.nodeLabelSize,
          labelHalo: { color: v.nodeLabelHalo, width: v.nodeLabelHaloWidth },
        },
      },
      {
        id: "base-edge",
        selector: { kind: "edge" },
        attributes: {
          stroke: v.baseEdgeStroke,
          strokeWidth: v.baseEdgeWidth,
          labelColor: v.edgeLabelColor,
          labelSize: v.edgeLabelSize,
          labelHalo: { color: v.edgeLabelHalo, width: v.edgeLabelHaloWidth },
        },
      },
      {
        id: "risk-high",
        selector: { kind: "node", dataEquals: { riskLevel: "high" } },
        attributes: { fill: v.riskHigh },
        outputs: ["fill"],
      },
      {
        id: "risk-low",
        selector: { kind: "node", dataEquals: { riskLevel: "low" } },
        attributes: { fill: v.riskLow },
        outputs: ["fill"],
      },
      {
        id: "hub-border",
        selector: { kind: "node", dataEquals: { category: "hub" } },
        attributes: { stroke: v.hubBorder, strokeWidth: v.hubBorderWidth },
        outputs: ["stroke", "strokeWidth"],
      },
      {
        id: "critical-edge",
        selector: { kind: "edge", dataEquals: { kind: "critical" } },
        attributes: {
          strokeWidth: v.criticalWidth,
          strokeDash: v.criticalDash,
        },
        outputs: ["strokeWidth", "strokeDash"],
      },
      // ── Engine-only zone (unsupported by the Cytoscape bypass;
      //    surfaced via the projection report, rendered by F1) ──
      {
        id: "hub-risk-halo",
        selector: {
          kind: "node",
          dataEquals: { riskLevel: "high", category: "hub" },
        },
        attributes: {
          halo: { color: v.riskHigh, width: LIGHT_TOKENS.spacing.padding },
        },
        outputs: ["halo"],
      },
      {
        id: "flagged-glyph",
        selector: { kind: "node", dataEquals: { flagged: true } },
        attributes: {
          glyphs: [{ slot: "top-right", text: "!", fill: v.selectedBorder }],
        },
        outputs: ["glyphs"],
      },
      {
        id: "critical-taper",
        selector: { kind: "edge", dataEquals: { kind: "critical" } },
        attributes: { taper: true },
        outputs: ["taper"],
      },
      {
        // Coverage donut on hubs: a two-segment status ring (F1
        // renders it; the bypass projection reports it unsupported).
        id: "hub-coverage-donut",
        selector: { kind: "node", dataEquals: { category: "hub" } },
        attributes: {
          donut: [
            { fraction: 0.7, color: v.selectedBorder },
            { fraction: 0.3, color: v.riskHigh },
          ],
        },
        outputs: ["donut"],
      },
      {
        // High-risk hubs PULSE their halo (attention decoration).
        id: "hub-risk-pulse",
        selector: {
          kind: "node",
          dataEquals: { riskLevel: "high", category: "hub" },
        },
        attributes: { pulse: true },
        outputs: ["pulse"],
      },
      {
        // Critical edges carry a source-to-target gradient with the
        // taper (direction reads from both channels).
        id: "critical-gradient",
        selector: { kind: "edge", dataEquals: { kind: "critical" } },
        attributes: { gradient: { from: v.selectedBorder, to: v.riskHigh } },
        outputs: ["gradient"],
      },
    ],
    classDefs: {
      "lab-muted": { opacity: v.mutedOpacity },
    },
    stateDefs: {
      selected: {
        stroke: v.selectedBorder,
        strokeWidth: v.selectedBorderWidth,
      },
    },
  };
}

/** The fixture as raw Cytoscape element JSON (headless mounts in the
 *  parity oracle and the shell test; the shell itself goes through
 *  the UGM path). */
export function styleLabRawCyElements(): {
  group: "nodes" | "edges";
  data: Record<string, unknown>;
}[] {
  const els: { group: "nodes" | "edges"; data: Record<string, unknown> }[] = [];
  for (const n of LAB_NODES) {
    els.push({
      group: "nodes",
      data: {
        id: n.id,
        name: n.name,
        ...(n.riskLevel !== undefined ? { riskLevel: n.riskLevel } : {}),
        ...(n.category !== undefined ? { category: n.category } : {}),
        ...(n.flagged !== undefined ? { flagged: n.flagged } : {}),
      },
    });
  }
  for (const e of LAB_EDGES) {
    els.push({
      group: "edges",
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        ...(e.kind !== undefined ? { kind: e.kind } : {}),
      },
    });
  }
  return els;
}

/** The cy style keys the parity oracle compares, per element kind. */
export const PARITY_KEYS = {
  node: [
    "background-color",
    "border-color",
    "border-width",
    "opacity",
    "shape",
    // Label channels (added after MR-7: a visible difference under a
    // 0-mismatch table indicts the keys, so the keys widened).
    "label",
    "color",
    "font-size",
    "text-opacity",
    "text-outline-color",
    "text-outline-width",
  ],
  edge: [
    "line-color",
    "width",
    "line-style",
    "opacity",
    "label",
    "color",
    "font-size",
    "text-opacity",
    "text-outline-color",
    "text-outline-width",
  ],
} as const;
