/**
 * Structural rendering geometry: ELK-laid-out containers with typed
 * compartment rows and boundary ports (Group A, round 31).
 *
 * Doctrine: this module produces a versioned GEOMETRY DOCUMENT, not a
 * rendered view. The canvas (or any renderer) consumes the document
 * and draws containers, rows, and ports as ordinary elements: rows
 * are REAL nodes in the result, so selection, overlays, badges, and
 * cross-highlighting all apply to them with zero extra machinery.
 * UML custom views and the SHACL shape view's compartment slice are
 * both clients of this one API.
 *
 * The validated ELK recipe (spiked against elkjs 0.11.1; see
 * roadmap/design/structural-rendering.md for the spike record):
 *
 *   1. The builder pre-measures all text (injected TextMeasure; ELK
 *      cannot measure) and assigns EXPLICIT equal widths to all rows
 *      of a container (max measured row width + padding).
 *   2. Invisible chain edges row[i] -> row[i+1] force declared order
 *      and vertical layering inside each container.
 *   3. Each container runs elk.layered DOWN with zero spacings and a
 *      top padding reserving the header strip.
 *   4. The ROOT keeps the default SEPARATE_CHILDREN hierarchy
 *      handling. INCLUDE_CHILDREN must NOT be set on the root: it
 *      collapses everything into one global pass that ignores the
 *      containers' own layout options (rows go horizontal).
 *   5. Ports use FIXED_SIDE constraints with elk.port.side.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/01-functional-views.md R1.18 (capped in-progress:
 *      geometry only; canvas application is the next slice)
 */

import ELK, {
  type ElkNode,
  type ElkExtendedEdge,
  type ElkPort,
  type LayoutOptions as ElkLayoutOptions,
} from "elkjs/lib/elk.bundled.js";

/** Sides a boundary port can be fixed to (ELK vocabulary). */
export type PortSide = "NORTH" | "SOUTH" | "EAST" | "WEST";

/** One row inside a compartment (e.g., a UML attribute or a SHACL property shape summary). */
export interface StructuralRow {
  /** Stable id; becomes a node id in the geometry document. */
  id: string;
  /** Row text as it should render (already abbreviated by the caller). */
  text: string;
}

/** A typed group of rows inside a container (UML compartment). */
export interface StructuralCompartment {
  /** Stable id; row geometry records which compartment a row belongs to. */
  id: string;
  /** Optional compartment title rendered as its own divider row. */
  title?: string;
  rows: StructuralRow[];
}

/** A boundary port on a container or plain node. */
export interface StructuralPort {
  id: string;
  /**
   * Side to fix the port to. Optional: when omitted it defaults to the
   * flow axis (e.g. EAST/WEST for a RIGHT/LEFT layout), so data-flow ports
   * sit on the left/right of a container by default. A port used as an
   * edge's sourcePort defaults to the flow-forward side, as a targetPort to
   * the flow-backward side.
   */
  side?: PortSide;
  /** Square size in px (default 12; sized to carry a direction
   *  glyph when ports learn flow direction). */
  size?: number;
}

/** A node in the structural view: a compartmented container or a plain box. */
export interface StructuralNode {
  id: string;
  /** Header line, e.g. { stereotype: "Block", name: "Sensor" }. */
  header?: { stereotype?: string; name: string };
  compartments?: StructuralCompartment[];
  ports?: StructuralPort[];
  /** Plain nodes (no compartments) may fix their own size. */
  width?: number;
  height?: number;
}

/** An edge between structural nodes, optionally attaching to ports. */
export interface StructuralEdge {
  id: string;
  source: string;
  target: string;
  /** When set, the edge attaches to this port id instead of the node body. */
  sourcePort?: string;
  targetPort?: string;
  /** Optional edge label (e.g. a SHACL sh:node property path, or a
   *  UML association role). Rendered as a mid-edge label. */
  label?: string;
  /**
   * Optional UML relationship kind, driving the edge's arrow symbols
   * (A3). Absent or "association" renders a plain arrow:
   * - "composition": filled diamond at the SOURCE (whole) end.
   * - "aggregation": hollow diamond at the source.
   * - "generalization": hollow triangle at the TARGET (parent) end.
   * - "dependency": open arrow, dashed line, at the target.
   * - "association": plain arrow at the target (the default).
   * The converter maps these to Cytoscape arrow shapes; structural
   * scenes are not bound to the encoding grammar's node-shape channel
   * (arrow shapes are an edge concern), so this is a direct mapping.
   */
  kind?:
    | "association"
    | "composition"
    | "aggregation"
    | "generalization"
    | "dependency";
}

