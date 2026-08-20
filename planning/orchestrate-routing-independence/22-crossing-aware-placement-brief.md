# Brief 22 — crossing-aware placement optimizer (@g3t/core)

project: g3_toolkit
cwd: /GSystems/src/g3-toolkit
branch: docs/ai-agent-guide (local commit only; NO push, NO PR)
model: opus
part_of: orchestrate-routing-independence (advanced smart routing capability, A54)

## Goal (verified against live tree 2026-08-19 — do not re-derive)

Add a NEW crossing-aware placement optimizer for non-structural (point-node)
scenes. Owner ruling A54: "optimum placement" = a whole crossing-aware placement
pass that PLACES nodes to avoid crossovers (answer (b), not just a minimal
untangle). "Fewer crossings is fine" (not guaranteed-zero) and the pass must run
**under 350ms**. This brief ships ONLY the pure @g3t/core function + tests.
Wiring (imperative ops, demos) is briefs 23/24.

## Substrate that already exists (reuse, do not reinvent)

- `packages/core/src/metrics/layout-metrics.ts` exports `countCrossings(edges)`
  (O(S^2) pairwise segment crossings across DIFFERENT edges) and the
  `MetricsEdge` shape (`{ id, points: {x,y}[] }`). This IS the objective — build
  2-point polylines (source-center -> target-center) and call it. VERIFY the
  export name and MetricsEdge field names by reading the file before importing.
- `ForceLayout` (`packages/core/src/layout/force-layout.ts`) is the existing
  point-node placer; the optimizer SEEDS from caller-supplied positions (which
  the demos derive from whatever layout ran), it does NOT depend on ForceLayout.

## Deliverable

New file `packages/core/src/layout/crossing-aware-placement.ts`:

```ts
export interface PlacementNode { id: string; x: number; y: number; width: number; height: number; }
export interface PlacementEdge { id: string; source: string; target: string; }
export interface OptimizePlacementOptions {
  /** Hard wall-clock ceiling. Default 350 (owner budget A54). */
  budgetMs?: number;
  /** Seed for the internal RNG so runs are deterministic. Default 1. */
  seed?: number;
  /** Max candidate iterations regardless of budget. Default 2000. */
  maxIterations?: number;
}
export interface PlacementResult {
  /** New positions keyed by node id (box TOP-LEFT, same convention as input). */
  positions: Map<string, { x: number; y: number }>;
  crossingsBefore: number;
  crossingsAfter: number;
  iterations: number;
  elapsedMs: number;
  /** true when crossingsAfter <= crossingsBefore AND positions returned. */
  improved: boolean;
}
export function optimizePlacement(
  nodes: readonly PlacementNode[],
  edges: readonly PlacementEdge[],
  opts?: OptimizePlacementOptions,
): PlacementResult;
```

### Algorithm (bounded best-seen hill-climb; keep it simple and pure)

1. Objective = straight-line crossings: for a position map, build `MetricsEdge[]`
   where each edge is a 2-point polyline between its endpoints' box CENTERS, then
   `countCrossings`. This is the cheap proxy; the orthogonal router cleans bends
   downstream, so optimizing straight-line crossings is the right target.
2. Seed positions = input positions (copy; NEVER mutate the input arrays).
   `crossingsBefore` = objective(seed).
3. Seeded RNG (small deterministic mulberry32-style generator inline — do not add
   a dependency; `packages/core/src/scale/collapse-by-cluster.test.ts` has a
   `mulberry32` reference to mirror).
4. Loop until `elapsedMs >= budgetMs` OR `iterations >= maxIterations` OR a
   no-improve streak cap: pick a node incident to at least one crossing; try a
   candidate move — either (a) SWAP its position with another random node, or
   (b) relocate it to the centroid of its graph neighbors. Evaluate objective
   delta; accept iff crossings strictly decrease (pure hill-climb; best-seen is
   the accepted state). Track best-seen positions + crossing count.
5. Return best-seen. `crossingsAfter` = objective(best). `improved` = best <= before.
   If the seed is already crossing-free, return the seed unchanged, 0-1 iterations.

### Hard requirements

- PURE: no mutation of input `nodes`/`edges`; return a fresh Map.
- Node id set is PRESERVED (reposition only; never add/drop a node) — this keeps
  the canvas "same input graph" contract intact so callers can apply positions
  without a re-init.
- Wall-clock cap is REAL: check `performance.now()` (or `Date.now()`) each
  iteration and stop at `budgetMs`. Default 350.
- Deterministic for a fixed seed (same input + seed => byte-identical positions).
- Barrel export from `packages/core/src/index.ts` (add the three types + the fn;
  ASSERT the export anchor line exists before editing, per editing discipline).

## Tests (`packages/core/src/layout/crossing-aware-placement.test.ts`)

- A hand-built 4-node fixture whose default placement forces 1+ straight-line
  crossing and whose swapped placement is crossing-free => `crossingsAfter <
  crossingsBefore` and `improved === true`.
- Determinism: same input + seed twice => equal positions Map.
- Already-clean fixture (a path graph placed monotonically) => returns seed,
  `crossingsAfter === crossingsBefore === 0`.
- Budget respected: a larger fixture with `budgetMs: 50` returns in well under
  ~200ms (assert `elapsedMs` is bounded; do not assert an exact ms).
- Purity: input arrays unchanged after the call (deep-equal a pre-call clone).

## Gates (this repo — run ALL, do not tail/head, check $? directly)

    pnpm run gates
    # typecheck && lint && verify && test && gates:spec (FIVE steps, ci.yml order)
    # `verify` runs the bundle ledger. A core addition may push the core bundle;
    # if it does, add a DATED rationale line in scripts/check-bundle-size.mjs
    # (the ledger) and bump the budget — do NOT silently raise.

KNOWN PRE-EXISTING REDS on this branch (NOT yours; confirm via `git stash` that
they predate your diff, then proceed): 58 lint errors in `.verify-snippets/`,
`check-readme-snippets.mjs` on landing.html, 3 fails in `g3t-nudging.test.ts`.
If the host reports gates red only because `python` is missing, rerun the spec
gates with `python3` (scripts/lint_specs.py, sync_spec_status.py,
check_roadmap_coverage.py).

## Landing

- Local commit to `docs/ai-agent-guide`. NO push, NO PR (standing instruction).
- Emit inline `kb log` atoms: a kb:Decision for the optimizer design choice
  (straight-line-crossing proxy + bounded best-seen hill-climb, <350ms) and a
  kb:Discovery if the budget/quality tradeoff surfaces anything.
- outcome.json + one-line stdout summary per worker contract.

## Acceptance

- `optimizePlacement` exported from @g3t/core; 5 tests green.
- Reduces crossings on the crossing fixture; deterministic; budget-bounded; pure.
- `pnpm run gates` green except the three documented pre-existing reds.
