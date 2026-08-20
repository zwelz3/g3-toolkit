# AGENTS.md

Instructions for coding agents (OpenAI Codex, Claude Code, Cursor, and
compatible tools) working in this repository or writing code that
CONSUMES the g3-toolkit packages. Claude Code users: CLAUDE.md is the
maintainer-focused handoff for this repo and takes precedence for
in-repo maintenance work; this file is the tool-agnostic guide and the
authority for adopter-facing usage. The two are kept consistent; if
they ever disagree on a repo convention, CLAUDE.md wins.

A compact machine-readable orientation also exists at ./llms.txt.

## What this project is

A composable graph-visualization component LIBRARY (not a framework):

- `@g3t/core`: data model (UGM, a labeled property graph), backend
  adapters (SPARQL/Cypher/Gremlin/REST/Holonic), RDF-to-LPG projection
  pipeline, SHACL validation/reporting, structural (UML-style) layout,
  path analysis, export, theming. Zero React imports (enforced by a
  module-boundary test).
- `@g3t/react`: view components (graph canvas, structural SVG, table,
  tree, matrix, map, timeline, sankey, schema, stats, provenance),
  interaction controls, and the shared zustand stores.
- `@g3t/charts`: `LinkedChart` (bar/scatter/line/pie via ECharts),
  linked to the shared selection store.

Hosts integrate through three channels ONLY: exported zustand stores,
props/callbacks, and versioned JSON documents (encoding spec, workspace
snapshots, algorithm results, SHACL reports). New capability means
exposing through one of these three, never a fourth mechanism.

## Setup and commands (repo work)

- Package manager: pnpm, ENFORCED. Never npm or yarn.
- `pnpm install` then `pnpm run dev` (opens the scenario gallery: the
  Auditor, MBSE, Supply Chain and Biomedical domain shells plus the
  Analytics, Style Lab, Routing Lab, RDF 1.2 Hyperarcs, Legibility Lab
  and Ontology Workbench capability surfaces; Legibility Lab demos
  pseudo-node spreading and a holon boundary ring with a single exposed
  boundary node). ELEVEN scenarios are registered in
  src/demo/DemoLanding.tsx, which is the authority; Scale is
  deployment-only and Style Lab is dev-only, so `pnpm run dev` and the
  deployed page each show ten, and not the same ten.
- `pnpm run storybook` for components in isolation.
- `pnpm run docs:api` generates typedoc into docs-out/api.

### Verification gates (run before claiming any change done)

```bash
pnpm run gates
# = typecheck && lint && verify && test && gates:spec (python spec
#   lint, spec-status sync, roadmap coverage), the exact CI order.
# verify builds the packages and runs dist/export/snippet/bundle checks;
# a change is NOT done on unit tests alone.
```

Rules that have each been paid for at least once:

- NEVER pipe gate scripts through `tail`/`head`; it masks exit codes.
  Check `$?` directly.
- Bundle growth requires a written rationale in
  `scripts/check-bundle-size.mjs` (the ledger).
- Every programmatic string replacement gets an assertion that the
  anchor exists, including boring import edits.
- View a file immediately before editing it; re-view after edits.
- When a hand-maintained count disagrees with a gate script, the
  script is right.

## Architecture rules (do not violate)

- `@g3t/core` stays React-free. Heavy graph algorithms stay EXTERNAL
  (networkx/GraphBLAS); the toolkit consumes result documents.
- SAME INPUT GRAPH means the camera and node positions HOLD. Never
  re-init the canvas, refit, or recenter on a same-graph change (theme,
  spec, decorations, selection, hover). Re-init only on a genuinely
  different node-id set or an explicit user operation.
- Data-mapped style properties (`width: data(_size)`,
  `opacity: data(_confidence)`) MUST sit on a field-scoped selector
  (`node[_size]`, `edge[_confidence]`), never a bare `node`/`edge`
  rule; unscoped rules flood the console per frame and stall the
  canvas. Negative `outline-offset` is rejected by Cytoscape.
- Reserved encoding channels reject by owner name; keep it that way.

## Writing code that USES the library (adopter tasks)

This is where generated code most often goes wrong. Follow these
exactly; each rule is documented in docs/consuming-g3t.md and
docs/wiring-guide.md, and every wiring snippet runs in CI.

