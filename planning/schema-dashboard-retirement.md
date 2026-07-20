# Schema Dashboard retirement (2026-07-07)

Maintainer ruling (review remediation plan, decision 8.4): retire the
Schema Dashboard. Review finding SD-1 judged the surface redundant:
its narrative ("structure and paradigm") is carried better by the
Ontology Workbench (live class hierarchy over a store, with
inference), and its two distinctive visualizations needed a
demonstration home with more context, not a standalone page. This
follows the flagship-retirement precedent (see
planning/flagship-retirement.md): a fold/remove matrix audited
against Storybook, the wiring guide, the shells, and the remaining
dashboards, executed in the same round as the removal.

## Surface the Schema Dashboard alone demonstrated, and where it went

| Capability (public API) | Disposition                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MatrixView (react)      | FOLDED: AnalyticsDashboard "Adjacency matrix" tab (full-width row); acceptance suite unchanged (matrix-acceptance.test.tsx)                                      |
| SankeyView (react)      | FOLDED: AnalyticsDashboard "Type flows (sankey)" tab. Coverage gap found at retirement: the view had NO suite; SankeyView.test.tsx written (SVG-renderer smoke)  |
| SchemaView (react)      | COVERED already: Storybook story (Views.stories.tsx); the CONCEPT (class hierarchy) is demonstrated live in the Ontology Workbench hierarchy view with inference |
| RDF/turtle side panel   | REMOVED: explanatory text with no public API; the workbench's Turtle import and SPARQL views carry the paradigm narrative against a live store                   |
| Graph view (canvas tab) | REMOVED: dashboard-internal composition; every other surface demonstrates the canvas                                                                             |

## Renderer note

SankeyView switched to the ECharts SVG renderer at fold time:
equivalent output at type-graph scale, crisper labels, and it runs in
jsdom, which is what made the smoke suite possible. Browser
verification item: confirm sankey rendering on the Analytics tab.

## Removals executed in this round

- `examples/decision-dashboards/src/SchemaDashboard.tsx` deleted; its
  package exports removed from `examples/decision-dashboards/src/index.ts`.
- `SchemaSurface` removed from `src/demo/surfaces/DashboardSurfaces.tsx`
  and the `schema-dashboard` route from `src/demo/Demo.tsx`.
- The `schema-dashboard` capability card removed from
  `src/demo/DemoLanding.tsx`; the landing test updated.
