/**
 * Crossing-aware placement optimizer (brief 22, A54).
 *
 * A pure, bounded, deterministic hill-climb that repositions point-nodes
 * to reduce STRAIGHT-LINE edge crossings. The objective is the same
 * countCrossings oracle used everywhere else in the toolkit, evaluated
 * on 2-point polylines between node centers; the downstream orthogonal
 * router turns the accepted geometry into orthogonal routes, so
 * optimizing straight-line crossings is the right proxy.
 *
 * Contract:
 *   - Pure: input arrays are never mutated; a fresh position Map is
 *     returned.
 *   - Node id set is preserved (reposition only), so callers can apply
 *     positions without breaking the canvas "same input graph" contract.
 *   - Deterministic for a fixed seed.
 *   - Wall-clock bounded: default 350 ms (A54 budget).
 */

import { countCrossings, type MetricsEdge } from "../metrics/layout-metrics";

export interface PlacementNode {
  id: string;
  /** Box top-left, matching MetricsNode/StructuralNodeGeometry. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacementEdge {
  id: string;
  source: string;
  target: string;
}

export interface OptimizePlacementOptions {
  /** Hard wall-clock ceiling in milliseconds. Default 350 (A54). */
  budgetMs?: number;
  /** Seed for the internal RNG so runs are deterministic. Default 1. */
  seed?: number;
  /** Max candidate iterations regardless of budget. Default 2000. */
  maxIterations?: number;
  /** Stop after this many consecutive non-improving iterations. Default 200. */
  noImproveStreak?: number;
}

