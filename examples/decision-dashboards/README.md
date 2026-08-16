# Capability dashboards

One capability-first dashboard that foregrounds parts of the toolkit the
domain scenarios (`pnpm run dev`) don't. The scenarios are domain
stories; this is built to cover the gap between what they show and what
the toolkit provides.

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
- **MatrixView** in the rail: the adjacency matrix, which reads dense
  connectivity a node-link layout hides.
- **SankeyView** on its own tab: type-to-type flow volumes.

The graph is seeded with degree centrality and connected components on
load, and nodes are sized by degree, so the analytical views have real
data immediately. Canvas, table, and charts share the selection store.

The last two arrived here when the Schema Dashboard was retired
(`planning/schema-dashboard-retirement.md`): the maintainer ruling
judged that standalone surface redundant, since the Ontology Workbench
carries the structure-and-paradigm narrative live over a store, and the
two distinctive visualizations needed a demonstration home with more
context rather than a page of their own. `SchemaView` was already
covered by a Storybook story, and the RDF side panel was explanatory
text over no public API, so neither moved here.

## Coverage

Between the scenario shells and this dashboard, the toolkit's views
(canvas, table, tree, inspector, map, timeline-range, schema, matrix,
sankey, stats, query), chart types (pie, bar, scatter),
encoding/legend/style controls, filtering, search, the graph toolbar,
context-menu actions, SHACL validation and report overlays, the
structural SysML view, custom theming/accents/icons (including raster
icons), graph algorithms, derived properties, and the RDF export are
each demonstrated somewhere.

## Data

The dashboard runs on `buildSupplyNetwork` (a tiered supplier → part →
assembly → product network): typed roles give the sankey clear
structure, the directed flows make the adjacency matrix and centrality
meaningful, and the numeric `risk` property feeds the scatter.
`satellite-data.ts` remains as a second fixture exercised by the
conformance tests.
