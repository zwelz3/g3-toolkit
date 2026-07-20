/**
 * Smart aggregation for large graphs (Approach 1 of the approved
 * large-graph design, planning/large-graph-design.md).
 *
 * collapseByCluster: when a UGM exceeds a threshold, group its nodes
 * into communities (Louvain detection, or a pre-computed membership
 * property) and return a supernode graph the renderer can handle:
 * each community becomes one "Cluster" node labeled with its size and
 * dominant types, and inter-community edges aggregate into weighted
 * cluster links. The full graph stays in the caller's UGM; the
 * collapse is a projection, not a mutation.
 *
 * buildSubgraph: the drill-in half. Given member ids (a supernode's
 * community), return the induced subgraph capped at a working-set
 * limit, so expanding a 5,000-member cluster cannot overwhelm the
 * renderer.
 *
 * Encapsulation note: UGM's graphology instance is deliberately
 * private, so detection builds a throwaway graphology graph from the
 * public iteration API (O(n+e), negligible next to Louvain itself).
 *
 * Determinism: Louvain shuffles node order; pass `rng` (any seeded
 * generator) for reproducible communities. Tests and the scale demo
 * do.
 *
 * @see planning/large-graph-design.md (decision record; Approach 4,
 * worker layout with viewport culling, is the sequel and is not
 * implemented here)
 */
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import { UGM } from "../ugm/ugm";

export interface CollapseByClusterOptions {
  /** Node count at or below which the input is returned uncollapsed. Default 2000. */
  threshold?: number;
  /** Ceiling on supernodes; smallest communities pool into one "other" supernode. Default 200. */
  maxSupernodes?: number;
  /**
   * Read community membership from this node property instead of
   * running detection (the design's pre-computed path; values are
   * grouped by string identity).
   */
  clusterProperty?: string;
  /** RNG for deterministic Louvain runs. */
  rng?: () => number;
  /** Louvain resolution (community granularity). */
  resolution?: number;
}

export interface CollapseResult {
  /** The supernode graph (or the input UGM when below threshold). */
  ugm: UGM;
  /** Supernode id -> member node ids. Empty when not collapsed. */
  members: Map<string, string[]>;
  /** Whether collapsing happened. */
  collapsed: boolean;
}

const OTHER_ID = "cluster:other";

export function collapseByCluster(
  ugm: UGM,
  options: CollapseByClusterOptions = {},
): CollapseResult {
  const threshold = options.threshold ?? 2000;
  const maxSupernodes = options.maxSupernodes ?? 200;

  const nodeIds = ugm.getNodeIds();
  if (nodeIds.length <= threshold) {
    return { ugm, members: new Map(), collapsed: false };
  }

  // 1. Membership: property-driven or detected.
  const membership = new Map<string, string>();
  if (options.clusterProperty !== undefined) {
    const key = options.clusterProperty;
    ugm.forEachNode((id, attrs) => {
      membership.set(id, String(attrs.properties[key] ?? "unclustered"));
    });
  } else {
    const g = new Graph({ multi: true });
    ugm.forEachNode((id) => g.addNode(id));
    ugm.forEachNode((id) => {
      for (const edgeId of ugm.getNodeEdges(id)) {
        const ends = ugm.getEdgeEndpoints(edgeId);
        if (ends && ends.source === id) g.addEdge(ends.source, ends.target);
      }
    });
    const communities = louvain(g, {
      resolution: options.resolution ?? 1,
      ...(options.rng !== undefined ? { rng: options.rng } : {}),
    });
    for (const [id, c] of Object.entries(communities)) {
      membership.set(id, `c${c}`);
    }
  }

  // 2. Group members per community.
  let groups = new Map<string, string[]>();
  for (const [id, c] of membership) {
    const arr = groups.get(c) ?? [];
    arr.push(id);
    groups.set(c, arr);
  }

  // 3. Enforce the supernode ceiling: keep the largest, pool the rest.
  if (groups.size > maxSupernodes) {
    const sorted = [...groups.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    );
    const kept = sorted.slice(0, maxSupernodes - 1);
    const pooled = sorted.slice(maxSupernodes - 1).flatMap(([, ids]) => ids);
    groups = new Map(kept);
    groups.set(OTHER_ID, pooled);
  }

  // 4. Build the supernode graph.
  const collapsed = new UGM();
  const members = new Map<string, string[]>();
  const superOf = new Map<string, string>();
  for (const [c, ids] of groups) {
    const superId = c === OTHER_ID ? OTHER_ID : `cluster:${c}`;
    members.set(superId, ids);
    for (const id of ids) superOf.set(id, superId);
    const breakdown = typeBreakdown(ugm, ids);
    const dominantType =
      Object.entries(breakdown).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0]?.[0] ?? "node";
    collapsed.addNode(superId, {
      types: ["Cluster"],
      properties: {
        memberCount: ids.length,
        typeBreakdown: JSON.stringify(breakdown),
        // The dominant member type as a first-class property, so
        // consumers can drive a categorical encoding from it
        // (review 5.14: an encoding change AT scale) without
        // re-parsing the breakdown JSON.
        dominantType,
        name: clusterLabel(superId, dominantType, ugm, ids),
      },
    });
  }

  // 5. Aggregate inter-cluster edges into weighted links.
  const weights = new Map<string, number>();
  ugm.forEachNode((id) => {
    for (const edgeId of ugm.getNodeEdges(id)) {
      const ends = ugm.getEdgeEndpoints(edgeId);
      if (!ends || ends.source !== id) continue;
      const a = superOf.get(ends.source);
      const b = superOf.get(ends.target);
      if (a === undefined || b === undefined || a === b) continue;
      const key = `${a}\u0000${b}`;
      weights.set(key, (weights.get(key) ?? 0) + 1);
    }
  });
  for (const [key, weight] of weights) {
    const [a, b] = key.split("\u0000");
    if (a !== undefined && b !== undefined) {
      collapsed.addEdge(a, b, {
        type: "cluster-link",
        properties: { weight },
      });
    }
  }

  return { ugm: collapsed, members, collapsed: true };
}