export interface StructuralGraphInput {
  nodes: StructuralNode[];
  edges: StructuralEdge[];
}

/**
 * Text measurement injected by the caller. Core ships a deterministic
 * estimator (works headless and in jsdom); a renderer can substitute
 * real canvas measurement for pixel-true sizing.
 */
export type TextMeasure = (
  text: string,
  role: "header" | "row" | "compartmentTitle",
) => { width: number; height: number };

/** Deterministic estimator: monospace-ish average char widths per role. */
/** Deterministic estimator: per-role average char widths. The
 *  header is bold and may carry guillemets («Stereotype»), so it
 *  estimates wider than rows; a small margin keeps labels from
 *  clipping when this estimate undershoots a proportional font (the
 *  canvas can substitute real measurement for pixel-true sizing). */
export const estimateTextSize: TextMeasure = (text, role) => {
  const perChar = role === "header" ? 9 : 7;
  const height = role === "header" ? 16 : 13;
  const margin = role === "header" ? 12 : 4;
  return { width: Math.ceil(text.length * perChar) + margin, height };
};

import type { G3tLayoutOptions as G3tEngineTuning } from "./g3t-engine/g3t-layered";

export interface StructuralLayoutOptions extends G3tEngineTuning {
  /**
   * Layout engine seam (WS-D). "elk" (default) runs the elkjs
   * pipeline. "g3t" runs the in-house layered engine, D1 stage:
   * FLAT inputs only; inputs with compartments fall back to elk
   * until the D2 containment pre-pass lands. The seam exists so the
   * QLT-002 harness and the PRF bench can run both engines over
   * identical inputs; the default does not change before D3.
   * (Named engineKind: `engine` already injects an ElkEngine
   * instance.)
   */
  engineKind?: "elk" | "g3t";
  /** Direction of the top-level layered layout. Default "RIGHT". */
  direction?: "RIGHT" | "DOWN" | "LEFT" | "UP";
  /** Horizontal padding inside rows and around headers (default 8). */
  hPadding?: number;
  /** Row height padding above/below measured text (default 5 each side). */
  vPadding?: number;
  /** Spacing between top-level elements (default 60). */
  spacing?: number;
  /**
   * Spacing between adjacent layers (the cross-flow gap that carries most
   * inter-block edges). Default spacing + 20. Widen for denser edge sets.
   */
  layerSpacing?: number;
  /**
   * ELK edge routing style for the top-level graph. "ORTHOGONAL" (default)
   * routes in horizontal/vertical segments; "POLYLINE" allows diagonals;
   * "SPLINES" curves. ELK computes the actual routes regardless; whether
   * the geometry carries them is controlled by `routeEdges`.
   */
  edgeRouting?: "ORTHOGONAL" | "POLYLINE" | "SPLINES";
  /**
   * Emit ELK's computed edge routes (node-avoiding polylines) into the
   * geometry as `edges`. Default true. A renderer that follows them does
   * not draw an edge behind a block. Set false to omit the routes and let
   * the renderer fall back to endpoint-only routing (e.g. Cytoscape taxi).
   */
  routeEdges?: boolean;
  /**
   * ELK node-placement strategy. "BRANDES_KOEPF" (default) favors
   * straight through-edges; "NETWORK_SIMPLEX" is more compact;
   * "LINEAR_SEGMENTS"/"SIMPLE" are cheaper.
   */
  nodePlacement?:
    | "BRANDES_KOEPF"
    | "NETWORK_SIMPLEX"
    | "LINEAR_SEGMENTS"
    | "SIMPLE";
  /** Crossing-minimization strategy. Default "LAYER_SWEEP". Superseded
   *  by INTERACTIVE for a run that carries a `sketch`. */
  crossingMinimization?: "LAYER_SWEEP" | "INTERACTIVE";
  /**
   * Prior TOP-LEVEL positions: a layout sketch (G3L:LAY-017; the
   * ruled 12.20 experiment graduated). When present and non-empty,
   * the run switches ELK layered's cycle-breaking, layering, and
   * crossing-minimization strategies to INTERACTIVE and seeds each
   * hinted top-level node with its prior absolute top-left, so a
   * local change (e.g. one compartment collapse) re-lays out WITHOUT
   * materially moving untouched containers (accept criterion
   * G3L:LAY-018: less than one grid unit). Ids without a hint lay
   * out normally; hints for absent ids are ignored. Positions are
   * hints, not pins: ELK still resolves overlaps and spacing.
   *
   * `width`/`height` are the node's PRIOR extents. When a hinted node
   * shrinks along the flow axis (e.g. its compartment collapsed), the
   * layout reserves the difference as a trailing margin so its layer
   * keeps its prior extent and downstream layers do not slide toward
   * it: the collapsed box shrinks IN PLACE and the freed space reads
   * as whitespace (the ruled A2 tradeoff, accepted for sketch mode).
   */
  sketch?: Readonly<
    Record<string, { x: number; y: number; width?: number; height?: number }>
  >;
  /**
   * Preferred minimum gap between an edge segment and a node side
   * (yFiles: minimum distance to node sides). Default 16. Keeps edges off
   * the block borders for legibility.
   */
  edgeNodeSpacing?: number;
  /**
   * Preferred minimum gap between two parallel edge segments, mapped to
   * ELK's edgeEdge and edgeEdgeBetweenLayers spacing. Raise it when edges
   * that fan from one side to vertically-aligned targets bunch up or
   * superimpose after their orthogonal bends. Default 24.
   */
  edgeEdgeSpacing?: number;
  /** Text measurement; defaults to the deterministic estimator. */
  measure?: TextMeasure;
  /**
   * ELK engine to lay out with. Defaults to a shared synchronous elkjs
   * instance that runs on the calling thread. Inject a worker-backed
   * engine (see ElkEngine) to move layout off the main thread.
   */
  engine?: ElkEngine;
}

