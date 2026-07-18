/**
 * captureStructuralTopLevelPositions (MR-1 third review): the canvas
 * side of drag preservation. Live CENTERS of the structural input's
 * top-level nodes, read from the instance at toggle time; ids absent
 * from the canvas are skipped.
 */
import { describe, expect, it } from "vitest";
import cytoscape from "cytoscape";
import { captureStructuralTopLevelPositions } from "./structural-to-cytoscape";

describe("captureStructuralTopLevelPositions", () => {
  it("reads live centers for present top-level ids and skips absent ones", () => {
    const cy = cytoscape({
      headless: true,
      styleEnabled: false,
      elements: [{ data: { id: "boxA" } }, { data: { id: "boxB" } }],
    });
    cy.$id("boxA").position({ x: 150, y: 80 });
    cy.$id("boxB").position({ x: -40, y: 220 });
    const input = {
      nodes: [{ id: "boxA" }, { id: "boxB" }, { id: "not-mounted" }],
    };
    const live = captureStructuralTopLevelPositions(cy as never, input);
    expect(live.get("boxA")).toEqual({ x: 150, y: 80 });
    expect(live.get("boxB")).toEqual({ x: -40, y: 220 });
    expect(live.has("not-mounted")).toBe(false);
    cy.destroy();
  });
});
