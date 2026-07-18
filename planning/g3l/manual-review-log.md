# G3L Manual Review Log

The procedural register for HUMAN and manual review tasks arising from
G3L rounds. Doctrine: headless gates prove geometry and DOM structure;
they cannot prove what a browser paints or how it feels. Every
rendered-behavior claim stays **unverified** until its MR item here is
executed and its verdict recorded. Agents append items with the next
MR number, never renumber, never close an item themselves: a human
records the verdict.

Item format: status (OPEN / PASS / FAIL / WAIVED), what to do
(procedure), accept criteria, the requirement(s) it verifies, and the
ruled consequence of a FAIL. Priorities use P0/P1/P2; no dates.

---

> Items blocked on the owner live in planning/g3l/owner-queue.md
> with the exact ask per item; this log keeps the review history.

## Index (status as of 2026-07-11, dead-code round audit)

| MR | Status | One-liner |
| --- | --- | --- |
| MR-1 | CLOSED (feature removed by ruling) | Expand/collapse; postmortem stands with reintroduction gates |
| MR-2 | PASS | SVG overlay pan/zoom at 4k validated live |
| MR-3 | PASS | Overlay parity + drag behavior |
| MR-4 | CLOSED (owner ruling 2026-07-18) | Approved for non-IP concerns; IP handled outside the repo; gate references removed |
| MR-5 | HARNESS BUILT; first CI numbers next | Report-only until the one revision, then frozen and asserted |
| MR-6 | PASS | Overlay label styling taste check |
| MR-7 | PASS (audit-corrected) | Style Lab side-by-side; acceptance suite green in owner runs |
| MR-8 | CLOSED (owner: "good enough for now") | Drag-time routing quality; refinements shipped through round 15 |
| MR-9 | CLOSED (owner: "largely stable") | Round-trip idempotence; residual polish lives in MR-10 |
| MR-10 | FLAGGED, P2 | During-drag endpoint tracking (live-feel notes) |
| MR-11 | RE-REVIEW (background fixed) | F1 pane now inherits the dark shell like the cy panes |

## MR-1 (CLOSED: FEATURE REMOVED BY RULING 2026-07-10): Collapse/expand stability, as seen live

**Final disposition:** after a fourth browser FAIL, the owner ruled
the expand/collapse feature removed from the toolkit entirely. The
full defect chain, lessons, surviving infrastructure, and the hard
prerequisites for any reintroduction are in
planning/expand-collapse-postmortem.md (read it FIRST). The verdict
trail below is preserved as the record.

