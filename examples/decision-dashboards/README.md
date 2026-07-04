# Capability dashboards

Two focused dashboards that foreground parts of the toolkit the four
dev-server scenarios (`pnpm run dev`) don't. The scenarios are domain
stories; these are capability-first, built to cover the gap between what
the scenarios show and what the toolkit provides.

Reference code, not shipped products.

## AnalyticsDashboard

The analytical surface: understanding a graph quantitatively.

- **StatsPanel** over a computed metric (a degree histogram).
- **LinkedChart** in the forms the scenarios never show: a **bar**
  degree distribution and a **scatter** of centrality vs a domain
  property (the scenarios only use a pie).
- **AlgorithmPanel** to run a graph algorithm; results are written onto
  node properties and the views update.
- **DerivedPropertyPanel** to compute a derived property from an
  expression.

The graph is seeded with degree centrality and connected components on
load, and nodes are sized by degree, so the analytical views have real
data immediately. Canvas, table, and charts share the selection store.

## SchemaDashboard

The structural and paradigm surface: understanding the shape of a graph.

- **SchemaView**: the type-level schema (node types, their properties,
  edge types) derived from the data.
- **MatrixView**: the adjacency matrix, which reads dense connectivity a
  node-link layout hides.
- **SankeyView**: type-to-type flow volumes.
- **RDF surface**: a live Turtle serialization of the graph
  (`exportSubgraphTurtle`) and a **QueryEditor** bound to an in-memory
  holonic adapter, making the RDF / property-graph / holonic paradigm
  claim concrete. (The in-memory adapter has no query engine and returns
  the top-level projection; a backend-connected adapter would execute
  the query. The panel says so.)

## Coverage

Between the four scenario shells and these two dashboards, the toolkit's
views (canvas, table, tree, inspector, map, timeline-range, schema,
matrix, sankey, stats, query), chart types (pie, bar, scatter),
encoding/legend/style controls, filtering, search, the graph toolbar,
context-menu actions, SHACL validation and report overlays, the
structural SysML view, custom theming/accents/icons (including raster
icons), graph algorithms, derived properties, and the RDF export are
each demonstrated somewhere.

## Data

Both dashboards run on `buildSupplyNetwork` (a tiered supplier →
part → assembly → product network): typed roles give SchemaView and
SankeyView clear structure, the directed flows make the adjacency matrix
and centrality meaningful, and the numeric `risk` property feeds the
scatter. `satellite-data.ts` remains as a second fixture exercised by
the conformance tests.
