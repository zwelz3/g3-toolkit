/**
 * collapseByCluster / buildSubgraph: invariants, determinism, and the
 * scale budgets (Approach 1 of planning/large-graph-design.md).
 *
 * The perf assertions use generous ceilings (multiples of measured
 * sandbox times) because their job is catching catastrophic
 * regressions (accidentally quadratic aggregation, detection running
 * twice), not micro-variance across CI runners.
 */
import { describe, it, expect } from "vitest";
import { UGM } from "../ugm/ugm";
import { collapseByCluster, buildSubgraph } from "./collapse-by-cluster";

/** Deterministic RNG (mulberry32). */
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

/**
 * Planted-partition graph: `k` communities of `size` nodes, dense
 * inside, sparse across; the ground truth Louvain should broadly
 * recover.
 */
function planted(k: number, size: number, seed = 42): UGM {
  const rng = mulberry32(seed);
  const ugm = new UGM();
  const types = ["Person", "System", "Document"];
  for (let c = 0; c < k; c++) {
    for (let i = 0; i < size; i++) {
      ugm.addNode(`n${c}-${i}`, {
        types: [types[c % types.length] ?? "node"],
        properties: { name: `n${c}-${i}`, community: `g${c}` },
      });
    }
  }
  for (let c = 0; c < k; c++) {
    for (let i = 0; i < size; i++) {
      // ~3 intra-community edges per node
      for (let e = 0; e < 3; e++) {
        const j = Math.floor(rng() * size);
        if (j !== i) ugm.addEdge(`n${c}-${i}`, `n${c}-${j}`, { type: "intra" });
      }
      // occasional inter-community edge
      if (rng() < 0.05) {
        const c2 = Math.floor(rng() * k);
        if (c2 !== c) {
          ugm.addEdge(`n${c}-${i}`, `n${c2}-0`, { type: "inter" });
        }
      }
    }
  }
  return ugm;
}

