# Enhancement Implementation Plan

Date: 2026-05-22
Author: Architecture Lead
Scope: 3 new milestones (M11, M12, M13), 34 tickets

> **Status:** All enhancement milestones (M10.5-M13) complete.
> This document is historical. See CHANGELOG.md [1.0.0-rc] for
> the implemented feature list.


## Engineering Overview

The enhancements decompose into three dependency layers:

```
M11: Pipeline Infrastructure        ← everything depends on this
 ├── DataPipeline interface (D6)
 ├── Built-in pipeline functions
 ├── LinkedChart wrapper (React)
 ├── 6 chart renderers
 └── PropertyFilterBuilder

M12: Customization & Graph Filters   ← depends on M11 for filter UX
 ├── NodeStyleOverride model (D6)
 ├── SVG icon library
 ├── Right-click "Edit Appearance"
 ├── Graph-level filter actions
 ├── Table column visibility
 └── Context-sensitive menus

M13: Workflows & Demos               ← depends on M11 + M12
 ├── WorkflowStep engine (D6)
 ├── 4 scenario workflows
 ├── PROV-O temporal projection
 ├── Derived properties engine
 └── Session persistence
```

No circular dependencies. M11 ships independently and is useful
without M12/M13. M12 ships independently of M13. Each milestone
has a clear exit criterion.

---

## M11: Pipeline Infrastructure (14 tickets)

Exit criterion: User can add a linked bar chart and scatter plot
to the workspace. Clicking a bar filters the graph and table.
Brushing the scatter selects nodes. Changing a property filter
updates all charts reactively.

### E11.1: Pipeline Core (3 tickets, D6: framework-agnostic)

**M11.E1.T1 — DataPipeline interface and PipelineRegistry.**

```typescript
// src/core/pipeline/types.ts

interface DataPipeline<TData, TSelection = unknown> {
  id: string;
  name: string;
  /** Extract/aggregate data from UGM. Pure function. */
  query: (ugm: UGM) => TData;
  /** Map a chart selection back to node IDs. */
  reverseMap: (selection: TSelection, data: TData) => string[];
}

// Standardized data shapes
interface CategoricalData {
  categories: Array<{
    label: string;
    count: number;
    nodeIds: string[];
  }>;
}

interface ScatterData {
  points: Array<{
    x: number;
    y: number;
    nodeId: string;
    label?: string;
  }>;
  trend?: { slope: number; intercept: number; r2: number };
}

interface TimeSeriesData {
  series: Array<{
    time: number;
    value: number;
    nodeIds: string[];
  }>;
}

// Registry for plugin pipelines
class PipelineRegistry {
  register<T>(pipeline: DataPipeline<T>): void;
  get(id: string): DataPipeline<unknown> | undefined;
  list(): ReadonlyArray<DataPipeline<unknown>>;
}
```

Acceptance:
- Vitest: register 3 pipelines; list returns 3; get by ID works.
- Interface exported from barrel.

**M11.E1.T2 — Built-in pipeline functions (8 functions).**

All functions are pure: `(ugm: UGM, ...config) => DataPipeline<T>`.

```
// Categorical
createCountByType()           → CategoricalData
createCountByProperty(key)    → CategoricalData
createDegreeDistribution()    → CategoricalData
createEdgeTypeBreakdown()     → CategoricalData

// Statistical
createPropertyCorrelation(xKey, yKey)  → ScatterData (with OLS trend)
createCentralityVsProperty(cKey, pKey) → ScatterData

// Temporal
createActivityTimeline(startKey, endKey?) → TimeSeriesData

// Graph-derived
createCommunityBreakdown(communityKey)    → CategoricalData
```

Acceptance:
- Vitest: 20-node UGM; countByType returns correct counts per type.
- Vitest: 20-node UGM with numeric props; scatter correlation computes
  OLS trend with r2 > 0.
- Vitest: reverseMap on countByType returns correct nodeIds for
  selected category.

**M11.E1.T3 — OLS trend line computation.**

Ordinary Least Squares regression for scatter plot trend lines.
Returns slope, intercept, r-squared. Pure math, no dependencies.

```typescript
function olsRegression(points: Array<{x: number, y: number}>): {
  slope: number;
  intercept: number;
  r2: number;
  predict: (x: number) => number;
};
```

Acceptance:
- Vitest: 10 points on y = 2x + 1; slope ≈ 2, intercept ≈ 1, r2 > 0.99.

