/**
 * Pseudo-node spreading transforms (Brief 06: dense-scene legibility).
 *
 * PROJECTION-level, user-visible spreading devices, distinct from the
 * LAYOUT-internal dummy chains of LAY-005. Two opt-in transforms:
 *
 * - hubBurst: a high-degree node's incident edges are grouped by
 *   (edge type, direction relative to the hub) and each group is
 *   fanned out through one pseudo "satellite" node, so a port-storm
 *   reads as a ring of grouped connectors instead of a solid mat.
 * - busCollapse: a many-to-one fan-in of >= kBus like edges collapses
 *   to one trunk into a pseudo "junction" node with short taps.
 *
 * SUBSTRATE NOTE (why these live here, not in ProjectionPipeline):
 * the RDF `ProjectionPipeline` (pipeline.ts) is triple-level
 * (RDFGraph -> RDFGraph -> UGM) and runs BEFORE the UGM is assembled.
 * Hub degree and edge grouping are graph-level facts that only exist
 * on the assembled UGM, so these are UGM -> UGM transforms applied
 * AFTER projection. They are pure: the input UGM is never mutated; a
 * fresh UGM is returned, so toggling a transform is a re-projection.
 * Because pseudo nodes are a post-projection concept, they never reach
 * the triple-level collapse steps, so those steps need no pseudo guard.
 * The guard sites that DO matter are the UGM consumers: the encoding
 * attribute-mapper, subgraph export, and the algorithm-result adapter.
 *
 * @see planning/orchestrate-routing-independence/06-dense-scene-legibility-brief.md
 */

import { UGM } from "../ugm";
import type { NodeAttributes, EdgeInput } from "../ugm";

/** Property key marking a projection-injected pseudo node. */
export const PSEUDO_FLAG = "pseudo";

/** Edge type stamped on the hub<->satellite and junction->sink connectors. */
export const PSEUDO_CONNECTOR_TYPE = "pseudoConnector";
/** Edge type stamped on the junction->sink trunk. */
export const PSEUDO_TRUNK_TYPE = "pseudoTrunk";

/** A pseudo node is a satellite (hubBurst) or a junction (busCollapse). */
export type PseudoKind = "satellite" | "junction";

/**
 * True when a UGM node was injected by a pseudo-node transform. The
 * single shared predicate every UGM consumer uses to skip pseudo nodes
 * (export, algorithm ingest, encoding attribute-mapping). Keying on the
 * property bag (not a bespoke field) keeps satellites ordinary UGM
 * nodes so their VisualAttributes and direct `properties._color` path
 * still render.
 */
export function isPseudoNode(attrs: NodeAttributes): boolean {
  return attrs.properties[PSEUDO_FLAG] === true;
}

/** Filter helper: drop pseudo nodes from a node-attribute list. */
export function filterPseudoNodes<T extends { attributes: NodeAttributes }>(
  nodes: readonly T[],
): T[] {
  return nodes.filter((n) => !isPseudoNode(n.attributes));
}

/**
 * Filter helper: drop edges incident on any pseudo node. `pseudoIds`
 * is the set of pseudo node ids (callers build it once from the node
 * pass) so this stays O(edges).
 */
export function filterPseudoEdges<T extends { source: string; target: string }>(
  edges: readonly T[],
  pseudoIds: ReadonlySet<string>,
): T[] {
  return edges.filter(
    (e) => !pseudoIds.has(e.source) && !pseudoIds.has(e.target),
  );
}

// ── hubBurst ─────────────────────────────────────────────────────────

export interface HubBurstOptions {
  /** Total-degree threshold; nodes with degree > k burst. Default 12. */
  k?: number;
}

/** Reverse map: satellite node id -> the hub + edge group it stands for. */
export type SatelliteMap = Map<string, { hub: string; groupKey: string }>;

/** Where one original edge landed under hubBurst. */
export interface HubBurstEdgeAssignment {
  /** Whether the edge was rerouted through a satellite. */
  burst: boolean;
  /** Owning hub id (burst edges only). */
  hub?: string;
  /** (type, direction) group key relative to the hub (burst edges only). */
  groupKey?: string;
  /** Satellite node id the edge fans through (burst edges only). */
  satellite?: string;
  /** The non-hub endpoint (burst edges only). */
  neighbor?: string;
}

export interface HubBurstResult {
  /** A fresh UGM with satellites inserted; the input UGM is untouched. */
  ugm: UGM;
  /** satellite id -> {hub, groupKey}, for hit-testing / selection. */
  satellites: SatelliteMap;
  /** original edge id -> assignment; covers every original edge once. */
  invert: Map<string, HubBurstEdgeAssignment>;
}

/**
 * Group a high-degree node's incident edges by (type, direction) and
 * fan each group through one satellite pseudo node.
 *
 * Tie-breaking (deterministic invert): an edge whose BOTH endpoints
 * have degree > k is owned by the higher-degree endpoint; ties break to
 * the lexicographically smaller node id. Degrees are measured on the
 * pre-transform snapshot, so every original edge lands in exactly one
 * satellite group regardless of direction.
 */
