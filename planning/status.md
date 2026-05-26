# Project Status

**Version:** 1.0.0-rc | **Tickets:** 128/130 complete | **Tests:** 600 (across 52 files)

> Numbers in this file are hand-maintained snapshots. Run
> `node scripts/workspace-stats.mjs` for the current derived figures
> (test counts per package, requirement IDs, subpath counts). Future
> work will templatize this file from milestone YAML + the script.

## Milestone Progress

```
M0     Foundation              ██████████████████ 18/18  DONE
M1     Interaction & Selection ████████████████   13/13  DONE
M2     Layout Engines          ██████████████      7/7   DONE
M3     Data Adapters           ████████████████    8/8   DONE
M4     Projection Pipeline     █████████████████   9/9   DONE
M5     Secondary Views         ████████████████    8/8   DONE
M6     Workspace & Schema      ████████████████    8/8   DONE
M7     Charts & Enhancements   ████████████████    8/8   DONE (+3 gap)
M8     Accessibility           ██████████          5/5   DONE
M8.5   UX Surface & Theming   ████████████████   10/10  DONE
M10.5  Integration Core       █████████████       5/7   DONE (code)
M9     Streaming & Write-Back  ░░░░░░░░░░░░        0/6
M10    Security, Export, Docs  ░░░░░░░░░░░░░░░░░░░ 0/13
```

## Critical Path

```
M0-M8.5 ✓ → M10.5 ■ → M9 □ → M10 □ → M11 □ → M12 □ → M13 □
```

## Enhancement Milestones (toolkit layer only)

```
M11   Pipeline Infrastructure  ████████████████████████ 13/13  DONE
M12   Customization & Filters  ████████████████████     10/10   DONE
M13   Advanced Features        ██████████                5/5    DONE
```

## Requirements Coverage by Domain

| Domain | MUST | SHOULD | Total | Milestone(s) | Status |
|---|---|---|---|---|---|
| Functional Views | 10 | 2 | 12 | M0, M4, M5, M6, M7 | Partial (canvas, table, inspector done) |
| Interaction | 10 | 2 | 12 | M0, M1 | Partial (core interactions done; cross-view wiring in M5) |
| Data Layer | 7 | 1 | 8 | M0, M3 | Partial (UGM done; adapters in M3) |
| Projection | 5 | 1 | 6 | M4 | Complete (pipeline, 5 collapses, presets, gate) |
| Holonic | 5 | 3 | 8 | M3, M4 | Partial (adapter, portal menu, pipeline compat done) |
| Connectors | 1 | 3 | 4 | M3 | Not started |
| UX & Accessibility | 10 | 2 | 12 | M0, M1, M8 | Partial (palette, limits done; ARIA in M8) |
| Security | 5 | 0 | 5 | M10 | Not started |
| **Total (as tabled)** | **53** | **14** | **67** | | **31% coverage**[^drift] |

[^drift]: The per-domain breakdown sums to 67; `scripts/workspace-stats.mjs` finds 72 unique R-IDs in `specs/` (R1.13/R1.14 and R2.13/R2.14/R2.15 were added to specs after the table was last edited). The coverage percentage above is calculated against 67; against the actual 72 it would be lower. Fix is queued for the next milestone-YAML pass.

## Feature Readiness

| Feature | Data Model | Rendering | Interaction | Tests | Ready? |
|---|---|---|---|---|---|
| Graph Canvas | ✓ UGM | ✓ Cytoscape | ✓ right-click, select | 25 | ✓ |
| Node Table | ✓ UGM | ✓ TanStack | ✓ sort, paginate, select | 14 | ✓ |
| Detail Inspector | ✓ UGM | ✓ React | ✓ expand/collapse | 8 | ✓ |
| Selection Model | ✓ Zustand | ✓ cross-view | ✓ shift, lasso | 14 | ✓ |
| Context Menu | ✓ Manager | ✓ React | ✓ plugin API | 25 | ✓ |
| Faceted Filter | ✓ Registry | ✓ React | ✓ toggle | 5 | ✓ |
| Full-Text Search | ✓ UGM | ✓ React | ✓ substring | 5 | ✓ |
| Tagging | ✓ UGM props | — | ✓ add/remove | 8 | ✓ |
| Grouping | ✓ UGM compound | — | ✓ create/collapse | 10 | ✓ |
| Working-Set Limits | ✓ Manager | — | — | 10 | ✓ |
| N-Degree Expansion | ✓ BFS | — | — | 9 | ✓ |
| Layout Switching | ✓ 4 engines | ✓ Switcher UI | ✓ pin/unpin | 23 | ✓ |
| SPARQL Adapter | — | — | — | 0 | M3 |
| Cypher Adapter | — | — | — | 0 | M3 |
| RDF Projection | ✓ Pipeline | — | ✓ presets, gate | 21 | ✓ |
| Timeline | — | — | — | 0 | M5 |
| Map | — | — | — | 0 | M5 |
| Schema View | — | — | — | 0 | M6 |
| Workspace | — | — | — | 0 | M6 |
| Accessibility (ARIA) | — | — | — | 0 | M8 |
| Redaction | — | — | — | 0 | M10 |

