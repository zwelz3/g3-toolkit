---
spec_id: g3-func-interaction
title: "g3-toolkit: Interaction Patterns"
version: 0.1.0
status: draft
---

# Interaction Patterns


<!--specl
created: 2026-05-17
parent: g3-overview
-->

## Intent

This specification defines the cross-cutting interaction patterns that
operate across all archetype views. These are not view-specific features;
they are universal primitives (P3) that compose with any view.

## Requirements

- R2.1 The toolkit MUST provide a right-click context menu on every node in every view. The menu MUST include at minimum: "Show N-degree neighbors" (with a numeric input defaulting to 1), "Inspect properties" (opens Detail Inspector), "Show in table" (highlights row in Table view), and "Copy IRI."
  - status: implemented
  - priority: MUST
  - role: Frontend Developer
  - constrains: ContextMenuManager, CrossViewLinker
  - acceptance: Given a node in the canvas, when right-clicked, then the context menu appears with all four base items.
  - acceptance: Given a node in the table view, when right-clicked, then the same base context menu appears.
  - acceptance: Given a node in the map view, when right-clicked, then the same base context menu appears.

- R2.2 The toolkit MUST provide a right-click context menu on every edge in every view that renders edges. The menu MUST include at minimum: "Inspect properties," "Show provenance" (if provenance metadata exists), and "Hide edge type."
  - status: implemented
  - priority: MUST
  - role: Frontend Developer
  - constrains: ContextMenuManager, EdgeRenderer
  - acceptance: Given an edge with a confidence property, when "Show provenance" is selected, then the Detail Inspector opens with the provenance trace.

- R2.3 The right-click context menu MUST be extensible by plugins and by Holonic portal definitions. Plugin-registered menu items appear in a "Plugins" submenu. Holonic portal-derived items appear in a "Traverse portal to..." submenu.
  - status: implemented
  - priority: MUST
  - role: Plugin Developer, Frontend Developer
  - constrains: ContextMenuManager, PluginRegistry, HolonicAdapter
  - acceptance: Given a plugin that registers a "Run PageRank from here" action, when a node is right-clicked, then the item appears in the Plugins submenu.
  - acceptance: Given a Holonic holon with two outbound portals, when the holon node is right-clicked, then both portals appear in the "Traverse portal to..." submenu.

- R2.4 "Show N-degree neighbors" MUST default to 1 degree and MUST expand the neighborhood into the currently active canvas, respecting the working-set limit (P2). If the expansion would exceed the limit, the user MUST be prompted before rendering proceeds.
  - status: implemented
  - priority: MUST
  - role: Frontend Developer
  - constrains: GraphExpander, WorkingSetManager
  - acceptance: Given a canvas with 480 nodes and a node with 30 neighbors, when "Show 1-degree neighbors" is invoked, then the user is prompted ("This will add 30 nodes, exceeding the 500-node default. Proceed?").

- R2.5 The toolkit MUST support cross-view linking such that selecting an element in one view highlights or filters the corresponding element(s) in all other visible views in the same workspace.
  - status: implemented
  - priority: MUST
  - role: Frontend Developer
  - constrains: CrossViewLinker, WorkspaceManager
  - acceptance: Given a Canvas and a Table both visible, when a node is selected in the Canvas, then the corresponding row highlights in the Table.
  - acceptance: Given a Canvas and a Map both visible, when a node with coordinates is selected in the Canvas, then the map pans to and highlights the corresponding marker.

- R2.6 The toolkit MUST support expand/collapse (progressive disclosure) in the canvas and tree views. Collapsed groups MUST display a count badge and MUST be expandable via double-click or right-click menu.
  - status: implemented
  - priority: MUST
  - role: Analyst
  - constrains: NodeGrouper, LayoutEngine
  - acceptance: Given a community of 50 nodes collapsed into a group node, when the group is double-clicked, then the 50 nodes expand with a force-directed sub-layout.

