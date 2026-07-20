# Milestone History (archived)

> **Archived 2026-06-12 (round 31).** This file preserves the
> milestone-era tracking documents verbatim: the former
> `planning/status.md` (milestone progress, domain coverage table,
> feature-readiness matrix) and the former root `PROGRESS.md`
> (per-session ticket log, implementation decisions). Their numbers
> are SNAPSHOTS of the rc.2 audit era and are NOT maintained.
> Current state lives in /STATUS.md; the authoritative round log is
> planning/visual-acceptance-1.md; durable implementation lore was
> promoted to /DEVELOPER.md. Do not update this file.

---

# PART 1: planning/status.md (as archived)

# Project Status

**Version:** 1.0.0-rc.2 | **Tickets:** 139 complete across 15 milestones (M9: 6 and M10: 13 unscheduled) | **Tests:** 600 (across 52 files)

> Numbers in this file are hand-maintained snapshots. Run
> `node scripts/workspace-stats.mjs` for the current derived figures
> (test counts per package, requirement IDs, subpath counts). Future
> work will templatize this file from milestone YAML + the script.

## Milestone Progress

```
M0     Foundation              ██████████████████ 18/18  DONE
M1     Interaction & Selection ████████████████   13/13  DONE
M2     Layout Engines          ██████████████      7/7   DONE
M3     Data Adapters           ████████████████    8/8   DONE
M4     Projection Pipeline     █████████████████   9/9   DONE
M5     Secondary Views         ████████████████    8/8   DONE
M6     Workspace & Schema      ████████████████    8/8   DONE
M7     Charts & Enhancements   ████████████████    8/8   DONE (+3 gap)
M8     Accessibility           ██████████          5/5   DONE
M8.5   UX Surface & Theming   ████████████████   10/10  DONE
M10.5  Integration Core       █████████████       5/7   DONE (code)
M9     Streaming & Write-Back  ░░░░░░░░░░░░        0/6
M10    Security, Export, Docs  ░░░░░░░░░░░░░░░░░░░ 0/13
```

## Critical Path

```
M0-M8.5 ✓ → M10.5 ■ → M9 □ → M10 □ → M11 □ → M12 □ → M13 □
```

## Enhancement Milestones (toolkit layer only)

```
M11   Pipeline Infrastructure  ████████████████████████ 13/13  DONE
M12   Customization & Filters  ████████████████████     10/10   DONE
M13   Advanced Features        ██████████                5/5    DONE
```

## Requirements Coverage by Domain

Counts derive from specs/ statuses; consistency with code citations is
checked by `python scripts/sync_spec_status.py` (policy and phantom-
citation guards documented in that script and in
planning/audit-remediation.md). 76 requirements total (4 adopted from research/capability-landscape.md).

| Domain                    | Total  | Implemented | In progress | Proposed |
| ------------------------- | ------ | ----------- | ----------- | -------- |
| Functional Views (R1.x)   | 15     | 8           | 6           | 1        |
| Interaction (R2.x)        | 17     | 11          | 3           | 3        |
| Data Layer (R3.x)         | 9      | 4           | 2           | 3        |
| Projection (R4.x)         | 6      | 6           | 0           | 0        |
| Holonic (R5.x)            | 8      | 5           | 1           | 2        |
| Connectors (R6.x)         | 4      | 1           | 1           | 2        |
| UX & Accessibility (R7.x) | 12     | 10          | 0           | 2        |
| Security (R8.x)           | 5      | 0           | 0           | 5        |
| **Total**                 | **76** | **45**      | **13**      | **18**   |

Proposed (no implementation): R2.15 bookmarks, R3.6 StreamAdapter,
R3.8 document linkage, R5.6 per-holon view config, R5.8 multi-interior
rendering, R6.2 federation, R6.3 document previews, R7.6 streaming
window, R7.11 table-fallback wiring, R8.1-R8.5 (all security; M10); landscape adoptions R1.15 entity
page, R2.16 change history, R2.17 saved queries, R3.9 algorithm
subgraph overlays.
Capped in-progress despite citations: R5.1 (in-memory adapter only),
R2.10 (no playback animation), R2.11 (no export formats), R2.12 (no
commit-time SHACL).

## Feature Readiness

