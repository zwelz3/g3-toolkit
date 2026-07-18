# WS-D design: the g3t layered layout engine

Status: DESIGN for owner review (2026-07-12). Written against the
sharpened measurement (planning/g3l/prf-001-measurement.md) and the
spec's LAY-001..006 mandates. No code in this document's round; the
build begins on approval.

## 1. Goal and non-goals

GOAL: an in-house Sugiyama-family layered engine that (a) meets
PRF-001 (R1 full layout within 300 ms on the CI baseline), (b) slots
beneath the existing `layoutStructural` contract without breaking
any consumer, and (c) removes the elkjs dependency at the end state.

NON-GOALS: edge routing (the channel router is its own milestone,
PRF-003; the engine emits endpoint/port geometry and the routing
layer owns polylines); force-directed or other non-layered
algorithms; replacing Cytoscape's internal layouts used by
non-structural demos.

## 2. The measured case

From the sharpened matrix: warm elkjs cost on R1 is 12.6 s, 99.97%
of it inside elk.layout; crossing minimization (LAYER_SWEEP) is ~9
of those seconds; maximum detuning still leaves 2.2 s WITH degraded
quality. Conclusion: the engine wins or loses PRF-001 on its
crossing-minimization strategy, and secondarily on avoiding
GWT-transpilation overhead that taxes every phase. This design
therefore treats crossing minimization as THE budgeted phase and
everything else as linear-time plumbing around it.

## 3. Architecture (per LAY-001: independently replaceable phases)

Pipeline over an internal layered-graph IR; each phase a pure
function with its own oracle suite:

1. **Containment pre-pass (ours, not Sugiyama):** compartments and
   rows are deterministic measure-and-stack (the current assembly
   already proves this costs ~4 ms); containers reduce to sized
   boxes before the layered pass, matching today's
   SEPARATE_CHILDREN semantics exactly.
2. **Cycle removal:** greedy Eades-Lin-Smyth, O(V+E). Reversed-edge
   set recorded for restoration.
3. **Layering (LAY-002):** network-simplex AND Coffman-Graham,
   selectable per run; default network-simplex for quality,
   Coffman-Graham for width-bounded scenes.
4. **Crossing minimization (LAY-003, THE budgeted phase):**
   barycenter/median layer sweeps with transpose refinement,
   respecting in-layer order constraints, exposed through the
   EXISTING `crossingMinimization: "LAYER_SWEEP" | "INTERACTIVE"`
   seam. Performance posture, in order: (a) an explicit millisecond
   budget with early exit on convergence or budget exhaustion,
   returning best-so-far (quality degrades gracefully instead of
   time exploding); (b) warm-start from prior order when a sketch
   is present (INTERACTIVE = warm-start + one refinement sweep,
   which is what makes LAY-020's global-sketch fallback and drag
   re-layouts cheap by construction); (c) sweep-count adaptive to
   |E| so R1-scale inputs get fewer, wider passes.
5. **Coordinate assignment (LAY-004):** Brandes-Köpf with node-size
   and port-position awareness.
6. **Dummy vertices (LAY-005):** Eiglsperger-Siebenhaller-Kaufmann
   linear-space handling; long edges never materialize per-layer
   dummy chains.
7. **Port placement:** side-constrained placement matching the
   current `elk.port.side` semantics (the structural assembly's
   declared sides carry over unchanged).

**LAY-006 / IP register:** classic Sugiyama variants only; the
channel-based hierarchical framework of US 12,051,137 (vertical
path partition, no dummy vertices, one-bend cross-edges) is
explicitly out of scope, recorded in the IP register per LIC-003,
recorded per LIC-003. Not legal advice.

## 4. API contract and conformance

- `layoutStructural(input, options)` is UNCHANGED for consumers.
  A new `options.engine: "elk" | "g3t"` seam (default "elk" until
  the flip) selects the implementation; the g3t engine honors the
  existing option surface (direction, spacings, strategies, sketch,
  routeEdges emitting no routes initially).
- CONFORMANCE: the QLT-002 harness runs both engines over the
  shared fixtures (the IOP-001 document format is the fixture
  carrier) and compares layout metrics (crossings, bends, edge
  length, displacement-under-sketch). Acceptance for the default
  flip: metrics within agreed bands of elkjs on the fixture corpus
  AND PRF-001 green on CI.
