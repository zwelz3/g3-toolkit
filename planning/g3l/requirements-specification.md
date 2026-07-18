# Requirements Specification: FOSS Graph Layout and Visualization Library ("G3L")

Version 0.2. Supersedes v0.1. Changes: current-state claims re-verified against the uploaded g3-toolkit source (audited 2026-07-09); license decided (Apache-2.0, matching g3t as-built); implementation sequencing removed to the companion document `g3l-implementation-plan.md`; open decisions 1 and 4 closed.

Grounding: the two prior investigations (layout/routing vendor research; styling/rendering vendor research) and the audited g3-toolkit v1.0.0-rc.2 (`@g3t/core`, `@g3t/react`, `@g3t/charts`; Cytoscape 3.33.4; ELK via `packages/core/src/layout/structural.ts`; 1,044 tests across 107 files; `pnpm run gates` = typecheck + lint + verify + test + gates:spec).

---

## 1. Purpose and scope

**Purpose.** Define the complete requirement set for a permissively licensed, framework-agnostic graph layout and visualization library whose node model natively covers **shapes, icons, and containers**, with optimized layouts (hierarchical, force/stress, orthogonal-aware) and quality edge routing (orthogonal, bundled), suitable for MBSE/digital-thread, RDF/SHACL, and general network-analysis surfaces.

**Scope.** Five layers: (1) graph model, (2) layout core, (3) routing core, (4) style resolution, (5) renderer adapters, plus framework bindings (d3, Cytoscape.js, React). Out of scope: graph analytics beyond layout needs, persistence, collaboration, server components.

**Relationship to g3-toolkit.** g3t is the first consumer and the seed codebase. g3t already maintains its own spec corpus (`specs/00`–`10`, requirement IDs `R{n.m}`, principles P1–P6, decision register including D15, rollup 46 implemented / 12 in-progress / 18 proposed) and a spec citation gate (`gates:spec`). This document does not replace that corpus; it specifies the library layer beneath it. Alignment notes: G3L honors g3t principle P5 (defer limiting decisions; hence the engine seam in ARC-005) and stays paradigm-neutral per P4/P6 (RDF and Holonic support live in optional projection packages, IOP-006/IOP-008). Section 21 maps each requirement group to the audited g3t state.

**ID and citation conventions.** G3L requirements use `G3L:` prefixed group IDs (ARC, MOD, LAY, RTE, NOD, CNT, STY, LBL, RND, INT, IOP, PRF, QLT, ACC, LIC, DOC), disjoint from g3t's `R{n.m}` scheme. When a G3L ID is cited in g3t source or tests, it participates in the existing `gates:spec` citation gate under the same sync rules as R-IDs (planning documents exempt). Each requirement carries priority (P0 core viability, P1 differentiator, P2 advanced), a singular shall-statement, rationale, and verification method: **I** inspection, **A** analysis, **D** demonstration (visual-acceptance/live review; rendered-behavior claims remain unverified until live-confirmed), **T** automated test. No day-based estimates by policy.

---

## 2. Definitions

- **Element**: node, edge, port, label, or container.
- **Container**: a node owning child nodes (compound/group/combo), with optional collapse state, header zone, and partition semantics (swimlane).
- **Compartment**: an ordered interior region of a node with independent row content (UML-class style) whose children do not participate in global layout.
- **Port**: a named attachment point on a node border with a position constraint (fixed side, fixed offset, or free); includes synthetic boundary ports minted by the library to distribute body-attached edges.
- **Outline**: the element's boundary geometry used for edge cropping, arrow placement, and hit testing (polygon, rounded rect, ellipse, or path; never raster-derived).
- **VisualAttributes**: the flat, renderer-neutral per-element style output of style resolution.
- **LOD schedule**: declarative mapping from zoom level and visible-element count to per-element-class visibility/simplification tiers.
- **Sketch**: an existing set of element positions supplied to a layout run to be preserved (mental-map input).
- **Route**: the geometric path of an edge (ordered absolute bend points plus attachment metadata, or curve spec), owned by the routing core, never synthesized by a renderer.

---

## 3. Architecture requirements (ARC)

**ARC-001 (P0, T).** The layout core shall be a pure function from a layout graph (topology, sizes, ports, constraints, optional sketch) to geometry (positions, container bounds, routes), with no dependency on any DOM, canvas, or rendering API.
*Rationale:* the yFiles/MSAGL data-in/data-out pattern; enables multi-framework support and headless testing. g3t's `layoutStructural` already follows this shape.
*Verification:* core package imports audited for zero DOM/renderer references; golden-geometry tests run in Node.

**ARC-002 (P0, T).** The style resolution layer shall be a pure function `resolve(graphData, theme, rules, states, zoomContext) -> VisualAttributes` with no rendering side effects.

**ARC-003 (P0, I).** Layout algorithms and edge routers shall implement a common composable stage interface such that any router can post-process any layout's output.
*Rationale:* the yFiles `LayoutStage` pattern; routing improvements then apply to every layout.

**ARC-004 (P0, T).** All layout and routing computation shall be executable inside a Web Worker, communicating via structured-cloneable data only.
*Rationale:* g3t's ElkEngine seam already runs ELK off-thread; main-thread stalls were the root cause of a documented defect class.

**ARC-005 (P0, T).** The library shall expose a `LayoutEngine` interface with at least two implementations: the internal core and an ELK adapter, selectable per surface without consumer code changes.
*Rationale:* preserves g3t's ruled decision (ELK now, replaceable later; principle P5) and makes the internal core falsifiable against ELK on identical graphs. g3t's `ElkEngine` interface is the seed.

