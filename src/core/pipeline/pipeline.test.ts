/**
 * DataPipeline tests (M11.E1.T1 + T2).
 *
 * Tests cover:
 * - PipelineRegistry CRUD operations
 * - Each built-in pipeline function
 * - reverseMap for bidirectional selection
 * - OLS trend line computation
 * - Edge cases (empty UGM, missing properties)
 */

import { describe, it, expect } from "vitest";
import { UGM } from "@core/ugm";
import {
  PipelineRegistry,
  createCountByType,
  createCountByProperty,
  createDegreeDistribution,
  createEdgeTypeBreakdown,
  createPropertyCorrelation,
  createCentralityVsProperty,
  createActivityTimeline,
  createCommunityBreakdown,
} from "./pipeline";
import type {
  CategoricalSelection,
  PointSetSelection,
  RangeSelection,
} from "./pipeline";

// ── Helpers ─────────────────────────────────────────────────────────

function makeTestUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", {
    types: ["Person"],
    properties: { name: "Alice", risk: 0.9, score: 80 },
  });
  ugm.addNode("p2", {
    types: ["Person"],
    properties: { name: "Bob", risk: 0.3, score: 40 },
  });
  ugm.addNode("p3", {
    types: ["Person"],
    properties: { name: "Carol", risk: 0.7, score: 65 },
  });
  ugm.addNode("o1", {
    types: ["Organization"],
    properties: { name: "Acme", risk: 0.5, score: 90 },
  });
  ugm.addNode("o2", {
    types: ["Organization"],
    properties: { name: "Globex", risk: 0.8, score: 70 },
  });
  ugm.addNode("l1", {
    types: ["Location"],
    properties: { name: "NYC", risk: 0.1 },
  });

  ugm.addEdge("p1", "o1", { type: "worksAt" });
  ugm.addEdge("p2", "o1", { type: "worksAt" });
  ugm.addEdge("p3", "o2", { type: "worksAt" });
  ugm.addEdge("p1", "p2", { type: "knows" });
  ugm.addEdge("p1", "l1", { type: "livesIn" });
  return ugm;
}

// ── PipelineRegistry (M11.E1.T1) ────────────────────────────────────

describe("PipelineRegistry", () => {
  it("registers and retrieves pipelines", () => {
    const registry = new PipelineRegistry();
    const pipeline = createCountByType();
    registry.register(pipeline);
    expect(registry.get("count-by-type")).toBeDefined();
    expect(registry.get("count-by-type")?.name).toBe("Node Count by Type");
  });

  it("lists all registered pipelines", () => {
    const registry = new PipelineRegistry();
    registry.register(createCountByType());
    registry.register(createDegreeDistribution());
    expect(registry.list()).toHaveLength(2);
  });

  it("removes a pipeline", () => {
    const registry = new PipelineRegistry();
    registry.register(createCountByType());
    expect(registry.remove("count-by-type")).toBe(true);
    expect(registry.get("count-by-type")).toBeUndefined();
  });

  it("returns undefined for unknown ID", () => {
    const registry = new PipelineRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });
});

// ── countByType ─────────────────────────────────────────────────────

describe("createCountByType", () => {
  it("groups nodes by primary type", () => {
    const ugm = makeTestUGM();
    const pipeline = createCountByType();
    const data = pipeline.query(ugm);

    expect(data.categories).toHaveLength(3);
    const person = data.categories.find((c) => c.label === "Person");
    expect(person?.count).toBe(3);
    expect(person?.nodeIds).toHaveLength(3);

    const org = data.categories.find((c) => c.label === "Organization");
    expect(org?.count).toBe(2);
  });

  it("reverseMap returns correct node IDs", () => {
    const ugm = makeTestUGM();
    const pipeline = createCountByType();
    const data = pipeline.query(ugm);

    const sel: CategoricalSelection = {
      type: "categorical",
      category: "Person",
    };
    const ids = pipeline.reverseMap(sel, data);
    expect(ids).toHaveLength(3);
    expect(ids).toContain("p1");
  });

  it("handles empty UGM", () => {
    const ugm = new UGM();
    const data = createCountByType().query(ugm);
    expect(data.categories).toHaveLength(0);
  });
});

// ── countByProperty ─────────────────────────────────────────────────

describe("createCountByProperty", () => {
  it("groups by a string property", () => {
    const ugm = makeTestUGM();
    const pipeline = createCountByProperty("name");
    const data = pipeline.query(ugm);
    expect(data.categories.length).toBeGreaterThanOrEqual(6);
    const alice = data.categories.find((c) => c.label === "Alice");
    expect(alice?.nodeIds).toEqual(["p1"]);
  });
});

// ── degreeDistribution ──────────────────────────────────────────────

describe("createDegreeDistribution", () => {
  it("computes degree histogram", () => {
    const ugm = makeTestUGM();
    const pipeline = createDegreeDistribution();
    const data = pipeline.query(ugm);

    // p1 has degree 4 (worksAt + knows + livesIn + knows-reverse... depends on undirected)
    expect(data.categories.length).toBeGreaterThan(0);

    // All node IDs should be present across all categories
    const allIds = data.categories.flatMap((c) => c.nodeIds);
    expect(allIds).toContain("p1");
    expect(allIds).toContain("l1");
  });

  it("reverseMap selects nodes with specific degree", () => {
    const ugm = makeTestUGM();
    const pipeline = createDegreeDistribution();
    const data = pipeline.query(ugm);

    const firstCat = data.categories[0]!;
    const sel: CategoricalSelection = {
      type: "categorical",
      category: firstCat.label,
    };
    const ids = pipeline.reverseMap(sel, data);
    expect(ids.length).toBeGreaterThan(0);
  });
});

