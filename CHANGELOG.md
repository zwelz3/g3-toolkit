# Changelog

All notable changes to the g3-toolkit are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0-rc] - 2026-05-24

### M14: Release Engineering

- Replaced mathjs (17.6 MB) with expr-eval (3 KB) in
  DerivedPropertyEngine. Bundle reduced 20%.
- Reclassified optional view dependencies (@tanstack/react-table,
  fuse.js, echarts-for-react) as optional peer deps.
- Added `sideEffects: ["*.css"]` for tree-shaking.
- Created per-package entry points (core-entry.ts, react-entry.ts,
  charts-entry.ts) and Vite build configs.
- Created per-package package.json in dist/ for npm publish.
- Added GitHub Actions CI (.github/workflows/ci.yml) and publish
  (.github/workflows/publish.yml) workflows.
- Added bundle analysis (rollup-plugin-visualizer) and
  treeshaking verification script.
- Annotated all 72/72 spec requirements in source code.

### F1-F8: Feature Enhancements

- F1: Animated layout transitions (animate, animationDuration props)
- F2: Adaptive/incremental layouts (computeIncrementalUpdate,
  lock existing nodes on small changes)
- F3: Node group collapsing (ComboManager, combo create/dissolve/
  collapse/expand/nest, Cytoscape compound nodes, serialization)
- F4: Annotations framework (AnnotationStore interface,
  localStorage default, AnnotationPanel component)
- F5: Node/edge property editor (PropertyEditor, inline editing,
  PropertyEditCallback for backend persistence)
- F6: Enhanced map view (edges between geo nodes, tile URL prop,
  TemporalSlider with play/pause/speed controls)
- F7: Link label styling (background, border, padding, radius
  via Cytoscape text-background properties)
- F8: Orthogonal edge routing (taxi curve-style, straight-triangle)
- LayoutManager: layout selection (7 layouts), force parameter
  tuning (repulsion, gravity, edge length), reset, freeze/unfreeze,
  animate toggle, edge style selector

## [0.13.0] - 2026-05-24

Four enhancement milestones completing the toolkit's analytical
and customization capabilities. (Previously this block was published
as a second [1.0.0-rc] section in CHANGELOG.md; corrected to its own
version as part of Phase 1 release-engineering hygiene.)

### M10.5: Integration Core

- **Middleware pattern (D6):** Composable request/response
  interceptors. Built-in: `bearerAuth()`, `apiKeyHeader()`,
  `retryOnError()`, `requestLogger()`.
- **RestAdapter (D6):** Generic REST/GraphQL with `mapResponse`
  function and middleware support.
- **GremlinAdapter (D6):** HTTP-based Gremlin adapter for
  Neptune, Cosmos DB, and JanusGraph.
- **Event bus (D6):** `G3tEventBus` typed pub/sub with 20 event
  types. Context action events for multi-view wiring.
- **Build pipeline:** Vite library mode producing ESM + CJS
  bundles with 88 TypeScript declaration files.
- **Adapter middleware:** SPARQL and Cypher adapters updated to
  accept `middleware` option.

### M11: Pipeline Infrastructure

- **DataPipeline interface (D6):** `query(ugm) -> ChartData` +
  `reverseMap(selection, data) -> nodeIds`. PipelineRegistry for
  named pipelines.
- **8 built-in pipelines:** countByType, countByProperty,
  degreeDistribution, edgeTypeBreakdown, propertyCorrelation
  (OLS trend via simple-statistics), centralityVsProperty,
  activityTimeline, communityBreakdown.
- **LinkedChart (D13):** React component wiring DataPipeline to
  ECharts. 5 chart types: bar, scatter+trend, line/area, pie,
  parallel coordinates. Bidirectional selection sync.
- **PropertyFilter (D6):** AND/OR filter groups with 8 operators
  (gt, gte, lt, lte, eq, neq, contains, exists). Nested groups.
- **ViewFilter (D6):** showOnlySelected, hideSelected,
  expandToNHops, subgraph pinning.
