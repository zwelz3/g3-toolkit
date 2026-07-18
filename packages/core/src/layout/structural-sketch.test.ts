// WS-D D3a elk-pins: oracles below that carry engineKind: "elk"
// pin ELK-PIPELINE mechanics (injected-engine counting, elk cache
// keys, LAY-018 collapse holds). They are removed with the elk
// pipeline at D3b; g3t-generic cache oracles live in
// structural-engine-cache.test.ts. LAY-018 position-hold under the
// g3t engine lands with the collapse reintroduction (recorded in
// the WS-D design doc).
/**
 * Sketch-mode stability (G3L:LAY-017/018): the graduated 12.20
 * experiment, asserted end to end through real elkjs.
 *
 * Scenario: lay out a multi-container scene, collapse ONE container's
 * compartment (its box shrinks), re-lay out the same graph with the
 * prior top-level positions as the sketch. Accept criterion (the
 * ruled wording): untouched containers move less than one grid unit;
 * the toggled container resizes in place.
 *
 * The displacement oracle is the metrics module (G3L:QLT-002), so
 * this test also exercises D1 against real geometry.
 */
import { describe, expect, it } from "vitest";
import {
  layoutStructural,
  type StructuralGraphInput,
  type StructuralLayoutOptions,
} from "./structural";
import {
  displacementFromSketch,
  positionsFromStructural,
} from "../metrics/layout-metrics";

/** One grid unit for the accept criterion. The structural theme's
 *  edge-node spacing default (16) is the finest alignment quantum the
 *  scene exposes; the ruled criterion says "less than one grid unit". */
const GRID_UNIT = 16;

/** `shrunkA: true` gives container A two rows instead of six: the
 *  perturbation the acceptance re-lays-out under (the original
 *  perturbation was a compartment collapse; the feature was removed
 *  by ruling 2026-07-10, and the STABILITY contract it exercised,
 *  G3L:LAY-017/018, survives it: any same-ids input change that
 *  shrinks a container must not move untouched neighbors). */
