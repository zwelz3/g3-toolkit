# The `onReady` Core Handle: Reach Inventory and Promotion Proposal

**Area:** design
**Owns:** no spec requirements. This record is the first acceptance item
of issue #19 (a written inventory of what consumers use the raw
Cytoscape `Core` from `onReady` for) and the proposal the maintainer
rules on. It changes no export; the ruling decides which of the
proposed surfaces enter the corpus through gap analysis.
**Grounding:** every reach was read at `main` 85c6c69 (2026-10-13) in
`src/demo/` (all eight registered shells), `examples/` (wiring twins,
decision-dashboards, full-workspace), `docs/wiring-guide.md` and
`docs/consuming-g3t.md`, `packages/react/src` (the components that take
the handle, the library's own `onReady` consumer, the exported
handle-based functions, the stories), the unit and e2e tests that
exercise the pattern, and both README quickstarts.
**Related rulings:** #18 (`cy` vs `core` prop naming, section 7), #26
(`graphUpdate="additive"`, which already retires one documented
recipe), #40 (`labelCollision`), #27 (the `onReady` ordering guarantee
the canvas now documents at `CytoscapeCanvas.tsx:866-875`).

## 1. What `onReady` is today

`CytoscapeCanvasProps.onReady?: (cy: Core) => void`
(`packages/react/src/views/canvas/CytoscapeCanvas.tsx:875`). It fires
once per instance, synchronously after construction and after the
initial layout STARTED; a preset layout has finished by then, a force
layout has not (#27). The callback is read through a ref
(`onReadyRef`, :1500), so a new arrow per render does not re-init. On
a re-init (different graph, or a content change to `layout`,
`edgeStyle`, `layoutOptions`, `interactionOptions`, `containment`,
`animate`) the old instance is destroyed and `onReady` fires again
with the new one. Nothing tells the consumer the old handle died:
`GraphToolbar` guards with `cy.destroyed()` (:194-198) because a
stored handle goes stale between an unmount and the successor's
`onReady`.

The value is the peer `cytoscape` instance (`peerDependencies:
cytoscape >=3.28.0`, `packages/react/package.json:90`). Its API is
cytoscape's, so g3t semver cannot cover it; the wiring guide says as
much in the scoped caveat at `docs/wiring-guide.md:341-348`.

## 2. Method

A reach is one site that calls into, stores, forwards or publishes the
handle. Each row records the site, the call, one primary category, R
(read only) or W (mutates the instance), and whether a first-class
surface covers it today: **yes** (a prop, store, document, command-bus
event or exported helper does the same job), **partial** (a surface
exists but needs the handle itself, or covers most of the case), or
**none**. Library-internal uses of the instance the canvas owns
(`structural-to-cytoscape.ts`, `apply-label-collision.ts`,
`box-selection-sync.ts`, `structural-edge-overlay.tsx`, and the
canvas's own `tap`/`cxttap`/`grab`/`drag`/`free` bindings at
`CytoscapeCanvas.tsx:1912-2075`) are not reaches: they never leave the
component. Tests are tabulated separately (section 4) because they
exercise the pattern rather than add to it.

Categories (one per row): `camera` (fit, animate, zoom, pan, center,
extent), `position-read`, `position-write` (position set plus the
lock/unlock it needs), `layout-run`, `gesture` (user-input event
registration), `lifecycle` (layoutstart/layoutstop/render subscription,
destroyed guards), `class` (host class or native `select()` mutation),
`data-write`, `style-bypass`, `read` (data, class or computed-style
reads), `export`, `lookup`, `bus-wiring` (the context-action command
bus bound over the handle), `plumbing` (escrow in state or a ref,
pass-through to `GraphToolbar`/`Minimap`, the `?e2e=1` registry).

## 3. Inventory

### 3.1 Demo shells (`src/demo`)

Three of the eight registered shells never touch the handle:
Provenance Auditor (`src/demo/audit`), Biomedical (`src/demo/bio`),
and the MBSE shell on its default SVG renderer (the handle appears only
under the deprecated Cytoscape structural option). Neither README
quickstart (`README.md:69-91`, `packages/react/README.md:66-86`)
passes `onReady`: the documented first app has zero reaches.

| # | Where | What | Category | R/W | First-class today |
|---|---|---|---|---|---|
| S1 | `src/demo/stylelab/StyleLabShell.tsx:131` | `cy.$id(id).addClass("lab-muted")` for each `MUTED_IDS` (legacy pane) | class | W | none: no host class API (overlays write only `g3t-ov-*` for registered overlays) |
| S2 | `StyleLabShell.tsx:132` | `cy.$id(SELECTED_ID).select()`: NATIVE selection so the legacy stylesheet's `:selected` rule fires | class | W | partial: the selection store drives the `g3t-selected` class, never `:selected`; the lab needs the native pseudo-class on purpose |
| S3 | `StyleLabShell.tsx:133` | `publishCanvas("style-lab-legacy")?.(cy)` (e2e registry) | plumbing | R | none, by design (test channel) |
| S4 | `StyleLabShell.tsx:134` | `setLegacyCy(cy)` | plumbing | R | n/a |
| S5 | `StyleLabShell.tsx:139` | `addClass("lab-muted")` (engine pane) | class | W | none |
| S6 | `StyleLabShell.tsx:140` | `.select()` (engine pane) | class | W | partial (as S2) |
| S7 | `StyleLabShell.tsx:142` + `style-lab-fixture.ts:137-160` | `styleElementsFromCy(cy)`: `cy.elements().forEach`, `ele.data(f)`, `ele.isNode()` | read | R | yes: the UGM holds the same properties; the handle is a convenience here |
| S8 | `StyleLabShell.tsx:144` | `cy.$id(el.id).hasClass("lab-muted")` | read | R | none |
| S9 | `StyleLabShell.tsx:152` | `applyVisualAttributes(cy, resolved)` (exported projection, per-element bypasses) | style-bypass | W | partial: `useStyleOverrideStore` applies node bypasses through the canvas, but the engine projection needs edges and the honesty report |
| S10 | `StyleLabShell.tsx:153` | `publishCanvas("style-lab-engine")?.(cy)` | plumbing | R | none, by design |
| S11 | `StyleLabShell.tsx:168-170` | `cy.nodes().map(n => n.data("label"))` | read | R | partial: `ugmToCytoscapeElements` (exported) stamps the same label, so it is recomputable without the handle |
| S12 | `StyleLabShell.tsx:173-190` | `cy.nodes()` with `n.position()`, `n.width()`, `n.height()`; `cy.edges()` with `e.source().id()`, `e.target().id()` | position-read | R | partial: `harvestSceneFromCy` (exported) does this, but takes the handle; no handle-free positions accessor |
| S13 | `StyleLabShell.tsx:203-221` | parity table: `legacyCy.elements()`, `ele.style(key)`, `engineCy.$id(id).style(key)` | read | R | none (computed-style inspection) |
| S14 | `StyleLabShell.tsx:235-249` | `applyVisualAttributes(cy, tiered, { resetFirst: true })` on LOD tier change | style-bypass | W | partial (as S9) |
| S15 | `StyleLabShell.tsx:191` | `setEngineCy(cy)` | plumbing | R | n/a |
| S16 | `src/demo/scale/ScaleSurface.tsx:516` | `<GraphToolbar ugm={canvasUgm} cy={core} />` | plumbing | - | n/a |
| S17 | `ScaleSurface.tsx:528-530` | `onReady={(c) => { markReady(...); setCore(c); ...` | plumbing | R | n/a |
| S18 | `ScaleSurface.tsx:539` | `c.on("layoutstart", ...)` phase instrumentation | lifecycle | R | none: no `onLayoutStart`/`onLayoutStop` prop |
| S19 | `ScaleSurface.tsx:559` | `c.fit(undefined, 50)` after a cached-position preset restore (the canvas forces `fit:false` on preset) | camera | W | yes: `createCameraController(c).frameAll()` or the toolbar Fit; both still need the handle |
| S20 | `ScaleSurface.tsx:565` | `c.one("layoutstop", ...)` | lifecycle | R | none |
| S21 | `ScaleSurface.tsx:568-572` | `c.nodes().forEach(n => n.position())` into `POS_CACHE` | position-read | R | partial: `capturePositions(cy)` and `captureWorkspace({ cy })` exist but take the handle. The WRITE side is already first-class: `layout="preset"` plus `layoutOptions.positions` (`ScaleSurface.tsx:291-296`) is `initialPositions` in all but name |
| S22 | `src/demo/supply/ThreadShell.tsx:280` | `setCore(c)` | plumbing | R | n/a |
| S23 | `ThreadShell.tsx:283` | `publishCanvas("supply")?.(c)` | plumbing | R | none, by design |
| S24 | `ThreadShell.tsx:289-299` | after 600 ms: `c.destroyed?.()`, `c.zoom()`, `c.extent()`, `c.zoom({ level: 0.55, position })` (readability floor after the initial fit) | camera | W | partial: `interactionOptions.minZoom` bounds the user's zoom but whether `fit` is clamped by it is unverified here; the camera controller has no zoom setter |
| S25 | `ThreadShell.tsx:302-308` + `confidence-dim.ts:31-57` | `core.batch`, `core.edges().forEach`, `e.data("_confidence")`, `e.data({ _confidence })` | data-write | W | partial: the encoding spec owns confidence-driven opacity; the toggle could be a spec change (restyle-only, same precedence below the emphasis layer) |
| S26 | `ThreadShell.tsx:438` | `harvestSceneFromCy(core)` for the SVG/Canvas adapter panes | position-read | R | partial: exported, takes the handle |
| S27 | `ThreadShell.tsx:597` | `<Minimap core={core} width={180} height={120} />` | plumbing | - | n/a |
| S28 | `src/demo/mbse/MbseShell.tsx:226` | `onReady={publishCanvas("mbse")}` (deprecated Cytoscape structural renderer only) | plumbing | R | none, by design |
| S29 | `src/demo/ontology/OntologyShell.tsx:257-260` | `viewCore` state, reset to `null` on every tab switch so the toolbar never holds a destroyed handle | plumbing | R | n/a (staleness management the consumer must do by hand) |
| S30 | `OntologyShell.tsx:677` | `<GraphToolbar cy={viewCore} />` (hierarchy tab) | plumbing | - | n/a |
| S31 | `OntologyShell.tsx:702` | `onReady={setViewCore}` | plumbing | R | n/a |
| S32 | `OntologyShell.tsx:753` | `<GraphToolbar cy={viewCore} />` (neighborhood tab) | plumbing | - | n/a |
| S33 | `OntologyShell.tsx:774` | `onReady={setViewCore}` | plumbing | R | n/a |
| S34 | `OntologyShell.tsx:837` | `<GraphToolbar cy={viewCore} />` (instances tab) | plumbing | - | n/a |
| S35 | `OntologyShell.tsx:843` | `onReady={setViewCore}` | plumbing | R | n/a |

### 3.2 Examples (`examples/`)

`examples/full-workspace` has no reach. `AnalyticsDashboard` handles
every context action (hide, subgraph, find path) through the command
bus and the `hidden` prop; its one operation on the handle is a camera
fit.

| # | Where | What | Category | R/W | First-class today |
|---|---|---|---|---|---|
| X1 | `examples/decision-dashboards/src/AnalyticsDashboard.tsx:94-102` | `setCore` plus a `coreRef` written in an effect | plumbing | R | n/a |
| X2 | `AnalyticsDashboard.tsx:172-178` | after `context:focusNode` hides: `c.destroyed?.()`, `c.fit(c.elements().filter(el => el.style("display") !== "none"), 32)` | camera | W | partial: `focusNodes(visibleIds)` on the controller (handle-based); the host owns the hidden set, so the computed-style read is avoidable |
| X3 | `AnalyticsDashboard.tsx:328` | `<GraphToolbar ugm={ugm} cy={core} />` | plumbing | - | n/a |
| X4 | `AnalyticsDashboard.tsx:335` | `onReady={setCore}` | plumbing | R | n/a |
| X5 | `examples/wiring/src/wiring-examples.test.tsx:130-160` | FocusButton twin: `cy.getElementById(id).nonempty()`, `cy.animate({ center: { eles }, zoom: 1.4 }, { duration: 250 })` | camera | W | partial: `panToNode` keeps zoom, `focusNodes` fits; no "center at zoom z" |
| X6 | `wiring-examples.test.tsx:165-166` | `runGraphLayout(cy, "force", DEFAULT_LAYOUT_OPTIONS)` | layout-run | W | partial: the `layout` prop re-inits (camera reset); `runGraphLayout` is the in-place path and takes the handle |
| X7 | `wiring-examples.test.tsx:294-297` | `captureWorkspace({ cy: null })`, `applyWorkspace(..., { cy: null })` | position-write | R/W | partial: both accept `null` and then carry no positions |
| X8 | `wiring-examples.test.tsx:1086` | `<Minimap core={null} />` | plumbing | - | n/a |
| X9 | `wiring-examples.test.tsx:1320-1340` | `createCameraController(cy, { duration: 0 }).frameAll()` | camera | W | yes (the controller is the surface; it takes the handle) |

### 3.3 Documentation snippets

| # | Where | What | Category | R/W | First-class today |
|---|---|---|---|---|---|
| D1 | `docs/wiring-guide.md:159-175` | FocusButton: `cy?.getElementById(nodeId)`, `cy?.animate({ center, zoom: 1.4 })` | camera | W | partial (as X5) |
| D2 | `wiring-guide.md:192` | `runGraphLayout(cy, "force", DEFAULT_LAYOUT_OPTIONS)` | layout-run | W | partial (as X6) |
| D3 | `wiring-guide.md:317-322` | `cy.on("dbltap", "node", evt => ...evt.target.id()...)` | gesture | R | none; the guide states it: "There is no `onNodeDoubleClick` prop" (:305) |
| D4 | `wiring-guide.md:324-331` | `cy.on("dbltap", evt => { if (evt.target === cy) cy.animate({ fit: { eles: cy.elements(), padding: 40 } }) })` | gesture | W | none for the gesture; the fit is `frameAll` |
| D5 | `wiring-guide.md:929-932` | `captureWorkspace({ cy, spec })`, `applyWorkspace(parsed, { cy, setSpec })` | position-write | R/W | partial (as X7) |
| D6 | `wiring-guide.md:1260-1262` | `createCameraController(cy, { padding: 48 })`, `focusNodes`, `frameAll` | camera | W | yes |
| D7 | `docs/consuming-g3t.md:137` | `layout.captureFrom(cy)` (`IncrementalLayout`, typed `any`) | position-read | R | yes: `graphUpdate="additive"` (#26) supersedes the recipe, as :128 says |
| D8 | `consuming-g3t.md:140` | `layout.apply(cy, new Set(nextNodeIds))` (lock, layout, unlock) | layout-run | W | yes (additive) |
| D9 | `consuming-g3t.md:147-151` | `capturePositions(cy)`, `applyIncrementalLayout(cy, update, options)` | position-read | R/W | yes (additive) |
| D10 | `consuming-g3t.md:261` | `relayoutAroundFixed(cy, { fixed: [id] })` | layout-run | W | none as a prop; handle-based export |

Prose that describes the handle rather than calling it, and would be
reworded under any ruling: `wiring-guide.md:13` (snippets assume `cy`
in scope), `:27` (channel 2 "hands you the Cytoscape `Core` for camera
and layout control"), `:82-84` (the `cy`/`core` naming note), `:337-348`
(bind in `onReady`, not an effect; the caveat), `:1265-1269` (Minimap
from `onReady`); `consuming-g3t.md:155-156`; `Overview.mdx:26`
("Toolbars, search, and overlays act on that handle"); the
`Minimap.tsx:13-18` and `GraphToolbar.tsx:172` docblocks.

Two findings while reading: the dbltap recipe (D3/D4) has no executable
twin in `examples/wiring/src/wiring-examples.test.tsx` (no `dbltap` or
`.on(` call there), although the guide's preamble (:8-12) says every
integration path runs as a test; and the only gesture reach in the
whole inventory is that documentation snippet. No shell binds a
gesture on the handle.

### 3.4 Library (`packages/react/src`)

Components that take the handle, the library's own `onReady` consumer,
the exported handle-based helpers, and the stories.

| # | Where | What | Category | R/W | First-class today |
|---|---|---|---|---|---|
| L1 | `interaction/toolbar/GraphToolbar.tsx:153-165` | `runGraphLayout`: `cy.layout(config).run()`, cose fallback when fcose is unregistered | layout-run | W | is the surface (handle-based) |
| L2 | `GraphToolbar.tsx:194-198` | `cyProp.destroyed()` stale-handle guard (9.9) | lifecycle | R | none: the guard exists because the handle outlives the instance |
| L3 | `GraphToolbar.tsx:260-266` | search pick: `cy.getElementById(id)`, `cy.animate({ center, zoom: Math.max(cy.zoom(), 1.2) })` | camera | W | partial: "center at zoom at least z" has no controller move |
| L4 | `GraphToolbar.tsx:458-461` | `cy.png({ full: true, scale: 2 })` | export | R | none |
| L5 | `GraphToolbar.tsx:488` | `cy.zoom(cy.zoom() * 0.8)` | camera | W | none in the controller (no `zoomBy`) |
| L6 | `GraphToolbar.tsx:496` | `cy.zoom(cy.zoom() * 1.25)` | camera | W | none in the controller |
| L7 | `GraphToolbar.tsx:503` | `cy.fit(undefined, 40)` | camera | W | yes: `frameAll` |
| L8 | `interaction/camera/Minimap.tsx:94` | `createCameraController(core)` | camera | - | yes |
| L9 | `Minimap.tsx:102, 105` | `cy.destroyed()` (effect entry and per frame) | lifecycle | R | none |
| L10 | `Minimap.tsx:133-137` | `cy.elements().boundingBox()`, `cy.extent()` | camera | R | none: no extent or bounding-box accessor |
| L11 | `Minimap.tsx:145-155` | `n.parent()` ancestry walk (compound collapse to one mark) | read | R | partial: the host owns `containment`; the UGM knows the parent edges |
| L12 | `Minimap.tsx:163-173` | `cy.edges()`, `e.source()`, `e.target()`, `.position()` | position-read | R | none handle-free |
| L13 | `Minimap.tsx:178-199` | `cy.nodes(":orphan")`, `n.isParent()`, `n.boundingBox()`, `n.position()` | position-read | R | none handle-free |
| L14 | `Minimap.tsx:208` | `cy.extent()` for the viewport rectangle | camera | R | none |
| L15 | `Minimap.tsx:236-239` | `cy.on("render", schedule)` / `cy.off("render", ...)` | lifecycle | R | none: no viewport-change subscription |
| L16 | `Minimap.tsx:249` | `controller.panToPoint(mx, my, { animate: false })` | camera | W | yes |
| L17 | `interaction/camera/cameraController.ts:69-73` | `cy.collection()`, `cy.getElementById(id)` | lookup | R | is the surface |
| L18 | `cameraController.ts:80-87` | `cy.animate({ fit })` or `cy.fit(eles, padding)` | camera | W | is the surface |
| L19 | `cameraController.ts:98-108` | `cy.animate({ center })` or `cy.center(el)` | camera | W | is the surface |
| L20 | `cameraController.ts:120-133` | `cy.zoom()`, `cy.width()`, `cy.height()`, `cy.animate({ pan })` or `cy.pan(pan)` | camera | W | is the surface |
| L21 | `views/popout/NeighborhoodPopout.tsx:150-166` | the library's own `onReady`: `c.destroyed()`, `c.getElementById(focusId)`, `c.center(ele)`, `c.zoom(Math.max(c.zoom(), 1.1))`, `c.fit(undefined, 16)`, `c.one("layoutstop", applyCamera)` | camera | W | partial: the library itself needs post-layout framing; no initial-camera prop |
| L22 | `interaction/workspace/workspace.ts:47-50` | `captureWorkspace`: `cy.nodes().forEach(n => n.position())` | position-read | R | is the surface (handle-based) |
| L23 | `workspace.ts:77-87` | `applyWorkspace`: `cy.batch`, `getElementById`, `ele.unlock()`, `ele.position(pos)` | position-write | W | is the surface (handle-based) |
| L24 | `interaction/relayout.ts:36-74` | `relayoutAroundFixed`: `destroyed`, `collection`, `isParent`/`descendants`, `locked`/`lock`/`unlock`, `cy.layout({...}).run()`, `layout.one("layoutstop")` | layout-run | W | is the surface (handle-based) |
| L25 | `interaction/context-menu/wire-cytoscape-actions.ts:62-76` | `context:pinNodes`: `el.lock()`, `el.addClass("g3t-pinned")` | class | W | yes: `usePositionPinStore` and the canvas pin effect do the same; a duplicate path |
| L26 | `wire-cytoscape-actions.ts:79-96` | `context:hideNodes`: `el.style("display", "none")`, `connectedEdges().style(...)`, `addClass("g3t-hidden")` | style-bypass | W | yes: the `hidden` prop. Hazard: a `display` bypass is not cleared by the prop's class toggle, so the two paths disagree on un-hide |
| L27 | `wire-cytoscape-actions.ts:98-121` | `context:focusNode`: `cy.collection()`, `getElementById`, `cy.fit(collection, 40)` | camera | W | yes: `focusNodes` |
| L28 | `views/canvas/visual-attributes-to-cytoscape.ts:156-175` | `applyVisualAttributes`: `cy.$id(id)`, bypass writes and `removeStyle` | style-bypass | W | is the surface (handle-based; a Cytoscape projection by definition) |
| L29 | `views/scene/harvest-scene.ts:72-110` | `harvestSceneFromCy`: `cy.nodes()`/`edges()`, `n.position()`, `n.width()`/`height()`, `e.style(...)`, display filter | position-read | R | is the surface (handle-based) |
| L30 | `views/canvas/CytoscapeCanvas.stories.tsx:359-367, 394-396` | `cyRef.current = cy` in `onReady`; `wireCytoscapeContextActions(cy, eventBus, ugm, ...)` in an effect over the ref | bus-wiring | W | partial: the bus is first-class; the wiring takes the handle, and the story uses the effect-over-stored-handle shape the guide warns against (:337-339) |
| L31 | `interaction/camera/Minimap.stories.tsx:56-71, 81-96, 113` | `setCore` plus `<Minimap core={core} />` (three stories) | plumbing | - | n/a |
| L32 | `interaction/algorithms/ToolbarAndAlgorithms.stories.tsx:54-58` | `setCy` plus `<GraphToolbar ugm={ugm} cy={cy} />` | plumbing | - | n/a |

### 3.5 Aggregate

Counts are tallied from the 86 rows above (35 shell, 9 example, 10
documentation, 32 library) by the Category column.

| Category | Rows | R | W | yes | partial | none | n/a |
|---|---|---|---|---|---|---|---|
| plumbing | 23 | 14 | 0 | 0 | 0 | 4 | 19 |
| camera | 20 | 2 | 17 | 10 | 6 | 4 | 0 |
| position-read | 9 | 8 | 1 | 4 | 3 | 2 | 0 |
| layout-run | 6 | 0 | 6 | 3 | 2 | 1 | 0 |
| class | 5 | 0 | 5 | 1 | 2 | 2 | 0 |
| lifecycle | 5 | 5 | 0 | 0 | 0 | 5 | 0 |
| read | 5 | 5 | 0 | 1 | 2 | 2 | 0 |
| style-bypass | 4 | 0 | 4 | 2 | 2 | 0 | 0 |
| position-write | 3 | 0 | 3 | 1 | 2 | 0 | 0 |
| gesture | 2 | 1 | 1 | 0 | 0 | 2 | 0 |
| bus-wiring | 1 | 0 | 1 | 0 | 1 | 0 | 0 |
| data-write | 1 | 0 | 1 | 0 | 1 | 0 | 0 |
| export | 1 | 1 | 0 | 0 | 0 | 1 | 0 |
| lookup | 1 | 1 | 0 | 1 | 0 | 0 | 0 |
| **total** | **86** | 37 | 39 | 23 | 21 | 23 | 19 |

(R/W: a `-` row, pass-through JSX, counts in neither; an `R/W` row
counts as W. "is the surface" rows count as yes. The table is
regenerated from the rows by a script over the Category, R/W and
First-class columns; if a count disagrees with the rows, the rows win.)

Reading the table:

- **Plumbing is the largest single category (23 of 86).** Escrow in
  state or a ref, pass-through to `GraphToolbar` (6 JSX sites: S16,
  S30, S32, S34, X3, L32) and `Minimap` (3 sites: S27, X8, L31), and
  the e2e registry (S3, S10, S23, S28, plus the hook itself). These
  rows exist only because the operations below need the handle; a
  handle that the library components took directly would not delete
  them but would make them renderer-neutral. The Ontology shell shows
  the cost: it resets `viewCore` on every tab switch (S29) and
  `GraphToolbar` double-guards with `destroyed()` (L2), because the
  handle can be stale and nothing says so.
- **Of the 63 operation rows (86 minus plumbing), the camera is the
  bulk: 20.** Then position reads (9), layout runs (6), lifecycle
  subscriptions (5), class mutation (5) and reads (5). Camera plus
  positions plus layout plus lifecycle is 40 of 63.
- **The handful of calls that account for most reaches:** `cy.fit` /
  `cy.animate({ fit | center | pan })` / `cy.zoom` / `cy.center` (every
  camera row), `node.position()` (every position row), `cy.layout(...).run()`
  (every layout row), `cy.on` / `cy.one` on `layoutstart`, `layoutstop`
  and `render` plus `cy.destroyed()` (every lifecycle row), and
  `ele.addClass` / `.select()` (every class row). Five call families
  cover 45 of the 63 operation rows.
- **The issue's lead example is the rarest reach.** Gesture
  registration appears exactly twice, both in one documentation
  snippet (D3, D4) with no executable twin and no shell use. Position
  reads and camera moves, not gestures, are what consumers reach for.
- **Where there is NO first-class equivalent today (23 rows: 19
  operations plus the 4 e2e registry rows):** gesture registration
  (D3, D4); layout and render lifecycle (S18, S20, L15) and liveness
  (L2, L9); the camera reads the Minimap needs, `extent()` and
  `boundingBox()` (L10, L14); zoom steps
  and floors (L5, L6, S24) and "center at zoom" (X5, D1, L3 are
  partial for the same reason); host class mutation (S1, S5) and class
  or computed-style reads (S8, S13); PNG export (L4);
  `relayoutAroundFixed` as anything but a handle call (D10); and the
  Minimap's position reads (L12, L13). The shell position reads (S12,
  S21) are partial only because every existing accessor
  (`capturePositions`, `captureWorkspace`, `harvestSceneFromCy`) takes
  the handle itself.
- **Where the first-class surface already exists and the reach is a
  duplicate path:** the additive recipe (D7, D8, D9, retired by #26),
  `context:pinNodes` over the handle versus the pin store (L25),
  `context:hideNodes` over the handle versus `hidden` (L26, with a real
  un-hide hazard), focus-node fits versus `focusNodes` (L27, X2), and
  the confidence dim versus a spec change (S25).

## 4. Tests that exercise the pattern

| # | Where | What it pins |
|---|---|---|
| T1 | `views/canvas/CytoscapeCanvas.test.tsx:107-118` | `onReady` called once with the instance |
| T2 | `CytoscapeCanvas.test.tsx:806-852` | `onReady` fires after the preset layout was passed to the constructor (#27 ordering) |
| T3 | `interaction/toolbar/GraphToolbar.test.tsx:27-41` | a mock handle `{ layout, zoom, fit, animate, png, nodes().lock/unlock, getElementById }` driving L1 to L7 |
| T4 | `interaction/camera/Minimap.test.tsx:12-17` | a mock handle `{ on, off, destroyed }`: the render-subscription lifecycle (L9, L15) |
| T5 | `src/demo/stylelab/StyleLabShell.test.tsx:80-107` | the captured `onReady` handlers run against REAL headless instances; `cy.destroy()` on teardown |
| T6 | `src/demo/stylelab/style-lab-parity.test.ts:62-79, 174` | `addClass`, `.select()`, `hasClass`, `ele.style(key)` parity (S1, S2, S8, S13 headlessly) |
| T7 | `src/demo/supply/ThreadShell.test.tsx:101-130` | `fakeHarvestableCore`: the minimal surface the Thread shell's consumers need: `destroyed`, `batch`, `on`/`off`/`removeListener`, `container`, `extent`, `elements().boundingBox`, `$id().style`, `width`, `height`, `zoom`, `pan`, `nodes().forEach(position)` |
| T8 | `src/demo/supply/confidence-presentation.test.tsx:38-83` | a real headless instance as the presentation oracle: `batch`, `data`/`removeData`, `edges(sel).first().style("line-color")`, `cy.style().update()` |
| T9 | `src/demo/testing/e2e-hooks.test.ts:29-44` | the `?e2e=1` registry publishes and clears handles |
| T10 | `tests/e2e/stylelab-acceptance.spec.ts:50-56` | `window.__g3t.canvases.get("style-lab-engine").$id("n1").style("text-opacity")` through the browser |
| T11 | `tests/e2e/confidence-color.spec.ts:19-50` | `canvases.get("supply").edges("[type = 'supplies']").first().style("line-color")` |

The other e2e specs that touch `window.__g3t` (`structural-projection`,
`drag-reroute`, `overlay-acceptance`, `shells`) read `scenes` only, never
`canvases`. T7 is worth a second look: it is an empirical capability
object, written by hand because a test needed to know exactly which
members the shell's handle consumers touch. Section 5 types that object
on purpose.

## 5. Proposed promoted surface (for ruling)

Each item is typed as it would ship, with the inventory rows it would
retire. Everything here is additive in 1.x; nothing changes `onReady`'s
signature until the 2.0 step in section 6.

### 5.1 Gestures: `onGesture` plus two named conveniences

```ts
export interface CanvasGestureEvent {
  kind: "tap" | "dbltap" | "taphold" | "cxttap" | "mouseover" | "mouseout" | "dragfree";
  target: { type: "node" | "edge" | "background"; id?: string };
  /** Model-space and rendered-space positions of the pointer. */
  position: { x: number; y: number };
  renderedPosition: { x: number; y: number };
  modifiers: { shift: boolean; ctrl: boolean; meta: boolean; alt: boolean };
}
/** General form. Bound once per instance inside the init path (so a
 *  re-init rebinds; the hazard at wiring-guide.md:337-339 goes away),
 *  read through a ref like onReady (an inline arrow never re-inits). */
onGesture?: (evt: CanvasGestureEvent) => void;
/** Conveniences over onGesture for the two cases the guide documents. */
onNodeDoubleClick?: (id: string, evt: CanvasGestureEvent) => void;
onBackgroundDoubleClick?: (evt: CanvasGestureEvent) => void;
```

Retires D3, D4 (and gives the "no `onNodeDoubleClick` prop" sentence
an answer). `tap`, `cxttap` and the drag family keep their internal
bindings (selection store, menu, group drag); the gesture event is an
additional observer, never a replacement, so it cannot race the
selection sync.

### 5.2 Positions: `onPositionsChange` and `initialPositions`

```ts
export type Position = { x: number; y: number };
/** Fired after layoutstop, after a node drop (dragfree), and after a
 *  programmatic apply; `reason` lets a host ignore its own writes. */
onPositionsChange?: (
  positions: ReadonlyMap<string, Position>,
  reason: "layoutstop" | "dragfree" | "applied",
) => void;
/** Applied on init with layout "preset" semantics: exactly what
 *  layout="preset" + layoutOptions.positions does today
 *  (ScaleSurface.tsx:291-296), named. Nodes absent from the map fall
 *  back to the `layout` prop for placement. */
initialPositions?: Readonly<Record<string, Position>>;
```

Retires S21 (the cache read; the write is already `initialPositions`
in all but name), S12 and S26 for the position part (sizes stay on the
harvest helper), and L22/X7/D5 once `captureWorkspace` accepts a
`positions` map in place of `cy`. D7 to D9 are already retired by #26.

### 5.3 Camera controller extensions, and a handle-free way to get one

```ts
export interface CameraController {
  // existing: focusNodes, panToNode, frameAll, resetView, panToPoint
  /** Multiply the zoom about the viewport center (toolbar +/-). */
  zoomBy(factor: number, opts?: CameraOptions): void;
  /** Set the zoom, optionally about a model-space point. */
  zoomTo(level: number, opts?: CameraOptions & { at?: Position }): void;
  /** Center one node and optionally raise the zoom to a floor. */
  focusNode(id: string, opts?: CameraOptions & { minZoom?: number; zoom?: number }): void;
  /** Fit the elements the `hidden` prop leaves visible. */
  fitVisible(opts?: CameraOptions): void;
  /** Read the viewport: zoom, pan, model-space extent, graph bounds. */
  viewport(): { zoom: number; pan: Position; extent: Box; bounds: Box };
  /** Subscribe to viewport changes (pan, zoom, render); returns unsubscribe. */
  onViewportChange(cb: () => void): () => void;
}
/** Delivered once per instance, like onReady, but renderer-neutral. */
onCamera?: (camera: CameraController) => void;
```

Retires L5, L6 (`zoomBy`), S24 (`zoomTo` with a floor, or
`focusNode({ minZoom })`), X5/D1/L3/L21 (`focusNode({ zoom })`), X2
(`fitVisible`), L10/L14 (`viewport()`), L15 (`onViewportChange`), and
turns S19, L7, L27, D6, X9 from "yes, but needs the handle" into yes.
`Minimap` then needs only `viewport()`, `onViewportChange` and the
positions map, which is the point of 5.4.

### 5.4 One handle: `CanvasHandle`

```ts
export interface CanvasHandle {
  /** False once the instance behind this handle was destroyed; every
   *  other member is a no-op after that (no more destroyed() guards). */
  readonly alive: boolean;
  readonly camera: CameraController;
  positions(): ReadonlyMap<string, Position>;
  setPositions(positions: ReadonlyMap<string, Position> | Record<string, Position>): void;
  /** In-place layout run (runGraphLayout today), resolving on layoutstop;
   *  `fixed` gives relayoutAroundFixed's behavior. */
  runLayout(id: string, opts?: LayoutPanelOptions & { fixed?: readonly string[]; randomize?: boolean }): Promise<void>;
  /** The scene as drawn: positions, rendered sizes, resolved visuals
   *  (harvestSceneFromCy today). */
  scene(): HarvestedScene;
  exportPng(opts?: { full?: boolean; scale?: number }): string;
  on(event: "layoutstart" | "layoutstop" | "viewport" | "destroy", cb: () => void): () => void;
  /** The renderer's own object. Governed by the renderer's peer range,
   *  not by g3t semver: see the stability policy in section 6. */
  readonly unsafe: { cytoscape: Core };
}
```

Delivered in 1.x through a React ref on `CytoscapeCanvas`
(`ref: Ref<CanvasHandle>`, React 19's ref-as-prop) and, for parity
with the current shape, `onHandle?: (handle: CanvasHandle) => void`.
`GraphToolbar` and `Minimap` gain `canvas?: CanvasHandle | null` (see
section 7 for why that name). Retires, beyond 5.1 to 5.3: L1/X6/D2/D10
(`runLayout`), L4 (`exportPng`), L2/L9/S29 (`alive` and the `destroy`
event: the toolbar's guard and the Ontology reset become unnecessary),
S18/S20 (`on("layoutstart"|"layoutstop")`), L12/L13 (`positions()`),
L23 (`setPositions`), L30 (`wireCytoscapeContextActions` takes the
handle; its three handle-touching actions map to the pin store, the
`hidden` prop and `camera.focusNodes`, which also closes the L26
un-hide hazard).

What stays on `unsafe.cytoscape` after 5.1 to 5.4, and why that is
acceptable: the Style Lab's class mutation, native `select()`, class and
computed-style reads and `applyVisualAttributes` (S1, S2, S5, S6, S8,
S9, S13, S14: 8 rows in one DEV-only shell whose subject IS the
Cytoscape projection); the `?e2e=1` registry (S3, S10, S23, S28: a test
channel that publishes whatever the renderer is); `harvestSceneFromCy`
and `applyVisualAttributes` as exported helpers (L28, L29: Cytoscape
projections by definition, so they take a `Core`, and would move to a
`@g3-toolkit/react/cytoscape` subpath in 2.0 so the root entry names
no renderer type); and S25, which should become a spec change rather
than a handle call. That is 11 of 63 operation rows (8 in the Style Lab, the 2
projection helpers, the confidence dim) plus the 4 e2e registry
plumbing rows; none of them is in a domain shell or an adopter-facing
snippet.

## 6. Three options for `onReady`, costed against the inventory

**(a) Keep `onReady(cy: Core)` as an explicitly unstable escape hatch
with a stability policy.** Cost: zero migration; all 86 rows stay as
they are. The 23 rows with no first-class equivalent get no path, and
the 20 camera rows plus every position read stay renderer-coupled in
two domain shells, the capability dashboard, both library components
and every adopter who copied a snippet. Renderer independence stays
blocked, and a cytoscape major bump within the peer range breaks every
row at once (the issue's stated risk). The policy itself is worth
writing under every option, because `unsafe.cytoscape` in (b) carries
the same exposure. Proposed text:

> `onReady` (and `CanvasHandle.unsafe.cytoscape`) hands you the peer
> `cytoscape` instance. Its API is cytoscape's and is governed by the
> peer range in `@g3-toolkit/react/package.json`, not by g3t semver.
> g3t guarantees only: (1) it fires once per instance, synchronously
> after construction and after the initial layout started (#27); a
> preset layout has finished by then; (2) a re-init destroys the
> instance and fires again with the new one; a stored handle is stale
> in between and `destroyed()` is the only test; (3) the toolkit never
> calls `cy.select()`; selection is the `g3t-selected` class; (4) the
> toolkit owns these classes and data fields and reapplies them on
> every re-init, so a host must not write them: `g3t-selected`,
> `g3t-hidden`, `g3t-pinned`, `g3t-ov-*`, `g3t-label-hidden`,
> `g3t-structural-*`, and the data fields `label`, `_color`, `_icon`,
> `_size`, `_shape`, `_ecolor`, `_ewidth`, `_labelShort`,
> `_labelPriority`; (5) anything else you do through the handle is
> yours to keep working across cytoscape versions.

**(b) Narrow to a capability object.** The `CanvasHandle` of 5.4, with
5.1 to 5.3 as its substance. Cost: a 1.x additive round (new props, two
new component props, the controller extensions, snippets and twins
for each, `api-surface.json` update) and, at 2.0, the signature flip
(`onReady` delivers the handle, `cy`/`core` aliases removed). Against
the inventory: 52 of 63 operation rows move to the handle; the 11 that
remain are Cytoscape-specific by purpose (section 5.4) and sit behind
a member spelled `unsafe`. The 23 plumbing rows stay but become
renderer-neutral. T7 shows the shape is right: a shell test already
had to invent this object.

**(c) Deprecate `onReady` in 2.0 once the promoted surface covers the
inventory.** Cost: identical to (b) up to 2.0, plus the 11 residual
rows (and the e2e registry) need a home that is not a prop: a `@g3-toolkit/react/cytoscape`
subpath exporting `getCore(handle)`, `applyVisualAttributes` and
`harvestSceneFromCy`. The gain over (b) is that the root entry type
surface names no renderer at all; the loss is that the escape hatch
stops being discoverable where the host already is, so hosts with one
odd reach (a zoom floor, a png export at a scale the handle does not
offer) import a second subpath to get it.

**Recommendation: (b), staged as (a) now, (b) through 1.x, and (b)'s
signature flip at 2.0 with the (c) subpath for the two projection
helpers.** Reasons, in order: the inventory says consumers reach for
the camera, positions, layout runs and lifecycle (40 of 63 operation
rows), which are renderer-neutral concepts with a small, typeable
surface, so promoting them is cheap and covers most of the exposure;
the residual is concentrated in one DEV-only shell and the test
registry, so a fully deprecated hatch (c) buys renderer purity for
rows that are about the renderer by design; and the stability policy
of (a) costs nothing, applies to the residual under every option, and
tells adopters what their exposure is today, which is the acceptance
item for "if it stays". The one thing not to do is (a) alone: it
freezes the 20 camera rows and 12 position rows against a peer range
g3t does not control.

Ordering of the 1.x work, priority only: camera controller extensions
plus `onCamera` (P1; retires the most rows and unblocks a handle-free
`Minimap`); `onPositionsChange` plus `initialPositions` (P1; the
Scale cache and the workspace document are the consumers); `onGesture`
plus the two conveniences with an executable twin for the dbltap
recipe (P1; closes the inventory's only undocumented-twin finding);
`CanvasHandle` via ref, `canvas` on `GraphToolbar` and `Minimap`, and
`wireCytoscapeContextActions` over the handle (P2; the plumbing and the
L26 hazard); the stability policy text into the wiring guide caveat
(P1, docs only, can land first).

## 7. What this means for #18 (`cy` vs `core`)

The two rulings should be made together because the prop name follows
the prop TYPE, and only one rename should ever land.

- Today the inventory counts 6 `cy=` sites on `GraphToolbar` (S16,
  S30, S32, S34, X3, L32) and 3 `core=` sites on `Minimap` (S27, X8,
  L31). Four shells name their state `core` (Scale, Thread, Analytics,
  Ontology's `viewCore`); the Style Lab, both stories and every
  wiring-guide snippet name it `cy`. Neither name is dominant; both
  mean "a Cytoscape `Core`".
- Under the recommendation (b), both components take the
  `CanvasHandle`, which is not a Cytoscape `Core`, so neither existing
  name is right for it. Propose `canvas` on both (`canvas?:
  CanvasHandle | null`), added in 1.x beside the existing props, with
  `cy` (GraphToolbar) and `core` (Minimap) kept as deprecated aliases
  that wrap a raw `Core` into a handle, and removed at 2.0. That is
  #18's "accept both for one major" with one name instead of a pick
  between two wrong ones, and the migration is the same edit a host
  makes for #19.
- If the maintainer rules (a) instead (the handle stays a raw `Core`),
  then #18 should pick `cy`, because every adopter-facing snippet
  already reads `cy`, the Cytoscape convention is `cy`, and the only
  component on the `core` side is `Minimap` (3 sites to the toolbar's
  6). Renaming to `core` now and to `canvas` at 2.0 would be two
  migrations for the same prop; avoid that sequence under every ruling.
- `SearchBar`'s required `onSearchChange` is independent of the
  handle and can become optional (defaulting to the selection store)
  in 1.x under any ruling.

## 8. Exit criteria

This record closes when the maintainer records, in
`specs/09-design-decisions.md`, (1) which of (a), (b), (c) `onReady`
follows and the stability-policy text (verbatim or edited) if the raw
handle remains reachable, (2) which of 5.1 to 5.4 enter the roadmap and
in what order, and (3) the #18 name. The engineering then lands under
the three-channel contract: each promoted prop with a wiring-guide
snippet and an executable twin, `api-surface.json` updated after
`build:packages`, and the inventory rows above re-checked against the
new surface so the residual list in 5.4 is measured, not asserted.