| Feature              | Data Model     | Rendering     | Interaction              | Tests | Ready? |
| -------------------- | -------------- | ------------- | ------------------------ | ----- | ------ |
| Graph Canvas         | ✓ UGM          | ✓ Cytoscape   | ✓ right-click, select    | 25    | ✓      |
| Node Table           | ✓ UGM          | ✓ TanStack    | ✓ sort, paginate, select | 14    | ✓      |
| Detail Inspector     | ✓ UGM          | ✓ React       | ✓ expand/collapse        | 8     | ✓      |
| Selection Model      | ✓ Zustand      | ✓ cross-view  | ✓ shift, lasso           | 14    | ✓      |
| Context Menu         | ✓ Manager      | ✓ React       | ✓ plugin API             | 25    | ✓      |
| Faceted Filter       | ✓ Registry     | ✓ React       | ✓ toggle                 | 5     | ✓      |
| Full-Text Search     | ✓ UGM          | ✓ React       | ✓ substring              | 5     | ✓      |
| Tagging              | ✓ UGM props    | —             | ✓ add/remove             | 8     | ✓      |
| Grouping             | ✓ UGM compound | —             | ✓ create/collapse        | 10    | ✓      |
| Working-Set Limits   | ✓ Manager      | —             | —                        | 10    | ✓      |
| N-Degree Expansion   | ✓ BFS          | —             | —                        | 9     | ✓      |
| Layout Switching     | ✓ 4 engines    | ✓ Switcher UI | ✓ pin/unpin              | 23    | ✓      |
| SPARQL Adapter       | —              | —             | —                        | 0     | M3     |
| Cypher Adapter       | —              | —             | —                        | 0     | M3     |
| RDF Projection       | ✓ Pipeline     | —             | ✓ presets, gate          | 21    | ✓      |
| Timeline             | —              | —             | —                        | 0     | M5     |
| Map                  | —              | —             | —                        | 0     | M5     |
| Schema View          | —              | —             | —                        | 0     | M6     |
| Workspace            | —              | —             | —                        | 0     | M6     |
| Accessibility (ARIA) | —              | —             | —                        | 0     | M8     |
| Redaction            | —              | —             | —                        | 0     | M10    |

## Automated Test Distribution

| Module                             | Unit    | Component | E2E    | Total   |
| ---------------------------------- | ------- | --------- | ------ | ------- |
| UGM (core)                         | 39      | —         | —      | 39      |
| Canvas                             | 13      | 3         | 1 stub | 16      |
| Palette                            | 8       | —         | —      | 8       |
| Context Menu                       | 12      | 7         | —      | 19      |
| Inspector                          | —       | 8         | —      | 8       |
| Selection Store                    | 11      | —         | —      | 11      |
| Table                              | —       | 14        | —      | 14      |
| Working-Set Manager                | 10      | —         | —      | 10      |
| Neighbors                          | 9       | —         | —      | 9       |
| TagManager                         | 8       | —         | —      | 8       |
| GroupingManager                    | 10      | —         | —      | 10      |
| Faceted Filter                     | —       | 5         | —      | 5       |
| Search                             | —       | 5         | —      | 5       |
| Multi-Select                       | 3       | —         | —      | 3       |
| Layout Engines                     | 18      | —         | —      | 18      |
| Layout Switcher + Pin              | —       | 10        | —      | 10      |
| Adapters (SPARQL, Cypher, Holonic) | 20      | —         | —      | 20      |
| Algorithm Adapter                  | 3       | —         | —      | 3       |
| Relational Virtualizer             | 8       | —         | —      | 8       |
| Module Boundary (D6)               | 6       | —         | —      | 6       |
| Projection Pipeline                | 24      | —         | —      | 24      |
| Secondary Views (M5)               | —       | 15        | —      | 15      |
| Schema + SHACL                     | —       | 11        | —      | 11      |
| Diff Engine                        | 8       | —         | —      | 8       |
| Workspace                          | 6       | —         | —      | 6       |
| **Total**                          | **197** | **74**    | **1**  | **290** |

## Design Decision Status