**ARC-006 (P0, T).** Geometry produced by layout/routing shall be deterministic for identical inputs; randomized algorithms shall accept an explicit seed.
*Rationale:* deterministic oracles are established toolkit doctrine; required for golden tests and diffable visual acceptance.

**ARC-007 (P0, I).** The public API shall be TypeScript-first with complete type definitions and no `any` in exported signatures, gated by an API report (QLT-008) consistent with g3t's `verify:exports`/`verify:types` gates.

**ARC-008 (P1, T).** The renderer adapter contract shall be defined such that SVG, Canvas 2D, and WebGL adapters consume identical `VisualAttributes` + geometry, with a conformance suite run against every adapter.

**ARC-009 (P1, A).** Package boundaries shall separate `model`, `layout`, `route`, `style`, `render-svg`, `render-canvas`, `render-webgl` (P2), `adapter-cytoscape`, `adapter-d3`, `bindings-react`, such that layout+route is consumable with no rendering package.
*Rationale:* mirrors `@g3t/core`'s React-free discipline; headless geometry (server-side export) is a legitimate standalone use.

**ARC-010 (P2, A).** Computation-heavy kernels (routing visibility graph, stress majorization inner loop) shall permit a future WASM/Rust implementation behind the same engine interface without API change.

---

## 4. Graph model requirements (MOD)

**MOD-001 (P0, T).** The model shall represent directed and undirected edges, parallel edges, and self-loops.

**MOD-002 (P0, T).** The model shall represent nodes with explicit size, an outline kind (rect, rounded-rect, ellipse, polygon, path), and a resolved outline geometry accessor.
*Rationale:* outline is the contract for edge cropping (NOD-006) and precise arrows; model-owned, not renderer-owned.

**MOD-003 (P0, T).** The model shall represent containers as nodes with a `children` relation of arbitrary nesting depth, a collapse state, and computed bounds derived from children plus padding and header insets.

**MOD-004 (P0, T).** The model shall represent ports as first-class child elements of nodes with side constraints (N/S/E/W/free), order constraints within a side, and fixed-offset positions, and shall distinguish declared ports from library-minted synthetic boundary ports.
*Rationale:* g3t's `StructuralPort` (flow-axis side defaults) and its landed synthetic-boundary-port mechanism are the direct precedent; the declared/synthetic distinction carries behavioral weight (RTE-008 exit semantics).

**MOD-005 (P0, T).** The model shall separate domain data (`data`) from visual attributes (`style`) from geometry (`geometry`) per element, with no field aliasing among the three.

**MOD-006 (P0, T).** The model shall support edge endpoints specified as node, port, or (node, side) triples, and shall record which form was used.
*Rationale:* the body-attached-versus-port-attached distinction drove a real g3t defect class; g3t now resolves body attachment through synthetic ports, which this requirement generalizes.

**MOD-007 (P0, T).** Every element shall carry a stable, caller-supplied ID; the library shall reject duplicate IDs with a diagnostic and never mint IDs that collide with caller IDs.

**MOD-008 (P1, T).** The model shall support labels as owned sub-elements of nodes, edges, ports, and containers, each with a placement model (interior slots for nodes; along-path parameters for edges; header slot for containers).

**MOD-009 (P1, T).** The model shall support hyperedges at minimum as bus-routing input, represented distinctly from parallel binary edges.

**MOD-010 (P1, T).** The model shall provide a change-set API (add/remove/update batches) emitting a structural diff consumable by incremental layout (LAY-020) and incremental routing (RTE-011).

**MOD-011 (P0, T).** The model shall support node compartments: ordered interior regions with titled, collapsible row content, whose children do not participate in global layout.
*Rationale:* raised from P2 to P0 in v0.2: g3t's `StructuralCompartment` (rows, titles, `collapsible`) is already shipped and validates the strict non-layout form (open decision 4, now closed). The library model must not regress a shipped g3t capability.

---

## 5. Layout requirements (LAY)

### Hierarchical (layered)

**LAY-001 (P0, T).** The library shall provide a Sugiyama-family layered layout with independently replaceable phases: cycle removal, layering, crossing minimization, coordinate assignment.

**LAY-002 (P0, T).** Layering shall support network-simplex and Coffman-Graham strategies, selectable per run.

**LAY-003 (P0, T).** Crossing minimization shall implement barycenter/median sweeps with transpose refinement and shall respect in-layer order constraints, exposing a strategy option compatible with g3t's existing `crossingMinimization: "LAYER_SWEEP" | "INTERACTIVE"` seam.

**LAY-004 (P0, T).** Coordinate assignment shall implement Brandes-Köpf with node-size and port-position awareness.

**LAY-005 (P0, T).** The layered layout shall handle dummy vertices in linear space per the Eiglsperger-Siebenhaller-Kaufmann refinement.

**LAY-006 (P0, A).** The layered layout shall not implement the channel-based hierarchical framework of US 12,051,137 (vertical path partition, no dummy vertices, one-bend cross-edges); classic Sugiyama variants only. Recorded in the IP register (LIC-003). Not legal advice.

**LAY-007 (P1, T).** The layered layout shall support port constraints (fixed side, fixed order, fixed position) and layer constraints (first/last/same-layer groups).

### Force / stress

**LAY-008 (P0, T).** The library shall provide stress majorization as the primary quality force layout, with Barnes-Hut approximation for repulsive terms above a configurable node-count threshold.

**LAY-009 (P0, T).** The library shall provide a fast annealing force mode (d3-force-class) for interactive exploration, sharing the stress input model.

**LAY-010 (P1, T).** Force layouts shall accept separation constraints (minimum gaps, alignment, containment) via gradient projection (IPSep-CoLa lineage).

