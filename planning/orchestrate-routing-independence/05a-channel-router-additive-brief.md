---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 05a: channel router — additive module + fallback classifier (PRF-003, phase 1 of 2)

This is phase 1 of a two-phase split of Brief 05 (channel router).
The single-commit Brief 05 was bailed by a worker as exceeding a
single-run budget: it mandated landing a new channel/track model AND
deleting the escalation ladder + Brief-10 stage-A accept-site AND
re-pinning the six-scenario LAY005_BASELINE oracles in one atomic
commit. The re-pin is a chicken-and-egg trap — the "after" crossings/
bends numbers cannot be authored blind; they must be OBSERVED from a
working channel router. See the bail failure atom
`brief-05-channel-router-scope-exceeds-single` (g3_toolkit graph).

This brief (05a) lands the channel/track model and the fallback
classifier as PURE-ADDITIVE code behind an off-by-default flag, with
full unit-oracle coverage. It deletes nothing, rewires nothing, and
re-pins no lab baseline. Brief 05b (phase 2) does the rewire,
deletions, and baseline re-pin using THIS brief's flag-on run as the
observed baseline.

## Scope boundary (read first)

IN SCOPE (05a):
- New module implementing the channel/track model and geometry
  emission (design steps 1-3 below), as exported pure functions.
- The fallback classifier (design step 5 below) as an exported pure
  function computable from layered layout output.
- Unit oracles for track-assignment combinatorics, the demand
  overflow path, `dedupeCollinear` round-trip, and the three-condition
  fallback classifier.
- An off-by-default flag on `routeStructuralEdges` (e.g.
  `useChannelRouter?: boolean`, default `false`) that, when true,
  routes via the new module; when false (the default), behavior is
  byte-identical to today. The flag is transient scaffolding removed
  in 05b when the ladder is deleted; note this in the module so the
  no-legacy reviewer understands it is not permanent dual-path.

OUT OF SCOPE (deferred to 05b — do NOT do these here):
- Deleting the escalation ladder or its 4px retry.
- Deleting Brief-10 stage-A accept-site (`longEdgeNear` early-accept
  at ~`g3t-routing.ts:670`).
- Rewiring `g3tLayoutStructural` to consume the channel router by
  default.
- Re-pinning the six-scenario LAY005_BASELINE oracles in
  `src/demo/routing/scenarios.test.ts`.
- Annotating the Brief 10 plan atom's supersession.
- Narrowing the 01 nudging scope to fallback-only.
- Consuming Brief 03's dummy-chain waypoint hints for channel
  selection (design step 3 hint-consumption). 05a's geometry emission
  works from track index alone; waypoint-hint corridor selection is a
  05b integration concern.

The dependency gates below are still verified in 05a because the
additive module reads the corridor `demand`/`trackGap` geometry that
Brief 04 supplies.

## Dependencies and dispatch gates (verify before implementing)

- **Brief 04 (corridor supply):** shipped (`725299e`). Confirm
  `g3tLayoutFlat` and `g3tLayoutStructural` accept and use the
  `trackGap` / `maxGapFactor` option pair and the gap sizing
  `gap = max(baseGap, demand * trackGap + 2 * clearance)` is live in
  both. The channel model reads these widths; if wrong, all track-gap
  geometry is wrong.
- **Brief 03 (dummy chains):** shipped (`cc38406`). 05a does not
  consume the dummy-chain hints (deferred to 05b), so no interface pin
  is required here; only note that `g3t-dummy-chain.ts` exists so 05b
  can wire it.
- **Caller audit (routeStructuralEdges):** the bail's pre-audit found
  5 caller sites (`packages/core/src/index.ts:187` export,
  `packages/core/src/layout/index.ts:7` re-export, four direct calls
  in `structural-patterns.test.ts`, one dynamic import in
  `g3t-layered.test.ts:685`), none branching on perimeter-route-
  specific format. Re-confirm this holds. Because 05a only ADDS an
  optional off-by-default parameter, no caller needs updating; record
  the re-confirmation in the commit message.

## Design (additive slice)

1. Corridor/channel model: the inter-layer gaps (demand-sized by
   Brief 04) are first-class channels. An edge's path is a sequence of
   channel traversals plus node-side stubs (anchors/fans unchanged).

2. Track assignment inside each channel is combinatorial at
   construction time. Edges entering a channel are ordered by the
   libavoid divergence sort — key `(entry cross-coord, exit
   cross-coord, edge id)` — and assigned integer tracks BEFORE
   geometry exists; crossings inside a channel are minimized by
   ordering, not discovered by collision.

   Track count bound: the number of edges assigned tracks in a channel
   must not exceed the `demand` value Brief 04 used to size that
   channel's gap. If the actual entering-edge count exceeds `demand`,
   detect the overflow, log an error in debug mode, and route the
   excess edges via `routeOrthogonal` rather than assigning tracks
   outside the gap geometry. A unit oracle asserts: for every channel,
   assigned-track-index count <= demand. This is a gate-green test
   assertion (a failure, not a warning).

   Degenerate ties: equal entry cross-coord resolves by exit
   cross-coord (the rainbow "uncrossing" order); fully tied entry+exit
   is crossing-equivalent under any stable sort, and edge id gives
   determinism. Assert the fully-tied case still yields DISTINCT
   integer tracks and never produces coincidentRuns violations.