1. Install: `pnpm add @g3t/core @g3t/react` (charts optional). Peer
   dependencies are NOT installed for you. `@g3t/react` needs react,
   react-dom, cytoscape, cytoscape-fcose, zustand, echarts. Optional:
   vis-timeline and vis-data, needed only for `@g3t/react/timeline`.
   `@g3t/charts` takes @g3t/core and @g3t/react as peers too.
2. Import the stylesheet first: `import "@g3t/react/style.css";`.
   Without it everything renders unstyled, silently.
3. Memoize `ugm`. It is compared by identity; a fresh instance per
   render re-creates the Cytoscape instance and re-runs layout. The
   other object props (layout, layoutOptions, interactionOptions,
   encodingSpec, hidden, structuralDecorations) are content-keyed, so
   inline literals are safe.
4. Only content changes to `ugm` identity, `containment`, `layout`,
   `layoutOptions`, `interactionOptions`, `edgeStyle`, `animate`
   re-initialize the canvas. `stylesheet` and `encodingSpec` are style
   refreshes that preserve positions.
5. Filter by hiding: compute the hidden node-id set and pass it as the
   `hidden` prop. NEVER pass a pre-filtered UGM; that re-runs layout on
   every toggle.
6. Scene switches (different diagram/subject) use a keyed remount:
   `<CytoscapeCanvas key={sceneId} ugm={ugm} />`.
7. Drive behavior through the stores. From React:
   `useSelectionStore((s) => ...)`. From anywhere (event handlers,
   services, non-React code): `useSelectionStore.getState()` /
   `.subscribe(...)`. Stores: selection, position pins, overlays,
   theme, style overrides. A "custom button" is almost always one
   store call in an onClick.
8. Get the Cytoscape `Core` from `onReady`; use it with
   `createCameraController`, `runGraphLayout`, and `<Minimap core={core} />`.
9. Structural (UML/SysML) scenes render with `StructuralSvgView` fed
   by `useStructuralLayout` (or `layoutStructural` directly). The
   `structural` prop on `CytoscapeCanvas` is DEPRECATED (owner ruling
   2026-07-28; a dev-only warning fires) and will be removed once
   remaining consumers migrate. The guaranteed patterns are in
   docs/structural-patterns.md. Compartment expand/collapse was
   REMOVED (2026-07-10 ruling): `useCompartmentCollapseStore`,
   `registerCompartmentCollapseActions`, `compartmentKey`, and
   `collapsedCompartments` no longer exist, even where older
   wiring-guide sections still show them.
10. RDF input goes through the projection pipeline:
    `createPresetPipeline("standard").project(rdfGraph)`. The SPARQL
    adapter handles SELECT bindings only; there is no reasoning, no
    quads, no arbitrary-RDF SHACL shapes parser (the validator takes
    the internal shape form; `parseShaclReport` ingests external
    pyshacl/Jena reports).
11. External algorithm results enter as versioned documents:
    `parseAlgorithmResult` then `applyAlgorithmResult`; register the
    returned overlay on `useOverlayStore`.
12. Graphs past ~5k nodes: `collapseByCluster` to supernodes, drill in
    with `buildSubgraph`. There is no canvas-level virtualization.
13. Guaranteed per-node styling: the `_color` / `_shape` data channels
    survive the spec-apply pipeline. Encoding-managed keys are cleared
    when a spec drops the owning channel.
14. Vendored tarballs: `pnpm pack` rewrites `workspace:*`; pin
    `@g3t/core` to one instance via overrides or the theme store
    silently splits between two copies.
15. Node labels word-wrap by default (110px). The single override knob
    is `labelWrapRule(maxWidthPx | false)` appended through the
    `stylesheet` prop (a style refresh, so positions and the camera
    hold): a number re-widths, `false` disables. Do not hand-roll a
    bare `node { text-wrap }` rule; the helper is `node[label]` scoped
    to avoid per-frame mapping warnings.