**LAY-011 (P1, T).** The library shall provide post-layout node overlap removal (VPSC/scanline family) as a composable stage usable after any layout.

### Compound / container layout

**LAY-012 (P0, T).** Every layout shall lay out arbitrarily nested containers such that children remain inside parent bounds (with padding and header insets) and container bounds are computed bottom-up.

**LAY-013 (P0, T).** The layered layout shall route and place inter-container edges without overlapping container borders except at crossing points.

**LAY-014 (P1, T).** The library shall provide a compound-aware force layout in the CoSE/fCoSE lineage (spectral or sketch draft, constrained force refinement, per-container relative layout), replacing g3t's wired fcose only after meeting the QLT-002 metrics gate on shared demos.

**LAY-015 (P1, T).** Containers shall support partition semantics (swimlanes): fixed parallel bands with ordered membership, honored by the layered layout as layer-orthogonal position constraints.

**LAY-016 (P2, T).** Collapsed containers shall participate in layout as atomic nodes sized from the collapsed representation, with edges to hidden children re-terminated on the container boundary (edge lifting) and annotated with lifted cardinality for styling.

### Stability / incremental

**LAY-017 (P0, T).** Every layout shall accept a sketch (prior positions) and a stability weight, and in sketch mode shall minimize displacement of unchanged elements subject to validity.
*Rationale:* mental-map preservation is the commercial moat finding. g3t precedent: `capturePositions`/`applyIncrementalLayout` in `incremental-layout.ts` capture and re-apply positions; this requirement moves preservation into the layout objective itself.

**LAY-018 (P0, D).** On a collapse/expand of one container, elements outside the affected subtree shall move less than one grid unit (configurable epsilon).
*Rationale:* g3t's ruled accept criterion for the ELK interactive-mode direction (recorded as item 12.20; direction recorded, not shipped, as of the 2026-07-09 audit: camera holds per D15 but ELK recomputes positions). This requirement is the graduation of that experiment.

**LAY-019 (P1, T).** The layered layout shall support incremental insertion: new elements placed into an existing drawing with fixed layering/ordering for prior elements (sketch-driven, Brandes-Eiglsperger-Kaufmann-Wagner lineage).

**LAY-020 (P1, T).** Layout shall consume the model change-set (MOD-010) and re-lay out only the affected region when the change is local, falling back to global sketch mode otherwise, and shall report which mode ran.

**LAY-021 (P2, T).** Layout runs shall be cancellable and shall support progressive delivery (coarse result, then refined) above a configurable size.

---

## 6. Edge routing requirements (RTE)

**RTE-001 (P0, T).** The library shall provide an obstacle-aware orthogonal router implemented from the published visibility-graph approach (orthogonal visibility graph, A* minimizing bends then length, nudging/centering of shared segments), implemented in-house from the papers.
*Rationale:* the Wybrow-Marriott-Stuckey design; in-house implementation avoids libavoid's LGPL, consistent with g3t's ruled rejected-for-now on libavoid-js and its stated revisit trigger.

**RTE-002 (P0, T).** The router shall treat node outlines (MOD-002), container borders, and configured label boxes as obstacles.

**RTE-003 (P0, T).** Routes shall terminate on the element outline or port position with exact intersection, never at node centers or at bounding boxes of non-rectangular shapes. Polygon-outline clipping only; no raster/pixel-precise image clipping (US 9,082,226 avoidance; IP register).

**RTE-004 (P0, T).** The library shall provide a fast channel/grid orthogonal router with documented quality tradeoffs, selectable per surface and engaged automatically above a configurable element-count threshold.

**RTE-005 (P0, T).** Routes shall be emitted as first-class geometry (ordered absolute bend points plus attachment metadata), owned by the routing core; renderer adapters shall draw routes verbatim and shall not synthesize path geometry.
*Rationale:* g3t's audited interim (ELK absolute polylines in `geometry.edges`, projected onto Cytoscape `curve-style: segments` with taxi fallback) is exactly the dual-ownership squeeze this requirement retires; Cytoscape's relative segments model is the documented ceiling behind the drag-staleness defect class.

**RTE-006 (P0, T).** The router shall support polyline and orthogonal modes; octilinear and curved (rounded-corner orthogonal, spline) modes are P1.

**RTE-007 (P0, T).** Parallel edges and self-loops shall receive non-overlapping routes with configurable spacing.

**RTE-008 (P1, T).** The router shall support port groups and side ordering such that edges sharing a side do not cross within the port zone, and shall preserve declared-port perpendicular exit direction.
*Rationale:* g3t deliberately keeps taxi exits for declared ports because the port fixes a perpendicular direction the projected route basis would fight; the requirement makes that exit semantics a router guarantee rather than a renderer workaround.

**RTE-009 (P1, T).** The library shall provide bus-style routing for hyperedges (backbone selection, then connector attachment).

**RTE-010 (P1, T).** The router shall compute the set of route-route crossings and expose it for bridge rendering (STY-016).

**RTE-011 (P1, T).** Routing shall be incremental: on endpoint movement (drag) or local model change, only affected routes shall be recomputed within a per-frame budget, with a coarse immediate route and a refined route on settle.
*Rationale:* g3t's ruled revisit trigger for a custom router ("live re-routing under free node dragging") stated as a requirement.

**RTE-012 (P1, T).** Routes shall respect container semantics: sibling edges inside a container shall not exit it; a boundary-crossing edge shall cross each border at most once (configurable) at a stable crossing point.

**RTE-013 (P2, T).** The library shall provide force-directed edge bundling for organic layouts and ink-minimizing ordered bundling for layered layouts, as post-stages preserving endpoint exactness (RTE-003).

