# Roadmap

> Condensed summary. Historical ticket-by-ticket detail is in
> the CHANGELOG and source code.

## Completed Milestones

| Milestone | Name | Tickets | Key Deliverables |
|-----------|------|---------|-----------------|
| M0 | Foundation | 18 | UGM (Graphology wrapper), Cytoscape canvas, context menu |
| M1 | Interaction & Selection | 13 | Selection store, lasso, multi-select, search |
| M2 | Layout Engines | 7 | Force, hierarchy, dagre, elk |
| M3 | Data Adapters | 8 | SPARQL, Cypher, Holonic adapters |
| M4 | Projection Pipeline | 9 | RDF→LPG collapse transforms (5 types) |
| M5 | Secondary Views | 8 | Timeline, map, tree, schema, diff |
| M6 | Workspace & Schema | 8 | WorkspaceShell, SchemaView, QueryEditor |
| M7 | Charts & Enhancements | 8 | Path analysis, sankey, matrix, stats |
| M8 | Accessibility | 5 | AriaCompanion, keyboard navigation |
| M8.5 | UX Surface & Theming | 10 | ThemeManager, encoding panel, legend, toolbar |
| M10.5 | Integration Core | 6 | Middleware, RestAdapter, GremlinAdapter, event bus, build pipeline |
| M11 | Pipeline Infrastructure | 13 | DataPipeline, LinkedChart, PropertyFilter, ViewFilter, table enhancements |
| M12 | Customization & Filters | 10 | NodeStyleOverride, SVG icons, editor, context-sensitive menus, bulk ops |
| M13 | Advanced Features | 5 | PROV-O, DerivedPropertyEngine, subgraph pinning, temporal filter |
| M14 | Release Engineering | 11 | mathjs→expr-eval, package split, CI/publish, spec annotations, bundle analysis |

**Total: 139 tickets across 15 milestones.**

## Future Work (not scheduled)

**M9: Streaming & Write-Back**
StreamAdapter interface, optimistic UI with rollback, WebSocket
graph updates. See `planning/m9-evaluation.md` for exit criteria.

**M10: Security, Export, Documentation**
Role-based access, subgraph export (JSON-LD, GraphML, CSV),
TypeDoc API reference. See `planning/m10-evaluation.md`.

**Demo Overhaul (in progress)**
7 workflow-centric demos achieving 100% toolkit capability
coverage. Phase 1-3 complete (new components, fixtures, shells);
Phase 4 (polish) remaining. See `planning/demo-overhaul-spec.md`.

## Post-v1.0: Large Graph Support

Two complementary approaches, designed to be non-detrimental to
the toolkit's composability and single-renderer architecture.

### Approach 1: Smart Aggregation (CollapseByCluster)

Priority: high. Prerequisite: none.

Extends the ProjectionPipeline with a CollapseByCluster transform.
When a graph exceeds a configurable threshold (default 2,000
nodes), automatically collapse Louvain communities into supernodes.
The user drills into a cluster by clicking it, which replaces the
supernode with its contents (capped by WorkingSetManager).

Estimated: ~200 lines of D6 code.

### Approach 4: Worker Layout + Viewport Culling

Priority: medium. Prerequisite: Approach 1.

Compute force-directed layout in a Web Worker on the full graph
(up to 50K nodes). Only render nodes within the current viewport
(plus buffer) in Cytoscape using preset layout (frozen positions).
As the user pans, add/remove nodes without relayout.

Estimated: ~400 lines (Worker wrapper, spatial index, viewport sync).

### v1.0: Feature Enhancements (implemented)

8 features implemented, documented in `planning/v1-plus-features.md`:

| ID | Feature | Complexity |
|----|---------|-----------|
| F1 | Animated layout transitions | Low |
| F2 | Adaptive/incremental layouts | Medium |
| F3 | Node group collapsing (combos) | Medium |
| F4 | Annotations framework | Medium |
| F5 | Node/edge property edit | Medium |
| F6 | Enhanced map view + temporal controls | Medium-High |
| F7 | Link label styling | Low |
| F8 | Orthogonal edge routing (taxi) | Medium |

12 known gaps documented as not-planned (backend concerns,
out of scope, or application-level features).
