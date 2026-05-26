---
spec_id: g3-int-holonic
title: "g3-toolkit: Holonic Integration"
version: 0.1.0
status: draft
---

# Holonic Integration


<!--specl
created: 2026-05-17
parent: g3-overview
-->

## Intent

This specification defines the integration between the g3-toolkit and the
Holonic four-graph model (Interior, Boundary, Projection, Context) as
implemented by the `holonic` Python library (https://github.com/zwelz3/holonic).
Holonic is a first-class data source (P6), not an afterthought adapter.

This specification covers the g3-toolkit's Holonic support module. It is
separate from holonic-console (a distinct application under development
that will import this toolkit in the future). The integration boundary
between g3-toolkit and holonic-console is deferred (P5) until
holonic-console's architecture stabilizes.

## Requirements

- R5.1 The toolkit MUST implement a HolonicAdapter that wraps a `HolonicDataset` instance and exposes it through the GraphAdapter interface (R3.3). The adapter MUST support both RdflibBackend and FusekiBackend transparently.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: HolonicAdapter, GraphAdapter
  - acceptance: Given a HolonicDataset with RdflibBackend containing 5 holons, when the HolonicAdapter is initialized, then `get_schema()` returns holon types and portal types.
  - acceptance: Given a HolonicDataset with FusekiBackend, when the HolonicAdapter is initialized, then queries execute via SPARQL over HTTP.

- R5.2 The toolkit MUST render Holonic holarchy topology (`project_holarchy()` output: holons as nodes, portals as edges) in the Link-Chart Canvas (R1.1). This serves as a meta-navigation map. Selecting a holon in the holarchy view MUST load that holon's projected interior into the working canvas.
  - status: proposed
  - priority: MUST
  - role: Analyst, Data Engineer
  - constrains: HolonicAdapter, CanvasRenderer
  - acceptance: Given a holarchy with 3 holons connected by 2 portals, when holarchy topology is rendered, then 3 nodes and 2 edges appear in the canvas.
  - acceptance: Given a holon selected in the holarchy view, when double-clicked, then the holon's interior (projected via `project_holon()`) replaces the canvas content.

- R5.3 The toolkit MUST use `project_to_lpg()` (or the holon's declared ProjectionPipeline) as the default rendering path for Holonic interior graphs. The toolkit's ProjectionPipeline (R4.1) MUST accept Holonic ProjectionPipeline instances as a drop-in replacement.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: ProjectionPipeline, HolonicAdapter
  - acceptance: Given a holon with an interior containing 500 RDF triples, when rendered through `project_to_lpg(collapse_types=True, collapse_literals=True, resolve_blanks=True, resolve_lists=True)`, then the canvas shows only named-resource nodes with collapsed properties.

- R5.4 The toolkit MUST surface Holonic portals as right-click menu items on holon nodes. When a node is identified as a holon (via the HolonicAdapter), the right-click menu MUST include a "Traverse portal to..." submenu listing all discovered outbound portals (via `find_portals_from()`).
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: ContextMenuManager, HolonicAdapter
  - acceptance: Given a holon with 3 outbound portals, when right-clicked, then the "Traverse portal to..." submenu lists 3 items (one per target holon).
  - acceptance: Given a portal selected from the submenu, when invoked, then the portal's CONSTRUCT query executes and the projected result animates into the canvas as an expanded neighborhood.

- R5.5 The toolkit MUST render SHACL membrane validation results (from `validate_membrane()`) as visual annotations. Passing validation renders as a green badge on the holon node; failing validation renders as a red badge with a count of violations. Clicking the badge MUST open the Detail Inspector (R1.11) with the violation details.
  - status: proposed
  - priority: MUST
  - role: Ontology Engineer, Analyst
  - constrains: HolonicAdapter, SchemaRenderer, DetailInspector
  - acceptance: Given a holon whose interior violates 2 SHACL shapes, when membrane validation runs, then the holon node displays a red badge with "2" and clicking it lists both violations.

- R5.6 The toolkit SHOULD support per-holon view configuration via Holonic Projection-layer triples. A holon's Projection graph MAY declare: (a) which archetype views are appropriate, (b) which layout algorithm to use, (c) which visual style (color palette, icon set) to apply. The toolkit reads these declarations when opening a holon and configures the workspace accordingly.
  - status: proposed
  - priority: SHOULD
  - role: Ontology Engineer, Data Engineer
  - constrains: HolonicAdapter, WorkspaceManager
  - acceptance: Given a holon with a Projection-layer triple declaring "use hierarchical layout," when the holon's interior is opened, then the canvas renders with hierarchical layout rather than force-directed.

- R5.7 The Detail Inspector (R1.11) SHOULD display the Holonic layer (Interior, Boundary, Projection, Context) from which each triple originates when viewing a Holonic data source. This is a Holonic-specific overlay on the standard property/provenance view.
  - status: proposed
  - priority: SHOULD
  - role: Ontology Engineer
  - constrains: DetailInspector, HolonicAdapter
  - acceptance: Given a property sourced from a holon's Interior/radar graph, then the inspector displays "Source: Interior (urn:holon:x/interior/radar)."

- R5.8 The toolkit SHOULD support multi-interior rendering. A Holonic holon may have multiple interior named graphs (e.g., radar, EO-IR, fusion). The toolkit SHOULD allow the user to select which interior graphs to include in the rendering and SHOULD visually distinguish data from different interiors (e.g., via color coding or icon badges).
  - status: proposed
  - priority: SHOULD
  - role: Analyst, Data Engineer
  - constrains: HolonicAdapter, CanvasRenderer
  - acceptance: Given a holon with 3 interior graphs, when all 3 are selected, then nodes sourced from different interiors are visually distinguishable (e.g., different border colors).

## Open Issues

- OQ5.1 How should portal visualization scale when a holon has many (>10) outbound portals? Options: flat list, grouped by target type, or a portal-browser sub-panel.
  - status: open
  - owner: UX Lead
  - recommendation: Begin with a flat list; add grouping if user testing shows >10 portals is common.

- OQ5.2 What visual transition should indicate cross-holarchy navigation (traversing a portal from one holarchy into another)? Candidate approaches: watermark change, border-color change, breadcrumb trail, or animated "zoom-through" transition.
  - status: open
  - owner: UX Lead
  - recommendation: Breadcrumb trail with watermark change is the minimum viable design.

- OQ5.3 Should end-users be able to create or modify ProjectionPipeline configurations from within the toolkit UI, or is this an admin/developer concern?
  - status: deferred
  - owner: Product Lead
  - recommendation: Initial release treats pipelines as pre-configured. User-configurable pipelines are a future capability.

## User Stories

- US5.1 As a data engineer using Holonic, I want to open the g3-toolkit pointed at my HolonicDataset and see the holarchy as a navigable map so that I can drill into any holon and inspect its projected interior.
  - asA: Data Engineer
  - soThat: I can visually validate the structure of my holarchy
  - status: proposed

- US5.2 As an analyst, I want to right-click a sensor holon and select "Traverse portal to Fusion" so that the fused track data from the target holon expands into my canvas without a manual query.
  - asA: Intelligence Analyst
  - soThat: I can follow data flows across holons as easily as expanding a neighborhood
  - status: proposed
