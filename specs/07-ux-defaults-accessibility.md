---
spec_id: g3-ux
title: "g3-toolkit: UX Defaults and Accessibility"
version: 0.1.0
status: draft
---

# UX Defaults and Accessibility


<!--specl
created: 2026-05-17
parent: g3-overview
-->

## Intent

This specification defines working-set defaults (P2), accessibility
requirements, and cognitive-load management strategies. These are
cross-cutting concerns that apply to all archetype views.

## Requirements

- R7.1 The Link-Chart Canvas (R1.1) MUST default to a maximum of 500 visible nodes and 2,000 visible edges. When a query or expansion would exceed this limit, the toolkit MUST prompt the user with an aggregation suggestion ("Collapse by community?", "Show top-N by centrality?") or require explicit override.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: WorkingSetManager, CanvasRenderer
  - acceptance: Given a query returning 800 nodes, when the canvas attempts to render, then a prompt appears offering aggregation options before rendering proceeds.

- R7.2 The Hierarchical / Tree-Map view (R1.6) MUST default to a maximum of 1,000 visible nodes with lazy-load expansion. Deeper levels load on user-initiated expand.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: WorkingSetManager, TreeRenderer
  - acceptance: Given a 5,000-node hierarchy, when the tree view opens, then only the first two levels (up to 1,000 nodes) render; a "load more" indicator appears on deeper branches.

- R7.3 The Matrix / Heatmap view (R1.4) MUST default to a maximum of 200x200 cells. Larger matrices MUST be aggregated or paginated before rendering.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: WorkingSetManager, MatrixRenderer

- R7.4 The Tabular view (R1.7) MUST default to a maximum of 10,000 rows per page with pagination controls.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: WorkingSetManager, TableRenderer

- R7.5 The Sankey / Flow view (R1.9) MUST default to a maximum of 100 visible flow paths. Flows below a configurable threshold MUST be aggregated into an "other" category.
  - status: proposed
  - priority: SHOULD
  - role: Frontend Developer
  - constrains: WorkingSetManager, FlowRenderer

- R7.6 The Streaming / Operational Monitoring view (capability cluster C8) MUST default to a 500-node sliding window. Nodes outside the window age out unless explicitly pinned by the user.
  - status: proposed
  - priority: SHOULD
  - role: Frontend Developer
  - constrains: WorkingSetManager, StreamAdapter

- R7.7 All working-set limits MUST be configurable via workspace settings. Overriding a limit MUST require an explicit user action (e.g., clicking "Show all" with a performance warning). Limits MUST NOT be silently disabled.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer, Platform Administrator
  - constrains: WorkingSetManager
  - acceptance: Given a platform administrator who sets the canvas limit to 300 for a deployment, when an analyst opens a canvas, then the 300-node limit applies.

- R7.8 The toolkit MUST use colorblind-safe categorical palettes (Okabe-Ito or ColorBrewer-categorical) as the default color scheme for all views. No information MUST be encoded solely by color; shape, pattern, or label MUST serve as redundant channels.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: StyleManager
  - acceptance: Given two node types distinguished by color, when a colorblind-safe palette is active, then the types are also distinguishable by icon shape.

- R7.9 The toolkit MUST support keyboard navigation across nodes in the canvas. Tab order MUST default to degree-ordered (highest-degree nodes first) but MUST be overridable. Arrow keys MUST traverse edges from the focused node.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: AccessibilityManager, CanvasRenderer
  - acceptance: Given a canvas with 20 nodes, when the user presses Tab, then focus moves to the highest-degree node; pressing an arrow key moves focus along an edge to a neighbor.

- R7.10 The toolkit MUST provide screen-reader-compatible summaries for graph structures. When a node receives focus, the screen reader MUST announce: node label, node types, number of connections, and a breakdown by connected type (e.g., "Alice, Person, 5 connections: 3 to Person, 2 to Organization").
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: AccessibilityManager
  - acceptance: Given a screen reader active, when a node is focused via keyboard, then the reader announces the structured summary.

- R7.11 The Table view (R1.7) MUST serve as the accessible fallback for any selection. Any set of nodes/edges selected in any view MUST be representable as a table. This is the minimum-viable accessible representation of graph data.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: TableRenderer, AccessibilityManager

- R7.12 The toolkit MUST support a high-contrast mode for all views, compliant with WCAG 2.1 AA contrast ratios.
  - status: proposed
  - priority: MUST
  - role: Frontend Developer
  - constrains: StyleManager

## User Stories

- US7.1 As a visually impaired analyst using a screen reader, I want to navigate a graph by keyboard and hear structured summaries of each node so that I can perform link analysis without relying on the visual canvas.
  - asA: Visually Impaired Analyst
  - soThat: I can participate in investigations using the same toolkit as my sighted colleagues
  - status: proposed

- US7.2 As a platform administrator deploying to a classified environment, I want to set the canvas node limit to 200 for all users so that accidental large-graph rendering does not cause denial-of-service on thin-client terminals.
  - asA: Platform Administrator
  - soThat: I can ensure acceptable performance on constrained hardware
  - status: proposed
