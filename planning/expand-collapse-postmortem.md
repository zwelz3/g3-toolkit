# Expand/Collapse Postmortem (feature REMOVED by ruling, 2026-07-10)

**Ruling:** "Fully remove the expand/collapse feature from the toolkit
and document a warning about trying to add it in the future with
challenges, lessons learned, etc." This document is that warning. If
you are considering adding compartment (or any) expand/collapse to
g3-toolkit: read all of it first, then read the verdict trail in
planning/g3l/manual-review-log.md (MR-1). The feature consumed four
browser-review rounds, was root-caused four separate times, and every
fix was correct AND insufficient, because the defects lived at four
DIFFERENT layers of the stack. The owner concluded the feature was
not worth its debugging cost. That conclusion should be your starting
prior.

## What the feature was

Compartments of structural containers could be collapsed (content
rows hidden, a "(N hidden)" divider remaining) via a layout-time
input (`collapsedCompartments` on layoutStructural), toggled by an
on-container chip and a context-menu action, with store-backed state
(`useCompartmentCollapseStore`), host wiring
(`useStructuralCollapse`), and stability machinery so a toggle did
not rearrange the scene.

## The defect chain, in order of discovery

Each root cause below was REAL, was FIXED, and was VERIFIED headlessly.
None of the fixes was wrong. The feature still failed its next browser
review every time, because the next defect lived one layer further
out. This is the core lesson.

1. **Layout (flow-axis asymmetry).** The stability hold was built and
   proven on a RIGHT-flow fixture; the default MBSE diagram is
   direction DOWN, where the hold was a structural no-op. Collapsing
   shrank the flow-axis slot and slid every downstream layer.
   Headless proof existed; it proved the wrong flow direction.
2. **Component lifecycle (the flash).** Geometry stability cannot fix
   a remount: the canvas destroyed and recreated its Cytoscape
   instance on every scene change, and the destroy/recreate IS a
   visible flash. Fixed with an in-place batched scene patch keyed on
   graph identity.
3. **Hook state machine (the unreachable fix).** The collapse hook's
   stale-scene guard nulled the scene for the duration of every
   re-layout; the host rendered its loading state and UNMOUNTED the
   canvas, so the flash persisted and the in-place patch never
   executed. Rerender-based tests structurally cannot see an
   unmount/remount that only the host's conditional render performs.
4. **Renderer projection (drawn bounds vs geometry).** Cytoscape
   derives a compound parent's DRAWN bounds from its children. When a
   collapse removed the rows, the drawn box shrank to the header
   strip while the geometry box (holding the border ports) stayed
   full-size: the container read as mispositioned and edges attached
   into empty space. Every geometry-level pin was green because the
   geometry WAS correct.

After fix 4 the browser verdict was still "busted." A fifth layer may
exist; nobody looked, because the ruling ended the search, and that
was the right call.

There were also two adjacent defects the saga surfaced: user drags
were invisible to the re-layout (sketch anchored to layout output,
not live positions; fixed via live-position capture at interaction
time), and LOD down-tier transitions left stale style bypasses
(fixed via resetFirst). Both fixes survive as general infrastructure.

## Lessons learned (the transferable part)

1. **A feature that spans layout, state, component lifecycle, and
   renderer projection cannot be verified layer by layer.** Every
   layer's tests were green at every step, and the browser was red
   four times. Layered headless verification is necessary and NOT
   sufficient for a feature whose failure modes are cross-layer
   emergent. If you cannot write a browser-level acceptance test
   (real render, real toggle, pixel/geometry assertions on what is
   DRAWN), you cannot afford the feature.
2. **Test the fixture your users actually hit.** The stability
   criterion was proven on RIGHT flow; the shipped default was DOWN.
   Every per-flow-direction behavior needs per-flow-direction
   acceptance fixtures, and the default configuration of the flagship
   consumer is the mandatory first fixture.
3. **"The geometry is right" is not "the picture is right."** The
   geometry document and the renderer's drawn state are two models
   that CAN diverge (compound bounds, port anchoring, bypass
   persistence). Any invariant you rely on across that boundary needs
   an explicit projection-level test (e.g. drawn-bounds == port-box).
4. **Host conditional rendering is part of the feature.** The hook's
   loading-state contract silently controlled mount/unmount of the
   canvas, which controlled whether ANY canvas-level fix could work.
   A feature's state machine includes what the HOST does with null.
5. **ELK specifics that cost real time** (verified by isolated
   probes, all still true): `elk.margins` is IGNORED by elkjs as a
   layoutOption; interactive strategies preserve structure but NOT
   coordinates without INTERACTIVE node placement; a shrinking node
   shrinks its LAYER (downstream slides, non-rigidly, unfixable by
   scene-level re-anchor); `elk.nodeSize.minimum` + MINIMUM_SIZE DOES
   hold a hierarchical parent's size. Keep the probe habit: one
   isolated elkjs script per hypothesis before wiring anything.
6. **Sunk-cost review cadence.** Four fix-review cycles on one
   feature is past the point where "one more root cause" is a good
   bet. The ruling to remove was made by the owner, not the agent;
   agents should surface the option earlier ("this feature's
   remaining unknowns exceed its value; removal is on the table")
   instead of presenting each fix as probably-final.

## What SURVIVES (deliberately kept; do not re-remove)

These were built for collapse but are general layout/rendering
infrastructure, spec-backed (G3L:LAY-017/018) and independently
tested:

- **Sketch mode** in layoutStructural (prior positions + extents;
  four INTERACTIVE strategies; flow-extent hold; median re-anchor):
  stability for ANY same-ids re-layout. Acceptance now perturbs via
  input variants, not collapse.
- **The in-place scene patch** (planScenePatch/applyScenePatch,
  epoch-keyed creation): no-flash same-graph rebuilds for any scene
  change.
- **Stale-while-revalidate layout hook** (`useStructuralLayout`, the
  collapse-free successor): scene continuity across re-layouts.
- **The ::extent bounds pin**: drawn compound bounds always equal the
  geometry box the ports live on.
- **Live-position capture** (`captureStructuralTopLevelPositions`):
  user arrangements as re-layout anchors.
- **`applyVisualAttributes` resetFirst**: bypass hygiene for
  shrinking attribute sets.

## Prerequisites for ANY future reintroduction (hard gates)

Do not start implementation until ALL of these exist:

1. A browser-level acceptance harness (Playwright or equivalent) in
   CI that can mount a structural scene, perform the toggle, and
   assert DRAWN geometry (container bounds, edge endpoints) within
   tolerances: the four-layer defect chain above must be one red test
   BEFORE any fix round, not four browser sittings.
2. Per-flow-direction fixtures (RIGHT and DOWN minimum) in that
   harness, with the flagship consumer's default configuration as
   fixture one.
3. A projection-invariant test: drawn compound bounds == geometry
   box == port anchor box, asserted through the real renderer.
4. An explicit host-contract test: the scene provider never unmounts
   the canvas during a same-input rebuild.
5. An owner-approved value statement for the feature that survives
   the estimate: assume the integration cost is the DOMINANT cost
   (the layout math was the easy part and is already built).

If any gate seems like overkill, re-read the defect chain: every one
of these gates corresponds to a round that was lost without it.
