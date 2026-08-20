---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief: obstacle-aware ("smart") edge routing on every example

Owner ask (Jake, 2026-08-14): "I want smart routing on every example."

## Current coverage (verified against source this session)

Smart routing = the obstacle-aware machinery that already ships:
`layoutStructural` g3t-engine obstacle-aware routes (`routeEdges`,
default on; elkjs itself left the tree 2026-07-19) rendered as
`curve-style: segments` via `g3t-structural-edge-routed`, plus the
generic `routeOrthogonal` A* router (`packages/core/src/route/`,
exported from `@g3t/core`) used for interactive re-routing.

| Example | View / layout | Smart routing today |
|---|---|---|
| Routing Lab | StructuralSvgView (`routeEdges` knob) | YES |
| MBSE Satellite Workbench | layoutStructural -> canvas | YES |
| Ontology Workbench | StructuralSvgView | YES |
| Provenance Auditor | CytoscapeCanvas, fcose default | no (bezier) |
| Supply Chain Digital Thread | CytoscapeCanvas, `layout="breadthfirst"` | no |
| Biomedical KG | CytoscapeCanvas, fcose default | no |
| Analytics Dashboard (examples/decision-dashboards) | CytoscapeCanvas | no |
| Style Lab | CytoscapeCanvas, `layout="grid"` x2 | no |
| Scale (8,000 nodes) | CytoscapeCanvas, preset/fcose | no (see cap below) |

Gap: the general (non-structural) CytoscapeCanvas path has no routing
at all. Closing it is a NEW CAPABILITY, not demo wiring.

## Design

New post-layout routing pass for non-structural scenes.

1. **Pure geometry module** `packages/core/src/route/route-scene-edges.ts`:
   given node boxes (id, x, y, w, h) + edge endpoint pairs, produce per-edge
   routed polylines via `routeOrthogonal` (per-edge obstacles = all boxes
   except the endpoints'; the router's >64-obstacle pruning already handles
   density). Pure and vitest-testable, no browser, no React. Lives in
   `@g3t/core` alongside `orthogonal-router.ts` — not in the react canvas
   subtree — so future SVG renderers and server-side layout tooling can
   consume it without a React dependency.
2. **Canvas wiring** in CytoscapeCanvas: new prop
   `routeEdges?: boolean | { maxEdges?: number; clearance?: number; bendPenalty?: number; minStub?: number }`
   for NON-structural scenes (structural scenes already route; prop is a
   no-op there). The structural no-op detection predicate: check
   `cy.edges('.g3t-structural-edge-routed').length > 0`; if any structural
   routed edge exists the scene is structural and the pass is skipped. When
   `true`, defaults apply: `clearance=12`, `bendPenalty=30`, `minStub=28`
   (the `OrthogonalRouteRequest` defaults in the `routeOrthogonal` function
   body of `packages/core/src/route/orthogonal-router.ts`; line numbers are
   point-in-time -- the interface field names `clearance`, `bendPenalty`,
   `minStub` are the stable references). On `layoutstop`, a generation
   counter is incremented; the routing callback captures the generation at
   invocation. If the layout ran with `animate: false` (or `animationDuration
   === 0`), bounding boxes are read immediately and the pass runs inside
   `cy.batch()`. If `animate: true`, the pass is deferred by
   `setTimeout(pass, animationDuration + 16)` so that animation frames have
   settled before positions are read -- the deferred callback is a no-op if
   the generation counter has advanced (a newer `layoutstop` superseded it).
   This guard also covers double-fire: if a layout plugin emits `layoutstop`
   twice, only the second invocation's callback runs (the first sees a stale
   generation). The W4 demo shells that enable routing use `animate={false}`
   (the perf fix landed 2026-06-17), making the default path synchronous; the
   deferred path covers library consumers with animated layouts. The `cy.batch()`
   write sets `_segDist`/`_segWeight` + class `g3t-canvas-edge-routed` per
   edge atomically (one `cy.batch()` fires one style-invalidation cycle for
   all N edges). The stylesheet rule for `edge.g3t-canvas-edge-routed` uses
   `segment-distances: data(_segDist)` and `segment-weights: data(_segWeight)`,
   matching the exact field names written by the routing pass and mirroring
   the existing `edge.g3t-structural-edge-routed` rule at
   `structural-to-cytoscape.ts:994-995`. `g3t-structural-edge-routed` is NOT
   reused: it carries structural-specific listeners in
   `structural-edge-overlay.tsx` and an `opacity:0` rule in SVG-overlay mode
   -- both would incorrectly affect force-layout edges. This is a restyle/data
   write, NEVER a canvas re-init: camera and positions hold (CLAUDE.md
   same-input-graph doctrine).
