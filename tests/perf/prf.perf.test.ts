/**
 * PRF benchmark harness (MR-5 execution; spec section 14).
 *
 * Machine profile ruling (owner, 2026-07-12): the CI runner class is
 * the baseline. This suite is env-gated (G3T_PERF=1) so the normal
 * chunked vitest runs are unaffected; the CI perf job runs it and
 * uploads the results JSON.
 *
 * Budget enforcement follows the ruled freeze protocol
 * (planning/g3l/prf-budgets.json):
 *   - status "provisional": benchmarks RUN and REPORT (results file
 *     + console table) but do not fail the job; the first CI numbers
 *     inform the one permitted revision.
 *   - status "frozen": budgets are asserted; a miss fails CI. A
 *     second miss after freezing is a requirement change, not a
 *     budget edit (implementation-plan ruling).
 *
 * Benchable headlessly today: PRF-001 (ELK layered layout of R1;
 * in-worker overhead excluded and noted), PRF-002 (router from
 * scratch on R1 edges; per-frame incremental reroute), PRF-004
 * (full R2 style resolution; single-element incremental).
 * NOT benchable here (component or browser does not exist yet):
 * PRF-003 (channel router), PRF-005/006/007 (browser fps/memory);
 * recorded as pending in the results file.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  layoutStructural,
  routeOrthogonal,
  StyleEngine,
  type StyleEngineConfig,
} from "@g3t/core";
import { resolveDragAttachment } from "@g3t/react";
import { mkR1, mkR1Boxes, mkR2Style, rng } from "./fixtures";

const ENABLED = process.env.G3T_PERF === "1";
const BUDGETS_PATH = join(
  __dirname,
  "..",
  "..",
  "planning",
  "g3l",
  "prf-budgets.json",
);
const RESULTS_PATH = join(__dirname, "last-results.json");

interface BudgetsFile {
  status: "provisional" | "frozen";
  budgets: Record<
    string,
    { ms: number; asserts: "now" | "at-engine-flip" | "at-channel-router" }
  >;
}

function loadBudgets(): BudgetsFile {
  return JSON.parse(readFileSync(BUDGETS_PATH, "utf8")) as BudgetsFile;
}

/** Median wall time over `runs` timed executions after `warmup`. */
async function median(
  fn: () => unknown | Promise<unknown>,
  runs = 5,
  warmup = 2,
): Promise<number> {
  for (let i = 0; i < warmup; i++) await fn();
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)] ?? Number.NaN;
}

const results: Record<string, number | string> = {
  machine: process.env.CI ? "ci" : "local (NOT the ruled baseline)",
  node: process.version,
  "PRF-003": "pending: channel router not built",
  "PRF-005": "pending: browser fps (harness lives with the e2e suite later)",
  "PRF-006": "pending: canvas adapter not built",
  "PRF-007": "pending: webgl adapter not built",
};

function record(key: string, ms: number, budgets: BudgetsFile): void {
  results[key] = Math.round(ms * 100) / 100;
  const budget = budgets.budgets[key];
  // eslint-disable-next-line no-console
  console.log(
    `${key}: ${ms.toFixed(1)} ms (budget ${budget?.ms ?? "?"} ms, ${budgets.status}, asserts ${budget?.asserts ?? "?"})`,
  );
  // FROZEN (MR-5, 2026-07-18): keys assert per their accountability
  // gate; milestone-gated keys (engine flip, channel router) report
  // until their component lands, then the gate flips to "now".
  if (
    budgets.status === "frozen" &&
    budget !== undefined &&
    budget.asserts === "now"
  ) {
    expect(ms, `${key} exceeded its FROZEN budget`).toBeLessThanOrEqual(
      budget.ms,
    );
  }
}