/* Expand/collapse was removed by ruling (2026-07-10); see
 * planning/expand-collapse-postmortem.md before reintroducing any
 * layout-time collapse input. `compartmentKey` and
 * `collapsedCompartments` were deleted with it. */
/** Geometry of one laid-out element. Coordinates are ABSOLUTE top-left. */
export interface StructuralNodeGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  /** "container" | "row" | "node". Rows additionally carry parent/compartment. */
  kind: "container" | "row" | "node";
  parent?: string;
  compartment?: string;
  /** Row text / header name passthrough so renderers need no second lookup. */
  text?: string;
  /** True for synthetic compartment-title divider rows. */
  divider?: boolean;
}

export interface StructuralPortGeometry {
  node: string;
  side: PortSide;
  /** Absolute top-left of the port square. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The polyline the layout routed for one edge, in absolute coordinates:
 * the section start, every bend, then the end. ELK's orthogonal router
 * routes these AROUND nodes, so a renderer that follows them verbatim
 * (Cytoscape `segments`) does not pass an edge behind a block. Present
 * only when the layout ran with `routeEdges` (the default); absent when a
 * consumer opts back into endpoint-only routing (e.g. Cytoscape taxi).
 */
export interface StructuralEdgeGeometry {
  points: { x: number; y: number }[];
}

/**
 * Versioned geometry document (the third integration channel:
 * versioned JSON documents). Renderer-neutral: absolute top-left
 * boxes; a Cytoscape consumer converts to center positions.
 */
export interface StructuralGeometry {
  version: 1;
  nodes: Record<string, StructuralNodeGeometry>;
  ports: Record<string, StructuralPortGeometry>;
  /**
   * Routed edge polylines, keyed by edge id. Present when the layout ran
   * with `routeEdges` (default); a renderer follows these to route around
   * nodes. Synthetic chain edges are never included. Optional so an
   * endpoint-only consumer can ignore it.
   */
  edges?: Record<string, StructuralEdgeGeometry>;
  /** Header strip height used for every container (renderers reserve it). */
  headerHeight: number;
}

const CHAIN_PREFIX = "g3t-chain:";

/** True for the synthetic, never-rendered row-ordering edges. */
export function isChainEdgeId(id: string): boolean {
  return id.startsWith(CHAIN_PREFIX);
}

const EDGE_PORT_PREFIX = "__g3t_eport__";

/**
 * Synthetic boundary-port id for a body edge end. Body edges (no declared
 * sourcePort/targetPort) get one of these on each end so ELK distributes the
 * attachment along the node side and the renderer draws a distinct,
 * orthogonal connection per edge instead of stacking them at one point.
 */
export function edgePortId(edgeId: string, end: "s" | "t"): string {
  return `${EDGE_PORT_PREFIX}${edgeId}__${end}`;
}

/** True for a synthetic body-edge attachment port (positioned, never drawn). */
export function isEdgePortId(id: string): boolean {
  return id.startsWith(EDGE_PORT_PREFIX);
}

interface RowPlan {
  id: string;
  text: string;
  compartment: string;
  divider: boolean;
  height: number;
}

/**
 * Pure builder: StructuralGraphInput -> ELK JSON per the validated
 * recipe. Exposed for testability; layoutStructural() runs it through
 * elkjs and flattens the result.
 */
export function buildStructuralElkGraph(
  input: StructuralGraphInput,
  options?: StructuralLayoutOptions,
): { graph: ElkNode; rowPlans: Map<string, RowPlan[]>; headerHeight: number } {
  const measure = options?.measure ?? estimateTextSize;
  const hPad = options?.hPadding ?? 8;
  const vPad = options?.vPadding ?? 5;
  const direction = options?.direction ?? "RIGHT";
  const spacing = options?.spacing ?? 60;
  const layerSpacing = options?.layerSpacing ?? spacing + 20;
  const edgeRouting = options?.edgeRouting ?? "ORTHOGONAL";
  const nodePlacement = options?.nodePlacement ?? "BRANDES_KOEPF";
  const crossingMinimization = options?.crossingMinimization ?? "LAYER_SWEEP";
  const edgeNodeSpacing = options?.edgeNodeSpacing ?? 16;
  const edgeEdgeSpacing = options?.edgeEdgeSpacing ?? 24;

  // Side policy. Data-flow (declared) ports sit on the flow axis (left/right
  // for a horizontal layout); body edges attach perpendicular to the flow
  // (top/bottom for a horizontal layout): "ports left/right, links top/
  // bottom". Soft by construction: ELK still places nodes for readability.
  const horizontalFlow = direction === "RIGHT" || direction === "LEFT";
  const forwardSide: PortSide =
    direction === "RIGHT"
      ? "EAST"
      : direction === "LEFT"
        ? "WEST"
        : direction === "DOWN"
          ? "SOUTH"
          : "NORTH";
  const backwardSide: PortSide =
    direction === "RIGHT"
      ? "WEST"
      : direction === "LEFT"
        ? "EAST"
        : direction === "DOWN"
          ? "NORTH"
          : "SOUTH";
  const bodySourceSide: PortSide = horizontalFlow ? "SOUTH" : "EAST";
  const bodyTargetSide: PortSide = horizontalFlow ? "NORTH" : "WEST";

  // Declared-port role for the default side: used as a sourcePort => output
  // (flow-forward); used as a targetPort => input (flow-backward).
  const outputPorts = new Set<string>();
  const inputPorts = new Set<string>();
  for (const e of input.edges) {
    if (e.sourcePort) outputPorts.add(e.sourcePort);
    if (e.targetPort) inputPorts.add(e.targetPort);
  }
  const declaredPortSide = (p: StructuralPort): PortSide => {
    if (p.side) return p.side;
    if (outputPorts.has(p.id) && !inputPorts.has(p.id)) return forwardSide;
    if (inputPorts.has(p.id) && !outputPorts.has(p.id)) return backwardSide;
    return forwardSide;
  };

  // Synthesized attachment ports for body edges, grouped by host node.
  const synthPortsByNode = new Map<string, ElkPort[]>();
  const addSynthPort = (nodeId: string, port: ElkPort) => {
    const list = synthPortsByNode.get(nodeId);
    if (list) list.push(port);
    else synthPortsByNode.set(nodeId, [port]);
  };
  for (const e of input.edges) {
    if (!e.sourcePort) {
      addSynthPort(e.source, {
        id: edgePortId(e.id, "s"),
        width: 1,
        height: 1,
        layoutOptions: { "elk.port.side": bodySourceSide },
      });
    }
    if (!e.targetPort) {
      addSynthPort(e.target, {
        id: edgePortId(e.id, "t"),
        width: 1,
        height: 1,
        layoutOptions: { "elk.port.side": bodyTargetSide },
      });
    }
  }

  const headerHeight = measure("M", "header").height + vPad * 2;
  const rowPlans = new Map<string, RowPlan[]>();
  const children: ElkNode[] = [];
  // Sketch flow-axis hold (G3L:LAY-018): when a hinted node would
  // SHRINK along the flow axis (its compartment collapsed), holding
  // its prior extent keeps its layer's slot stable so downstream
  // layers do not slide toward it (measured: elkjs ignores
  // `elk.margins` as a layoutOption, so slot reservation must happen
  // through the node's own size). The box then collapses in height
  // but keeps its footprint width: "resizes in place", with the freed
  // interior reading as whitespace (the ruled A2 tradeoff).
  const sketchHints = options?.sketch;
  const holdFlowExtent =
    sketchHints && (direction === "RIGHT" || direction === "LEFT")
      ? (id: string, extent: number): number => {
          const prior = sketchHints[id]?.width;
          return prior !== undefined ? Math.max(extent, prior) : extent;
        }
      : (_id: string, extent: number): number => extent;

  for (const node of input.nodes) {
    const declaredPorts: ElkPort[] = (node.ports ?? []).map((p) => ({
      id: p.id,
      width: p.size ?? 12,
      height: p.size ?? 12,
      layoutOptions: { "elk.port.side": declaredPortSide(p) },
    }));
    const synthPorts = synthPortsByNode.get(node.id) ?? [];
    const allPorts = [...declaredPorts, ...synthPorts];
    const ports: ElkPort[] | undefined =
      allPorts.length > 0 ? allPorts : undefined;
    const portConstraint: ElkLayoutOptions = ports
      ? { "elk.portConstraints": "FIXED_SIDE" }
      : {};

    const compartments = node.compartments ?? [];
    const hasRows = compartments.some(
      (c) => c.rows.length > 0 || c.title !== undefined,
    );

    if (!hasRows) {
      // Plain node: header (if any) sizes it, else explicit/default box.
      const headerW = node.header
        ? measure(headerText(node.header), "header").width + hPad * 2
        : 0;
      const plainW = holdFlowExtent(
        node.id,
        Math.max(node.width ?? 40, headerW),
      );
      const plainH = node.height ?? 40;
      children.push({
        id: node.id,
        width: plainW,
        height: plainH,
        ...(ports ? { ports } : {}),
        layoutOptions: portConstraint,
      });
      continue;
    }

    // Compartmented container: plan rows (titles become divider rows),
    // measure everything, assign the shared width.
    const plans: RowPlan[] = [];
    let maxTextW = node.header
      ? measure(headerText(node.header), "header").width
      : 0;
    for (const comp of compartments) {
      if (comp.title !== undefined) {
        const m = measure(comp.title, "compartmentTitle");
        maxTextW = Math.max(maxTextW, m.width);
        plans.push({
          id: `${node.id}::${comp.id}::title`,
          text: comp.title,
          compartment: comp.id,
          divider: true,
          height: m.height + vPad * 2,
        });
      }
      for (const row of comp.rows) {
        const m = measure(row.text, "row");
        maxTextW = Math.max(maxTextW, m.width);
        plans.push({
          id: row.id,
          text: row.text,
          compartment: comp.id,
          divider: false,
          height: m.height + vPad * 2,
        });
      }
    }
    const rowWidth = holdFlowExtent(node.id, maxTextW + hPad * 2);
    rowPlans.set(node.id, plans);

    const rowNodes: ElkNode[] = plans.map((p) => ({
      id: p.id,
      width: rowWidth,
      height: p.height,
    }));
    const chainEdges: ElkExtendedEdge[] = [];
    for (let i = 1; i < plans.length; i++) {
      const prev = plans[i - 1];
      const next = plans[i];
      if (!prev || !next) continue;
      chainEdges.push({
        id: `${CHAIN_PREFIX}${prev.id}->${next.id}`,
        sources: [prev.id],
        targets: [next.id],
      });
    }

    children.push({
      id: node.id,
      ...(ports ? { ports } : {}),
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.padding": `[top=${headerHeight},left=0,bottom=0,right=0]`,
        "elk.spacing.nodeNode": "0",
        "elk.layered.spacing.nodeNodeBetweenLayers": "0",
        "elk.spacing.edgeNode": "0",
        ...portConstraint,
      },
      children: rowNodes,
      edges: chainEdges,
    });
  }