### E11.2: LinkedChart + Renderers (6 tickets)

**M11.E2.T1 — LinkedChart wrapper component.**

React component that wires a DataPipeline to a chart renderer.

```tsx
<LinkedChart
  ugm={ugm}
  pipeline={countByType()}
  type="bar"
  height={300}
/>
```

Internals:
- `useMemo` on `pipeline.query(ugm)` (re-runs when UGM reference changes)
- Chart interaction → `pipeline.reverseMap()` → `selectNodes()`
- Subscribes to UGM identity changes (not deep equality; the caller
  must pass a new UGM reference when data changes, or use a Zustand
  store that tracks UGM version)

Acceptance:
- RTL: render LinkedChart with countByType; verify chart container exists.
- RTL: simulate chart selection event; verify selectNodes called with
  correct IDs.

**M11.E2.T2 — Bar chart renderer (ECharts).**

Renders `CategoricalData` as a vertical bar chart. Click a bar →
`reverseMap({ type: "categorical", category: label })` → node IDs.

Styling: uses theme CSS variables for colors. Bars use the type
palette. Axis labels respect the active theme.

Acceptance:
- RTL: 3 categories render 3 bars.
- Click handler fires with correct category label.

**M11.E2.T3 — Scatter plot renderer with trend line (ECharts).**

Renders `ScatterData` as a scatter plot. Brush selection → lasso
the points → `reverseMap({ type: "point-set", indices })`.

Trend line rendered as a dashed line overlay using the regression
equation. Tooltip shows "r² = 0.87".

Acceptance:
- RTL: 10 points render.
- Trend line visible when `data.trend` is present.

**M11.E2.T4 — Line/area chart renderer (ECharts).**

Renders `TimeSeriesData` as a line chart with optional area fill.
X-axis is time (auto-formatted). Brush selection → time range →
`reverseMap({ type: "range", min, max })`.

Acceptance:
- RTL: 12-month time series renders.
- Brush emits range.

**M11.E2.T5 — Pie/donut chart renderer (ECharts).**

Renders `CategoricalData` as a donut chart. Click slice → category
selection.

Acceptance:
- RTL: 4 categories render 4 slices.

**M11.E2.T6 — Parallel coordinates renderer (ECharts).**

Renders multi-dimensional data. Each axis is a property. Brush on
any axis filters the visible lines → node IDs.

Input: `{ dimensions: string[], records: Array<Record<string, number> & { nodeId: string }> }`.

Acceptance:
- RTL: 3 dimensions, 10 records render.

### E11.3: Property Filtering (3 tickets)

**M11.E3.T1 — PropertyFilter model and evaluator (D6).**

```typescript
interface PropertyFilter {
  key: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists";
  value?: unknown;
}

interface FilterGroup {
  logic: "and" | "or";
  filters: Array<PropertyFilter | FilterGroup>;
}

function evaluateFilter(ugm: UGM, filter: FilterGroup): Set<string>;
```

Acceptance:
- Vitest: 20 nodes; filter risk > 0.5 returns correct subset.
- Vitest: AND(type = Person, risk > 0.7) returns correct subset.
- Vitest: OR(type = Person, type = Location) returns union.

**M11.E3.T2 — FilterBuilder React component.**

Visual filter builder with:
- Row per condition: [property dropdown] [operator] [value input]
- AND/OR toggle between rows
- Add condition button
- Remove condition button
- "Apply" button calls `evaluateFilter` and passes result to a
  callback (which the workspace uses to dim/hide non-matching nodes)

Acceptance:
- RTL: add 2 conditions; verify both rendered.
- RTL: click Apply; callback receives node ID set.

**M11.E3.T3 — Graph-level filter actions.**

Context menu and toolbar additions:
- "Show Only Selected" (hides all non-selected nodes)
- "Hide Selected" (removes selected from view)
- "Expand to N Hops" (shows N-hop neighborhood, hides rest)
- "Reset Filters" (restores all hidden nodes)

These operate on a `ViewFilter` layer that sits between the UGM
and the canvas. The UGM is never modified; the ViewFilter determines
which nodes/edges are visible.

```typescript
interface ViewFilter {
  visibleNodeIds: Set<string> | null; // null = show all
  hiddenNodeIds: Set<string>;
  apply(ugm: UGM): { nodes: string[]; edges: string[] };
}
```

