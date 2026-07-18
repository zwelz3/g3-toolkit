/**
 * Layout-metrics oracle tests (G3L:QLT-002). Golden values on tiny
 * hand-checkable scenes; the module is the regression oracle for
 * every future engine comparison, so ITS correctness is load-bearing.
 */
import { describe, expect, it } from "vitest";
import {
  computeLayoutMetrics,
  countBends,
  countCrossings,
  displacementFromSketch,
  polylineLength,
  segmentsCross,
} from "./layout-metrics";

describe("segmentsCross", () => {
  it("detects a proper X crossing", () => {
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ),
    ).toBe(true);
  });
  it("shared endpoints are NOT crossings (edges meeting at a port)", () => {
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 5 },
      ),
    ).toBe(false);
  });
  it("parallel non-touching segments do not cross", () => {
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ),
    ).toBe(false);
  });
  it("collinear overlap counts (superimposed edges are a defect)", () => {
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 0 },
        { x: 15, y: 0 },
      ),
    ).toBe(true);
  });
});

describe("countBends", () => {
  it("straight polyline with a collinear interior point has 0 bends", () => {
    expect(
      countBends([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe(0);
  });
  it("one right angle is one bend", () => {
    expect(
      countBends([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toBe(1);
  });
  it("an orthogonal Z-route has two bends", () => {
    expect(
      countBends([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 10 },
      ]),
    ).toBe(2);
  });
  it("a collinear reversal (double-back) counts as a bend", () => {
    expect(
      countBends([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 0 },
      ]),
    ).toBe(1);
  });
});

describe("countCrossings", () => {
  it("counts one crossing for an X of two edges and ignores self-segments", () => {
    const edges = [
      {
        id: "a",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      },
      {
        id: "b",
        points: [
          { x: 0, y: 10 },
          { x: 10, y: 0 },
        ],
      },
    ];
    expect(countCrossings(edges)).toBe(1);
  });
  it("segments of the same edge never count as crossings", () => {
    const spiral = [
      {
        id: "s",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 5, y: 10 },
          { x: 5, y: -5 }, // crosses the first segment of ITSELF
        ],
      },
    ];
    expect(countCrossings(spiral)).toBe(0);
  });
});

describe("polylineLength and computeLayoutMetrics", () => {
  it("computes the golden metric set for a two-node, two-edge scene", () => {
    const metrics = computeLayoutMetrics({
      nodes: [
        { id: "n1", x: 0, y: 0, width: 10, height: 10 },
        { id: "n2", x: 30, y: 40, width: 10, height: 10 },
      ],
      edges: [
        {
          id: "e1",
          points: [
            { x: 10, y: 5 },
            { x: 30, y: 5 },
            { x: 30, y: 45 },
          ],
        },
        {
          id: "e2",
          points: [
            { x: 5, y: 10 },
            { x: 5, y: 45 },
            { x: 30, y: 45 },
          ],
        },
      ],
    });
    expect(metrics.nodeCount).toBe(2);
    expect(metrics.edgeCount).toBe(2);
    expect(metrics.bends).toBe(2);
    expect(metrics.totalEdgeLength).toBeCloseTo(20 + 40 + 35 + 25, 9);
    expect(metrics.bounds).toEqual({ x: 0, y: 0, width: 40, height: 50 });
    expect(metrics.aspectRatio).toBeCloseTo(40 / 50, 9);
    // The two routes share the corner point (30,45)/(30,45)? e1 ends at
    // (30,45); e2's last segment passes through x=30 at its endpoint:
    // shared endpoint, not a crossing.
    expect(metrics.crossings).toBe(0);
  });
  it("polylineLength of an L is the sum of its legs", () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ]),
    ).toBeCloseTo(7, 9);
  });
});

describe("displacementFromSketch (the G3L:LAY-018 stability metric)", () => {
  it("reports mean/max/per-node and honors ignore + unmatched", () => {
    const sketch = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 10, y: 0 }],
      ["gone", { x: 99, y: 99 }],
    ]);
    const current = new Map([
      ["a", { x: 3, y: 4 }], // moved 5
      ["b", { x: 10, y: 0 }], // unmoved
      ["toggled", { x: 1, y: 1 }], // deliberately changed, ignored
    ]);
    const d = displacementFromSketch(current, sketch, new Set(["toggled"]));
    expect(d.perNode).toEqual({ a: 5, b: 0 });
    expect(d.max).toBe(5);
    expect(d.mean).toBeCloseTo(2.5, 9);
    expect(d.unmatched).toEqual(["gone"]);
  });
});
