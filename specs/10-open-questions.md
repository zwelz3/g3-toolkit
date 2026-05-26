---
spec_id: g3-open-questions
title: "g3-toolkit: Open Questions and Deferred Decisions"
version: 0.1.0
status: draft
---

# Open Questions and Deferred Decisions


<!--specl
created: 2026-05-17
parent: g3-overview
-->

## Intent

This section catalogs design questions that are explicitly deferred
per P5 (universal graph imperatives; defer limiting decisions). Each
item documents the question, the candidate approaches, and the
criteria for eventual resolution.

## Open Issues

- OQ1 Layout-mixing UX for hybrid hierarchical/network graphs. When a single graph contains both containment hierarchies and free-form network edges, how does the user define "system boundary" regions within a single canvas (hierarchical layout inside, force-directed outside)?
  - status: open
  - owner: UX Lead
  - recommendation: Defer until user testing with MBSE engineers reveals the dominant interaction pattern. Candidate approaches: (a) user draws a boundary box and assigns a layout mode, (b) layout mode is inferred from edge types (containment = hierarchical, association = force-directed), (c) the user selects a "hybrid" layout that automatically nests hierarchical clusters.

- OQ2 User-configurable ProjectionPipelines. Should end-users be able to create or modify ProjectionPipeline configurations from within the toolkit UI, or is this an admin/developer concern?
  - status: deferred
  - owner: Product Lead
  - recommendation: Initial release treats pipelines as pre-configured (admin-managed). User-configurable pipelines require a pipeline editor UI that is out of scope for v0.1. Revisit after initial adoption data is available.

- OQ3 NL-to-query engine selection. Which LLM backend, prompt architecture, and query-validation strategy should the toolkit use for natural-language-to-graph-query translation?
  - status: open
  - owner: Architecture Lead
  - recommendation: Define the NLQueryEngine interface contract first (input: NL string + schema context; output: query string + confidence score). Defer the implementation to a plugin. The interface must support showing the generated query to the user (D10).

- OQ4 Streaming layout algorithm choice. Which incremental layout algorithm should be used for the "live" streaming mode (D7)?
  - status: open
  - owner: Architecture Lead
  - recommendation: Evaluate D3-force with alpha-decay damping, Ogdf's incremental Sugiyama, and custom WebGL-accelerated force simulation. Selection depends on target node count (500 streaming default per P2) and target frame rate (30fps minimum).

- OQ5 Portal grouping UX. How should the right-click "Traverse portal to..." submenu present many (>10) outbound portals without overwhelming the analyst?
  - status: open
  - owner: UX Lead
  - recommendation: Flat list for <=10 portals; grouped by target holon type for >10. A "Browse all portals..." item opens a dedicated portal browser panel. Exact threshold subject to user testing.

- OQ6 Default projection per holon type. Which of the canonical projections (P4) should be on vs. off by default for different holon types or ontology domains? The safe default is "all collapses on" (D2), but ontology-curation workflows may need Type Collapse off.
  - status: deferred
  - owner: Data Layer Lead
  - recommendation: Ship with "all collapses on" as the universal default. Allow per-holon-type overrides via Holonic Projection-layer declarations (R5.6). Gather feedback before introducing a settings UI.

- OQ7 Working-set limit numeric values. The specific defaults (500 nodes, 200x200 matrix, 10,000 table rows, 100 Sankey flows, 500-node streaming window) are initial recommendations. What are the right numbers?
  - status: open
  - owner: UX Lead
  - recommendation: Conduct performance profiling across target browsers and hardware (thin-client terminals, standard workstations, high-end analyst desktops). Set defaults to the threshold where interaction latency exceeds 100ms on the minimum supported hardware. Publish a hardware-compatibility matrix.

- OQ8 Graph algorithm plugin API surface. What is the interface contract between optional-install algorithms (P1) and the toolkit's visual encoding layer?
  - status: open
  - owner: Architecture Lead
  - recommendation: Define a minimal `AlgorithmResult` protocol: `node_id -> dict[str, Any]` for node-level results (centrality, community ID, embedding vector) and `edge_id -> dict[str, Any]` for edge-level results (predicted probability, flow value). The view layer maps property keys to visual channels (size, color, opacity) via a configurable `VisualEncoding` declaration. Exact protocol definition is a prerequisite for the first plugin release.

- OQ9 Write-back conflict resolution. D5 and R2.12 specify optimistic UI with rollback for write-back operations. What merge or conflict strategy applies when concurrent editors modify the same node/edge?
  - status: open
  - owner: Architecture Lead
  - recommendation: Last-write-wins is the simplest strategy and acceptable for initial release. Operational merge (CRDT or OT) is complex and should be deferred unless multi-user concurrent editing is a launch requirement. If so, evaluate Yjs or Automerge for the conflict-resolution layer.

- OQ10 holonic-console integration boundary. Which modules does holonic-console import from this toolkit, and which does it wrap or replace?
  - status: deferred
  - owner: Architecture Lead
  - recommendation: Defer until holonic-console's architecture stabilizes. The current design constraint is that `g3_toolkit.holonic` (the adapter and projection module) must be importable without pulling in the rendering layer. This is enforced by D6.

- OQ11 Handling of very large holarchies. What is the performance ceiling for `project_holarchy()` rendering when a holarchy contains hundreds or thousands of holons? Should the holarchy topology view have its own working-set limit distinct from the canvas default?
  - status: open
  - owner: Data Layer Lead
  - recommendation: Apply the same 500-node canvas default (P2) to holarchy rendering. For larger holarchies, implement a "top-level holons only" aggregation with expand-on-click for sub-holarchies.

- OQ12 Edge-type-specific right-click actions. Beyond the universal right-click menu (R2.1), should the toolkit support edge-type-specific actions (e.g., "Show all transactions" when right-clicking a "transacts_with" edge, "Show all requirements" when right-clicking a "traces_to" edge)?
  - status: open
  - owner: UX Lead
  - recommendation: Yes, via the plugin extension mechanism (R2.3). Edge-type-specific actions register against a type filter. The question is whether to ship built-in actions for common edge types or leave this entirely to plugins. Recommend: leave to plugins initially; promote frequently-registered patterns to built-in in later releases.