Acceptance:
- Vitest: select 3 nodes; "Show Only Selected" → visibleNodeIds = {3}.
- Vitest: "Expand to 2 Hops" from 1 node → correct neighborhood.
- Vitest: "Reset Filters" → visibleNodeIds = null.

### E11.4: Table Column Visibility (2 tickets)

**M11.E4.T1 — Column visibility toggle.**

Dropdown in the table header showing all available columns with
checkboxes. Unchecked columns are hidden. Per-type presets
(Person shows name/role/risk; Organization shows name/sector).

Acceptance:
- RTL: toggle "risk" column off; verify column not rendered.
- RTL: switch type preset; verify column set changes.

**M11.E4.T2 — Table property-level inline filter.**

Each column header has a small filter icon. Clicking it shows an
inline filter input (text for strings, range slider for numbers).
Filtering a column dims non-matching rows and updates the
selection store.

Acceptance:
- RTL: filter "risk" > 0.5; verify rows with risk ≤ 0.5 are dimmed.

---

## M12: Customization & Graph Filters (10 tickets)

Exit criterion: User can right-click a node, choose "Edit
Appearance," change its icon to a shield SVG, change its color
to red, and click "Apply to all [Person]." All Person nodes
update. The change persists across workspace save/load.

### E12.1: NodeStyleOverride (3 tickets, D6 model + React UI)

**M12.E1.T1 — NodeStyleOverride model and stylesheet merge.**

```typescript
interface NodeStyleOverride {
  scope: { nodeId: string } | { type: string };
  color?: string;
  shape?: CytoscapeShape;
  size?: number;
  icon?: { svg: string; color?: string; scale?: number };
  labelField?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}

// Zustand store
interface StyleOverrideStore {
  overrides: NodeStyleOverride[];
  add(override: NodeStyleOverride): void;
  remove(scope: NodeStyleOverride["scope"]): void;
  clear(): void;
  toCytoscapeStyles(): CytoscapeStylesheet[];
}
```

The `toCytoscapeStyles()` method generates Cytoscape stylesheet
entries from the overrides. Type-scoped overrides use
`node[_type = "Person"]` selectors. Node-scoped overrides use
`node#nodeId` selectors. Node-level overrides take precedence
over type-level (CSS specificity).

Acceptance:
- Vitest: add type override color=red; stylesheet entry has
  correct selector and color.
- Vitest: add node override + type override; node override wins.
- Vitest: toCytoscapeStyles integrates with encoding styles.

**M12.E1.T2 — Built-in SVG icon library.**

20 icons as SVG path data constants:

```
person, people, building, factory, globe, pin, calendar, clock,
document, folder, shield, lock, server, database, link, flag,
star, warning, check, cross
```

Each icon is a single SVG path string (no external files). The
canvas renders them as Cytoscape background images via data URIs.

Acceptance:
- Vitest: all 20 icons are valid SVG (parseable).
- Vitest: icon data URI generation produces valid base64.

**M12.E1.T3 — Workspace save/load includes style overrides.**

`saveWorkspace()` serializes the StyleOverrideStore alongside
the FlexLayout model and schema hash. `loadWorkspace()` restores.

Acceptance:
- Vitest: save with 3 overrides; load; store has 3 overrides.

### E12.2: Edit Appearance UI (3 tickets)

**M12.E2.T1 — NodeStyleEditor panel.**

React component (modal or sidebar panel) with:
- Color picker (8 preset colors + custom hex input)
- Shape selector (6 shapes as clickable icons)
- Size slider (10–80px)
- Icon selector (grid of 20 built-in icons + "None")
- Label field dropdown (from UGM property keys)
- Border color + width controls
- Opacity slider

Acceptance:
- RTL: render editor; all controls present.
- RTL: change color; onChange fires with updated override.

**M12.E2.T2 — "Apply to" scope toggle.**

Radio buttons in the editor:
- "This node only" → scope: { nodeId }
- "All [Person] nodes" → scope: { type }

The label dynamically shows the node's type.

Acceptance:
- RTL: toggle scope; onChange fires with correct scope.

**M12.E2.T3 — Context menu "Edit Appearance" integration.**

Register "Edit Appearance" in the ContextMenuManager. When
clicked, opens NodeStyleEditor pre-populated with the node's
current visual state.

Acceptance:
- RTL: right-click node; "Edit Appearance" item present.
- RTL: clicking item opens editor with node's current color.

### E12.3: Advanced Graph Filtering (2 tickets)

