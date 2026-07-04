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
  /** Whether this compartment may be collapsed (default true). A
   *  non-collapsible compartment ignores collapsed-state entries. */
  collapsible?: boolean;
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

export interface StructuralLayoutOptions {
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
  /** Crossing-minimization strategy. Default "LAYER_SWEEP". */
  crossingMinimization?: "LAYER_SWEEP" | "INTERACTIVE";
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
   * Compartments to render collapsed: a set of `${nodeId}::${compartmentId}`
   * keys. A collapsed compartment shows its title divider (or a
   * synthetic "(n hidden)" divider when untitled) but omits its
   * content rows, so the container shrinks. Non-collapsible
   * compartments (collapsible: false) ignore membership here.
   */
  collapsedCompartments?: ReadonlySet<string>;
  /**
   * ELK engine to lay out with. Defaults to a shared synchronous elkjs
   * instance that runs on the calling thread. Inject a worker-backed
   * engine (see ElkEngine) to move layout off the main thread.
   */
  engine?: ElkEngine;
}

/** The collapse-state key for a compartment within a node. */
export function compartmentKey(nodeId: string, compartmentId: string): string {
  return `${nodeId}::${compartmentId}`;
}

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
  const collapsed = options?.collapsedCompartments ?? new Set<string>();
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
      children.push({
        id: node.id,
        width: Math.max(node.width ?? 40, headerW),
        height: node.height ?? 40,
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
      const isCollapsed =
        comp.collapsible !== false && collapsed.has(`${node.id}::${comp.id}`);
      if (comp.title !== undefined) {
        const titleText = isCollapsed
          ? `${comp.title} (${comp.rows.length} hidden)`
          : comp.title;
        const m = measure(titleText, "compartmentTitle");
        maxTextW = Math.max(maxTextW, m.width);
        plans.push({
          id: `${node.id}::${comp.id}::title`,
          text: titleText,
          compartment: comp.id,
          divider: true,
          height: m.height + vPad * 2,
        });
      } else if (isCollapsed) {
        // Untitled but collapsed: a synthetic divider so the
        // compartment is not silently empty (and is re-expandable).
        const synthetic = `(${comp.rows.length} hidden)`;
        const m = measure(synthetic, "compartmentTitle");
        maxTextW = Math.max(maxTextW, m.width);
        plans.push({
          id: `${node.id}::${comp.id}::title`,
          text: synthetic,
          compartment: comp.id,
          divider: true,
          height: m.height + vPad * 2,
        });
      }
      if (isCollapsed) continue; // omit content rows; container shrinks
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
    const rowWidth = maxTextW + hPad * 2;
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
    collapsed: options?.collapsedCompartments
      ? [...options.collapsedCompartments].sort()
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
  if (options?.measure) return runStructuralLayout(input, options);

  const key = layoutOptionsKey(options);
  let byKey = _layoutCache.get(input);
  if (!byKey) {
    byKey = new Map();
    _layoutCache.set(input, byKey);
  }
  const map = byKey;
  const cached = map.get(key);
  if (cached) return cached;

  const pending = runStructuralLayout(input, options);
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

  return { version: 1, nodes, ports: portsOut, edges: edgesOut, headerHeight };
}
