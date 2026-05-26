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
  - status: proposed
  - priority: MUST
  - role: Analyst
  - constrains: LayoutEngine, NodeRenderer, EdgeRenderer
  - acceptance: Given a graph with 200 nodes and 500 edges, when the canvas is opened, then nodes render with class-appropriate icons and edges render with type-appropriate styles within 2 seconds.
  - acceptance: Given a graph exceeding 500 nodes, when the canvas is opened, then the user is prompted with an aggregation suggestion before rendering proceeds.

- R1.2 The toolkit MUST provide a Timeline / Temporal Playback view that renders events on a horizontal time axis, supports scrubbing and animation, and filters the linked canvas by temporal range.
  - status: proposed
  - priority: MUST
  - role: Analyst
  - constrains: TimelineRenderer, CrossViewLinker
  - acceptance: Given a graph with timestamped events, when the timeline brush is dragged, then only events within the selected range are highlighted in the linked canvas.

- R1.3 The toolkit MUST provide a Geospatial Overlay view that renders nodes with latitude/longitude properties on a map and supports region drawing, measurement, and annotation.
  - status: proposed
  - priority: MUST
  - role: Analyst
  - constrains: MapRenderer, GeoSpatialAdapter
  - acceptance: Given nodes with lat/lon properties, when the geo view is opened, then nodes render at their geographic positions on a tiled basemap.

- R1.4 The toolkit MUST provide a Matrix / Heatmap view that renders co-occurrence or adjacency counts between node categories in a grid with color-scaled cells.
  - status: proposed
  - priority: MUST
  - role: Analyst, MBSE Engineer
  - constrains: MatrixRenderer
  - acceptance: Given a graph with typed nodes, when the matrix view is opened for two selected node types, then the grid renders co-occurrence counts with a color gradient.

- R1.5 The toolkit MUST provide a Schema / Ontology Visualization view that renders class hierarchies, property domains/ranges, and SHACL shape structures.
  - status: proposed
  - priority: MUST
  - role: Ontology Engineer
  - constrains: SchemaRenderer, SHACLParser
  - acceptance: Given an OWL ontology, when the schema view is opened, then classes render in a hierarchy with property edges showing domain/range.
  - acceptance: Given a SHACL shapes graph, when the schema view is opened, then shape constraints render as annotated overlays on the class hierarchy.

- R1.6 The toolkit MUST provide a Hierarchical / Tree-Map view that renders containment hierarchies with expand/collapse and supports lazy-load expansion beyond the default node limit.
  - status: proposed
  - priority: MUST
  - role: MBSE Engineer, Data Engineer
  - constrains: TreeRenderer, LazyLoader
  - acceptance: Given a SysML containment hierarchy with 5,000 nodes, when the tree view is opened, then only the first two levels render initially; deeper levels load on expand.

- R1.7 The toolkit MUST provide a Tabular / Grid view that renders SPARQL, Cypher, or GQL query results as a sortable, filterable, paginated table with bidirectional cross-selection to all other views.
  - status: proposed
  - priority: MUST
  - role: Analyst, Data Engineer, Ontology Engineer
  - constrains: TableRenderer, CrossViewLinker
  - acceptance: Given a SPARQL SELECT result with 50,000 rows, when the table view is opened, then the first page of 10,000 rows renders with pagination controls.
  - acceptance: Given a row selected in the table, when the linked canvas is visible, then the corresponding node highlights in the canvas.

- R1.8 The toolkit MUST provide a Statistical / Analytics Panel that renders degree distributions, centrality plots, community size histograms, and embedding scatter plots from algorithm result properties.
  - status: proposed
  - priority: SHOULD
  - role: Data Scientist, Analyst
  - constrains: StatsRenderer, AlgorithmResultAdapter
  - acceptance: Given nodes with a `pagerank` property, when the stats panel is opened, then a histogram of PageRank values renders with brush-to-select.

- R1.9 The toolkit MUST provide a Sankey / Flow / Chord view that renders aggregated path flows between node categories.
  - status: proposed
  - priority: SHOULD
  - role: Analyst, Data Scientist
  - constrains: FlowRenderer
  - acceptance: Given a supply-chain graph, when the Sankey view is opened for a selected flow metric, then flows render proportionally between source and destination categories.

- R1.10 The toolkit MUST provide a Diff / Comparison view that renders added, removed, and changed nodes and edges between two graph states in side-by-side or overlay modes.
  - status: proposed
  - priority: MUST
  - role: Ontology Engineer, MBSE Engineer, Platform Administrator
  - constrains: DiffEngine, DiffRenderer
  - acceptance: Given two named-graph snapshots, when the diff view is opened, then added nodes render green, removed nodes render red, and changed properties are listed in a detail panel.

- R1.11 The toolkit MUST provide a Detail / Provenance Inspector panel that displays node and edge properties, assertion-level provenance, named-graph attribution, confidence scores, and source-document span links.
  - status: proposed
  - priority: MUST
  - role: Analyst, Ontology Engineer, Data Engineer
  - constrains: ProvenanceAdapter, DocumentLinker
  - acceptance: Given a node with provenance metadata, when the inspector is opened, then the provenance chain renders as a trace from assertion back to source.
  - acceptance: Given a node from projected RDF, when "Show raw RDF" is toggled, then the underlying triples and named graphs display beneath the projected property view.

- R1.12 The toolkit MUST provide a Composite Dashboard / Workspace that allows persistent layout of multiple archetype views with save, share, and role-based default configurations.
  - status: proposed
  - priority: MUST
  - role: Analyst, Platform Administrator
  - constrains: WorkspaceManager, PerspectiveStore
  - acceptance: Given a saved workspace "AML Triage" containing Canvas + Timeline + Map + Table, when a user with the "aml-analyst" role logs in, then the workspace loads with all four views cross-linked.

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

- R1.13 The toolkit MUST provide a Query Editor view with syntax highlighting for SPARQL, Cypher, and GQL. Query results MUST populate the UGM and render in the active views. The editor SHOULD support autocompletion from the SchemaModel.
  - status: accepted
  - priority: MUST
  - role: Knowledge Engineer, Data Scientist, Analyst
  - rationale: Gap analysis: every commercial graph platform ships a query editor. Without one, the toolkit is display-only.

- R1.14 The toolkit MUST support community overlay visualization, rendering node community membership as background color regions (convex hulls) or as a distinct visual channel (border color, icon badge). Community IDs are sourced from algorithm result properties (R3.5).
  - status: accepted
  - priority: MUST
  - role: Analyst, Data Scientist
  - rationale: Gap analysis: community detection is a core C6 capability. ingestAlgorithmResults exists but no visual encoding for community boundaries.
