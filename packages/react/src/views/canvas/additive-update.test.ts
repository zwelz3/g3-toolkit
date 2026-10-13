/**
 * Issue #26, the part the React tests cannot pin with a mocked
 * cytoscape: that fcose, run the way applyAdditiveUpdate runs it
 * (randomize: false, fixedNodeConstraint for every existing node, no
 * fit), really leaves the existing nodes where they were and places
 * only the new ones. The issue's host workaround used `locked`, which
 * fcose ignores while computing; `fixedNodeConstraint` is what it
 * honors. Issue #64 adds the shrink side against the real element
 * model: a removed node takes its incident edges, a removed compound
 * parent does NOT take its surviving children (they are moved out
 * first, keeping their positions), and the camera is never written.
 * Headless cytoscape with the real fcose extension.
 */
import { describe, it, expect } from "vitest";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import { UGM } from "@g3-toolkit/core";
import { ugmToCytoscapeElements } from "./ugm-to-cytoscape";
import { applyAdditiveUpdate } from "./CytoscapeCanvas";

cytoscape.use(fcose);

/** A six-node ring, drawn on a circle of radius 200. */
function ring(): {
  ugm: UGM;
  positions: Map<string, { x: number; y: number }>;
} {
  const ugm = new UGM();
  const positions = new Map<string, { x: number; y: number }>();
  for (let i = 0; i < 6; i++) {
    ugm.addNode(`n${i}`, { types: ["T"], properties: {} });
    const a = (i / 6) * 2 * Math.PI;
    positions.set(`n${i}`, { x: 200 * Math.cos(a), y: 200 * Math.sin(a) });
  }
  for (let i = 0; i < 6; i++) {
    ugm.addEdge(`n${i}`, `n${(i + 1) % 6}`, { type: "r", key: `e${i}` });
  }
  return { ugm, positions };
}

function mount(ugm: UGM, positions: Map<string, { x: number; y: number }>) {
  const elements = ugmToCytoscapeElements(ugm).map((el) =>
    el.group === "nodes"
      ? { ...el, position: positions.get(String(el.data.id)) }
      : el,
  );
  return cytoscape({
    headless: true,
    styleEnabled: true,
    elements,
    layout: { name: "preset" },
  });
}

const OPTS = { animate: false, animationDuration: 0, layoutOptions: undefined };