  const edges: ElkExtendedEdge[] = input.edges.map((e) => ({
    id: e.id,
    sources: [e.sourcePort ?? edgePortId(e.id, "s")],
    targets: [e.targetPort ?? edgePortId(e.id, "t")],
  }));

  const graph: ElkNode = {
    id: "g3t-structural-root",
    layoutOptions: {
      // Default SEPARATE_CHILDREN hierarchy handling, deliberately:
      // INCLUDE_CHILDREN runs one global pass that overrides each
      // container's DOWN sub-layout and lays rows out horizontally.
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.edgeRouting": edgeRouting,
      "elk.layered.nodePlacement.strategy": nodePlacement,
      "elk.layered.crossingMinimization.strategy": crossingMinimization,
      "elk.spacing.nodeNode": String(spacing),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(layerSpacing),
      "elk.spacing.edgeNode": String(edgeNodeSpacing),
      "elk.layered.spacing.edgeNodeBetweenLayers": String(edgeNodeSpacing),
      "elk.spacing.edgeEdge": String(edgeEdgeSpacing),
      "elk.layered.spacing.edgeEdgeBetweenLayers": String(edgeEdgeSpacing),
    },
    children,
    edges,
  };

  // Sketch mode (G3L:LAY-017): seed prior positions and switch the
  // three layered strategies to INTERACTIVE so ELK preserves the
  // existing layer/order structure instead of recomputing it. The
  // hints ride the children as x/y (what elkjs's interactive
  // strategies consume); nodes without a hint participate normally.
  const sketch = options?.sketch;
  if (sketch && Object.keys(sketch).length > 0 && graph.layoutOptions) {
    graph.layoutOptions["elk.layered.cycleBreaking.strategy"] = "INTERACTIVE";
    graph.layoutOptions["elk.layered.layering.strategy"] = "INTERACTIVE";
    graph.layoutOptions["elk.layered.crossingMinimization.strategy"] =
      "INTERACTIVE";
    // The experiment's measured finding: the three structural
    // strategies preserve layers and order but NOT coordinates
    // (BRANDES_KOEPF recenters within layers, ~360px drift on the
    // fixture). Node placement is the coordinate-preserving phase, so
    // sketch mode forces it INTERACTIVE too, superseding the
    // `nodePlacement` option for the run.
    graph.layoutOptions["elk.layered.nodePlacement.strategy"] = "INTERACTIVE";
    // Position hints ride the children as x/y (what elkjs's
    // interactive strategies consume). The flow-axis extent hold for
    // HORIZONTAL flows happened during assembly (holdFlowExtent).
    // VERTICAL flows (DOWN/UP: the MBSE BDD/REQ case MR-1 caught in
    // the browser) hold the flow axis here instead, via a
    // MINIMUM_SIZE floor at the prior height: probe-verified (unlike
    // elk.margins, which elkjs ignores), and it makes the box height
    // CONSTANT across collapse AND expand, so both toggle directions
    // are stable; the hidden-row interior reads as whitespace inside
    // the border (the A2 tradeoff, vertical form; MR-1 re-review
    // judges the look).
    const verticalFlow = direction === "DOWN" || direction === "UP";
    for (const child of graph.children ?? []) {
      const hint = sketch[child.id];
      if (!hint) continue;
      child.x = hint.x;
      child.y = hint.y;
      if (verticalFlow && hint.height !== undefined) {
        child.layoutOptions = {
          ...(child.layoutOptions ?? {}),
          "elk.nodeSize.constraints": "MINIMUM_SIZE",
          "elk.nodeSize.minimum": `(0, ${hint.height})`,
        };
      }
    }
  }

