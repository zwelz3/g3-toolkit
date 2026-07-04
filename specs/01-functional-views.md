---
spec_id: g3-func-views
title: "g3-toolkit: Archetype Views"
version: 0.1.0
status: draft
---

# Archetype Views


<!--specl
created: 2026-05-17
parent: g3-overview
-->

## Intent

This specification defines the 12 archetype views that compose the
g3-toolkit's visualization layer. Each archetype is a reusable view
component; they are not standalone applications. They compose into
domain-specific workspaces via the Composite Dashboard (R1.12).

All views consume a unified node/edge/property model (P5). Whether that
model was populated from LPG, from RDF via projection (P4), or from
Holonic `project_to_lpg()` (P6) is irrelevant to the view layer.

## Requirements

- R1.1 The toolkit MUST provide a Link-Chart Canvas view ("Investigation Canvas") with force-directed and hierarchical layout modes, node icons with label and per-class color, and edge thickness/style encoding for confidence and relationship type.
  - status: implemented
  - priority: MUST
  - role: Analyst
  - constrains: LayoutEngine, NodeRenderer, EdgeRenderer
  - acceptance: Given a graph with 200 nodes and 500 edges, when the canvas is opened, then nodes render with class-appropriate icons and edges render with type-appropriate styles within 2 seconds.
  - acceptance: Given a graph exceeding 500 nodes, when the canvas is opened, then the user is prompted with an aggregation suggestion before rendering proceeds.

- R1.2 The toolkit MUST provide a Timeline / Temporal Playback view that renders events on a horizontal time axis, supports scrubbing and animation, and filters the linked canvas by temporal range.
  - status: in-progress
  - priority: MUST
  - role: Analyst
  - constrains: TimelineRenderer, CrossViewLinker
  - acceptance: Given a graph with timestamped events, when the timeline brush is dragged, then only events within the selected range are highlighted in the linked canvas.

- R1.3 The toolkit MUST provide a Geospatial Overlay view that renders nodes with latitude/longitude properties on a map and supports region drawing, measurement, and annotation.
  - status: in-progress
  - priority: MUST
  - role: Analyst
  - constrains: MapRenderer, GeoSpatialAdapter
  - acceptance: Given nodes with lat/lon properties, when the geo view is opened, then nodes render at their geographic positions on a tiled basemap.

- R1.4 The toolkit MUST provide a Matrix / Heatmap view that renders co-occurrence or adjacency counts between node categories in a grid with color-scaled cells.
  - status: in-progress
  - priority: MUST
  - role: Analyst, MBSE Engineer
  - constrains: MatrixRenderer
  - acceptance: Given a graph with typed nodes, when the matrix view is opened for two selected node types, then the grid renders co-occurrence counts with a color gradient.

- R1.5 The toolkit MUST provide a Schema / Ontology Visualization view that renders class hierarchies, property domains/ranges, and SHACL shape structures.
  - status: implemented
  - priority: MUST
  - role: Ontology Engineer
  - constrains: SchemaRenderer, SHACLParser
  - acceptance: Given an OWL ontology, when the schema view is opened, then classes render in a hierarchy with property edges showing domain/range.
  - acceptance: Given a SHACL shapes graph, when the schema view is opened, then shape constraints render as annotated overlays on the class hierarchy.

- R1.6 The toolkit MUST provide a Hierarchical / Tree-Map view that renders containment hierarchies with expand/collapse and supports lazy-load expansion beyond the default node limit.
  - status: in-progress
  - priority: MUST
  - role: MBSE Engineer, Data Engineer
  - constrains: TreeRenderer, LazyLoader
  - acceptance: Given a SysML containment hierarchy with 5,000 nodes, when the tree view is opened, then only the first two levels render initially; deeper levels load on expand.

- R1.7 The toolkit MUST provide a Tabular / Grid view that renders SPARQL, Cypher, or GQL query results as a sortable, filterable, paginated table with bidirectional cross-selection to all other views.
  - status: implemented
  - priority: MUST
  - role: Analyst, Data Engineer, Ontology Engineer
  - constrains: TableRenderer, CrossViewLinker
  - acceptance: Given a SPARQL SELECT result with 50,000 rows, when the table view is opened, then the first page of 10,000 rows renders with pagination controls.
  - acceptance: Given a row selected in the table, when the linked canvas is visible, then the corresponding node highlights in the canvas.

- R1.8 The toolkit SHOULD provide a Statistical / Analytics Panel that renders degree distributions, centrality plots, community size histograms, and embedding scatter plots from algorithm result properties.
  - status: in-progress
  - priority: SHOULD
  - role: Data Scientist, Analyst
  - constrains: StatsRenderer, AlgorithmResultAdapter
  - acceptance: Given nodes with a `pagerank` property, when the stats panel is opened, then a histogram of PageRank values renders with brush-to-select.