3. **Endpoint anchoring**: `RouteTerminal.point` is placed at the bounding
   box center of each endpoint node; `RouteTerminal.side` is inferred from
   the relative position of the two nodes using the following complete
   decision rule. Let `dx = targetCenterX - sourceCenterX` and
   `dy = targetCenterY - sourceCenterY`. Horizontal dominant (`|dx| >= |dy|`,
   including the tie case `|dx| == |dy|`): source exits EAST if `dx > 0`,
   else WEST; target enters WEST if `dx > 0`, else EAST. Vertical dominant
   (`|dy| > |dx|`): source exits SOUTH if `dy > 0`, else NORTH; target
   enters NORTH if `dy > 0`, else SOUTH. Zero-vector (source center equals
   target center or self-loop): source exits EAST, target enters WEST;
   self-loops are excluded from the routing pass entirely (passed through
   unchanged). W1's endpoint-anchoring tests cover all four cardinal
   arrangements: horizontal-dominant (left-of, right-of), vertical-dominant
   (above, below), near-diagonal where `|dx|` approximates `|dy|` (resolved
   by horizontal-dominant rule), and zero-vector/self-loop. The first and
   last route segments must be perpendicular to the inferred exit/entry sides.
   Nodes with custom anchor declarations use the same box-center default; the
   W4 demo shells have no port-precise anchor declarations on force-layout
   edges (confirmed by inspection of AuditShell.tsx, ThreadShell.tsx, and
   BioShell.tsx -- the `anchor` fields there are capability-callout doc links,
   not RouteTerminal overrides). Port-precise anchoring is a follow-on.
4. **Fallback and stale-data hygiene**: `routeOrthogonal` returning null on
   any pass (first or subsequent) triggers a clear-prior-data step: remove
   `_segDist`/`_segWeight` from the element's data and remove the routed
   class. The edge then reverts to bezier with no phantom polylines. Per-edge
   graceful degradation; no all-or-nothing.
5. **Scale cap**: default `maxEdges` gate (proposed 600); above it the
   pass skips and warns once. The gate predicate is
   `cy.edges(':visible').length > maxEdges`, where `:visible` excludes edges
   hidden by the `g3t-hidden` class (filtered or type-hidden edges). This
   single predicate is evaluated identically for BOTH the `layoutstop` pass
   and the drag-free incident-edge re-route, so filtered scenes and
   unfiltered scenes apply the same cap. The Scale shell routes only in
   collapsed/supernode view (post-`collapseByCluster`), never on the raw 8k
   scene.
6. **Scale shell conditionality**: `ScaleSurface.tsx` already tracks view
   mode as `view: View` where `View = { kind: "clusters" } | { kind: "drill"; superId: string }`.
   W5 passes `routeEdges={view.kind === "clusters"}` — routing is active in
   the collapsed/clusters view and disabled in drill-down, with no additional
   state needed.
7. **Drag**: incident-edge re-route on drag-free using the same pass, subject
   to the `maxEdges` gate (see point 5). Grab/drag live re-route is a
   follow-on; the structural drag machinery is port-based and does not
   transfer directly.
8. **Per-shell kill-switch**: each demo shell that enables routing does so
   via a module-level constant (e.g., `const ROUTE_EDGES = true`) passed to
   the `routeEdges` prop. A visual rejection by Zach on any shell is reverted
   by flipping that constant to `false` and pushing — no new API surface and
   no PR coordination across shells.
9. **Adoption channel discipline** (CLAUDE.md): prop exposure +
   wiring-guide snippet + executable twin in `examples/wiring/`.

## Work items

- [ ] W1 core: `packages/core/src/route/route-scene-edges.ts` pure pass +
      unit tests covering: routes clear obstacle boxes; endpoint anchoring
      for all four cardinal arrangements (source left-of target: EAST/WEST;
      source right-of: WEST/EAST; source above: SOUTH/NORTH; source below:
      NORTH/SOUTH); near-diagonal where `|dx|` approximates `|dy|` resolves
      to horizontal-dominant; zero-vector/self-loop edges are passed through
      unchanged; first/last route segment is perpendicular to inferred side
      in each case; null return clears prior data (no stale
      `_segDist`/`_segWeight`); pruning at >64 obstacles; maxEdges gate
      (`cy.edges(':visible').length > maxEdges`) applied equally to
      layoutstop and drag-free paths.
