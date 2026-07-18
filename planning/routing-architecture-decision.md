# Structural edge routing: architecture decision (8.3 / 12.23)

Status: RESEARCHED, recommendation below, awaiting Zach's ruling.
Scope: the structural (UML-style) views only: MBSE diagrams, the
workbench SHACL shape view, and any future ELK-laid surface. The
force-directed UGM views are out of scope (their curves are fine).

## 1. Problem statement

Two review-confirmed symptom families:

- Routing quality (9.7, both browser passes): edges pass behind
  blocks, overlap each other, exit from visually wrong points, and
  the taxi fallback lies flat against node faces. Round-7 port
  attachment and obstacle-aware segments improved body-attached
  edges but the ceiling is low (see 2).
- Collapse stability (12.20, confirmed on the current build):
  expanding or collapsing a compartment relays the WHOLE diagram.
  The camera is already preserved (the canvas restores pan/zoom on
  same-graph rebuilds); what moves is every node, because ELK
  recomputes positions for the changed input with no memory of the
  previous arrangement.

## 2. Current implementation facts (as-built)

- ELK (elkjs 0.11.1, current) computes layered layout INCLUDING edge
  routes: each edge carries sections (start/end points plus bend
  points) and port anchors.
- structural-to-cytoscape converts routed points to Cytoscape
  `curve-style: segments` for body-attached edges; port-attached
  edges keep taxi (a port already fixes a perpendicular exit).
- The ceiling is Cytoscape's edge model: segments are relative to
  the source-target line, so they DRIFT when nodes move; there is no
  true polyline-with-fixed-coordinates edge; orthogonal corners
  cannot be rounded; label placement along a specific segment is not
  controllable. Every 9.7 symptom traces to squeezing ELK's absolute
  orthogonal routes through this relative model.
- The `engine?: ElkEngine` seam survives in core, so moving layout
  off-thread (the deleted worker wrapper, 44 lines) is a small
  reinstatement if routing cost rises.
- Budget context: @g3t/react sits at ~91% of its 420KB budget;
  @g3t/charts at ~69% of 10KB; core has headroom.

## 3. Options

### A. Keep patching Cytoscape (status quo)

Continue tuning segments/taxi within Cytoscape's edge model.

- For: zero new surface area; everything stays in one renderer;
  interaction (hover, select, context menu on edges) keeps working
  for free.
- Against: the drift problem is structural, not a tuning gap;
  segments re-anchor to the source-target line on every node move,
  so routes that ELK computed as obstacle-avoiding stop being so the
  moment anything moves. Two review rounds of patching bought
  real but bounded improvement. This path cannot reach "edges never
  cross blocks".

### B. SVG overlay from ELK sections (previously recommended)

Render structural EDGES in an SVG layer positioned over the canvas,
drawing ELK's absolute polylines directly; Cytoscape keeps nodes,
compounds, ports, and all interaction. The overlay transforms with
`cy.pan()`/`cy.zoom()` (one matrix on a `<g>`, updated on the
viewport event).

- For: pixel-faithful to what ELK computed (rounded orthogonal
  corners, exact port exits, no drift because node moves re-run ELK
  anyway on structural surfaces); full SVG styling (dashes, markers,
  per-segment labels); testable by asserting the generated path
  strings against ELK sections (pure function, jsdom-friendly, which
  NO current option offers); ~2-4KB of toolkit code, no new
  dependency.
- Against: edges leave Cytoscape's hit model, so edge hover/select/
  context-menu needs explicit SVG event wiring (pointer events on
  paths, mapping back to edge ids); z-order care (overlay above the
  edge layer, below floating panels); one more render path to
  maintain.
- Risk contained by scope: structural views don't support free node
  dragging today (layout is ELK-owned), so the overlay never has to
  track continuous node motion, only pan/zoom plus relayouts.

### C. libavoid-js (Adaptagrams connector routing)

Registry facts (checked 2026-07-08): 0.5.0-beta.5, published
2026-02-23, actively released (37 versions), zero runtime deps,
~813KB unpacked (wasm). Purpose-built incremental orthogonal/poly
connector routing around obstacles, with INCREMENTAL updates (move
one obstacle, only affected routes recompute).

- For: the strongest routing engine of the three; incremental
  updates would also serve interactive node dragging if structural
  views ever allow it; C++ libavoid is the same engine used by
  established diagram tools.
- Against: still beta; a second layout authority alongside ELK
  (who owns node positions vs routes? split-brain risk); ~800KB
  dependency against a budget-tight react package (it would have to
  live in core or load lazily); rendering STILL needs the SVG
  overlay from B or the same Cytoscape squeeze from A, so C is B
  plus a dependency, not an alternative to B; conflicts with the
  repo's deterministic/auditable, dependency-light philosophy unless
  it buys something B cannot. Today it does not: ELK already
  computes obstacle-aware routes; our problem is RENDERING them
  faithfully, not computing them.

## 4. The 12.20 fold-in: collapse stability

Independent of A/B/C, because it is a LAYOUT memory problem, not a
routing one. ELK supports interactive placement: seed the graph with
previous coordinates (`elk.position` per node) and set
`elk.layered.cycleBreaking.strategy: INTERACTIVE`,
`elk.layered.nodePlacement.strategy: INTERACTIVE`, plus the
`crossingMinimization: INTERACTIVE` value our structural.ts ALREADY
exposes as an option seam. Experiment spec:

1. On a collapse/expand rebuild (the same-graph-rebuild path that
   already preserves the camera), feed each surviving node's prior
   coordinates as `elk.position` hints and switch the three
   strategies to INTERACTIVE for that run only.
2. Accept criterion: untouched containers move less than one grid
   unit; the toggled container resizes in place.
3. Fallback if ELK's interactive mode disappoints: pin coordinates
   of all nodes except the toggled subtree via `elk.fixed` semantics
   (fixed layouter for the stable region, layered for the changed
   region), at the cost of stale whitespace.

This experiment is cheap (options plumbing through an existing seam)
and should land BEFORE any routing work, since a stable scene makes
routing regressions visible.

## 5. Recommendation

B, staged, with C explicitly rejected for now and revisitable:

- P0: the 12.20 interactive-mode experiment (section 4). Small,
  independent, unblocks honest evaluation of everything else.
- P1: SVG overlay behind a canvas prop (`structuralEdgeLayer:
"cytoscape" | "svg-overlay"`, default unchanged), MBSE shell opts
  in first. Contract tests assert path generation from ELK sections;
  the browser pass judges fidelity. Edge interaction wiring (hover
  - context menu parity) is part of the P1 definition of done, not
    a follow-up.
- P2: retire the segments squeeze once the overlay passes two
  browser rounds; taxi remains the no-geometry fallback.
- Revisit C only if a requirement appears that ELK cannot serve
  (live edge re-routing during free node dragging is the realistic
  trigger), and then as compute-only behind the same overlay
  renderer, off-thread via the surviving ElkEngine-style seam.

## 6. What a FAIL would look like (falsifiability)

- If the overlay's pan/zoom sync shows visible lag on the MBSE
  diagram at 4k, B degrades to A for that surface (the overlay is
  per-surface opt-in, so this is a switch, not a rewrite).
- If ELK interactive mode still moves untouched nodes materially,
  section 4's fallback (fixed-region layout) is the next experiment,
  and its stale-whitespace cost goes to Zach for a ruling.