export interface PlacementResult {
  /** New positions keyed by node id (box TOP-LEFT, same convention as input). */
  positions: Map<string, { x: number; y: number }>;
  crossingsBefore: number;
  crossingsAfter: number;
  iterations: number;
  elapsedMs: number;
  /** true when crossingsAfter <= crossingsBefore. */
  improved: boolean;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function now(): number {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

interface NodeState {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

function centerOf(n: NodeState): { x: number; y: number } {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
}

function buildMetricsEdges(
  nodes: Map<string, NodeState>,
  edges: readonly PlacementEdge[],
): MetricsEdge[] {
  const out: MetricsEdge[] = [];
  for (const e of edges) {
    const s = nodes.get(e.source);
    const t = nodes.get(e.target);
    if (!s || !t) continue;
    out.push({ id: e.id, points: [centerOf(s), centerOf(t)] });
  }
  return out;
}

/** Ids incident to at least one crossing (straight-line proxy). */
function crossedNodeIds(
  nodes: Map<string, NodeState>,
  edges: readonly PlacementEdge[],
): string[] {
  const metricsEdges = buildMetricsEdges(nodes, edges);
  const edgeToNodes = new Map<string, [string, string]>();
  for (const e of edges) edgeToNodes.set(e.id, [e.source, e.target]);

  const crossed = new Set<string>();
  // Reuse segmentsCross via a per-pair check: countCrossings only returns
  // a total, so we redo the O(E^2) walk here for endpoint attribution.
  for (let i = 0; i < metricsEdges.length; i++) {
    for (let j = i + 1; j < metricsEdges.length; j++) {
      const a = metricsEdges[i];
      const b = metricsEdges[j];
      if (!a || !b) continue;
      // Single-segment polylines, so a one-pair countCrossings works
      // and reuses the shared segmentsCross geometry.
      if (countCrossings([a, b]) > 0) {
        const ae = edgeToNodes.get(a.id);
        const be = edgeToNodes.get(b.id);
        if (ae) {
          crossed.add(ae[0]);
          crossed.add(ae[1]);
        }
        if (be) {
          crossed.add(be[0]);
          crossed.add(be[1]);
        }
      }
    }
  }
  return [...crossed];
}

export function optimizePlacement(
  nodes: readonly PlacementNode[],
  edges: readonly PlacementEdge[],
  opts: OptimizePlacementOptions = {},
): PlacementResult {
  const budgetMs = opts.budgetMs ?? 350;
  const maxIterations = opts.maxIterations ?? 2000;
  const seed = opts.seed ?? 1;
  const noImproveCap = opts.noImproveStreak ?? 200;

  const start = now();

  // Seed state (copy; never mutate input).
  const state = new Map<string, NodeState>();
  for (const n of nodes) {
    state.set(n.id, {
      id: n.id,
      width: n.width,
      height: n.height,
      x: n.x,
      y: n.y,
    });
  }
  const ids = [...state.keys()];

  // Neighbor adjacency for centroid moves.
  const neighbors = new Map<string, string[]>();
  for (const id of ids) neighbors.set(id, []);
  for (const e of edges) {
    if (e.source === e.target) continue;
    const s = neighbors.get(e.source);
    const t = neighbors.get(e.target);
    if (s && state.has(e.target)) s.push(e.target);
    if (t && state.has(e.source)) t.push(e.source);
  }

  const initialEdges = buildMetricsEdges(state, edges);
  const crossingsBefore = countCrossings(initialEdges);

  // Trivial early-out: already clean or nothing to move.
  if (crossingsBefore === 0 || ids.length < 2 || edges.length === 0) {
    const positions = new Map<string, { x: number; y: number }>();
    for (const n of state.values()) positions.set(n.id, { x: n.x, y: n.y });
    return {
      positions,
      crossingsBefore,
      crossingsAfter: crossingsBefore,
      iterations: 0,
      elapsedMs: now() - start,
      improved: true,
    };
  }

  const rng = mulberry32(seed);

  // Best-seen positions.
  const best = new Map<string, { x: number; y: number }>();
  for (const n of state.values()) best.set(n.id, { x: n.x, y: n.y });
  let bestCrossings = crossingsBefore;

  let iterations = 0;
  let noImprove = 0;

  while (iterations < maxIterations && noImprove < noImproveCap) {
    if (now() - start >= budgetMs) break;
    iterations++;

    const crossed = crossedNodeIds(state, edges);
    if (crossed.length === 0) break;

    const pick = crossed[Math.floor(rng() * crossed.length)];
    if (!pick) break;
    const node = state.get(pick);
    if (!node) break;

    // Candidate move: swap with a random other node OR relocate to the
    // centroid of graph neighbors. Coin flip via rng.
    const useCentroid = rng() < 0.5;
    const backup: { x: number; y: number } = { x: node.x, y: node.y };
    let swappedId: string | null = null;
    let swappedBackup: { x: number; y: number } | null = null;

    if (useCentroid) {
      const nb = neighbors.get(pick) ?? [];
      if (nb.length === 0) {
        // Fall through to swap when isolated (still incident via
        // parallel edges is uncommon; skip iteration if truly alone).
        continue;
      }
      let cx = 0;
      let cy = 0;
      for (const nid of nb) {
        const p = state.get(nid);
        if (!p) continue;
        cx += p.x + p.width / 2;
        cy += p.y + p.height / 2;
      }
      cx /= nb.length;
      cy /= nb.length;
      // Convert center back to top-left.
      node.x = cx - node.width / 2;
      node.y = cy - node.height / 2;
    } else {
      // Pick another random node to swap centers with.
      if (ids.length < 2) continue;
      let otherIdx = Math.floor(rng() * ids.length);
      if (ids[otherIdx] === pick) otherIdx = (otherIdx + 1) % ids.length;
      const otherId = ids[otherIdx];
      if (!otherId) continue;
      const other = state.get(otherId);
      if (!other) continue;
      swappedId = otherId;
      swappedBackup = { x: other.x, y: other.y };
      const nodeCenter = centerOf(node);
      const otherCenter = centerOf(other);
      node.x = otherCenter.x - node.width / 2;
      node.y = otherCenter.y - node.height / 2;
      other.x = nodeCenter.x - other.width / 2;
      other.y = nodeCenter.y - other.height / 2;
    }

    const candidate = countCrossings(buildMetricsEdges(state, edges));

    if (candidate < bestCrossings) {
      bestCrossings = candidate;
      for (const n of state.values()) best.set(n.id, { x: n.x, y: n.y });
      noImprove = 0;
    } else {
      // Reject: roll back.
      node.x = backup.x;
      node.y = backup.y;
      if (swappedId && swappedBackup) {
        const other = state.get(swappedId);
        if (other) {
          other.x = swappedBackup.x;
          other.y = swappedBackup.y;
        }
      }
      noImprove++;
    }
  }

  return {
    positions: best,
    crossingsBefore,
    crossingsAfter: bestCrossings,
    iterations,
    elapsedMs: now() - start,
    improved: bestCrossings <= crossingsBefore,
  };
}