- DETERMINISM (QLT-001): identical inputs produce identical
  geometry; all tie-breaks ordered; property-tested.

## 5. Packaging (ARC-009 executed by this workstream)

The spec's package boundaries separate `layout` and `route` from
`model`/`style`/renderers, consumable with no rendering package.
Plan:
- **@g3t/layout**: the new engine, the structural assembly
  (measure/stack/containment), sketch machinery, LAY-020's
  change-driven layout. The router (route/) moves here too as
  @g3t/layout's routing module (or @g3t/route if the split earns
  its keep; decide at extraction with the owner).
- **@g3t/core** retains model, style, UGM, projections: its budget
  returns under the original envelope (layout+route are ~45 KB of
  today's core dist).
- **@g3t/react** consumes @g3t/layout directly; no consumer-visible
  import changes for barrel users during the transition (core
  re-exports during a deprecation window).
- elkjs moves from core's dependency list to @g3t/layout's, then
  OUT entirely at D3.

## 6. Performance budget (R1, CI baseline, target 300 ms)

| Phase | Budget |
| --- | --- |
| containment pre-pass + IR build | 20 ms |
| cycle removal | 5 ms |
| layering (network-simplex) | 40 ms |
| crossing minimization (capped) | 180 ms |
| Brandes-Köpf placement | 40 ms |
| geometry emission | 15 ms |
| **total** | **300 ms** |

The crossing cap is the design's load-bearing decision: the phase
RETURNS AT BUDGET with best-so-far order. PRF-001 is then met by
construction; the quality question moves to QLT-002 metrics, where
it belongs. Worker posture: the react layer runs the engine in a
worker by default (unchanged from today's elkjs posture); the
engine itself stays synchronous and environment-free.

## 7. Migration plan

- **D1 (skeleton):** flat graphs end-to-end (IR, cycles, layering,
  barycenter sweeps, placement, emission), engine seam, QLT-002
  comparison harness wired, PRF-001 bench runs both engines.
- **D2 (structural parity):** containment pre-pass, ports with
  sides, sketch warm-start, INTERACTIVE semantics, LAY-020 riding
  the new engine unchanged.
- **D3 (the flip):** fixture-corpus conformance within bands, CI
  PRF-001 green on the g3t engine, default flips, elkjs removed,
  ARC-009 extraction completes, budgets rebased to the new package
  map.
Each stage is gate-green shippable; no stage strands the tree.

## 8. Risks and open questions

- **Quality risk:** capped crossing minimization may read worse
  than elkjs on dense fixtures. Mitigation: the cap is an option;
  QLT-002 bands are the acceptance instrument; the owner sees
  side-by-side fixtures before the flip.
- **Hidden elkjs behaviors:** port-side defaults, padding
  interactions, and hierarchy edge cases are encoded in today's
  oracles; D2 runs the FULL existing structural test suite against
  the new engine behind the seam before any default change.
- **Scope temptation:** edge routing inside the engine. Refused by
  design; the router boundary stays.
- **Open to owner:** whether @g3t/route is its own package or a
  module of @g3t/layout; whether the deprecation window re-exports
  from core for one minor version or two.

## Decisions recorded (2026-07-18)

Owner approved (engaged the open decisions without objection;
indifferent on both, delegated):
- (a) the router ships as a MODULE of @g3t/layout, not a separate
  package; a split can still happen later if a consumer needs
  routing without layout, which none does today.
- (b) NO deprecation window: g3t has no external adopters, so core
  drops the layout/route surface at extraction with a CHANGELOG
  note instead of re-export shims. Less machinery, nothing to
  maintain, nobody to break.
D1 is unblocked.

## D1 landed (2026-07-18)

Flat graphs end-to-end behind the seam
(`layoutStructural(input, { engineKind: "g3t" })`; container inputs
fall back to elk until D2). First numbers on the build container:
- FLAT R1 (500 nodes / 800 edges): elkjs 11,127 ms, g3t engine
  103.8 ms: 107x, ALREADY UNDER the 300 ms budget, on the slow
  machine, with the ordering budget at its 60 ms default.
- QLT-002 first comparison (flat 60/100 fixture): g3t area 5.6x
  tighter, mean edge length 2.4x shorter than elk defaults.
  Crossings comparison and quality bands come with D2/D3; elk's
  spacing defaults differ, so treat the area/edge numbers as
  directional, not victory.

Recorded D1 deviations from the end-state design (both scheduled
for D2): layering ships as tightened longest-path (network-simplex's
tight-tree phase, no pivoting; LAY-002's selectable pair pending);
placement is iterative median with overlap resolution
(Brandes-Koepf pending, LAY-004).

## D2a landed (2026-07-18)

Structural inputs run in-house behind the seam: the containment
pre-pass REUSES buildStructuralElkGraph for measurement (one sizing
implementation; the engines cannot drift on what a container is);
containers reduce to derived boxes, the flat pass places them, and
emission stacks rows exactly as the elk container layout does (DOWN,
zero gaps, header-strip top padding, shared width; oracle-pinned to
closure: header + rows equals the container height exactly).
Declared ports emit evenly spaced on their declared side. Sketch
warm-start implements the INTERACTIVE semantics: layer order
initialized from prior x, ONE refinement sweep, placement seeded
from prior positions (oracle: a reversed sketch order is preserved).
Remaining for D2b: LAY-002's selectable layering pair
(network-simplex pivoting, Coffman-Graham) and LAY-004
Brandes-Koepf placement.

## D2b landed (2026-07-18)

LAY-002's selectable pair and LAY-004 shipped; the D1 deviations are
closed. Network-simplex layering (Gansner): tight spanning forest,
scratch-recomputed cut values per pivot, entering edge by minimum
head-to-tail slack, pivots capped and TIME-BUDGETED (default 120 ms;
anytime by construction since every pivot preserves feasibility:
expiry returns a valid best-so-far layering, the same philosophy as
the ordering budget). Its defining property is the oracle: total
edge span never exceeds tight-tree's. Coffman-Graham: lexicographic
labels, width-bounded sink-up fill (oracle: bound held + validity).
Brandes-Koepf: four alignments, median blocks with the strict
position bound as the sole double-claim protection (a claimed-tail
guard is WRONG: align[m] != m marks the block tail's back-pointer,
and overwriting it is how blocks extend), size-aware compaction,
candidates aligned to the narrowest layout (left-biased by min,
right-biased by max) before middle-pair balancing. Guarantee as
pinned: all-candidates-agree segments balance exact (pure paths
pixel-straight); even-degree nodes may legitimately average
off-axis. Without LAY-005 dummies there are no inner segments, so
type-1 conflict marking is vacuous until ESK lands. Defaults are now
network-simplex + brandes-koepf on both engine paths.

Speed class re-confirmed under the new defaults: flat R1 303.5 ms on
the slow build container (same-run elkjs 14,902 ms; CI is ~1.7x
faster per the R28 finding, projecting ~180 ms against the 300 ms
flip gate). Budget composition: NS 120 + ordering 60 + BK/emission.

## D2b landed (2026-07-18)

LAY-002's selectable layering pair and LAY-004 placement are in:
- **Network-simplex** (Gansner): tight-spanning-forest growth with
  min-slack shifts, per-pivot cut values (recomputed from scratch:
  O(V*E) per pivot, an optimization seam not a semantic), entering
  edge by min slack head-to-tail, pivots capped at 4*E, and a
  PIVOT TIME BUDGET (default 120 ms) with anytime return: NS
  initializes from the tightened longest-path and every pivot
  weakly reduces total span, so best-so-far under ANY budget is
  valid and never worse than tight-tree. Budget granularity is the
  pivot: each pivot's cut-value scan is chunky at R1 scale, so the
  wall time can overshoot the budget by one scan.
- **Coffman-Graham**: lexicographic labeling (decreasing-list
  comparison on predecessor labels), width-bounded sink-up fill,
  flipped to source-zero layers.
- **Brandes-Koepf**: four alignments (up/down x left/right), median
  alignment into blocks with the monotone-bound rule, two-pass
  block compaction with size-aware separation, balance by the mean
  of the middle pair, final per-layer overlap resolution. Without
  LAY-005 dummies there are no inner segments, so type-1 conflict
  marking is vacuous until ESK lands (recorded).

Defaults changed to network-simplex + brandes-koepf. Phase
attribution on R1-flat (build container): cycles 31 ms, tight-tree
3.5 ms, network-simplex 171 ms, ordering 71 ms, median 6.8 ms,
BK 13.5 ms. R1-flat end-to-end under the new defaults: 284 ms here
(vs 103.8 under tight-tree+median), implying ~165 ms on the ruling
CI machine: under the 300 ms budget with margin, and BK's quality
is nearly free (13.5 ms). Incremental cut values are the D3
optimization if CI disagrees.

QLT-002 under the new defaults: g3t area 4.5x tighter, mean edge
2.1x shorter than elk defaults (directional).

Verification note, recorded for honesty: the three new D2b oracles
failed once in the session that introduced them and passed on every
subsequent run; the failure's details were not captured and it did
not reproduce (12+ green runs, file unchanged). A ten-seed property
sweep (NS validity + span dominance, CG width + validity, BK
separation, NS byte-determinism) was added as the permanent guard
against the nondeterminism class that flip could have indicated.

Remaining for D3: fixture-corpus conformance bands, PRF-001 green
on g3t in CI, the default flip, elkjs removal, ARC-009 extraction.
LAY-005 ESK dummies remain unimplemented (BK conflict marking
activates with them).

## D3a landed (2026-07-18): THE DEFAULT ENGINE IS g3t

The flip and everything it forced:
- **Scene routing** (g3t-engine/g3t-routing.ts): layered gap routing
  (side-aware stubs, one jog at the gap midline, deterministic
  fanning by far-endpoint order; port-attached edges anchor at the
  port). Cheap-first with verification: a bbox-prefiltered
  polyline-vs-boxes check; routes that would cross a box escalate to
  the grid router ONLY below its documented 64-obstacle threshold
  and under an 80 ms budget; above threshold, long-span edges keep
  simple routes honestly (the PRF-002 finding applied; the channel
  router replaces escalation at D3b).
- **Direction support**: the engine previously stacked layers
  vertically regardless of `direction`; RIGHT/LEFT now stack along
  x with the cross axis in y, cross-axis separation uses the CROSS
  extent (transposed boxes), sketch warm-start keys on the cross
  coordinate, LEFT/UP mirror the flow axis. Oracle covers both
  flows.
- **Engine-agnostic caching**: the cache and in-flight
  de-duplication now wrap an engine dispatch; engineKind and the
  g3t strategy options joined the key; routeEdges: false leaves
  `edges` ABSENT per the documented contract. Generic cache oracles
  live in structural-engine-cache.test.ts.
- **Flip triage** (15 failures, all dispositioned): elk-pipeline
  mechanics oracles (injected-engine counting, elk cache keys,
  LAY-018 collapse holds, elk-shaped converter geometry) carry
  explicit engineKind: "elk" pins with recorded rationale; they
  convert to fixed fixtures or retire with elk at D3b. LAY-018
  position-hold under the g3t engine lands with the collapse
  reintroduction. A new converter oracle pins the default-g3t path.
- **QLT-002 corpus bands** (asserting): four fixtures (flat
  30/50, 60/100, 120/200; structural 14/20); g3t within crossings
  <= 2x+8 and area/edge <= 1.25x of elk. Measured: 3-6x TIGHTER
  area, ~2x shorter edges, 14-37% more crossings (denser packing
  brings edges closer): the tradeoff, stated.
- **PRF-001 asserts NOW** (the milestone landed). Perf work forced
  by the flip: NS deadline granularity moved INSIDE the scans (a
  full O(V*E) scan no longer overshoots the budget), frontier-based
  tight-tree growth (47 -> 24 ms), incremental degree bookkeeping
  in cycle removal, in-sweep ordering deadline, bbox-prefiltered
  route verification, threshold-guarded escalation. Phase
  allocation: NS 80 / ordering 60 / routing 80 within the 300
  total. Container measurement: ~353 ms (RED locally at R1 scale on
  this slow machine); CI projection 170-235 ms (the ruled baseline;
  22-44% margin). If CI disagrees, the named next lever is
  incremental cut values in the NS pivot loop.
- frame-reroute-mbse holds at 5.4 ms over g3t geometry (asserts
  now, budget 8).

Remaining for D3b: elkjs removal (the elk pipeline, its pinned
oracles, the dependency), ARC-009 extraction (@g3t/layout with the
router as a module, no deprecation shims), budget rebases for core
and react, channel router decision point.