16. Dense edge fields: `bundleEdges` + `bundledPolylineToSegments`
    (@g3t/core) apply force-directed edge bundling (FDEB) as pure
    geometry onto the `curve-style: segments` path; deterministic (no
    RNG), with a straight-line bypass past a `maxEdges` cap. For
    obstacle-aware per-edge routing on ordinary (non-structural)
    scenes, pass the `routeEdges` prop to `CytoscapeCanvas`: it runs a
    post-layout A* pass at layoutstop and holds the camera/positions.
    `routeEdges` is `boolean | { maxEdges?, clearance?, bendPenalty?,
    minStub?, mode? }`. `mode` is the important knob and STRAIGHT IS THE
    DEFAULT: `"direct"` (default) leaves every edge as a bezier and only
    orthogonally detours the edges whose straight center-to-center line
    ACTUALLY passes through a node body (an exact segment-vs-rectangle
    test, not the segment's bounding box). `"orthogonal"` routes every
    edge axis-aligned regardless of obstacles. Do not reach for
    `"orthogonal"` to "clean up" a sparse scene: on sparse graphs the
    default already keeps clear shots straight and Z-routes only real
    crossings, which is what reads well. The routing pass fires ~0.4s
    AFTER the layout animation settles (it is a post-settle pass), so a
    brief straight-bezier flash before edges snap to their routes is
    expected, not a bug; disable layout `animate` on that canvas if the
    flash is unwanted.
17. Raster export: `buildImageExport` (@g3t/react toolbar) wraps native
    `cy.png` for a PNG snapshot of the live canvas; the GraphToolbar
    export menu surfaces it alongside JSON/CSV/Turtle subgraph export.
18. Live routing controls are counter-bump signals on `CytoscapeCanvas`,
    not imperative calls: bump `routeRefreshSignal` (a number) to re-run
    the routing pass over the CURRENT node positions WITHOUT moving any
    node (the "Refresh routes" op); bump `relayoutSignal` to run the
    crossing-aware placement optimizer, apply the new positions, then
    re-route (an explicit user op, so the camera-hold rule does NOT
    apply here, same class as fit/reheat). Both are per-instance: each
    canvas responds only to its own prop bump, so there is no global
    command store to fight in a multi-canvas page. Set
    `edgeClickIsolate` to make an edge tap isolate that edge via the
    emphasis layer instead of selecting it. A ready-made Routes-mode +
    Refresh + Re-layout + Isolate toolbar wiring these props lives in
    `src/demo/components/routing-controls.tsx` (`useRoutingControls` /
    `RoutingControlStrip`); copy the pattern, but note it is DEMO code,
    not a `@g3t/react` export, so do not import it from the package.

When unsure of a signature, read the shipped declaration files
(`packages/*/dist/*.d.ts` after `pnpm run verify`, or the typedoc at
docs-out/api). Do not invent props or exports; the export maps in each
package.json are the complete public surface.

## Cytoscape internals (when you need the raw Core)

`CytoscapeCanvas` hands you a `cytoscape.Core` via `onReady`. Most
adopter code should never need it directly, but when it does, these
rules apply. Each one was paid for by a visible bug in this codebase.

**Style selectors — scoping is mandatory.**
Any stylesheet rule that reads a data field via `data()` MUST live on a
field-scoped selector (`node[_size]`, `edge[_confidence]`), never on a
bare `node` or `edge` selector. Cytoscape emits one console warning per
element per render frame for every element that lacks the mapped field.
On a 100-node graph with layout animation running that's thousands of
warnings per second — confirmed to stall the canvas (~1.7s per toggle).
Use `node[label]` for the label rule, `edge[_confidence]` for opacity,
etc. The DEFAULT_STYLESHEET in `CytoscapeCanvas.tsx` shows every correct
scoping.

**Stylesheet order: later rules win (within same specificity).** The
toolkit's merge order is `DEFAULT → THEME → ENCODING → INSTANCE
OVERRIDES → OVERLAYS`. Add custom rules at the end of the `stylesheet`
prop array if you need them to win over theme colors.

**`style().fromJson()` for restyle — never re-init for style changes.**
When theme or spec changes arrive, apply them via
`cy.style().fromJson(newStylesheet).update()`. This is a restyle-only
op: positions hold, camera holds. Never re-create the `cy` instance or
call the `cy(element, config)` constructor again just to change styles.

**`cy.batch()` for bulk writes.** Group data stamps and class changes:
```ts
cy.batch(() => {
  edge.data({ _segDist: ..., _segWeight: ... });
  edge.addClass("g3t-canvas-edge-routed");
});
```
`cy.batch()` defers redraws until the callback exits — one restyle, not
one per element. Every routing write in this codebase uses this.

**`curve-style: segments` contract.**
`segment-distances` and `segment-weights` are the two required arrays.
Weights are per-bend positions along the edge (0–1, normalized), distances
are signed perpendicular offsets from the baseline chord.

Critical: `edge-distances` defaults to `intersection` (the chord runs
border-to-border). When your router places terminals at box CENTERS (as
`routeSceneEdges` does), you must set `"edge-distances": "node-position"`
or every bend lands offset from the routed geometry by the node
half-extent. This was the bug that caused bends to land at (284.6, 23.1)
instead of (100, 300) after the v1.0.6 fix of the sign error.

The sign of a `segment-distances` entry: Cytoscape reconstructs a bend
as `midpt(w) + vectorNormInverse * d` where `vectorNormInverse = (−dy/l,
dx/l)` (the leftward perpendicular of the edge direction). To get a bend
at `(bx, by)` given midpoint `(mx, my)` and direction `(dx, dy)` with
length `l`, compute `d = (py*dx − px*dy)/len` where `(px,py) = (bx−mx,
by−my)`. The opposite sign mirrors the detour across the chord — that
was the v1.0.6 regression (the wrong sign shipped in `polylineToCytoscapeSegments`
while `routeToSegments` in the structural path had it correct).

**`boundingBox({ includeLabels: false, includeOverlays: false })`.**
Always pass `includeLabels: false` when reading a node's bounding box
for routing or geometry calculations. Node labels hang below the body;
including them shifts the "center" off the actual body center and shears
every routed bend point. `includeOverlays: false` keeps the measure
stable across selection state.

**Compound nodes (`isParent()`).**
Compound parents have no drawn body of their own; their children's boxes
cover the interior. Exclude compound parents from obstacle sets:
`if (n.isParent()) return;` — otherwise edges route around empty geometry.

**Reliable multi-background stacking.**
When you need two background images on the same node (e.g., a custom icon
at 60% + a pin badge at 16px), use per-element style BYPASSES with array
values, not data() mappings:
```ts
n.style({
  "background-image": [iconUri, badgeUri],
  "background-position-x": ["50%", "100%"],
  "background-width": ["60%", "16px"],
  ...
});
```
Data() mappings with array values are unreliable for multi-background
composition in Cytoscape 3.x — they never rendered correctly in this
codebase (two separate browser failures).

**Negative `outline-offset` is rejected.**
Cytoscape parses and silently discards `outline-offset` values less than
zero, then emits one warning. An inset selection ring needs a positive
`outline-offset` (gap between node border and ring) — the ring is drawn
outside the node border, not inside it.

**`layoutstop` event fires after animation.**
Wire post-layout work (routing, camera capture) to `layoutstop`, not
`layoutready`. `layoutready` fires before animation plays; `layoutstop`
fires after the animation ends and all node positions are final.
Routing on `layoutstop` is why there is a brief straight-bezier flash
before edges snap to routes — this is by design.

**`:visible` selector.**
Use `cy.edges(":visible")` / `cy.nodes(":visible")` to restrict to
non-hidden elements. The toolkit toggles element visibility via the
`display: none` Cytoscape property (set with the `hidden` prop); `:visible`
matches everything except `display: none` elements.

**`cy.png({ output: 'blob' })`** returns a `Blob` directly. The default
(no `output` option) returns a data-URI string. Use `blob` when you want
to `URL.createObjectURL` + download without the URI overhead.

**`fcose` must be registered at module level.**
`cytoscape.use(fcose)` must run before any canvas instance is created.
The layout name in the options object is `"fcose"`. The toolkit registers
it in `CytoscapeCanvas.tsx` at the top of the file; adopters who
instantiate Cytoscape directly must do the same.

**Parallel edges, self-loops, and bidirectional pairs.**
All three need `curve-style: bezier` to read correctly. Detect them in
the element builder and stamp `_curveStyle = "bezier"` as node data;
then a field-scoped rule `edge[_curveStyle = "bezier"] { curve-style:
bezier }` handles them without touching every other edge.

**`:active` overlay.**
Cytoscape's default click-hold overlay is a large gray blob (radius ~10,
opacity 0.25). Slim it in the stylesheet:
```ts
{ selector: ":active", style: { "overlay-opacity": 0.08, "overlay-padding": 4 } }
```

## Authoring conventions (this repo)

- Analytical tone, no sycophancy, no em-dashes in authored content, no
  day estimates.
- Spec citation policy: R-IDs cited in packages/ or scripts/ source
  strings count as implementation citations; cite only what is truly
  implemented.
- Visual changes cannot be verified headlessly; they ship through the
  Pages playground for live review. Say so rather than claiming a
  rendered result is confirmed.