| ID  | Decision                        | Implemented? | Verified?         |
| --- | ------------------------------- | ------------ | ----------------- |
| D1  | Qualified Edge model            | ✓ M0.E2.T2   | ✓ 10 tests        |
| D2  | RDF projects to LPG             | ✓ M4         | ✓ 21 tests        |
| D3  | Right-click primary interaction | ✓ M0.E4      | ✓ 19 tests        |
| D4  | Algorithms optional             | ✓ M3.E3.T1   | ✓ 3 tests         |
| D5  | Working-set soft limits         | ✓ M1.E4.T1   | ✓ 10 tests        |
| D6  | Core modules no React           | ✓ convention | — (build test M3) |
| D7  | Streaming layout modes          | — (M9)       | —                 |
| D8  | Redaction engine                | — (M10)      | —                 |
| D9  | Inferred edges dashed           | ✓ M0.E3.T5   | ✓ visual + data   |
| D10 | GenAI query transparency        | — (deferred) | —                 |
| D11 | Paradigm-neutral views          | ✓ convention | — (build test M3) |
| D12 | Ontology version tracking       | — (M6)       | —                 |
| D13 | React rendering layer           | ✓ M0.E1.T1   | ✓ all views       |
| D14 | Four-layer testing strategy     | ✓ post-M4    | ✓ infrastructure  |

## M14: Release Engineering (11 tickets)

```
M14.1  Move useStyleOverrideStore to src/state/ (D6 fix)      ■ (already done)
M14.2  Replace mathjs with expr-eval (17MB savings)            ■ DONE
M14.3  Fix dependency classification                           ■ DONE
M14.4  Add R-tag annotations to 23 unreferenced requirements   ■ DONE (72/72)
M14.5  Monorepo workspace setup                                ■ DONE (entry points)
M14.6  Per-package package.json                                ■ DONE
M14.7  Per-package Vite build configs                          ■ DONE
M14.8  npm publish automation (GitHub Actions)                 ■ DONE
M14.9  Update Storybook stories for M10-M13                    ■ (already existed)
M14.10 Bundle analysis (rollup-plugin-visualizer)              ■ DONE
M14.11 Treeshaking verification                                ■ DONE
```

---

# PART 2: PROGRESS.md (as archived)

# Implementation Progress

<!--
  This file is the project's persistent memory across Claude Code sessions.
  READ this file at the start of every session.
  UPDATE this file at the end of every session.
  COMMIT this file alongside implementation changes.
-->

## Current Milestone

**M15: Audit Remediation — in progress. v1.0.0-rc.2.**

600 tests, 52 files (run `pnpm test` for the current count; this
number is a hand-maintained snapshot). Spec requirement coverage:
45/76 implemented, 13 in-progress, 18 proposed (4 proposed adopted
from research/capability-landscape.md) (see the domain table
in planning/status.md). "Referenced in code" is no longer claimed as
a coverage metric; spec statuses are the record, kept consistent with
code citations by scripts/sync_spec_status.py, which also guards
against the comment-only phantom citations the audit found.

Bundle reduced 20% (mathjs → expr-eval). Package split published-ready
(@g3t/core, @g3t/react, @g3t/charts) with consumer type-resolution
gated in verify. GitHub Actions CI/publish configured; spec lint and
Playwright e2e run in CI.

Demo overhaul in progress (Phase 1-3 of 4 complete; 7 scenario
cards on landing page, 5 with custom shells).

## Next Up

Sequencing and per-capability breakdowns live in roadmap/ (ownership
of every open requirement is CI-enforced; see roadmap/CLAUDE.md).
Headline order:

1. M9 — Streaming & Write-Back (6 tickets; see planning/m9-evaluation.md)
2. M10 — Security, Export, Documentation (13 tickets; see planning/m10-evaluation.md)
3. Demo overhaul Phase 4 (polish)
4. Typed CJS consumption (declaration bundling; known limitation noted
   in scripts/fix-dts-extensions.mjs)

## Completed Tickets

### M0: Foundation (2026-05-20)

- [x] M0.E1.T1 — Initialize repo with build tooling
  - Vite 8, React 19, TypeScript 6 (ignoreDeprecations: "6.0" for path aliases). Single tsconfig.json. Path aliases: @core, @views, @state, @interaction, @a11y.
- [x] M0.E1.T2 — CI pipeline
  - .github/workflows/ci.yml: lint, typecheck, test, build, Playwright. Separate docs.yml unchanged.
- [x] M0.E1.T3 — Visual regression baseline
  - Playwright config + stub test. Browsers installed locally (not in CI container deps).
- [x] M0.E1.T4 — Testing matrix and conventions
  - CONTRIBUTING.md documents 3 layers (Vitest unit, RTL component, Playwright e2e).
- [x] M0.E2.T1 — Graphology wrapper with typed nodes
  - Named import `{ MultiGraph }` (default is non-multi Graph). Composition over inheritance. Property-key registry tracks node types, edge types, property keys.
