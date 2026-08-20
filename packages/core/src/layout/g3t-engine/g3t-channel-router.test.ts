/**
 * PRF-003 brief 05a: channel-router unit oracles (owner Jake,
 * 2026-08-14). Additive slice; the module ships behind the OFF-BY-
 * DEFAULT `useChannelRouter` flag on `routeStructuralEdges`, and 05b
 * flips the flag and re-pins the six-scenario LAY005_BASELINE.
 */
import { describe, expect, it } from "vitest";
import {
  assignTracks,
  emitChannelRoute,
  type ChannelEdge,
  type ChannelPlan,
} from "./g3t-channel-router";
import { dedupeCollinear } from "./g3t-polyline-utils";
import { routeStructuralEdges } from "./g3t-routing";
import type { StructuralGraphInput } from "../structural";
import { g3tLayoutStructural } from "./g3t-structural";

function plan(overrides?: Partial<ChannelPlan>): ChannelPlan {
  return {
    direction: "RIGHT",
    layerOf: new Map<string, number>([
      ["a", 0],
      ["b", 0],
      ["c", 1],
      ["d", 1],
      ["e", 2],
    ]),
    channels: [
      { boundary: 0, axis: "v", midline: 100, demand: 4, trackGap: 8 },
      { boundary: 1, axis: "v", midline: 300, demand: 2, trackGap: 8 },
    ],
    ...overrides,
  };
}

describe("assignTracks (PRF-003 05a)", () => {
  it("orders edges by (entry, exit, id) — rainbow uncrossing", () => {
    const edges: ChannelEdge[] = [
      { id: "e2", source: "a", target: "c", entryCross: 20, exitCross: 40 },
      { id: "e1", source: "b", target: "c", entryCross: 10, exitCross: 50 },
      { id: "e3", source: "a", target: "d", entryCross: 30, exitCross: 30 },
    ];
    const { tracks, overflow } = assignTracks(edges, plan());
    expect(overflow.size).toBe(0);
    const b0 = tracks.get(0);
    expect(b0).toBeDefined();
    // Ordered by entryCross ascending: e1(10), e2(20), e3(30).
    expect(b0?.get("e1")).toBe(0);
    expect(b0?.get("e2")).toBe(1);
    expect(b0?.get("e3")).toBe(2);
  });

  it("ties on entry resolve by exit, ties on both by edge id", () => {
    const edges: ChannelEdge[] = [
      { id: "z", source: "a", target: "c", entryCross: 10, exitCross: 10 },
      { id: "a", source: "a", target: "c", entryCross: 10, exitCross: 10 },
      { id: "m", source: "a", target: "c", entryCross: 10, exitCross: 20 },
    ];
    const { tracks } = assignTracks(edges, plan());
    const b0 = tracks.get(0);
    // entry equal for all; exit: 10,10,20 => (a,z) first by id, then m.
    expect(b0?.get("a")).toBe(0);
    expect(b0?.get("z")).toBe(1);
    expect(b0?.get("m")).toBe(2);
  });

  it("fully-tied entry+exit still yields DISTINCT integer tracks", () => {
    const edges: ChannelEdge[] = [
      { id: "e1", source: "a", target: "c", entryCross: 0, exitCross: 0 },
      { id: "e2", source: "a", target: "c", entryCross: 0, exitCross: 0 },
      { id: "e3", source: "a", target: "c", entryCross: 0, exitCross: 0 },
    ];
    const { tracks } = assignTracks(edges, plan());
    const b0 = tracks.get(0);
    const assigned = ["e1", "e2", "e3"].map((id) => b0?.get(id));
    // All defined, and pairwise distinct — no coincidentRuns violation.
    expect(new Set(assigned).size).toBe(3);
    expect(assigned.every((t) => typeof t === "number")).toBe(true);
  });

  it("N > demand overflows the tail, track count stays <= demand", () => {
    // demand=2 on boundary 1; four edges compete for two tracks.
    const p = plan();
    const edges: ChannelEdge[] = Array.from({ length: 4 }, (_, i) => ({
      id: `e${i}`,
      source: "c",
      target: "e",
      entryCross: i * 10,
      exitCross: i * 10,
    }));
    const { tracks, overflow } = assignTracks(edges, p);
    const b1 = tracks.get(1);
    expect(b1?.size).toBe(2);
    expect(overflow.size).toBe(2);
    // Track count bound oracle: assigned indices in [0, demand).
    for (const t of b1?.values() ?? []) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(2);
    }
    // Two smallest-entry edges win; the tail overflows.
    expect(b1?.has("e0")).toBe(true);
    expect(b1?.has("e1")).toBe(true);
    expect(overflow.has("e2")).toBe(true);
    expect(overflow.has("e3")).toBe(true);
  });

  it("single-node-to-many-channel fan spreads across boundaries", () => {
    // Edge a->e spans two boundaries; edge a->c spans one.
    const edges: ChannelEdge[] = [
      { id: "long", source: "a", target: "e", entryCross: 0, exitCross: 0 },
      { id: "short", source: "a", target: "c", entryCross: 5, exitCross: 5 },
    ];
    const { tracks } = assignTracks(edges, plan());
    // long traverses boundaries 0 and 1; short only 0.
    expect(tracks.get(0)?.has("long")).toBe(true);
    expect(tracks.get(0)?.has("short")).toBe(true);
    expect(tracks.get(1)?.has("long")).toBe(true);
    expect(tracks.get(1)?.has("short")).toBe(false);
  });

  it("track count NEVER exceeds demand (invariant oracle)", () => {
    const p = plan({
      channels: [
        { boundary: 0, axis: "v", midline: 100, demand: 3, trackGap: 8 },
        { boundary: 1, axis: "v", midline: 300, demand: 1, trackGap: 8 },
      ],
    });
    const edges: ChannelEdge[] = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      source: "a",
      target: "e",
      entryCross: i,
      exitCross: i,
    }));
    const { tracks } = assignTracks(edges, p);
    for (const c of p.channels) {
      const size = tracks.get(c.boundary)?.size ?? 0;
      expect(size).toBeLessThanOrEqual(c.demand);
    }
  });
});