**M12.E3.T1 — ViewFilter integration with CytoscapeCanvas.**

The CytoscapeCanvas applies the ViewFilter before rendering:
nodes not in `visibleNodeIds` (or in `hiddenNodeIds`) get
`display: none` in the Cytoscape stylesheet.

The filter state is a Zustand store that all views read:
- Canvas: hides elements
- Table: filters rows
- Map: hides markers
- Charts: re-query against visible subset

Acceptance:
- RTL: apply ViewFilter hiding 5 of 20 nodes; canvas renders 15.
- RTL: table shows 15 rows.

**M12.E3.T2 — Context-sensitive right-click menus.**

Different menu items based on node type:

| Type | Extra Menu Items |
|------|-----------------|
| Person | "Show Timeline", "Risk Profile" |
| Organization | "Show Subsidiaries", "Financial Flows" |
| Location | "Show on Map", "Nearby Entities" |
| default | "Expand Neighborhood", "Find Paths" |

Implemented via a `TypeMenuProvider` that the ContextMenuManager
queries when building the menu for a node.

Acceptance:
- Vitest: Person node → menu includes "Show Timeline".
- Vitest: Location node → menu includes "Show on Map".

### E12.4: Bulk Operations (2 tickets)

**M12.E4.T1 — Multi-selection context menu.**

When 2+ nodes are selected, right-click shows:
- "Tag All As..." (text input)
- "Set Color..." (color picker)
- "Set Icon..." (icon grid)
- "Hide Selected"
- "Show Only Selected"

Acceptance:
- RTL: select 5 nodes; right-click; "Tag All As" item present.

**M12.E4.T2 — Bulk style application.**

"Set Color" on a multi-selection creates individual
NodeStyleOverride entries for each selected node.

Acceptance:
- Vitest: bulk set color on 5 nodes; 5 overrides in store.

---

## M13: Workflows & Advanced Features (10 tickets)

Exit criterion: User can step through the Intel workflow from
load → query → project → algorithm → visualize → export. Each
step shows progress. Charts update reactively. The full session
can be saved and resumed.

### E13.1: Workflow Engine (3 tickets, D6)

**M13.E1.T1 — WorkflowStep model and WorkflowRunner.**

```typescript
interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  type: "load" | "query" | "project" | "algorithm"
      | "visualize" | "filter" | "export" | "inspect";
  execute: (state: WorkflowState) => Promise<WorkflowState>;
}

interface WorkflowState {
  ugm: UGM;
  charts: Array<{ pipeline: DataPipeline<unknown>; type: string }>;
  filters: FilterGroup;
  annotations: string[];
}

class WorkflowRunner {
  constructor(steps: WorkflowStep[]);
  get currentStep(): number;
  get totalSteps(): number;
  next(): Promise<void>;
  back(): void;
  reset(): void;
  getState(): WorkflowState;
}
```

Acceptance:
- Vitest: 3-step workflow; next() advances; state transforms.
- Vitest: back() returns to previous state.

**M13.E1.T2 — WorkflowPanel React component.**

Sidebar or overlay showing:
- Step list with progress indicator (current step highlighted)
- Step name and description
- "Next" / "Back" buttons
- Current state summary (node count, chart count)

Acceptance:
- RTL: 5-step workflow; step 2 active; step list rendered.
- RTL: click Next; step 3 becomes active.

**M13.E1.T3 — 4 demo workflow definitions.**

Each workflow is a `WorkflowStep[]` array using the built-in
step types. The demo app renders the workflow panel alongside
the main workspace.

Acceptance:
- Each workflow loads and runs to completion without errors.

### E13.2: PROV-O Temporal (2 tickets)

**M13.E2.T1 — PROV-O property extraction.**

Projection pipeline step that recognizes PROV-O temporal
properties:
- `prov:startedAtTime` → `temporal_start`
- `prov:endedAtTime` → `temporal_end`
- `prov:wasGeneratedBy` → edge type "generatedBy"
- `prov:wasAttributedTo` → edge type "attributedTo"

This enables the existing TimelineView to render PROV-O data
without manual property mapping.

Acceptance:
- Vitest: RDF with PROV-O triples; projected UGM has
  `temporal_start`/`temporal_end` properties on Activity nodes.

**M13.E2.T2 — Temporal range filter.**

Slider with two handles for selecting a time range. Nodes
outside the range are hidden via ViewFilter. Linked to the
timeline brush selection.