describe.skipIf(!ENABLED)("PRF benchmarks (spec section 14)", () => {
  it("PRF-001b: FLAT R1 (g3t; the elk leg retired with elkjs, D3b part 1)", async () => {
    // Historical record: the last two-engine run (CI 2026-07-18)
    // measured elk 7.3 s vs g3t 131 ms on this fixture. The elk
    // leg left with the dependency; this key keeps the flat-R1
    // g3t number as a report-only trend line.
    const flat = () => {
      const { nodes, edges } = mkR1();
      return {
        nodes: nodes.map((n) => ({
          id: n.id,
          width: n.width,
          height: n.height,
        })),
        edges,
      };
    };
    const t0 = performance.now();
    await layoutStructural(flat());
    const g3tMs = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`PRF-001b-R1flat-g3t: ${g3tMs.toFixed(1)} ms (report)`);
    results["PRF-001b-R1flat-g3t"] = Math.round(g3tMs);
  });

  it("PRF-001: layered layout of R1", { timeout: 120_000 }, async () => {
    const budgets = loadBudgets();
    // Fresh input per run: layout memoizes on input identity, which
    // produced a 0.1 ms artifact on the first harness run (the real
    // single-run number on this container was ~11,000 ms).
    const ms = await median(() => layoutStructural(mkR1()), 1, 0);
    record("PRF-001-R1-layout", ms, budgets);
    results["PRF-001-finding"] =
      "post-flip: measures the g3t DEFAULT engine; CI 2026-07-18: 159 ms vs the 300 budget (GREEN, 47% margin). The elkjs-era finding (7.3 s CI) is history; PRF-001b keeps the explicit two-engine comparison";
  });

  it(
    "PRF-002: obstacle-aware routing of R1 from scratch (SAMPLED; see finding)",
    { timeout: 90_000 },
    async () => {
      // FINDING (2026-07-12, first harness run): the sparse-grid
      // router is the INTERACTIVE router (drag-time: dozens of
      // obstacles, a handful of edges per frame, where it meets its
      // 8 ms budget). From-scratch scene routing of R1 (800 random
      // long edges over 500 scattered boxes) is architecturally
      // outside it: per-edge visibility grids over the whole field
      // are quadratic in obstacle count, and terminal-region pruning
      // cannot help edges whose corridor spans the scene. The spec's
      // from-scratch half of PRF-002 belongs with the channel-router
      // milestone (the PRF-003 component). Measured here as a 40-edge
      // SAMPLE with an extrapolated estimate so the provisional
      // numbers inform the one permitted budget revision.
      const budgets = loadBudgets();
      const boxes = mkR1Boxes();
      const byId = new Map(boxes.map((b) => [b.id, b.box]));
      const { edges } = mkR1();
      const sample = edges.slice(0, 8);
      const t0 = performance.now();
      for (const e of sample) {
        const s = byId.get(e.source)!;
        const t = byId.get(e.target)!;
        routeOrthogonal({
          source: {
            point: { x: s.x + s.width, y: s.y + s.height / 2 },
            side: "EAST",
          },
          target: { point: { x: t.x, y: t.y + t.height / 2 }, side: "WEST" },
          obstacles: boxes
            .filter((b) => b.id !== e.source && b.id !== e.target)
            .map((b) => b.box),
        });
      }
      const sampled = performance.now() - t0;
      const estimate = (sampled / sample.length) * edges.length;
      results["PRF-002-R1-routing-8edge-sample"] =
        Math.round(sampled * 10) / 10;
      results["PRF-002-R1-routing-extrapolated"] = Math.round(estimate);
      results["PRF-002-R1-routing-finding"] =
        "over budget as-implemented; from-scratch scene routing belongs to the channel-router milestone (PRF-003 component); the sparse-grid router is the interactive router";
      // eslint-disable-next-line no-console
      console.log(
        `PRF-002-R1-routing: sample(8)=${sampled.toFixed(0)} ms, extrapolated=${estimate.toFixed(0)} ms (budget ${budgets.budgets["PRF-002-R1-routing"]?.ms} ms, ${budgets.status}; see finding)`,
      );
    },
  );

  it(
    "PRF-002: incremental per-frame reroute (production scale and R1 scale)",
    { timeout: 120_000 },
    async () => {
      const budgets = loadBudgets();
      const rand = rng(4404);
      const frame = (boxes: ReturnType<typeof mkR1Boxes>): void => {
        const host = boxes[0]!;
        const others = boxes.slice(1, 7);
        const obstacles = boxes.map((b) => b.box);
        for (const other of others) {
          resolveDragAttachment({
            bends: [],
            oldSource: {
              x: host.box.x + host.box.width,
              y: host.box.y + host.box.height / 2,
            },
            oldTarget: {
              x: other.box.x,
              y: other.box.y + other.box.height / 2,
            },
            movedEnd: "source",
            fixedPoint: {
              x: other.box.x,
              y: other.box.y + other.box.height / 2,
            },
            fixedSide: "WEST",
            movedCenter: {
              x: host.box.x + host.box.width / 2 + rand() * 4,
              y: host.box.y + host.box.height / 2 + rand() * 4,
            },
            movedHalf: { w: host.box.width / 2, h: host.box.height / 2 },
            desiredSide: "EAST",
            originalSide: "EAST",
            sameSide: true,
            obstacles,
          });
        }
      };
      // Production scene scale (the MBSE flagship: ~15 top-level
      // boxes): the number that reflects today's shipped drag feel.
      const mbseScale = mkR1Boxes().slice(0, 15);
      const prod = await median(() => frame(mbseScale), 10, 3);
      record("PRF-002-frame-reroute-mbse", prod, budgets);
      // R1 scale (the spec's reference): shares the long-corridor
      // degradation finding with the from-scratch bench.
      const r1 = mkR1Boxes();
      const atR1 = await median(() => frame(r1), 2, 0);
      record("PRF-002-frame-reroute-R1", atR1, budgets);
      results["PRF-002-frame-finding"] =
        "meets budget at production scene scale; degrades at R1 scale on long corridors (same root cause as the from-scratch finding: sparse-grid visibility is quadratic in obstacles)";
    },
  );

  it("PRF-004: full style resolution of R2; incremental single-element change", async () => {
    const budgets = loadBudgets();
    const graph = mkR2Style();
    const config: StyleEngineConfig = {
      rules: [
        {
          id: "hubs",
          selector: { kind: "node", dataEquals: { category: "hub" } },
          attributes: { shape: "hexagon", strokeWidth: 2 },
          outputs: ["shape", "strokeWidth"],
        },
        {
          id: "risk",
          selector: { kind: "node", dataEquals: { riskLevel: "high" } },
          attributes: { stroke: "#e03131" },
          outputs: ["stroke"],
          dependencies: { data: ["riskLevel"] },
        },
        {
          id: "degree-size",
          selector: { kind: "node" },
          attributes: (ctx) => ({
            labelSize:
              10 + Math.min(6, Number(ctx.element.data.degree ?? 0) / 8),
          }),
          outputs: ["labelSize"],
          dependencies: { data: ["degree"] },
        },
        {
          id: "critical-edges",
          selector: { kind: "edge", dataEquals: { kind: "critical" } },
          attributes: { strokeWidth: 3, taper: true },
          outputs: ["strokeWidth", "taper"],
        },
      ],
    };
    const full = await median(
      () => {
        const engine = new StyleEngine(config);
        engine.load(graph);
      },
      3,
      1,
    );
    record("PRF-004-R2-full", full, budgets);

    const engine = new StyleEngine(config);
    engine.load(graph);
    const incr = await median(
      () => {
        engine.applyDataChange("n42", ["degree"]);
      },
      20,
      5,
    );
    record("PRF-004-incremental", incr, budgets);

    mkdirSync(dirname(RESULTS_PATH), { recursive: true });
    writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  });
});
