/**
 * M13 tests: PROV-O extraction, DerivedPropertyEngine, subgraph pinning.
 */

import { describe, it, expect } from "vitest";
import { UGM } from "../ugm";
import {
  extractProvOProperties,
  DerivedPropertyEngine,
  pinNodes,
  unpinAll,
} from "./advanced";
import { createViewFilter, applyViewFilter, hideSelected } from "../filter";

// ── PROV-O Property Extraction (M13.E2.T1) ──────────────────────────

describe("extractProvOProperties", () => {
  it("maps prov:startedAtTime to temporal_start", () => {
    const ugm = new UGM();
    ugm.addNode("e1", {
      types: ["Activity"],
      properties: { "prov:startedAtTime": "2025-01-15T10:00:00Z" },
    });
    extractProvOProperties(ugm);
    expect(ugm.getNode("e1")?.properties.temporal_start).toBe(
      "2025-01-15T10:00:00Z",
    );
  });

  it("maps prov:endedAtTime to temporal_end", () => {
    const ugm = new UGM();
    ugm.addNode("e1", {
      types: ["Activity"],
      properties: { "prov:endedAtTime": "2025-01-15T18:00:00Z" },
    });
    extractProvOProperties(ugm);
    expect(ugm.getNode("e1")?.properties.temporal_end).toBe(
      "2025-01-15T18:00:00Z",
    );
  });

  it("maps shorthand property names", () => {
    const ugm = new UGM();
    ugm.addNode("e1", {
      types: ["Activity"],
      properties: { startedAtTime: "2025-06-01" },
    });
    extractProvOProperties(ugm);
    expect(ugm.getNode("e1")?.properties.temporal_start).toBe("2025-06-01");
  });

  it("does not overwrite existing temporal properties", () => {
    const ugm = new UGM();
    ugm.addNode("e1", {
      types: ["Activity"],
      properties: {
        "prov:startedAtTime": "2025-01-01",
        temporal_start: "already-set",
      },
    });
    extractProvOProperties(ugm);
    expect(ugm.getNode("e1")?.properties.temporal_start).toBe("already-set");
  });

  it("handles nodes without PROV-O properties", () => {
    const ugm = new UGM();
    ugm.addNode("n1", { types: ["Person"], properties: { name: "Alice" } });
    extractProvOProperties(ugm); // should not throw
    expect(ugm.getNode("n1")?.properties.name).toBe("Alice");
  });
});

// ── DerivedPropertyEngine (M13.E3.T1) ───────────────────────────────

describe("DerivedPropertyEngine", () => {
  it("computes a simple arithmetic derived property", () => {
    const ugm = new UGM();
    ugm.addNode("n1", { types: ["X"], properties: { risk: 0.8, score: 60 } });
    ugm.addNode("n2", { types: ["X"], properties: { risk: 0.3, score: 90 } });

    const engine = new DerivedPropertyEngine();
    engine.define({
      name: "combined",
      expression: "risk * 100 + score",
      reactive: false,
    });
    engine.compute(ugm);

    expect(ugm.getNode("n1")?.properties.combined).toBeCloseTo(140);
    expect(ugm.getNode("n2")?.properties.combined).toBeCloseTo(120);
  });

  it("handles missing properties gracefully", () => {
    const ugm = new UGM();
    ugm.addNode("n1", { types: ["X"], properties: { risk: 0.5 } }); // no "score"

    const engine = new DerivedPropertyEngine();
    engine.define({
      name: "result",
      expression: "risk * score",
      reactive: false,
    });
    engine.compute(ugm); // should not throw
    // Node n1 doesn't have "score" so expression fails silently
  });

  it("supports math functions (sqrt, max, min)", () => {
    const ugm = new UGM();
    ugm.addNode("n1", { types: ["X"], properties: { x: 16, y: 9 } });

    const engine = new DerivedPropertyEngine();
    engine.define({
      name: "sqrtX",
      expression: "sqrt(x)",
      reactive: false,
    });
    engine.compute(ugm);

    expect(ugm.getNode("n1")?.properties.sqrtX).toBeCloseTo(4);
  });

  it("replaces existing definition with same name", () => {
    const engine = new DerivedPropertyEngine();
    engine.define({ name: "a", expression: "x + 1", reactive: false });
    engine.define({ name: "a", expression: "x + 2", reactive: false });
    expect(engine.getDefinitions()).toHaveLength(1);
    expect(engine.getDefinitions()[0]?.expression).toBe("x + 2");
  });

  it("removes a definition", () => {
    const engine = new DerivedPropertyEngine();
    engine.define({ name: "a", expression: "x + 1", reactive: false });
    engine.remove("a");
    expect(engine.getDefinitions()).toHaveLength(0);
  });
});

// ── Subgraph Pinning (M13.E4.T3) ────────────────────────────────────

