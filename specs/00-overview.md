---
spec_id: g3-overview
title: "g3-toolkit: Overview and Intent"
version: 0.1.0
status: draft
---

# Overview and Intent


<!--specl
created: 2026-05-17
domain: graph-visualization
-->

## Intent

The g3-toolkit is a composable, paradigm-neutral graph visualization toolkit.
It renders graph data (nodes, edges, properties) and graph algorithm results
(centrality scores, community membership, embeddings, paths) across 12
archetype views that compose into domain-specific workspaces.

The toolkit is visualization-first. Graph computation engines (reasoning,
algorithms, validation) are optional installs; the toolkit consumes their
output but does not mandate a particular backend. The core contract is:
the toolkit accepts graph data and algorithm results as input, and produces
interactive, accessible, composable visual representations as output.

The toolkit is paradigm-neutral at the rendering layer. It consumes a
unified node/edge/property model regardless of whether the source is RDF,
a labeled property graph (LPG), or a Holonic projection. Paradigm-specific
behavior (named-graph membership, holon-layer attribution, raw-triple
inspection) is available as opt-in overlays.

## Purpose

The long-term goal is a comprehensive graph visualization toolkit that
supports 90%+ of use cases for graph data and associated data
interrogation, including:

- Graph algorithm result visualization (centrality, clustering, paths, flows)
- Relational database virtualization layers and tabular views
- Statistical reports on graph analytics
- Provenance and confidence overlays
- Ontology and schema inspection
- Temporal and geospatial graph exploration
- Operational write-back and action invocation
- Classification-aware redaction for defense and intelligence contexts

The toolkit must serve three distinct user populations: investigation
analysts (link analysis, case management), ontology/data engineers
(schema curation, validation), and operations analysts (monitoring,
digital twin, streaming). These populations have fundamentally different
interaction models; collapsing them into a single UI is an anti-pattern
identified in the foundational research.

## Design Considerations

The following six principles (P1 through P6) govern all design decisions.
They are referenced by identifier throughout the specification.

- P1. **Visualization-first; graph operations as optional installs.** The
  toolkit's primary intent is visualization. Graph algorithms and reasoning
  engines are optional dependencies. The test harness exercises them to
  verify visual encodings render correctly when algorithm results are present.

- P2. **Default working-set limits.** Every view that renders nodes or edges
  has a configurable default limit. These are soft defaults, not hard caps;
  the user overrides them with an explicit acknowledgment.

- P3. **Contextual view triggers (right-click universality).** Certain
  interactions (N-degree neighbor expansion, property inspection, "show in
  table") are available in every view via a consistent right-click context
  menu. The menu is extensible by plugins and Holonic portal definitions.

- P4. **RDF projection, not raw RDF rendering.** Raw RDF triple visualization
  is almost never the right rendering strategy. RDF data is projected to an
  LPG-like model (type collapse, literal collapse, blank-node resolution,
  list resolution, reification collapse) before rendering. A raw-triples
  mode exists for debugging and ontology inspection.

- P5. **Universal graph imperatives; defer limiting decisions.** The core
  interaction model, layout engine interface, selection/filter mechanics,
  and export pipeline are paradigm-neutral. Where a decision would restrict
  future paradigm support, it is deferred and documented rather than
  resolved prematurely.

- P6. **Holonic format as a first-class citizen.** The Holonic four-graph
  model (Interior, Boundary, Projection, Context) is a native data source.
  Holonic projections, portals, membrane validation, and holarchy topology
  are surfaced through the toolkit's standard archetype views and
  interaction patterns.