Acceptance:
- RTL: set range; ViewFilter updated; nodes outside hidden.

### E13.3: Derived Properties (2 tickets)

**M13.E3.T1 — DerivedPropertyEngine (D6).**

```typescript
interface DerivedProperty {
  name: string;
  /** Expression referencing existing properties and graph metrics. */
  expression: string;  // e.g., "centrality * 0.4 + risk * 0.6"
  /** Recompute when UGM changes. */
  reactive: boolean;
}

class DerivedPropertyEngine {
  define(prop: DerivedProperty): void;
  compute(ugm: UGM): void;  // adds computed values to UGM nodes
  remove(name: string): void;
}
```

Expression evaluation uses a safe subset (arithmetic, min, max,
property references). No `eval()`.

Acceptance:
- Vitest: define "score = risk * 2"; compute; node properties
  include "score" with correct values.

**M13.E3.T2 — Derived property UI.**

Panel where users define derived properties:
- Name input
- Expression input with property name autocomplete
- "Compute" button
- Results shown in table and usable in encoding

Acceptance:
- RTL: define property; click Compute; new column in table.

### E13.4: Session Persistence (3 tickets)

**M13.E4.T1 — AnalysisSession model.**

```typescript
interface AnalysisSession {
  id: string;
  name: string;
  createdAt: string;
  ugm: SerializedUGM;
  workspace: WorkspaceState;
  styleOverrides: NodeStyleOverride[];
  filters: FilterGroup;
  charts: Array<{ pipelineId: string; type: string; position: string }>;
  derivedProperties: DerivedProperty[];
  annotations: string[];
}
```

Serializable to JSON. Can be saved to localStorage, file, or
API endpoint.

Acceptance:
- Vitest: create session with all fields; serialize; deserialize;
  all fields match.

**M13.E4.T2 — Save/Load session UI.**

- "Save Session" button in toolbar → names the session, saves to
  localStorage (with file download option)
- "Load Session" → shows list of saved sessions with timestamps
- "Export Session" → downloads as .g3t.json file
- "Import Session" → file picker

Acceptance:
- RTL: save session; list shows 1 session; load restores state.

**M13.E4.T3 — Subgraph pinning.**

Pin a set of nodes that remain visible regardless of filter state.
Pinned nodes get a small pin icon badge. "Unpin All" clears pins.

```typescript
// Added to ViewFilter
interface ViewFilter {
  pinnedNodeIds: Set<string>;  // always visible
  // ... existing fields
}
```

Acceptance:
- Vitest: pin 3 nodes; apply filter hiding them; they remain visible.
- Vitest: unpin; filter re-applies; they disappear.

---

## Dependency Graph

```
M11.E1.T1 (Pipeline interface)
  ├─→ M11.E1.T2 (Built-in pipelines)
  │     └─→ M11.E1.T3 (OLS regression)
  └─→ M11.E2.T1 (LinkedChart)
        ├─→ M11.E2.T2 (Bar renderer)
        ├─→ M11.E2.T3 (Scatter renderer)
        ├─→ M11.E2.T4 (Line renderer)
        ├─→ M11.E2.T5 (Pie renderer)
        └─→ M11.E2.T6 (Parallel coords)

M11.E3.T1 (PropertyFilter model)
  ├─→ M11.E3.T2 (FilterBuilder UI)
  └─→ M11.E3.T3 (Graph-level filters)
        └─→ M12.E3.T1 (ViewFilter integration)

M12.E1.T1 (NodeStyleOverride)
  ├─→ M12.E1.T2 (SVG icon library)
  ├─→ M12.E1.T3 (Workspace persistence)
  └─→ M12.E2.T1 (NodeStyleEditor UI)
        ├─→ M12.E2.T2 (Scope toggle)
        └─→ M12.E2.T3 (Context menu integration)

M12.E4.T1 (Multi-select menu)
  └─→ M12.E4.T2 (Bulk style application)

M13.E1.T1 (WorkflowRunner) ← depends on M11 + M12
  ├─→ M13.E1.T2 (WorkflowPanel UI)
  └─→ M13.E1.T3 (4 demo workflows)

M13.E2.T1 (PROV-O extraction)
  └─→ M13.E2.T2 (Temporal range filter)

M13.E3.T1 (DerivedPropertyEngine)
  └─→ M13.E3.T2 (Derived property UI)

M13.E4.T1 (AnalysisSession model)
  ├─→ M13.E4.T2 (Save/Load UI)
  └─→ M13.E4.T3 (Subgraph pinning)
```

