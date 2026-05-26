# Enhancement Plan: Query Pipelines, Linked Visualization, and Workflows

Date: 2026-05-22

> **Status:** M10.5, M11, M12, M13 all complete. See CHANGELOG.md [1.0.0-rc].
Status: Proposed
Scope: Post-M8.5, integrated into M9-M10 or new milestones

## 1. Problem Statement

The toolkit has 12 view types and a solid data layer, but lacks three
things that separate a component library from a usable analytical
workbench:

**A. No workflow support.** Users interact with isolated views. There
is no mechanism for "load RDF → query → project → run algorithms →
visualize results → iterate." Each step is manual and disconnected.

**B. No graph-informed statistical visualization.** The StatsPanel
does histograms, but analysts need bar charts grouped by graph
structure, scatter plots of derived metrics, trend lines over
temporal data, and every chart needs to link back to the graph
(select bars → filter nodes).

**C. No per-node visual customization.** Users can't right-click a
node and change its icon, color, or label. There's no SVG icon
support. Visual encoding is global (map a property to all nodes),
not composable (override for specific nodes or classes).

## 2. Architecture: Query-to-Visualization Pipelines

### 2.1 Core Concept: DataPipeline

A `DataPipeline` is a declarative link between the UGM and a
visualization. It consists of:

```typescript
interface DataPipeline<T> {
  /** Unique identifier. */
  id: string;
  /** Human-readable name (shown in UI). */
  name: string;
  /** Extract and aggregate data from the UGM. */
  query: (ugm: UGM) => T;
  /** Map a chart selection back to UGM node IDs. */
  reverseMap: (selection: unknown, data: T) => string[];
  /** Reactive: re-runs when UGM changes. */
  subscribe?: boolean;
}
```

The `query` function is pure: it takes a UGM and returns chart-ready
data. The `reverseMap` function takes a chart interaction (a clicked
bar, a brushed region, a lasso on a scatter plot) and returns the
node IDs that produced that data point. This closes the loop:

```
UGM ──query()──→ ChartData ──render──→ Chart
 ↑                                       │
 │                                  (user clicks)
 │                                       │
 └──selectNodes()←──reverseMap()←────────┘
```

### 2.2 Built-in Pipeline Functions

These cover ~80% of analytical chart needs without users writing
custom queries:

**Categorical:**
- `countByType(ugm)` → bar chart of node counts per type
- `countByProperty(ugm, key)` → bar chart of value distribution
- `edgeTypeBreakdown(ugm)` → bar chart of edge type counts
- `degreeDistribution(ugm)` → histogram of node degree

**Numeric / Statistical:**
- `propertyCorrelation(ugm, xKey, yKey)` → scatter plot data
- `propertyByType(ugm, key)` → box plot data (value per type)
- `centralityVsProperty(ugm, centralityKey, propKey)` → scatter

**Temporal (PROV-O aware):**
- `activityTimeline(ugm, startKey, endKey)` → time series data
- `entityCreationRate(ugm, timestampKey)` → line chart
- `temporalEdgeDensity(ugm, timeKey)` → area chart

**Graph-derived:**
- `communityBreakdown(ugm, communityKey)` → pie/bar of community sizes
- `pathLengthDistribution(ugm, source)` → histogram of distances
- `neighborhoodDensity(ugm, nodeId, hops)` → radial data

### 2.3 LinkedChart Wrapper Component

```tsx
<LinkedChart
  ugm={ugm}
  pipeline={countByType}
  chartType="bar"
  onSelect={(nodeIds) => selectNodes(nodeIds)}
/>
```

The `LinkedChart` component:
1. Subscribes to UGM changes (re-runs pipeline.query on change)
2. Renders the appropriate chart (ECharts, Plotly, or custom)
3. Intercepts chart interactions (click, brush, lasso)
4. Calls `pipeline.reverseMap()` to get node IDs
5. Writes to the selection store
6. All other views (canvas, table, map) react automatically

### 2.4 Chart Library (Sub-Package)