- R2.7 The toolkit MUST support search and filter with faceted filtering by node type, edge type, and property values, full-text search across node labels and properties, and (when available) SPARQL/Cypher/GQL query input.
  - status: implemented
  - priority: MUST
  - role: Analyst, Data Engineer
  - constrains: SearchEngine, QueryAdapter
  - acceptance: Given a graph with Person and Organization nodes, when the facet "type: Person" is selected, then only Person nodes and their incident edges remain visible.

- R2.8 The toolkit MUST support selection and annotation, including multi-select (lasso, shift-click), tagging (user-defined labels on selected nodes), and user-defined grouping (manual clustering).
  - status: implemented
  - priority: MUST
  - role: Analyst
  - constrains: SelectionManager, AnnotationStore
  - acceptance: Given a lasso selection of 10 nodes, when the user tags them "Suspect Cluster A," then the tag persists across session save/reload.

- R2.9 The toolkit MUST support layout manipulation, including pinning nodes to fixed positions, manual drag-to-arrange, and switching between layout algorithms (force-directed, hierarchical, radial, geographic) without losing pin state.
  - status: implemented
  - priority: MUST
  - role: Analyst
  - constrains: LayoutEngine
  - acceptance: Given 5 pinned nodes and a switch from force-directed to hierarchical layout, when the layout completes, then the 5 pinned nodes remain at their user-assigned positions.

- R2.10 The toolkit SHOULD support temporal playback (animation of graph evolution over time) in the Timeline view and as a mode in the canvas.
  - status: in-progress
  - priority: SHOULD
  - role: Analyst
  - constrains: TimelineRenderer, AnimationEngine
  - acceptance: Given a temporal graph spanning 30 days, when playback is started at 1x speed, then nodes and edges appear/disappear according to their time validity.

- R2.11 The toolkit MUST support export and reporting, including subgraph export (JSON-LD, Turtle, CSV, PNG/SVG screenshot), structured report generation from selected elements, and workspace state serialization.
  - status: in-progress
  - priority: MUST
  - role: Analyst, Data Engineer
  - constrains: ExportManager
  - acceptance: Given a canvas with 50 selected nodes, when "Export subgraph as Turtle" is invoked, then a valid Turtle file containing those nodes, their properties, and their inter-edges is produced.

- R2.12 The toolkit SHOULD support data entry and curation, including inline editing of node/edge properties, relationship creation via drag-from-node, and SHACL validation feedback on commit.
  - status: in-progress
  - priority: SHOULD
  - role: Ontology Engineer, Analyst
  - constrains: WriteBackManager, SHACLValidator
  - acceptance: Given a node with an editable property, when the user changes the value and commits, then SHACL validation runs and displays pass/fail before the write is persisted.

- R2.13 The toolkit MUST support path analysis between two selected nodes, displaying the shortest path(s) as highlighted edges in the canvas. The user MUST be able to constrain paths by edge type and maximum hops.
  - status: implemented
  - priority: MUST
  - role: Analyst, Investigator
  - rationale: Gap analysis identified path analysis as a critical missing capability. C4 (Network Analytics; research/use-case-survey.md, section B.4) lists shortest path across 7 domains. All major investigation tools (Palantir, i2, Linkurious) provide this.
  - constrains: PathAnalysis, CanvasRenderer
  - acceptance: Given two selected nodes with at least one connecting path, when path analysis is invoked, then the shortest path's edges are highlighted in the canvas.
  - acceptance: Given a maximum-hops constraint of 2 and only a 3-hop path between the selected nodes, when path analysis is invoked, then no path is returned and the user is informed.

