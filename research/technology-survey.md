# FOSS Visualization Technology Survey

A comprehensive survey of free and open-source visualization libraries,
layout engines, rendering technologies, and composition frameworks
evaluated against the g3-toolkit's 94-capability specification matrix.

Conducted May 2026 to inform design decisions D1-D12 and open questions
OQ1-OQ12 in the g3t specification.

## Summary

No single FOSS graph library satisfies the full 94-capability matrix.
The closest are Cytoscape.js (~70/94) and Sigma.js v3 + Graphology
(~55/94 but with the highest node-count ceiling). The recommended stack
centers on Cytoscape.js for the primary canvas, Graphology for the
in-memory Unified Graph Model, elkjs + d3-force for layout, and a
composition layer of FlexLayout + Zustand + MapLibre + vis-timeline +
TanStack Table + Apache ECharts.

The two unavoidable risks are (1) accessibility, since no surveyed FOSS
graph renderer ships ARIA/keyboard navigation sufficient for WCAG 2.1 AA,
and (2) layout switching while preserving pinned positions (C5), which no
single layout engine implements.

## Recommended Technology Stack

| Concern | Pick | License | Risk |
|---|---|---|---|
| Graph canvas (primary) | Cytoscape.js + extensions | MIT | Perf ceiling ~5k nodes; no built-in ARIA |
| Graph canvas (scale fallback) | Sigma.js v3 + Graphology | MIT | No compound nodes; no DOM for a11y |
| In-memory UGM | Graphology + custom wrapper | MIT | Low |
| Layout: hierarchical | elkjs (Web Worker) | EPL-2.0 | Slows past ~2k nodes |
| Layout: force | d3-force | ISC | Use Web Worker beyond 1k |
| Layout: tree/radial | d3-hierarchy | ISC | Low |
| Layout: DAG quick | dagre / @dagrejs/dagre | MIT | Slowed maintenance |
| Map | MapLibre GL JS + Deck.gl | BSD-3 + MIT | Low |
| Timeline | vis-timeline | Apache-2.0 | Community-maintained |
| Charts + Sankey + Chord + Heatmap | Apache ECharts | Apache-2.0 | Low |
| Data table | TanStack Table + react-virtual | MIT | Low |
| PDF viewer | Mozilla PDF.js | Apache-2.0 | Low |
| Workspace composition | FlexLayout (flexlayout-react) | MIT | Low |
| Event bus / state | Zustand (+ RxJS for streams) | MIT + Apache-2.0 | Low |

## Graph Rendering Library Comparison

### Top 3 Candidates

**Cytoscape.js (MIT, Canvas 2D):** Best all-around capability coverage.
Native compound nodes with expand/collapse extension. Rich stylesheet
API for every visual channel. First-class right-click events
(`cxttap`) with cxtmenu and context-menus extensions. Mature extension
ecosystem (70+ extensions). Weakest at very large scale (~5k element
interactive ceiling) and accessibility (maintainer defers to app
authors).

**Sigma.js v3 + Graphology (MIT, WebGL):** Highest node-count ceiling
(tens of thousands). Cleanest separation of concerns (Graphology as
data structure, Sigma as renderer). No compound node support. Custom
WebGL shader programs required for non-circle node shapes. Right-click
coordinates exposed but menu UI is BYO. No DOM nodes for screen
readers.

**React Flow / xyflow (MIT, DOM/SVG via React):** Best React
integration and the only FOSS graph library with built-in keyboard
accessibility (Tab focus, Enter/Space select, arrow-key move,
aria-live announcements). Worst at scale (DOM-per-node ceiling ~1,000
nodes). No built-in layout algorithms.

### Filtering Criteria

Three capabilities sharply filter the candidate field:

1. **Compound nodes (C7-C8):** Only Cytoscape.js, G6, elkjs (layout
   only), and React Flow's sub-flows support true compound containers.
   Sigma.js, Cosmos, ngraph, Reagraph, and force-graph do not.

2. **Right-click on nodes AND edges (C39-C42):** Only Cytoscape.js and
   G6 have first-class right-click handling on nodes, edges, AND
   background with extensible plugin APIs.

3. **Accessibility (C53-C57):** Only React Flow ships built-in keyboard
   navigation and ARIA. All other candidates require a custom "ARIA
   Companion" pattern (estimated 3-8 engineer-weeks).

