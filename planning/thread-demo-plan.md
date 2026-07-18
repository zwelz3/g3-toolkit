# Thread demo plan (digital thread, RDF projections, ontology viewer)

A new self-contained demo surface, `scripts/thread-demo`, built and
published the same way as `scripts/demo` (its own vite config + inline step,
a `pnpm run thread-demo` script, managed from day one with tests + tsconfig
/ vitest include + docs publish). Three views: Digital Thread, Instance
Graph, Ontology. This document is the plan; the first slice ships alongside.

## Toolkit primitives leveraged (build-vs-reuse)

The toolkit already carries most of what these views need; the demo is
mostly composition plus a few small new transforms.

- Projection (`@g3t/core`): `ProjectionPipeline.project(RDFGraph): UGM`,
  transforms `typeCollapse` / `literalCollapse` / `blankNodeCollapse` /
  `listCollapse` / `reificationCollapse`, presets `standard` / `ontology` /
  `provenance-preserving`, and `checkRenderPermission` (the ViewRouter gate
  that blocks raw RDF from normal renderers). This is the engine for the
  Instance Graph projection levels.
- Relational virtualizer (`@g3t/core`): `virtualizeRelationalData(ugm, rows,
{keyField})` and `parseCSV`. Demonstrates the live SQL/CSV -> RDF data
  flow that the Digital Thread diagram describes.
- SHACL (`@g3t/core`): `validateShacl`, `shaclShapesToStructural`,
  `shaclRowSeverities`, `reportFromValidationResults`. Drives the health
  toggle and the ontology view's constraint display.
- Structural / ELK (`@g3t/core`): `shaclShapesToStructural` and
  `layoutStructural` (compartmented containers, rows, ports, obstacle-aware
  routing). The basis for the Digital Thread layout.
- `SchemaModel` ({nodeTypes, edgeTypes, nodeProperties}) and the existing
  `SchemaView` approach inform the Ontology viewer; the viewer is built
  fresh (richer than SchemaView, and SchemaView is not barrel-exported).

New code (small): a `selectiveObjectCollapse` transform (L3), an ontology
model (classes with subClassOf, object/datatype properties with
domain/range, annotations, Wikidata alignments), and the thread layout
builder.

## Shared data model (feeds all three views)

A single small multi-source dataset, `dataset.ts`, expressed as RDF triples
with per-subject source provenance. Four sources, at least one each:

- SQL (Ontop VKG virtualization): an `asset` table virtualized to RDF via
  an OBDA-style mapping (table + columns + pk/fk).
- Excel/CSV (csv2rdf materialization): a multi-sheet workbook (e.g.,
  `suppliers`, `shipments`) materialized to triples.
- Native RDF: a hand-authored knowledge graph (the ontology-aligned core).
- Wikidata (federation augmentation): a few subjects with `owl:sameAs` /
  `owl:equivalentClass` links pulled in by federation.

Provenance is carried as a reified per-triple/per-subject `source` tag so a
subject can belong to more than one source (see Instance Graph coloring).
The dataset also carries the OWL+SHACL ontology used by all three views.

## View 1: Digital Thread (modified ELK)

A layered structural diagram of the integration pipeline, laid out with the
ELK structural engine. Layers (left to right or top to bottom) are pipeline
STAGES; color encodes SOURCE provenance:

- Stage 1 source schemas: a SQL-table container (column rows, pk/fk ports),
  an Excel-workbook container (one compartment per sheet), the native-RDF
  marker, and a Wikidata marker.
- Stage 2 mappings: OBDA mapping nodes (SQL), csv2rdf mapping nodes (Excel),
  each edge labeled with the mapping kind; pk/fk edges within the SQL table.
- Stage 3 RDF concepts: the materialized/virtualized classes and properties.
- Stage 4 ontology: the OWL classes and SHACL shapes, with explicit
  `owl:equivalentClass` / `sameAs` edges to Wikidata marking augmentation.

Required representations: A (RDB table+column+OBDA pk/fk), B (Excel
multi-sheet workbook mapping), C (SHACL+OWL with explicit Wikidata mappings),
D (health toggle). "Modified ELK" = the structural input is shaped into
these stages with source-lane coloring and the cross-stage mapping edges;
the layout itself is `layoutStructural`.

Toggles: (1) source provenance, filtering to a single source (e.g., show
only the virtualization layer); (2) SHACL health overlay (passing / info /
warning / violation), reusing `shaclRowSeverities` to badge the concept and
shape rows.

## View 2: Instance Graph (projection levels)

The native+materialized RDF instances, rendered through `ProjectionPipeline`
at three levels:

- L1 raw RDF: the unprojected triple graph (literals and types as nodes/
  edges). Gated as the raw/inspector view (the ViewRouter exemption).
- L2: `literalCollapse` folds data properties onto nodes; object edges and
  rdf:type remain.
- L3: L2 plus a new `selectiveObjectCollapse` that keeps a selectable subset
  of object predicates as edges and folds the rest onto the source node as a
  property.

Each level independently toggles instances, ontology, or both. Nodes are
colored by source; a subject present in more than one source gets a split /
multi-source treatment (proposed: a pie/striped fill keyed to the set of
contributing sources, with the dominant source as the base, plus a
"multi-source" legend entry). A subgraph can be opened in two side-by-side
canvases at different projection levels (same data, different projection).
Size guard: a default node/edge cap with a "render anyway" override, using
`checkRenderPermission` plus a simple element-count threshold so we never
auto-render an oversized graph.

## View 3: Ontology viewer (read-only, Protege-like)

A read-only browser over the OWL+SHACL ontology:

- Left: a tree browser with tabs for Classes (subClassOf hierarchy),
  Object Properties, Data Properties, and Individuals.
- Right: a detail pane for the selected entity: annotations (rdfs:label,
  rdfs:comment, skos:definition), characteristics (domain/range,
  super/sub), the SHACL constraints targeting it (from the shapes), and
  Wikidata alignment links.
- No editing. Built on the ontology model + the core SHACL shapes.

## Build / test / docs (managed from the start)

Mirror `scripts/demo`: `vite.thread.config.ts` + `scripts/thread-demo/
inline.mjs` -> `thread-demo.html`; `pnpm run thread-demo`. Add the surface
to the tsconfig and vitest include globs, land tests (the dataset and the
projection levels are pure and deterministic; a cytoscape-mocked component
test for each view's non-canvas contract), and publish to `docs-out/thread/`
in `docs:build` with a landing card. Coverage picks it up via the existing
`scripts/**` patterns once added.

## Priority ordering

- P0: scaffold + shared dataset + Digital Thread foundation (the headline,
  the riskiest layout), built and verified. (This slice.)
- P1: Instance Graph projection levels (L1/L2/L3, source coloring,
  dual-view, size guard) and the SHACL health + provenance toggles on the
  thread view.
- P1: Ontology viewer (tree + tabs + detail/annotations + SHACL).
- P2: multi-source split-fill polish, federation animation, RDF/turtle
  export of a selected subgraph, docs landing card.

## Risks / unknowns to confirm

- ELK stage layering: structural containers support internal compartments
  but not obviously nested source lanes; the first slice will confirm
  whether stage layering + color is enough or whether lane grouping needs a
  layout tweak.
- Raw L1 rendering vs the ViewRouter gate: confirm the raw triple view is
  allowed through the inspector exemption rather than blocked.
- Multi-source subject encoding on a cytoscape node (pie/stripe) is a custom
  style; confirm it renders acceptably before committing to it.