`@g3t/charts` — optional dependency, tree-shakeable.

**Rendering engines (pick best per chart type):**
- ECharts (already installed): bar, line, pie, scatter, heatmap, sankey
- Observable Plot (or Plotly.js): statistical charts with trend lines
- Custom SVG: sparklines, inline indicators

**Chart types with full linking support:**

| Chart | Pipeline | Selection | Trend |
|-------|----------|-----------|-------|
| Bar | countByType, countByProperty | click bar → nodes | — |
| Grouped Bar | propertyByType | click segment → nodes | — |
| Histogram | degreeDistribution | brush range → nodes | — |
| Scatter | propertyCorrelation | lasso/brush → nodes | OLS/LOESS |
| Scatter + Size | centralityVsProperty | lasso → nodes | linear |
| Line | activityTimeline | brush range → time window | moving avg |
| Area (stacked) | temporalEdgeDensity | brush → time window | — |
| Box/Violin | propertyByType | click box → type nodes | — |
| Pie/Donut | communityBreakdown | click slice → community | — |
| Parallel Coords | multi-property comparison | brush axis → nodes | — |

## 3. Workflow Engine

### 3.1 Workflow Steps

A workflow is an ordered sequence of steps. Each step transforms
the analytical state:

```typescript
interface WorkflowStep {
  id: string;
  name: string;
  type: "load" | "query" | "project" | "algorithm" | "visualize" | "filter" | "export";
  config: Record<string, unknown>;
  /** Previous step(s) this depends on. */
  dependsOn: string[];
}
```

Built-in step types:

| Type | Description | Input | Output |
|------|-------------|-------|--------|
| load | Load RDF/LPG from source | adapter config | UGM |
| query | Run SPARQL/Cypher/GQL | query string | filtered UGM |
| project | Apply projection pipeline | preset name | projected UGM |
| algorithm | Run graph algorithm | algorithm config | UGM with results |
| visualize | Add a chart/view | pipeline + chart type | visual |
| filter | Apply property/type filter | filter config | filtered UGM |
| export | Export subgraph/image | format config | file |

### 3.2 Demo Workflows

**Workflow A: Intelligence Network Analysis**
1. Load RDF (SPARQL → 20 entities)
2. Explore schema (SchemaView)
3. Query: "Find all paths between Volkov and financial transfers"
4. Project: Standard preset (collapse RDF patterns)
5. Filter: risk > 0.6
6. Algorithm: community detection
7. Visualize: bar chart (entity count per community)
8. Visualize: scatter (risk vs. degree centrality + trend line)
9. Visualize: temporal activity (PROV-O timeline of events)
10. Select high-risk community → graph highlights → table filters

**Workflow B: Biomedical Target Discovery**
1. Load RDF (gene-disease-drug ontology)
2. Browse ontology (TreeView)
3. Query: "Genes associated with both breast and lung cancer"
4. Project: Ontology preset (show type hierarchy)
5. Algorithm: PageRank on gene-disease subgraph
6. Visualize: scatter (PageRank vs. disease association count)
7. Visualize: grouped bar (drug targets by pathway)
8. Select top-PageRank genes → inspect drug interactions
9. Export subgraph of selected genes + their drug targets

**Workflow C: Supply Chain Risk Propagation**
1. Load supply chain graph
2. Filter: show only Tier 1 and Tier 2 suppliers
3. Algorithm: betweenness centrality (bottleneck detection)
4. Visualize: bar (centrality by company, sorted)
5. Visualize: geographic flow (map with shipping routes)
6. Select high-centrality node → see all downstream dependencies
7. Simulate removal: hide node → re-run centrality → compare

**Workflow D: Cyber Threat Attribution**
1. Load threat landscape graph
2. Query: "Campaigns targeting defense sector in 2025"
3. Path analysis: APT28 → infrastructure → malware → targets
4. Temporal: campaign timeline (PROV-O: prov:startedAtTime)
5. Visualize: parallel coordinates (CVSS, risk, sector criticality)
6. Visualize: Sankey (threat actor → campaign → target sector)
7. Select APT28 subgraph → export IOC report

