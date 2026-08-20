---
title: "g3-toolkit"
spec_base: https://w3id.org/g3t/spec/g3t#
prefix: g3t
spec_id: g3t-001
version: 0.1.0
status: draft
references:
  g3tfunc:
    base: https://w3id.org/g3t/spec/functional#
    path: functional.ttl
  g3ttech:
    base: https://w3id.org/g3t/spec/technical#
    path: technical.ttl
  g3tint:
    base: https://w3id.org/g3t/spec/integration#
    path: integration.ttl
  g3tux:
    base: https://w3id.org/g3t/spec/ux#
    path: ux.ttl
  g3tsec:
    base: https://w3id.org/g3t/spec/security#
    path: security.ttl
  g3trouting:
    base: https://w3id.org/g3t/spec/routing#
    path: routing/spec.ttl
upstreamOf:
  - g3tfunc
  - g3ttech
  - g3tint
  - g3tux
  - g3tsec
  - g3trouting
---

<!--specl
created: 2026-08-19
domain: graph-visualization
-->

# Intent

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

# Purpose

The long-term goal is a comprehensive graph visualization toolkit that
supports 90%+ of the 132 surveyed graph-visualization use cases
(research/use-case-survey.md, sections A and B, which also define the
capability clusters C1 through C8 referenced throughout these specs),
including:

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
identified in the foundational research (research/use-case-survey.md,
cluster observation following section B.8).

# Design Considerations

<!--specl: prose-->

The following six principles (P1 through P6) govern all design decisions.
They are referenced by identifier throughout the specification.

- DN1 P1. **Visualization-first; graph operations as optional installs.** The
  toolkit's primary intent is visualization. Graph algorithms and reasoning
  engines are optional dependencies. The test harness exercises them to
  verify visual encodings render correctly when algorithm results are present.

- DN2 P2. **Default working-set limits.** Every view that renders nodes or edges
  has a configurable default limit. These are soft defaults, not hard caps;
  the user overrides them with an explicit acknowledgment.