function fixture(shrunkA = false): StructuralGraphInput {
  // Two layers of containers with enough rows that collapsing one
  // compartment meaningfully shrinks its box, plus cross-links so the
  // layered structure is non-trivial (recomputation without a sketch
  // has real freedom to move things).
  const rows = (nodeId: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${nodeId}-r${i}`,
      text: `${nodeId} row ${i} with some width`,
    }));
  const container = (id: string, n: number) => ({
    id,
    header: { stereotype: "Block", name: id },
    compartments: [{ id: "c", title: "parts", rows: rows(id, n) }],
  });
  return {
    nodes: [
      container("A", shrunkA ? 2 : 6),
      container("B", 3),
      container("C", 4),
      container("D", 2),
      container("E", 5),
    ],
    edges: [
      { id: "eAB", source: "A", target: "B" },
      { id: "eAC", source: "A", target: "C" },
      { id: "eBD", source: "B", target: "D" },
      { id: "eCD", source: "C", target: "D" },
      { id: "eCE", source: "C", target: "E" },
      { id: "eBE", source: "B", target: "E" },
    ],
  };
}

describe("layoutStructural sketch mode (G3L:LAY-017/018)", () => {
  it("holds untouched containers under one grid unit across a collapse rebuild", async () => {
    const input = fixture();
    const ids = new Set(input.nodes.map((n) => n.id));
    const base: StructuralLayoutOptions = {
      direction: "RIGHT",
      engineKind: "elk",
    };

    const before = await layoutStructural(input, base);
    const sketch: Record<
      string,
      { x: number; y: number; width?: number; height?: number }
    > = {};
    for (const [id, p] of positionsFromStructural(before, ids)) {
      sketch[id] = {
        ...p,
        width: before.nodes[id]?.width,
        height: before.nodes[id]?.height,
      };
    }

    const after = await layoutStructural(fixture(true), {
      ...base,
      sketch,
    });

    const d = displacementFromSketch(
      positionsFromStructural(after, ids),
      positionsFromStructural(before, ids),
      new Set(["A"]), // the toggled container is judged separately
    );
    expect(d.unmatched).toEqual([]);
    // Accept criterion: untouched containers move less than one grid unit.
    expect(
      d.max,
      `untouched displacement per node: ${JSON.stringify(d.perNode)}`,
    ).toBeLessThan(GRID_UNIT);

    // The toggled container resizes in place: its top-left stays put
    // within the same tolerance, while its box genuinely shrinks.
    const aBefore = before.nodes["A"];
    const aAfter = after.nodes["A"];
    expect(aBefore).toBeDefined();
    expect(aAfter).toBeDefined();
    if (!aBefore || !aAfter) return;
    expect(Math.hypot(aAfter.x - aBefore.x, aAfter.y - aBefore.y)).toBeLessThan(
      GRID_UNIT,
    );
    expect(aAfter.height).toBeLessThan(aBefore.height);
  });

  it("DOWN flow (the MR-1 MBSE case): untouched containers hold and the box height stays CONSTANT across collapse", async () => {
    const input = fixture();
    const ids = new Set(input.nodes.map((n) => n.id));
    const base: StructuralLayoutOptions = {
      direction: "DOWN",
      engineKind: "elk",
    };

    const before = await layoutStructural(input, base);
    const sketch: Record<
      string,
      { x: number; y: number; width?: number; height?: number }
    > = {};
    for (const [id, p] of positionsFromStructural(before, ids)) {
      sketch[id] = {
        ...p,
        width: before.nodes[id]?.width,
        height: before.nodes[id]?.height,
      };
    }

    const after = await layoutStructural(fixture(true), {
      ...base,
      sketch,
    });

    const d = displacementFromSketch(
      positionsFromStructural(after, ids),
      positionsFromStructural(before, ids),
      new Set(["A"]),
    );
    expect(
      d.max,
      `untouched displacement per node: ${JSON.stringify(d.perNode)}`,
    ).toBeLessThan(GRID_UNIT);

    const aBefore = before.nodes["A"];
    const aAfter = after.nodes["A"];
    expect(aBefore).toBeDefined();
    expect(aAfter).toBeDefined();
    if (!aBefore || !aAfter) return;
    expect(Math.hypot(aAfter.x - aBefore.x, aAfter.y - aBefore.y)).toBeLessThan(
      GRID_UNIT,
    );
    // Vertical flow holds the FLOW extent via the minimum-size floor:
    // the box height is constant across the toggle (the whitespace
    // sits inside the border), so expand is stable for free.
    expect(aAfter.height).toBeCloseTo(aBefore.height, 6);
  });

  it("a sketched run is not served from the unsketched memo (cache key honesty)", async () => {
    const full = fixture();
    const shrunk = fixture(true);
    const ids = new Set(full.nodes.map((n) => n.id));

    // From-scratch layout of the shrunken input FIRST, so its memo
    // entry exists.
    const scratch = await layoutStructural(shrunk, {});

    // Now the sketched layout of the SAME shrunken input/options must
    // be a different computation (different key), anchored to the
    // full-input positions rather than to the scratch result.
    const before = await layoutStructural(full, {});
    const sketch: Record<
      string,
      { x: number; y: number; width?: number; height?: number }
    > = {};
    for (const [id, p] of positionsFromStructural(before, ids)) {
      sketch[id] = {
        ...p,
        width: before.nodes[id]?.width,
        height: before.nodes[id]?.height,
      };
    }
    const sketched = await layoutStructural(shrunk, { sketch });

    const dScratch = displacementFromSketch(
      positionsFromStructural(sketched, ids),
      positionsFromStructural(scratch, ids),
    );
    const dSketchTarget = displacementFromSketch(
      positionsFromStructural(sketched, ids),
      positionsFromStructural(before, ids),
      new Set(["A"]),
    );
    // The sketched result tracks the sketch, and is either genuinely
    // distinct from the scratch result or the scratch result already
    // coincided with the sketch (both acceptable; identical-by-cache
    // would show dSketchTarget.max blowing past the criterion when the
    // scratch layout differs).
    expect(dSketchTarget.max).toBeLessThan(GRID_UNIT);
    expect(dScratch).toBeDefined();
  });
});