## Automated Test Distribution

| Module | Unit | Component | E2E | Total |
|---|---|---|---|---|
| UGM (core) | 39 | — | — | 39 |
| Canvas | 13 | 3 | 1 stub | 16 |
| Palette | 8 | — | — | 8 |
| Context Menu | 12 | 7 | — | 19 |
| Inspector | — | 8 | — | 8 |
| Selection Store | 11 | — | — | 11 |
| Table | — | 14 | — | 14 |
| Working-Set Manager | 10 | — | — | 10 |
| Neighbors | 9 | — | — | 9 |
| TagManager | 8 | — | — | 8 |
| GroupingManager | 10 | — | — | 10 |
| Faceted Filter | — | 5 | — | 5 |
| Search | — | 5 | — | 5 |
| Multi-Select | 3 | — | — | 3 |
| Layout Engines | 18 | — | — | 18 |
| Layout Switcher + Pin | — | 10 | — | 10 |
| Adapters (SPARQL, Cypher, Holonic) | 20 | — | — | 20 |
| Algorithm Adapter | 3 | — | — | 3 |
| Relational Virtualizer | 8 | — | — | 8 |
| Module Boundary (D6) | 6 | — | — | 6 |
| Projection Pipeline | 24 | — | — | 24 |
| Secondary Views (M5) | — | 15 | — | 15 |
| Schema + SHACL | — | 11 | — | 11 |
| Diff Engine | 8 | — | — | 8 |
| Workspace | 6 | — | — | 6 |
| **Total** | **197** | **74** | **1** | **290** |

## Design Decision Status

| ID | Decision | Implemented? | Verified? |
|---|---|---|---|
| D1 | Qualified Edge model | ✓ M0.E2.T2 | ✓ 10 tests |
| D2 | RDF projects to LPG | ✓ M4 | ✓ 21 tests |
| D3 | Right-click primary interaction | ✓ M0.E4 | ✓ 19 tests |
| D4 | Algorithms optional | ✓ M3.E3.T1 | ✓ 3 tests |
| D5 | Working-set soft limits | ✓ M1.E4.T1 | ✓ 10 tests |
| D6 | Core modules no React | ✓ convention | — (build test M3) |
| D7 | Streaming layout modes | — (M9) | — |
| D8 | Redaction engine | — (M10) | — |
| D9 | Inferred edges dashed | ✓ M0.E3.T5 | ✓ visual + data |
| D10 | GenAI query transparency | — (deferred) | — |
| D11 | Paradigm-neutral views | ✓ convention | — (build test M3) |
| D12 | Ontology version tracking | — (M6) | — |
| D13 | React rendering layer | ✓ M0.E1.T1 | ✓ all views |
| D14 | Four-layer testing strategy | ✓ post-M4 | ✓ infrastructure |

## M14: Release Engineering (11 tickets)

```
M14.1  Move useStyleOverrideStore to src/state/ (D6 fix)      ■ (already done)
M14.2  Replace mathjs with expr-eval (17MB savings)            ■ DONE
M14.3  Fix dependency classification                           ■ DONE
M14.4  Add R-tag annotations to 23 unreferenced requirements   ■ DONE (72/72)
M14.5  Monorepo workspace setup                                ■ DONE (entry points)
M14.6  Per-package package.json                                ■ DONE
M14.7  Per-package Vite build configs                          ■ DONE
M14.8  npm publish automation (GitHub Actions)                 ■ DONE
M14.9  Update Storybook stories for M10-M13                    ■ (already existed)
M14.10 Bundle analysis (rollup-plugin-visualizer)              ■ DONE
M14.11 Treeshaking verification                                ■ DONE
```