  return { graph, rowPlans, headerHeight };
}

function headerText(header: { stereotype?: string; name: string }): string {
  return header.stereotype
    ? `\u00AB${header.stereotype}\u00BB ${header.name}`
    : header.name;
}

/** An ELK-compatible layout engine: anything exposing elkjs's
 *  `layout(graph) => Promise<graph>`. The default is a lazily-created
 *  synchronous elkjs instance (the bundled build, which runs on the
 *  CALLING thread). A caller in a bundler/browser context can inject a
 *  WORKER-backed ELK so layout runs OFF the main thread; a structural
 *  graph then never blocks rendering regardless of size. Core never
 *  constructs a Worker itself (that needs a bundler-resolved URL and
 *  would break the framework-agnostic doctrine, D6): it only consumes
 *  this shape. */
export interface ElkEngine {
  layout(graph: ElkNode): Promise<ElkNode>;
}

// One shared synchronous ELK instance. `new ELK()` per call paid a
// cold-start cost (~0.5s) every time, and under React StrictMode's dev
// double-invoke the structural effect ran it twice on mount; the
// singleton plus the in-flight de-dup below remove both. Lazily created
// so importing this module stays free and a node/jsdom caller that never
// lays out pays nothing.
let _defaultEngine: ElkEngine | undefined;
function defaultEngine(): ElkEngine {
  return (_defaultEngine ??= new ELK());
}

