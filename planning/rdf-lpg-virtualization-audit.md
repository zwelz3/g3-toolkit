# RDF / LPG / virtualization — capability audit

An honest accounting of what the toolkit supports **today** versus where
it needs to go, for the data-paradigm and scale dimensions. Written so a
new agent (or an evaluating adopter) is not surprised by a gap. Verified
against the source on 2026-06-17, not against memory.

Status legend: **Shipped** (works, tested) · **Partial** (works for a
subset; real gaps) · **Gap** (not built; roadmapped or open).

---

## RDF / semantic graph

| Capability                     | Status      | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SPARQL endpoint adapter        | **Partial** | `SparqlAdapter` is a real HTTP client (middleware-capable) with a `bindingsToUGM` parser. It parses **SELECT bindings** (subject/predicate/object rows) into UGM nodes/edges, and has `expandNeighborhood`. What is NOT covered: CONSTRUCT/DESCRIBE returning an RDF graph (vs. a bindings table), full SPARQL result-shape handling, and rich RDF-term typing (language tags, typed literals, blank-node round-trips). It assumes an s/p/o-shaped SELECT.         |
| Turtle export                  | **Partial** | `exportSubgraphTurtle` emits valid Turtle with a stable base IRI, `rdf:type` per node type, `rdfs:label` from the name property, and `prov:` prefix wired. It is a pragmatic serialization, not a full RDF mapping: property values are emitted simply, datatyped-literal fidelity and blank-node structure are limited, and there is no configurable IRI/prefix strategy yet. Good enough to demonstrate "your graph is RDF"; not a conformance-grade serializer. |
| SHACL validation report        | **Shipped** | `validateShacl` + `reportFromValidationResults` produce a conformance report; the React side renders it (severity overlays on the data graph, shape browser, three-tier sh:severity). This is genuinely built and gate-covered.                                                                                                                                                                                                                                    |
| SHACL shapes **parser** (RDF)  | **Gap**     | The validator works against shapes expressed in the toolkit's internal form. Parsing **arbitrary RDF SHACL shapes** (`sh:class`, `sh:node`, logical operators, property paths, target declarations) is NOT built. The bounds are documented in the coverage matrix in `roadmap/design/shacl-views.md` (this is the fuller R1.16). This is the single biggest RDF-side gap.                                                                                         |
| OWL / RDFS reasoning           | **Gap**     | No inference engine in the toolkit. Doctrine is "results, not computation": reasoning is expected to happen in an external triplestore/reasoner and arrive as data. No materialization, no entailment.                                                                                                                                                                                                                                                             |
| Named graphs / quads / context | **Gap**     | The UGM is a single property graph; named-graph/quad context is not a first-class concept. Provenance is modeled as properties/edges, not as RDF context.                                                                                                                                                                                                                                                                                                          |

**Net:** the toolkit can _talk to_ a SPARQL endpoint for SELECT-shaped
data and can _emit_ demonstrative Turtle, and it has real SHACL
**validation/reporting**. It is NOT a full RDF stack: no shapes parser,
no reasoning, no quads, limited term typing. For the flagship this is
fine (the demo's RDF surface is the Turtle export + the
validation/provenance story), but the audit should be cited honestly if
an adopter asks "is this a SPARQL/RDF client I can point at my
triplestore?" — the answer is "for SELECT bindings, yes; for full RDF
semantics, not yet."

---

## LPG (labeled property graph)

| Capability                | Status      | Reality                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property-graph data model | **Shipped** | `UGM` is a labeled property graph (typed nodes/edges, arbitrary properties) over Graphology. This is the native model; everything else projects into it.                                                                                                                                                                                                                                        |
| Cypher adapter            | **Partial** | `CypherAdapter` is a real HTTP client with a result parser and middleware. Coverage of the full Neo4j HTTP result shape (nested paths, maps, projections) is the open question; it handles the common row/column shape. Not tested against a live Neo4j in CI.                                                                                                                                  |
| Gremlin adapter           | **Partial** | `GremlinAdapter` exists with a parser and middleware, same caveat: parses a common response shape, not the full GraphSON variety.                                                                                                                                                                                                                                                               |
| REST adapter              | **Partial** | `RestAdapter` maps a generic JSON endpoint to UGM. Useful as the "bring your own backend" path; the mapping assumptions are the limiting factor.                                                                                                                                                                                                                                                |
| Holonic adapter           | **Partial** | `HolonicAdapter` builds the four-graph holarchy projection. The **in-memory variant has no query engine** — it explicitly ignores the query string and returns the top-level holarchy projection (it warns). A backend-connected holonic source would execute queries; the in-memory one is for projection/demonstration. The flagship's QueryEditor uses this and the demo is honest about it. |

