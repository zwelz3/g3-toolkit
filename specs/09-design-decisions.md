---
spec_id: g3-decisions
title: "g3-toolkit: Design Decisions"
version: 0.1.0
status: draft
---

# Design Decisions


<!--specl
created: 2026-05-17
parent: g3-overview
-->

## Intent

This section records architectural and design decisions that shape the
toolkit. Each decision documents the alternatives considered, the
rationale for the chosen direction, and the components affected.
Decisions with status "considering" are not yet finalized.

## Decisions

- D1 The Unified Graph Model (UGM) SHALL use a Qualified Edge abstraction that unifies RDF named-graph/RDF* provenance and LPG edge-properties into a single metadata bag on every edge. The view layer consumes only the Qualified Edge; it does not distinguish between RDF and LPG provenance mechanisms.
  - status: accepted
  - rationale: Paradigm neutrality (P5) requires the view layer to be agnostic to the provenance mechanism. The adapter layer performs the mapping. Holonic `project_to_lpg()` already collapses RDF* to edge properties, validating this pattern.
  - affects: UnifiedGraphModel, QualifiedEdge, SPARQLAdapter, CypherAdapter, HolonicAdapter
  - owner: Data Layer Lead

- D2 RDF data entering any visualization view (except Schema and raw-triples Inspector) SHALL pass through the ProjectionPipeline with all five collapse operations enabled by default. Raw RDF rendering is never the default.
  - status: accepted
  - rationale: Raw RDF visualization produces unreadable hairballs for non-ontologist users. The Holonic library's `project_to_lpg()` validates that type/literal/blank-node/list/reification collapse produces analyst-friendly graphs. The "Standard" preset (R4.5) implements this.
  - affects: ProjectionPipeline, ViewRouter, all renderers
  - owner: Data Layer Lead

- D3 The right-click context menu SHALL be the primary interaction surface for contextual actions across all views. "Show N-degree neighbors" (default 1) SHALL be the first item in the menu. The menu SHALL be extensible by plugins and Holonic portals.
  - status: accepted
  - rationale: Context menus reduce interaction cost for frequent actions by keeping the action adjacent to its target (see the interaction-pattern comparison in research/technology-survey.md). N-degree expansion is the single most common graph exploration action across all 8 capability clusters (C1 through C8; research/use-case-survey.md, section B). Making it the first menu item and defaulting to 1 degree minimizes clicks for the dominant workflow.
  - affects: ContextMenuManager, PluginRegistry, HolonicAdapter
  - owner: UX Lead

- D4 Graph algorithms (centrality, community detection, shortest path, embeddings, etc.) SHALL be optional installs, not hard dependencies. The toolkit SHALL consume algorithm results as node/edge properties; it SHALL NOT mandate a computation engine.
  - status: accepted
  - rationale: The toolkit is visualization-first (P1). Bundling Neo4j GDS or igraph as a hard dependency would bloat the install, create licensing constraints, and couple the toolkit to a specific analytics stack. The test harness exercises algorithm-result rendering against mock data.
  - affects: AlgorithmResultAdapter, all renderers that support size/color encoding
  - owner: Architecture Lead

- D5 Working-set limits SHALL be soft defaults, not hard caps. The user CAN override them with an explicit acknowledgment. Platform administrators CAN set deployment-level overrides that users cannot exceed.
  - status: accepted
  - rationale: Hard caps frustrate power users; no caps produce performance disasters on thin clients. Soft defaults with admin overrides balance usability and safety.
  - affects: WorkingSetManager
  - owner: UX Lead

- D6 Holonic format support SHALL be implemented as a clean, importable module (`g3_toolkit.holonic`), not as tightly coupled UI code. This module SHALL be importable by holonic-console without pulling in the full g3-toolkit UI stack.
  - status: accepted
  - rationale: holonic-console will import this toolkit in the future. A clean module boundary avoids circular dependencies and allows holonic-console to use the adapter and projection layers without the rendering layer.
  - affects: HolonicAdapter, ProjectionPipeline, module packaging
  - owner: Architecture Lead

- D7 The toolkit SHALL support two streaming layout modes: "stable" (layout frozen; new nodes animate into position without disturbing existing layout) and "live" (continuous incremental re-layout). The user SHALL toggle between modes.
  - status: considering
  - rationale: Both modes have valid use cases. Stable mode suits investigation (analyst pins nodes); live mode suits monitoring (layout should reflect current topology). The specific incremental layout algorithm for "live" mode is deferred (P5).
  - affects: LayoutEngine, StreamAdapter
  - owner: Architecture Lead

- D8 Classification-aware redaction SHALL be a deployment-configuration concern, not a user-facing toggle. Two modes (structural and fog) SHALL be available; the deployment administrator selects one.
  - status: accepted
  - rationale: Allowing users to toggle redaction modes would defeat the security purpose. The choice between structural and fog redaction has intelligence-tradecraft implications that must be decided at the deployment level.
  - affects: RedactionEngine, LayoutEngine
  - owner: Security Lead

- D9 Reasoner-derived edges SHALL be visually distinguished from asserted edges via a dedicated visual encoding (dashed line, distinct color, icon badge). A "show only asserted" toggle SHALL be available.
  - status: considering
  - rationale: Users must know which edges are data and which are inferred. The specific visual encoding (dashed vs. colored vs. badged) is subject to user testing. The toggle is uncontroversial.
  - affects: EdgeRenderer, ProjectionPipeline
  - owner: UX Lead