// Layout is deterministic in (input, layout-affecting options): two
// calls with the same IMMUTABLE input yield the same geometry. React
// StrictMode invokes the structural effect twice on mount, which would
// otherwise launch two ELK runs; de-duping by input identity collapses
// them to one and makes re-opening a structural view instant. Keyed in a
// WeakMap so entries are collected when the input graph is dropped.
// Bypassed when a custom `measure` is supplied (its output is not part
// of the key) and cleared on rejection so a failed layout can retry.
const _layoutCache = new WeakMap<
  StructuralGraphInput,
  Map<string, Promise<StructuralGeometry>>
>();

/**
 * Engine dispatch (WS-D D3a): THE DEFAULT ENGINE IS g3t. The
 * pre-pass reuses buildStructuralElkGraph's sizing so the engines
 * cannot drift on measurement; edges route through the gap router
 * with grid escalation. elkjs remains selectable via engineKind:
 * "elk" until D3b removes it. The layout cache wraps this dispatch,
 * so caching and in-flight de-duplication are engine-agnostic, with
 * engineKind and the g3t strategy options in the key.
 */
async function runLayoutDispatch(
  input: StructuralGraphInput,
  options?: StructuralLayoutOptions,
): Promise<StructuralGeometry> {
  if ((options?.engineKind ?? "g3t") === "g3t") {
    const { g3tLayoutStructural } = await import("./g3t-engine/g3t-structural");
    return g3tLayoutStructural(input, options);
  }
  return runStructuralLayout(input, options);
}