- DN3 P3. **Contextual view triggers (right-click universality).** Certain
  interactions (N-degree neighbor expansion, property inspection, "show in
  table") are available in every view via a consistent right-click context
  menu. The menu is extensible by plugins and Holonic portal definitions.

- DN4 P4. **RDF projection, not raw RDF rendering.** Raw RDF triple visualization
  is almost never the right rendering strategy. RDF data is projected to an
  LPG-like model (type collapse, literal collapse, blank-node resolution,
  list resolution, reification collapse) before rendering. A raw-triples
  mode exists for debugging and ontology inspection.

- DN5 P5. **Universal graph imperatives; defer limiting decisions.** The core
  interaction model, layout engine interface, selection/filter mechanics,
  and export pipeline are paradigm-neutral. Where a decision would restrict
  future paradigm support, it is deferred and documented rather than
  resolved prematurely.

- DN6 P6. **Holonic format as a first-class citizen.** The Holonic four-graph
  model (Interior, Boundary, Projection, Context) is a native data source.
  Holonic projections, portals, membrane validation, and holarchy topology
  are surfaced through the toolkit's standard archetype views and
  interaction patterns.

# Decisions

- D1 The Unified Graph Model (UGM) SHALL use a Qualified Edge abstraction that unifies RDF named-graph/RDF* provenance and LPG edge-properties into a single metadata bag on every edge. The view layer consumes only the Qualified Edge; it does not distinguish between RDF and LPG provenance mechanisms.
  - decisionStatus: accepted
  - rationale: Paradigm neutrality (P5) requires the view layer to be agnostic to the provenance mechanism. The adapter layer performs the mapping. Holonic `project_to_lpg()` already collapses RDF* to edge properties, validating this pattern.
  - affects: https://w3id.org/g3t/components#UnifiedGraphModel
  - affects: https://w3id.org/g3t/components#QualifiedEdge
  - affects: https://w3id.org/g3t/components#SPARQLAdapter
  - affects: https://w3id.org/g3t/components#CypherAdapter
  - affects: https://w3id.org/g3t/components#HolonicAdapter
  - owner: AG4

- D2 RDF data entering any visualization view (except Schema and raw-triples Inspector) SHALL pass through the ProjectionPipeline with all five collapse operations enabled by default. Raw RDF rendering is never the default.
  - decisionStatus: accepted
  - rationale: Raw RDF visualization produces unreadable hairballs for non-ontologist users. The Holonic library's `project_to_lpg()` validates that type/literal/blank-node/list/reification collapse produces analyst-friendly graphs. The "Standard" preset (R4.5) implements this. Collective targets, recorded here because specl has no way to name a set of components: all renderers. See N2b; restore as affects when a collection mechanism exists.
  - affects: https://w3id.org/g3t/components#ProjectionPipeline
  - affects: https://w3id.org/g3t/components#ViewRouter
  - owner: AG4

- D3 The right-click context menu SHALL be the primary interaction surface for contextual actions across all views. "Show N-degree neighbors" (default 1) SHALL be the first item in the menu. The menu SHALL be extensible by plugins and Holonic portals.
  - decisionStatus: accepted
  - rationale: Context menus reduce interaction cost for frequent actions by keeping the action adjacent to its target (see the interaction-pattern comparison in research/technology-survey.md). N-degree expansion is the single most common graph exploration action across all 8 capability clusters (C1 through C8; research/use-case-survey.md, section B). Making it the first menu item and defaulting to 1 degree minimizes clicks for the dominant workflow.
  - affects: https://w3id.org/g3t/components#ContextMenuManager
  - affects: https://w3id.org/g3t/components#PluginRegistry
  - affects: https://w3id.org/g3t/components#HolonicAdapter
  - owner: AG5

- D4 Graph algorithms (centrality, community detection, shortest path, embeddings, etc.) SHALL be optional installs, not hard dependencies. The toolkit SHALL consume algorithm results as node/edge properties; it SHALL NOT mandate a computation engine.
  - decisionStatus: accepted
  - rationale: The toolkit is visualization-first (P1). Bundling Neo4j GDS or igraph as a hard dependency would bloat the install, create licensing constraints, and couple the toolkit to a specific analytics stack. The test harness exercises algorithm-result rendering against mock data. Collective targets, recorded here because specl has no way to name a set of components: all renderers that support size/color encoding. See N2b; restore as affects when a collection mechanism exists.
  - affects: https://w3id.org/g3t/components#AlgorithmResultAdapter
  - owner: AG3

- D5 Working-set limits SHALL be soft defaults, not hard caps. The user CAN override them with an explicit acknowledgment. Platform administrators CAN set deployment-level overrides that users cannot exceed.
  - decisionStatus: accepted
  - rationale: Hard caps frustrate power users; no caps produce performance disasters on thin clients. Soft defaults with admin overrides balance usability and safety.
  - affects: https://w3id.org/g3t/components#WorkingSetManager
  - owner: AG5

- D6 Holonic format support SHALL be implemented as a clean, importable module (`g3_toolkit.holonic`), not as tightly coupled UI code. This module SHALL be importable by holonic-console without pulling in the full g3-toolkit UI stack.
  - decisionStatus: accepted
  - rationale: holonic-console will import this toolkit in the future. A clean module boundary avoids circular dependencies and allows holonic-console to use the adapter and projection layers without the rendering layer.
  - affects: https://w3id.org/g3t/components#HolonicAdapter
  - affects: https://w3id.org/g3t/components#ProjectionPipeline
  - affects: https://w3id.org/g3t/components#ModulePackaging
  - owner: AG3

- D7 The toolkit SHALL support two streaming layout modes: "stable" (layout frozen; new nodes animate into position without disturbing existing layout) and "live" (continuous incremental re-layout). The user SHALL toggle between modes.
  - decisionStatus: proposed
  - rationale: Both modes have valid use cases. Stable mode suits investigation (analyst pins nodes); live mode suits monitoring (layout should reflect current topology). The specific incremental layout algorithm for "live" mode is deferred (P5).
  - affects: https://w3id.org/g3t/components#LayoutEngine
  - affects: https://w3id.org/g3t/components#StreamAdapter
  - owner: AG3

- D8 Classification-aware redaction SHALL be a deployment-configuration concern, not a user-facing toggle. Two modes (structural and fog) SHALL be available; the deployment administrator selects one.
  - decisionStatus: accepted
  - rationale: Allowing users to toggle redaction modes would defeat the security purpose. The choice between structural and fog redaction has intelligence-tradecraft implications that must be decided at the deployment level.
  - affects: https://w3id.org/g3t/components#RedactionEngine
  - affects: https://w3id.org/g3t/components#LayoutEngine
  - owner: AG6

- D9 Reasoner-derived edges SHALL be visually distinguished from asserted edges via a dedicated visual encoding (dashed line, distinct color, icon badge). A "show only asserted" toggle SHALL be available.
  - decisionStatus: proposed
  - rationale: Users must know which edges are data and which are inferred. The specific visual encoding (dashed vs. colored vs. badged) is subject to user testing. The toggle is uncontroversial.
  - affects: https://w3id.org/g3t/components#EdgeRenderer
  - affects: https://w3id.org/g3t/components#ProjectionPipeline
  - owner: AG5

- D10 Natural-language-to-query input (GenAI) SHALL always display the generated SPARQL/Cypher/GQL to the user with a single-click edit option. The query SHALL never be invisible. Results from AI-generated queries SHALL carry a visual "AI-generated query" indicator until the user validates the query.
  - decisionStatus: proposed
  - rationale: Hallucinated queries presented as truthful results are a trust and safety concern. Transparency is non-negotiable. The specific LLM backend, prompt architecture, and validation strategy are deferred (P5).
  - affects: https://w3id.org/g3t/components#NLQueryEngine
  - affects: https://w3id.org/g3t/components#QueryEditor
  - affects: https://w3id.org/g3t/components#ResultRenderer
  - owner: AG2

- D11 The view layer SHALL be paradigm-neutral. All 12 archetype views consume a unified node/edge/property model. Paradigm-specific visual encodings (named-graph badges, holon-layer color coding, raw-triple inspection) are opt-in overlays, not structural assumptions. Where a design decision would restrict paradigm neutrality, it SHALL be deferred and documented rather than resolved.
  - decisionStatus: accepted
  - rationale: The foundational research (research/use-case-survey.md; research/technology-survey.md) identified that the RDF/LPG divide is a data-layer concern, not a visualization concern. Baking paradigm assumptions into the view layer would limit the toolkit to one paradigm and prevent the 90%+ use-case coverage target. Collective targets, recorded here because specl has no way to name a set of components: All renderers. See N2b; restore as affects when a collection mechanism exists.
  - affects: https://w3id.org/g3t/components#UnifiedGraphModel
  - owner: AG3

- D12 The toolkit SHALL track workspace/perspective dependencies on ontology versions. When the ontology changes (renamed class, deprecated property), saved perspectives that depend on the old version SHALL display a warning. The specific warning UX and migration-assistance features are deferred.
  - decisionStatus: proposed
  - rationale: Every ontology migration currently breaks saved perspectives silently. This is a known pain point in Stardog Studio and metaphactory deployments. The cost of not addressing it is ongoing support load.
  - affects: https://w3id.org/g3t/components#WorkspaceManager
  - affects: https://w3id.org/g3t/components#PerspectiveStore
  - affects: https://w3id.org/g3t/components#SchemaRenderer
  - owner: AG2

- D13 The toolkit's rendering layer SHALL be implemented in React (TypeScript). Non-rendering modules (UGM, adapters, projection pipeline, algorithm result adapter) SHALL be framework-agnostic TypeScript with no React dependency, ensuring they are importable by non-React consumers (including holonic-console per D6).
  - decisionStatus: accepted
  - rationale: The technology survey identified React as the ecosystem with the strongest FOSS library coverage for the g3t stack (FlexLayout, TanStack Table, React Flow as accessibility reference, ECharts React wrapper). Framework-agnostic alternatives (Lumino, vanilla Cytoscape.js) exist but fragment the integration surface. The D6 module boundary ensures the React choice does not infect the data layer. Collective targets, recorded here because specl has no way to name a set of components: All view components. See N2b; restore as affects when a collection mechanism exists.
  - affects: https://w3id.org/g3t/components#ModulePackaging
  - affects: https://w3id.org/g3t/components#BuildConfiguration
  - owner: AG3

- D14 The toolkit SHALL use a four-layer testing strategy: (1) Vitest unit tests for logic and data models, (2) React Testing Library component tests for rendering, (3) Playwright e2e tests for visual regression with screenshot baselines, and (4) Robot Framework acceptance tests for stakeholder-facing requirement verification with HTML reports. The shared test harness (`/?test-harness`) provides a deterministic rendering environment for layers 3 and 4.
  - decisionStatus: accepted
  - rationale: M0 acceptance testing revealed 4 bugs (invalid Cytoscape selector, zoom sensitivity, context menu wiring, layout density) that 90 passing unit tests did not catch. All were visual/interaction failures. M5-M10 are view-heavy milestones; automated visual regression is essential to avoid repeating the manual-only pattern. Robot Framework adds keyword-driven executable specifications tagged by requirement ID (R1.1, R2.5, etc.) for non-developer review. Collective targets, recorded here because specl has no way to name a set of components: all view components. See N2b; restore as affects when a collection mechanism exists.
  - affects: https://w3id.org/g3t/components#CIPipeline
  - affects: https://w3id.org/g3t/components#TestInfrastructure
  - owner: AG3

- D15 The canvas SHALL preserve the camera (pan/zoom) and node positions whenever the INPUT GRAPH is unchanged. A same-graph change (theme, spec, decorations, selection, hover) SHALL NOT re-initialize the instance, refit, or recenter. The view SHALL re-initialize or refit ONLY when the input graph genuinely differs (its node-id set changes) or in response to an EXPLICIT user operation: a fit/zoom control, focus/zoom-to, layout reheat, or layout-algorithm selection.
  - decisionStatus: accepted
  - rationale: Recreating the Cytoscape instance on every parent render reset the viewport and discarded manual node positions. Two triggers: (a) decoration props are passed as fresh object literals each render (e.g. structuralDecorations={{ collapsedContainers }}), so a selection or hover re-render changed the rebuild dependency by identity even when nothing relevant changed; (b) the recreated instance's preset layout fits by default. Reported by Zach (2026-06-20): collapsing a container, repositioning it, then selecting another container reverted the drag and the camera. Enforcers: theme/spec are restyle-only (style().fromJson, never re-init); decoration rebuilds key on decoration CONTENT, not object identity, and read the live decorations through a ref; structural rebuilds capture pan/zoom in the effect cleanup (cyRef is nulled before the next init runs, so the live camera cannot be read at init time) and restore it on a same-graph rebuild, fitting only on first mount or a different graph. Graph identity is the sorted top-level node-id set; it is stable across collapse/expand and re-layout and survives the asynchronous two-render geometry update (decorations land first, geometry second). Collective targets, recorded here because specl has no way to name a set of components: all canvas-hosting views, consumers passing decoration props. See N2b; restore as affects when a collection mechanism exists.
  - rationale: Known gap. A genuine structural geometry change (collapse, re-layout direction) still recreates the instance from layout geometry, so manual drags are not preserved across it; preserving them needs in-place position updates rather than a recreate. The force-directed (non-structural) path does not yet capture/restore the camera across a same-graph re-init; today its re-init triggers are real graph or layout changes, so no spurious reset occurs, but the explicit guarantee is implemented only for the structural (preset) path.
  - affects: https://w3id.org/g3t/components#CytoscapeCanvas
  - owner: AG3

# Open Questions

- OQ1 Layout-mixing UX for hybrid hierarchical/network graphs. When a single graph contains both containment hierarchies and free-form network edges, how does the user define "system boundary" regions within a single canvas (hierarchical layout inside, force-directed outside)?
  - resolutionStatus: open
  - owner: AG5
  - recommendation: Defer until user testing with MBSE engineers reveals the dominant interaction pattern. Candidate approaches: (a) user draws a boundary box and assigns a layout mode, (b) layout mode is inferred from edge types (containment = hierarchical, association = force-directed), (c) the user selects a "hybrid" layout that automatically nests hierarchical clusters.

- OQ2 User-configurable ProjectionPipelines. Should end-users be able to create or modify ProjectionPipeline configurations from within the toolkit UI, or is this an admin/developer concern? (Register of record; supersedes the duplicate formerly embedded in the Holonic integration spec.)
  - resolutionStatus: deferred
  - owner: AG2
  - recommendation: Initial release treats pipelines as pre-configured (admin-managed). User-configurable pipelines require a pipeline editor UI that is out of scope for v0.1. Revisit after initial adoption data is available.

- OQ3 NL-to-query engine selection. Which LLM backend, prompt architecture, and query-validation strategy should the toolkit use for natural-language-to-graph-query translation?
  - resolutionStatus: open
  - owner: AG3
  - recommendation: Define the NLQueryEngine interface contract first (input: NL string + schema context; output: query string + confidence score). Defer the implementation to a plugin. The interface must support showing the generated query to the user (D10).

- OQ4 Streaming layout algorithm choice. Which incremental layout algorithm should be used for the "live" streaming mode (D7)?
  - resolutionStatus: open
  - owner: AG3
  - recommendation: Evaluate D3-force with alpha-decay damping, Ogdf's incremental Sugiyama, and custom WebGL-accelerated force simulation. Selection depends on target node count (500 streaming default per P2) and target frame rate (30fps minimum).

- OQ5 Portal grouping UX. How should the right-click "Traverse portal to..." submenu present many (>10) outbound portals without overwhelming the analyst?
  - resolutionStatus: open
  - owner: AG5
  - recommendation: Flat list for <=10 portals; grouped by target holon type for >10. A "Browse all portals..." item opens a dedicated portal browser panel. Exact threshold subject to user testing.

- OQ6 Default projection per holon type. Which of the canonical projections (P4) should be on vs. off by default for different holon types or ontology domains? The safe default is "all collapses on" (D2), but ontology-curation workflows may need Type Collapse off.
  - resolutionStatus: deferred
  - owner: AG4
  - recommendation: Ship with "all collapses on" as the universal default. Allow per-holon-type overrides via Holonic Projection-layer declarations (R5.6). Gather feedback before introducing a settings UI.

- OQ7 Working-set limit numeric values. The specific defaults (500 nodes, 200x200 matrix, 10,000 table rows, 100 Sankey flows, 500-node streaming window) are initial recommendations. What are the right numbers?
  - resolutionStatus: open
  - owner: AG5
  - recommendation: Conduct performance profiling across target browsers and hardware (thin-client terminals, standard workstations, high-end analyst desktops). Set defaults to the threshold where interaction latency exceeds 100ms on the minimum supported hardware. Publish a hardware-compatibility matrix.

- OQ8 Graph algorithm plugin API surface. What is the interface contract between optional-install algorithms (P1) and the toolkit's visual encoding layer?
  - resolutionStatus: open
  - owner: AG3
  - recommendation: Define a minimal `AlgorithmResult` protocol: `node_id -> dict[str, Any]` for node-level results (centrality, community ID, embedding vector) and `edge_id -> dict[str, Any]` for edge-level results (predicted probability, flow value). The view layer maps property keys to visual channels (size, color, opacity) via a configurable `VisualEncoding` declaration. Exact protocol definition is a prerequisite for the first plugin release.

- OQ9 Write-back conflict resolution. R2.12 specifies inline editing with SHACL validation on commit, and the M9 milestone plan (planning/m9-evaluation.md) proposes an optimistic UI with rollback for write-back. What merge or conflict strategy applies when concurrent editors modify the same node/edge?
  - resolutionStatus: open
  - owner: AG3
  - recommendation: Last-write-wins is the simplest strategy and acceptable for initial release. Operational merge (CRDT or OT) is complex and should be deferred unless multi-user concurrent editing is a launch requirement. If so, evaluate Yjs or Automerge for the conflict-resolution layer.

- OQ10 holonic-console integration boundary. Which modules does holonic-console import from this toolkit, and which does it wrap or replace?
  - resolutionStatus: deferred
  - owner: AG3
  - recommendation: Defer until holonic-console's architecture stabilizes. The current design constraint is that `g3_toolkit.holonic` (the adapter and projection module) must be importable without pulling in the rendering layer. This is enforced by D6.

- OQ11 Handling of very large holarchies. What is the performance ceiling for `project_holarchy()` rendering when a holarchy contains hundreds or thousands of holons? Should the holarchy topology view have its own working-set limit distinct from the canvas default?
  - resolutionStatus: open
  - owner: AG4
  - recommendation: Apply the same 500-node canvas default (P2) to holarchy rendering. For larger holarchies, implement a "top-level holons only" aggregation with expand-on-click for sub-holarchies.

- OQ12 Edge-type-specific right-click actions. Beyond the universal right-click menu (R2.1), should the toolkit support edge-type-specific actions (e.g., "Show all transactions" when right-clicking a "transacts_with" edge, "Show all requirements" when right-clicking a "traces_to" edge)?
  - resolutionStatus: open
  - owner: AG5
  - recommendation: Yes, via the plugin extension mechanism (R2.3). Edge-type-specific actions register against a type filter. The question is whether to ship built-in actions for common edge types or leave this entirely to plugins. Recommend: leave to plugins initially; promote frequently-registered patterns to built-in in later releases.

- OQ13 Export behavior under fog redaction. R8.1 fog mode renders redacted nodes as opaque placeholders in views, while R8.4's acceptance criterion specifies exports contain "no trace" of redacted elements. These are consistent for structural redaction but unspecified for fog mode: should an export include placeholder stubs (leaking existence, consistent with the rendered view) or omit them entirely (no leakage, inconsistent with what the analyst saw)? The inference-leakage concern in US8.1 suggests omission, but the discrepancy between view and export must then be communicated to the user.
  - resolutionStatus: open
  - owner: AG6
  - recommendation: Default to omission (export contains no trace regardless of redaction mode) and annotate the export manifest with a count of withheld elements, so the analyst knows the export is intentionally incomplete without learning what was withheld.

- OQ14 Cross-holarchy navigation transition. What visual transition should indicate cross-holarchy navigation (traversing a portal from one holarchy into another)? Candidate approaches: watermark change, border-color change, breadcrumb trail, or animated zoom-through transition. (Moved from the Holonic integration spec; this register is the record of open questions.)
  - resolutionStatus: open
  - owner: AG5
  - recommendation: Breadcrumb trail with watermark change is the minimum viable design.

# Personas

- PER1 The investigation analyst who explores a graph to answer a question about it.
  - prefLabel: Analyst
  - altLabel: investigator
  - altLabel: data scientist
  - altLabel: intelligence analyst
  - altLabel: fraud analyst
- PER2 The engineer who reads a structural diagram to understand a system's composition.
  - prefLabel: Systems Engineer
  - altLabel: MBSE engineer
- PER3 The engineer who models and validates the ontology a graph conforms to. Works on the schema: class hierarchies, property domains and ranges, SHACL shapes and the reports they produce.
  - prefLabel: Ontology Engineer
  - altLabel: ontologist
- PER4 The engineer who curates knowledge-base content and reviews changes to it. Works on the instance data rather than the schema: entity pages, query libraries, revision history and write-back review. Kept distinct from PER3 by AG2 ruling 2026-08-20, because the two do different work and that difference drives which analytics and which views each needs.
  - prefLabel: Knowledge Engineer
  - altLabel: curator
- PER5 The engineer who connects a data source to the toolkit and shapes what it emits.
  - prefLabel: Data Engineer
- PER6 The developer who embeds the toolkit in a host application.
  - prefLabel: Frontend Developer
- PER7 The developer who extends the toolkit through its plugin surface.
  - prefLabel: Plugin Developer
- PER8 The administrator who deploys the toolkit and governs access to it.
  - prefLabel: Platform Administrator
- PER9 The engineer who checks a diagram against the model it claims to depict.
  - prefLabel: Reviewer
  - altLabel: design reviewer
- PER10 The engineer who arranges a diagram for legibility before publishing it.
  - prefLabel: Diagram Author
- PER11 The engineer who maintains the toolkit and diagnoses its output.
  - prefLabel: Maintainer
- PER12 The analyst who works the graph through assistive technology rather than the visual canvas.
  - prefLabel: Assistive Technology User
  - altLabel: visually impaired analyst


# Agents

- AG1 The routing track, accountable for router behaviour, separation, and the measurement harness.
  - prefLabel: Routing track
- AG2 The product owner, accountable for requirement changes including performance budgets and milestone scope.
  - prefLabel: Product owner
  - altLabel: Product Lead
- AG3 The repository architecture track, accountable for surface retirement, hit testing, and shared core modules.
  - prefLabel: Architecture track
  - altLabel: Architecture Lead
- AG4 The data layer track, accountable for the unified graph model, adapters, and the projection pipeline.
  - prefLabel: Data layer lead
- AG5 The interaction and accessibility track, accountable for interaction defaults and accessibility conformance.
  - prefLabel: UX lead
- AG6 The security track, accountable for redaction, authorization, and deployment posture.
  - prefLabel: Security lead