describe("collapseByCluster invariants", () => {
  it("passes small graphs through untouched", () => {
    const ugm = planted(2, 10);
    const res = collapseByCluster(ugm, { threshold: 2000 });
    expect(res.collapsed).toBe(false);
    expect(res.ugm).toBe(ugm);
    expect(res.members.size).toBe(0);
  });

  it("partitions every node exactly once and labels supernodes honestly", () => {
    const ugm = planted(8, 50); // 400 nodes
    const res = collapseByCluster(ugm, {
      threshold: 100,
      rng: mulberry32(7),
    });
    expect(res.collapsed).toBe(true);
    const total = [...res.members.values()].reduce((s, m) => s + m.length, 0);
    expect(total).toBe(400);
    const seen = new Set([...res.members.values()].flat());
    expect(seen.size).toBe(400); // no node in two supernodes
    for (const [superId, ids] of res.members) {
      const node = res.ugm.getNode(superId);
      expect(node?.types).toEqual(["Cluster"]);
      expect(node?.properties.memberCount).toBe(ids.length);
      // The label is a bare name; the count is data on memberCount
      // (embedding it in the label caused double-rendered counts).
      expect(String(node?.properties.name)).not.toContain("(");
      expect(String(node?.properties.name)).toMatch(/cluster/i);
      // Review 5.14: the dominant member type is a first-class
      // property so consumers can drive a categorical encoding.
      expect(typeof node?.properties.dominantType).toBe("string");
    }
    // Review 5.12: labels disambiguate via the top-degree member, so
    // same-type-mix communities never collapse to identical names.
    const names = [...res.members.keys()].map((id) =>
      String(res.ugm.getNode(id)?.properties.name),
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it("is deterministic for a fixed rng seed", () => {
    const a = collapseByCluster(planted(8, 50), {
      threshold: 100,
      rng: mulberry32(7),
    });
    const b = collapseByCluster(planted(8, 50), {
      threshold: 100,
      rng: mulberry32(7),
    });
    expect([...a.members.keys()].sort()).toEqual([...b.members.keys()].sort());
    for (const [k, v] of a.members) {
      expect(b.members.get(k)?.slice().sort()).toEqual(v.slice().sort());
    }
  });

  it("honors the property-driven path and recovers the planted partition exactly", () => {
    const ugm = planted(6, 40);
    const res = collapseByCluster(ugm, {
      threshold: 100,
      clusterProperty: "community",
    });
    expect(res.members.size).toBe(6);
    for (const ids of res.members.values()) expect(ids.length).toBe(40);
  });

  it("pools the smallest communities under the supernode ceiling", () => {
    const ugm = planted(10, 30);
    const res = collapseByCluster(ugm, {
      threshold: 100,
      clusterProperty: "community",
      maxSupernodes: 4,
    });
    expect(res.members.size).toBe(4);
    expect(res.members.has("cluster:other")).toBe(true);
    const total = [...res.members.values()].reduce((s, m) => s + m.length, 0);
    expect(total).toBe(300);
    expect(String(res.ugm.getNode("cluster:other")?.properties.name)).toContain(
      "Other clusters",
    );
  });

  it("aggregates inter-cluster edges into weighted links and drops intra edges", () => {
    const ugm = planted(4, 30, 11);
    const res = collapseByCluster(ugm, {
      threshold: 10,
      clusterProperty: "community",
    });
    let links = 0;
    res.ugm.forEachEdge?.((..._args: unknown[]) => {
      links += 1;
    });
    // Count via node edges if forEachEdge is unavailable on UGM.
    if (links === 0) {
      const seen = new Set<string>();
      res.ugm.forEachNode((id) => {
        for (const e of res.ugm.getNodeEdges(id)) seen.add(e);
      });
      links = seen.size;
    }
    expect(links).toBeGreaterThan(0);
    // Every link carries the aggregated weight and the cluster-link type.
    res.ugm.forEachNode((id) => {
      for (const e of res.ugm.getNodeEdges(id)) {
        const edge = res.ugm.getEdge(e);
        expect(edge?.type).toBe("cluster-link");
        expect(Number(edge?.properties.weight)).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

describe("buildSubgraph (drill-in)", () => {
  it("returns the induced subgraph with only internal edges", () => {
    const ugm = planted(4, 30, 5);
    const res = collapseByCluster(ugm, {
      threshold: 10,
      clusterProperty: "community",
    });
    const ids = res.members.get("cluster:g0");
    expect(ids).toBeDefined();
    const sub = buildSubgraph(ugm, ids ?? []);
    expect(sub.truncated).toBe(false);
    expect(sub.ugm.getNodeIds().length).toBe(30);
    sub.ugm.forEachNode((id) => {
      for (const e of sub.ugm.getNodeEdges(id)) {
        const ends = sub.ugm.getEdgeEndpoints(e);
        expect(ids).toContain(ends?.source);
        expect(ids).toContain(ends?.target);
      }
    });
  });

  it("caps the working set and reports truncation", () => {
    const ugm = planted(1, 200, 3);
    const sub = buildSubgraph(ugm, ugm.getNodeIds(), 50);
    expect(sub.truncated).toBe(true);
    expect(sub.ugm.getNodeIds().length).toBe(50);
  });
});

describe("scale budgets (8,000 nodes)", () => {
  it("generates, detects, and collapses within the stated budgets", () => {
    const t0 = performance.now();
    const ugm = planted(40, 200, 99); // 8,000 nodes, ~25k edge attempts
    const tGen = performance.now() - t0;

    const t1 = performance.now();
    const res = collapseByCluster(ugm, {
      threshold: 2000,
      rng: mulberry32(99),
    });
    const tCollapse = performance.now() - t1;

    expect(res.collapsed).toBe(true);
    expect(res.ugm.getNodeIds().length).toBeLessThanOrEqual(200);
    const total = [...res.members.values()].reduce((s, m) => s + m.length, 0);
    expect(total).toBe(8000);

    // Budgets: catastrophic-regression ceilings, not micro-benchmarks.
    expect(tGen).toBeLessThan(3000);
    expect(tCollapse).toBeLessThan(8000);
  });
});