- D10 Natural-language-to-query input (GenAI) SHALL always display the generated SPARQL/Cypher/GQL to the user with a single-click edit option. The query SHALL never be invisible. Results from AI-generated queries SHALL carry a visual "AI-generated query" indicator until the user validates the query.
  - status: considering
  - rationale: Hallucinated queries presented as truthful results are a trust and safety concern. Transparency is non-negotiable. The specific LLM backend, prompt architecture, and validation strategy are deferred (P5).
  - affects: NLQueryEngine, QueryEditor, ResultRenderer
  - owner: Product Lead

- D11 The view layer SHALL be paradigm-neutral. All 12 archetype views consume a unified node/edge/property model. Paradigm-specific visual encodings (named-graph badges, holon-layer color coding, raw-triple inspection) are opt-in overlays, not structural assumptions. Where a design decision would restrict paradigm neutrality, it SHALL be deferred and documented rather than resolved.
  - status: accepted
  - rationale: The foundational research (research/use-case-survey.md; research/technology-survey.md) identified that the RDF/LPG divide is a data-layer concern, not a visualization concern. Baking paradigm assumptions into the view layer would limit the toolkit to one paradigm and prevent the 90%+ use-case coverage target.
  - affects: All renderers, UnifiedGraphModel
  - owner: Architecture Lead

- D12 The toolkit SHALL track workspace/perspective dependencies on ontology versions. When the ontology changes (renamed class, deprecated property), saved perspectives that depend on the old version SHALL display a warning. The specific warning UX and migration-assistance features are deferred.
  - status: considering
  - rationale: Every ontology migration currently breaks saved perspectives silently. This is a known pain point in Stardog Studio and metaphactory deployments. The cost of not addressing it is ongoing support load.
  - affects: WorkspaceManager, PerspectiveStore, SchemaRenderer
  - owner: Product Lead

- D13 The toolkit's rendering layer SHALL be implemented in React (TypeScript). Non-rendering modules (UGM, adapters, projection pipeline, algorithm result adapter) SHALL be framework-agnostic TypeScript with no React dependency, ensuring they are importable by non-React consumers (including holonic-console per D6).
  - status: accepted
  - rationale: The technology survey identified React as the ecosystem with the strongest FOSS library coverage for the g3t stack (FlexLayout, TanStack Table, React Flow as accessibility reference, ECharts React wrapper). Framework-agnostic alternatives (Lumino, vanilla Cytoscape.js) exist but fragment the integration surface. The D6 module boundary ensures the React choice does not infect the data layer.
  - affects: All view components, module packaging, build configuration
  - owner: Architecture Lead

- D14 The toolkit SHALL use a four-layer testing strategy: (1) Vitest unit tests for logic and data models, (2) React Testing Library component tests for rendering, (3) Playwright e2e tests for visual regression with screenshot baselines, and (4) Robot Framework acceptance tests for stakeholder-facing requirement verification with HTML reports. The shared test harness (`/?test-harness`) provides a deterministic rendering environment for layers 3 and 4.
  - status: accepted
  - rationale: M0 acceptance testing revealed 4 bugs (invalid Cytoscape selector, zoom sensitivity, context menu wiring, layout density) that 90 passing unit tests did not catch. All were visual/interaction failures. M5-M10 are view-heavy milestones; automated visual regression is essential to avoid repeating the manual-only pattern. Robot Framework adds keyword-driven executable specifications tagged by requirement ID (R1.1, R2.5, etc.) for non-developer review.
  - affects: CI pipeline, test infrastructure, all view components
  - owner: Architecture Lead

- D15 The canvas SHALL preserve the camera (pan/zoom) and node positions whenever the INPUT GRAPH is unchanged. A same-graph change (theme, spec, decorations, selection, hover) SHALL NOT re-initialize the instance, refit, or recenter. The view SHALL re-initialize or refit ONLY when the input graph genuinely differs (its node-id set changes) or in response to an EXPLICIT user operation: a fit/zoom control, focus/zoom-to, layout reheat, or layout-algorithm selection.
  - status: accepted
  - rationale: Recreating the Cytoscape instance on every parent render reset the viewport and discarded manual node positions. Two triggers: (a) decoration props are passed as fresh object literals each render (e.g. structuralDecorations={{ collapsedContainers }}), so a selection or hover re-render changed the rebuild dependency by identity even when nothing relevant changed; (b) the recreated instance's preset layout fits by default. Reported by Zach (2026-06-20): collapsing a container, repositioning it, then selecting another container reverted the drag and the camera. Enforcers: theme/spec are restyle-only (style().fromJson, never re-init); decoration rebuilds key on decoration CONTENT, not object identity, and read the live decorations through a ref; structural rebuilds capture pan/zoom in the effect cleanup (cyRef is nulled before the next init runs, so the live camera cannot be read at init time) and restore it on a same-graph rebuild, fitting only on first mount or a different graph. Graph identity is the sorted top-level node-id set; it is stable across collapse/expand and re-layout and survives the asynchronous two-render geometry update (decorations land first, geometry second).
  - gap: A genuine structural geometry change (collapse, re-layout direction) still recreates the instance from layout geometry, so manual drags are not preserved across it; preserving them needs in-place position updates rather than a recreate. The force-directed (non-structural) path does not yet capture/restore the camera across a same-graph re-init; today its re-init triggers are real graph or layout changes, so no spurious reset occurs, but the explicit guarantee is implemented only for the structural (preset) path.
  - affects: CytoscapeCanvas, all canvas-hosting views, consumers passing decoration props
  - owner: Architecture Lead