export interface SubgraphResult {
  ugm: UGM;
  /** True when memberIds exceeded the limit and the set was cut. */
  truncated: boolean;
}

/** Induced subgraph over memberIds, capped at `limit` nodes (drill-in). */
export function buildSubgraph(
  ugm: UGM,
  memberIds: readonly string[],
  limit = 1500,
): SubgraphResult {
  const truncated = memberIds.length > limit;
  const take = truncated ? memberIds.slice(0, limit) : [...memberIds];
  const keep = new Set(take);
  const sub = new UGM();
  for (const id of take) {
    const attrs = ugm.getNode(id);
    if (attrs) {
      sub.addNode(id, {
        types: [...attrs.types],
        properties: { ...attrs.properties },
      });
    }
  }
  for (const id of take) {
    for (const edgeId of ugm.getNodeEdges(id)) {
      const ends = ugm.getEdgeEndpoints(edgeId);
      const edge = ugm.getEdge(edgeId);
      if (!ends || !edge || ends.source !== id) continue;
      if (keep.has(ends.target)) {
        sub.addEdge(ends.source, ends.target, {
          type: edge.type,
          properties: { ...edge.properties },
        });
      }
    }
  }
  return { ugm: sub, truncated };
}

function typeBreakdown(
  ugm: UGM,
  ids: readonly string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const t = ugm.getNode(id)?.types[0] ?? "node";
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

function clusterLabel(
  superId: string,
  dominantType: string,
  ugm: UGM,
  ids: readonly string[],
): string {
  // The label is a NAME; the member count is data and rides the
  // memberCount property (size channel, panels). Embedding it here
  // caused double-rendered counts wherever a consumer also showed it.
  if (superId === OTHER_ID) return "Other clusters";
  // Review 5.12: dominant type alone collides whenever communities
  // share a type mix (a planted-partition graph has near-identical
  // breakdowns, so half the rail read "Service cluster"). The
  // highest-degree member is the distinguisher: communities are
  // disjoint, so its name is unique across clusters.
  let top: string | undefined;
  let topDeg = -1;
  for (const id of ids) {
    const d = ugm.getNodeEdges(id).length;
    if (d > topDeg) {
      topDeg = d;
      top = id;
    }
  }
  const topName = ugm.getNode(top ?? "")?.properties.name;
  return typeof topName === "string"
    ? `${dominantType} cluster around ${topName}`
    : `${dominantType} cluster`;
}
