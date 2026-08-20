/**
 * Brief 04 (corridor supply contract, owner Jake, 2026-08-14): unit
 * tests for the estimate/gap-formula pair and the layout->router
 * drift assertion.
 *
 * The oracle scenarios (Fan-In Bus, Port Storm) live in the lab
 * suite; here we pin the pure functions, the per-corridor gap
 * widening surfaced through g3tLayoutStructural, and the dev-mode
 * warning that guards the estimate/measurement contract.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CORRIDOR_CLEARANCE,
  CORRIDOR_DRIFT_TOLERANCE,
  CORRIDOR_MAX_GAP_FACTOR,
  CORRIDOR_TRACK_GAP,
  computeCorridorGap,
  estimateCorridorDemand,
} from "./g3t-dummy-chain";
import { g3tLayoutStructural } from "./g3t-structural";
import type { StructuralGraphInput } from "../structural";

describe("estimateCorridorDemand", () => {
  it("counts a single 1-span edge on the boundary it crosses", () => {
    const edges = [{ id: "e", source: "a", target: "b" }];
    const layerOf = new Map<string, number>([
      ["a", 0],
      ["b", 1],
    ]);
    const demand = estimateCorridorDemand(edges, layerOf);
    expect(demand.get(0)).toBe(1);
    expect(demand.get(1)).toBeUndefined();
  });

  it("a k-span edge contributes to k boundaries", () => {
    const edges = [{ id: "long", source: "a", target: "b" }];
    const layerOf = new Map<string, number>([
      ["a", 0],
      ["b", 3],
    ]);
    const demand = estimateCorridorDemand(edges, layerOf);
    expect(demand.get(0)).toBe(1);
    expect(demand.get(1)).toBe(1);
    expect(demand.get(2)).toBe(1);
    expect(demand.get(3)).toBeUndefined();
  });

  it("fan-in: n edges into one boundary count as n tracks", () => {
    const edges = Array.from({ length: 5 }, (_, i) => ({
      id: `e${i}`,
      source: `s${i}`,
      target: "t",
    }));
    const layerOf = new Map<string, number>([
      ["s0", 0],
      ["s1", 0],
      ["s2", 0],
      ["s3", 0],
      ["s4", 0],
      ["t", 1],
    ]);
    const demand = estimateCorridorDemand(edges, layerOf);
    expect(demand.get(0)).toBe(5);
  });

  it("self-loops and missing endpoints do not contribute", () => {
    const edges = [
      { id: "self", source: "a", target: "a" },
      { id: "dangling", source: "a", target: "ghost" },
      { id: "real", source: "a", target: "b" },
    ];
    const layerOf = new Map<string, number>([
      ["a", 0],
      ["b", 1],
    ]);
    const demand = estimateCorridorDemand(edges, layerOf);
    expect(demand.get(0)).toBe(1);
  });

  it("reversed direction is invariant (span count depends on endpoints, not orientation)", () => {
    const edges = [{ id: "e", source: "b", target: "a" }];
    const layerOf = new Map<string, number>([
      ["a", 0],
      ["b", 2],
    ]);
    const demand = estimateCorridorDemand(edges, layerOf);
    expect(demand.get(0)).toBe(1);
    expect(demand.get(1)).toBe(1);
  });
});

describe("computeCorridorGap", () => {
  const baseGap = 64;

  it("demand=0 collapses to baseGap (cap not active)", () => {
    const { gap, capActive } = computeCorridorGap(0, baseGap);
    expect(gap).toBe(baseGap);
    expect(capActive).toBe(false);
  });

  it("moderate demand widens gap linearly with track count", () => {
    // 4 tracks: 4*8 + 2*8 = 48, below baseGap 64 -> gap = baseGap.
    expect(computeCorridorGap(4, baseGap).gap).toBe(baseGap);
    // 8 tracks: 8*8 + 2*8 = 80, above baseGap.
    const { gap, capActive } = computeCorridorGap(8, baseGap);
    expect(gap).toBe(80);
    expect(capActive).toBe(false);
  });

  it("cap activates when demand exceeds maxGapFactor*baseGap", () => {
    // 24 tracks: 24*8 + 16 = 208, cap = 3*64 = 192.
    const { gap, capActive } = computeCorridorGap(24, baseGap);
    expect(gap).toBe(CORRIDOR_MAX_GAP_FACTOR * baseGap);
    expect(capActive).toBe(true);
  });

  it("named constants match the router's nudging defaults", () => {
    expect(CORRIDOR_TRACK_GAP).toBe(8);
    expect(CORRIDOR_CLEARANCE).toBe(8);
    expect(CORRIDOR_MAX_GAP_FACTOR).toBe(3);
    expect(CORRIDOR_DRIFT_TOLERANCE).toBe(1);
  });
});

// Helper: build a fan-in scene where N sources on layer 0 target one
// sink on layer 1. Horizontal flow (default RIGHT), so the corridor
// runs vertically between the two columns.
function fanInFixture(n: number): StructuralGraphInput {
  const nodes = [
    ...Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      width: 60,
      height: 40,
    })),
    { id: "t", width: 60, height: 40 },
  ];
  const edges = Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    source: `s${i}`,
    target: "t",
  }));
  return { nodes, edges };
}

describe("g3tLayoutStructural: per-corridor gap widening", () => {
  it("small fan-in (baseline): flow extent stays at baseGap", () => {
    const geometry = g3tLayoutStructural(fanInFixture(2), {
      routeEdges: false,
    });
    const xs = Object.values(geometry.nodes).map((n) => n.x);
    const layer0Right = Math.max(
      ...xs.filter((x, i) => Object.keys(geometry.nodes)[i]?.startsWith("s")),
    );
    const layer1Left = geometry.nodes["t"]?.x ?? 0;
    const gap = layer1Left - (layer0Right + 60);
    // 2 tracks: 2*8+16 = 32 < baseGap 64 -> gap == baseGap 64.
    expect(gap).toBe(64);
  });

  it("high fan-in widens the corridor above baseGap", () => {
    const geometry = g3tLayoutStructural(fanInFixture(12), {
      routeEdges: false,
    });
    const sourceIds = Object.keys(geometry.nodes).filter((id) =>
      id.startsWith("s"),
    );
    const layer0Right = Math.max(
      ...sourceIds.map((id) => (geometry.nodes[id]?.x ?? 0) + 60),
    );
    const layer1Left = geometry.nodes["t"]?.x ?? 0;
    const gap = layer1Left - layer0Right;
    // 12 tracks: 12*8 + 16 = 112, below cap (3*64=192) -> gap 112.
    expect(gap).toBe(112);
  });

  it("extreme fan-in triggers the maxGapFactor cap", () => {
    const geometry = g3tLayoutStructural(fanInFixture(40), {
      routeEdges: false,
    });
    const sourceIds = Object.keys(geometry.nodes).filter((id) =>
      id.startsWith("s"),
    );
    const layer0Right = Math.max(
      ...sourceIds.map((id) => (geometry.nodes[id]?.x ?? 0) + 60),
    );
    const layer1Left = geometry.nodes["t"]?.x ?? 0;
    const gap = layer1Left - layer0Right;
    // 40 tracks: 40*8 + 16 = 336, capped at 3*64 = 192.
    expect(gap).toBe(192);
  });
});

describe("g3tLayoutStructural: drift assertion", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it("does not warn when the router's demand fits inside the estimate", () => {
    process.env.NODE_ENV = "development";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    g3tLayoutStructural(fanInFixture(3), { nudge: true });
    // 3 tracks estimated, router should stay within tolerance.
    expect(warn).not.toHaveBeenCalled();
  });

  it("stays silent in production even when a drift could occur", () => {
    process.env.NODE_ENV = "production";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    g3tLayoutStructural(fanInFixture(20), { nudge: true });
    expect(warn).not.toHaveBeenCalled();
  });
});
