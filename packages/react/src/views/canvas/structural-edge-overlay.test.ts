/**
 * SVG overlay edge layer contract tests (G3L:RND-002).
 *
 * Pure-helper tests pin the geometry contract (path d generation,
 * arc-length midpoints, terminal tangents, arrowhead shapes per UML
 * kind, hollow-arrow shaft trimming). The integration test mounts a
 * real headless Cytoscape with a routed structural scene and asserts
 * the overlay draws one path per routed edge from the live data,
 * that declared-port edges are NOT overlaid (the ruled per-edge
 * split), and that the suppression rule leaves Cytoscape edges
 * mounted (hit-testable) rather than removed.
 *
 * What these tests deliberately do NOT claim: what a browser paints.
 * Visual parity and pan/zoom smoothness are manual-review items
 * (planning/g3l/manual-review-log.md MR-2/MR-3).
 */
import { describe, expect, it } from "vitest";
import cytoscape from "cytoscape";
import {
  arrowShapes,
  isDashedKind,
  liveRoutedPoints,
  overlayPathD,
  polylineMidpoint,
  shortenPolyline,
  terminalDirection,
} from "./structural-edge-overlay";
import { routeToSegments } from "./structural-to-cytoscape";

const L = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
] as const;

describe("overlay geometry helpers", () => {
  it("overlayPathD emits M/L absolute commands", () => {
    expect(overlayPathD(L)).toBe("M 0 0 L 10 0 L 10 10");
    expect(overlayPathD([])).toBe("");
  });

  it("polylineMidpoint is the arc-length midpoint, not the vertex average", () => {
    // Total length 20; midpoint at arc 10 = the corner (10,0).
    expect(polylineMidpoint(L)).toEqual({ x: 10, y: 0 });
    // Uneven legs: 30 then 10; arc midpoint 20 sits inside leg one.
    expect(
      polylineMidpoint([
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 10 },
      ]),
    ).toEqual({ x: 20, y: 0 });
  });

  it("terminalDirection points OUT of each end", () => {
    expect(terminalDirection(L, "source")).toEqual({ x: -1, y: 0 });
    expect(terminalDirection(L, "target")).toEqual({ x: 0, y: 1 });
  });

  it("shortenPolyline trims the tip toward the body and clamps", () => {
    expect(shortenPolyline(L, "target", 4)[2]).toEqual({ x: 10, y: 6 });
    expect(shortenPolyline(L, "source", 4)[0]).toEqual({ x: 4, y: 0 });
    // Trim longer than the terminal segment clamps to the inner vertex.
    expect(shortenPolyline(L, "target", 99)[2]).toEqual({ x: 10, y: 0 });
  });

  it("arrowShapes: association = filled target triangle at the tip", () => {
    const shapes = arrowShapes("association", L);
    expect(shapes).toHaveLength(1);
    const s = shapes[0];
    expect(s).toBeDefined();
    if (!s) return;
    expect(s.end).toBe("target");
    expect(s.fill).toBe("stroke");
    expect(s.trim).toBe(0);
    expect(s.d.startsWith("M 10 10")).toBe(true);
    expect(s.d.endsWith("Z")).toBe(true);
  });

  it("arrowShapes: generalization = hollow target triangle that trims the shaft", () => {
    const s = arrowShapes("generalization", L)[0];
    expect(s).toBeDefined();
    if (!s) return;
    expect(s.fill).toBe("none");
    expect(s.trim).toBeGreaterThan(0);
  });

  it("arrowShapes: composition/aggregation = SOURCE diamonds, filled vs hollow", () => {
    const comp = arrowShapes("composition", L)[0];
    const agg = arrowShapes("aggregation", L)[0];
    expect(comp?.end).toBe("source");
    expect(comp?.fill).toBe("stroke");
    expect(agg?.end).toBe("source");
    expect(agg?.fill).toBe("none");
    // Diamond tip sits at the source point.
    expect(comp?.d.startsWith("M 0 0")).toBe(true);
  });

  it("arrowShapes: dependency = open vee, dashed shaft", () => {
    const s = arrowShapes("dependency", L)[0];
    expect(s).toBeDefined();
    if (!s) return;
    expect(s.fill).toBe("none");
    expect(s.d.endsWith("Z")).toBe(false);
    expect(isDashedKind("dependency")).toBe(true);
    expect(isDashedKind("association")).toBe(false);
  });
});

describe("liveRoutedPoints against real Cytoscape", () => {
  it("reconstructs the absolute route from data + live endpoints and tracks a node move", () => {
    const cy = cytoscape({
      headless: true,
      styleEnabled: false,
      elements: [
        { data: { id: "a" } },
        { data: { id: "b" } },
        { data: { id: "e", source: "a", target: "b" } },
      ],
    });
    // Positions set post-creation: creation-time `position` fields came
    // back (0,0) under headless+styleEnabled:false in this cytoscape
    // build, so the fixture sets them explicitly.
    cy.$id("a").position({ x: 0, y: 50 });
    cy.$id("b").position({ x: 200, y: 150 });
    const edge = cy.$id("e");
    // Headless basis = node centers (the documented fallback path;
    // the endpoint basis is browser-only and reviewed live, MR-3).
    const s = cy.$id("a").position();
    const t = cy.$id("b").position();
    // Route: out of a, down past an imaginary obstacle, into b.
    const route = [
      { x: s.x, y: s.y },
      { x: 60, y: s.y },
      { x: 60, y: t.y },
      { x: t.x, y: t.y },
    ];
    const seg = routeToSegments(route, s, t);
    expect(seg).not.toBeNull();
    if (!seg) return;
    edge.data("_segDist", seg.distances.join(" "));
    edge.data("_segWeight", seg.weights.join(" "));

    const pts = liveRoutedPoints(edge as never);
    expect(pts).not.toBeNull();
    if (!pts) return;
    expect(pts).toHaveLength(4);
    expect(pts[1]?.x).toBeCloseTo(60, 6);
    expect(pts[2]?.x).toBeCloseTo(60, 6);

    // Rigid move of BOTH nodes: the reconstructed route translates
    // rigidly with the live endpoints (data untouched).
    cy.$id("a").position({ x: 100, y: 50 });
    cy.$id("b").position({ x: 300, y: 150 });
    const moved = liveRoutedPoints(edge as never);
    expect(moved).not.toBeNull();
    if (!moved) return;
    expect(moved[1]?.x).toBeCloseTo(160, 6);
    expect(moved[2]?.x).toBeCloseTo(160, 6);
    cy.destroy();
  });

  it("returns null without route data (taxi edges stay off the overlay)", () => {
    const cy = cytoscape({
      headless: true,
      styleEnabled: false,
      elements: [
        { data: { id: "a" }, position: { x: 0, y: 0 } },
        { data: { id: "b" }, position: { x: 100, y: 0 } },
        { data: { id: "e", source: "a", target: "b" } },
      ],
    });
    expect(liveRoutedPoints(cy.$id("e") as never)).toBeNull();
    cy.destroy();
  });
});