- [ ] W2 CytoscapeCanvas `routeEdges` prop: layoutstop hook with generation
      counter (double-fire and rapid-restart guard), animate-aware box-read
      timing (immediate when `animate={false}`, deferred by
      `animationDuration + 16ms` when `animate={true}`), `cy.batch()` data
      write-back, `g3t-canvas-edge-routed` class application, null-return
      stale-data clear, re-route on drag-free (gated by `cy.edges(':visible').
      length > maxEdges`), structural no-op (detected by
      `cy.edges('.g3t-structural-edge-routed').length > 0`), test via the
      canvas test harness. Add stylesheet rule for `edge.g3t-canvas-edge-
      routed` with `curve-style: segments`, `segment-distances: data(_segDist)`,
      and `segment-weights: data(_segWeight)` (confirmed field names matching
      the routing pass output and the existing structural rule).
- [ ] W3 wiring guide: "Route edges around nodes on any layout" snippet +
      examples/wiring executable twin.
- [ ] W4 enable on demos: Auditor, Supply, Bio, Analytics popout+canvas,
      Style Lab (both panes). Each shell gets its CapabilityBubble entry
      updated and a module-level `const ROUTE_EDGES = true` constant for
      per-shell kill-switch.
- [ ] W5 Scale shell: `routeEdges={view.kind === "clusters"}` using the
      existing `view` state variable in `ScaleSurface.tsx`.
- [ ] W6 gates + ledger: `pnpm run gates`, bundle-size rationale in
      scripts/check-bundle-size.mjs if the react bundle grows, CHANGELOG
      entry, STATUS.md queue note. NEVER pipe gates through tail/head.

## Non-goals

- Engine-quality work (LAY-005 dummy chains, PRF-003 channel router,
  MSAGL nudging) — separate thread, already roadmapped.
- Live per-tick drag re-routing on force scenes (follow-on).
- Routing the raw 8k Scale scene.

## Verification

- Unit: W1 pure tests; W2 harness tests assert routed data present after
  layoutstop and camera untouched (no fit/re-init); W2 harness also
  verifies that a second layoutstop emission within the same generation is
  a no-op (double-fire guard).
- Quality oracle: import `gradeRoutes` from `src/demo/routing/quality.ts`
  (file confirmed to exist, exports `gradeRoutes` at line 88; the vitest
  `src/**/*.test.{ts,tsx}` include covers this path) in a test asserting
  zero box violations on a representative fcose-like fixture.
- Visual: Zach reviews all five W4 shells in a single Pages playground
  session before merge (not piecemeal) to identify any global aesthetic
  rejection before the per-shell kill-switch fallback is needed. Routing
  on force layouts reads circuit-diagram orthogonal -- flag for his
  sign-off.

## Defaults taken (overridable)

- D1: orthogonal is the only smart routing we ship; force-layout examples
  get orthogonal segments, accepting the look change. Zach reviews visual
  output before merge; each shell has a module-level `ROUTE_EDGES` constant
  as a kill-switch if the orthogonal-on-force look is rejected.
- D2: routing is ON by default in the listed demo shells (via `ROUTE_EDGES`
  constants), exposed as an opt-in prop (default off) in the library itself.
  Developers using a demo shell as reference will see routing active; the
  wiring-guide snippet explicitly calls out that the library default is off.
- D3: maxEdges cap 600; Scale routes collapsed view only. The `layoutstop`
  gate and drag-free gate both enforce the same cap.
- D4: when `routeEdges={true}`, numeric sub-options default to
  `clearance=12`, `bendPenalty=30`, `minStub=28` -- the `OrthogonalRouteRequest`
  defaults in the `routeOrthogonal` function body of
  `packages/core/src/route/orthogonal-router.ts` (verified at brief-authoring
  time; refer to the `OrthogonalRouteRequest` interface for the canonical
  field names rather than line numbers, which shift with edits). These are
  documented in the wiring-guide snippet so consumers know what to override.
  The parameter names (`clearance`, `bendPenalty`, `minStub`) map directly
  to the `OrthogonalRouteRequest` interface fields -- no translation layer
  required.
