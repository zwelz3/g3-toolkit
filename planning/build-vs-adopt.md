# Build vs. Adopt: FOSS Dependency Analysis

## Wheels We've Already Reinvented

### 1. Graph Algorithms → graphology ecosystem

We wrote `findShortestPath()` as a custom BFS (98 lines). Graphology
(already our UGM foundation) has a maintained ecosystem that covers
every graph algorithm we need:

| Our Custom Code | Replace With | What It Gives Us |
|-----------------|-------------|-----------------|
| `findShortestPath` (BFS only) | `graphology-shortest-path` | Dijkstra, BFS, bidirectional, A*, edge weight support |
| Not implemented | `graphology-metrics` | PageRank, betweenness, closeness, eigenvector, degree centrality |
| Not implemented | `graphology-communities-louvain` | Louvain community detection with modularity |
| Not implemented | `graphology-components` | Connected/strongly-connected components |
| Not implemented | `graphology-layout-forceatlas2` | ForceAtlas2 (Gephi's layout, runs in Web Worker) |

These are all maintained by the Graphology author (Guillaume
Plique, Sciences Po). Same API conventions, same MultiGraph
compatibility. Our UGM already wraps Graphology; these packages
operate directly on the underlying graph instance.

**Impact on M11:** The 8 built-in pipeline functions (M11.E1.T2)
become thin wrappers around graphology-metrics and graphology-
communities-louvain rather than custom algorithm implementations.

**Impact on existing code:** `findShortestPath` (M7.E0.T1) should
be refactored to delegate to `graphology-shortest-path`. Our
`expandNeighbors` BFS can delegate to `graphology-traversal`.

### 2. Statistical Computation → simple-statistics

We planned to write OLS regression (M11.E1.T3). The
`simple-statistics` library (7.8.9, 1.4M weekly downloads, MIT)
provides:

- Linear regression (OLS)
- R-squared
- Standard deviation, variance, median, quantiles
- T-test, chi-squared
- Kernel density estimation
- Bayesian classifier

Cost of maintaining our own: ongoing. Cost of adopting: one
`npm install`. The API is straightforward:

```javascript
import { linearRegression, rSquared } from "simple-statistics";
const reg = linearRegression(points.map(p => [p.x, p.y]));
// reg = { m: slope, b: intercept }
```

**Impact on M11:** M11.E1.T3 (OLS regression) is eliminated as a
ticket. The scatter pipeline function calls `simple-statistics`
directly.

### 3. Multidimensional Filtering → crossfilter2

Our planned PropertyFilter model (M11.E3.T1) is reinventing what
Crossfilter was purpose-built for. Crossfilter (originally by
Square, now community-maintained as crossfilter2) provides:

- Dimensions on any property (numeric, categorical, temporal)
- Fast incremental filtering (bitmap indices)
- Filter on one dimension → all other dimensions update
- Group/reduce operations for aggregation
- Handles 100K+ records at interactive speeds

This is EXACTLY the linked-chart-to-graph filtering pattern:
create a dimension per property, filter one dimension (e.g., brush
a histogram), and all other views instantly reflect the filter.

```javascript
const cf = crossfilter(nodeRecords);
const riskDim = cf.dimension(d => d.risk);
const typeDim = cf.dimension(d => d.type);

// Filter risk > 0.5
riskDim.filterRange([0.5, 1.0]);

// Get filtered records (for table, chart, graph)
const visible = typeDim.top(Infinity);
```

**Impact on M11:** M11.E3.T1 (PropertyFilter model) becomes a
thin adapter around Crossfilter2 rather than a custom filter
evaluator. The FilterBuilder UI still needs to be built, but
the filtering engine underneath is crossfilter2.

**Impact on DataPipeline:** The pipeline's `query()` function
can operate on the crossfilter's current filtered state rather
than the full UGM, making all pipelines filter-aware for free.

### 4. Data Transformation → arquero (consider, don't adopt yet)

Arquero (from the Observable team) is a data frame library for
JS, similar to Python's pandas. It could replace our custom
aggregation logic in pipeline functions with declarative table
operations:

```javascript
import { from } from "arquero";
const table = from(nodeRecords)
  .groupby("type")
  .rollup({ count: d => op.count(), avgRisk: d => op.mean(d.risk) });
```

However, Arquero adds ~150KB to the bundle and its API requires
learning. The benefit is marginal for our use case since
crossfilter2 already handles the filtering, and ECharts handles
the aggregation/grouping internally for chart rendering.

**Recommendation:** Don't adopt now. Revisit if pipeline functions
become complex enough to warrant a data frame abstraction.

## What We Must Still Build Ourselves

These are domain-specific components that no FOSS library provides:

### DataPipeline Interface

No library bridges "graph data model" to "chart-ready data" with
bidirectional selection. This is g3t's unique value proposition.
The interface itself is small (~30 lines of TypeScript); the
built-in implementations wrap graphology + crossfilter.

### LinkedChart Wrapper

The React component that wires a DataPipeline to an ECharts
renderer with Zustand selection store integration. This is
Cytoscape-specific + Zustand-specific + ECharts-specific;
no generic library covers this combination.

### ViewFilter

Graph-aware visibility control ("show only 2-hop neighborhood
of selected nodes") requires traversal logic that crossfilter2
can't express. We need this as a thin layer between the UGM and
all renderers.

### NodeStyleOverride + SVG Icons

Cytoscape-specific per-node visual customization. No library
provides this; it's a stylesheet merge over Cytoscape's styling
API.

### WorkflowRunner

The analytical workflow state machine is domain-specific. No
generic workflow library (e.g., XState) fits because our state
includes a graph data model, chart configurations, and filter
states.

## Revised M11 Ticket Impact

| Original Ticket | Status | Change |
|-----------------|--------|--------|
| M11.E1.T1 DataPipeline interface | Keep | No change |
| M11.E1.T2 8 built-in pipelines | Simplify | Implementations wrap graphology-metrics + simple-statistics |
| M11.E1.T3 OLS regression | **Eliminate** | Use simple-statistics |
| M11.E2.T1 LinkedChart | Keep | No change |
| M11.E2.T2-T6 Chart renderers | Keep | No change (ECharts) |
| M11.E3.T1 PropertyFilter | **Simplify** | Adapter around crossfilter2 |
| M11.E3.T2 FilterBuilder UI | Keep | No change |
| M11.E3.T3 Graph-level filters | Keep | ViewFilter is domain-specific |
| M11.E4.T1-T2 Table enhancements | Keep | No change |

Net ticket reduction: 14 → 12 (eliminate 1, simplify 2).

## New Dependencies

| Package | Version | Size | Downloads/wk | License | Maintained |
|---------|---------|------|-------------|---------|------------|
| graphology-shortest-path | 2.1.0 | 12KB | 45K | MIT | Yes (2024) |
| graphology-metrics | 2.4.0 | 28KB | 38K | MIT | Yes (2024) |
| graphology-communities-louvain | 2.0.2 | 8KB | 22K | MIT | Yes (2024) |
| graphology-components | 1.5.4 | 6KB | 30K | MIT | Yes (2024) |
| crossfilter2 | 1.5.4 | 32KB | 18K | Apache 2.0 | Yes (2023) |
| simple-statistics | 7.8.9 | 45KB | 1.4M | ISC | Yes (2024) |

Total added bundle: ~131KB (before tree-shaking). All MIT/Apache/ISC.
All have >18K weekly downloads. All maintained within the last year.

## Recommendation

Adopt all six packages. The engineering cost of maintaining custom
graph algorithms, statistical functions, and multidimensional
filtering is far higher than the cost of depending on established,
well-tested libraries that are already compatible with our stack
(graphology ecosystem) or trivially integratable (crossfilter2,
simple-statistics).

The custom code we keep is the graph-to-visualization glue: the
DataPipeline interface, LinkedChart wrapper, ViewFilter, and
domain-specific UI components. This is the actual value the toolkit
provides; the algorithms and statistics underneath should be
somebody else's maintenance burden.