export function hubBurst(
  ugm: UGM,
  options: HubBurstOptions = {},
): HubBurstResult {
  const k = options.k ?? 12;

  // Pre-transform degree snapshot (incident edge count per node).
  const degree = new Map<string, number>();
  ugm.forEachNode((id) => degree.set(id, ugm.getNodeEdges(id).length));
  const isHub = (id: string): boolean => (degree.get(id) ?? 0) > k;

  const out = new UGM();
  const satellites: SatelliteMap = new Map();
  const invert = new Map<string, HubBurstEdgeAssignment>();

  // Copy every original node verbatim (isolated nodes included).
  ugm.forEachNode((id, attrs) => {
    out.addNode(id, {
      types: [...attrs.types],
      properties: { ...attrs.properties },
    });
  });

  const ensureSatellite = (hub: string, groupKey: string): string => {
    const id = `pseudo:sat:${hub}:${groupKey}`;
    if (!out.hasNode(id)) {
      out.addNode(id, {
        types: ["Pseudo"],
        properties: {
          [PSEUDO_FLAG]: true,
          pseudoKind: "satellite" as PseudoKind,
          pseudoOwner: hub,
          pseudoGroupKey: groupKey,
        },
      });
      satellites.set(id, { hub, groupKey });
    }
    return id;
  };

  const pickOwner = (source: string, target: string): string | null => {
    const s = isHub(source);
    const t = isHub(target);
    if (s && t) {
      const ds = degree.get(source) ?? 0;
      const dt = degree.get(target) ?? 0;
      if (ds !== dt) return ds > dt ? source : target;
      return source < target ? source : target;
    }
    if (s) return source;
    if (t) return target;
    return null;
  };

  ugm.forEachEdge((edgeId, attrs, source, target) => {
    const edgeInput: EdgeInput = {
      type: attrs.type,
      properties: { ...attrs.properties },
      ...attrs.meta,
    };
    const owner = pickOwner(source, target);
    if (owner === null) {
      // Neither endpoint bursts: copy the edge unchanged.
      out.addEdge(source, target, edgeInput);
      invert.set(edgeId, { burst: false });
      return;
    }

    const neighbor = owner === source ? target : source;
    const direction = owner === source ? "out" : "in";
    const groupKey = `${attrs.type}|${direction}`;
    const satellite = ensureSatellite(owner, groupKey);
    const connectorSeen =
      out.getEdgesBetween(owner, satellite).length > 0 ||
      out.getEdgesBetween(satellite, owner).length > 0;

    if (direction === "out") {
      if (!connectorSeen) {
        out.addEdge(owner, satellite, { type: PSEUDO_CONNECTOR_TYPE });
      }
      out.addEdge(satellite, neighbor, edgeInput);
    } else {
      out.addEdge(neighbor, satellite, edgeInput);
      if (!connectorSeen) {
        out.addEdge(satellite, owner, { type: PSEUDO_CONNECTOR_TYPE });
      }
    }
    invert.set(edgeId, {
      burst: true,
      hub: owner,
      groupKey,
      satellite,
      neighbor,
    });
  });

  return { ugm: out, satellites, invert };
}

// ── busCollapse ──────────────────────────────────────────────────────

export interface BusCollapseOptions {
  /** Min like edges into one sink to collapse to a trunk. Default 3. */
  kBus?: number;
}

/** Reverse map: junction node id -> the sink + edge group it collapses. */
export type JunctionMap = Map<
  string,
  { sinkHub: string; edgeGroupKey: string }
>;

export interface BusCollapseResult {
  /** A fresh UGM with junctions inserted; the input UGM is untouched. */
  ugm: UGM;
  /** junction id -> {sinkHub, edgeGroupKey}, for hit-testing / selection. */
  junctions: JunctionMap;
  /** junction id -> the original edge ids collapsed into its trunk. */
  invert: Map<string, string[]>;
}

/** djb2 string hash, hex; junction ids carry the `pseudo:bus:` prefix so
 *  they cannot collide with real node ids. */
function stableHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/**
 * Collapse each many-to-one fan-in of >= kBus like edges (grouped by
 * sink node + edge type) into one trunk edge through a pseudo junction
 * node, with one short tap per original source.
 */
export function busCollapse(
  ugm: UGM,
  options: BusCollapseOptions = {},
): BusCollapseResult {
  const kBus = options.kBus ?? 3;

  // Group incident edges by (sink target, edge type).
  interface GroupEdge {
    edgeId: string;
    source: string;
    target: string;
    input: EdgeInput;
  }
  const groups = new Map<string, GroupEdge[]>();
  ugm.forEachEdge((edgeId, attrs, source, target) => {
    const key = `${target}|${attrs.type}`;
    const input: EdgeInput = {
      type: attrs.type,
      properties: { ...attrs.properties },
      ...attrs.meta,
    };
    const list = groups.get(key);
    if (list) list.push({ edgeId, source, target, input });
    else groups.set(key, [{ edgeId, source, target, input }]);
  });

  const out = new UGM();
  const junctions: JunctionMap = new Map();
  const invert = new Map<string, string[]>();

  ugm.forEachNode((id, attrs) => {
    out.addNode(id, {
      types: [...attrs.types],
      properties: { ...attrs.properties },
    });
  });

  for (const [key, edges] of groups) {
    if (edges.length < kBus) {
      for (const e of edges) out.addEdge(e.source, e.target, e.input);
      continue;
    }
    const first = edges[0];
    if (!first) continue;
    const sink = first.target;
    const edgeType = first.input.type;
    const junctionId = `pseudo:bus:${stableHash(key)}`;
    out.addNode(junctionId, {
      types: ["Pseudo"],
      properties: {
        [PSEUDO_FLAG]: true,
        pseudoKind: "junction" as PseudoKind,
        pseudoOwner: sink,
        pseudoGroupKey: edgeType,
      },
    });
    junctions.set(junctionId, { sinkHub: sink, edgeGroupKey: edgeType });
    // One trunk into the sink, one tap per original source.
    out.addEdge(junctionId, sink, { type: PSEUDO_TRUNK_TYPE });
    const collapsed: string[] = [];
    for (const e of edges) {
      out.addEdge(e.source, junctionId, e.input);
      collapsed.push(e.edgeId);
    }
    invert.set(junctionId, collapsed);
  }

  return { ugm: out, junctions, invert };
}