- **FilterBuilder (D13):** Visual filter builder UI.
- **Table enhancements:** Column visibility toggle, inline
  per-column property filters.

### M12: Customization & Filters

- **NodeStyleOverride (D6):** Per-node and per-type visual
  overrides (color, shape, size, icon, border, opacity).
  Cytoscape stylesheet merge with correct CSS specificity.
- **SVG icon library:** 20 built-in icons (person, building,
  globe, shield, server, etc.) as path data constants.
- **NodeStyleEditor (D13):** Color palette, shape selector,
  size slider, icon grid, scope toggle (this node / all of type).
- **Context-sensitive menus (D6):** TypeMenuProvider with
  per-type menu items. Default items for Person, Location, Event.
- **Bulk operations:** Multi-select context menu (color, pin,
  hide, show-only, view subgraph, find path). applyBulkStyle().

### M13: Advanced Features

- **PROV-O extraction (D6):** Maps prov:startedAtTime,
  prov:endedAtTime, etc. to toolkit temporal properties.
- **DerivedPropertyEngine (D6):** Safe expression evaluator
  (expr-eval). User-defined computed properties on nodes.
- **Subgraph pinning (D6):** Pinned nodes stay visible despite
  ViewFilter hide operations.
- **TemporalRangeFilter (D13):** Dual-handle time range slider.
- **DerivedPropertyPanel (D13):** Define/compute/remove UI.

### Toolkit Context Menu Actions

- **registerToolkitActions():** Single function registers 19
  context menu items (9 single-node, 3 single-edge, 7 multi-select).
- **buildNeighborhoodUGM():** Creates subgraph UGM for secondary
  canvas views.
- **Event-driven wiring:** Context actions emit events
  (context:viewNeighbors, context:findPath, etc.) for application
  to wire up secondary views.

### Documentation

- **ARCHITECTURE.md:** Toolkit boundary, package diagram, data
  flow, extension examples.
- **DEVELOPER.md:** D6/D13 rules, project structure, testing.
- **CLAUDE.md:** Agent handoff context.

### FOSS Dependencies Added

graphology-shortest-path, graphology-metrics,
graphology-communities-louvain, graphology-components,
crossfilter2, simple-statistics, expr-eval.

### Test Coverage

520 tests across 36 files, all passing.

## [0.8.5] - 2026-05-22

### M8.5: UX Surface & Theming

Vendor-quality visual controls, centralized theming, and interaction
affordances.

#### Added

- **ThemeManager:** Centralized theming via CSS custom properties
  (--g3t-*). Three presets: light, dark, high-contrast. Zustand
  store with setTheme(). Derived Cytoscape stylesheets and ECharts
  theme objects. All components read from CSS variables.

- **VisualEncodingManager (D6):** Maps UGM property keys to visual
  channels (nodeSize, nodeColor, edgeWidth, nodeLabel). Produces
  Cytoscape mapData() stylesheet entries. Type-based palette
  coloring. Property range auto-detection.

- **EncodingPanel:** React sidebar with dropdowns for each encoding
  channel. Includes label selector (M8.5.E4.T2).

- **CanvasLegend:** Auto-generated from active encoding. Type-color
  dots, size scale, edge line-style meanings.

- **HoverTooltip:** Positioned tooltip on node mouseover with label,
  type, and top 5 properties.

- **ZoomControls:** +, -, fit-to-screen button group.

- **Toolbar:** Mode buttons (select/pan), layout trigger, filter and
  encoding toggles, theme selector dropdown (light/dark/HC).

- **StatusBar:** Reactive node count, edge count, selection count,
  zoom level.

- **KeyboardShortcutModal:** "?" key opens reference with 12 shortcuts.

#### Test Coverage

- 372 tests across 27 files, all passing.

## [0.8.0] - 2026-05-22

### M8: Accessibility

WCAG 2.1 AA support with ARIA companion, keyboard navigation,
screen reader summaries, and high-contrast mode.

#### Added