**RTE-014 (P2, T).** Bundled and routed edges shall remain individually hit-testable.

---

## 7. Node visual requirements: shapes and icons (NOD)

**NOD-001 (P0, T).** The library shall provide built-in node shapes: rectangle, rounded rectangle, ellipse, diamond, hexagon, triangle, pill, and arbitrary closed SVG-path shapes, each with a matching outline geometry.

**NOD-002 (P0, T).** Node fill and stroke shall be independently styleable (color, opacity, width, dash), including gradient fills.

**NOD-003 (P0, T).** Nodes shall support icon content from a registered icon set (SVG source), positioned by slot (center or offset slots), sized in node-relative or absolute units.

**NOD-004 (P0, T).** Icon registration shall accept arbitrary SVG (including offline-converted draw.io/mxGraph stencils) and shall record per-icon license metadata surfaced in the NOTICE generation (LIC-004).

**NOD-005 (P0, T).** Nodes shall support raster image fills with fit modes (cover/contain/tile); image content shall never affect outline geometry.

**NOD-006 (P0, T).** Edge cropping and arrowhead placement shall use the node outline (including rotation and non-convex paths), verified by geometry tests per shape kind.

**NOD-007 (P1, T).** The library shall provide decoration primitives composable on any node: glyphs/badges (text/icon, boundary-positioned slots, truncation with ellipsis), halos, donut borders, and pulses, all expressed as `VisualAttributes` fields rather than custom node types.
*Rationale:* the KeyLines/Ogma vocabulary; g3t's ad hoc pin badges and icon/glyph fixes retire into these primitives.

**NOD-008 (P1, T).** Nodes shall support rotation with correct outline, label, and port transforms.

**NOD-009 (P1, T).** The library shall provide compartment rendering (headers with stereotype+name, titled divider rows, per-compartment collapse) and a template layer for composite node interiors (panel tree with vertical/horizontal/table containers, text blocks, icons, item-array repetition) bound to `data` fields, rendered natively in SVG/Canvas.
*Rationale:* raised from P2 to P1 in v0.2: g3t already renders compartmented structural nodes (header `{stereotype, name}`, compartment rows) in the structural view; the library layer must own that capability generically so the structural view consumes rather than reimplements it. The general panel-template layer beyond compartments remains the stretch portion of this requirement.

**NOD-010 (P2, T).** Template-rendered nodes shall report measured size back to layout (size negotiation) before final placement.

---

## 8. Container visual and behavior requirements (CNT)

**CNT-001 (P0, T).** Containers shall render with configurable border, background, corner radius, padding, and a header zone carrying the container label and controls.
*Note:* g3t's audited `:parent` compound styling (including the fixed-16px padding finding: percentage padding distorts on compound parents) is the seed; the fixed-pixel padding doctrine carries into the default theme.

**CNT-002 (P0, T).** Containers shall support collapse/expand with atomic-node representation while collapsed (LAY-016 at P2 governs full lifting semantics; minimal re-termination is P0), a header affordance, and state exposed to the styling engine.

**CNT-003 (P0, D).** Collapse/expand shall preserve the camera and satisfy LAY-018 stability.
*Rationale:* g3t's D15 camera hold is landed and gate-green; the position-stability half (LAY-018) is the open portion.

**CNT-004 (P1, T).** Swimlane containers shall render partition dividers and per-lane headers, with lane membership styleable.

**CNT-005 (P1, T).** Dragging a container shall move its subtree rigidly, with incremental routing (RTE-011) keeping attached routes valid during the drag.
*Note:* g3t's synthetic boundary ports already drag with their host; the open portion is live route validity.

**CNT-006 (P1, T).** Container hit testing shall distinguish header, body, and border zones.

**CNT-007 (P2, T).** Nested collapse states shall compose (collapsing an ancestor of a collapsed container and re-expanding shall restore inner state exactly).

---

## 9. Styling engine requirements (STY)

**STY-001 (P0, T).** Style resolution shall apply ordered layers with fixed precedence: library defaults < theme < rules (insertion order) < classes < state overlays < per-element manual overrides.

**STY-002 (P0, T).** Rules shall consist of a selector (declarative predicate over element kind, `data` fields, graph position, container membership) plus attributes (literal values or functions of the element).

**STY-003 (P0, T).** A rule mapping a visual attribute from a `data` field shall apply only to elements where the field is present; absent-field elements shall be skipped with zero per-frame diagnostics.
*Rationale:* codifies g3t's `[field]`-scoped selector doctrine structurally; the mapping-warning flood was a measured 1,716 ms main-thread stall.

**STY-004 (P0, T).** Rules shall support declared dependencies (data/attribute/adjacency inputs read) and declared outputs (attributes written, including nested paths), used by the engine to recompute only affected rules for affected elements on change.
*Rationale:* the Ogma `nodeDependencies`/`nodeOutput` design; without it, adjacency-dependent rules are O(graph) per change.

**STY-005 (P0, T).** State overlays (hover, selected, active, disabled, custom) shall compose by priority and be independently removable without recomputing base styles.

**STY-006 (P0, T).** Themes shall be expressed as design tokens (color roles, stroke scale, radius scale, type scale, spacing) resolved before rule evaluation; light and dark themes shall ship with color-vision-deficiency-safe default palettes (Okabe-Ito lineage) and WCAG-checked label contrast, interoperable with g3t's ThemeManager conventions.

**STY-007 (P0, T).** Rule sets, themes, and LOD schedules shall be serializable to and from JSON with a published schema.