// ── edgeTypeBreakdown ───────────────────────────────────────────────

describe("createEdgeTypeBreakdown", () => {
  it("counts edges by type", () => {
    const ugm = makeTestUGM();
    const data = createEdgeTypeBreakdown().query(ugm);

    const worksAt = data.categories.find((c) => c.label === "worksAt");
    expect(worksAt?.count).toBe(3);

    const knows = data.categories.find((c) => c.label === "knows");
    expect(knows?.count).toBe(1);
  });
});

// ── propertyCorrelation (with OLS) ──────────────────────────────────

describe("createPropertyCorrelation", () => {
  it("produces scatter points from two numeric properties", () => {
    const ugm = makeTestUGM();
    const pipeline = createPropertyCorrelation("risk", "score");
    const data = pipeline.query(ugm);

    // Only nodes with both risk AND score (l1 has no score)
    expect(data.points.length).toBe(5);
    expect(data.points[0]?.nodeId).toBeDefined();
  });

  it("computes OLS trend line", () => {
    const ugm = makeTestUGM();
    const data = createPropertyCorrelation("risk", "score").query(ugm);

    expect(data.trend).toBeDefined();
    expect(typeof data.trend?.slope).toBe("number");
    expect(typeof data.trend?.intercept).toBe("number");
    expect(typeof data.trend?.r2).toBe("number");
    expect(data.trend?.r2).toBeGreaterThanOrEqual(0);
    expect(data.trend?.r2).toBeLessThanOrEqual(1);
  });

  it("predict function works", () => {
    const ugm = makeTestUGM();
    const data = createPropertyCorrelation("risk", "score").query(ugm);

    const predicted = data.trend?.predict(0.5);
    expect(typeof predicted).toBe("number");
  });

  it("reverseMap returns selected point nodeIds", () => {
    const ugm = makeTestUGM();
    const pipeline = createPropertyCorrelation("risk", "score");
    const data = pipeline.query(ugm);

    const sel: PointSetSelection = { type: "point-set", indices: [0, 1] };
    const ids = pipeline.reverseMap(sel, data);
    expect(ids).toHaveLength(2);
  });

  it("handles nodes with missing numeric properties", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { x: 1 } }); // no y
    ugm.addNode("b", { types: ["X"], properties: { y: 2 } }); // no x

    const data = createPropertyCorrelation("x", "y").query(ugm);
    expect(data.points).toHaveLength(0); // neither has both
  });

  it("no trend when fewer than 2 points", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { x: 1, y: 2 } });

    const data = createPropertyCorrelation("x", "y").query(ugm);
    expect(data.points).toHaveLength(1);
    expect(data.trend).toBeUndefined();
  });
});

// ── activityTimeline ────────────────────────────────────────────────

describe("createActivityTimeline", () => {
  it("buckets events by time", () => {
    const ugm = new UGM();
    ugm.addNode("e1", { types: ["Event"], properties: { date: "2025-01-15" } });
    ugm.addNode("e2", { types: ["Event"], properties: { date: "2025-03-10" } });
    ugm.addNode("e3", { types: ["Event"], properties: { date: "2025-06-22" } });
    ugm.addNode("e4", { types: ["Event"], properties: { date: "2025-09-01" } });

    const pipeline = createActivityTimeline("date");
    const data = pipeline.query(ugm);

    expect(data.series.length).toBeGreaterThan(0);
    const totalNodes = data.series.reduce(
      (sum, s) => sum + s.nodeIds.length,
      0,
    );
    expect(totalNodes).toBe(4);
  });

  it("reverseMap selects nodes in time range", () => {
    const ugm = new UGM();
    ugm.addNode("e1", { types: ["Event"], properties: { date: "2025-01-01" } });
    ugm.addNode("e2", { types: ["Event"], properties: { date: "2025-12-31" } });

    const pipeline = createActivityTimeline("date");
    const data = pipeline.query(ugm);

    const sel: RangeSelection = {
      type: "range",
      min: new Date("2025-01-01").getTime(),
      max: new Date("2025-06-30").getTime(),
    };
    const ids = pipeline.reverseMap(sel, data);
    expect(ids).toContain("e1");
  });

  it("handles empty UGM", () => {
    const ugm = new UGM();
    const data = createActivityTimeline("date").query(ugm);
    expect(data.series).toHaveLength(0);
  });

  it("handles numeric timestamps", () => {
    const ugm = new UGM();
    ugm.addNode("e1", { types: ["Event"], properties: { ts: 1000 } });
    ugm.addNode("e2", { types: ["Event"], properties: { ts: 2000 } });

    const data = createActivityTimeline("ts").query(ugm);
    expect(data.series.length).toBeGreaterThan(0);
  });
});

// ── communityBreakdown ──────────────────────────────────────────────

describe("createCommunityBreakdown", () => {
  it("groups by community ID property", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { community: "c1" } });
    ugm.addNode("b", { types: ["X"], properties: { community: "c1" } });
    ugm.addNode("c", { types: ["X"], properties: { community: "c2" } });

    const data = createCommunityBreakdown("community").query(ugm);
    const c1 = data.categories.find((c) => c.label === "c1");
    expect(c1?.count).toBe(2);
    expect(c1?.nodeIds).toContain("a");
  });
});
