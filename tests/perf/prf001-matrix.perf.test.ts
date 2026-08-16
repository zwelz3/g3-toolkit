/**
 * PRF-001 measurement sharpening (owner-approved plan, 2026-07-12).
 *
 * The round-24 finding ("~40x over target") carried two caveats:
 * cold-including-init measurement, and a non-baseline container.
 * This matrix hardens the number the WS-D design doc will be built
 * on:
 *  - COLD vs WARM: first layout in the process (elkjs init included)
 *    vs subsequent layouts with FRESH inputs (cache-defeating,
 *    init amortized).
 *  - ASSEMBLY vs ELK: our graph assembly (buildStructuralElkGraph)
 *    timed separately from the elk.layout call, so the finding
 *    attributes cost to the right component.
 *  - TUNING VARIANTS through the PUBLIC options: edge routing
 *    (ORTHOGONAL default vs POLYLINE), node placement
 *    (BRANDES_KOEPF default vs SIMPLE vs LINEAR_SEGMENTS), crossing
 *    minimization (LAYER_SWEEP default vs INTERACTIVE), and the
 *    cheap-everything combination.
 *
 * Gated separately from the CI perf job (G3T_PERF_MATRIX=1): this is
 * an investigation artifact, not a recurring gate. Results append to
 * tests/perf/last-results.json under prf001Matrix.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { layoutStructural } from "@g3t/core";
import type { StructuralLayoutOptions } from "@g3t/core";
import { buildStructuralElkGraph } from "../../packages/core/src/layout/structural";
import { mkR1 } from "./fixtures";

const ENABLED = process.env.G3T_PERF_MATRIX === "1";
const RESULTS_PATH = join(__dirname, "last-results.json");

async function timeLayout(options?: StructuralLayoutOptions): Promise<number> {
  const input = mkR1();
  const t0 = performance.now();
  await layoutStructural(input, options);
  return performance.now() - t0;
}

describe.skipIf(!ENABLED)("PRF-001 sharpening matrix", () => {
  it(
    "cold/warm split, assembly/elk split, tuning variants",
    { timeout: 600_000 },
    async () => {
      const out: Record<string, number> = {};
      const log = (k: string, ms: number) => {
        out[k] = Math.round(ms * 10) / 10;
        // eslint-disable-next-line no-console
        console.log(`${k}: ${ms.toFixed(1)} ms`);
      };

      // COLD: the first layout in this process (elkjs init included).
      log("cold-default", await timeLayout());

      // WARM default: median of 3 fresh-input runs.
      const warmRuns: number[] = [];
      for (let i = 0; i < 3; i++) warmRuns.push(await timeLayout());
      warmRuns.sort((a, b) => a - b);
      log("warm-default", warmRuns[1] ?? Number.NaN);

      // ASSEMBLY alone (our code; no elk call).
      {
        const input = mkR1();
        const t0 = performance.now();
        buildStructuralElkGraph(input);
        log("assembly-only", performance.now() - t0);
      }

      // RETIRED 2026-08-15 with the options they varied. Five variants
      // measured edgeRouting, nodePlacement and crossingMinimization
      // (warm-polyline, warm-place-simple, warm-place-linear,
      // warm-cross-interactive, warm-cheap-combo). Since elkjs left the
      // tree those options fed a string map no engine reads, so every
      // variant ran the identical code path and the matrix was
      // reporting run-to-run noise as a tuning delta. Do not restore
      // them against options that do not reach an engine; a variant is
      // worth measuring when something downstream branches on it.
      //
      // Tuning variants that DO branch (layering, placement, the three
      // budget knobs on G3tLayoutOptions) belong here and are not yet
      // covered.

      const prior = existsSync(RESULTS_PATH)
        ? (JSON.parse(readFileSync(RESULTS_PATH, "utf8")) as Record<
            string,
            unknown
          >)
        : {};
      writeFileSync(
        RESULTS_PATH,
        JSON.stringify({ ...prior, prf001Matrix: out }, null, 2),
      );
      expect(Object.keys(out).length).toBeGreaterThan(5);
    },
  );
});