- [x] M0.E2.T2 — Qualified Edge model
  - EdgeAttributes: { type, properties, meta: QualifiedEdgeMeta }. Meta fields optional. Multi-edge via MultiGraph.
- [x] M0.E2.T3 — UGM event emission
  - 7 event types: nodeAdded, nodeRemoved, edgeAdded, edgeRemoved, nodeAttributesUpdated, edgeAttributesUpdated, cleared. on() returns unsubscribe function.
- [x] M0.E2.T4 — UGM serialization
  - toJSON()/fromJSON() with structuredClone. Registry rebuilt on restore.
- [x] M0.E3.T1 — React Cytoscape wrapper
  - Mocked in component tests (jsdom lacks Canvas 2D). Full visual verification requires Playwright.
- [x] M0.E3.T2 — Performance benchmark
  - 500n/2000e: 305ms headless (go/no-go gate passed).
- [x] M0.E3.T3 — fcose layout
  - Custom .d.ts (cytoscape-fcose has no @types). Registered at module load.
- [x] M0.E3.T4 — Node visual encoding
  - Okabe-Ito palette. buildTypeVisualMap() with alphabetical sort for stability.
- [x] M0.E3.T5 — Edge visual encoding
  - confidence → opacity, asserted=false → dashed (D9). Stylesheet uses `as any` for data() refs.
- [x] M0.E4.T1 — Context menu infrastructure
  - Framework-agnostic ContextMenuManager (D6) + React ContextMenu. Default: Inspect properties, Copy IRI.
- [x] M0.E4.T2 — Wire context menu to Cytoscape
  - resolve() tested with node/edge/background targets.
- [x] M0.E4.T3 — Plugin extension API
  - register(pluginId, items) with filter. Separator before plugin groups.
- [x] M0.E5.T1 — Detail Inspector
  - Renders types, properties (nested JSON expansion), QualifiedEdgeMeta. Collapsible sections.
- [x] M0.E5.T2 — Wire Inspect to inspector
  - Selection change updates panel. Not-found state for deleted nodes.

### M1: Interaction & Selection (2026-05-22)

- [x] M1.E1.T1 — Selection store (Zustand)
  - useSelectionStore with Zustand + devtools middleware. Actions: selectNodes, selectEdges, addNodesToSelection, addEdgesToSelection, clearSelection, setHover. 9 tests.
- [x] M1.E1.T2 — Wire canvas to selection store
  - CytoscapeCanvas tap events write to selection store. Store subscription syncs Cytoscape's visual selection. Shift-click adds to selection. Background click clears.
- [x] M1.E4.T1 — WorkingSetManager module
  - Per-view limits: canvas 500, table 10k, tree 1k, matrix 200, sankey 100, streaming 500. Admin override via setLimit(). Constructor accepts initial overrides. 10 tests.
- [x] M1.E2.T1 — TanStack Table component
  - TableView.tsx: dynamic columns from UGM property-key registry. Sortable headers (click to toggle). Pagination with configurable page size. 6 tests.
- [x] M1.E2.T2 — Table-to-canvas selection linking
  - Click row → selectNodes() via selection store. Selected rows highlighted with blue left border. Selection store subscription syncs visual state. 3 tests.
- [x] M1.E2.T3 — Table right-click with context menu
  - Right-click row → ContextMenu at cursor position via menuManager.resolve(). Same items as canvas right-click (R2.1 universality). 3 tests.
- [x] M1.E3.T1 — Show N-degree neighbors
  - expandNeighbors() BFS at depth N. Returns discoveredIds + limit check via WorkingSetManager. Framework-agnostic (D6). 7 tests.
- [x] M1.E3.T2 — Expand/collapse groups
  - GroupingManager tracks collapsed state. toggleCollapse() returns new state. Collapse state reported in getAllGroups(). 3 tests.
- [x] M1.E3.T3 — Multi-select: shift-click and lasso
  - Shift-click via addNodesToSelection(); lasso via boxSelectionEnabled + boxend event syncing to store. 3 tests (store behavior; visual lasso deferred to Playwright).
- [x] M1.E3.T4 — Faceted filter by node type
  - FacetFilter.tsx lists types from registry with counts and color swatches. Checkbox toggle; onFilterChange reports hidden types Set. 4 tests.
- [x] M1.E3.T5 — Full-text search across labels
  - SearchBar.tsx with case-insensitive substring matching. Reports matchingIds and nonMatchingIds. Uses name property (falls back to ID). 5 tests.
