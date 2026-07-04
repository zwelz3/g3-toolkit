# Capabilities and limits

An honest map of what g3-toolkit does today, where support is partial,
and where it is not built yet. The goal is that you can decide whether
the toolkit fits your data and your scale before you integrate, not
after. This page is assessed against the source, not against marketing;
the deeper internal accounting it distills is in
[`planning/rdf-lpg-virtualization-audit.md`](../planning/rdf-lpg-virtualization-audit.md).

Status legend: **Shipped** (built and tested); **Partial** (works for a
common subset, with real gaps); **Gap** (not built; design or roadmap
only).

## What g3-toolkit is

g3-toolkit is a component library, not an application framework. Its
native data model is a labeled property graph (the UGM): typed nodes and
edges carrying arbitrary properties. Everything else (RDF, relational,
holonic) projects into that model. The demonstrable strength is the
composable surface over an LPG: projection, encoding, cross-view
selection, and provenance modeled as graph. For semantics it follows a
"results, not computation" doctrine: reasoning and entailment are
expected to run upstream (in a triplestore or reasoner) and arrive as
data.

## RDF and semantic graphs

| Capability                          | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPARQL endpoint adapter             | Partial | `SparqlAdapter` is a real HTTP client (middleware-capable) with neighborhood expansion. It parses SELECT bindings (subject/predicate/object rows) into the graph. It does not handle CONSTRUCT/DESCRIBE results that return an RDF graph, the full SPARQL result shape, or rich RDF-term typing (language tags, typed literals, blank-node round-trips). Point it at SELECT-shaped data, not at full RDF semantics. |
| Turtle export                       | Partial | `exportSubgraphTurtle` emits valid Turtle (stable base IRI, `rdf:type` per node type, `rdfs:label` from the name, `prov:` prefix wired). It is a pragmatic serialization, not a conformance-grade RDF mapping: datatyped-literal fidelity and blank-node structure are limited, and the IRI/prefix strategy is not yet configurable.                                                                                |
| SHACL validation and reporting      | Shipped | `validateShacl` and `reportFromValidationResults` produce a conformance report; the React side renders severity overlays on the data graph, a shape browser, and three-tier `sh:severity`.                                                                                                                                                                                                                          |
| SHACL shapes parser (arbitrary RDF) | Gap     | The validator runs against shapes expressed in the toolkit's internal form. Parsing arbitrary RDF SHACL (`sh:class`, `sh:node`, logical operators, property paths, target declarations) is not built. This is the largest RDF-side gap; the bounds are in [`roadmap/design/shacl-views.md`](../roadmap/design/shacl-views.md).                                                                                      |
| OWL / RDFS reasoning                | Gap     | No inference engine in the toolkit. By design, reasoning happens externally and arrives as data; there is no materialization or entailment.                                                                                                                                                                                                                                                                         |
| Named graphs / quads / context      | Gap     | The model is a single property graph. Named-graph and quad context is not first-class; provenance is modeled as properties and edges, not as RDF context.                                                                                                                                                                                                                                                           |

In short: the toolkit can talk to a SPARQL endpoint for SELECT-shaped
data, can emit demonstrative Turtle, and has real SHACL validation and
reporting. It is not a full RDF stack (no shapes parser, no reasoning, no
quads, limited term typing). If the question is "can I point this at my
triplestore as an RDF client?", the answer is yes for SELECT bindings,
not yet for full RDF semantics.

## Labeled property graphs (LPG)

| Capability                | Status  | Notes                                                                                                                                                                                                                                      |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Property-graph data model | Shipped | The UGM is a labeled property graph (typed nodes and edges, arbitrary properties) over Graphology. It is the native model; everything projects into it.                                                                                    |
| Cypher adapter            | Partial | `CypherAdapter` is a real HTTP client with a result parser and middleware. It handles the common row/column shape; full Neo4j HTTP coverage (nested paths, maps, projections) is open, and it is not exercised against a live Neo4j in CI. |
| Gremlin adapter           | Partial | `GremlinAdapter` parses a common GraphSON response shape, not the full variety.                                                                                                                                                            |
| REST adapter              | Partial | `RestAdapter` maps a generic JSON endpoint to the graph (the "bring your own backend" path); the mapping assumptions are the limiting factor.                                                                                              |
| Holonic adapter           | Partial | `HolonicAdapter` builds the four-graph holarchy projection. The in-memory variant has no query engine (it returns the top-level projection and warns); a backend-connected holonic source would execute queries.                           |

LPG is the native strength. The adapters are real HTTP clients, but each
parses a common response shape rather than the full breadth of its
protocol, and none are exercised against a live backend in CI (they are
unit-tested against mocked responses). "Production-ready against my
specific Neo4j or Gremlin server" needs validation per backend.

## Scale and virtualization

| Capability                         | Status  | Notes                                                                                                                                                                                                                              |
| ---------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incremental layout                 | Shipped | `computeIncrementalUpdate`, `applyIncrementalLayout`, `capturePositions`, and an `IncrementalLayout` class (exported from `@g3t/core`) add and position new nodes without a full re-layout, preserving position stability.         |
| Relational virtualizer utility     | Shipped | `virtualizeRelationalData` and `parseCSV` are exported from `@g3t/core`. They remain available, but are not an area of active roadmap investment.                                                                                  |
| Table / tree virtualization        | Partial | `TableView` paginates (pageSize); `TreeView` lazy-expands by depth. These are list-level affordances, not graph-canvas virtualization.                                                                                             |
| Viewport culling / level-of-detail | Gap     | No render-time virtualization (culling off-screen nodes, level-of-detail at zoom). Large-graph rendering relies on Cytoscape's own performance. Approaches are sketched in `planning/large-graph-design.md`; none are implemented. |
| Server-side / windowed loading     | Gap     | No pagination or lazy-window loading of a large remote graph into the canvas. Adapters fetch a query's full result; there is no cursor or window abstraction for streaming a graph in slices.                                      |
| Streaming / live updates           | Gap     | No subscription or streaming ingest of live graph updates.                                                                                                                                                                         |

The honest framing on scale: the toolkit handles graphs up to
Cytoscape's comfortable range, has position-stable incremental updates,
and has design work (not implementation) for true large-graph
virtualization. "Does it render a million-node graph smoothly?" is not a
yes today. Virtualization was deliberately scoped to visualization
affordances; genuine scale work is future.

## Boundaries, stated plainly

If your evaluation depends on any of the following, the toolkit does not
provide it today:

- A parser for arbitrary RDF SHACL shapes (the validator uses an internal shape form).
- OWL/RDFS reasoning or entailment inside the toolkit (run it upstream; pass results as data).
- Named graphs, quads, or RDF context as first-class concepts.
- CONSTRUCT/DESCRIBE RDF-graph results, or full RDF-term typing, from the SPARQL adapter.
- Canvas-level virtualization: off-screen culling, level-of-detail, or windowed/streaming loading.
- A validated, production-grade adapter for a specific Neo4j/Gremlin/REST backend (validate per backend; CI uses mocked responses).

## Choosing g3-toolkit

It fits well when you have an LPG (or SELECT-shaped RDF or relational
data you can project into one), you want composable views with cross-view
selection, encoding, and provenance, and your reasoning and validation
run upstream and arrive as data. It is not the right tool yet if you need
an in-process RDF reasoner, a full SHACL-over-RDF shapes engine, or smooth
rendering of graphs beyond Cytoscape's comfortable range without your own
virtualization layer.

For the integration mechanics once you have decided, see
[`docs/wiring-guide.md`](wiring-guide.md); every snippet there runs in CI.
