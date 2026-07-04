# Capability Landscape: Graph Tooling Decomposed Against the Toolkit

**Status:** survey of record for the v1.0 gap analysis round 2.
Peer to use-case-survey.md (which defined capability clusters C1-C8)
and technology-survey.md. Requirement adoptions sourced from this
document carry `rationale: Capability landscape` and cite the section.

## A. Systems surveyed

| Category | Systems | What they prove users pay for |
|---|---|---|
| Graph analytics / investigation | Neo4j Bloom, Linkurious Enterprise, i2 Analyst's Notebook, Maltego, Palantir Gotham, GraphXR, Gephi | Canvas-first exploration, expand/filter, algorithm overlays, case artifacts (reports, bookmarks) |
| Graph database consoles | Neo4j Browser/Workspace, GraphDB Workbench, Stardog Studio, Memgraph Lab, TigerGraph GraphStudio, AllegroGraph Gruff, Tentris (headless SPARQL; proof that a fast endpoint without tooling pushes the UI burden onto exactly this toolkit) | Query editor with autocomplete, saved queries and history, result grid, schema browsing, dataset administration |
| Knowledge graph management | Stardog Explorer/Designer, TopBraid EDG, metaphactory, PoolParty, WebProtégé, Palantir Foundry ontology layer | Schema-driven entity forms, SHACL-governed editing, change management and approval, provenance, model documentation |
| Concept trackers | Wikipedia/Wikidata, IMDb, MusicBrainz | Entity page as the unit of consumption; revision history and diffs; watch/contribute/review loops; identity merge workflows |
| Enterprise decision support | Foundry object explorer + writeback, Tableau/Power BI linked dashboards | Linked multi-view workspaces, drill-down, operational write paths with governance |

## B. Workflows and their tooling demands

W1 **Data curation:** ingest/map, validate (SHACL), entity
resolution/merge, enrich, review and approve changes, provenance audit.
W2 **Concept editing:** consume an entity as a page; edit through
schema-driven forms; see history; discuss/flag; watch.
W3 **Querying:** author (highlighting, autocomplete from schema),
iterate (history), institutionalize (saved, parameterized, shared),
inspect results (grid, graph), explain (plans where backends offer).
W4 **Graph analytics:** run or import algorithm results; visualize
property-shaped results (centrality sizing, community hulls) AND
structure-shaped results (shortest-path trees, spanning trees, ego
networks, k-cores as subgraphs); compare runs.
W5 **Visualization/exploration:** the C1-C8 cluster material; covered
at length in use-case-survey.md and not re-derived here.
W6 **Data science:** results to dataframes/CSV, embedding projection
with lasso-to-selection, feature tables joined to entities,
model-output overlay.
W7 **Governance/administration:** access control, audit, tenancy,
dataset and named-graph lifecycle.

## C. Tiered decomposition and coverage

Tiers follow atomic design adapted to this codebase: **atoms**
(primitive UI elements), **molecules** (widgets composed of atoms),
**compounds** (the published components and views; the toolkit's unit
of value), **shells** (application assemblies; reference
implementations only, per ARCHITECTURE.md's toolkit-not-framework
boundary).

Coverage states: HAVE (implemented, spec-cited tests), PARTIAL
(exists; acceptance unproven or scope incomplete; owning roadmap file
noted), ROADMAP (planned; owner noted), CANDIDATE (gap identified by
this survey; adoption decision in section E), OUT (application-level
by the ARCHITECTURE boundary test; belongs in shells/examples).

### C.1 Atoms

Badges (validation, count, classification), chips, swatches, status
pills, legend items, breadcrumb items, severity icons: HAVE,
distributed through the theme tokens and existing widgets. No atom-
level gaps surfaced; every surveyed system's atoms are stylistic
variants of the same set. Atoms are not tracked further.

### C.2 Molecules

