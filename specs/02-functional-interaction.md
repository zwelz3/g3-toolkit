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
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: ContextMenuManager, CrossViewLinker
  - acceptance: Given a node in the canvas, when right-clicked, then the context menu appears with all four base items.
  - acceptance: Given a node in the table view, when right-clicked, then the same base context menu appears.
  - acceptance: Given a node in the map view, when right-clicked, then the same base context menu appears.

- R2.2 The toolkit MUST provide a right-click context menu on every edge in every view that renders edges. The menu MUST include at minimum: "Inspect properties," "Show provenance" (if provenance metadata exists), and "Hide edge type."
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: ContextMenuManager, EdgeRenderer
  - acceptance: Given an edge with a confidence property, when "Show provenance" is selected, then the Detail Inspector opens with the provenance trace.

- R2.3 The right-click context menu MUST be extensible by plugins and by Holonic portal definitions. Plugin-registered menu items appear in a "Plugins" submenu. Holonic portal-derived items appear in a "Traverse portal to..." submenu.
  - status: proposed
  - priority: MUST
  - role: Plugin Developer, Frontend Developer
  - constrains: ContextMenuManager, PluginRegistry, HolonicAdapter
  - acceptance: Given a plugin that registers a "Run PageRank from here" action, when a node is right-clicked, then the item appears in the Plugins submenu.
  - acceptance: Given a Holonic holon with two outbound portals, when the holon node is right-clicked, then both portals appear in the "Traverse portal to..." submenu.

- R2.4 "Show N-degree neighbors" MUST default to 1 degree and MUST expand the neighborhood into the currently active canvas, respecting the working-set limit (P2). If the expansion would exceed the limit, the user MUST be prompted before rendering proceeds.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: GraphExpander, WorkingSetManager
  - acceptance: Given a canvas with 480 nodes and a node with 30 neighbors, when "Show 1-degree neighbors" is invoked, then the user is prompted ("This will add 30 nodes, exceeding the 500-node default. Proceed?").

- R2.5 The toolkit MUST support cross-view linking such that selecting an element in one view highlights or filters the corresponding element(s) in all other visible views in the same workspace.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: CrossViewLinker, WorkspaceManager
  - acceptance: Given a Canvas and a Table both visible, when a node is selected in the Canvas, then the corresponding row highlights in the Table.
  - acceptance: Given a Canvas and a Map both visible, when a node with coordinates is selected in the Canvas, then the map pans to and highlights the corresponding marker.

- R2.6 The toolkit MUST support expand/collapse (progressive disclosure) in the canvas and tree views. Collapsed groups MUST display a count badge and MUST be expandable via double-click or right-click menu.
  - status: proposed
  - priority: MUST
  - role: Analyst
  - constrains: NodeGrouper, LayoutEngine
  - acceptance: Given a community of 50 nodes collapsed into a group node, when the group is double-clicked, then the 50 nodes expand with a force-directed sub-layout.

- R2.7 The toolkit MUST support search and filter with faceted filtering by node type, edge type, and property values, full-text search across node labels and properties, and (when available) SPARQL/Cypher/GQL query input.
  - status: proposed
  - priority: MUST
  - role: Analyst, Data Engineer
  - constrains: SearchEngine, QueryAdapter
  - acceptance: Given a graph with Person and Organization nodes, when the facet "type: Person" is selected, then only Person nodes and their incident edges remain visible.

- R2.8 The toolkit MUST support selection and annotation, including multi-select (lasso, shift-click), tagging (user-defined labels on selected nodes), and user-defined grouping (manual clustering).
  - status: proposed
  - priority: MUST
  - role: Analyst
  - constrains: SelectionManager, AnnotationStore
  - acceptance: Given a lasso selection of 10 nodes, when the user tags them "Suspect Cluster A," then the tag persists across session save/reload.

- R2.9 The toolkit MUST support layout manipulation, including pinning nodes to fixed positions, manual drag-to-arrange, and switching between layout algorithms (force-directed, hierarchical, radial, geographic) without losing pin state.
  - status: proposed
  - priority: MUST
  - role: Analyst
  - constrains: LayoutEngine
  - acceptance: Given 5 pinned nodes and a switch from force-directed to hierarchical layout, when the layout completes, then the 5 pinned nodes remain at their user-assigned positions.

- R2.10 The toolkit SHOULD support temporal playback (animation of graph evolution over time) in the Timeline view and as a mode in the canvas.
  - status: proposed
  - priority: SHOULD
  - role: Analyst
  - constrains: TimelineRenderer, AnimationEngine
  - acceptance: Given a temporal graph spanning 30 days, when playback is started at 1x speed, then nodes and edges appear/disappear according to their time validity.

- R2.11 The toolkit MUST support export and reporting, including subgraph export (JSON-LD, Turtle, CSV, PNG/SVG screenshot), structured report generation from selected elements, and workspace state serialization.
  - status: proposed
  - priority: MUST
  - role: Analyst, Data Engineer
  - constrains: ExportManager
  - acceptance: Given a canvas with 50 selected nodes, when "Export subgraph as Turtle" is invoked, then a valid Turtle file containing those nodes, their properties, and their inter-edges is produced.

- R2.12 The toolkit SHOULD support data entry and curation, including inline editing of node/edge properties, relationship creation via drag-from-node, and SHACL validation feedback on commit.
  - status: proposed
  - priority: SHOULD
  - role: Ontology Engineer, Analyst
  - constrains: WriteBackManager, SHACLValidator
  - acceptance: Given a node with an editable property, when the user changes the value and commits, then SHACL validation runs and displays pass/fail before the write is persisted.

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

- R2.13 The toolkit MUST support path analysis between two selected nodes, displaying the shortest path(s) as highlighted edges in the canvas. The user MUST be able to constrain paths by edge type and maximum hops.
  - status: accepted
  - priority: MUST
  - role: Analyst, Investigator
  - rationale: Gap analysis identified path analysis as a critical missing capability. C4 (Network Analytics) lists shortest path across 7 domains. All major investigation tools (Palantir, i2, Linkurious) provide this.

- R2.14 The toolkit MUST maintain an undo/redo stack for canvas operations (expand, collapse, filter, tag, group, delete). Ctrl+Z MUST undo; Ctrl+Shift+Z MUST redo. The stack depth MUST be configurable (default 50).
  - status: accepted
  - priority: MUST
  - role: Analyst, Knowledge Engineer
  - rationale: Gap analysis identified undo/redo as critical for iterative investigation. Without it, users avoid exploratory operations.

- R2.15 The toolkit SHOULD support investigation bookmarks. A bookmark captures the current selection, active filters, and viewport state. Bookmarks MUST persist across sessions and MUST be shareable as workspace state (R1.12).
  - status: accepted
  - priority: SHOULD
  - role: Analyst
  - rationale: Tagging (M1) provides node labels but no saved searches, subgraph bookmarks, or timestamped investigation notes.