## Testing Strategy

| Layer | M11 | M12 | M13 |
|-------|-----|-----|-----|
| Unit (Vitest) | Pipeline functions, OLS, filter evaluator | Style merge, icon validation, session serialization | Workflow runner, PROV-O extraction, expression evaluator |
| Component (RTL) | LinkedChart, FilterBuilder, chart renderers | NodeStyleEditor, scope toggle, column visibility | WorkflowPanel, temporal slider, derived property UI |
| E2E (Playwright) | Click bar → graph selection; brush scatter → table filter | Right-click → Edit Appearance → Apply to All | Full workflow step-through |
| Acceptance (Robot) | "Filter by risk > 0.5; bar chart updates" | "Change Person icon to shield; all Person nodes update" | "Complete Intel workflow in 10 steps" |

Estimated test count: ~80 new tests across 3 milestones.

## Module Boundary Compliance (D6)

Framework-agnostic (pure TypeScript, no React):
- DataPipeline, PipelineRegistry, built-in pipeline functions
- PropertyFilter, FilterGroup, evaluateFilter
- NodeStyleOverride, StyleOverrideStore, mergeStyleOverrides
- OLS regression
- WorkflowStep, WorkflowRunner, WorkflowState
- DerivedPropertyEngine
- AnalysisSession model
- ViewFilter

React components (D13):
- LinkedChart, chart renderers (Bar, Scatter, Line, Pie, ParallelCoords)
- FilterBuilder
- NodeStyleEditor, scope toggle
- WorkflowPanel
- Temporal range slider
- Column visibility toggle
- Derived property UI
- Session save/load UI

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| ECharts chart interactions don't fire in jsdom | RTL tests limited | Chart interaction tested via Playwright only |
| Expression evaluation (derived properties) could be exploited | Security hole | Use a safe parser (expr-eval); no eval(); whitelist operators |
| Workflow state grows large with complex sessions | Performance | Serialize UGM diffs, not full snapshots; cap session size |
| SVG icons add bundle size | Slower load | Tree-shake; only import icons actually used |
| Parallel coordinates not well-supported in ECharts | Visual quality | Fall back to D3 if ECharts parallel is insufficient |

## Ticket Count Summary

| Milestone | Epics | Tickets | D6 (pure TS) | D13 (React) |
|-----------|-------|---------|-------------|-------------|
| M11 | 4 | 14 | 5 | 9 |
| M12 | 4 | 10 | 4 | 6 |
| M13 | 4 | 10 | 5 | 5 |
| **Total** | **12** | **34** | **14** | **20** |

---

## Addendum: FOSS Adoption (see build-vs-adopt.md)

The following changes apply to the ticket plan above:

### Eliminated Tickets

- **M11.E1.T3 (OLS regression):** Replaced by `simple-statistics`
  dependency. Scatter pipeline calls `linearRegression()` directly.

### Simplified Tickets

- **M11.E1.T2 (Built-in pipelines):** Implementations become thin
  wrappers around `graphology-metrics` (centrality), `graphology-
  communities-louvain` (community detection), and `simple-statistics`
  (regression). The pipeline function creates the `DataPipeline`
  object; the computation delegates to the library.

- **M11.E3.T1 (PropertyFilter):** The filter evaluator delegates
  to `crossfilter2` for fast bitmap-indexed filtering. The
  `PropertyFilter` and `FilterGroup` types remain as our API; the
  implementation translates them to crossfilter dimensions.

### New Dependencies to Install

```bash
npm install graphology-shortest-path graphology-metrics \
  graphology-communities-louvain graphology-components \
  crossfilter2 simple-statistics
```

### Existing Code to Refactor

- `findShortestPath()` → delegate to `graphology-shortest-path`
  (keep our `PathResult` return type as the API; change internals)
- `expandNeighbors()` → delegate to `graphology-traversal`
- `ingestAlgorithmResults()` → still ours (adapter pattern),
  but the algorithms themselves come from graphology-metrics

### Revised Ticket Count

| Milestone | Before | After | Change |
|-----------|--------|-------|--------|
| M11 | 14 | 12 | -2 (eliminate OLS, simplify filter) |
| M12 | 10 | 10 | no change |
| M13 | 10 | 10 | no change |
| **Total** | **34** | **32** | **-2** |
