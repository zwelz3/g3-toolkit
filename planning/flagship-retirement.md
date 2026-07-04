# Flagship retirement (2026-07-03)

Maintainer ruling: the four dev-server shells replaced the flagship
demo; remove it unless it exposes functionality not folded elsewhere.
This is the fold/remove matrix that conditioned the removal, audited
against Storybook, the wiring guide and its CI-executed examples, the
shells, and the capability dashboards. `examples/flagship` (53 files)
is deleted in the same round; the flagship planning documents are
archived under `planning/archive/`.

## Package surface flagship alone demonstrated, and where it went

| Capability (public API)                                                                                                                           | Disposition                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CoverageMeter (react)                                                                                                                             | FOLDED: decision-dashboards AnalyticsDashboard "Origin coverage by tier" (real partial-coverage data: optional `country`), render-tested                    |
| ProvenanceTrace / ProvenanceChain (react)                                                                                                         | FOLDED: AuditShell "Lineage of selection" panel; pure chain builder (src/demo/audit/chain.ts) with absence hops mirroring the SHACL report; contract-tested |
| createCameraController / CameraController                                                                                                         | FOLDED: wiring guide "Camera control" + CI test                                                                                                             |
| applyEncodingSpec                                                                                                                                 | FOLDED: wiring guide "Applying an encoding spec" + CI test                                                                                                  |
| createTheme                                                                                                                                       | FOLDED: wiring guide "Themes, programmatically" + CI test                                                                                                   |
| findShortestPath (core)                                                                                                                           | FOLDED: wiring guide "Path analysis" + CI test                                                                                                              |
| exportSubgraphJson / exportSubgraphCsv (core)                                                                                                     | FOLDED: wiring guide "Subgraph export" + CI test                                                                                                            |
| FilterBuilder, GraphToolbar, LayoutSwitcher, SearchBar, NodeStyleEditor                                                                           | COVERED already: Storybook stories (deployed with the docs site); no fold needed                                                                            |
| parseEncodingSpec / serializeEncodingSpec                                                                                                         | COVERED already: wiring guide                                                                                                                               |
| Type-only imports (PathResult, CoverageState, CameraOptions, ProvenanceHop, G3tTheme, ScatterData, PointSetSelection, DataPipeline, LayoutEngine) | No demonstration obligation; types travel with their runtime APIs above                                                                                     |

## Flagship-local functionality, dropped per ruling D1

| Capability (flagship-local code)                                                           | Disposition                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beat-runner narrative (narrative.ts, Transport, NarrationBar, camera directives)           | DROPPED. The only scripted-walkthrough pattern in the repo; deliberately not extracted (unowned complexity is how flagship happened). Recoverable from git history / planning/archive if a guided-tour mode is ever demanded. |
| Capture-brief export (brief-export.ts, BriefPanel)                                         | DROPPED with the narrative it summarized.                                                                                                                                                                                     |
| CoverageChart (flagship-local component, NOT a package export)                             | DROPPED. The earlier plan draft misstated it as a shipped component; the audit corrected this. Coverage visualization in the packages is CoverageMeter/CoverageMeterList, both demonstrated post-fold.                        |
| Analytic pipeline fixtures (pipeline.ts, provenance.ts, encoding.ts, stage.ts, teaming.ts) | DROPPED; story-specific glue over public APIs that are all demonstrated elsewhere post-fold.                                                                                                                                  |

## Verification

The disposition test for every runtime export: at least one of
(a) shell or dashboard usage with headless tests, (b) a wiring-guide
snippet mirrored by the CI-executed examples file, or (c) a Storybook
story. Re-runnable check: the import-diff script in the round log
(CHANGELOG 2026-07-03) reports no @g3t named import unique to
examples/flagship after removal, trivially, and every row above cites
its surviving home.