## 4. Advanced Filtering

### 4.1 Property-Level Filter Builder

The current FacetFilter only filters by node type (checkbox per
type). This extension adds:

**Numeric range filters:** Slider for numeric properties (e.g.,
risk: 0.5–1.0). Nodes outside the range are dimmed or hidden.

**Text search filters:** Substring match on string properties.

**Multi-criteria builder:** AND/OR combination of property
filters. Saved as filter presets.

**Table column visibility:** Toggle which columns appear in the
table view. Per-type column sets (Person columns differ from
Organization columns).

### 4.2 Graph-Level Filters

**"Show only selected"** — Hides all nodes except the current
selection and their immediate edges.

**"Hide selected"** — Removes selected nodes from the view
(not from the UGM; reversible with undo).

**"Expand to N hops"** — Shows N-hop neighborhood of selected
nodes; hides everything else.

**"Show edges of type..."** — Toggle edge types on/off without
removing nodes.

## 5. Per-Node Visual Customization

### 5.1 NodeStyleOverride Model

```typescript
interface NodeStyleOverride {
  /** Apply to a single node, or all nodes of a type. */
  scope: { nodeId: string } | { type: string };
  /** Override fields (undefined = use default encoding). */
  color?: string;
  shape?: string;
  size?: number;
  icon?: string;       // SVG path data or URL
  iconColor?: string;
  labelField?: string;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
}
```

### 5.2 SVG Icon Support

Cytoscape.js supports SVG as node background image. The toolkit
provides:

- A built-in icon library (20-30 common icons: person, building,
  globe, server, document, shield, etc.)
- Custom SVG upload (paste SVG path data)
- Icon color respects the active theme

### 5.3 Right-Click → "Edit Appearance"

Context menu item "Edit Appearance" opens a panel with:
- Color picker (or palette selector)
- Shape selector (ellipse, rectangle, diamond, hexagon, etc.)
- Size slider
- Icon selector (built-in library + custom)
- Label field selector
- "Apply to all [Type]" / "This node only" toggle

Changes are stored as `NodeStyleOverride` entries and applied on
top of the global encoding. They persist in workspace save/load.

## 6. Proposed Implementation Plan

### Phase 1: Pipeline Core (add to M9 or new M11)

| Ticket | Description |
|--------|-------------|
| P1.1 | DataPipeline interface + 5 built-in pipelines (countByType, degreeDistribution, propertyCorrelation, activityTimeline, communityBreakdown) |
| P1.2 | LinkedChart wrapper component (ECharts renderer, selection → store wiring, UGM subscription) |
| P1.3 | Property-level FilterBuilder component (numeric range, text search, AND/OR combiner) |
| P1.4 | Table column visibility toggle |
| P1.5 | Graph-level filter actions (show-only-selected, hide-selected, expand-to-N-hops) |

### Phase 2: Chart Library (new @g3t/charts sub-package)

| Ticket | Description |
|--------|-------------|
| P2.1 | Linked bar chart (with click-to-select) |
| P2.2 | Linked scatter plot with OLS trend line |
| P2.3 | Linked line/area chart with time brush |
| P2.4 | Linked box/violin plot |
| P2.5 | Linked pie/donut chart |
| P2.6 | Linked parallel coordinates |

### Phase 3: Node Customization

| Ticket | Description |
|--------|-------------|
| P3.1 | NodeStyleOverride model + stylesheet merge |
| P3.2 | Built-in SVG icon library (20 icons) |
| P3.3 | Right-click "Edit Appearance" panel |
| P3.4 | "Apply to all of type" / "This node only" toggle |
| P3.5 | Workspace save/load includes style overrides |

### Phase 4: Workflow Demos

| Ticket | Description |
|--------|-------------|
| P4.1 | Guided workflow engine (step sequence, progress bar) |
| P4.2 | Intel workflow demo (10 steps, 3 linked charts) |
| P4.3 | Biomedical workflow demo (9 steps, 2 linked charts) |
| P4.4 | Supply chain workflow demo (7 steps, 2 linked charts) |
| P4.5 | Cyber threat workflow demo (7 steps, 2 linked charts) |

