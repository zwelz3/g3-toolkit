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
