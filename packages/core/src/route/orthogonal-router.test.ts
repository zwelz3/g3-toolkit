/**
 * Orthogonal router unit oracles (G3L:RTE-011, workstream B4). The
 * MR-8 acceptance criteria in unit form: routes stay border-anchored
 * with perpendicular exits, and never cross obstacles.
 */
import { describe, expect, it } from "vitest";
import { routeOrthogonal, type RouteBox } from "./orthogonal-router";

const EPS = 1e-6;

function isOrthogonal(pts: readonly { x: number; y: number }[]): boolean {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (Math.abs(a.x - b.x) > EPS && Math.abs(a.y - b.y) > EPS) return false;
  }
  return true;
}

function clearsBox(
  pts: readonly { x: number; y: number }[],
  box: RouteBox,
  margin = 0,
): boolean {
  const x1 = box.x + margin;
  const x2 = box.x + box.width - margin;
  const y1 = box.y + margin;
  const y2 = box.y + box.height - margin;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const sx1 = Math.min(a.x, b.x);
    const sx2 = Math.max(a.x, b.x);
    const sy1 = Math.min(a.y, b.y);
    const sy2 = Math.max(a.y, b.y);
    const overlapX = sx1 < x2 - EPS && sx2 > x1 + EPS;
    const overlapY = sy1 < y2 - EPS && sy2 > y1 + EPS;
    if (overlapX && overlapY) return false;
  }
  return true;
}

