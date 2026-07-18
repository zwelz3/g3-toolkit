/**
 * Routed-segment style bypass (review 3.4). Rendering of routed
 * structural edges previously depended on data() mapping of
 * segment-distances/segment-weights, which the routed rule itself
 * flagged as browser-unverified for multi-value properties; the
 * review reported odd routing in the browser. These tests pin the
 * replacement channel: the per-element bypass applies parseable
 * values on a real (headless, style-enabled) Cytoscape instance, so
 * routed rendering no longer depends on mapping semantics.
 */
import { describe, it, expect } from "vitest";
import cytoscape from "cytoscape";
import {
  applyRoutedSegmentBypass,
  applyRoutedSegmentBypasses,
} from "./structural-to-cytoscape";

function headlessWithRoutedEdge() {
  return cytoscape({
    headless: true,
    styleEnabled: true,
    elements: [
      { group: "nodes", data: { id: "a" }, position: { x: 0, y: 0 } },
      { group: "nodes", data: { id: "b" }, position: { x: 200, y: 0 } },
      {
        group: "edges",
        data: {
          id: "e",
          source: "a",
          target: "b",
          _segDist: "24 -18",
          _segWeight: "0.3 0.7",
        },
        classes: "g3t-structural-edge-routed",
      },
    ],
    style: [
      {
        selector: "edge.g3t-structural-edge-routed",
        style: { "curve-style": "segments" },
      },
    ],
  });
}

describe("applyRoutedSegmentBypass", () => {
  it("applies the data-carried bends as readable style values", () => {
    const cy = headlessWithRoutedEdge();
    const edge = cy.getElementById("e");
    applyRoutedSegmentBypass(edge);
    // Cytoscape normalizes multi-value styles to arrays/px strings;
    // assert the values round-trip numerically rather than textually.
    const dist = String(edge.style("segment-distances"));
    const weight = String(edge.style("segment-weights"));
    expect(dist.replace(/px/g, "")).toMatch(/24[\s,]+-18/);
    expect(weight).toMatch(/0\.3[\s,]+0\.7/);
    cy.destroy();
  });

  it("is a no-op for edges without bend data", () => {
    const cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: [
        { group: "nodes", data: { id: "a" }, position: { x: 0, y: 0 } },
        { group: "nodes", data: { id: "b" }, position: { x: 100, y: 0 } },
        { group: "edges", data: { id: "e", source: "a", target: "b" } },
      ],
    });
    const edge = cy.getElementById("e");
    expect(() => applyRoutedSegmentBypass(edge)).not.toThrow();
    cy.destroy();
  });

  it("scene-level application targets only routed-class edges", () => {
    const cy = headlessWithRoutedEdge();
    cy.add({
      group: "edges",
      data: { id: "plain", source: "b", target: "a" },
    });
    applyRoutedSegmentBypasses(cy);
    const routed = String(cy.getElementById("e").style("segment-distances"));
    expect(routed.replace(/px/g, "")).toMatch(/24/);
    cy.destroy();
  });
});
