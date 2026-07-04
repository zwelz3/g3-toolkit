# g3-toolkit Status

**As of:** 2026-07-03 (active: demo quality, reliability, and OSS
adoptability; plan in planning/demo-adoption-plan.md. The flagship
demo and the two standalone single-file demos were RETIRED this round
after fold audits: planning/flagship-retirement.md and the CHANGELOG
entry. `pnpm run gates` is the CI-parity round gate.)
**Version:** 1.0.0-rc.2 | **Tests:** the gate scripts are authoritative
for the count (1044 across 107 files at this writing; verify adds the
dist/public-api suite). | **Gates:** all green, INCLUDING verify, which
had been silently dead since its test sources (tests/dist) were lost in
a packaging round; reconstructed 2026-07-03.
**Requirement rollup:** 46 implemented, 12 in-progress, 18 proposed
(30 open requirements singly owned across the roadmap; the spec
corpus additionally carries 18 user stories, all proposed, which are
NOT requirements and are excluded from this rollup; decision log:
10 accepted, 5 considering, 3 deferred, 11 open questions). Earlier
rollups (rounds 27-30) conflated user-story status lines into the
proposed count; the gate scripts were always right. Descope
2026-06-12 roadmap descope (NOT code removal): Sankey, relational
connectors, and broad virtualization were removed as pending ROADMAP
items, not deleted from the codebase. SankeyView shipped (R1.9) and is
in the public barrel; virtualizeRelationalData/parseCSV and the
incremental-layout API remain exported. "Removed" here means "no
further roadmap investment," not "absent." See
planning/rdf-lpg-virtualization-audit.md for the full
shipped-vs-gap accounting and the reconciliation.

This document is the current-state snapshot for humans; agents start
at CLAUDE.md. The authoritative round-by-round history is
planning/visual-acceptance-1.md; per-area design records live in
roadmap/design/; milestone-era tracking (the former PROGRESS.md and
planning/status.md) is archived verbatim in
planning/milestone-history.md.

## PRIOR FOCUS (2026-06-21, superseded 2026-07-03): structural-view rendering + Storybook reshape

Two active threads layered on the feature-stable library.

