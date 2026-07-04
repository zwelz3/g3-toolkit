# Flagship demo: Option 1 redesign (composition-first)

Supersedes sections 2 and 3 of `flagship-implementation-plan.md`. Sections
0, 1 (engine, done), and 4 (packaging) stand. Priority-ordered, not
day-estimated.

## Why this redesign

The critique that prompted it: the shell had become a strong, relevant
PROBLEM story (capture intelligence, the two-strength thesis) in which the
toolkit read as incidental. The engine is a bespoke domain pipeline over
UGM (invisible plumbing to a viewer); the only toolkit pieces on screen
were three components built FOR the demo (CoverageMeter, ProvenanceTrace,
camera); and the toolkit's actual centerpiece (the interactive graph
canvas, its encoding system, layouts, linked views, export, exploration
controls) was a slot placeholder.

Option 1: make the toolkit load-bearing inside the same story. Same
narrative, but every beat is visibly the EXISTING toolkit composing. The
demo becomes a guided tour of composed capabilities solving a real
problem, which is what motivates adoption.

The governing rule for this redesign: **prefer an existing toolkit surface
over bespoke shell code at every beat.** New components are justified only
where no existing surface fits, and even then they ship in `@g3t/react`.

## The load-bearing move: the stage is the toolkit's encoding

The stage is the real `CytoscapeCanvas` (`ugm`, `layout`, `onReady`,
`encodingSpec`), not a slot stand-in. The visual meaning is produced by
the toolkit's OWN encoding system: an `EncodingSpec` maps node/edge
driver attributes to color/size/shape/width via the shipped resolvers
(`applyEncodingSpec`). The shell does not draw; it hands the toolkit a
graph and a spec.

- Annotate the meaning UGM with the driver attributes the spec needs:
  `_substantiated`, `_claimable` (already written by `projectMeaning`),
  and `_state` (written by a small `annotateForEncoding` step from the
  analytic result). Edges already carry `type` (supports/contests) and
  `properties.weight`.
- Author two specs: a RAW spec (encode by node type, flat) and a MEANING
  spec (node.size <- `_substantiated`, node.color <- `_state`
  categorical, node.shape <- `types`, edge.color <- `type`, edge.width
  <- `weight`). The Act I->II transition is a SPEC SWAP on the same
  laid-out graph: `applyEncodingSpec` restyles without re-running layout,
  so nodes do not move and the transformation reads as "same memory, new
  meaning." This is the single best demonstration that the toolkit, not
  the demo, owns the visual logic.

## Beat to toolkit-surface map (the adoption spine)

Every beat names the EXISTING toolkit surface it exercises. New
(`@g3t/react`) components are flagged [new].

1. The mess: `CytoscapeCanvas` over the raw UGM + a force layout. Sparse,
   uncolored. Surface: CytoscapeCanvas, ForceLayout/fcose.
2. The memory (`buildRawGraph`): same canvas, full raw graph laid out;
   `GraphToolbar` zoom/fit. Surface: CytoscapeCanvas, GraphToolbar.
3. Records to meaning (`projectMeaning`): SPEC SWAP raw -> meaning on the
   same layout; the contesting 2019 edge turns red via `edge.color`.
   Surface: EncodingSpec + applyEncodingSpec (restyle-only).
4. The opportunity: required concepts emphasized; camera frames them.
   Surface: camera controller [new], selection; optionally SearchBar to
   locate required concepts.
5. Two bars per requirement (`runRelevanceAnalytic`): the two-strength
   bars as the ECharts `LinkedChart` (existing view) linked to canvas
   selection, alongside `CoverageMeter` [new]; node.size now reflects
   `_substantiated`. Surface: LinkedChart (ECharts), EncodingSpec(size),
   CoverageMeter [new].
6. Two different weaknesses: node.color shows amber/red via the spec;
   `DetailInspector` shows the exposed concept's attributes; camera pans.
   Surface: EncodingSpec(color), DetailInspector, camera [new].
7. Decision (`deriveActions`): apply the branded Northwind theme via
   `createTheme` (the "this becomes our product" beat); actions listed.
   Surface: theme system (createTheme/ThemeManager).