describe("Subgraph pinning", () => {
  it("pinned nodes remain visible when hidden", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: {} });
    ugm.addNode("b", { types: ["X"], properties: {} });
    ugm.addNode("c", { types: ["X"], properties: {} });

    let vf = createViewFilter();
    vf = pinNodes(vf, ["a"]);
    vf = hideSelected(new Set(["a", "b"]), vf);

    const { visibleNodes } = applyViewFilter(ugm, vf);
    expect(visibleNodes).toContain("a"); // pinned
    expect(visibleNodes).not.toContain("b"); // hidden, not pinned
    expect(visibleNodes).toContain("c"); // not hidden
  });

  it("unpinAll removes all pins", () => {
    let vf = createViewFilter();
    vf = pinNodes(vf, ["a", "b", "c"]);
    expect(vf.pinnedNodeIds.size).toBe(3);

    vf = unpinAll(vf);
    expect(vf.pinnedNodeIds.size).toBe(0);
  });

  it("pinning is additive", () => {
    let vf = createViewFilter();
    vf = pinNodes(vf, ["a"]);
    vf = pinNodes(vf, ["b"]);
    expect(vf.pinnedNodeIds.size).toBe(2);
  });
});

// ── Derivation stamps (issue #17) ───────────────────────────────────

describe("DerivedPropertyEngine: provenance stamps (issue #17)", () => {
  function graph(): UGM {
    const ugm = new UGM();
    ugm.addNode("n1", { types: ["X"], properties: { risk: 0.8, score: 60 } });
    ugm.addNode("n2", { types: ["X"], properties: { risk: 0.3 } });
    return ugm;
  }

  it("stamps every value it writes with the definition, version, time and expression", () => {
    const ugm = graph();
    const engine = new DerivedPropertyEngine();
    engine.define({
      name: "combined",
      expression: "risk * 100 + score",
      reactive: false,
    });
    engine.compute(ugm);

    const stamp = ugm.getDerivation("n1", "combined");
    expect(stamp).toMatchObject({
      definitionId: "combined",
      version: 1,
      expression: "risk * 100 + score",
    });
    expect(stamp?.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // n2 has no score, so no value was written and nothing is stamped.
    expect(ugm.getNode("n2")?.properties.combined).toBeUndefined();
    expect(ugm.getDerivation("n2", "combined")).toBeUndefined();
    // Source properties are never stamped.
    expect(ugm.getDerivation("n1", "risk")).toBeUndefined();
  });

  it("a source write after compute clears the stamp (the value is no longer derived)", () => {
    const ugm = graph();
    const engine = new DerivedPropertyEngine();
    engine.define({ name: "double", expression: "risk * 2", reactive: false });
    engine.compute(ugm);
    expect(ugm.getDerivation("n1", "double")).toBeDefined();
    ugm.updateNodeProperties("n1", { double: 42 });
    expect(ugm.getDerivation("n1", "double")).toBeUndefined();
    // Recomputing re-stamps it.
    engine.compute(ugm);
    expect(ugm.getDerivation("n1", "double")?.definitionId).toBe("double");
  });

  it("define bumps the version only when the expression changes; stale stamps are reported", () => {
    const ugm = graph();
    const engine = new DerivedPropertyEngine();
    engine.define({ name: "d", expression: "risk * 2", reactive: false });
    expect(engine.getVersion("d")).toBe(1);
    engine.define({ name: "d", expression: "risk * 2", reactive: true });
    expect(engine.getVersion("d")).toBe(1); // same rule, not a new version
    engine.compute(ugm);
    expect(engine.listStale(ugm)).toEqual([]);

    engine.define({ name: "d", expression: "risk * 3", reactive: false });
    expect(engine.getVersion("d")).toBe(2);
    const stale = engine.listStale(ugm);
    expect(stale.map((r) => [r.nodeId, r.property, r.stamp.version])).toEqual([
      ["n1", "d", 1],
      ["n2", "d", 1],
    ]);
    // The old value is still there, identifiable, until recomputed.
    expect(ugm.getNode("n1")?.properties.d).toBeCloseTo(1.6);

    engine.recompute(ugm, "d");
    expect(ugm.getNode("n1")?.properties.d).toBeCloseTo(2.4);
    expect(ugm.getDerivation("n1", "d")?.version).toBe(2);
    expect(engine.listStale(ugm)).toEqual([]);
  });

  it("remove keeps the counter, so a re-defined name continues monotonically", () => {
    const ugm = graph();
    const engine = new DerivedPropertyEngine();
    engine.define({ name: "d", expression: "risk", reactive: false });
    engine.compute(ugm);
    engine.remove("d");
    expect(engine.getVersion("d")).toBeUndefined();
    // Orphaned, not stale: no current rule to be behind.
    expect(engine.listStale(ugm)).toEqual([]);
    expect(ugm.listDerivations("n1")).toHaveLength(1);

    engine.define({ name: "d", expression: "risk + 1", reactive: false });
    expect(engine.getVersion("d")).toBe(2);
    expect(engine.listStale(ugm)).toHaveLength(2);
  });

  it("recompute of an unknown name is a no-op", () => {
    const ugm = graph();
    new DerivedPropertyEngine().recompute(ugm, "nope");
    expect(ugm.listDerivations()).toEqual([]);
  });
});