- R2.14 The toolkit MUST maintain an undo/redo stack for canvas operations (expand, collapse, filter, tag, group, delete). Ctrl+Z MUST undo; Ctrl+Shift+Z MUST redo. The stack depth MUST be configurable (default 50).
  - status: implemented
  - priority: MUST
  - role: Analyst, Knowledge Engineer
  - rationale: Gap analysis identified undo/redo as critical for iterative investigation. Without it, users avoid exploratory operations.
  - constrains: UndoRedoStack
  - acceptance: Given a node deletion followed by Ctrl+Z, when the undo completes, then the node and its incident edges are restored with their prior attributes.
  - acceptance: Given a configured stack depth of 2 and three successive operations, when undo is invoked three times, then only the two most recent operations are reverted.

- R2.15 The toolkit SHOULD support investigation bookmarks. A bookmark captures the current selection, active filters, and viewport state. When bookmarks are provided, they SHOULD persist across sessions and SHOULD be shareable as workspace state (R1.12).
  - status: proposed
  - priority: SHOULD
  - role: Analyst
  - rationale: Tagging (M1) provides node labels but no saved searches, subgraph bookmarks, or timestamped investigation notes.
  - constrains: AnnotationStore, WorkspaceManager
  - acceptance: Given a saved bookmark and a reloaded session, when the bookmark is activated, then the captured selection, filters, and viewport are restored.

- R2.16 The toolkit SHOULD provide change history and review components for write-back-enabled deployments: a per-entity revision feed (timestamp, principal, property-level diff) rendered from history records the adapter supplies, and a local review queue listing pending edits with accept/reject actions routed through the write path (R2.12). History retention and authoritative approval state are backend concerns surfaced through the adapter contract, not stored by the toolkit.
  - status: proposed
  - priority: SHOULD
  - role: Curator, Knowledge Engineer, Platform Administrator
  - rationale: Capability landscape (research/capability-landscape.md, section E.2). Every surveyed system with a write path also ships review (Wikidata history and patrol, TopBraid change management); write-back without history is an irreversible-edit surface.
  - constrains: RevisionFeed, ReviewQueue, WriteBackManager
  - acceptance: Given an adapter exposing three revisions of an entity, when the revision feed opens, then three entries render with property-level diffs in reverse chronological order.
  - acceptance: Given a pending edit in the review queue, when it is rejected, then no write is issued and the queue entry records the rejection.

- R2.17 The toolkit SHOULD provide a saved-query library and session query history for the Query Editor (R1.13): queries are nameable, parameterizable (declared placeholders prompt for values on run), and persist via the same pluggable storage used by annotations. History captures executed query text and target adapter per session.
  - status: proposed
  - priority: SHOULD
  - role: Data Engineer, Data Scientist, Analyst
  - rationale: Capability landscape (research/capability-landscape.md, section E.3). Saved queries and history ship in every surveyed database console (Neo4j Browser, GraphDB Workbench, Stardog Studio); their absence forces re-authoring in curation and analytics workflows.
  - constrains: QueryLibrary, QueryEditor, AnnotationStore
  - acceptance: Given a saved query with a declared parameter, when it is run from the library, then the user is prompted for the parameter value and the substituted query executes against the selected adapter.
  - acceptance: Given three queries executed in a session, when the history panel opens, then the three entries render most-recent-first and re-running an entry executes it unchanged.

## User Stories

- US2.1 As an analyst, I want to right-click any node in any view and select "Show 1-degree neighbors" so that I can incrementally build my working set without typing queries.
  - asA: Intelligence Analyst
  - soThat: I can explore a network without leaving the visual context
  - status: proposed

- US2.2 As a platform administrator, I want to register a custom right-click action via a plugin so that domain-specific operations (e.g., "Submit SAR," "Flag for review") are available directly from the graph canvas.
  - asA: Platform Administrator
  - soThat: Analysts can take operational actions without switching applications
  - status: proposed

- US2.3 As a fraud analyst, I want to select a cluster of nodes in the canvas and see them highlighted in the timeline and table simultaneously so that I can verify temporal and property-level patterns.
  - asA: Fraud Analyst
  - soThat: I can correlate visual structure with data details in one gesture
  - status: proposed