**STY-008 (P0, T).** Edge styles shall include, as first-class direction encodings: arrowheads (source/target, geometry-based, shape library including the UML relationship symbol set: filled/hollow diamond at source, hollow triangle at target, open dashed-dependency arrow), tapered width, and source-to-target color/opacity gradient, plus dash patterns and casing.
*Rationale:* Holten & van Wijk on arrowhead weakness in dense graphs; the UML symbol set is already shipped in g3t's structural edges (composition/aggregation/generalization/dependency, A3) and becomes part of the library's arrow library rather than view-local code.

**STY-009 (P0, T).** Arrowheads shall render as explicit geometry aligned to the route's terminal tangent and cropped against the outline, not via SVG `<marker>`.

**STY-010 (P0, T).** The LOD schedule shall be declarative data: per element class (labels, glyphs, borders, icons, edges, decorations), visibility and simplification tiers keyed on zoom and on visible-element count, themable per surface.

**STY-011 (P1, T).** Style resolution shall accept the zoom context and emit per-element LOD tiers so adapters render the correct tier without re-resolving on pan.

**STY-012 (P1, T).** The engine shall support classes (named attribute bundles togglable per element) with priority ordering, evaluated between rules and states.

**STY-013 (P1, T).** Selection/emphasis shall include opacity dimming of non-matching elements with automatic incident-edge fading (an edge at most as prominent as its dimmest endpoint), available as a built-in composite rule.

**STY-014 (P1, T).** Legends shall be derivable mechanically from active rules (fields, channels, scales, including default-derived encodings), exposed as data for host UIs.
*Rationale:* g3t's 12.15 finding (legend missed canvas-default shape encodings) generalizes: legend derivation must see defaults, not only spec-declared encodings.

**STY-015 (P1, T).** Style resolution throughput shall meet PRF-004, benchmarked in CI on reference graphs.

**STY-016 (P1, T).** Edge bridges (gap and arc line-jumps) shall render at crossings reported by RTE-010, under LOD control.

**STY-017 (P2, T).** Stage animations (enter/update/exit transitions, attribute tweens, pulse loops) shall be supported with a global reduced-motion switch honoring `prefers-reduced-motion`.
*Note:* g3t already disables chart animation under reduced motion (12.18); the library-wide switch generalizes it.

---

## 10. Label requirements (LBL)

**LBL-001 (P0, T).** Node labels shall support interior placement slots, exterior boundary placement, wrapping, truncation with ellipsis, and multi-line text.

**LBL-002 (P0, T).** Labels shall support halo/outline text (SVG paint-order stroke; Canvas double-pass; SDF distance band in WebGL) with theme-controlled halo color.

**LBL-003 (P0, T).** Labels shall hide below a configurable minimum on-screen pixel size, per the LOD schedule.

**LBL-004 (P1, T).** Edge labels shall place along the routed path (parameterized position, optional upright-corrected rotation) and shall register as routing obstacles when configured (RTE-002).
*Note:* g3t's `StructuralEdge.label` (mid-edge label) is the consuming precedent.

**LBL-005 (P1, T).** A label decluttering pass shall resolve label-label and label-node collisions (greedy priority-based first; strategy replaceable), deterministic under ARC-006.

**LBL-006 (P1, T).** Text measurement shall be renderer-consistent: one measurement service used by layout, decluttering, and all adapters.

**LBL-007 (P2, T).** Container labels shall support header placement with collapse-state-dependent styling.

---

## 11. Rendering adapter requirements (RND)

**RND-001 (P0, T).** The library shall provide an SVG adapter rendering full `VisualAttributes` fidelity: shapes, icons, containers, compartments, decorations, labels, routes, bridges, with CSS-variable theming hooks.

**RND-002 (P0, T).** The library shall provide an SVG overlay edge-layer adapter mountable above a host canvas (initially Cytoscape), with pan/zoom transform sync, drawing routes per RTE-005, and delegating edge hover/context-menu events to the host with interaction parity as part of the definition of done.
*Rationale:* g3t's ruled architecture (per-surface opt-in `structuralEdgeLayer: "cytoscape" | "svg-overlay"`); not yet built as of the 2026-07-09 audit; interaction parity was ruled into the DoD, not a follow-up.

**RND-003 (P0, D).** The overlay adapter's pan/zoom sync shall show no visible lag on the MBSE-scale reference diagram at 4k; on failure, that surface degrades to the host edge renderer (the overlay is per-surface opt-in by construction).

**RND-004 (P0, T).** The library shall provide a Canvas 2D adapter with multi-resolution element bitmap caching with partial invalidation, viewport snapshot transform during pan/zoom, interaction-time simplification, and HiDPI pixel-ratio control.

**RND-005 (P0, T).** All adapters shall implement layered z-order: canvas annotations < containers (by depth) < edges < nodes < labels < decorations < interaction handles.

**RND-006 (P0, T).** Hit testing shall resolve the topmost element with zone detail (node body vs port vs glyph; container header vs body vs border; edge segment), geometric in SVG/Canvas.

**RND-007 (P1, T).** Exports shall include SVG and PNG with full fidelity (decorations, bridges, halos, donuts) and deterministic output under ARC-006; PDF is P2.

**RND-008 (P2, T).** The library shall provide a WebGL adapter using per-visual-type programs with instanced attributes and GPU picking (sigma.js v3 lineage), targeted at 10k+ elements.

**RND-009 (P2, T).** The WebGL adapter shall render text and icons from MSDF atlases (offline msdfgen bake, runtime tinysdf fallback), crisp at arbitrary zoom, halo as a distance band.

**RND-010 (P2, T).** Adapters shall support LOD-driven renderer handoff on one surface without element identity loss.

---

## 12. Interaction requirements (INT)

