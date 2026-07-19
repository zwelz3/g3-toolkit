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
import { layoutStructural, type StructuralGraphInput } from "./structural";
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
  // RETIRED WITH ELK (D3b part 1, 2026-07-19): the two LAY-018
  // collapse-hold oracles here were pinned to the elk pipeline and
  // asserted ITS hold behavior. Position-hold under the g3t engine
  // is recorded against the collapse reintroduction (WS-D design
  // doc); the oracle returns with the feature, engine-native.

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
