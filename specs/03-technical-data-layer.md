---
spec_id: g3-tech-data
title: "g3-toolkit: Data Layer and Adapters"
version: 0.1.0
status: draft
---

# Data Layer and Adapters


<!--specl
created: 2026-05-17
parent: g3-overview
-->

## Intent

This specification defines the data layer architecture: the unified
node/edge/property model that all views consume, the adapter interfaces
for connecting to graph databases and other data sources, and the
algorithm-result ingestion contract.

## Requirements

- R3.1 The toolkit MUST define a Unified Graph Model (UGM) consisting of typed nodes (with an IRI or ID, a set of type labels, and a property map), typed edges (with source, target, type label, and a property map including optional provenance/confidence metadata), and a global property-key registry. The property-key registry tracks all observed node types, edge types, and property keys across the graph; it is used by the faceted filter (R2.7), the schema discovery method of GraphAdapter (R3.3 `get_schema()`), and the visual encoding system to auto-derive available encoding channels.
  - status: implemented
  - priority: MUST
  - role: Frontend Developer
  - constrains: UnifiedGraphModel
  - acceptance: Given an LPG node and an RDF-projected node with identical properties, when both are loaded into the UGM, then they are indistinguishable to the view layer.

- R3.2 The UGM MUST support a Qualified Edge model: every edge has an optional metadata bag containing at minimum `confidence` (float 0..1), `provenance_iri` (string), `temporal_start` (datetime), `temporal_end` (datetime), and `asserted` (boolean). These fields are populated by the adapter layer from RDF named-graph/RDF* structures or LPG edge properties as appropriate.
  - status: implemented
  - priority: MUST
  - role: Frontend Developer, Data Engineer
  - constrains: UnifiedGraphModel, QualifiedEdge
  - acceptance: Given an RDF triple with assertion-level provenance via a named graph, when loaded through the RDF adapter, then the UGM edge has `provenance_iri` and `asserted=true`.
  - acceptance: Given a Neo4j relationship with a `confidence` property, when loaded through the LPG adapter, then the UGM edge has `confidence` populated.

- R3.3 The toolkit MUST define a GraphAdapter interface with at minimum: `query(query_string) -> UGM`, `expand_neighborhood(node_id, depth, edge_types?) -> UGM`, `get_schema() -> SchemaModel`, and `get_node_properties(node_id) -> PropertyMap`.
  - status: implemented
  - priority: MUST
  - role: Frontend Developer, Plugin Developer
  - constrains: GraphAdapter
  - acceptance: Given a new backend (e.g., TigerGraph), when a developer implements GraphAdapter, then all 12 archetype views render correctly against that backend.

- R3.4 The toolkit MUST ship adapter implementations for at least: (a) a SPARQL endpoint (RDF), (b) a Bolt/Cypher endpoint (Neo4j/LPG), and (c) a Holonic `HolonicDataset` (P6). Additional adapters (Gremlin, GQL, REST/JSON) SHOULD be available as optional installs.
  - status: implemented
  - priority: MUST
  - role: Data Engineer
  - constrains: SPARQLAdapter, CypherAdapter, HolonicAdapter
  - acceptance: Given a Stardog SPARQL endpoint, when the SPARQL adapter is configured, then the canvas renders query results.
  - acceptance: Given a Neo4j Bolt endpoint, when the Cypher adapter is configured, then the canvas renders query results.
  - acceptance: Given a HolonicDataset with three holons, when the Holonic adapter is configured, then the holarchy topology renders in the canvas.

- R3.5 The toolkit MUST define an AlgorithmResultAdapter interface that ingests algorithm outputs (centrality scores, community IDs, embeddings, predicted links, anomaly scores) as node or edge properties in the UGM. The toolkit MUST NOT require a specific algorithm engine; it consumes results, not computation (P1).
  - status: implemented
  - priority: MUST
  - role: Frontend Developer, Plugin Developer
  - constrains: AlgorithmResultAdapter
  - acceptance: Given a CSV of PageRank scores keyed by node ID, when loaded through the AlgorithmResultAdapter, then nodes in the UGM have a `pagerank` property and the stats panel renders a histogram.