Formerly requirement 1.9 of this file (removed from the roadmap
2026-06-12 by review direction): the
Sankey / Flow / Chord view was descoped. Partial SankeyView code
remains in the tree without any roadmap commitment.

- R1.10 The toolkit MUST provide a Diff / Comparison view that renders added, removed, and changed nodes and edges between two graph states in side-by-side or overlay modes.
  - status: implemented
  - priority: MUST
  - role: Ontology Engineer, MBSE Engineer, Platform Administrator
  - constrains: DiffEngine, DiffRenderer
  - acceptance: Given two named-graph snapshots, when the diff view is opened, then added nodes render green, removed nodes render red, and changed properties are listed in a detail panel.

- R1.11 The toolkit MUST provide a Detail / Provenance Inspector panel that displays node and edge properties, assertion-level provenance, named-graph attribution, confidence scores, and source-document span links.
  - status: implemented
  - priority: MUST
  - role: Analyst, Ontology Engineer, Data Engineer
  - constrains: ProvenanceAdapter, DocumentLinker
  - acceptance: Given a node with provenance metadata, when the inspector is opened, then the provenance chain renders as a trace from assertion back to source.
  - acceptance: Given a node from projected RDF, when "Show raw RDF" is toggled, then the underlying triples and named graphs display beneath the projected property view.

- R1.12 The toolkit MUST provide a Composite Dashboard / Workspace that allows persistent layout of multiple archetype views with save, share, and role-based default configurations.
  - status: implemented
  - priority: MUST
  - role: Analyst, Platform Administrator
  - constrains: WorkspaceManager, PerspectiveStore
  - acceptance: Given a saved workspace "AML Triage" containing Canvas + Timeline + Map + Table, when a user with the "aml-analyst" role logs in, then the workspace loads with all four views cross-linked.

- R1.13 The toolkit MUST provide a Query Editor view with syntax highlighting for SPARQL, Cypher, and GQL. Query results MUST populate the UGM and render in the active views. The editor SHOULD support autocompletion from the SchemaModel.
  - status: implemented
  - priority: MUST
  - role: Knowledge Engineer, Data Scientist, Analyst
  - rationale: Gap analysis: every commercial graph platform ships a query editor. Without one, the toolkit is display-only.
  - constrains: QueryEditor, QueryAdapter
  - acceptance: Given a SPARQL endpoint adapter and the Query Editor open, when a SELECT query is executed, then the result populates the UGM and the linked Table view shows the bindings.
  - acceptance: Given a syntactically invalid query, when execute is invoked, then the editor surfaces the adapter's error without clearing the current UGM.

- R1.14 The toolkit MUST support community overlay visualization, rendering node community membership as background color regions (convex hulls) or as a distinct visual channel (border color, icon badge). Community IDs are sourced from algorithm result properties (R3.5).
  - status: implemented
  - priority: MUST
  - role: Analyst, Data Scientist
  - rationale: Gap analysis: community detection is a core C6 capability (research/use-case-survey.md, section B.6). ingestAlgorithmResults exists but no visual encoding for community boundaries.
  - constrains: CanvasRenderer, VisualEncodingManager
  - acceptance: Given nodes carrying a community property from ingestAlgorithmResults, when the community overlay is enabled, then nodes sharing a community ID are visually grouped by a shared channel (hull, border color, or badge).

- R1.15 The toolkit SHOULD provide an Entity Page view: a consumption-oriented, schema-driven rendering of a single entity with grouped properties (per class/shape), outbound and inbound relationships with counts, and media/document references. The Entity Page is the human-readable counterpart to the Detail Inspector (R1.11), which remains the debugging surface.
  - status: proposed
  - priority: SHOULD
  - role: Analyst, Knowledge Engineer, Curator
  - rationale: Capability landscape (research/capability-landscape.md, section E.1). The entity page is the universal compound across concept trackers (Wikipedia/Wikidata, IMDb), KG suites (Stardog Explorer, TopBraid EDG), and decision support (Foundry object view); the toolkit currently has no consumption surface for a single concept.
  - constrains: EntityPage, SchemaModel, CrossViewLinker
  - acceptance: Given an entity with typed properties and a SchemaModel, when the Entity Page opens, then properties render grouped by their declaring class or shape, and inbound relationships list with per-type counts.
  - acceptance: Given a relationship listed on the Entity Page, when it is activated, then the related entity's page opens and the canvas selection updates (cross-view linking per R2.5).