describe("routeOrthogonal", () => {
  const OBSTACLE: RouteBox = { x: 90, y: 20, width: 80, height: 100 };

  it("routes around a single obstacle, orthogonally, anchored at both terminals", () => {
    const res = routeOrthogonal({
      source: { point: { x: 0, y: 50 }, side: "EAST" },
      target: { point: { x: 400, y: 150 }, side: "WEST" },
      obstacles: [OBSTACLE],
    });
    expect(res).not.toBeNull();
    if (!res) return;
    expect(res.points[0]).toEqual({ x: 0, y: 50 });
    expect(res.points[res.points.length - 1]).toEqual({ x: 400, y: 150 });
    expect(isOrthogonal(res.points)).toBe(true);
    expect(clearsBox(res.points, OBSTACLE)).toBe(true);
  });

  it("leaves and enters PERPENDICULAR to the attach sides (MR-8(a))", () => {
    const res = routeOrthogonal({
      source: { point: { x: 0, y: 50 }, side: "EAST" },
      target: { point: { x: 400, y: 150 }, side: "WEST" },
      obstacles: [OBSTACLE],
    });
    expect(res).not.toBeNull();
    if (!res) return;
    const p = res.points;
    const first = { a: p[0]!, b: p[1]! };
    const last = { a: p[p.length - 2]!, b: p[p.length - 1]! };
    // EAST exit: first segment horizontal, moving +x.
    expect(Math.abs(first.a.y - first.b.y)).toBeLessThan(EPS);
    expect(first.b.x).toBeGreaterThan(first.a.x);
    // WEST entry: last segment horizontal, approaching FROM the west
    // (moving +x into the anchor on the node's west border).
    expect(Math.abs(last.a.y - last.b.y)).toBeLessThan(EPS);
    expect(last.b.x).toBeGreaterThan(last.a.x);
  });

  it("an unobstructed aligned pair routes as a single straight segment", () => {
    const res = routeOrthogonal({
      source: { point: { x: 0, y: 50 }, side: "EAST" },
      target: { point: { x: 200, y: 50 }, side: "WEST" },
      obstacles: [],
    });
    expect(res).not.toBeNull();
    if (!res) return;
    expect(res.points).toEqual([
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]);
  });

  it("threads the channel between two obstacles instead of detouring around the block", () => {
    const top: RouteBox = { x: 100, y: 0, width: 60, height: 80 };
    const bottom: RouteBox = { x: 100, y: 130, width: 60, height: 80 };
    // Channel y in (80+12, 130-12) after clearance inflation: (92,118).
    const res = routeOrthogonal({
      source: { point: { x: 0, y: 105 }, side: "EAST" },
      target: { point: { x: 300, y: 105 }, side: "WEST" },
      obstacles: [top, bottom],
    });
    expect(res).not.toBeNull();
    if (!res) return;
    expect(clearsBox(res.points, top)).toBe(true);
    expect(clearsBox(res.points, bottom)).toBe(true);
    // Straight through the channel: no bends needed.
    expect(res.points.length).toBe(2);
  });

  it("returns null when the target is sealed off (caller falls back)", () => {
    const walls: RouteBox[] = [
      { x: 180, y: 80, width: 140, height: 10 },
      { x: 180, y: 210, width: 140, height: 10 },
      { x: 180, y: 80, width: 10, height: 140 },
      { x: 310, y: 80, width: 10, height: 140 },
    ];
    const res = routeOrthogonal({
      source: { point: { x: 0, y: 150 }, side: "EAST" },
      target: { point: { x: 250, y: 150 }, side: "WEST" },
      obstacles: walls,
    });
    expect(res).toBeNull();
  });

  it("terminal segments carry the pre-bend buffer (UML symbols stay on a straight run)", () => {
    // Force an up-and-over: source EAST, target EAST, target directly
    // above the source, so bends are mandatory near both terminals.
    const res = routeOrthogonal({
      source: { point: { x: 100, y: 200 }, side: "EAST" },
      target: { point: { x: 100, y: 40 }, side: "EAST" },
      obstacles: [],
    });
    expect(res).not.toBeNull();
    if (!res) return;
    const p = res.points;
    const segLen = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    expect(segLen(p[0]!, p[1]!)).toBeGreaterThanOrEqual(28);
    expect(segLen(p[p.length - 2]!, p[p.length - 1]!)).toBeGreaterThanOrEqual(
      28,
    );
  });

  it("a long stub degrades instead of nulling when it would land inside a neighbor", () => {
    // A wall 20px east of the source anchor: the 28px stub would sit
    // inside its inflated box; the router degrades the stub and still
    // finds a route around.
    const wall: RouteBox = { x: 130, y: 0, width: 20, height: 240 };
    const res = routeOrthogonal({
      source: { point: { x: 100, y: 120 }, side: "EAST" },
      target: { point: { x: 300, y: 120 }, side: "WEST" },
      obstacles: [wall],
    });
    expect(res).not.toBeNull();
    if (!res) return;
    expect(
      res.points.every(
        (q, i, arr) =>
          i === 0 ||
          Math.abs(q.x - arr[i - 1]!.x) < 1e-6 ||
          Math.abs(q.y - arr[i - 1]!.y) < 1e-6,
      ),
    ).toBe(true);
  });

  it("prunes obstacle sets at scale without ever violating clearance", () => {
    // 300 scattered obstacles far from the corridor plus one wall
    // squarely in it: pruning must keep the wall, drop the noise,
    // and the result must clear EVERYTHING.
    const noise: RouteBox[] = [];
    for (let i = 0; i < 300; i++) {
      noise.push({
        x: 5000 + (i % 20) * 300,
        y: 5000 + Math.floor(i / 20) * 300,
        width: 100,
        height: 60,
      });
    }
    const wall: RouteBox = { x: 200, y: -100, width: 40, height: 220 };
    const res = routeOrthogonal({
      source: { point: { x: 0, y: 0 }, side: "EAST" },
      target: { point: { x: 500, y: 0 }, side: "WEST" },
      obstacles: [...noise, wall],
    });
    expect(res).not.toBeNull();
    if (!res) return;
    expect(clearsBox(res.points, wall)).toBe(true);
    for (const b of noise) expect(clearsBox(res.points, b)).toBe(true);
  });

  it("is deterministic: identical requests produce identical routes", () => {
    const req = {
      source: { point: { x: 0, y: 50 }, side: "EAST" as const },
      target: { point: { x: 400, y: 150 }, side: "WEST" as const },
      obstacles: [OBSTACLE, { x: 220, y: 90, width: 60, height: 120 }],
    };
    const a = routeOrthogonal(req);
    const b = routeOrthogonal(req);
    expect(a).toEqual(b);
  });
});
