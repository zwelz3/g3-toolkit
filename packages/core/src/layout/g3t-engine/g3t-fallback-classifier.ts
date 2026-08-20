/**
 * PRF-003 (brief 05a, owner Jake, 2026-08-14): fallback classifier.
 *
 * Algorithmic, not by-example: an edge routes via `routeOrthogonal`
 * iff it satisfies at least one condition, all verifiable from the
 * layered graph WITHOUT running any routing.
 *
 *   a. Same-layer edge: source.layer === target.layer.
 *   b. Anti-monotone edge: the shortest path from source layer to
 *      target layer in the layer-adjacency graph requires a step
 *      opposite to the dominant layout flow (a backward arc).
 *   c. Compound-boundary edge: the route AABB (axis-aligned bbox of
 *      source endpoint to target endpoint) overlaps at least one
 *      compound container's bbox, AND that container is not a shared
 *      ancestor of both endpoints. Ambiguous multi-nested cases
 *      classify as fallback conservatively.
 *
 * The classifier ships as a pure function. 05a does NOT change the
 * nudging call site; 05b consumes this to narrow nudging to
 * fallback+mixed-mode edges only.
 */

export interface FallbackNodeInfo {
  id: string;
  /** Layer index from `layersFor`; `undefined` when the node is not
   *  layered (rare: pass 0 as a safe default). */
  layer: number;
  /** Compound parent id, `null` for top-level nodes. */
  parent: string | null;
  /** Node bounding box in the layout coordinate frame. */
  bbox: { x: number; y: number; width: number; height: number };
}

export interface FallbackEdge {
  id: string;
  source: string;
  target: string;
}

export type FallbackReason =
  | "same-layer"
  | "anti-monotone"
  | "compound-boundary";

export interface FallbackClassification {
  /** Edge ids that must route as fallback (routeOrthogonal), with the
   *  first condition that fired (5a > 5b > 5c evaluation order). */
  edges: Map<string, FallbackReason>;
}

/** True when two AABBs overlap (touching on a border does NOT count).
 *  Kept in-module so callers do not depend on the router's box type. */
function aabbOverlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Ancestors of `id` from immediate parent OUT to root (exclusive of
 *  the node itself). */
function ancestorChain(
  id: string,
  parentOf: ReadonlyMap<string, string | null>,
): (string | null)[] {
  const out: (string | null)[] = [];
  let cur: string | null = parentOf.get(id) ?? null;
  const seen = new Set<string>();
  while (cur !== null) {
    if (seen.has(cur)) break;
    seen.add(cur);
    out.push(cur);
    cur = parentOf.get(cur) ?? null;
  }
  out.push(null);
  return out;
}

function isSharedAncestor(
  container: string,
  sourceId: string,
  targetId: string,
  parentOf: ReadonlyMap<string, string | null>,
): boolean {
  const sChain = new Set<string | null>(ancestorChain(sourceId, parentOf));
  const tChain = new Set<string | null>(ancestorChain(targetId, parentOf));
  return sChain.has(container) && tChain.has(container);
}

/**
 * Classify each edge against the three-condition rule set. Evaluation
 * order matches the enum declaration (same-layer > anti-monotone >
 * compound-boundary): an edge that fires 5a is labeled "same-layer"
 * without checking 5b/5c, so the tag reads as the FIRST reason that
 * fired.
 */
export function classifyFallback(
  edges: readonly FallbackEdge[],
  nodes: readonly FallbackNodeInfo[],
  direction: "RIGHT" | "LEFT" | "DOWN" | "UP",
): FallbackClassification {
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const parentOf = new Map<string, string | null>(
    nodes.map((n) => [n.id, n.parent] as const),
  );
  // Dominant flow: RIGHT/DOWN = ascending layer index is forward; LEFT/
  // UP = descending is forward. Under RIGHT/DOWN a backward arc has
  // target.layer < source.layer; the layer-adjacency shortest path
  // between endpoints follows layer indices monotonically in the
  // acyclic case, so "requires a step opposite to the dominant flow"
  // reduces to "source and target ordering violates the flow sign".
  const forwardAscending = direction === "RIGHT" || direction === "DOWN";

  const containers = nodes.filter((n) => nodes.some((c) => c.parent === n.id));

  const out = new Map<string, FallbackReason>();
  for (const e of edges) {
    const s = nodeById.get(e.source);
    const t = nodeById.get(e.target);
    if (s === undefined || t === undefined) continue;
    // 5a: same layer.
    if (s.layer === t.layer) {
      out.set(e.id, "same-layer");
      continue;
    }
    // 5b: anti-monotone (backward arc against dominant flow).
    const forward = forwardAscending ? t.layer > s.layer : t.layer < s.layer;
    if (!forward) {
      out.set(e.id, "anti-monotone");
      continue;
    }
    // 5c: compound-boundary. Build the route AABB from the two
    // endpoints' node bboxes (their centers span the widest AABB the
    // route could inhabit). Test against each container's bbox; if any
    // overlaps AND that container is not a shared ancestor of both
    // endpoints, this is a compound-boundary edge.
    const rx1 = Math.min(s.bbox.x, t.bbox.x);
    const ry1 = Math.min(s.bbox.y, t.bbox.y);
    const rx2 = Math.max(s.bbox.x + s.bbox.width, t.bbox.x + t.bbox.width);
    const ry2 = Math.max(s.bbox.y + s.bbox.height, t.bbox.y + t.bbox.height);
    const routeAABB = { x: rx1, y: ry1, width: rx2 - rx1, height: ry2 - ry1 };
    let hit = false;
    let ambiguous = 0;
    for (const c of containers) {
      if (c.id === e.source || c.id === e.target) continue;
      if (!aabbOverlaps(routeAABB, c.bbox)) continue;
      if (isSharedAncestor(c.id, e.source, e.target, parentOf)) continue;
      hit = true;
      ambiguous++;
    }
    // Ambiguous (multiple non-shared containers overlap): classify as
    // fallback conservatively (per brief 05a design step 5c).
    if (hit || ambiguous > 1) {
      out.set(e.id, "compound-boundary");
      continue;
    }
  }
  return { edges: out };
}
