---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 16: edge bundling (core geometry + scale-demo toggle)

Owner ask (Jake, A96): "what is missing from yfiles and other graph
display technologies — just add it." Gap analysis 2026-08-15: edge
bundling is yFiles' signature dense-graph legibility feature and g3t
has zero (`grep -riE 'bundl' packages/*/src` → nothing). It is the
natural companion to the shipped scale story (collapseByCluster,
brief 11) for the "hairball" middle ground where you have hundreds
to low-thousands of visible edges.

## Doctrine fit (read before objecting)

"Heavy graph ALGORITHMS stay external" means analytics (centrality,
community detection). Bundling is RENDERING GEOMETRY, which core
already owns end-to-end: the g3t layered engine, the orthogonal
router (`packages/core/src/route/orthogonal-router.ts`), and the
segments converter. Same category, in-scope.

## What exists to reuse (verified 2026-08-15)

- Polyline rendering path is SOLVED: `structural-to-cytoscape.ts:77`
  projects absolute route polylines onto `curve-style: segments`
  (class-based, since curve-style is an enum). The bundling renderer
  must reuse this projection pattern, not invent a parallel one.
- `computeLayoutMetrics` / positions maps in
  `packages/core/src/metrics/layout-metrics.ts` show the canonical
  `Record<nodeId, {x,y}>` position shape to accept as input.
- Scale demo (`src/demo/scale/ScaleSurface.tsx`) has the toggle
  pattern (e.g. `data-testid="scale-color-toggle"` at :422) and a
  model with `full`/`clustered` UGMs + aggregated cluster-links.

## Work

1. **Core module** — `packages/core/src/bundling/edge-bundling.ts`:
   `bundleEdges(positions: Record<string, XY>, edges: Array<{id,
   source, target}>, opts?) => Map<string, XY[]>` implementing
   force-directed edge bundling (FDEB, Holten & van Wijk 2009):
   subdivision-cycle schedule, Cauchy compatibility (angle, scale,
   position, visibility approximated by the standard three is fine),
   spring+electrostatic iteration. Hard requirements:
   - DETERMINISTIC: no RNG, fixed iteration schedule; same input =>
     same polylines (test asserts this).
   - BOUNDED: `opts.maxEdges` (default 2000) — beyond it return the
     input unbundled and set a `skipped: true` flag on the result
     (either widen the return to `{routes, skipped}` or a second
     export; pick one and document). O(E²) compatibility must be
     computed once, not per cycle.
   - Endpoints are NEVER moved: route[0] === source pos, route[last]
     === target pos (test).
   - Pure function, zero React, zero Cytoscape imports.
2. **Render bridge** — a small helper (core or react, follow where
   `segmentsToPoints` lives, `structural-to-cytoscape.ts:227`) that
   turns bundled polylines into the existing segments-class styling
   for ordinary force-view edges. Edges whose bundle route has no
   interior point keep their current curve-style untouched.
3. **Scale demo toggle** — "Bundle edges" checkbox
   (`data-testid="scale-bundle-toggle"`) in ScaleSurface, applied to
   the CLUSTERED view's aggregated links (that view is always under
   maxEdges). Recompute only on toggle/graph change, never per frame.
   Camera/position stability doctrine applies: bundling is a restyle
   + edge-geometry change, NOT a re-init; pan/zoom and node
   positions must hold (CLAUDE.md same-input-graph rule).
4. **Wiring** — wiring-guide section "Edge bundling": bundleEdges +
   render bridge snippet, maxEdges caveat, determinism note;
   executable twin in examples/wiring/.
5. **Tests** — determinism (two runs, deep-equal); endpoint
   preservation; parallel-edge convergence (a 2-clique bundle: two
   near-parallel edges end up with interior points closer together
   than their inputs); maxEdges bypass; toggle test in the scale
   demo (jsdom: assert the segments class/route data lands on the
   elements, no pixel assertions).

## Constraints

- Bundle budget: this is real new core code; if @g3t/core breaches
  its 196.0 KB budget, write the rationale line in
  scripts/check-bundle-size.mjs per the ledger rule — do NOT
  silently raise the cap without the rationale.
- No new runtime dependency. FDEB is ~200 lines of vector math.
- Keep iteration defaults modest (C=6 cycles, I=50 initial halving
  per cycle is the paper's schedule; expose in opts).

## Acceptance

- `bundleEdges` exported from @g3t/core, deterministic, bounded,
  endpoint-preserving (tests prove all three).
- Scale demo clustered view visibly bundles on toggle; camera holds.
- Wiring twin CI-green; `pnpm run gates` green (spec gates via
  python3 on this host).

## Worker contract

Emit inline `kb log` atoms during the run; write
/tmp/brief16-edge-bundling-outcome.json (outcome, atoms_emitted,
commit_shas, files_changed, summary, duration_min, blockers); first
stdout line `done: <n> atoms emitted; commit=<sha>; <outcome>`.
Commit on green gates.