| Molecule | Landscape exemplar | State |
|---|---|---|
| Search bar (fuzzy, property-aware) | Bloom search | HAVE (SearchBar) |
| Facet filter, filter builder | Linkurious filters | HAVE |
| Property field with validation | EDG forms | HAVE (PropertyEditor field) |
| Temporal slider with playback controls | i2 timeline bar | HAVE (controls); playback semantics ROADMAP (engineering/temporal-playback.md, R2.10) |
| Query input with syntax highlighting | every console | HAVE (QueryEditor molecule layer, R1.13) |
| Schema-driven autocomplete popover | Stardog Studio, Neo4j Browser | ROADMAP (R1.13 SHOULD clause; tracked with R1.13's owner) |
| Saved-query list item, history row | GraphDB Workbench, Neo4j Browser | CANDIDATE (E.3) |
| Revision/diff row | Wikidata history | CANDIDATE (E.2) |
| Violation list item (severity-grouped) | TopBraid validation | HAVE (ShaclShapeBrowser internals) |
| Pagination, zoom, status bar, tooltip, shortcut modal | universal | HAVE |

### C.3 Compounds

| Compound | Landscape exemplar | State |
|---|---|---|
| Link-chart canvas (layouts, lasso, context menu) | Bloom, Linkurious | HAVE (CytoscapeCanvas, R1.1) |
| Result/data grid | all consoles | HAVE (TableView, R1.7) |
| Detail/provenance inspector | Foundry object panel | HAVE (R1.11; PROV-O via M13) |
| Schema/ontology view with SHACL overlays | Stardog Designer, Gruff | HAVE (SchemaView + ShaclShapeBrowser, R1.5, R5.5) |
| Graph diff | EDG change views | HAVE (DiffRenderer, R1.10) |
| Query editor (execute, populate views) | all consoles | HAVE (R1.13) |
| Timeline, map, matrix, tree, stats, sankey | i2, Linkurious, Gephi | PARTIAL (verification/view-acceptance.md, R1.2/3/4/6/8/9) |
| Community overlay (clustering visualization) | Bloom GDS integration, Gephi modularity coloring | HAVE (R1.14) |
| Path analysis (shortest path highlight, constraints) | i2 find-path, Linkurious | HAVE (R2.13) |
| **Algorithm subgraph overlay** (spanning trees, path trees, ego networks, k-cores rendered as highlighted substructure) | Gephi MST, Bloom GDS path results, GraphXR | **CANDIDATE (E.4): the property-shaped result protocol (R3.5) cannot represent structure-shaped results** |
| Embedding projector (scatter + brush + lasso-to-selection) | TensorBoard projector, GraphXR | PARTIAL: scatter+brush+selection exist (LinkedChart, R1.8 pipeline); a dimensionality-reduction step is the data-science user's job per P1 (results in, computation out); document the recipe, no new component |
| **Entity page** (schema-grouped properties, inbound/outbound relations, human-readable concept view) | Wikipedia/Wikidata, IMDb title page, Stardog Explorer, Foundry object view | **CANDIDATE (E.1): the single most universal compound in the concept-tracker and KG categories; the toolkit has no consumption-oriented entity view, only the inspector (debug-oriented)** |
| **Change history / review queue** | Wikidata history + watchlist review, EDG change management | **CANDIDATE (E.2), gated on write-back** |
| Inline editing with validation | EDG, Foundry writeback | PARTIAL (engineering/write-back.md, R2.12) |
| Export (Turtle/JSON-LD/CSV/image) | all | ROADMAP (engineering/export-reporting.md, R2.11) |
| Streaming view | operational dashboards | ROADMAP (engineering/streaming.md, R3.6/R7.6) |
| Federation (multi-source merged canvas) | metaphactory, Foundry | ROADMAP (architecture/data-layer.md, R6.2) |
| NL-to-query | Neo4j Workspace, Stardog Voicebox | ROADMAP design gate (OQ3/D10) |
| Document linkage and previews | i2, Foundry | ROADMAP (engineering/document-linkage.md, R3.8/R6.3) |

### C.4 Shells (application-level; OUT of packages by design)

Curation workbench (validation queue + entity forms + review),
query console (editor + history + saved library + results),
entity browser (search + entity pages + watch), investigation
workspace (exists: examples/full-workspace), operations dashboard
(streaming + status). The boundary test from ARCHITECTURE.md holds
for all of these: adopters configure or replace them. The toolkit's
obligation is that the compounds above compose into each shell
without forks; the demo overhaul (Phase 4) should add a curation
shell and a query-console shell to prove composition, which is demo
work, not package work.

Also OUT, with reasons: watchlists/notifications and discussion
threads (require server-side state and identity; concept-tracker
features, application-tier); dataset/named-graph administration
(backend console territory; GraphDB Workbench and Stardog Studio own
this because they ship the database); query plan visualization
(backend-specific EXPLAIN formats; revisit if two adapters can share
a normalized plan shape).

## D. Paradigm and standards assurance

The user-facing promise is RDF, LPG, and virtualized RDBMS over one
view layer, with SPARQL and SHACL first-class and algorithm
visualization for both property- and structure-shaped results.
Current standing:

| Commitment | Mechanism | State |
|---|---|---|
| RDF | SparqlAdapter + ProjectionPipeline (5 collapses, presets) | HAVE (R3.4a, R4.1-R4.6 implemented) |
| LPG | CypherAdapter, GremlinAdapter, UGM/Qualified Edge (D1) | HAVE (R3.4b) |
| Virtualized RDBMS | RelationalVirtualizer join-by-key into UGM | PARTIAL (R3.7/R6.1; verification/data-layer-acceptance.md, including the JDBC-vs-result-shape scope pin) |
| Holonic | In-memory adapter; backend pending | PARTIAL (architecture/holonic-backend.md, R5.1) |
| SPARQL | Adapter implemented; editor implemented (R1.13); autocomplete pending; saved queries CANDIDATE | HAVE core, gaps tracked |
| SHACL | Validator, shape browser, schema overlays, membrane badges | HAVE (R1.5, R5.5); commit-time validation pending (R2.12) |
| Algorithms: property-shaped (centrality, community, scores) | R3.5 ingestion + encoding channels + R1.14 overlay + stats panel | HAVE/PARTIAL (R3.5 in verification) |
| Algorithms: structure-shaped (spanning trees, path trees, ego nets, k-cores) | none; protocol cannot express subgraphs | GAP: CANDIDATE E.4 |

Conclusion: the paradigm triad and SPARQL/SHACL commitments are
covered by implemented or roadmap-owned requirements; the one
standards-level hole this survey adds is structure-shaped algorithm
results.

## E. Candidate dispositions

Adoption test: universal across at least two surveyed categories,
inside the toolkit boundary, and not expressible by composing
existing compounds.

- **E.1 Entity page: ADOPT as R1.15 (SHOULD).** Universal across
  concept trackers, KG suites, and decision support; the inspector is
  a debugging surface, not a consumption surface, and the difference
  (schema-driven grouping, inbound relations, readability) is a real
  component, not styling.
- **E.2 Change history and review: ADOPT as R2.16 (SHOULD), gated on
  R2.12.** Without history, write-back is irreversible vandalism
  surface; every surveyed system that writes also reviews. Scoped to
  client-side rendering of a history feed the backend supplies plus a
  local review queue; server-side retention is the adapter contract's
  problem.
- **E.3 Saved queries and history: ADOPT as R2.17 (SHOULD).** Every
  console in the survey ships it; R1.13 without it forces re-typing,
  which the curation and analytics workflows both punish.
- **E.4 Algorithm subgraph results: ADOPT as R3.9 (SHOULD).** Extends
  the R3.5 protocol with edge-set/subgraph-shaped results and a
  canvas overlay channel; resolves with OQ8's protocol freeze so the
  contract is designed once. Directly closes the spanning-graph
  commitment in section D.
- **Embedding projector: DECLINE as component;** document the
  scatter-pipeline recipe in the charts README (data-science users
  bring the reduction step per P1).
- **ER/merge review, watchlists, discussion, dataset admin, query
  plans: DECLINE** per section C.4 reasoning; merge review re-enters
  consideration when R2.12 and R6.2 both exist, since it composes
  from their primitives.

Adopted requirements are specified in specs/01, 02, and 03 with
`rationale: Capability landscape (research/capability-landscape.md,
section E)` and owned in roadmap/ per its coverage contract.
