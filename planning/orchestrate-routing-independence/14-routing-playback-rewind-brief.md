---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 14: deterministic idempotent playback/rewind for edge-routing eval

Owner ask (Jake, A30): "include in the example a deterministic
idempotent playback/rewind feature so we can eval edge routing."

## Grounding (verify at implementation time against the live tree —
## brief 01's worker is editing these areas as this brief is written)

- The Routing Lab (src/demo/routing/: RoutingShell.tsx, scenarios.ts,
  quality.ts) is the edge-routing stress bench; quality.ts computes
  per-scenario route-quality metrics.
- Core already has the rewind substrate:
  packages/core/src/model/change-set.ts exports `applyChangeSet`,
  `invertChangeSet`, `serializeChangeSet`/`parseChangeSet` — a
  versioned JSON document, i.e. one of the three adopter channels.
- Layout metrics: packages/core/src/metrics/layout-metrics.ts
  (computeLayoutMetrics, metricsFromStructural).

## Feature

A **recorded step script** per scenario: an ordered list of
ChangeSets (node moves simulating drags, node/edge add/remove,
collapse/expand) stored as serialized JSON next to scenarios.ts. The
Routing Lab gets transport controls: step-forward, step-back, jump-
to-step scrubber, play.

- **Playback** = fold ChangeSets 0..k onto the scenario's base graph,
  then run layout+routing.
- **Rewind** = apply `invertChangeSet` of the current step (and
  assert the result equals the forward-computed state at k-1 — the
  inversion correctness check rides the feature).
- **Deterministic**: every stochastic input is pinned — seeded rng
  for any force/Louvain path (mulberry32 pattern already used in
  scale tests), fixed viewport, `animate` off. Same script + same
  step index => byte-identical positions and routes, across runs and
  across play/rewind/replay orders.
- **Idempotent eval**: at every step the lab computes and displays
  the routing metrics (crossings, bends, route length, box
  violations from quality.ts) so a routing change (briefs 01, 03-05,
  10) can be evaluated per-step: run the script before and after,
  diff the metric series.

## Work

1. **Demo-side step engine** (src/demo/routing/): script format
   (versioned JSON of serialized ChangeSets + seed + description),
   `stateAtStep(script, k)` pure function, transport UI in
   RoutingShell. At least two scripts: a drag-storm on Prune Wall
   (the A28 long-edge scenario) and an add/remove churn script.
2. **Metric series export**: button + programmatic helper dumping
   `{step, metrics}[]` as JSON for offline diffing between routing
   builds.
3. **Determinism + idempotence tests** (vitest, headless — geometry
   only, no pixel assertions): (a) stateAtStep(k) called twice ==
   deep-equal geometry; (b) forward-to-k equals
   forward-to-n-then-rewind-to-k; (c) metric series stable across two
   independent playbacks.
4. **Wiring-guide note** only if any core export is added; the
   preferred shape is demo-local composition of existing core APIs
   (change-set + layout + metrics) with zero new core surface.

## Constraints

- Coordinate with brief 01's landed changes in quality.ts — rebase on
  its committed state, never assume the pre-01 file.
- No new runtime dependencies; no core API changes unless a genuine
  gap in change-set/metrics surfaces (record it as a Discovery atom
  first).
- Camera doctrine: stepping is a same-graph change when the node-id
  set is unchanged (no refit); a step that adds/removes nodes is a
  genuine graph change and MAY refit per D15.

## Acceptance

- Transport controls work in the Routing Lab; stepping is visibly
  deterministic (routes identical after rewind/replay).
- All three test families green; `pnpm run gates` green.

## Rollback

Demo-local feature + scripts; single revert, no package surface
change expected.