describe("emitChannelRoute (PRF-003 05a)", () => {
  it("track separation is expressed as GENUINE ORTHOGONAL BENDS, not collinear markers", () => {
    // Two edges sharing a channel get track 0 and track 1; the
    // track-1 route must bend at a non-zero offset from the midline so
    // dedupeCollinear does NOT collapse the separation.
    const p = plan({
      channels: [
        { boundary: 0, axis: "v", midline: 100, demand: 4, trackGap: 8 },
      ],
      layerOf: new Map<string, number>([
        ["a", 0],
        ["c", 1],
      ]),
    });
    const edges: ChannelEdge[] = [
      { id: "e1", source: "a", target: "c", entryCross: 0, exitCross: 0 },
      { id: "e2", source: "a", target: "c", entryCross: 10, exitCross: 10 },
    ];
    const asg = assignTracks(edges, p);
    const anchors = {
      source: {
        point: { x: 50, y: 20 },
        side: "EAST" as const,
      },
      sourceTip: { x: 64, y: 20 },
      target: {
        point: { x: 150, y: 20 },
        side: "WEST" as const,
      },
      targetTip: { x: 136, y: 20 },
    };
    const r1 = emitChannelRoute(edges[0]!, anchors, p, asg);
    const r2 = emitChannelRoute(edges[1]!, anchors, p, asg);
    // Track 0 (offset 0): after dedupe the route can be a straight
    // line; that is fine (no separation needed on track 0).
    expect(r1.length).toBeGreaterThanOrEqual(2);
    // Track 1 (offset +8): the polyline MUST contain a bend at
    // y = midline + 8 = 108. dedupeCollinear preserves it.
    const ys = new Set(r2.map((pt) => pt.y));
    expect(ys.has(108)).toBe(true);
    // The bend is real: at least two distinct interior y values,
    // producing at least one right-angle turn.
    expect(r2.length).toBeGreaterThan(2);
  });

  it("dedupeCollinear round-trip: collinear intermediates collapse, real bends survive", () => {
    // Collinear input: three points on a line -> middle removed.
    const collinear = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const collapsed = dedupeCollinear(collinear);
    expect(collapsed).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);
    // Real orthogonal bend: (0,0)->(10,0)->(10,20) stays 3 points.
    const bent = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 20 },
    ];
    expect(dedupeCollinear(bent)).toEqual(bent);
  });
});

describe("useChannelRouter flag off (byte-identical guarantee)", () => {
  it("routeStructuralEdges output is unchanged when the flag is absent", () => {
    // A small hand-authored structural scene to establish a shipped-
    // path baseline; 05a's flag must not perturb it when off.
    const input: StructuralGraphInput = {
      nodes: [
        { id: "n1", width: 80, height: 40 },
        { id: "n2", width: 80, height: 40 },
        { id: "n3", width: 80, height: 40 },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
      ],
    };
    const geometry = g3tLayoutStructural(input, { routeEdges: false });
    const baseline = routeStructuralEdges(input, geometry, {});
    const withFlagButNoPlan = routeStructuralEdges(input, geometry, {
      useChannelRouter: true,
      // Deliberately no channelPlan: flag has no effect.
    });
    expect(withFlagButNoPlan).toEqual(baseline);
    const withFlagFalse = routeStructuralEdges(input, geometry, {
      useChannelRouter: false,
    });
    expect(withFlagFalse).toEqual(baseline);
  });
});
