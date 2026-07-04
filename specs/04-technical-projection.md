---
spec_id: g3-tech-projection
title: "g3-toolkit: RDF Projection Pipeline"
version: 0.1.0
status: draft
---

# RDF Projection Pipeline


<!--specl
created: 2026-05-17
parent: g3-overview
-->

## Intent

This specification defines the RDF-to-visual projection pipeline (P4).
Raw RDF triple visualization is almost never the right rendering strategy.
The projection pipeline transforms RDF data into the Unified Graph Model
(UGM) using a configurable sequence of collapse operations. The pipeline
is the mandatory path for RDF data entering any view except the Schema
view and the raw-triples toggle in the Detail Inspector.

## Requirements

- R4.1 The toolkit MUST implement a ProjectionPipeline that accepts an RDF graph (or SPARQL CONSTRUCT result) and produces a UGM instance. The pipeline MUST be configurable as an ordered sequence of transform steps.
  - status: implemented
  - priority: MUST
  - role: Frontend Developer, Data Engineer
  - constrains: ProjectionPipeline, UnifiedGraphModel
  - acceptance: Given an RDF graph with 1,000 triples, when the default ProjectionPipeline is applied, then the resulting UGM contains only named-resource nodes (no literal nodes, no blank nodes as top-level nodes, no rdf:type edges).

- R4.2 The default ProjectionPipeline MUST include the following collapse operations, applied in order: (1) Type Collapse (rdf:type triples become a `types` list on the node), (2) Literal Collapse (datatype and annotation property triples become key-value attributes on the node), (3) Blank-Node Resolution (blank nodes inline as nested property structures on the nearest named resource), (4) List Resolution (rdf:first/rdf:rest chains become ordered arrays), (5) Reification/RDF* Collapse (reified statements and RDF* quoted triples become Qualified Edge metadata).
  - status: implemented
  - priority: MUST
  - role: Frontend Developer
  - constrains: ProjectionPipeline
  - acceptance: Given an RDF graph containing `ex:Alice rdf:type foaf:Person`, when Type Collapse runs, then the UGM node for ex:Alice has `types: ["foaf:Person"]` and no rdf:type edge exists.
  - acceptance: Given an RDF graph containing `ex:Alice foaf:name "Alice"^^xsd:string`, when Literal Collapse runs, then the UGM node for ex:Alice has property `foaf:name: "Alice"` and no literal node exists.
  - acceptance: Given an RDF* triple `<<ex:Alice ex:knows ex:Bob>> ex:confidence 0.9`, when Reification Collapse runs, then the UGM edge from Alice to Bob has `confidence: 0.9` in its Qualified Edge metadata.

- R4.3 Each collapse operation MUST be individually toggleable. The Schema view (R1.5) SHOULD run with Type Collapse disabled so that class hierarchy edges remain visible. The Detail Inspector's "Show raw RDF" mode (R1.11) MUST bypass the pipeline entirely.
  - status: implemented
  - priority: MUST
  - role: Ontology Engineer, Frontend Developer
  - constrains: ProjectionPipeline
  - acceptance: Given a ProjectionPipeline with Type Collapse disabled, when applied to an ontology graph, then rdf:type edges render in the Schema view as class membership arcs.

- R4.4 The ProjectionPipeline MUST accept Holonic `ProjectionPipeline` instances (from the `holonic` library) as a compatible input. When a Holonic ProjectionPipeline is provided, the toolkit MUST use it in place of the default pipeline, including any CONSTRUCT steps and Python transforms defined in the Holonic pipeline.
  - status: implemented
  - priority: MUST
  - role: Frontend Developer, Data Engineer
  - constrains: ProjectionPipeline, HolonicAdapter
  - acceptance: Given a Holonic ProjectionPipeline with a custom CONSTRUCT step that strips administrative triples, when applied through the toolkit, then the resulting UGM excludes those triples.

- R4.5 The toolkit SHOULD ship at least three named projection presets: (a) "Standard" (all five collapses on; suitable for investigation and analytics), (b) "Ontology" (Type Collapse off, Reification Collapse off; suitable for schema browsing), and (c) "Provenance-Preserving" (Reification Collapse off; suitable for provenance inspection where RDF*/named-graph structure should remain visible as edges).
  - status: implemented
  - priority: SHOULD
  - role: Data Engineer
  - constrains: ProjectionPipeline, PresetRegistry
  - acceptance: Given the "Standard" preset, when applied to an RDF graph, then the resulting UGM has no literal nodes, no blank nodes, no rdf:type edges, and no reification structure.
  - acceptance: Given the "Provenance-Preserving" preset, when applied to an RDF graph with named-graph provenance, then provenance named-graph nodes remain visible as connected elements.

- R4.6 The toolkit MUST NOT pass raw RDF triples directly to any canvas, timeline, map, Sankey, matrix, or statistical renderer. The ProjectionPipeline is the mandatory data path for RDF sources into these views. The only exceptions are the Schema view (R1.5) and the raw-triples toggle in the Detail Inspector (R1.11).
  - status: implemented
  - priority: MUST
  - role: Frontend Developer
  - constrains: ViewRouter, ProjectionPipeline
  - acceptance: Given an RDF data source, when any view other than Schema or raw-triples Inspector is opened, then the data passes through the ProjectionPipeline before reaching the renderer.

## Decisions

- D4.1 The default projection configuration SHALL be "all collapses on" (the "Standard" preset) for all holon types and ontology domains. Specific holon types or domains MAY override this via Holonic Projection-layer declarations (P6). This default is subject to revision based on user testing (deferred per P5).
  - status: considering
  - rationale: Maximizes readability for the majority of users; ontology engineers can switch to the "Ontology" preset manually. The risk is that some ontology-curation workflows require Type Collapse off by default.
  - affects: ProjectionPipeline, PresetRegistry
  - owner: Data Layer Lead

## User Stories

- US4.1 As an analyst viewing RDF-sourced intelligence data, I want to see people, organizations, and locations as nodes with properties, not as a hairball of triples, so that I can focus on entity relationships rather than data-model plumbing.
  - asA: Intelligence Analyst
  - soThat: I can investigate networks without understanding RDF syntax
  - status: proposed

- US4.2 As an ontology engineer, I want to switch the projection to "Ontology" mode so that I can see rdf:type edges and class hierarchy structure in the schema view while still getting collapsed literals.
  - asA: Ontology Engineer
  - soThat: I can inspect both the instance data and the schema in the same toolkit
  - status: proposed