- R1.16 The toolkit SHOULD provide a SHACL Shape view that renders a shapes graph with NodeShapes as compound containers (stereotyped headers; solid border when sh:closed, dashed otherwise), blank-node property shapes as contained items showing path, type, and UML-style cardinality summaries, IRI-named property shapes rendered once with sh:property reference edges, sh:node references as edges between shape containers, and sh:target* links as dashed target edges. Constraint detail beyond the summary renders in the Detail Inspector. (Compartment-row rendering of property shapes arrives with the ELK containers work; see roadmap/design/shacl-views.md.)
  - status: in-progress
  - priority: SHOULD
  - role: Ontologist, Systems Engineer
  - constrains: CytoscapeCanvas, DetailInspector
  - acceptance: Given a shapes graph with a closed NodeShape owning three blank-node property shapes (one with sh:minCount 1 and sh:datatype xsd:string), when the Shape view renders, then the NodeShape appears as a solid-bordered container holding three labeled items, the constrained one reading its path with [1..*]-style cardinality and a datatype suffix.

- R1.17 The toolkit SHOULD visualize SHACL validation reports over the data graph by consuming a versioned report document (adaptable from the in-core validator or external engines such as pyshacl and Jena), rendering severity tiers (violation, warning, info) as independently toggleable emphasis overlays using the theme's semantic colors, ingesting per-focus-node result counts and maximum severity as encoding-spec drivers, including result-path edges in the emphasis, and listing result detail (message, source shape, path, value) in the Detail Inspector. When the Shape view is also open, selecting a result SHOULD cross-highlight the source shape.
  - status: in-progress
  - priority: SHOULD
  - role: Ontologist, Data Engineer
  - constrains: CytoscapeCanvas, DetailInspector, AlgorithmPanel
  - acceptance: Given a report with two violations and one warning across three focus nodes, when loaded, then violations and warnings render as distinct toggleable emphasis tiers, the focus nodes carry result counts usable as a size driver, and the inspector lists each message with its source shape.

- R1.18 The toolkit SHOULD render UML-style structural element views: compound containers with stereotyped headers, typed compartments whose rows are real selectable elements (so overlays, badges, and cross-highlighting apply to individual rows), and boundary ports fixed to declared sides, laid out by ELK such that rows stack zero-gap in declared order at uniform width and containers size exactly to header strip plus row heights. Compartments MAY be collapsed (hiding their content rows so the container shrinks), controllable both as a component configuration (a default and a per-compartment initial state) and as a per-container runtime action; collapse is a layout-time input, so toggling re-lays-out the affected container. The layout produces a versioned geometry document (renderer-neutral absolute boxes) that the canvas consumes; edges MAY attach to ports. The compartment API serves any client; UML custom views and the SHACL Shape view (R1.16) both render through it with zero parallel machinery.
  - status: in-progress
  - priority: SHOULD
  - role: Systems Engineer, Ontologist
  - constrains: CytoscapeCanvas, DetailInspector
  - acceptance: Given the «Block»/part fixture with two titled compartments and a boundary port, when the structural layout runs, then rows stack zero-gap in declared order at one shared width inside their container, the container height equals the header strip plus the sum of row heights, and the port lies on its declared boundary side.
  - acceptance: Given the resulting geometry document applied to the canvas, when a compartment row is clicked, then exactly that row is selected and the Detail Inspector shows its source element.
  - acceptance: Given a container with an expanded operations compartment, when that compartment is collapsed (by config default or the per-container context-menu action), then its content rows disappear, a divider noting the hidden count remains, and the container height shrinks by the removed rows' height.

## User Stories

- US1.1 As an intelligence analyst, I want to open a link-chart canvas seeded with a person-of-interest and progressively expand their network via right-click "Show 1-degree neighbors," so that I can build an investigation without rendering the entire graph.
  - asA: Intelligence Analyst
  - soThat: I can explore a threat network incrementally without information overload
  - status: proposed

- US1.2 As an MBSE engineer, I want to view a SysML containment hierarchy in a tree view and, for any selected component, see its interface dependencies in a linked canvas, so that I can trace failure propagation paths.
  - asA: MBSE Engineer
  - soThat: I can identify single points of failure in system-of-systems architectures
  - status: proposed

- US1.3 As an ontology engineer, I want to view the class hierarchy of my ontology, see SHACL shape constraints as overlays, and diff the current version against the previous release, so that I can validate schema changes before deployment.
  - asA: Ontology Engineer
  - soThat: I can catch breaking changes before they affect downstream consumers
  - status: proposed

- US1.4 As a fraud analyst, I want a workspace that combines a transaction-network canvas with a timeline and a statistical panel showing anomaly scores, so that I can triage alerts by visual pattern and quantitative threshold simultaneously.
  - asA: Fraud Analyst
  - soThat: I can reduce false positives by correlating graph structure with temporal and statistical signals
  - status: proposed

- US1.5 As a data engineer, I want to see query results in a table and click any row to highlight the corresponding node in the canvas, so that I can verify that my SPARQL or Cypher query returns the expected subgraph.
  - asA: Data Engineer
  - soThat: I can debug graph queries interactively
  - status: proposed

