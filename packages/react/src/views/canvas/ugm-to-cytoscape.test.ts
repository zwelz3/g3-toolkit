/**
 * Tests for the UGM -> Cytoscape element mapper, including the
 * compound containment mapping (slice 1, round 17).
 */

import { describe, it, expect } from "vitest";
import { UGM } from "@g3t/core";
import { ugmToCytoscapeElements } from "./ugm-to-cytoscape";

describe("compound containment mapping (slice 1, round 17)", () => {
  function containedGraph(): UGM {
    const ugm = new UGM();
    ugm.addNode("sys", { types: ["Block"], properties: { name: "System" } });
    ugm.addNode("sub", { types: ["Block"], properties: { name: "Nav" } });
    ugm.addNode("p1", { types: ["Part"], properties: { name: "IMU" } });
    ugm.addEdge("sys", "sub", { type: "contains", properties: {} });
    ugm.addEdge("sub", "p1", { type: "contains", properties: {} });
    ugm.addEdge("p1", "sys", { type: "reports", properties: {} });
    return ugm;
  }

  it("turns containment edges into parent assignments and omits them as edges", () => {
    const els = ugmToCytoscapeElements(containedGraph(), {
      containment: { edgeType: "contains", direction: "parentToChild" },
    });
    const byId = new Map(els.map((e) => [e.data.id as string, e]));
    expect(byId.get("sub")?.data.parent).toBe("sys");
    expect(byId.get("p1")?.data.parent).toBe("sub");
    expect(byId.get("sys")?.data.parent).toBeUndefined();
    const edges = els.filter((e) => e.group === "edges");
    expect(edges).toHaveLength(1);
    expect(edges[0]?.data.type).toBe("reports");
  });

  it("labels containers with the UML stereotype form", () => {
    const els = ugmToCytoscapeElements(containedGraph(), {
      containment: { edgeType: "contains", direction: "parentToChild" },
    });
    const sys = els.find((e) => e.data.id === "sys");
    expect(sys?.data._compoundLabel).toBe("\u00ABBlock\u00BB\nSystem");
    // Leaf nodes carry no compound label.
    const p1 = els.find((e) => e.data.id === "p1");
    expect(p1?.data._compoundLabel).toBeUndefined();
  });

  it("honors childToParent direction", () => {
    const ugm = new UGM();
    ugm.addNode("whole", { types: ["Block"], properties: {} });
    ugm.addNode("part", { types: ["Part"], properties: {} });
    ugm.addEdge("part", "whole", { type: "partOf", properties: {} });
    const els = ugmToCytoscapeElements(ugm, {
      containment: { edgeType: "partOf", direction: "childToParent" },
    });
    expect(els.find((e) => e.data.id === "part")?.data.parent).toBe("whole");
  });

  it("without options, behaves exactly as before", () => {
    const els = ugmToCytoscapeElements(containedGraph());
    expect(els.filter((e) => e.group === "edges")).toHaveLength(3);
    expect(els.every((e) => e.data.parent === undefined)).toBe(true);
  });
});