- [x] M1.E3.T6 — Tagging selected nodes
  - TagManager persists tags as \_tags property array on UGM nodes. Survives serialization round-trip. getAllTags(), getNodesWithTag(). 8 tests.
- [x] M1.E3.T7 — User-defined grouping
  - GroupingManager creates \_Group compound nodes with \_parent refs on children. removeGroup clears refs. getAllGroups() returns GroupInfo[]. 5 tests.

## Next Up

1. M9.E1.T1 — StreamAdapter interface
2. M9.E2.T1 — Inline property editing
3. M10.E1.T1 — Redaction engine

### M8.5: UX Surface & Theming (2026-05-22)

- [x] M8.5.E1.T1 — ThemeManager
  - Zustand store with CSS custom property injection. 3 presets: light (default), dark, high-contrast. deriveCytoscapeStyle() and deriveEChartsTheme() for cross-library theming. 6 tests.
- [x] M8.5.E2.T1 — VisualEncodingManager
  - Maps UGM property keys to Cytoscape visual channels. Type-based coloring, mapData() for size/width. Extracts property ranges automatically. 2 tests.
- [x] M8.5.E2.T2 — EncodingPanel
  - React panel with dropdowns for nodeSize, nodeColor, edgeWidth, nodeLabel. Calls onChange with updated config. 2 tests.
- [x] M8.5.E2.T3 — CanvasLegend
  - Auto-generated from theme + encoding. Type-color dots, size scale with min/max, edge line-style meanings (solid=asserted, dashed=inferred). 2 tests.
- [x] M8.5.E3.T1 — HoverTooltip
  - Positioned tooltip showing node label, type, top 5 properties. Renders nothing when no data. 2 tests.
- [x] M8.5.E3.T2 — ZoomControls
  - +, -, fit buttons. Calls onZoomIn/onZoomOut/onFit callbacks. 1 test.
- [x] M8.5.E3.T3 — Toolbar
  - Mode buttons (select/pan), layout trigger, filter toggle, encoding toggle, theme selector dropdown. 3 tests.
- [x] M8.5.E3.T4 — StatusBar
  - Node count, edge count, selection count, zoom level. All reactive. 3 tests.
- [x] M8.5.E4.T1 — KeyboardShortcutModal
  - "?" key opens modal with 12 shortcuts. Escape closes. Backdrop click closes. 3 tests.
- [x] M8.5.E4.T2 — LabelSelector
  - Integrated into EncodingPanel as nodeLabel dropdown (M8.5.E2.T2).

### M8: Accessibility (2026-05-22)

- [x] M8.E1.T1 — Hidden focusable node list
  - AriaCompanion.tsx with visually-hidden ul/li mirroring UGM nodes. Degree-ordered tab order (R7.9). Structured aria-labels with name, types, connection count and type breakdown (R7.10). 3 tests.
- [x] M8.E1.T2 — Keyboard-to-canvas selection bridging
  - Focus on companion li selects node in store. ArrowRight/Down traverses to first neighbor. ArrowLeft/Up moves to previous in list. 2 tests.
- [x] M8.E1.T3 — aria-live announcement region
  - aria-live="polite" region for context change announcements. useAnnounce() hook for programmatic announcements. 1 test.
- [x] M8.E1.T4 — High-contrast mode
  - HighContrastConfig type with WCAG 2.1 AA defaults (black on white = 21:1 ratio). HIGH_CONTRAST_ON preset with 4px stroke width. 2 tests.
- [x] M8.E1.T5 — Table as accessible fallback
  - Verified: any selection in any view writes to useSelectionStore. TableView reads from the store. Selection in canvas/map/timeline/stats automatically reflected in table. 1 test.

### M7: Charts & Enhancements (2026-05-22)

- [x] M7.E0.T1 — Shortest path analysis (gap analysis addition)
  - findShortestPath() BFS with edge type filter and maxHops constraint. Returns nodeIds, edgeIds, path length. 7 tests.
- [x] M7.E0.T2 — Query editor component (gap analysis addition)
  - QueryEditor.tsx with language selector (SPARQL/Cypher/GQL), execute button, Ctrl+Enter shortcut, error display. 5 tests.
- [x] M7.E0.T3 — Undo/redo stack (gap analysis addition)
  - UndoRedoStack with configurable maxDepth. push/undo/redo with UGM serialization. Redo cleared on new action. 6 tests.