**Structural-view rendering (ELK/Cytoscape).** Full design narrative and
decisions in `roadmap/design/structural-rendering.md` (section "Layout
stability, edge routing, and ports"). Landed and gate-green:
- Camera/position stability (decision D15 in specs/09-design-decisions.md):
  the same input graph holds pan/zoom and node positions; refit only on a
  genuinely different graph or an explicit user op.
- Port-based body-edge attachment: synthetic boundary ports distribute
  edges along a node side, render invisibly, drag with their host, and
  exit perpendicular (away from the source node).
- Obstacle-aware routing, CORE slice: `layoutStructural` now emits ELK's
  node-avoiding edge routes into `geometry.edges` (option `routeEdges`,
  default on). Verified that the routes carry absolute polylines whose
  endpoints sit on the ports, and that disabling omits them.

CONVERTER SLICE LANDED (2026-06-22, gate-green headless): the Cytoscape
converter (`structural-to-cytoscape.ts`) projects each ELK route polyline
onto `curve-style: segments` (an enum, so it rides a class) for body and
synthetic-point-port edges, with the port-to-port taxi as the fallback
when `routeEdges` is off or a route has no interior bend. Declared-port
edges keep the taxi exit ON PURPOSE: the port already fixes a perpendicular
direction the projected basis would fight. This is the visible payoff
("edges route around blocks, not behind") and is NOT headlessly verifiable;
it ships for Zach through the visual-acceptance page (VA-31, packaged in
outputs). IMMEDIATE NEXT STEP: that review, then A3 polish from findings.

**Storybook atomic-design reshape.** Target taxonomy (in
`packages/react/src/Overview.mdx`): Atoms / Molecules / Compounds /
Patterns, plus a Reference group for supporting material. State:
- Done: Atoms (SpecPort, EmptyState, Skeleton) and Molecules (SearchBar,
  FacetFilter, FilterBuilder, TemporalRangeFilter, and Minimap, new
  2026-06-22) titled under the new tiers; the Toolbar & Algorithms story
  moved to Compounds (the old "Organisms" term is gone repo-wide); Charts
  and Features moved to Reference; the Patterns tier now carries
  Coordinated Selection (DS2: live cross-view linking) and Node Editor
  Modal. Both are new 2026-06-22; the modal sits on the new
  `views/inspector/` suite (NodePropertyInspector, NodeEditorModal,
  PropertyField, property-spec), the node inspection-and-editing surface
  the standalone demo's Properties tab also consumes.
- Remaining: retitle the other Compounds (CytoscapeCanvas, the Views
  story, the UX-Surface toolbar and encoding stories) from their legacy
  sections into `Compounds/*`, and AppLayouts into `Patterns/*`.
- Beyond the reshape: the renaming is step one of demonstrating adopter
  value. The continuation is the DS plan in
  roadmap/design/demonstration-surface.md (DS1-DS6, priority-ordered).
  LANDED 2026-06-22: DS2 (the Patterns tier shows cross-view linking live
  via Coordinated Selection, replacing the hardcoded selection), DS4
  (the intent-indexed capability map, docs/capability-index.md), and DS6
  (the capabilities-and-limits page, docs/capabilities-and-limits.md).
  COVERAGE BARREL RESOLVED 2026-06-22: packages/react/src/views/coverage
  landed (CoverageMeter + CoverageMeterList, 10 tests passing, strict
  typecheck clean), so the dangling ./views/coverage barrel export now
  resolves and the build-time coverage-stub workaround (the resolveId hooks
  in vite.sb-client / vitest.sb / vite.demo and the stub file) was retired.
  REAL REMAINDER, now UNBLOCKED: DS1 (co-locate the CI-tested wiring recipe
  in each Compound's Docs tab), DS3 (the theming demo from design-system.md
  D2), and the DS2 chart-rendering sub-part; plus DS5 (a minimal starter
  example), open.

## CURRENT FOCUS (2026-06-17): the flagship demo

The library is feature-stable at v1.0.0-rc.2. Active work has shifted
from library features to a **cinematic flagship demonstration** of the
toolkit, plus the demo/examples surface that supports it. A new agent
picking this up should read, in order:

1. `examples/flagship/README.md` — what the flagship is and its build
   state (composition build complete; visual review pending).
2. `planning/flagship-narrative.html` — the full story design (the
   buyer, the three acts, the two-strength model, the deliverable).
3. `planning/flagship-implementation-plan.md` — the software plan
   (superseded for the build sequence by the Option 1 redesign:
   `planning/flagship-plan-option1-redesign.md`).
4. `planning/rdf-lpg-virtualization-audit.md` — honest shipped-vs-gap
   accounting for the data-paradigm and scale dimensions.

**Flagship state right now:** the composition-first build (Option 1) is
COMPLETE and PACKAGED. The two-strength engine, the encoding that
drives the stage, the beat sequence, the real stage + camera, the
coverage chart, the inspector, the teaming/path overlays, the brand
theme, the brief export + workspace snapshot, and the interactive
epilogue are all built and verified headlessly, with packaging
(`examples/flagship/package.json`) that quarantines the heavy deps. The
three toolkit components the shell needed (CoverageMeter,
ProvenanceTrace, the camera controller) shipped in `@g3t/react`. No
other package source changed. What remains is browser-only: the live
visual review, then step 7 (motion/legibility polish).

**Resuming after the visual review:** start at
`planning/flagship-resume.md` (it reads `examples/flagship/
REVIEW-RESULTS.md` and routes failures to the owning module). The
review procedure is `examples/flagship/REVIEW-RUNBOOK.md`; landing and
wiring detail is `examples/flagship/INTEGRATION.md`.

**Demo/examples surface (supporting the flagship):** the dev-server
demo (`pnpm run dev`) has four scenario shells (Auditor, MBSE, Supply
Chain, Biomedical) that demonstrate the toolkit in domain stories;
`examples/decision-dashboards` holds two capability-first dashboards
(Analytics, Schema) that foreground the views the scenarios do not. The
old showcase example was deleted. Custom raster/logo node icons are
supported via the icon channel (`isImageRef` passthrough) and shown in
the Supply Chain shell with hosted Iconify icons. The roadmap groups
below (A-G) are the LIBRARY roadmap and remain valid, but are not the
current focus.



g3t is a composable graph-visualization component library (three
packages: @g3t/core with zero React, @g3t/react, @g3t/charts) that a
host application wires into its own decision-support and process
components through three channels: exported zustand stores, props and
callbacks, and versioned JSON documents. A custom control is usually
one store call in an onClick; the reverse direction (toolkit state
driving host components) is a store subscription. docs/wiring-guide.md
documents the surface and every snippet there runs in CI
(examples/wiring/), which doubles as a public-barrel completeness
gate.

## Shipped capability inventory (core through the demo overhaul)

(The inventory below is current as of 2026-06-16. It was originally
written for rounds 1-31; the entries remain accurate and the SHACL
B-series, structural rendering, the icon raster passthrough, and the
demo/examples overhaul are reflected in the round log and CHANGELOG.
For the data-paradigm and scale dimensions specifically, see
planning/rdf-lpg-virtualization-audit.md.)

**Encoding grammar.** EncodingSpec v1: a versioned, serializable
channel/driver/scale spec (color, size, icon, shape, labels; fixed,
categorical, sequential scales; slot-stable overrides) with
reserved-channel guards that reject by owner name (selection owns
effects.accent, inference owns edge.dash, overlays own borderWeight,
theme owns canvas.\*). Surfaces: EncodingSpecPanel (three tiers),
EncodingPreview (contrast-aware glyphs), SpecLegend (same resolvers
as the canvas, so legend and canvas cannot disagree), SpecPort (JSON
in/out, errors verbatim). All legacy encoding components are
deprecated shims scheduled for removal next major.

**Canvas.** CytoscapeCanvas applies the spec through element-data
patches (restyle-only: spec edits never re-run layout). Effect chain:
init, spec patch, instance-override bypass, position-pin lock, theme
restyle-in-place, overlay classes. One shared stylesheet assembly
orders precedence: structural defaults, spec attribute-mapper rules,
pin badge rule, compound-container rule, overlay rules, theme color
rules (generic selectors only, so the spec out-specifics them by
construction), then the user stylesheet. Compound containers (slice

1. derive parent assignments from a containment edge type; ELK with
   ports and compartments is roadmapped. Pinned nodes show a filled,
   theme-accent pin badge with a canvas-colored halo at fixed pixel
   size (container-safe), composed via stacked background images.

**Interaction.** GraphToolbar (search with camera centering, layout
switching with force controls, Shuffle as the randomized escape
hatch, Pin all, zoom, and a selection-aware Export popover);
per-node position pinning through usePositionPinStore with a
context-menu action; ContextMenuManager with host-registered
actions; selection and hover stores; style-override store (bypass
mechanism, deliberately shadows overlay borders).

**Algorithm story.** Doctrine: results, not computation. A versioned
interchange document (nodeProperties / edgeProperties / overlay)
carries results from networkx, GraphBLAS, or any engine
(roadmap/design/algorithm-overlays.md has worked exports).
Property-shaped results ingest into the UGM where the spec drives
channels from them (clustering is a driver, not a feature);
structure-shaped results are named overlays (independent toggles,
union membership, emphasize/dim via classes, exact restore).
AlgorithmPanel provides runners (deliberately trivial reference
built-ins), overlay toggles, and the ingest surface, and reports
written property keys so hosts can wire visible consequences.

**Workspaces.** WorkspaceSnapshot v1 (encoding spec, positions,
pins, theme id) with capture/apply/serialize/parse; apply order
encoded once; storage is deliberately the host's choice.

**Structural rendering (slice A1, round 31).** layoutStructural in
@g3t/core: compartmented containers (stereotyped headers, typed
compartments, rows as REAL elements with text/compartment/divider
passthroughs) and fixed-side boundary ports, laid out by ELK per the
spike-validated recipe and returned as a versioned StructuralGeometry
document of absolute boxes (renderer-neutral). Synthetic row-ordering
edges are filterable via isChainEdgeId. SLICE A2 (round 32): the
canvas renders the document via the `structural` prop (preset
layout, compound parents with header strips, selectable drag-locked
rows, decoration ports, port-routed edges; STRUCTURAL_RULES merge
class-scoped). UML custom views and the SHACL shape view's
compartment slice are the committed clients.

**Export (slice 1).** exportSubgraphTurtle/Json/Csv over the induced
subgraph of a selection (nodes, properties, inter-edges only;
provenance IRIs pass through to prov:wasDerivedFrom) plus 2x canvas
PNG, all reachable from the toolbar. Later slices: JSON-LD, SVG,
structured reports.

**Theming.** Three presets (light, dark, high-contrast) flow through
CSS variables AND the canvas (themeColorRules; restyle-in-place, so
positions hold through a switch). createTheme/contrastRatio support
custom themes; deriveCytoscapeStyle remains a host-facing export.

**Documentation and deployment.** GitHub Pages site
(.github/workflows/docs.yml, single docs:build assembly): landing
page, TypeDoc API reference (wiring guide rendered inside it),
Storybook, demo playground, and the visual-acceptance walkthrough.
typedoc validation (docs:check) is in the verify chain. The legacy
Sphinx skeleton in docs/source/ belongs to the old toolkit and is
flagged for next-major removal.

## Quality infrastructure

pnpm test (727), lint (eslint + react-compiler, warning budget),
typecheck, and pnpm verify (build, export/treeshake/smoke/type
checks, README-snippet compilation, typedoc validation, bundle
budget with a written ledger in scripts/check-bundle-size.mjs;
@g3t/react currently 278.7 of 280 KB). Spec gates:
scripts/lint_specs.py, scripts/sync_spec_status.py (status vs
citation drift; exits nonzero on drift), and
scripts/check_roadmap_coverage.py (every open requirement singly
owned; closed requirements must leave Owns headers and the
roadmap/CLAUDE.md index). pnpm run visual-acceptance builds the
living review page with live Cytoscape islands and a string-marker
self-check.

## Review state

Rounds 18 through 26 VERIFIED in the browser (user, 2026-06-12),
including the stacked-background pin badges that jsdom could not
confirm; the SVG-composition fallback is retired unneeded. Round-25
item 5 was an erroneous list continuation: closed. AWAITING REVIEW (a growing visual-acceptance backlog, all
desktop-only):
- VA-31 + minimap + demo view-switch (2026-06-22, headless-landed): (a) the
  structural edge-routing CONVERTER slice (the `curve-style: segments`
  projection above; VA-31 island packaged in outputs): edges should route
  around blocks, not behind, while declared-port edges still exit
  perpendicular; (b) the new Minimap component (Molecules/Minimap: a canvas
  overview with a draggable viewport rectangle, compound containers drawn as
  one rectangle rather than per-child, click/drag-to-pan) in the gallery and
  overlaid on the standalone demo in both views; (c) the standalone demo
  (`scripts/demo`) now carries a Graph/Structural view-switch with an ELK
  direction toggle. None of the three is headlessly verifiable: confirm
  rendering and interaction live.
- UNVERIFIED perf/warning fixes (2026-06-17): block-view lag and console
  floods were root-caused (via an instrumented build) to per-frame
  Cytoscape data-mapping warnings, not React. Landed and gate-green:
  type-filtering is a canvas `hidden` visibility op (restyle, not re-init)
  plus `animate={false}` on the demo canvases; `data(_size)` width/height
  scoped to `node[_size]`; `data(_confidence)` opacity scoped to
  `edge[_confidence]`; the inert `outline-offset: -2` removed from the
  selected structural-row rule. LIVE CHECK NEEDED: filter hides in place
  (no re-layout), force view immediately interactive, block-view console
  clean (no per-frame _size/_confidence warnings, no outline-offset
  warning). Deferred, needs sign-off: theme-driven border inset for the
  selected structural row (Round-43 intent, never rendered because
  Cytoscape rejects negative outline-offset); a stable scene-ref to drop
  the double structural re-init on block-view-on; routing the Cytoscape
  Core out of React state/props (GraphToolbar `cy` contract; profiling
  hygiene only). The block-view *freeze* (slow-load) fix this session is
  VERIFIED (Zach: load is fast).
- VA-29 (rounds 39-40): SHACL validation report over the DATA graph
  (R1.17, B1): all three severity tiers (violation/warning/info via
  sh:severity) as toggleable overlays, color from _shacl_maxSeverity
  and size from _shacl_resultCount through the encoding grammar.
  Round 40 also fixed multi-canvas overlay cross-dimming (global
  store) and added compartment-scoped right-click collapse to VA-27.
- VA-28 (rounds 37-38): the SHACL shape view via the compartment API
  («NodeShape» containers, "properties" rows, closed/open borders, a
  labeled reference edge, per-row badges).
- VA-27 (rounds 32-36): the structural view, ports, and collapse;
  the dagre verdict rides on it.
Bundles: @g3t/core 130 KB (129.3 used), @g3t/react 304 KB (302.4
used).

## Roadmap by functional group (reprioritized 2026-06-12)

Groups are sequenced by enablement, not by area age: the ELK
structural-rendering work lands FIRST because UML custom views and
the SHACL shape view are both clients of its compartment machinery
(build once, reuse twice). Within and across groups, order is
priority; no effort estimates.

**Group A: Structural rendering engine (ELK). IN PROGRESS (R1.18;
A1 geometry shipped round 31, A2 canvas application shipped round
32).** layoutStructural (core) produces the versioned
StructuralGeometry document; the canvas renders it via the
`structural` prop as a preset scene: compound containers with header
strips, SELECTABLE drag-locked compartment rows (id-matching wires
selection/inspector unmodified), decoration ports (promotable by
design), port-routed edges. VA-27 carries the live fixture and the
dagre verdict's visual surface. Design record:
roadmap/design/structural-rendering.md. Remaining: VA-27 review and
A3 polish from it, then the exit criterion (unchanged, REUSE-SHAPED):
the SHACL shape view consumes the compartment API unchanged.

**Group B: SHACL views (R1.16, R1.17), consuming Group A.**
Sequenced for early value with the reuse point explicit:
B1 (NO ELK dependency, can begin immediately): the validation-report
document contract, the adapter from the in-core validator, severity
tiers as structural overlays, counts and max severity as encoding
drivers. Almost entirely wiring of shipped machinery.
B2 (no ELK dependency): shape view slice 1 on CURRENT containers:
NodeShape containers, blank-node property shapes as child items with
path/type/cardinality summaries, reference and target edges,
closed/open border variants.
B3 (consumes Group A): property shapes graduate to compartment rows;
per-row result badges from loaded reports. This is the appropriate-
reuse milestone: SHACL renders through the same compartment API the
UML views use, zero parallel machinery.
B4: linked shape-and-data views (cross-highlighting, report
filtering), then logical-operator nesting with collapse.

**Group C: Provenance and virtualization affordances (R3.7,
rescoped).** Source-system indication on virtualized nodes plus
provenance (system, table, key) in inspector and tooltip. Reuses the
badge composition mechanism (pins) and the provenance passthrough
already in the Turtle exporter; thematically adjacent to B's
source-shape provenance display, so it follows B1 cheaply.

**Group D: Analyst workflow completion.** Temporal playback (R1.2,
R2.10) and the analytics panel (R1.8) close the in-progress views;
export later slices (R2.11: JSON-LD, SVG, structured reports) and
investigation bookmarks (R2.15, building on workspace snapshots)
complete the capture-investigate-report loop.

**Group E: Visualization algorithms.** Embeddings as layout
(property-shaped vectors feeding projection positioning) and overlay
set algebra if union semantics prove insufficient in review. Held
behind D because D's items are MUST/in-progress and these are SHOULD.

**Group F: Streaming visualization (R3.6 with R7.6).** The sliding-
window operational view; sequenced after D since it shares the
temporal machinery R1.2 builds.

**Group G: Platform and quality (continuous).** Documentation debt
(stories for EncodingSpecPanel tiers, SpecPort, workspace flows;
user handbook extraction after review settles; charts README parity;
Storybook publishing); Playwright canvas baselines (also pins the
round-24 growth trigger if it matters). These interleave with
feature groups rather than queueing behind them.

**Awaiting external input (not sequenced).** Holonic requirements
(R5.1, R5.6, R5.8) await community-group direction; the security
cluster (R8.x) awaits deployment posture; long tail: R2.16, R2.17,
R1.15, R7.11, R3.8 document linkage. Next-major cleanup (deprecated
encoding exports, Sphinx removal) executes at the version boundary.
