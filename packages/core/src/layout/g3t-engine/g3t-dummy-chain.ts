/**
 * LAY-005: dummy chains for long-span edges (owner Jake, 2026-08-14).
 *
 * The g3t layered engine's ordering (barycenter + transpose) and its
 * Brandes-Koepf placement both index by (layer, position). Without
 * dummies, an edge that spans k>1 layers is a single arc that
 * ordering cannot reduce against intermediate-layer nodes and BK's
 * type-1 conflict machinery has no inner segments to guard: the
 * long span dominates crossings on the adversarial scenes.
 *
 * The dagre-standard fix, split each long-span edge at every crossed
 * layer into a chain of pseudo (dummy) nodes, one per intermediate
 * layer. Ordering and placement see the chain as ordinary short
 * edges; the dummy positions become bend hints that the router
 * threads through, and the emitted geometry filters the dummies
 * back out. New engine surface, single owner (this file plus the two
 * engine entry points): no compat shim, `git revert` is the rollback.
 */
import type { Pt } from "./g3t-polyline-utils";

interface Node {
  id: string;
  width: number;
  height: number;
  dummy?: true;
}
interface Edge {
  id: string;
  source: string;
  target: string;
}

/**
 * Corridor supply contract (brief 04, owner Jake, 2026-08-14).
 *
 * Layout is responsible for corridor width, the router only for
 * arranging tracks inside it (the dagre negative lesson: a router
 * cannot widen the gap; only the layer-placement pass can). The
 * estimate is computed from structure (chain-segment count per
 * boundary), gap-sizing is a pure function of demand + base gap +
 * caps, and after routing the nudge pass returns a measured demand
 * that a dev-mode drift assertion compares back against the estimate
 * to catch systematic underestimation.
 *
 * These constants mirror the nudging defaults so the estimate uses
 * the same track/clearance geometry the router will consume.
 */
export const CORRIDOR_TRACK_GAP = 8;
export const CORRIDOR_CLEARANCE = 8;
export const CORRIDOR_MAX_GAP_FACTOR = 3;
/** Asymmetric slack in the drift assertion: estimate is expected to
 *  be >= actual demand; 1 track covers a single additional track
 *  from any one proxy source (bend avoidance, bundle splitting,
 *  shared-segment reuse). Widen (with a calibration note) when a
 *  diagram class fires two or more sources on the same corridor. */
export const CORRIDOR_DRIFT_TOLERANCE = 1;

/**
 * Count edges crossing each inter-layer boundary. Boundary index i
 * sits between layer i and layer i+1. Chain splitting is invariant
 * to this count (each original edge with span k contributes 1 to
 * each of k boundaries, same as k chain sub-edges), so the estimate
 * is computed from the pre-split (edges, layerOf) pair.
 */
export function estimateCorridorDemand(
  edges: readonly Edge[],
  layerOf: ReadonlyMap<string, number>,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const e of edges) {
    if (e.source === e.target) continue;
    const ls = layerOf.get(e.source);
    const lt = layerOf.get(e.target);
    if (ls === undefined || lt === undefined) continue;
    const lo = Math.min(ls, lt);
    const hi = Math.max(ls, lt);
    for (let i = lo; i < hi; i++) {
      out.set(i, (out.get(i) ?? 0) + 1);
    }
  }
  return out;
}

/**
 * Corridor gap formula: min(maxGapFactor*baseGap, max(baseGap,
 * demand*trackGap + 2*clearance)). Cap-active flag rides out so the
 * caller can annotate corridors that hit the outer cap (verification
 * step 4 in brief 04: total-area growth with all corridors cap-limited
 * signals the maxGapFactor default is too restrictive, not that the
 * area threshold is too tight).
 */
export function computeCorridorGap(
  demand: number,
  baseGap: number,
  trackGap: number = CORRIDOR_TRACK_GAP,
  clearance: number = CORRIDOR_CLEARANCE,
  maxGapFactor: number = CORRIDOR_MAX_GAP_FACTOR,
): { gap: number; capActive: boolean } {
  const uncapped = Math.max(baseGap, demand * trackGap + 2 * clearance);
  const cap = maxGapFactor * baseGap;
  if (uncapped > cap) return { gap: cap, capActive: true };
  return { gap: uncapped, capActive: false };
}

/**
 * Size of a dummy pseudo node (square). NON-ZERO on purpose: BK's
 * placement uses each node's cross-extent for size-aware separation
 * (`nodeSpacing`-plus-half-widths), so a zero-sized dummy would let
 * neighbors compact against a "point" chain and the collapsed route
 * would emerge with no lane budget between it and its intra-layer
 * neighbors. 8 keeps the chain visible to placement without pushing
 * layers apart (real boxes clear 44 in the test corpora). A dedicated
 * DUMMY_NODE_SIZE-zero-fails test pins this contract.
 */
export const DUMMY_NODE_SIZE = 8;

const DUMMY_PREFIX = "__g3t_dummy__";
export function isDummyId(id: string): boolean {
  return id.startsWith(DUMMY_PREFIX);
}

/**
 * After removeCycles + assignLayers (so the layer map is defined),
 * replace every edge that spans more than one layer with a chain of
 * dummy pseudo nodes at every intermediate layer. The chain is
 * always oriented in ASCENDING layer order (source-layer to target-
 * layer, using the ORIENTED direction after cycle removal), so the
 * caller's `reversed` set continues to make sense for the augmented
 * edges: chain sub-edges are never in the reversed set.
 *
 * Dummies are APPENDED to their layer (BK's type-1 scan is index-
 * keyed and injecting mid-array would misalign the block structure;
 * appending keeps existing indices stable and reads as "add the
 * chain to the right").
 *
 * `dummyIdsByEdge` is keyed by the ORIGINAL edge id and lists the
 * chain dummies in ORIGINAL-source-to-original-target order: for a
 * cycle-reversed edge, that is the reverse of the ascending layer
 * order the chain was built in. Harvest consumes this order verbatim.
 */
