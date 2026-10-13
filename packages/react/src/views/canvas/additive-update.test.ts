/**
 * Issue #26, the part the React tests cannot pin with a mocked
 * cytoscape: that fcose, run the way applyAdditiveUpdate runs it
 * (randomize: false, fixedNodeConstraint for every existing node, no
 * fit), really leaves the existing nodes where they were and places
 * only the new ones. The issue's host workaround used `locked`, which
 * fcose ignores while computing; `fixedNodeConstraint` is what it
 * honors. Headless cytoscape with the real fcose extension.
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

  it("returns false and touches nothing when the live graph has a node the next one lacks", () => {
    const { ugm, positions } = ring();
    const cy = mount(ugm, positions);
    const smaller = new UGM();
    smaller.addNode("n0", { types: ["T"], properties: {} });
    smaller.addNode("n9", { types: ["T"], properties: {} });
    smaller.addEdge("n0", "n9", { type: "r", key: "x" });
    expect(applyAdditiveUpdate(cy, ugmToCytoscapeElements(smaller), OPTS)).toBe(
      false,
    );
    expect(cy.nodes().length).toBe(6);
    expect(cy.edges().length).toBe(6);
    expect(cy.$id("n9").empty()).toBe(true);
    cy.destroy();
  });
});