**2026-07-10 verdict: FAIL** ("MBSE expand/collapse still causes a
graph 'flash' and resets the layout"). Two root causes found and
fixed: (1) the flow-extent hold was a no-op for VERTICAL flows and
the default MBSE diagram (BDD) is direction DOWN, so downstream
layers slid on every toggle: fixed with a probe-verified
MINIMUM_SIZE floor holding the box height CONSTANT across both
toggle directions; (2) the flash IS the destroy/recreate lifecycle:
same-graph rebuilds now PATCH the live instance in place (batched
add/remove/json), no teardown, camera untouched by construction.
RE-REVIEW should specifically judge the deliberate look tradeoff: a
collapsed container keeps its full height with whitespace inside the
border (rows hidden). If that look is rejected, the ruled refinement
is a post-layout flow-axis compaction (recorded in the pins).

**2026-07-10 second verdict: FAIL** (still flashing and resetting).
THIRD root cause found, and it explains why the round-6 fixes were
unreachable: the collapse hook's stale-scene guard nulled the scene
for the duration of every re-layout, so the host rendered its loading
state and UNMOUNTED the canvas entirely; the unmount/remount was the
flash, the fresh-mount fit was the reset, and the in-place patch
never executed because the component left the tree (invisible to the
rerender-based pins, exactly). Fixed with stale-while-revalidate
semantics: a same-input rebuild keeps returning the prior scene until
the new geometry lands (the canvas stays mounted and gets PATCHED);
only a diagram switch shows loading. The hook pin now asserts the
scene NEVER nulls across a toggle and waits on the geometry swap
itself.

**2026-07-10 third verdict: flash GONE.** Two remaining findings,
both addressed: (1) "move a node/container then collapse: it goes
back to the original position": the sketch anchored to the last
LAYOUT OUTPUT, so user drags were invisible to it; the canvas now
captures live top-level centers at TOGGLE time and the hook anchors
the sketch there (layered-engine semantics: the in-layer axis honors
the drag tightly, the flow axis may re-quantize to the layer band,
and the full revert is impossible; pinned per-axis). (2) "edge
routing is getting weird": most plausibly the same defect's visible
half (routes computed for the reverted scene while the user saw the
dragged one); RE-REVIEW should re-observe routing after the drag fix
on BOTH a plain collapse and a drag-then-collapse. If weirdness
persists on plain collapse, open a fresh finding: the next suspect is
INTERACTIVE crossing minimization's route quality under hints, which
trades against stability and needs its own ruling.

**Verifies:** G3L:LAY-018, G3L:CNT-003 (the graduated 12.20 experiment).
**Context:** headless acceptance shows ZERO displacement of untouched
containers across a collapse rebuild (structural-sketch.test.ts), and
D15 camera hold is landed. The live feel is unproven.
**Procedure:**
1. `pnpm dev`, open the MBSE demo shell, load the default diagram.
2. Pan/zoom to a comfortable framing. Note two landmark containers.
3. Tap a container's collapse chip. Then expand it again.
4. Repeat on a second container, including one with edges on both
   sides.
**Accept criteria:** untouched containers do not visibly move (no
jump, no drift); the toggled container shrinks/grows in place with
its top-left anchored; the camera does not jump; collapsed width
holds (the ruled A2 whitespace tradeoff: freed space reads as
whitespace, the box keeps its footprint width).
**On FAIL:** record which criterion broke and on which fixture;
A2 fixed-region fallback is the ruled next step (implementation-plan
section 5).

## MR-11 (RE-REVIEW round 3; second owner batch 2026-07-18 addressed)

Round-3 findings and dispositions (all in the MBSE SVG preview):
1. "zoom breaks the entire front-end": REAL CRASH, fixed. onWheel
   read e.currentTarget INSIDE the setView updater; React nulls
   currentTarget after the handler returns and the updater runs
   later, so the deferred read threw and unmounted the tree. All
   event-derived values are now captured before the updater;
   regression test simulates the deferred-updater path.
2. "click-drag only works for the entire canvas": pointer-down now
   resolves through RND-006 hit testing: a node body/header grab
   drags THAT node (offset map; the node's routed edges are stale
   during the drag so they fall back to marked straight lines until
   RTE-011 wires live rerouting here); everything else pans as
   before. Regression test pins node-moves-view-doesn't and
   background-pans.
3. "visible canvas is smaller than the demo shell": the preview was
   hard-coded 960x560; it now fills the canvas host via a
   ResizeObserver wrapper, like the cy renderer.
RE-REVIEW: zoom about the pointer, drag a block (edges go straight,
release keeps position), background pan, and the preview filling
the pane.

## MR-11 round 2 (historical)

Owner re-look findings and dispositions:
1. "Canvas 2D animation is not observed": EXPECTED: stage 1
   declares pulseAnimation "static" (capability-honesty is itself
   conformance-tested). The lab now SAYS so: a caption appears when
   the Canvas adapter is selected.
2. "edge color is missing": REAL BUG, fixed. The lab's critical
   edges are taper + gradient; SVG fills the taper polygon with the
   gradient paint, but the canvas taper op only carried `stroke`
   (unset for those edges, so it fell to default gray). Taper ops
   now carry the gradient and the painter honors it; the
   conformance suite gained a gradient-taper parity fact so no
   adapter can lose it again.
3. "SVG/Canvas text a little bit harder to read": the cy panes
   outline labels via text-outline; the adapters only halo when
   labelHalo is set. The lab's merge now defaults a dark label halo
   (shell-level, adapters stay theme-ignorant).
4. MBSE "renderer dropdown doesn't work": REAL BUG, fixed. The
   `.mbse-canvas-wrap > *` rule absolutized every direct child, so
   the toolbar was stretched UNDER the full-bleed canvas and the
   select was unclickable; the e2e passed because programmatic
   selectOption bypasses pointer occlusion. The toolbar now lives
   outside the absolutized canvas host. Lesson recorded: occlusion
   is a class of bug our e2e idiom does not catch; prefer
   real-pointer clicks for controls that sit near full-bleed panes.
RE-REVIEW: same checklist; expect colored critical edges and
readable labels in panes two/three, and a working MBSE dropdown.

## MR-11 previous round (historical)

SCOPE ADDITION (round 25): the re-review can also take a first look
at the F1 STRUCTURAL slice: the MBSE Workbench now has a Renderer
toggle (Cytoscape default | SVG preview). The SVG preview draws the
geometry document verbatim (containers with stereotyped headers,
compartment rows, ports, routed edges with UML symbols and labels,
wheel-zoom and drag-pan). Worth a glance: does verbatim-geometry
rendering read acceptably next to the cy projection, and does
pan/zoom feel right at BDD scale.

Owner first look: "SVG Adapter in the Style Lab is hard to review
with a white background." Root cause: the F1 pane hard-coded a white
canvas inside the app's dark shell while the cy panes inherit the
shell. Fixed: the pane is now transparent (inherits the dark shell
exactly like the cy panes) and the shell's attribute merge supplies
a dark-readable default label ink where the engine sets none.
RE-REVIEW: same three-pane checklist as below, now visually
comparable.

## MR-11 original entry: F1, the SVG adapter's first browser look

Round 20 shipped the F1 adapter and the Style Lab's third pane.
Review focus when convenient: (1) the three-pane comparison: legacy,
engine bypasses, and the F1 SVG pane with the SAME positions and
attributes: the engine-only zone (halo, glyphs, donut, pulse, taper
with gradient) should render as pixels in pane three only; (2) the
LOD dropdown should drive panes two and three identically (far tier
hides labels in both, and restores); (3) the pulse animation should
be visible on the high-risk hub and should respect reduced-motion
settings. Browser spec added under the acceptance suite (F1
describe block in stylelab-acceptance.spec.ts).

## MR-10 (FLAGGED for a future pass, P2): during-drag endpoint tracking (owner notes, 2026-07-11)

Owner verdict on MR-9's implementation: routing "much better and
closer to predictable". Two DURING-DRAG observations flagged for a
future pass (settle-time behavior is correct; these are live-feel):
1. "The location of the edge source doesn't fully update until the
   click+drag is released": the attach point tracks with a visible
   lag or partially until dragfree canonicalization lands it.
2. "Edge source is repositioning during [the move], but target is
   not": asymmetry between edges where the dragged node is the
   SOURCE vs the TARGET.
Warm-start suspects: (a) the per-frame path repositions
`r.movedEport` and rewrites seg data, but face/bundle anchors are
only computed in the pre-pass per frame for MIGRATED edges;
same-side riding edges keep the ridden offset, so anchors only
"fully" land at the free-time canonicalization; (b) for
target-moved edges, check the RoutedCapture construction (eport
host detection and srcMoved/tgtMoved assignment) and whether the
overlay redraw keys equally on both endpoints' position events.
Also fixed this pass: the MR-9 browser pin's 76px failure: the
return-to-grab restore RECONSTRUCTED seg data via the
parameterization helpers, which is exact only when endpoint
conventions match the original writer's; restore now writes the
grab-time RAW strings verbatim.

## MR-9 (CLOSED: owner accepted 2026-07-12, "routing isn't perfect but it seems largely stable")

Owner review verdict recorded verbatim. Residual routing polish is
tracked as MR-10 (P2, during-drag live-feel). The MR-9 browser pin
passed in the owner's fully green e2e run (57/57, the first 100%
run in the owner's environment).

## MR-9 as implemented (history)

**2026-07-11 implementation:** exactly the recorded candidate
contract. Settled routes are now a PURE FUNCTION of settled
positions: on dragfree, every routed edge is re-derived from final
geometry alone: `canonicalSide` (pure relative geometry, no
hysteresis, deterministic ties), canonical bundle anchors, router
bends via the candidate-face policy; the rescale path and its
captured-bend history are NOT used at settle time. One extension to
the contract: a single-session RETURN-TO-GRAB (release within 8px of
the grab point) restores the grab baseline EXACTLY, so the settled
state at the layout's own positions remains ELK's original routes.
During-drag behavior stays history-dependent by design (hysteresis
prevents face flapping). Pinned three ways: two-paths-one-result and
return-restore unit oracles through the drag harness, and the
mandated browser pin (out-and-back gesture, seg data compared
numerically to pre-drag). RE-REVIEW: repeat the right-then-left
SmallSat drag; multi-session round trips settle to canonical routes
(stable thereafter), single-gesture round trips restore exactly.

## MR-9 as originally flagged: drag routing is not round-trip idempotent (owner-observed, 2026-07-11)

Owner verdict on MR-8's third pass: "good enough for now"; one new
finding FLAGGED, not yet worked: moving the SmallSat block right and
then back left does not reproduce the original routing (right-side
routes do not match the left after the round trip).

Warm-start analysis for pickup (hypotheses, in suspected order):
1. SESSION-BOUNDARY STATE CAPTURE: each grab captures the CURRENT
   bends and attach side as the session baseline; after a rightward
   excursion the router rewrote the data, so the leftward drag starts
   from router-written bends and a migrated side, not the originals.
   Within one session the per-frame result is a function of (grab
   state, position); ACROSS sessions history leaks through the
   captured baseline.
2. HYSTERESIS PATH-DEPENDENCE: the 4-way face selection biases
   toward the current axis by design (no flapping); approach
   direction can therefore settle different faces at the same final
   position.
Candidate contract for the fix: settled routes are a PURE FUNCTION of
settled positions: on dragfree, re-run the router from canonical
inputs (final positions only, history ignored: canonical side from
pure relative geometry, canonical anchors from the distribution).
During-drag may remain history-dependent (that is what hysteresis is
for); the SETTLED state becomes position-deterministic, which makes
the round trip idempotent by construction. A browser spec should pin
it: drag right, drag back to the start, assert the seg data matches
the pre-drag data within tolerance.

## MR-8 third pass (2026-07-11): full-message triage + two owner refinements

Third e2e run (JSON results, full messages): the instrumented hygiene
assertion NAMED the culprit: the cytoscape mapping-warning class,
`label: data(_label)` on the base structural-edge selector while the
converter sets `_label` conditionally on edges; fixed with the
`[_label]`-scoped selector cytoscape itself suggests. The remaining
drag failure ("c.adcs: segment 1 crosses imager") was a router NULL
degrading into an UNCHECKED fallback (the desired face's stub sealed
in by a neighbor); the policy now tries CANDIDATE FACES (desired,
original, remaining two) through the router before any unchecked
fallback (`resolveDragAttachment`), unit-pinned with a sealed-face
fixture.

Owner refinements, both implemented: (1) bundle-aware anchors:
migrated edges sharing a face are DISTRIBUTED along it (sorted by
the other endpoint's cross coordinate, middle 70% of the face, no
lane swapping mid-drag) instead of collapsing onto the face center,
which was the "grouping then breaking back out" mechanism; (2) a
minimum terminal-segment buffer (28px, degrading gracefully when
sealed) so UML relationship symbols sit on a straight run before the
first bend.

## MR-8 second pass (2026-07-11): routing "much better"; one refinement + e2e triage

Owner verdict: SmallSat routing much better; remaining finding: "the
attach point for the edges ON the container is still not ideal
(always on the side even when all blocks are below it)". Root cause:
the drag-time side selection only flipped WITHIN the original axis.
Fixed: 4-way face selection with hysteresis (rotate to the
perpendicular face when the other endpoint is decisively beyond that
extent; diagonals hold the current axis, no flapping). One prior pin
encoded the old axis-lock deliberately (up-and-over shape
preservation); the owner's live ruling outranks it and the pin
evolved with the rationale in place.

Second e2e run: 3 fails triaged. Two shared one root cause found in
the overlay source: the drawn path d is the ARROW-TRIMMED shaft, so
its terminals sit an arrow-length short of the true anchors; the
overlay now publishes data-route-start/end (true anchors) and both
specs read those. The third (MBSE console hygiene) carried no error
body in the saved report; the assertion is now instrumented to NAME
the console messages in the failure text, so the next run identifies
the culprit regardless of report save fidelity.

## MR-8 (CLOSED: owner accepted "good enough for now", 2026-07-11): Drag-time edge routing quality

STATUS CORRECTION (2026-07-11 audit): the owner accepted the routing
stack at the round-15 state; the base heading had lagged the
acceptance recorded in the pass entries above. Original entry
preserved below.

**2026-07-11 implementation landed (B4/B5, G3L:RTE-011):** in-house
orthogonal obstacle-aware router in core (sparse visibility grid +
A* with bend penalty; independent implementation from the published
literature, distinct from the surveyed patents, no libavoid code)
plus the drag-route policy `resolveDragRoute` (rescale when the
reshaped route stays clear, preserving ELK's route shape; reroute
with border-anchored perpendicular terminals when it collides or the
attachment migrates sides; previous behavior as the sealed-off
fallback). The two round-1 expected-fail oracles FLIPPED to plain
tests through the production policy (one fixture corrected at flip
time: the original placed the moved endpoint INSIDE the obstacle,
which was unsatisfiable and masked by the it.fails marker). Browser
acceptance tests/e2e/drag-reroute.spec.ts encodes both owner symptoms
verbatim. RE-REVIEW: repeat the SmallSat drag; both symptoms should
be gone, judged after a green e2e run per the harness procedure.

Owner observation, post-collapse-removal, MBSE: moving the SmallSat
block causes (a) its edge to render toward the CENTER of the block
instead of staying anchored at the border/port, and (b) edges to
route OVER other blocks. Both are the KNOWN, pinned RTE-011 gap: the
two expected-fail drag oracles in drag-route-oracle.test.ts encode
exactly these failure modes and flip to passing when B4/B5 lands
(in-house obstacle-aware router + incremental rerouting during
drag). These two symptoms, in the owner's words, are the acceptance
criteria for that work: (a) dragged-node edges stay border/port
anchored; (b) no post-drag routes crossing other blocks. Also add a
browser acceptance spec for both when B4/B5 ships (drag a block via
the harness, assert endpoint band + no path/box intersections).

## Harness note (2026-07-11 procedure change)

Round 11 made subsets of MR-2/MR-3 machine-checked (overlay path
count, transform-only pan, endpoint attachment, console hygiene) and
added projection invariants no MR covered. Future review sittings
start AFTER a green e2e run: humans judge look and feel; the
geometry/attachment/hygiene classes are CI's job now.

## MR-2 (PASS 2026-07-10, P0): SVG overlay pan/zoom lag at 4k

**Verifies:** G3L:RND-003 (the ruled overlay fallback gate).
**Context:** the MBSE shell now opts into
`structuralEdgeLayer="svg-overlay"`. Pan/zoom updates only the SVG
group transform (no per-edge work); drags redraw via rAF. Whether the
transform sync is visibly lag-free at 4k is exactly what headless
cannot show.
**Procedure:**
1. On a 4k display (or 4k-scaled window), open the MBSE shell with
   the largest available diagram.
2. Pan continuously in circles for ~10 s; zoom in/out rapidly with
   the wheel; then combine pan+zoom.
3. Watch the routed edges (the overlay layer) against the node boxes
   (the Cytoscape layer) for shear, rubber-banding, or trailing.
**Accept criteria:** no visible lag between edge layer and node layer
during pan/zoom; no dropped-frame stutter attributable to the overlay
(compare by removing the `structuralEdgeLayer` prop if unsure).
**On FAIL:** the ruled consequence is per-surface degradation: remove
the prop from the MBSE shell (one line) and record the finding;
element-recycling in the overlay redraw is the first implementation
suspect (noted in the redraw comment).

## MR-3 (PASS 2026-07-10, P0): Overlay visual parity and drag behavior

**Verifies:** G3L:RND-002 DoD (interaction parity, visual parity),
G3L:RTE-008 (declared-port exits unchanged), G3L:STY-009 (geometry
arrowheads).
**Procedure:**
1. In the MBSE shell, compare routed edges against a second shell
   still on the default layer (or toggle the prop locally): line
   weight, color, dash on dependencies, arrowheads per UML kind
   (association filled triangle at target; generalization hollow
   triangle; composition filled diamond at SOURCE; aggregation hollow
   diamond at source; dependency dashed with open vee), edge labels
   (position, legibility, halo vs the old text plate).
2. Hover a routed edge: hover behavior must be unchanged (events ride
   the invisible Cytoscape edge). Right-click a routed edge: the
   context menu must appear exactly as before.
3. Drag a block with routed edges: edges must follow live, stay
   orthogonal, terminate on the box border; the drawn line and the
   hover hit-zone should agree (the endpoint-basis claim that
   headless cannot pin).
4. Check declared-port edges (perpendicular port exits) still render
   via taxi exactly as before, in both hover and drag.
**Accept criteria:** no visual regressions a reviewer would flag; all
interactions indistinguishable from the previous layer; hollow arrows
show no shaft poking through (trim working).
**On FAIL:** itemize per sub-check; label styling deltas (halo text vs
Cytoscape's background plate; label color choice theme.textPrimary)
are known candidate deltas awaiting exactly this judgment.

## MR-4 (CLOSED: owner ruling 2026-07-18)

Owner ruling, verbatim: "MR-4 is approved for non-IP concerns.
Remove all references in the decisions and in the repo." Executed:
the release-gate references to a freedom-to-operate review were
removed from the owner queue, STATUS, the WS-D design, the
implementation-plan risk table, and LIC-003's gating clause; IP
questions live outside this repo with the owner. Historical
CHANGELOG entries were left as written (records of what happened,
not active decisions). Original entry below for the record.

## MR-4 original entry (historical)

**Verifies:** G3L:LIC-003 (release gate).
**Context:** the IP register constraints are LAY-006 (no channel-based
hierarchical framework, US 12,051,137) and RTE-003/NOD-005 (no
raster-precise outline clipping, US 9,082,226). Agent-side avoidance
is by construction; the gate is a human-commissioned legal review.
**Procedure:** commission an FTO review covering the two named patents
plus a search of Tom Sawyer / yWorks layout-adjacent filings; record
the outcome here.
**Accept criteria:** written FTO opinion on file.
**On FAIL/qualified:** feature-level mitigation per counsel; NG-4
boundaries widen as needed.

## MR-5 (HARNESS BUILT 2026-07-12; awaiting first CI numbers, then the one revision and freeze)

SHARPENING ADDENDUM (round 28, owner-approved): the PRF-001 caveats
were resolved by a measurement matrix
(planning/g3l/prf-001-measurement.md): warm cost 12.6 s (init was
only ~3.8 s of cold), assembly 4.3 ms (cost is inside elk.layout),
crossing minimization is the dominant term (INTERACTIVE runs 3.5x
faster), and even the maximally detuned combo stays well over the
300 ms target. The revision conversation, when CI numbers land, can
now cite component-attributed data.

Execution landed the same day as the ruling: tests/perf harness
(env-gated G3T_PERF=1; seeded R1/R2 fixtures per spec section 14;
report-only while planning/g3l/prf-budgets.json is "provisional",
asserted once "frozen"), CI perf job with results artifact.

Shakedown numbers from the build container (NOT the ruled baseline;
CI produces the ruling numbers) surfaced three findings, recorded in
the results file and the bench sources:
1. PRF-001: R1 layered layout via elkjs measured ~11-17 s against
   the 300 ms target: the quantified case for WS-D's in-house
   layered engine (already P0 in the plan).
2. PRF-002 from-scratch: the sparse-grid router is architecturally
   an INTERACTIVE router; from-scratch R1 scene routing (long random
   corridors over 500 boxes) extrapolates to minutes and belongs
   with the channel-router milestone (the PRF-003 component). A
   prune-verify-fallback optimization landed in the router
   regardless (correctness preserved by construction; unit-pinned).
3. PRF-002 incremental: MEETS budget at production scene scale
   (~3.6-4.8 ms vs 8 ms on the container; the shipped drag feel),
   degrades at R1 scale with the same root cause as (2).
PRF-004 style resolution meets both budgets with wide margin
(~15-29 ms vs 100; ~0 ms vs 2). PRF-003/005/006/007 recorded as
pending their components.

## MR-5 as ruled (history)

Owner ruling: "CI is fine": the GitHub CI runner class is the PRF
baseline machine profile. Remaining execution is ENGINEERING, not
owner-blocked: build the D1 metrics + layout benchmark harness over
the R1/R2 fixtures, run it in CI, compare to the spec's initial
budgets, apply the one permitted re-baseline, freeze the numbers
here and in the spec. Original procedure below.

## MR-5 original entry: PRF baseline ruling execution

**Verifies:** spec section 14 preamble (one re-baseline permitted,
then frozen); the accepted ruling was re-baseline during D1.
**Procedure:** once the CI machine profile is fixed, run the D1
metrics + layout benchmarks on R1/R2 fixtures, compare against the
spec's initial budgets, and either accept or revise ONCE; record the
frozen numbers here and in the spec.
**Accept criteria:** budgets frozen and referenced by CI benchmarks.

## MR-6 (PASS 2026-07-10, P2): Overlay label styling taste check

**Verifies:** G3L:LBL-002 as applied in the overlay.
**Context:** the overlay renders edge labels as halo text
(paint-order stroke in canvasBg) instead of Cytoscape's
text-background plate, and uses theme.textPrimary. A deliberate,
reviewable delta.
**Procedure:** part of MR-3 step 1; judged separately because it is a
taste call, not a defect check.
**Accept criteria:** human preference recorded (keep halo text /
revert to plate-equivalent / adjust color).

## MR-7 (PASS, corrected in the 2026-07-11 documentation audit): Style Lab side-by-side, as seen live

STATUS CORRECTION (2026-07-11 audit): the re-review conditions were
met when the Style Lab acceptance suite went green in the owner's
live e2e runs (parity 0 mismatches, LOD drive + down-tier restore,
no vertical growth); the heading had never been updated. Original
entry preserved below.

**2026-07-10 verdict: FAIL**, three findings, all root-caused:
(1) "page keeps growing vertically": unbounded canvas container fed
the resize observer; panes now render inside fixed 420px boxes.
(2) "nodes look the same but not in the exact same position":
stochastic default layouts; both panes now use deterministic grid.
(3) "missing node labels / muted edge labels in the engine view": the
designed FAIL rule fired EXACTLY as written: the parity keys
under-covered the label channels AND the oracle compared bare
cytoscape mounts while the browser runs the canvas default+theme
stack underneath. Fixed: label channels joined PARITY_KEYS, both
oracle and shell-test mounts now carry the REAL canvas stylesheet
stack, `labelHalo` became a first-class VisualAttribute
(G3L:LBL-002) projected to text-outline, the fixture pins every label
channel in BOTH paths, and a permanent oracle SELF-TEST breaks the
config on purpose and demands detection, so the blind spot cannot
silently return.

**Verifies:** the WS-C adoption path's side-by-side cutover gate; the
projection's visual faithfulness beyond computed values.
**Context:** the Style Lab (landing card "Style Lab") renders one
fixture intent through the legacy stylesheet (left) and the engine's
bypass projection (right). Headless oracles pin computed-style
identity (0 mismatches) and the shell's DOM; what the two panes PAINT
is exactly what headless cannot show. The dedicated shell exists
because the ontology shell was judged too narrow a styling
representation (ruling 2026-07-10).
**Procedure:**
1. `pnpm dev`, open Style Lab from the landing page.
2. Compare panes element by element: fills (risk colors on n1-n4,
   BASE fill on n5/n6/n8: the gating proof), hub borders (n1, n4),
   muted opacity (n5 and one edge), the selected node n7's border,
   critical dashed edges (e1, e4).
3. Confirm the parity section reads "0 mismatches across N checks"
   in the running app, matching the gate.
4. Read the engine-only zone list (n1 halo+glyphs, critical taper)
   and confirm nothing engine-only leaked into either pane's canvas
   (it must not render anywhere yet).
5. Flip the LOD probe through its four contexts; confirm the tier and
   hidden-features line matches the schedule's intent.
**Accept criteria:** panes indistinguishable on every compared
channel; live parity summary reads 0 mismatches; engine-only
attributes appear ONLY in the report list.
**On FAIL:** a pane-visible difference with a 0-mismatch parity table
means the parity keys under-cover a channel; add the channel to
PARITY_KEYS and the fixture, and re-gate.

**2026-07-10 second verdict: visual parity CORRECT; two shell UX
defects.** (1) No way back to the demos page: the shell ignored the
router's onBack contract every other shell honors; a back affordance
now renders and forwards to the router. (2) The LOD dropdown
"doesn't appear to do anything": it only changed a text line; it now
DRIVES the engine pane (resolveLod once per context, applyLod per
element over the stored base attributes, bypasses re-applied), with
the honest caveat labeled in the copy: the legacy pane has no LOD
concept, so far tiers intentionally diverge. Building the drive path
surfaced and fixed a real defect the browser would have shown next:
a down-tier transition left stale text-opacity/opacity bypasses (the
projection only writes present keys), so labels never came back;
re-application now resets bypasses first (`resetFirst`).

**2026-07-10 third verdict: dropdown works.** One finding: "all edge
labels weirdly muted": edge labels sat directly on their lines with
no halo (node labels have one), reading washed out; both paths now
halo edge labels (canvas-colored outline, size 9 -> 10), the outline
channels joined PARITY_KEYS.edge, and the oracle re-passed at 0
mismatches.

---

## Verdict log

| MR | Date | Verdict | Notes |
|----|------|---------|-------|
| MR-1 | 2026-07-10 | FAIL | Flash + layout reset on MBSE toggle; both root causes fixed same day (vertical-flow floor; in-place scene patch); re-review pending, judge the constant-height whitespace look |
| MR-7 | 2026-07-10 | FAIL | Vertical page growth; pane position drift; missing/muted engine-pane labels; oracle blind spot closed (stacked mounts, widened keys, self-test); re-review pending |
| MR-2, MR-3, MR-6 | 2026-07-10 | not executed | Review session surfaced MR-1/MR-7 first; re-run after the fixes land |
| MR-2 | 2026-07-10 | PASS | Overlay pan/zoom lag-free; the SVG-above-canvas pattern holds; F1 unblocked |
| MR-3 | 2026-07-10 | PASS | Overlay parity, arrowheads, drag, port exits, hover/context-menu all accepted |
| MR-6 | 2026-07-10 | PASS | Halo-text label styling accepted |
| MR-1 | 2026-07-10 | FAIL (2nd) | Still flash+reset; third root cause: hook stale-guard unmounted the canvas per toggle, making the round-6 fixes unreachable; stale-while-revalidate fix shipped; re-review pending |
| MR-7 | 2026-07-10 | UX FAIL | Parity correct; back affordance + LOD-drives-pane shipped (plus the stale-bypass restore defect the drive path surfaced); re-review pending |
| MR-1 | 2026-07-10 | flash PASS; drag-revert FAIL (3rd) | Live-position sketch anchoring shipped; routing weirdness to re-observe post-fix |
| MR-7 | 2026-07-10 | dropdown PASS; edge labels muted | Edge-label halo both paths, parity keys widened again, oracle 0 mismatches |
| MR-7 | 2026-07-10 | edge labels PASS (4th) | Muted-label fix confirmed in the lab |
| MR-1 | 2026-07-10 | no-reset PASS; toggled-container placement FAIL (4th) | Compound drawn bounds vs geometry box mismatch; ::extent bounds pin shipped; re-review pending |
| MR-1 | 2026-07-10 | STILL FAIL (5th); CLOSED by ruling | Feature removed from the toolkit; postmortem written (planning/expand-collapse-postmortem.md) |