- R3.6 The toolkit SHOULD define a StreamAdapter interface for incremental graph updates from streaming sources (Kafka, WebSocket, SSE). The StreamAdapter emits add/remove/update events that the UGM applies without full reload.
  - status: proposed
  - priority: SHOULD
  - role: Frontend Developer, Data Engineer
  - constrains: StreamAdapter, UGMEventBus
  - acceptance: Given a Kafka topic emitting edge-creation events, when the StreamAdapter is connected, then new edges appear in the canvas within the configured refresh interval.

- R3.7 The toolkit SHOULD provide visualization affordances for virtualized data (rescoped 2026-06-12 from data-layer virtualization to visualization-only, per review direction): when nodes or properties carry virtualization provenance (source system, table/view, query identity), the canvas and inspectors MUST make the virtualized origin visible: a source-system indication on the node (badge or styling channel), and provenance details (system, table, key, retrieval identity) in the Detail Inspector and tooltip. The Stardog-style pattern: the user can always tell which concepts are virtualized from a particular RDBMS and where they came from. Data-layer join machinery is OUT of roadmap scope; the existing relational-virtualizer module remains as host-side utility code.
  - status: proposed
  - priority: SHOULD
  - role: Analyst, Data Engineer
  - constrains: CytoscapeCanvas, DetailInspector, HoverTooltip
  - acceptance: Given nodes carrying virtualization provenance properties (source system and table), when rendered, then those nodes show a visible source indication and the Detail Inspector lists the originating system, table, and key.

- R3.8 The toolkit MUST support document and unstructured data linkage by allowing graph nodes to carry a `source_document_url` or `source_span` property that the Detail Inspector (R1.11) renders as a clickable link or an inline preview.
  - status: proposed
  - priority: MUST
  - role: Data Engineer, Analyst
  - constrains: DocumentLinker
  - acceptance: Given an NLP-extracted entity with a source_span pointing to a PDF page and character range, when "Show source" is clicked in the inspector, then the PDF viewer opens at the relevant span.

- R3.9 The AlgorithmResultAdapter (R3.5) SHOULD additionally accept structure-shaped results: edge sets and subgraphs (spanning trees, shortest-path trees, ego networks, k-cores) identified by node and edge IDs, registered as named overlays. The canvas SHOULD render an active overlay as a highlighted substructure (emphasized member edges/nodes, de-emphasized non-members) without mutating the underlying UGM, and multiple overlays MAY be toggled independently.
  - status: implemented
  - priority: SHOULD
  - role: Data Scientist, Analyst
  - rationale: Capability landscape (research/capability-landscape.md, sections D and E.4). The property-shaped protocol cannot express structural results; spanning-graph and path-tree visualization is standard in Gephi, Neo4j Bloom GDS integration, and GraphXR. Protocol shape resolves together with OQ8 so the algorithm contract is designed once.
  - constrains: AlgorithmResultAdapter, OverlayRegistry, CanvasRenderer
  - acceptance: Given a minimum-spanning-tree result as an edge-ID set, when its overlay is activated, then member edges render emphasized and non-member edges de-emphasized, and deactivating the overlay restores the prior styling.
  - acceptance: Given two registered overlays (an MST and an ego network), when both are toggled in sequence, then each activation reflects only its own membership and the UGM's node and edge counts are unchanged throughout.

## User Stories

- US3.1 As a data engineer, I want to point the toolkit at a SPARQL endpoint and a Cypher endpoint simultaneously so that I can visualize a federated graph combining ontology-managed RDF and analytics-optimized LPG data.
  - asA: Data Engineer
  - soThat: I can avoid data duplication across paradigms
  - status: proposed

- US3.2 As a plugin developer, I want to implement GraphAdapter for my custom graph store so that my users get all 12 archetype views without writing rendering code.
  - asA: Plugin Developer
  - soThat: I can integrate the g3-toolkit with proprietary backends
  - status: proposed
