---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 04: corridor supply contract (layout provides router headroom)

Phase 2 of the engine-quality roadmap. The dagre negative lesson:
corridor width is layout's job, not the router's.

## Problem

Inter-layer gaps are fixed by spacing options; when n parallel routes
need n tracks at 8px, a too-narrow corridor forces the nudging pass
into ELK-style even-distribution degradation (span/(n+1) < target
gap). The router cannot widen the gap; only layout can.

## Design

1. Before placement, `g3tLayoutFlat` and `g3tLayoutStructural` run a
   structural demand estimate: count chain segments (from post-03 dummy
   chains) crossing each inter-layer boundary. That count is the
   estimated track demand for the corridor. This estimate is computed
   entirely from the structural graph and never from a previous routing
   run, keeping the data flow loop-free.

   After routing completes, `nudgeRoutes` is a new measurement pass
   introduced by this brief, called inside `g3tLayoutStructural`
   immediately after `routeStructuralEdges` (at
   `packages/core/src/layout/g3t-engine/g3t-structural.ts`, the
   single existing call site). `nudgeRoutes` returns a `corridorDemand`
   record (max tracks actually used per corridor). This measured value
   is consumed by the dev-mode drift assertion described in point 3
   below -- it does not feed back into gap sizing and is not propagated
   to callers of `g3tLayoutStructural`. The SVG-view call site
   (`packages/react/src/views/svg/structural-svg-view.tsx:408`) calls
   `routeStructuralEdges` directly as an on-demand re-route and is not
   affected by this brief; it does not invoke the drift assertion.

   The structural estimate drives gap sizing. The measured demand
   verifies the estimate. There is no runtime branch that selects
   between estimate and measurement for gap sizing: the estimate is
   always used.

   Caveat: chain-segment counting is a proxy. Actual routing may
   produce more tracks per corridor than chain-segment count implies,
   due to bend avoidance, bundle splitting, or shared-segment reuse.
   The drift assertion is the safeguard against systematic
   underestimation.

2. Gap sizing:
   `gap = min(maxGapFactor * baseGap, max(baseGap, demand * trackGap + 2 * clearance))`
   per corridor, applied in layer y-placement for N/S corridors and
   layer x-placement for E/W corridors. The `maxGapFactor` (default
   3x baseGap) cap is part of the formula, not a separate prose
   constraint: without the outer `min`, the cap never activates and
   pathological fan-ins produce unbounded corridor growth. The demand
   formula and clearance constants are the same for both axes; if the
   structural layout treats row-spanning differently from
   column-spanning, a separate calibration run is needed to confirm
   the constants transfer (see Verification step 5).

3. Contract is one-directional and loop-free: layout estimates from
   structure, the router measures actuals, and a dev-mode assertion
   compares the two. The assertion tolerance must be calibrated: the
   estimate is expected to be at or above the actual demand (never
   below by more than one track), so the tolerance is asymmetric.

   Tolerance assumption: the 1-track slack covers a single additional
   track from any one of the three proxy sources (bend avoidance,
   bundle splitting, shared-segment reuse). If diagrams are observed
   where two or more sources fire simultaneously on the same corridor,
   the tolerance fires false-positives for that diagram class; the
   calibration test in Verification step 3 is the mechanism to detect
   this before production. The tolerance value is a named constant
   (not a magic number) so it can be widened per class without
   invalidating the overall contract.

   In dev mode a failing assertion surfaces as a console warning
   naming the corridor and the observed overshoot. In production (dev
   mode off), systematic underestimation is recoverable: the gap-sizing
   formula already clips at `baseGap`, so corridors are never narrower
   than the undemanded minimum. If a future monitoring hook is wired,
   the assertion failure record (corridor id, estimate, actual) should
   be emitted there; until then the degradation is silent at runtime
   but detectable in the lab suite.

   A failing assertion is a test signal that the structural proxy is
   underestimating for a new class of diagram; it does not trigger a
   runtime re-layout.

## Verification

1. Oracle (N/S corridors, uncapped scenarios): `coincidentRuns` reaches
   0 on Fan-In Bus and Port Storm scenarios where Brief 01 alone had to
   degrade, asserting the degradation branch is no longer hit. This
   oracle is scoped to lab scenarios explicitly constructed so that no
   corridor's estimated demand exceeds `maxGapFactor * baseGap /
   trackGap` tracks. For these scenarios the cap is not the active
   constraint, so undersized corridors indicate a formula error, not a
   cap hit.

2. Oracle (cap-path scenarios): For high-fan-in scenarios where
   `maxGapFactor` is the active constraint, the degradation branch IS
   expected to fire. Assert that the active-constraint annotation for
   each corridor matches the branch taken (cap-limited corridors must
   show "maxGapFactor active" and coincidentRuns > 0; uncapped corridors
   must show "baseGap formula active" and coincidentRuns == 0). This
   provides a concrete pass/fail signal for cap-path behavior rather than
   validating by expectation only.

3. Drift assertion test: at least one lab scenario must measure
   structural-estimate vs. post-routing actual demand and assert the
   tolerance bound (estimate >= actual - 1 track). This test catches
   systematic underestimation before it reaches oracle scenarios. If
   multiple proxy sources fire on the same corridor in any lab diagram,
   widen the named tolerance constant for that class and document the
   widening as a calibration note.

4. Layout-area guard: total drawing area per scenario is pinned. The
   numeric acceptance threshold is: area must not exceed 1.5x the
   Brief 01 baseline for the same scenario (preserving a meaningful
   bound on the growth that gap widening introduces). Each corridor
   records whether `maxGapFactor` or the uncapped formula is the active
   constraint; a gate failure at the 1.5x threshold with all corridors
   cap-limited is a signal to revisit the `maxGapFactor` default, not
   to widen the threshold.

5. E/W axis calibration: run the drift assertion test (step 3) against
   at least one scenario with horizontal flow (direction LEFT or RIGHT
   with column-spanning corridors). If the observed overshoot for E/W
   corridors exceeds the N/S calibrated tolerance, record the difference
   as a named constant adjustment and update the gap-sizing formula
   constants accordingly. If E/W scenarios are deferred to a later
   brief, mark this step explicitly deferred with a reference to the
   deferral brief.

6. Determinism, gates green, bundle ledger if core grows.

## Open question

If real-world diagrams routinely have corridors whose demand exceeds
3x baseGap / trackGap, the maxGapFactor default is too restrictive and
the degradation branch remains reachable. The layout-area guard's
active-constraint annotation (above) is the detection mechanism; the
default should be revisited after the first batch of real diagrams is
run through the lab suite.