8. The partner the graph knew (`traceTeaming`): pull ORCA's co-delivered
   subgraph in via `buildNeighborhoodUGM`/`expandNeighbors`; camera
   focuses. Surface: neighbors/context-menu toolkit-actions, camera [new].
9. Drill anywhere (`traceProvenance`): `ProvenanceTrace` [new] +
   `DetailInspector`; the traced path highlighted on canvas via the
   algorithm-overlay channel (`findShortestPath` / borderWeight). Surface:
   ProvenanceTrace [new], DetailInspector, path overlay.
10. The deliverable (`assembleCaptureBrief`): `BriefPanel` [new, demo] +
    real subgraph export (Turtle/JSON/CSV/PNG) as "take the brief away",
    and a workspace snapshot. Surface: subgraph export, workspace.
- Epilogue (interactive): hand the viewer the real exploration stack:
  `GraphToolbar`, `SearchBar`, `FilterBuilder`, `LayoutSwitcher`,
  `AlgorithmPanel`, `NodeStyleEditor`. The auto-play sold the problem;
  the epilogue lets them feel the toolkit. Surface: the interaction stack.

A "powered by" credit line per beat (the surface names above) makes the
composition legible on screen, not just in the code.

## Revised section 2 (toolkit work)

The earlier 2a/2c/2d (camera, CoverageMeter, ProvenanceTrace) stand and
are built. The redesign ADDS, in priority order:

- 2g Encoding specs + annotate (NEW, highest priority, mostly headless):
  the raw and meaning `EncodingSpec`s and `annotateForEncoding`. Verified
  by resolving the spec against the real meaning UGM with
  `applyEncodingSpec` and asserting the visual mapping (discriminator
  green, exposed amber, gap red; size tracks substantiated; supports
  green / contests red edges). This is the proof that the toolkit owns
  the visual logic.
- 2b transitions: the Act I->II spec swap is the cross-fade's substance;
  reduced to "swap the spec, keep the layout" (no new toolkit code). The
  encoding-interpolation helper stays decision-gated.
- 2e branded theme: `createTheme` Northwind palette + raster logo via the
  icon channel (existing). Confirms the product beat.
- LinkedChart / DetailInspector / neighbors / export / GraphToolbar
  wiring: all EXISTING; the work is composition in the shell, not new
  toolkit code.

## Revised section 3 (the shell)

`StageCanvas` becomes the real `CytoscapeCanvas` + the camera controller,
fed the meaning UGM (referentially stable, memoized) and the active
beat's `EncodingSpec`. The shell maps each beat to: which spec, which
camera move, which highlight, and which existing view/panel is showing.
The slot architecture stays (the shell takes a `renderStage`), so the
composition remains testable; production passes a `CytoscapeCanvas`-backed
stage, the SVG stand-in remains only for the headless preview.

Build order (composition-first):
1. Encoding specs + annotate, verified headlessly (this increment).
2. Wire the real `CytoscapeCanvas` + `encodingSpec` + camera into the
   stage (browser-verified). The Act I->II spec swap.
3. LinkedChart for the two bars; DetailInspector for drill.
4. Neighbors pull-in for teaming; path overlay for provenance.
5. Branded theme; subgraph export + workspace snapshot for the brief.
6. The interactive epilogue (GraphToolbar + the interaction stack).
7. Motion/easing/legibility pass (live review).

## Verification posture

Headless-verifiable (here): the encoding specs resolved against the real
UGM (`applyEncodingSpec`), `annotateForEncoding`, the beat-to-surface map
as data, and the non-render panel logic.

Browser-only (your toolchain + eyes): the rendered canvas, layouts, the
spec-swap transition, ECharts/LinkedChart and timeline rendering, the
camera moves, export output, and all motion. The acceptance ledger's
section E tracks these.

## Risks / decisions

- Bundle: composing more EXISTING toolkit surface adds little to the
  PACKAGE (it is already shipped); the demo bundle grows, but that lives
  in `examples/flagship` (and the §4 packaging quarantines its deps). The
  three new components' budget bump (rounds 51-53) is unchanged.
- The narrative must yield some screen time to visible composition (the
  "powered by" credits, the spec swap, the epilogue). That is the point.
- LinkedChart vs CoverageMeter for the two bars: show both (LinkedChart
  proves an existing view; CoverageMeter is the at-a-glance read). Decide
  on live review whether both earn their place.
