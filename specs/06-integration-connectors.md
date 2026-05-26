---
spec_id: g3-int-connectors
title: "g3-toolkit: Data Source Connectors"
version: 0.1.0
status: draft
---

# Data Source Connectors


<!--specl
created: 2026-05-17
parent: g3-overview
-->

## Intent

This specification defines requirements for connecting the g3-toolkit to
external data sources beyond the core graph adapters (R3.4). It covers
relational virtualization, document linkage, streaming sources, federation,
and API integration.

## Requirements

- R6.1 (Canonical: R3.7) The toolkit MUST support relational database virtualization by accepting JDBC/ODBC or SQL-over-HTTP query results and joining them to the UGM by a shared key (node ID or IRI). Virtualized relational data MUST be renderable in the Table view and as supplementary properties in the Detail Inspector.
  - status: proposed
  - priority: MUST
  - role: Data Engineer
  - constrains: RelationalVirtualizer
  - acceptance: Given a Postgres table of financial transactions keyed by account IRI, when joined to a graph of account entities, then the Table view shows transaction columns alongside graph-derived properties.

- R6.2 The toolkit SHOULD support multi-source federation such that a single workspace can combine data from multiple GraphAdapter instances (e.g., one SPARQL, one Cypher, one Holonic). Entity resolution across sources MUST be configurable by shared IRI, owl:sameAs, or user-defined key.
  - status: proposed
  - priority: SHOULD
  - role: Data Engineer
  - constrains: FederationManager, EntityResolver
  - acceptance: Given a SPARQL source and a Cypher source both containing nodes for "Company X" linked by a shared IRI, when federated, then a single node appears in the canvas with properties merged from both sources.

- R6.3 (Extends: R3.8) The toolkit SHOULD support document and unstructured data linkage by rendering source-document references (URLs, PDF page+span, image regions) as clickable links or inline previews in the Detail Inspector (R1.11).
  - status: proposed
  - priority: SHOULD
  - role: Analyst, Data Engineer
  - constrains: DocumentLinker
  - acceptance: Given a node with a `source_document_url` pointing to a PDF, when "Show source" is clicked, then an inline PDF viewer opens at the referenced page.

- R6.4 The toolkit SHOULD support API integration by accepting JSON or GraphQL responses as supplementary data, mappable to UGM node/edge properties via a configurable transform.
  - status: proposed
  - priority: SHOULD
  - role: Data Engineer, Plugin Developer
  - constrains: APIAdapter
  - acceptance: Given a REST endpoint returning JSON with entity metadata, when the API adapter is configured with a field-to-property mapping, then the metadata appears as node properties in the UGM.

## User Stories

- US6.1 As a data engineer, I want to join a Postgres table of audit logs to my graph so that analysts can see both graph relationships and transactional history in a single workspace without data duplication.
  - asA: Data Engineer
  - soThat: I can avoid copying relational data into the graph store
  - status: proposed