describe("applyAdditiveUpdate with the real fcose (headless)", () => {
  it("holds every existing node and places the new ones beside their neighbors", () => {
    const { ugm, positions } = ring();
    const cy = mount(ugm, positions);
    const grown = UGM.fromJSON(ugm.toJSON());
    grown.addNode("n6", { types: ["U"], properties: {} });
    grown.addNode("n7", { types: ["U"], properties: {} });
    grown.addEdge("n0", "n6", { type: "r", key: "e6" });
    grown.addEdge("n0", "n7", { type: "r", key: "e7" });
    grown.addEdge("n6", "n7", { type: "r", key: "e8" });

    expect(applyAdditiveUpdate(cy, ugmToCytoscapeElements(grown), OPTS)).toBe(
      true,
    );

    // Existing nodes did not move.
    for (const [id, before] of positions) {
      const after = cy.$id(id).position();
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(
        1e-6,
      );
    }
    // The new nodes exist, have finite distinct positions, and landed
    // on n0's side of the ring (they were seeded at n0, and fcose moved
    // them off it without a fit or a re-randomization).
    const n0 = positions.get("n0")!;
    const n3 = positions.get("n3")!;
    for (const id of ["n6", "n7"]) {
      const p = cy.$id(id).position();
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(Math.hypot(p.x - n0.x, p.y - n0.y)).toBeGreaterThan(1);
      expect(Math.hypot(p.x - n0.x, p.y - n0.y)).toBeLessThan(
        Math.hypot(p.x - n3.x, p.y - n3.y),
      );
    }
    const p6 = cy.$id("n6").position();
    const p7 = cy.$id("n7").position();
    expect(Math.hypot(p6.x - p7.x, p6.y - p7.y)).toBeGreaterThan(1);
    expect(cy.nodes().length).toBe(8);
    expect(cy.edges().length).toBe(9);
    cy.destroy();
  });

  it("removes the nodes the next graph lacks, with their incident edges, and holds the rest (#64)", () => {
    const { ugm, positions } = ring();
    const cy = mount(ugm, positions);
    cy.viewport({ zoom: 1.7, pan: { x: 33, y: -21 } });
    // Drop every other node: three survivors, no surviving ring edge
    // (each edge joined a removed node).
    const smaller = UGM.fromJSON(ugm.toJSON());
    for (const id of ["n1", "n3", "n5"]) smaller.removeNode(id);
    expect(applyAdditiveUpdate(cy, ugmToCytoscapeElements(smaller), OPTS)).toBe(
      true,
    );
    expect(
      cy
        .nodes()
        .map((n) => n.id())
        .sort(),
    ).toEqual(["n0", "n2", "n4"]);
    expect(cy.edges().length).toBe(0);
    for (const id of ["n0", "n2", "n4"]) {
      const before = positions.get(id)!;
      const after = cy.$id(id).position();
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(
        1e-9,
      );
    }
    expect(cy.zoom()).toBe(1.7);
    expect(cy.pan()).toEqual({ x: 33, y: -21 });
    cy.destroy();
  });

  it("shrinks and grows in one call: the removed node is gone, the new one lands beside its surviving neighbor (#64)", () => {
    const { ugm, positions } = ring();
    const cy = mount(ugm, positions);
    const next = UGM.fromJSON(ugm.toJSON());
    next.removeNode("n3");
    next.addNode("n6", { types: ["U"], properties: {} });
    next.addEdge("n0", "n6", { type: "r", key: "e6" });
    expect(applyAdditiveUpdate(cy, ugmToCytoscapeElements(next), OPTS)).toBe(
      true,
    );
    expect(cy.$id("n3").empty()).toBe(true);
    expect(cy.nodes().length).toBe(6);
    // e2 (n2-n3) and e3 (n3-n4) left with n3; e6 arrived.
    expect(
      cy
        .edges()
        .map((e) => e.id())
        .sort(),
    ).toEqual(["e0", "e1", "e4", "e5", "e6"]);
    for (const id of ["n0", "n1", "n2", "n4", "n5"]) {
      const before = positions.get(id)!;
      const after = cy.$id(id).position();
      expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(
        1e-6,
      );
    }
    const p6 = cy.$id("n6").position();
    const n0 = positions.get("n0")!;
    expect(Number.isFinite(p6.x) && Number.isFinite(p6.y)).toBe(true);
    // Closer to n0 than to where n3 was (opposite side of the ring).
    const n3 = positions.get("n3")!;
    expect(Math.hypot(p6.x - n0.x, p6.y - n0.y)).toBeLessThan(
      Math.hypot(p6.x - n3.x, p6.y - n3.y),
    );
    cy.destroy();
  });

  it("returns false and touches nothing when the next graph shares no node with the live one (#64 boundary)", () => {
    const { ugm, positions } = ring();
    const cy = mount(ugm, positions);
    const other = new UGM();
    other.addNode("x", { types: ["T"], properties: {} });
    other.addNode("y", { types: ["T"], properties: {} });
    other.addEdge("x", "y", { type: "r", key: "xy" });
    expect(applyAdditiveUpdate(cy, ugmToCytoscapeElements(other), OPTS)).toBe(
      false,
    );
    expect(applyAdditiveUpdate(cy, [], OPTS)).toBe(false);
    expect(cy.nodes().length).toBe(6);
    expect(cy.edges().length).toBe(6);
    expect(cy.$id("x").empty()).toBe(true);
    cy.destroy();
  });

  it("removing a compound parent keeps its surviving children at their positions, top level (#64)", () => {
    const containment = {
      edgeType: "contains",
      direction: "parentToChild",
    } as const;
    const ugm = new UGM();
    ugm.addNode("p", { types: ["Group"], properties: {} });
    ugm.addNode("a", { types: ["T"], properties: {} });
    ugm.addNode("b", { types: ["T"], properties: {} });
    ugm.addNode("c", { types: ["T"], properties: {} });
    ugm.addEdge("p", "a", { type: "contains", key: "pa" });
    ugm.addEdge("p", "b", { type: "contains", key: "pb" });
    ugm.addEdge("a", "c", { type: "r", key: "ac" });
    const positions = new Map([
      ["a", { x: 10, y: 20 }],
      ["b", { x: 60, y: 20 }],
      ["c", { x: 200, y: 200 }],
    ]);
    const elements = ugmToCytoscapeElements(ugm, { containment }).map((el) =>
      el.group === "nodes" && positions.has(String(el.data.id))
        ? { ...el, position: positions.get(String(el.data.id)) }
        : el,
    );
    const cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements,
      layout: { name: "preset" },
    });
    expect(cy.$id("a").data("parent")).toBe("p");
    cy.$id("a").addClass("g3t-selected");
    // The group dissolves (p leaves with its containment edges); b
    // leaves too; a and c stay.
    const next = UGM.fromJSON(ugm.toJSON());
    next.removeNode("p");
    next.removeNode("b");
    expect(
      applyAdditiveUpdate(
        cy,
        ugmToCytoscapeElements(next, { containment }),
        OPTS,
      ),
    ).toBe(true);
    expect(
      cy
        .nodes()
        .map((n) => n.id())
        .sort(),
    ).toEqual(["a", "c"]);
    expect(cy.edges().map((e) => e.id())).toEqual(["ac"]);
    expect(cy.$id("a").isChild()).toBe(false);
    expect(cy.$id("a").position()).toEqual({ x: 10, y: 20 });
    expect(cy.$id("c").position()).toEqual({ x: 200, y: 200 });
    // move() kept the element object: its classes survived.
    expect(cy.$id("a").hasClass("g3t-selected")).toBe(true);
    cy.destroy();
  });

  it("a surviving child re-parented to another node still takes the rebuild (#26 rule unchanged)", () => {
    const containment = {
      edgeType: "contains",
      direction: "parentToChild",
    } as const;
    const ugm = new UGM();
    ugm.addNode("p", { types: ["Group"], properties: {} });
    ugm.addNode("q", { types: ["Group"], properties: {} });
    ugm.addNode("a", { types: ["T"], properties: {} });
    ugm.addEdge("p", "a", { type: "contains", key: "pa" });
    const cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: ugmToCytoscapeElements(ugm, { containment }),
      layout: { name: "preset" },
    });
    const next = UGM.fromJSON(ugm.toJSON());
    next.removeNode("p");
    next.addEdge("q", "a", { type: "contains", key: "qa" });
    expect(
      applyAdditiveUpdate(
        cy,
        ugmToCytoscapeElements(next, { containment }),
        OPTS,
      ),
    ).toBe(false);
    expect(cy.$id("p").nonempty()).toBe(true);
    expect(cy.$id("a").data("parent")).toBe("p");
    cy.destroy();
  });
});