**Net:** LPG is the native strength. The adapters are real HTTP clients,
but each parses a _common_ response shape rather than the full breadth
of its protocol, and none are exercised against a live backend in CI
(they are unit-tested against mocked responses). "Production-ready
against my specific Neo4j/Gremlin server" needs validation per backend.

---

## Virtualization / scale

This is the area with the most drift between docs and code, and it needs
the most honesty.

| Capability                         | Status                                  | Reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Incremental layout                 | **Shipped (core)**                      | `computeIncrementalUpdate`, `applyIncrementalLayout`, `capturePositions`, and an `IncrementalLayout` class exist and are exported from `@g3t/core`. They support adding/positioning new nodes without re-running a full layout (position stability).                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Relational virtualizer             | **Shipped (core), descoped in roadmap** | `virtualizeRelationalData` + `parseCSV` are exported from `@g3t/core`. NOTE THE DRIFT: STATUS.md/CLAUDE.md say "relational connectors removed" and "virtualization rescoped to visualization-only." The _code_ is still present and exported. The reconciliation (confirmed from CHANGELOG): what was **removed from the roadmap** was relational _connectors_ as a tracked future deliverable and the broad virtualization scope; the existing utility function was not deleted. An agent should treat the roadmap as "not investing further here," not "this does not exist." **Flag for the maintainer: decide whether to keep exporting these or deprecate them, and align the docs.** |
| Viewport culling / level-of-detail | **Gap**                                 | No render-time virtualization (culling off-screen nodes, LOD simplification at zoom). Large-graph rendering relies on Cytoscape's own performance. The design exploration is in `planning/large-graph-design.md` (approaches sketched; "Approach 1 should be implemented first" — i.e. not yet done).                                                                                                                                                                                                                                                                                                                                                                                      |
| Server-side / windowed loading     | **Gap**                                 | No pagination/lazy-window loading of a large remote graph into the canvas. The adapters fetch a query's full result; there is no cursor/window abstraction for streaming a huge graph in slices.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Table/tree virtualization          | **Partial**                             | `TableView` paginates (pageSize); `TreeView` lazy-expands by depth. These are list-level affordances, not graph-canvas virtualization.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Streaming / live updates           | **Gap**                                 | No subscription/streaming ingest (live graph updates). Roadmapped, not built.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

**Net:** there are real _incremental-layout_ primitives and a
_relational virtualizer utility_, but there is **no canvas-level
virtualization** (culling, LOD, windowed loading) — so "does it render a
million-node graph smoothly" is **not** a yes today. The honest framing:
the toolkit handles graphs up to Cytoscape's comfortable range, has
position-stable incremental updates, and has design work (not
implementation) for true large-graph virtualization. The roadmap
deliberately scoped virtualization down to _visualization affordances_
(the rescope STATUS references); genuine scale work is future.

---

## Documentation drift found during this audit (fix these)

These are factual inconsistencies a new agent would trip on. Captured
here and corrected in STATUS.md / CLAUDE.md as part of the same
housekeeping pass.

1. **Sankey.** STATUS.md and CLAUDE.md say "Sankey was REMOVED
   2026-06-12." `SankeyView` **exists, is tested, and is in the public
   barrel** (and the new SchemaDashboard uses it). What was removed was
   the _roadmap entry_ (because it had shipped, R1.9) — not the
   component. The phrasing reads as deletion. **Corrected** to "Sankey
   shipped (R1.9); removed from the roadmap as a pending item."
2. **Virtualization / relational connectors.** Docs say "removed" /
   "rescoped"; `virtualizeRelationalData`, `parseCSV`, and the
   incremental-layout API are still exported. Reconciled above; STATUS
   updated to distinguish "removed from roadmap investment" from
   "removed from the codebase."
3. **Capability inventory dating.** STATUS.md's inventory header says
   "rounds 1-31" but the toolkit is well past that (SHACL B-series,
   structural rendering, the demo overhaul, the icon raster passthrough,
   the dashboards rework). The inventory body is largely accurate; the
   header dating misleads. **Corrected.**
4. **Counts.** Per the standing rule (CLAUDE.md), when a hand-maintained
   count disagrees with a gate script, the script wins. The test count
   (841 at last sweep) and the requirement rollup should always be
   re-derived from gates, never trusted from prose.

---

## Bottom line for the flagship

The flagship's data-paradigm story rides on what IS shipped: the LPG
core model, the Turtle export (demonstrative RDF), SHACL
validation/reporting, and provenance-as-graph. It deliberately does NOT
depend on the gaps (no shapes parser, no reasoning, no canvas
virtualization, no live SPARQL semantics in the in-memory adapter). The
demo's honesty line — illustrative analytics, real composition and
provenance — is consistent with this audit: the toolkit's genuine,
demonstrable strength is the composable projection/encoding/provenance
surface over an LPG, with adapters that reach common RDF/LPG backends
for SELECT-shaped data.
