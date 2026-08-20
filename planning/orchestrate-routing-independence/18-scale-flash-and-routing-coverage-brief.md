---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 18: scale-demo flash root cause + fix; smart-routing coverage on remaining demos

Owner report (Jake, A105): "the current large cluster demo flashes."
Observed on the DEPLOYED playground (production build, rebuilt
2026-08-15 12:01 UTC), so this is NOT the known dev-only React 19
serialization freeze documented in ScaleSurface.tsx:215-225 — do not
chase that. Root-cause the flash with a measurement, then fix it
within the camera/position stability doctrine (CLAUDE.md). Findings
from owner review get ROOT-CAUSED, not patched.

## Part A — the flash

### Reproduce first (mandatory, no fix without a repro artifact)

1. `pnpm build && pnpm run preview` (or the docs-out playground via
   `pnpm run docs:build` output) — PRODUCTION bundle, not dev.
2. Playwright (repo already has tests/e2e + playwright.config.ts):
   drive the Scale demo and capture a rapid screenshot sequence
   (e.g. 10-15 frames at ~100ms) across each suspect window:
   - initial mount of the clusters view,
   - drill into a cluster and RETURN (preset/POS_CACHE path),
   - the "Bundle edges" toggle on/off (brief 16 code),
   - color-by-dominant spec swap, edge-labels toggle.
   Diff consecutive frames (pixelmatch is already in the Playwright
   dep tree, or byte-diff PNGs as a first pass) to locate WHICH
   transition flashes and WHAT flashes (whole canvas blank? edges
   only? labels?). Save the offending frame pair(s) to
   planning/orchestrate-routing-independence/brief18-artifacts/ and
   reference them in the outcome.

### Known suspects (verified in source 2026-08-15, in likelihood order)

- **routeEdges post-layout pass**: ScaleSurface.tsx:649 sets
  `routeEdges={view.kind === "clusters"}`; the canvas routes AFTER
  layout settles (CytoscapeCanvas.tsx:1647-1690, rerun effect at
  1855-1887 keyed on config + ugm identity). Edges paint straight,
  then snap to routed polylines — a visible one-frame flash on every
  clusters mount/return. If confirmed: route synchronously before
  first paint where positions are already known (preset/POS_CACHE
  path), or suppress edge paint until routes apply, or route from
  cached positions in the same frame as the preset layout.
- **fcose animate:"end" first visit**: ScaleSurface.tsx:307-318 —
  nodes may paint at seed positions for a frame before snapping to
  final positions ("end" animates once to final). Check whether the
  first-visit flash is this initial-frame paint.
- **Bundling effect**: the brief 16 effect (ScaleSurface.tsx:361-400)
  clears/reapplies segment styles when deps change; verify toggling
  it doesn't strobe.
- **Unstyled first paint**: elements rendering with default style for
  a frame before the merged stylesheet applies.

### Fix constraints

- Same-input-graph ⇒ camera and positions HOLD (doctrine). No
  re-init, no refit as part of the fix.
- Fix in the canvas layer only if the cause is generic (then it
  benefits every routeEdges consumer); demo-layer only if the cause
  is demo wiring. State which and why in the outcome + decision atom.
- Add a regression probe where feasible: an e2e that asserts no
  full-canvas blank frame during the offending transition (screenshot
  sampling; tolerate antialiasing noise).

## Part B — smart-routing coverage (A105 q1 follow-through)

Coverage audit 2026-08-15: routeEdges is ON in audit, supply, bio,
stylelab (both canvases), routing lab (toggle), scale (clusters view
only); MBSE routes via layoutStructural's own routeEdges default. NOT
routed: the Ontology Workbench's four canvases
(src/demo/ontology/OntologyShell.tsx:725,792,872,1026) and the RDF 1.2
shell canvas (src/demo/rdf12/Rdf12Shell.tsx:480).

- Enable `routeEdges` on those five canvases WHERE THE GRAPH FITS THE
  CAP (default maxEdges 600; check each canvas's realistic edge count
  first — the class-hierarchy and holon views are small; if any view
  can exceed the cap, pass an explicit `{ maxEdges }` or leave it off
  with a one-line comment saying why).
- Scale drill view stays OFF (exceeds cap by design; already
  documented inline at ScaleSurface.tsx:646-648).
- No new toggles; this is default-on wiring, matching the other
  shells' `const ROUTE_EDGES = true` pattern.

## Constraints

- `pnpm run gates` green before commit (spec gates via python3; the
  bare `python` binary does not exist on this host).
- e2e additions must not destabilize CI (keep new probes tagged/short;
  follow existing tests/e2e patterns).
- Commit Part A and Part B as separate commits.

## Acceptance

- Flash root cause NAMED with a frame-pair artifact; fix shipped; the
  offending transition no longer flashes in a re-run of the same
  capture; camera/positions verified held.
- Ontology + RDF 1.2 canvases route (or carry an explicit maxEdges
  rationale comment); gates green; committed.

## Worker contract

Emit inline `kb log` atoms during the run; write
/tmp/brief18-scale-flash-outcome.json (outcome, atoms_emitted,
commit_shas, files_changed, summary, duration_min, blockers); first
stdout line `done: <n> atoms emitted; commit=<sha>; <outcome>`.
Commit on green gates.