- **AriaCompanion (R7.9, R7.10):** Hidden focusable node list
  mirroring the UGM. Degree-ordered tab sequence. Structured
  aria-labels ("Alice, Person, 5 connections: 3 to Person, 2 to
  Organization"). Keyboard edge traversal via arrow keys.

- **aria-live region (R7.10):** Polite announcements for context
  changes (selection, expansion, layout switches).

- **High-contrast mode (R7.12):** HighContrastConfig with WCAG AA
  defaults. Black on white (21:1 contrast ratio), 4px strokes.

- **Table fallback (R7.11):** Verified cross-view selection store
  ensures table always reflects current selection from any view.

#### Test Coverage

- 327 tests across 26 files, all passing.

## [0.7.0] - 2026-05-22

### M7: Charts & Enhancements + Gap Analysis

Sankey/chord and matrix views. Three critical gap-analysis additions:
path analysis, query editor, undo/redo.

#### Added

- **Shortest Path Analysis (R2.13):** BFS path finder between two
  nodes with edge type filter and maxHops constraint. Returns
  ordered node/edge IDs for canvas highlighting.

- **Query Editor (R1.13):** SPARQL/Cypher/GQL text input with
  execute button, Ctrl+Enter shortcut, error display, and adapter
  integration.

- **Undo/Redo Stack (R2.14):** UGM snapshot stack with configurable
  depth. Redo cleared on new action. Framework-agnostic.

- **SankeyView (R1.9):** ECharts Sankey + chord mode toggle.
  Aggregates edge counts between node types.

- **MatrixView (R1.4):** Adjacency heatmap by node type. Color-
  scaled cells with click-to-select. maxSize limit (R7.3).

#### Spec Additions

- R2.13 (path analysis), R2.14 (undo/redo), R2.15 (bookmarks),
  R1.13 (query editor), R1.14 (community overlay) added to spec.
- Gap analysis document: `planning/enhancement-plan.md`.

#### Test Coverage

- 314 tests across 25 files, all passing.

## [0.6.0] - 2026-05-22

### M6: Workspace & Schema

Multi-view workspace composition, schema visualization with SHACL
overlay, graph diff engine, and ontology version tracking.

#### Added

- **WorkspaceShell (FlexLayout):** Tabbed/split-pane workspace host.
  ViewFactory pattern. Role-based defaults (analyst, engineer).

- **Save/Load:** Workspace state serialized to JSON including
  FlexLayout model and schema hash. Round-trip verified.

- **SchemaView:** Class hierarchy from UGM registry or SchemaModel.
  SHACL shape badges on target classes with constraint counts.

- **DiffRenderer:** Color-coded diff visualization (green=added,
  red=removed, amber=changed). Property-level change display.

- **Graph Diff Engine:** diffGraphs() compares nodes, edges, and
  properties. computeSchemaHash() for version tracking.

#### Test Coverage

- 290 tests across 23 files, all passing.

## [0.5.0] - 2026-05-22

### M5: Secondary Views

Timeline, map, statistics, and tree views implemented with
cross-view selection linking.

#### Added

- **TimelineView (vis-timeline):** Renders temporal nodes. Brush
  selection filters by time range and writes to selection store.

- **MapView (SVG equirectangular):** Renders geo-located nodes as
  markers. Click-to-select and pan-to-selected via useMemo viewBox.

- **StatsPanel (ECharts):** Histogram of numeric property values
  with brush-to-select for highlighting matching nodes.

- **TreeView:** Lazy-load containment hierarchy with configurable
  initial depth, expand/collapse, breadcrumb trail, and working-set
  limit enforcement. BFS cycle handling.

#### Test Coverage

- 290 tests across 23 files, all passing.

## [0.4.0] - 2026-05-22

### M4: Projection Pipeline

RDF data projected to UGM through configurable collapse transforms.
Pre-extraction architecture ensures types and properties are always
preserved regardless of which collapses are enabled.

### Testing Infrastructure (D14)

Four-layer testing strategy adopted: Vitest unit, RTL component,
Playwright visual regression, Robot Framework acceptance.

#### Added

- **Shared test harness:** `/?test-harness` URL activates a
  deterministic rendering of all components (20 nodes, 30 edges,
  3 types) for screenshot-stable testing.

- **Playwright e2e tests:** 3 spec files (canvas, selection, sidebar)
  with `toHaveScreenshot()` visual regression baselines. Consistent
  1280x800 viewport, single worker, 1% pixel tolerance.

- **Robot Framework acceptance tests:** 2 suites (M0 foundation,
  M1 interaction) with keyword-driven tests tagged by requirement
  ID (R1.1, R2.5, D3, etc.). HTML reports with embedded screenshots.

- **CI pipeline updated:** Robot Framework steps added alongside
  Playwright. Test artifacts (screenshots, reports) uploaded on
  all runs.

#### Added

- **ProjectionPipeline:** Ordered sequence of collapse steps with
  pre-extraction of types and properties from the full RDF graph.
  Steps can be enabled/disabled by name.

- **5 Collapse Transforms:** Type (rdf:type → types array), Literal
  (datatype triples → properties), Blank-Node (inline as nested
  objects), List (rdf:first/rest → arrays), Reification (rdf:Statement
  metadata → edge annotations).

- **3 Presets:** Standard (all on), Ontology (type edges visible),
  Provenance-Preserving (reification nodes visible).

- **ViewRouter Gate:** checkRenderPermission() blocks raw RDF from
  renderers; schema and inspector views exempt (R4.6).

- **Holonic Compatibility:** Pipeline satisfies HolonicProjectionPipeline
  interface via structural typing.

#### Architecture

- Pre-extraction runs BEFORE collapse steps to avoid ordering
  dependency between literalCollapse and structural collapses.
- literalCollapse preserves blank-node-subject literals so BNode,
  List, and Reification collapses can still read them.
- localPart() handles IRIs, CURIEs, and plain strings.

#### Test Coverage

- 290 tests across 23 files, all passing.

## [0.3.0] - 2026-05-22

### M3: Data Adapters & Integration

Toolkit connects to external graph data sources. SPARQL, Cypher,
and Holonic adapters populate the UGM. Algorithm results and
relational data merge as supplementary properties. D6 module
boundary verified.

#### Added

- **GraphAdapter interface:** query(), expandNeighborhood(),
  getSchema(), getNodeProperties().
- **SparqlAdapter:** SPARQL SELECT/CONSTRUCT via HTTP.
- **CypherAdapter:** Neo4j HTTP transaction API with graph results.
- **HolonicAdapter:** P6 four-graph model; projectToLPG() for
  holarchy visualization; portal right-click menu items.
- **AlgorithmResultAdapter:** ingestAlgorithmResults() merges
  algorithm output (PageRank, community ID) into UGM nodes.
- **RelationalVirtualizer:** Tabular data merge by shared key.
  parseCSV() with quoted field support.
- **D6 Module Boundary Test:** All core modules import without React.

#### Test Coverage

- 230 tests across 20 files, all passing.

## [0.2.0] - 2026-05-22

### M2: Layout Engines

Four pluggable layout engines with a common interface, layout
switcher UI, and pin/unpin state management.

#### Added

- **LayoutEngine interface:** `compute(ugm, options) → Promise<LayoutResult>`.
  All engines are async, stateless, and honor pinned node positions.

- **ForceLayout (d3-force):** Force-directed with configurable tick
  count. Uses forceManyBody, forceCenter, forceCollide. Pinned via
  fx/fy constraints.

- **HierarchyLayout (d3-hierarchy):** Tree/cluster layout with auto
  root detection and BFS cycle handling. Orphan nodes placed separately.

- **DagreLayout (@dagrejs/dagre):** DAG layout with configurable
  direction (TB/LR/BT/RL). 50-node DAG in <100ms.

- **ElkLayout (elkjs):** Layered hierarchical layout via async ELK
  computation. Handles 200-node DAGs.

- **LayoutSwitcher:** React component rendering engine selection
  buttons with active highlight.

- **usePinState:** React hook managing pinned node positions with
  pin/unpin/isPinned API.

#### Test Coverage

- 230 tests across 20 files, all passing.

## [0.1.0] - 2026-05-22

### M1: Interaction & Selection

Cross-view selection model proven: canvas and table are linked
through a shared Zustand store. Core interaction primitives
(expand, filter, search, tag, group) implemented.

#### Added

- **Selection Store (Zustand):** Shared selection state with
  selectNodes, selectEdges, addToSelection, clearSelection, setHover.
  All views read/write the same store. Redux DevTools support.

- **Table View (TanStack Table):** Dynamic columns from UGM
  property-key registry. Sortable headers, pagination. Click-to-select
  syncs with canvas. Right-click shows same context menu as canvas
  (R2.1 universality).

- **N-Degree Neighbor Expansion:** BFS at configurable depth.
  Returns discovered IDs with working-set limit check. Framework-
  agnostic; ready for adapter integration in M3.

- **Faceted Filter:** Checkbox toggle per node type with color
  swatches and counts. Reports hidden types set for canvas filtering.

- **Full-Text Search:** Case-insensitive substring matching across
  node labels. Reports matching/non-matching ID sets for canvas
  highlight/dim.

- **Tag Manager:** User-defined labels persisted as UGM node
  properties. Survives serialization round-trip. Query by tag.

- **Grouping Manager:** Compound node creation with expand/collapse
  state tracking. Children get `_parent` reference; group nodes
  get `_isGroup` flag.

- **Working-Set Manager:** Per-view-type element limits (canvas 500,
  table 10k, tree 1k, matrix 200, sankey 100, streaming 500).
  Admin override. Constructor accepts initial overrides.

- **Multi-Select:** Shift-click accumulates selection. Lasso
  (box selection) enabled; boxend event syncs to store.

#### Test Coverage

- 165 tests across 16 files, all passing.

## [0.0.1] - 2026-05-20

### M0: Foundation

First milestone complete. Proves the data-to-rendering pipeline:
UGM (Graphology) → Cytoscape.js canvas with right-click context
menu and detail inspector.

#### Added

- **Unified Graph Model (UGM):** Graphology MultiGraph wrapper with
  typed nodes (multi-label), Qualified Edge model (confidence,
  provenance, temporal, asserted), event bus (7 event types with
  unsubscribe), and JSON serialization/deserialization.

- **Cytoscape Canvas:** React wrapper component accepting UGM as
  prop. Okabe-Ito colorblind-safe palette (8 colors × 8 shapes).
  Node encoding: type → color+shape, name → label, size → diameter.
  Edge encoding: type → label, confidence → opacity, asserted/inferred
  → solid/dashed (D9). fcose layout registered.

- **Context Menu:** Framework-agnostic ContextMenuManager with
  plugin extension API. Default items: "Inspect properties" and
  "Copy IRI" (filtered by target type). React ContextMenu component
  with positioned rendering, click-outside close, Escape close.

- **Detail Inspector:** Property panel rendering node types,
  properties (with nested object expansion), and Qualified Edge
  metadata (confidence, provenance, temporal, asserted). Updates
  on selection change.

- **Build Tooling:** Vite 8, TypeScript 6 (strict), Vitest 4,
  Playwright, ESLint 10 (flat config), Prettier. Path aliases
  (@core, @views, @state, @interaction, @a11y). CI pipeline
  (GitHub Actions).

#### Performance

- 500 nodes + 2,000 edges: 305ms initialization (headless).
  Go/no-go gate passed; no Sigma.js pivot needed.

#### Architecture

- `src/core/` has zero React imports (D6 verified).
- `src/views/` uses React (D13).
- Module boundary enforced by convention; build-time test
  scheduled for M3.E4.T1.

#### Test Coverage

- 90 tests across 9 files, all passing.
- Layers: Vitest unit (core logic), RTL component (React views),
  Playwright e2e (stub; full visual tests require browser install).