function layoutOptionsKey(options?: StructuralLayoutOptions): string {
  return JSON.stringify({
    direction: options?.direction ?? "RIGHT",
    hPadding: options?.hPadding ?? 8,
    vPadding: options?.vPadding ?? 5,
    spacing: options?.spacing ?? 60,
    layerSpacing: options?.layerSpacing ?? (options?.spacing ?? 60) + 20,
    edgeRouting: options?.edgeRouting ?? "ORTHOGONAL",
    nodePlacement: options?.nodePlacement ?? "BRANDES_KOEPF",
    crossingMinimization: options?.crossingMinimization ?? "LAYER_SWEEP",
    edgeNodeSpacing: options?.edgeNodeSpacing ?? 16,
    edgeEdgeSpacing: options?.edgeEdgeSpacing ?? 24,
    routeEdges: options?.routeEdges ?? true,
    // WS-D: the engine is part of what was computed.
    engineKind: options?.engineKind ?? "g3t",
    g3t:
      (options?.engineKind ?? "g3t") === "g3t"
        ? {
            layering: options?.layering ?? "network-simplex",
            layerWidth: options?.layerWidth ?? 8,
            placement: options?.placement ?? "brandes-koepf",
            layeringBudgetMs: options?.layeringBudgetMs ?? 80,
            orderingBudgetMs: options?.orderingBudgetMs ?? 60,
            routingBudgetMs: options?.routingBudgetMs ?? 80,
          }
        : undefined,
    // Sketch participates in the memo key: a sketched re-layout of the
    // same input+options is a DIFFERENT computation from the
    // from-scratch one (G3L:LAY-017); rounded to integers so subpixel
    // jitter in captured positions does not defeat the cache.
    sketch: options?.sketch
      ? Object.entries(options.sketch)
          .map(([id, p]) => [id, Math.round(p.x), Math.round(p.y)] as const)
          .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      : [],
  });
}

/**
 * Run the structural layout: build the ELK graph, lay it out (via the
 * injectable engine, default synchronous elkjs), and flatten the result
 * into a StructuralGeometry document with ABSOLUTE coordinates.
 *
 * Results are de-duped by input identity (see `_layoutCache`): the
 * common case of the same immutable input laid out more than once
 * (StrictMode double-invoke, structural-view re-open) runs ELK once.
 */
export async function layoutStructural(
  input: StructuralGraphInput,
  options?: StructuralLayoutOptions,
): Promise<StructuralGeometry> {
  // A custom measure changes geometry but is not captured by the cache
  // key, so never serve such a call from cache.
  if (options?.measure) return runLayoutDispatch(input, options);

  const key = layoutOptionsKey(options);
  let byKey = _layoutCache.get(input);
  if (!byKey) {
    byKey = new Map();
    _layoutCache.set(input, byKey);
  }
  const map = byKey;
  const cached = map.get(key);
  if (cached) return cached;

  const pending = runLayoutDispatch(input, options);
  map.set(key, pending);
  pending.catch(() => {
    if (map.get(key) === pending) map.delete(key);
  });
  return pending;
}

