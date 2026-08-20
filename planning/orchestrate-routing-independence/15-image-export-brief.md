---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 15: image export (PNG snapshot) from the toolbar + programmatic API

Owner ask (Jake, A96): "what is missing from yfiles and other graph
display technologies — just add it." Gap analysis 2026-08-15: image
export is table stakes in yFiles/Cytoscape-desktop/Gephi; g3t has
none. The toolbar's own Export button tooltip ALREADY promises it:
`GraphToolbar.tsx:414` — "Export the selection (or the whole graph)
as data or image" — but the menu (`:426`) only offers json/turtle/csv.

## What exists (verified 2026-08-15 against the live tree)

- `buildExport(format, ugm, selectedNodeIds)` in
  `packages/react/src/interaction/toolbar/GraphToolbar.tsx:52` is the
  pure export assembly for the three DATA formats; `triggerDownload`
  (`:81`) navigates an `href` (data/blob URL both work).
- GraphToolbar already holds the live Cytoscape `Core` via its public
  `cy` prop (`:171`), guarded for destruction (`:195-197`).
- Cytoscape ships `cy.png({ full, scale, bg, output })` natively —
  NO new dependency. SVG export needs the cytoscape-svg extension
  (new dep + bundle ledger) — explicitly OUT of this brief; note it
  in the wiring guide as a future channel.

## Work

1. **Pure helper** — `buildImageExport(cy, opts)` next to
   `buildExport` (exported for tests): calls `cy.png({ output:
   "blob", full: opts.full ?? true, scale: opts.scale ?? 2, bg:
   opts.bg })` and returns `{ filename: "g3t-graph.png", mime:
   "image/png", blob }`. Selection-scoped image export is NOT
   meaningful for a raster snapshot; the image is always the full
   graph or current viewport (`full: false`) — expose both via opts.
2. **Toolbar menu** — add a "png" entry to the export menu list
   (`:426`), `data-testid="export-png"`, wired through
   `triggerDownload` via `URL.createObjectURL` (revoke after click).
   Menu copy: "Image (PNG)".
3. **Wiring** — wiring-guide subsection under the existing export
   section: programmatic `buildImageExport(cy, { scale: 2 })` snippet
   + executable twin in examples/wiring/ (jsdom has no real canvas:
   the twin asserts the helper delegates to `cy.png` with the right
   options via a stubbed Core, same pattern other canvas-adjacent
   twins use).
4. **Tests** — unit: `buildImageExport` passes full/scale/bg through
   to a stub `cy.png` and names/types the artifact; toolbar: the
   export menu renders `export-png` and clicking it calls the helper
   (stub cy, jsdom-safe). Do NOT snapshot actual pixels.

## Constraints

- Additive only: no change to the existing three data formats or the
  `buildExport` signature.
- jsdom cannot rasterize: never call real `cy.png()` in tests without
  a stub (the "Not implemented: getContext" warnings in the suite are
  the reminder).
- Bundle: zero new deps; budget must not move.

## Acceptance

- Export menu shows Image (PNG); clicking downloads a PNG in a real
  browser (Zach visual pass), tests green via stubs.
- `buildImageExport` exported from @g3t/react; wiring twin runs in CI.
- `pnpm run gates` green (spec gates via python3 on this host).

## Worker contract

Emit inline `kb log` atoms (decision/gotcha/discovery) during the
run; write /tmp/brief15-image-export-outcome.json (outcome,
atoms_emitted, commit_shas, files_changed, summary, duration_min,
blockers); first stdout line `done: <n> atoms emitted; commit=<sha>;
<outcome>`. Commit on green gates.
