/**
 * Tests for the UGM -> Cytoscape element mapper, including the
 * compound containment mapping (slice 1, round 17).
 */

import { describe, it, expect } from "vitest";
import { UGM } from "@g3-toolkit/core";
import {
  ugmToCytoscapeElements,
  defaultNodeLabel,
  defaultEdgeLabel,
} from "./ugm-to-cytoscape";

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

describe("scalar type key (_type)", () => {
  function typedGraph(): UGM {
    const ugm = new UGM();
    ugm.addNode("a", {
      types: ["Asset", "Serviceable"],
      properties: { name: "Pump" },
    });
    ugm.addNode("b", { types: [], properties: { name: "Orphan" } });
    return ugm;
  }

  it("stamps the primary type as a scalar an attribute selector can match", () => {
    const els = ugmToCytoscapeElements(typedGraph());
    const a = els.find((e) => e.data.id === "a");
    // `types` stays the full array; _type is the selectable companion.
    expect(a?.data.types).toEqual(["Asset", "Serviceable"]);
    expect(a?.data._type).toBe("Asset");
  });

  it("falls back to _default for an untyped node, matching the visual lookup", () => {
    const els = ugmToCytoscapeElements(typedGraph());
    expect(els.find((e) => e.data.id === "b")?.data._type).toBe("_default");
  });

  it("lets a node property override it, as _color and _shape already allow", () => {
    const ugm = new UGM();
    ugm.addNode("x", {
      types: ["Asset"],
      properties: { name: "X", _type: "Override" },
    });
    const els = ugmToCytoscapeElements(ugm);
    expect(els.find((e) => e.data.id === "x")?.data._type).toBe("Override");
  });
});

describe("default label rule shared with the canvas (issue #14)", () => {
  // The encoding spec's label channel overrides a value the converter
  // stamps on EVERY element, so the canvas restores this rule when a
  // spec drops the channel. The converter must stamp exactly what the
  // exported helpers return, or the round trip drifts.
  it("nodes: properties.name, else the id, with an explicit properties.label winning", () => {
    const ugm = new UGM();
    ugm.addNode("named", { types: ["T"], properties: { name: "Alpha" } });
    ugm.addNode("bare", { types: ["T"] });
    ugm.addNode("explicit", {
      types: ["T"],
      properties: { name: "Beta", label: "Custom" },
    });
    const els = ugmToCytoscapeElements(ugm);
    for (const id of ["named", "bare", "explicit"]) {
      expect(els.find((e) => e.data.id === id)?.data.label).toBe(
        defaultNodeLabel(id, ugm.getNode(id)!),
      );
    }
    expect(defaultNodeLabel("named", ugm.getNode("named")!)).toBe("Alpha");
    expect(defaultNodeLabel("bare", ugm.getNode("bare")!)).toBe("bare");
    expect(defaultNodeLabel("explicit", ugm.getNode("explicit")!)).toBe(
      "Custom",
    );
  });

  it("edges: the edge type, with an explicit properties.label winning", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"] });
    ugm.addNode("b", { types: ["T"] });
    ugm.addEdge("a", "b", { type: "knows" });
    ugm.addEdge("b", "a", { type: "likes", properties: { label: "<3" } });
    const els = ugmToCytoscapeElements(ugm);
    ugm.forEachEdge((id, attrs) => {
      expect(els.find((e) => e.data.id === id)?.data.label).toBe(
        defaultEdgeLabel(attrs),
      );
    });
    const byType = (t: string) => {
      let found: unknown;
      ugm.forEachEdge((_id, attrs) => {
        if (attrs.type === t) found = defaultEdgeLabel(attrs);
      });
      return found;
    };
    expect(byType("knows")).toBe("knows");
    expect(byType("likes")).toBe("<3");
  });
});