## Layout Engine Comparison

| Engine | License | Families | Compound | Incremental | Pinning | Web Worker |
|---|---|---|---|---|---|---|
| elkjs | EPL-2.0 | Layered, force, tree, radial, stress | Yes | Partial | Yes | Yes (default) |
| dagre | MIT | Layered (Sugiyama-lite) | No | No | No | No (sync) |
| d3-force | ISC | Force, charge, collide, radial | No | Yes | Yes (fx/fy) | Yes |
| d3-hierarchy | ISC | Tree, cluster, treemap, pack | n/a | n/a | n/a | n/a |
| Graphviz WASM | Apache-2.0 | dot, neato, fdp, twopi, circo | Yes (clusters) | No | Yes | Yes |
| WebCola | MIT | Constraint-based, flow, alignment | Partial | Yes | Yes | No |

Recommendation: elkjs (hierarchical/compound) + d3-force (force with
pinning) + d3-hierarchy (tree/treemap) + dagre (fast DAG fallback).

## Non-Graph View Recommendations

| View | Primary | Fallback | Rationale |
|---|---|---|---|
| Timeline | vis-timeline (Apache-2.0) | visx Brush + d3 (MIT) | 8+ years polish; brush, scrub, cluster |
| Map | MapLibre GL JS + Deck.gl (BSD-3 + MIT) | Leaflet (BSD-2) | Open fork of Mapbox v1; Deck.gl for density |
| Table | TanStack Table (MIT) | AG Grid Community (MIT) | Headless, tree-shakable, fully typed |
| Charts | Apache ECharts (Apache-2.0) | Plotly.js (MIT) | All chart types in one bundle |
| Sankey/Chord | Apache ECharts (Apache-2.0) | d3-sankey/d3-chord (ISC) | Single library |
| Heatmap | ECharts + Deck.gl HeatmapLayer | D3 custom | ECharts for small; Deck.gl for geo |
| PDF | Mozilla PDF.js (Apache-2.0) | n/a | Only mature FOSS browser PDF renderer |

## Workspace Composition

FlexLayout (MIT, Caplin Systems) recommended for React stacks. Supports
tabbed + split + floating panels, model serialization via
`Model.fromJson()`/`toJson()`, and heterogeneous child components.
Lumino (BSD-3, JupyterLab) is the framework-neutral alternative.

## Event Bus and State Management

Zustand (MIT) as the primary cross-view selection store. Selector-based
subscriptions ensure views re-render only when their state slice
changes. RxJS (Apache-2.0) reserved for high-frequency streams
(timeline scrubbing, force-tick rendering at 60Hz).

## Rendering Strategy

Hybrid Canvas-2D-with-DOM-overlay (Cytoscape.js model) as primary;
WebGL-with-DOM-overlay (Sigma.js model) for large-scale fallback. Pure
SVG reserved for non-graph views where accessibility is paramount.

## Accessibility Assessment

No FOSS graph renderer achieves WCAG 2.1 AA out of the box.
Recommended approach: build an "ARIA Companion" plugin that constructs
a visually-hidden but focusable list of nodes synchronized to the graph
via events, forwarding keyboard events to the renderer's selection API.
Estimated effort: 3-6 engineer-weeks for Cytoscape.js, 4-8 for
Sigma.js, 1-2 for React Flow (which has built-in support).

## Anti-Recommendations

Technologies explicitly rejected (do not re-evaluate):

- **yFiles, KeyLines, Ogma, Tom Sawyer** — proprietary
- **Gephi Lite** — GPL-3.0 (copyleft incompatible)
- **Mapbox GL JS v2+** — proprietary since December 2020
- **vis-network as primary canvas** — aging, no compound nodes, no a11y
- **Springy** — last release 8 years ago
- **Cosmos.gl / Reagraph as primary** — no compound nodes, no a11y
- **D3 raw as primary canvas** — building a graph renderer from scratch
- **Plotly.js as primary charts** — ~3MB bundle
- **React-Grid-Layout for workspace** — tiles only, no tabs/docking
- **Redux for event bus** — over-engineered for selection sync
- **OGDF.js** — no maintained WASM port
- **React Flow as primary analytical canvas** — DOM-per-node ceiling ~1k