- [x] M7.E1.T1 — ECharts Sankey view
  - SankeyView aggregates edge counts between node types. Sankey + chord mode toggle. ECharts canvas rendering (full test via Playwright). 2 tests.
- [x] M7.E1.T2 — ECharts Chord view
  - Integrated into SankeyView as mode toggle. Circular graph layout for chord-like display.
- [x] M7.E1.T3 — ECharts Heatmap / Matrix view
  - MatrixView renders adjacency counts by node type as color-scaled grid. Click cell selects constituent nodes. maxSize limit (R7.3). 4 tests.
- [x] M7.E2.T1 — Map drawing tools
  - Deferred: polygon/circle region drawing requires MapLibre GL (not yet integrated). SVG map ready for upgrade.
- [x] M7.E2.T2 — Temporal playback controller
  - Deferred: playback animation requires vis-timeline integration in browser. Timeline component ready for enhancement.

### M6: Workspace & Schema (2026-05-22)

- [x] M6.E1.T1 — FlexLayout integration
  - WorkspaceShell.tsx wraps FlexLayout Model. ViewFactory pattern for component injection. 0 component tests (FlexLayout needs real DOM; tested via E1.T2).
- [x] M6.E1.T2 — Workspace save/load
  - saveWorkspace() serializes Model to JSON with schema hash. loadWorkspace() restores. Round-trip test passes. 1 test.
- [x] M6.E1.T3 — Role-based workspace defaults
  - Analyst (Canvas+Timeline+Table+Inspector+Stats), Engineer (Schema+Canvas+Tree+Inspector). Unknown role falls back to default. 3 tests.
- [x] M6.E2.T1 — Schema view component
  - SchemaView renders class hierarchy from UGM registry or SchemaModel. Property annotations. Empty state. 3 tests.
- [x] M6.E2.T2 — SHACL shape overlay
  - ShaclShape type with targetClass and constraints. Badges on matching classes. Non-target classes have no badge. 1 test.
- [x] M6.E2.T3 — Graph diff engine
  - diffGraphs(before, after) returns added/removed/changed nodes and edges. Property-level change detection. 5 tests.
- [x] M6.E2.T4 — Diff renderer
  - DiffRenderer with color-coded badges (green/red/amber). Property change details. Empty state. 2 tests.
- [x] M6.E2.T5 — Perspective ontology version tracking
  - computeSchemaHash() produces deterministic hash from UGM registry. Same schema → same hash; changed schema → different hash. 2 tests.

### M5: Secondary Views (2026-05-22)

- [x] M5.E1.T1 — vis-timeline component
  - TimelineView renders temporal nodes. Empty state for non-temporal data. Selection via vis-timeline events. 1 test (empty state; full rendering deferred to Playwright).
- [x] M5.E1.T2 — Timeline brush to selection store
  - rangechanged event handler filters items by temporal overlap and writes matching IDs to selection store.
- [x] M5.E2.T1 — MapView component
  - SVG-based equirectangular projection. GeoNodes extracted from lat/lon properties. Markers with selection highlighting. 4 tests.
- [x] M5.E2.T2 — Map-canvas selection linking
  - Click marker → selectNodes(). Selection change → viewBox pans to node position. useMemo-derived viewBox (no useEffect setState).
- [x] M5.E3.T1 — ECharts histogram component
  - StatsPanel with buildHistogram(). Configurable bins. ECharts bar chart with brush selection. 1 test (empty state).
- [x] M5.E3.T2 — Brush-to-select on histogram
  - ECharts brushSelected event maps bin indices to nodeIds and calls selectNodes().
- [x] M5.E4.T1 — TreeView component
  - Lazy-load tree with configurable initial depth. BFS with cycle handling. Expand/collapse per branch. Breadcrumb navigation. Working-set limit enforcement. 5 tests.
- [x] M5.E4.T2 — Document linkage in Detail Inspector
  - Deferred to M6 workspace integration (requires Inspector modification and PDF.js dependency).

### M4: Projection Pipeline (2026-05-22)

- [x] M4.E1.T1 — ProjectionPipeline core
  - Pre-extraction architecture: types and properties extracted from FULL graph before collapse steps run. Ordered step sequence with enable/disable toggle. 4 tests.
- [x] M4.E2.T1 — Type Collapse
  - Removes rdf:type triples from graph. Types always preserved via pre-extraction. When disabled (Ontology preset), type classes appear as nodes with edges. 1 test.
