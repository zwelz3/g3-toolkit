# Flagship resume point

**You (the agent) are resuming the capture-intelligence flagship after an
external visual-validation turn. This file is your entry point. Do not
re-read the full review procedure.**

## State at handoff (2026-06-17)

The composition-first build (Option 1) is COMPLETE and PACKAGED. The toolkit
is load-bearing across the narrative: the stage is the toolkit's encoding on
the real meaning graph, each beat routes through an existing toolkit surface,
and the epilogue hands over the real exploration stack. All of it is
verified to the extent a headless environment allows (engine + react + graph
-ops tests green; every module typechecked strict; no package source changed
beyond the three components shipped earlier: CoverageMeter, ProvenanceTrace,
the camera controller).

What was left for the external turn: the things that only a browser can
confirm (the live canvas, camera, LinkedChart, overlays, theme-on-canvas,
the epilogue) plus two in-repo confirmations (the example install/typecheck
and the bundle budget). The procedure for those lives in
`examples/flagship/REVIEW-RUNBOOK.md`; you do NOT need to read it to resume.

## Step 1: read the results, not the runbook

Open `examples/flagship/REVIEW-RESULTS.md` (filled during the external turn).
It is the only review artifact you need. Then act per the decision tree.

## Decision tree

- **All items PASS** -> the flagship is visually validated. Proceed to the
  one remaining build item, step 7 (motion / easing / legibility polish;
  inherently live, iterate against the browser), then close rc.2 for the
  flagship. Owning files: the shell components and the canvas animation
  props (see routing table, row "motion").
- **Any item FAILS** -> route each failure straight to its owning module via
  the table below. Root-cause it (do not patch around it). Re-run only the
  failed item from the runbook, not the whole procedure.
- **Results file is empty / partial** -> the external turn did not finish.
  Ask before assuming; do not mark items done.

## Failure -> owning-module routing table

| Review item (REVIEW-RESULTS.md) | Root-cause here first | Toolkit surface involved |
| --- | --- | --- |
| Stage renders / raw->meaning is restyle-only / no relayout | `shell/StageCanvas.tsx`, `stage.ts` (specForBeat, isSpecSwap, stagePropsForBeat), `encoding.ts` | CytoscapeCanvas, applyEncodingSpec |
| Camera focus/pan/frame per beat | `camera-directives.ts`, `shell/StageCanvas.tsx`, `narrative.ts` (CameraDirective per beat) | createCameraController |
| LinkedChart scatter renders / point-click selects on canvas | `shell/CoverageChart.tsx`, `coverage-pipeline.ts` (query + reverseMap) | LinkedChart, DataPipeline |
| Inspector shows clicked-node attributes | `shell/InspectorPanel.tsx`, `stage.ts` (inspectorSelectionForBeat) | DetailInspector |
| Teaming + path overlays render on canvas | `teaming.ts`, `provenance-path.ts`, the overlay draw in the shell | buildNeighborhoodUGM, findShortestPath |
| Theme applied to live canvas | `theme.ts`, theme application at the decision beat | createTheme |
| Export / snapshot download UX | `brief-export.ts`, `workspace-snapshot.ts`, the brief panel download wiring | exportSubgraph*, captureWorkspace |
| Epilogue renders / controls drive the canvas | `shell/EpilogueShell.tsx`, `epilogue.ts` | GraphToolbar, SearchBar, FilterBuilder, LayoutSwitcher, AlgorithmPanel, NodeStyleEditor |
| motion / easing / legibility (step 7) | `shell/FlagshipShell.tsx`, `shell/NarrationBar.tsx`, `shell/Transport.tsx`, StageCanvas animate/animationDuration, tokens | n/a (presentation) |
| Example install / typecheck fails | `examples/flagship/{package.json,tsconfig.json}`; see `INTEGRATION.md` 3 | n/a |
| `verify:bundle` trips on @g3t/react | `scripts/check-bundle-size.mjs` (raise + ledger note); see `INTEGRATION.md` 4 | n/a |

## Pointers (only if a failure needs them)

- Wiring map + sandbox-file cleanup + packaging + bundle template:
  `examples/flagship/INTEGRATION.md`.
- The detailed per-item procedure: `examples/flagship/REVIEW-RUNBOOK.md`.
- Round-by-round history (authoritative): `planning/visual-acceptance-1.md`.
- The live-review ledger (section E): `planning/flagship-acceptance-ledger.md`.

## Working agreement (carry forward)

Analytical, no sycophancy. No em-dashes in authored content. No day-based
estimates (priority order). Complete, verified outputs (run the gates before
claiming done). Root-cause, not patches. No non-null assertions in source.