export function splitLongSpanEdges(
  nodes: readonly Node[],
  edges: readonly Edge[],
  layerOf: ReadonlyMap<string, number>,
  reversed: ReadonlySet<string>,
): {
  augmentedNodes: Node[];
  augmentedEdges: Edge[];
  augmentedLayerOf: Map<string, number>;
  dummyIdsByEdge: Map<string, string[]>;
} {
  const augmentedNodes: Node[] = [...nodes];
  const augmentedEdges: Edge[] = [];
  const augmentedLayerOf = new Map(layerOf);
  const dummyIdsByEdge = new Map<string, string[]>();

  for (const e of edges) {
    const [ls, lt] = reversed.has(e.id)
      ? [layerOf.get(e.target), layerOf.get(e.source)]
      : [layerOf.get(e.source), layerOf.get(e.target)];
    // Oriented source and target ids (in ascending layer direction).
    const [oS, oT] = reversed.has(e.id)
      ? [e.target, e.source]
      : [e.source, e.target];
    if (ls === undefined || lt === undefined) {
      augmentedEdges.push(e);
      continue;
    }
    const span = lt - ls;
    if (span <= 1) {
      augmentedEdges.push(e);
      continue;
    }
    // k = span - 1 dummies at layers ls+1..lt-1, in ascending order.
    const ascending: string[] = [];
    for (let l = ls + 1; l <= lt - 1; l++) {
      const id = `${DUMMY_PREFIX}${e.id}__${l}`;
      ascending.push(id);
      augmentedNodes.push({
        id,
        width: DUMMY_NODE_SIZE,
        height: DUMMY_NODE_SIZE,
        dummy: true,
      });
      augmentedLayerOf.set(id, l);
    }
    // Chain sub-edges: (oS, d1), (d1, d2), ..., (dk, oT).
    // All ascending, so orderLayers/BK see them as non-reversed.
    let prev = oS;
    ascending.forEach((did, i) => {
      augmentedEdges.push({
        id: `${DUMMY_PREFIX}${e.id}__seg${i}`,
        source: prev,
        target: did,
      });
      prev = did;
    });
    augmentedEdges.push({
      id: `${DUMMY_PREFIX}${e.id}__segLast`,
      source: prev,
      target: oT,
    });
    // Store dummies in ORIGINAL source-to-target order.
    dummyIdsByEdge.set(
      e.id,
      reversed.has(e.id) ? [...ascending].reverse() : ascending,
    );
  }
  return { augmentedNodes, augmentedEdges, augmentedLayerOf, dummyIdsByEdge };
}

/**
 * Collect the ordered dummy positions for each split edge, keyed by
 * the original edge id. `positions` gives the ABSOLUTE center of each
 * dummy in the final geometry coordinate frame (the emitting caller
 * computes it there). Returned lists preserve the source-to-target
 * order from `splitLongSpanEdges`.
 */
export function harvestBendHints(
  dummyIdsByEdge: ReadonlyMap<string, readonly string[]>,
  positions: ReadonlyMap<string, Pt>,
): Map<string, Pt[]> {
  const out = new Map<string, Pt[]>();
  for (const [edgeId, ids] of dummyIdsByEdge) {
    const pts: Pt[] = [];
    for (const id of ids) {
      const p = positions.get(id);
      if (p !== undefined) pts.push(p);
    }
    if (pts.length > 0) out.set(edgeId, pts);
  }
  return out;
}

/**
 * Pick the compound parent a dummy should live under, given the
 * source and target endpoints' parents and an ancestor lookup.
 * `ancestorsOf(id)` returns the compound ancestry from the innermost
 * container OUT to the root (exclusive of the node itself); the root
 * is represented by `null` in this API (a top-level node has no
 * parent, i.e. its parent is `null`).
 *
 * Cases (in order):
 * - both endpoints share a compound ancestor: innermost shared;
 * - one endpoint at root, the other inside a compound: the compound;
 * - both endpoints at root: root (null);
 * - cross-sibling compounds: the nearest common ancestor (may be root).
 *
 * The current StructuralGraphInput has NO top-level nesting, so
 * every dummy in practice returns `null` here; the helper is landed
 * with the split so the nested case is a one-line callsite change
 * (rather than a re-plumb) when nesting arrives.
 */
export function chooseDummyParent(
  sParent: string | null,
  tParent: string | null,
  ancestorsOf: (id: string) => readonly (string | null)[],
): string | null {
  // Both at root: root.
  if (sParent === null && tParent === null) return null;
  // Single-root-scope endpoint: the other's container.
  if (sParent === null) return tParent;
  if (tParent === null) return sParent;
  // Both inside compounds: build ancestor chains INCLUDING each
  // parent (chains go innermost -> outermost, ending in null-root).
  const chainOf = (p: string): (string | null)[] => [p, ...ancestorsOf(p)];
  const sChain = chainOf(sParent);
  const tChain = chainOf(tParent);
  const tSet = new Set(tChain);
  // Innermost shared ancestor: first entry of sChain that appears in
  // tChain (walking innermost to outermost).
  for (const a of sChain) {
    if (tSet.has(a)) return a;
  }
  // No shared ancestor at all: fall back to root.
  return null;
}