- [x] M4.E2.T2 — Literal Collapse
  - Removes literal-object triples on named resources. Preserves blank-node-subject literals for structural collapses. Properties via pre-extraction. 1 test.
- [x] M4.E2.T3 — Blank-Node Resolution
  - Inlines blank-node properties as synthetic literals on parent. Handles nested blank nodes. 1 test.
- [x] M4.E2.T4 — List Resolution
  - rdf:first/rdf:rest chains become JSON array synthetic literals. List nodes removed. 1 test.
- [x] M4.E2.T5 — Reification Collapse
  - rdf:Statement metadata becomes synthetic literals on the reified subject. Reification nodes removed. 1 test.
- [x] M4.E3.T1 — Projection presets
  - Standard (all on), Ontology (type collapse off), Provenance-Preserving (reification off). Step ordering: Literal → Type → BNode → List → Reification. 3 tests.
- [x] M4.E3.T2 — Holonic pipeline compatibility
  - ProjectionPipeline satisfies HolonicProjectionPipeline = Pick<ProjectionPipeline, "project">. 1 test.
- [x] M4.E3.T3 — ViewRouter enforcement gate
  - checkRenderPermission() blocks raw RDF from canvas/table. Passes projected RDF and non-RDF. Schema and inspector exempt. 6 tests.

### M3: Data Adapters & Integration (2026-05-22)

- [x] M3.E1.T1 — GraphAdapter interface
  - GraphAdapter with query(), expandNeighborhood(), getSchema(), getNodeProperties(). SchemaModel type. 3 tests.
- [x] M3.E2.T1 — SPARQL adapter
  - SparqlAdapter: HTTP POST with SPARQL query. Parses SELECT bindings into UGM (URI→node+edge, literal→property). Mock fetch tests. 2 tests.
- [x] M3.E2.T2 — Cypher adapter
  - CypherAdapter: HTTP POST to Neo4j transaction API. Parses graph results (nodes+relationships). Auth support. 2 tests.
- [x] M3.E2.T3 — Holonic adapter
  - HolonicAdapter wraps HolonicDataset. projectToLPG() maps holons→nodes, portals→edges. projectHolonInterior() for expansion. 4 tests.
- [x] M3.E2.T4 — Holonic portal right-click
  - registerPortalMenuItems() adds "Traverse portal..." to context menu for holon nodes. Filter checks portal count. 2 tests (logic only).
- [x] M3.E3.T1 — AlgorithmResultAdapter
  - ingestAlgorithmResults() merges Map<nodeId, properties> into UGM nodes. Skips missing nodes. 2 tests.
- [x] M3.E3.T2 — Relational data virtualization
  - virtualizeRelationalData() merges tabular data by key field. parseCSV() handles quoted fields. 80/100 node merge test. 5 tests.
- [x] M3.E4.T1 — D6 module boundary test
  - Dynamic import verification: all core modules (UGM, layout, WSM, adapters, algorithm, relational) import without React. 6 tests.

### M2: Layout Engines (2026-05-22)

- [x] M2.E1.T1 — Layout engine abstraction
  - LayoutEngine interface: compute(ugm, options) → Promise<LayoutResult>. Position type. LayoutOptions with pinned map. 2 tests.
- [x] M2.E2.T1 — elkjs hierarchical layout
  - ElkLayout wraps elkjs/lib/elk.bundled.js. Async compute. Layered algorithm. 3 tests (200-node DAG, pinned, empty).
- [x] M2.E2.T2 — d3-force layout
  - ForceLayout with configurable tick count. forceManyBody, forceCenter, forceCollide. fx/fy for pinned nodes. 3 tests.
- [x] M2.E2.T3 — d3-hierarchy tree layout
  - HierarchyLayout with BFS tree construction (handles cycles). Root auto-detection. Orphan node placement. 3 tests.
- [x] M2.E2.T4 — dagre DAG layout
  - DagreLayout wraps @dagrejs/dagre. Configurable rankdir (TB/LR/BT/RL). 50-node DAG in <100ms. 4 tests.
- [x] M2.E3.T1 — Layout switcher UI
  - LayoutSwitcher.tsx renders engine buttons with active highlight. Fires onSwitch(engineId). 3 tests.
- [x] M2.E3.T2 — Pin/unpin node
  - usePinState() hook manages pinned Map<string, Position>. pin(), unpin(), isPinned(). 5 tests.

## Deviations from Spec

(none; M0 implementation matches spec requirements)

## Implementation Decisions