3. Geometry emission: track index -> y (or x) offset from the channel
   midline at `trackGap` spacing; bend points at channel entry/exit;
   `dedupeCollinear` finish pass. Track separation MUST be expressed as
   genuine orthogonal bends (nonzero offset), never as a zero-length or
   collinear marker that `dedupeCollinear` would collapse.

5. Fallback classifier (algorithmic, not by-example): an edge routes
   via `routeOrthogonal` iff it satisfies at least one condition, all
   verifiable from the layered graph produced by `g3tLayoutStructural`
   / `g3tLayoutFlat` WITHOUT running any routing:

   a. Same-layer edge: `source.layer === target.layer` (cycle arcs,
      self-layer connections).
   b. Anti-monotone edge: the shortest path from source layer to
      target layer in the layer-adjacency graph requires a step
      opposite to the dominant layout flow (a backward arc).
   c. Compound-boundary edge: the route AABB (axis-aligned bounding box
      of source endpoint to target endpoint) overlaps at least one
      compound container node's bounding box, AND that container is not
      a shared ancestor of both endpoints (neither endpoint's `parent`
      is the container). Geometry-free bounding-box containment only;
      uses node boxes + `parent?: string` from the structural input.
      If ambiguous (multiple nested compounds), classify as fallback
      conservatively.

   Ship the classifier as an exported pure function returning the
   fallback set (and, in debug mode, the per-edge condition that
   fired). 05a does NOT change the nudging call site; it only makes the
   classifier available and unit-tests it. (05b consumes it to narrow
   nudging.)

## Verification (05a gates)

All standard gates green (`pnpm run gates` = typecheck && lint &&
verify && test, plus the three `python3` spec scripts exit 0). Do NOT
pipe gate scripts through tail/head; check `$?` directly.

Additive-specific oracles:
- Flag default off => byte-identical routing. Add a test asserting
  that with `useChannelRouter` unset/false the `routeStructuralEdges`
  output on an existing lab scenario is unchanged from today. This is
  the non-regression guarantee that lets 05a land without re-pinning
  the six-scenario baseline.
- Track assignment combinatorics: given N edges with specified
  `(entry, exit)` cross-coord pairs, assert assigned track indices
  match the rainbow order from the libavoid sort. Pathological inputs:
  all-same entry (ordered by exit), all-same entry AND exit (any
  stable order; assert coincidentRuns = 0 and distinct integer
  tracks), single-node-to-many-channel fan.
- Demand overflow: N edges where N > demand; assert the overflow edges
  route via `routeOrthogonal` and the track-count-bound oracle passes.
- `dedupeCollinear` round-trip: given track-separated geometry with
  genuine orthogonal bends, assert `dedupeCollinear` removes no bend;
  given a polyline with a collinear intermediate (three collinear
  points), assert the middle is removed. Confirms the module does not
  rely on collinear markers.
- Fallback classifier: unit scenarios that exercise each of 5a
  (same-layer backedge), 5b (anti-monotone backward arc), and 5c
  (compound-boundary via AABB containment), asserting the correct
  condition fires. If no existing lab scenario contains an
  anti-monotone edge or a same-layer compound backedge, build a small
  synthetic layered fixture for the unit test rather than editing the
  lab scenarios.
- Determinism byte-identical; ledger note for any core chunk growth
  (rationale in `scripts/check-bundle-size.mjs`).

## Rollback

Purely additive behind an off-by-default flag: `git revert <sha>`
removes the module, the classifier, the flag, and the unit tests with
zero impact on shipped routing (the default path never called the new
code). No `kb verify` annotation cleanup is needed because 05a adds no
supersession arcs.

## Worker contract

- Emit inline `kb log` atoms during the run: a `kb log decision` for
  the channel/track model and classifier design as landed, `kb log
  discovery` for any nontrivial fact found about the layered-layout
  output surface (e.g. exactly which fields carry layer index / parent
  / bbox), `kb log gotcha` for any trap. Link them with `--part-of`
  the Plan IRI in this frontmatter.
- Link the commit with `--implemented-by <sha>`.
- Write `outcome.json` (outcome/atoms_emitted/commit_shas/
  files_changed/summary/duration_min/blockers) and end with the
  one-line stdout summary `done: <n> atoms; commit=<sha>; <outcome>`.
- If a genuine blocker stops you, do NOT exit 0 silently: `kb log
  failure` + `outcome: bailed` + the reason. This is the authorized
  executor for this brief — execute it; do not defer or ask for
  confirmation.

## Handoff to 05b

On success, 05a leaves: the channel-router module + fallback
classifier exported and unit-green, reachable via
`useChannelRouter=true` but off by default. 05b then: turns the flag on
in `g3tLayoutStructural`, deletes the escalation ladder + 4px retry +
Brief-10 stage-A accept-site (no-legacy), removes the transient flag,
narrows the 01 nudging pass to fallback+mixed-mode edges only, consumes
Brief 03's dummy-chain `intermediate` waypoints for channel selection,
annotates the Brief 10 plan atom's supersession, and re-pins the
six-scenario LAY005_BASELINE using the 05a flag-on run as the observed
baseline.