Scope note: the library provides interaction primitives; hosts own gestures and commands (g3t's P3 right-click universality remains a g3t-level contract built on these primitives).

**INT-001 (P0, T).** The library shall expose element-level pointer events (enter/leave/down/up/click/context) with zone info (RND-006), uniform across adapters.

**INT-002 (P0, T).** Node and container drag shall be a geometry operation (positions update, CNT-005 subtree rigidity, RTE-011 route maintenance) independent of any host framework.

**INT-003 (P1, T).** Viewport operations (pan, zoom, fit, center-on-element, camera hold across rebuilds) shall be adapter-uniform, with camera hold satisfying CNT-003 and fit semantics covering the ready-and-layoutstop double-fit contract with destroy guards.
*Rationale:* g3t's 12.10 popout contract (whole neighborhood in frame; fit on ready and again on layoutstop, destroyed-guarded) generalizes to the library viewport service.

**INT-004 (P1, T).** Selection state shall be a model-level set driving the `selected` style state, with box/lasso hit queries as geometry services.

**INT-005 (P2, T).** Snapping (grid; alignment guides to sibling borders/centers) shall be available during drag as an opt-in geometry service.

---

## 13. Interoperability requirements (IOP)

**IOP-001 (P0, T).** The library shall define a versioned JSON graph document format (topology + data + style refs + geometry snapshot) with a published JSON Schema and round-trip guarantee.

**IOP-002 (P0, T).** The library shall import ELK JSON graphs (hierarchy, ports, layout-option passthrough) losslessly for the topology/ports subset.
*Rationale:* g3t's structural pipeline assembles ELK graphs internally; the import path is the migration bridge and the shared-fixture format for QLT-002 comparisons.

**IOP-003 (P0, T).** The Cytoscape.js adapter shall consume Cytoscape element JSON and operate in overlay mode (RND-002) against a live Cytoscape instance, explicitly not replacing Cytoscape's style system in that mode.

**IOP-004 (P1, T).** The d3 adapter shall expose layout/routing as data joins (positions/routes as plain arrays) plus an optional SVG renderer mount, with zero d3 dependency in core.

**IOP-005 (P1, T).** The library shall import GraphML (topology + attributes) and export GraphML and DOT (topology only).

**IOP-006 (P1, T).** An RDF projection helper (triples to LPG with type collapse, literal collapse, blank-node resolution, list resolution, reification collapse; pluggable mapping) shall be provided as a separate optional package.
*Rationale:* aligned verbatim with g3t principle P4's projection vocabulary; optional package keeps core paradigm-free (P5).

**IOP-007 (P1, T).** Style presets for UML class diagrams, BPMN basic set, and SysML v2 shall ship as data (STY-007) with compartment templates (NOD-009), validated against notation reference renderings by inspection.
*Note:* partially seeded: g3t's structural view already carries the UML header/compartment/relationship-arrow substrate.

**IOP-008 (P2, T).** A Holonic projection helper (Interior/Boundary/Projection/Context four-graph model to the library model, with holon-layer attribution as data fields) shall be provided as a separate optional package.
*Rationale:* g3t principle P6 treats Holonic as first-class; the library enables it without core coupling.

---

## 14. Performance requirements (PRF)

Reference graphs: R1 = 500 nodes / 800 edges / 3 container levels (MBSE-scale); R2 = 5,000 / 10,000 / flat; R3 = 50,000 / 100,000 / flat. Budgets measured on the CI reference machine profile; initial targets subject to one revision after baseline measurement (open decision 2), then frozen.

**PRF-001 (P0, T).** Layered layout of R1 shall complete within 300 ms in-worker; stress layout of R2 within 2 s to visual convergence.

**PRF-002 (P0, T).** Obstacle-aware routing of R1 shall complete within 200 ms from scratch; incremental reroute of a single dragged node's edges within 8 ms per frame.

**PRF-003 (P0, T).** The channel router shall route R2 within 300 ms.

**PRF-004 (P0, T).** Full style resolution of R2 shall complete within 100 ms; dependency-tracked incremental resolution of a single-element data change within 2 ms.

**PRF-005 (P0, T).** Steady-state pan/zoom on R1 (SVG) and R2 (Canvas) shall hold 60 fps with zero per-frame console output on hot paths.

**PRF-006 (P1, T).** Canvas adapter caches shall be bounded and evictable; total adapter memory for R2 under a documented ceiling verified in CI.

**PRF-007 (P2, T).** The WebGL adapter shall hold 60 fps pan/zoom on R3 with LOD active.

---

## 15. Quality, testing, and process requirements (QLT)

**QLT-001 (P0, T).** Every layout/routing algorithm shall have golden-geometry tests (seeded, deterministic) plus property tests (containment, guaranteed non-overlap, route-obstacle clearance, endpoint exactness).

**QLT-002 (P0, T).** Layout quality metrics (crossing count, bend count, total edge length, displacement-from-sketch, aspect ratio) shall be computed by a metrics module and asserted with regression tolerances in CI against ELK output on shared reference graphs.
*Rationale:* makes "meets or beats ELK/fcose" falsifiable per surface before any engine switch (ARC-005, LAY-014).

**QLT-003 (P0, D).** Visual changes shall ship through a live-review harness with per-round reviewer guidance; rendered-behavior claims remain unverified until live-confirmed.
*Note:* g3t's original visual-acceptance surface was retired 2026-07-04 in favor of the demo/Storybook surfaces under the OSS-adoption plan; this requirement binds to whichever live surface is current, with the demo-adoption doctrine (every demonstrated behavior gate-enforced) applying to library demos equally.

**QLT-004 (P0, I).** Each release round shall update CHANGELOG and STATUS; G3L requirement IDs cited in source or tests shall be kept in sync with this specification via the existing `gates:spec` citation gate (planning documents exempt).

**QLT-005 (P0, T).** Adapter conformance (ARC-008) shall include pixel-tolerant image snapshot tests for a fixed scene set per adapter.

**QLT-006 (P0, T).** The library shall emit structured diagnostics (coded warnings/errors with element IDs) through a pluggable sink; no raw console calls in library code.

**QLT-007 (P1, T).** Routing regression tests shall include the g3t drag-defect scenarios: body-edge drag, collapsible-container drag, mixed-attachment drag, each asserting orthogonality preservation and endpoint validity post-drag.

**QLT-008 (P1, A).** Public API changes shall follow semver with an API report gate, integrating with g3t's `verify:exports`/`verify:types`/`verify:treeshake` pattern (the verify suite reconstruction of 2026-07-03 demonstrates why the gate must fail loudly when its test sources go missing).

**QLT-009 (P1, T).** Fuzz tests shall exercise the model and router with seeded randomized graphs including degenerate cases: zero-size nodes, coincident nodes, empty containers, deep nesting, disconnected components.

---

## 16. Accessibility requirements (ACC)

**ACC-001 (P0, T).** Default themes shall meet WCAG contrast for labels against their actual rendered backgrounds, verified computationally in CI.

**ACC-002 (P0, I).** Every color encoding in shipped presets shall have a redundant non-color channel (shape, icon, glyph, or label), documented in the preset.

**ACC-003 (P1, T).** The SVG adapter shall emit an accessible structure (role/aria labeling per element from a data-driven template) sufficient for screen-reader element enumeration.

**ACC-004 (P1, T).** All animation shall honor reduced motion (STY-017); pulses degrade to static halos.

**ACC-005 (P2, T).** Keyboard navigation primitives (focus traversal, spatial next-element queries) shall be provided as services for host applications.

---

## 17. Licensing and IP requirements (LIC)

**LIC-001 (P0, I).** The library shall be released under Apache-2.0.
*Rationale:* decided (v0.2); matches g3t as-built (Apache-2.0 LICENSE plus NOTICE present); the explicit patent grant is preferred given the IP register.

**LIC-002 (P0, I).** Runtime dependencies shall be limited to an approved allowlist (MIT, Apache-2.0, BSD, ISC); GPL and LGPL runtime dependencies are prohibited, including libavoid/libavoid-js, OGDF, and WebCola-C++ lineage. Reading GPL source to reimplement is prohibited by policy; implement from papers.

**LIC-003 (P0, I).** Patent-avoidance constraints (LAY-006, RTE-003/NOD-005) shall be recorded in an IP register. (Amended by owner ruling 2026-07-18: the review release-gate clause was removed; IP questions are handled outside the repo.) Not legal advice.

**LIC-004 (P0, T).** Bundled assets (icons, fonts, palettes) shall carry machine-readable license metadata with an aggregate NOTICE file generated in CI, extending g3t's existing NOTICE.

**LIC-005 (P1, I).** Contributions shall require a DCO sign-off; no CLA unless governance later requires one.

---

## 18. Documentation requirements (DOC)

**DOC-001 (P0, I).** Each public API shall have reference documentation generated from source types with at least one runnable example, integrated with the existing typedoc + `verify:snippets` + `docs:check` gates.

**DOC-002 (P0, I).** Each layout and router shall document its algorithmic lineage (papers), complexity, constraint support matrix, and quality/speed positioning versus sibling algorithms.

**DOC-003 (P1, I).** A migration guide shall map every g3t structural-rendering seam (ElkEngine, `layoutStructural` options, `structural-to-cytoscape` converter, edge layer, ComboManager, incremental-layout API) to its library counterpart with before/after code.

**DOC-004 (P1, I).** A theming/notation guide shall document building a notation preset (tokens + rules + templates) end to end, using UML class diagrams as the worked example, consistent with the OSS-adoption doctrine (time-to-first-graph: README to live demo to wiring snippet to installed package).

---

## 19. Non-goals (explicit)

- NG-1: No built-in graph database or query engine; RDF/Holonic stay in optional projection packages (IOP-006/IOP-008).
- NG-2: No general charting (`@g3t/charts` remains separate).
- NG-3: No server-side rendering service; headless Node usage supported, no hosted component.
- NG-4: No raster-precise outline clipping and no channel-based hierarchical drawing (IP register).
- NG-5: No WebGPU commitment in v1; ARC-010 keeps the door open.

---

## 20. Requirement priority summary

- **P0 (core viability):** ARC-001..007, MOD-001..007, MOD-011, LAY-001..006, LAY-008/009/012/013/017/018, RTE-001..007, NOD-001..006, CNT-001..003, STY-001..010, LBL-001..003, RND-001..006, INT-001/002, IOP-001..003, PRF-001..005, QLT-001..006, ACC-001/002, LIC-001..004, DOC-001/002.
- **P1 (differentiators):** ARC-008/009, MOD-008..010, LAY-007/010/011/014/015/019/020, RTE-008..012, NOD-007..009, CNT-004..006, STY-011..016, LBL-004..006, RND-007, INT-003/004, IOP-004..007, PRF-006, QLT-007..009, ACC-003/004, LIC-005, DOC-003/004.
- **P2 (advanced):** ARC-010, LAY-016/021, RTE-013/014, NOD-010, CNT-007, STY-017, LBL-007, RND-008..010, INT-005, IOP-008, PRF-007, ACC-005.

Deltas from v0.1: MOD-011 raised P2→P0 (compartments shipped in g3t); NOD-009 raised P2→P1 and expanded to include compartment rendering; IOP-008 added (Holonic projection, P2); LIC-001 decided (Apache-2.0); STY-008 expanded with the shipped UML arrow symbol set; STY-014 expanded to require default-derived legend rows; INT-003 expanded with the fit contract; QLT-003 rebound from the retired VA surface to the current demo/Storybook surfaces; QLT-004 bound to `gates:spec`; QLT-008 grounded in the verify-suite reconstruction lesson.

---

## 21. g3-toolkit traceability (audited 2026-07-09 against the uploaded source)

| Area | g3t audited state | Requirement(s) | Status vs requirement |
|---|---|---|---|
| License/NOTICE | Apache-2.0 LICENSE + NOTICE present | LIC-001/004 | Satisfied at g3t level; library inherits |
| Spec/gate infrastructure | specs/00–10 with R{n.m} IDs (46/12/18 rollup), P1–P6, D-register, `gates:spec`; `pnpm run gates` all green incl. reconstructed verify; 1,044 tests / 107 files | QLT-004/008, ARC-007 | Process exists; G3L IDs join the citation gate |
| Layout engine seam | `ElkEngine` interface; `layoutStructural` options: `edgeRouting` (ORTHOGONAL default), `routeEdges` (default true), `crossingMinimization` (LAYER_SWEEP \| INTERACTIVE) | ARC-004/005, LAY-003 | Seam exists; internal engine absent |
| Layout stability | D15 camera hold landed; incremental-layout API (`capturePositions`/`applyIncrementalLayout`) shipped; 12.20 interactive-position experiment recorded, NOT shipped (ELK still recomputes positions on collapse rebuilds) | LAY-017/018, CNT-003 | Camera half satisfied; position half open |
| Edge routing (compute) | ELK node-avoiding routes emitted as absolute polylines into `geometry.edges`, endpoints on ports, `routeEdges` toggleable | RTE-005 (geometry emission half) | Emission satisfied via ELK; in-house router (RTE-001/002/004/011) absent |
| Edge routing (render) | Converter projects polylines onto Cytoscape `curve-style: segments` (enum rides a class); taxi fallback; declared-port edges keep taxi on purpose (perpendicular exit); relative-segments model is the documented ceiling behind drag staleness | RTE-005 (verbatim-draw half), RTE-008, RND-002/003, QLT-007 | Interim squeeze in place; SVG overlay not built; drag scenarios not yet regression tests |
| Endpoint attachment | Synthetic boundary ports landed: distribute body edges along a side, render invisibly, drag with host, exit perpendicular | MOD-004/006, RTE-003 | Largely satisfied for rects; outline-exact termination for non-rect shapes open |
| Compound/containers | `:parent` compound styling in CytoscapeCanvas (fixed-16px padding finding); ComboManager; collapse/expand shipped | MOD-003, CNT-001/002 | Satisfied at Cytoscape level; model-level container semantics (library-owned) open |
| Compartments/UML | `StructuralNode` header {stereotype, name}; `StructuralCompartment` (rows, titles, collapsible); UML edge kinds driving arrow symbols (A3) | MOD-011, NOD-009, STY-008, IOP-007 | Modeled and rendered in the structural view; generalization into library primitives open |
| Force layout | fcose wired | LAY-008/009/014, QLT-002 | Internal force/stress absent; metrics gate required before any switch |
| Styling | Cytoscape stylesheets; `[field]`-scoped mapping doctrine; enum-rides-a-class; ThemeManager light/dark; legend derives default shape encodings (12.15) | STY-001..004/006/014, PRF-005, QLT-006 | Doctrine by convention; rule engine with dependency tracking absent |
| Decorations | Pin badges, icon/glyph fixes exist ad hoc in demos/canvas | NOD-007 | Primitives absent; ad hoc code retires into them |
| LOD | None declarative; perf handled per incident | STY-010/011 | Absent |
| Labels | `StructuralEdge.label` mid-edge; canvas labels via Cytoscape | LBL-001..006 | Basic only; halo text, declutter, measurement service absent |
| Reduced motion | Charts disable animation under prefers-reduced-motion (12.18) | STY-017, ACC-004 | Partial precedent |
| Exports/verify | verify suite: exports, treeshake, smoke, types, snippets, docs, bundle | RND-007, QLT-008, DOC-001 | Gate infrastructure ready; export fidelity untested for decorations |
| Demo/adoption posture | Flagship retired; demo-adoption plan P0/P1 executed; OSS adopters are the ruled audience; every demonstrated behavior gate-enforced | QLT-003, DOC-004 | Doctrine adopted for library demos |

---

## 22. Open decisions

1. ~~License~~ **Closed (v0.2): Apache-2.0** (LIC-001), matching g3t as-built.
2. **PRF budget freeze**: accept section 14 initial numbers or re-baseline on the CI machine profile first (one revision permitted).
3. **Cytoscape long-term posture** (IOP-003): overlay-only is decided for the g3t horizon; full replacement renderer deliberately deferred.
4. ~~Compartment layout semantics~~ **Closed (v0.2): strict non-layout compartments** (MOD-011), confirmed by g3t's as-built `StructuralCompartment`; relax only on demonstrated need.
5. **Hyperedge surface area** (MOD-009/RTE-009): bus-routing input only, or full hyperedge modeling; current text scopes to bus routing.

---

## 23. Verification method key

- **I (Inspection):** reviewed artifacts (code audit, docs, license files, IP register).
- **A (Analysis):** architectural/complexity analysis, dependency audits.
- **D (Demonstration):** live review on the current demo/Storybook surfaces; rendered-behavior claims remain unverified until live-confirmed.
- **T (Test):** automated tests in CI (unit, property, golden-geometry, snapshot, benchmark), gate-enforced per the g3t `gates` convention.