- React 19.2.x, TypeScript 6.0.x (`ignoreDeprecations: "6.0"` for paths)
- Vite 8.x, @vitejs/plugin-react 6.x
- Vitest 4.x with jsdom; passWithNoTests enabled
- ESLint 10.x flat config (eslint.config.js)
- graphology 0.25.x; named import `{ MultiGraph }`
- UGM: composition over MultiGraph, not inheritance
- QualifiedEdgeMeta in `meta` sub-object on EdgeAttributes (not flat)
- Non-null assertions allowed in test files only (ESLint override)
- vi.fn() untyped with `as Record<string, unknown>` casts (Vitest 4.x generic API changed)
- Cytoscape stylesheet uses `as any` for data() references (@types/cytoscape too restrictive)
- \_asserted stored as numeric 0/1 (not boolean) for Cytoscape selector compatibility
- Zustand 5.x with devtools middleware (store name: "g3t-selection")
- Selection store is a singleton; all views share via useSelectionStore hook
- WorkingSetManager is framework-agnostic (D6); pure class, no React dependency
- @tanstack/react-table v8.x with getCoreRowModel, getSortedRowModel, getPaginationRowModel
- TableView columns built dynamically from UGM property-key registry (R3.1)
- jsdom renders hex colors as rgb(); tests use regex to match either format
- elkjs 0.9.x; import from 'elkjs/lib/elk.bundled.js' (async API; works in browser and Node)
- d3-force v3.x; simulation run synchronously via tick() loop (configurable count)
- d3-hierarchy v3.x; BFS tree construction handles cycles by skipping visited nodes
- @dagrejs/dagre latest; graphlib bundled. 50-node DAG layout completes in <100ms
- Layout engines are all framework-agnostic (D6); LayoutSwitcher and usePinState are React
- Pre-extraction architecture: pipeline extracts types and literal properties from FULL graph before any collapse step runs (fixes ordering dependency between literalCollapse and structural collapses)
- literalCollapse preserves blank-node-subject literals so structural collapses (BNode, List, Reification) can still read them
- localPart() handles IRIs (#, /), CURIEs (:), and plain strings
- Synthetic triples from structural collapses use objectType "literal" with JSON.stringify for compound values
- ViewRouter gate throws on raw RDF → renderer; exempts schema and inspector views

## Known Issues

- Cytoscape component tests use mocked cytoscape (jsdom lacks Canvas 2D; `canvas` npm needs native compilation). Full visual verification requires Playwright.
- @types/cytoscape doesn't accept `"data(x)"` strings for shape/opacity; requires `as any` cast.
- cytoscape-fcose has no @types package; custom declaration in src/types/cytoscape-fcose.d.ts.
- `MenuRegistration` and `UGMEventPayload` types exported but not yet consumed (API surface for future use).

## Acceptance Test Fixes (v0.0.1 post-audit)

- **Dashed edge selector invalid:** `edge[_asserted = false]` is invalid Cytoscape selector syntax (booleans not supported in selectors). Fixed by encoding `_asserted` as numeric 0/1 and using `edge[_asserted = 0]`.
- **Zoom too slow:** Added `wheelSensitivity: 0.3` to Cytoscape config (lower = more zoom per scroll tick).
- **Context menu not wired to Cytoscape:** CytoscapeCanvas now listens for `cxttap` on nodes, edges, and background, resolves menu items via ContextMenuManager, and renders ContextMenu at click position. Also closes on left-click.
- **Layout too dense at 500 nodes:** Tuned cose/fcose layout params (idealEdgeLength: 80-100, nodeRepulsion: 8000-10000, gravity: 0.2-0.25) for better spread.

## Testing Infrastructure (D14, post-M4)

- **D14 adopted (current):** Three-layer testing strategy (Vitest unit, React Testing Library component, Playwright e2e). An earlier four-layer plan also included Robot Framework acceptance tests; those were consolidated into Playwright in v1.0.0-rc (see `docs/source/testing-architecture.md` for the migration rationale).
- **Test harness:** `src/test-harness.tsx` renders all components in deterministic layout. Activated by `/?test-harness` URL parameter.
- **Playwright e2e:** 3 spec files (canvas, selection, sidebar) with `toHaveScreenshot()` visual regression. Baselines created on first run.
- **Pre-requisites for e2e:** `npx playwright install --with-deps chromium` (one-time browser setup).

## Open Questions Resolved

(none yet; M0 has no OQ decision gates)