### Phase 5: Polish

| Ticket | Description |
|--------|-------------|
| P5.1 | PROV-O temporal projection (prov:startedAtTime, prov:endedAtTime, prov:wasGeneratedBy) |
| P5.2 | Temporal playback controller (animate graph evolution) |
| P5.3 | Advanced filter presets (save/load/share) |
| P5.4 | Multi-graph comparison (side-by-side canvases) |
| P5.5 | Annotation layer (sticky notes on nodes/regions) |

## 7. Additional Usability Improvements (Not Requested)

These emerged from thinking through real analyst workflows:

### 7.1 Persistent Analysis Sessions

Save the full analysis state (graph, filters, selections, chart
configs, annotations) as a session file. Resume where you left off.
Share sessions with colleagues via workspace export.

### 7.2 Derived Properties

Allow users to create computed properties on nodes:
"risk_score = centrality * 0.4 + threat_level * 0.6"
These update reactively and can be used in visual encoding.

### 7.3 Subgraph Pinning

Pin a subgraph (fixed set of nodes) that persists across filter
changes. Useful for keeping "persons of interest" visible while
filtering the rest of the graph.

### 7.4 Minimap / Overview Panel

A small overview of the entire graph showing the current viewport
as a rectangle. Click/drag to navigate. Shows selection heatmap.

### 7.5 Node Grouping by Convex Hull

Visual grouping of nodes by a property value (e.g., community ID,
department, threat actor). Draws a colored convex hull around each
group. Groups can be collapsed to a single meta-node.

### 7.6 Data Quality Indicators

Nodes with missing required properties (per SHACL) get a visual
indicator (yellow triangle). Data quality summary in the status bar
("3 nodes have validation warnings").

### 7.7 Context-Sensitive Right-Click Menus

Different menu items depending on the node type:
- Person: "Find connections", "Show timeline", "Risk profile"
- Organization: "Show subsidiaries", "Financial flows"
- Location: "Show on map", "Nearby entities"
- Event: "Show participants", "Temporal context"

### 7.8 Bulk Operations

Select 50 nodes → right-click → "Set all as high priority" or
"Tag all as reviewed" or "Change color to red". Batch operations
via the context menu on multi-selections.

### 7.9 Smart Suggestions

After selecting a node, the inspector shows "Related analyses":
- "5 nodes share 3+ connections with this node"
- "This node has the highest betweenness in its community"
- "2 similar patterns found in other communities"

These are computed lazily and cached.

## 8. Priority Assessment

| Enhancement | User Impact | Effort | Priority |
|-------------|------------|--------|----------|
| DataPipeline + LinkedChart | Critical | Medium | P0 |
| Built-in pipeline functions | Critical | Small | P0 |
| Property-level FilterBuilder | High | Medium | P0 |
| Linked bar chart | Critical | Small | P0 |
| Linked scatter + trend | Critical | Small | P0 |
| NodeStyleOverride + icons | High | Medium | P1 |
| Right-click Edit Appearance | High | Medium | P1 |
| Graph-level filters | High | Small | P1 |
| Table column visibility | Medium | Small | P1 |
| Workflow engine | High | Large | P1 |
| Workflow demos (4) | High | Medium | P1 |
| PROV-O temporal projection | Medium | Medium | P2 |
| Derived properties | Medium | Medium | P2 |
| Subgraph pinning | Medium | Small | P2 |
| Minimap | Medium | Medium | P2 |
| Convex hull grouping | Medium | Medium | P2 |
| Data quality indicators | Medium | Small | P2 |
| Context-sensitive menus | Medium | Small | P2 |
| Bulk operations | Medium | Small | P2 |
| Smart suggestions | Low | Large | P3 |
| Multi-graph comparison | Low | Large | P3 |
| Annotation layer | Low | Medium | P3 |
| Temporal playback | Low | Large | P3 |
