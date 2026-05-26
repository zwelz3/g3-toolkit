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