async function runStructuralLayout(
  input: StructuralGraphInput,
  options?: StructuralLayoutOptions,
): Promise<StructuralGeometry> {
  const { graph, rowPlans, headerHeight } = buildStructuralElkGraph(
    input,
    options,
  );
  const engine = options?.engine ?? defaultEngine();
  const laid = await engine.layout(graph);

  const nodes: Record<string, StructuralNodeGeometry> = {};
  const portsOut: Record<string, StructuralPortGeometry> = {};
  const inputById = new Map(input.nodes.map((n) => [n.id, n]));

  for (const top of laid.children ?? []) {
    const ox = top.x ?? 0;
    const oy = top.y ?? 0;
    const source = inputById.get(top.id);
    const plans = rowPlans.get(top.id);
    nodes[top.id] = {
      x: ox,
      y: oy,
      width: top.width ?? 0,
      height: top.height ?? 0,
      kind: plans ? "container" : "node",
      // Plain nodes without a header fall back to their id: an
      // unlabeled box reads as a bug, not a choice (VA-27 review,
      // round 32: "the first box is empty?").
      text: source?.header
        ? headerText(source.header)
        : plans
          ? undefined
          : top.id,
    };
    if (plans) {
      const planById = new Map(plans.map((p) => [p.id, p]));
      for (const child of top.children ?? []) {
        const plan = planById.get(child.id);
        if (!plan) continue;
        nodes[child.id] = {
          x: ox + (child.x ?? 0),
          y: oy + (child.y ?? 0),
          width: child.width ?? 0,
          height: child.height ?? 0,
          kind: "row",
          parent: top.id,
          compartment: plan.compartment,
          text: plan.text,
          divider: plan.divider || undefined,
        };
      }
    }
    for (const port of top.ports ?? []) {
      // Side comes from the laid-out port (we set elk.port.side under
      // FIXED_SIDE). Synth body-edge ports are included so the renderer can
      // attach to them; they are flagged off elsewhere by id.
      const side =
        (port.layoutOptions?.["elk.port.side"] as PortSide | undefined) ??
        "EAST";
      portsOut[port.id] = {
        node: top.id,
        side,
        x: ox + (port.x ?? 0),
        y: oy + (port.y ?? 0),
        width: port.width ?? 0,
        height: port.height ?? 0,
      };
    }
  }

  // Routed edge polylines. ELK populates each edge's sections with the
  // node-avoiding path it computed; root-level edges report absolute
  // coordinates (the edge container is the root). We flatten each section
  // to start + bends + end. Synthetic chain edges never carry a rendered
  // route. Omitted entirely when routeEdges is off (endpoint-only render).
  let edgesOut: Record<string, StructuralEdgeGeometry> | undefined;
  if (options?.routeEdges ?? true) {
    edgesOut = {};
    for (const edge of laid.edges ?? []) {
      if (isChainEdgeId(edge.id)) continue;
      const points: { x: number; y: number }[] = [];
      for (const section of edge.sections ?? []) {
        points.push({ x: section.startPoint.x, y: section.startPoint.y });
        for (const bend of section.bendPoints ?? []) {
          points.push({ x: bend.x, y: bend.y });
        }
        points.push({ x: section.endPoint.x, y: section.endPoint.y });
      }
      // A route needs at least the two endpoints to be useful; otherwise
      // leave the edge unrouted so the renderer falls back cleanly.
      if (points.length >= 2) edgesOut[edge.id] = { points };
    }
  }

  // Sketch re-anchor (G3L:LAY-018). Interactive strategies preserve the
  // scene's RELATIVE structure, but ELK's coordinate frame floats: when
  // a container shrinks, the whole result translates rigidly (measured
  // as a uniform per-node delta on the experiment fixture). Since D15
  // holds the camera, absolute positions are what the user sees, so
  // sketch mode ends with a rigid translation that re-anchors the
  // result to the sketch frame: the component-wise MEDIAN delta over
  // hinted nodes (median, not mean, so the deliberately-changed node
  // cannot bias the frame).
  const sketch = options?.sketch;
  if (sketch) {
    const dxs: number[] = [];
    const dys: number[] = [];
    for (const [id, hint] of Object.entries(sketch)) {
      const g = nodes[id];
      if (!g) continue;
      dxs.push(hint.x - g.x);
      dys.push(hint.y - g.y);
    }
    if (dxs.length > 0) {
      const median = (v: number[]): number => {
        const s = [...v].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        const lo = s[mid - (s.length % 2 === 0 ? 1 : 0)] ?? 0;
        const hi = s[mid] ?? 0;
        return (lo + hi) / 2;
      };
      const dx = median(dxs);
      const dy = median(dys);
      if (dx !== 0 || dy !== 0) {
        for (const g of Object.values(nodes)) {
          g.x += dx;
          g.y += dy;
        }
        for (const p of Object.values(portsOut)) {
          p.x += dx;
          p.y += dy;
        }
        if (edgesOut) {
          for (const e of Object.values(edgesOut)) {
            for (const pt of e.points) {
              pt.x += dx;
              pt.y += dy;
            }
          }
        }
      }
    }
  }

  return { version: 1, nodes, ports: portsOut, edges: edgesOut, headerHeight };
}
