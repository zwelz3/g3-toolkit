---
part_of: https://forge.tail515200.ts.net/ontology/kb/codex/Plan/brief-26-demo-coherence-sweep-every-shell-on-the-full-modern-27a99bf8
---

# Brief 26 — Demo coherence sweep: every shell on the full modern canvas surface

## Why

The modern CytoscapeCanvas surface (briefs 02/23/24) is unevenly adopted and the
adopting shells copy-pasted the same wiring. Audited state 2026-08-19:

| Surface | routeEdges | refresh/relayout buttons | edgeClickIsolate | labelWrapRule |
|---|---|---|---|---|
| Scale (`src/demo/scale/ScaleSurface.tsx`) | config obj | yes (inline JSX :584-613) | yes | — |
| RDF 1.2 (`src/demo/rdf12/Rdf12Shell.tsx`) | config obj | yes (duplicated) | yes | — |
| Legibility (`src/demo/legibility/LegibilityShell.tsx`) | config obj | yes (duplicated) | yes | — |
| Routing Explain (`src/demo/routing-explain/RoutingExplainShell.tsx`) | config obj | partial | no | — |
| Style Lab (`src/demo/stylelab/StyleLabShell.tsx` :224,:326,:345) | config obj | NO | NO | — |
| Supply (`src/demo/supply/ThreadShell.tsx` :276,:551) | config obj | NO | NO | — |
| Ontology (`src/demo/ontology/OntologyShell.tsx` :303 + 4 canvases) | config obj | NO | NO | — |
| Bio (`src/demo/bio/BioShell.tsx` :135,:264) | config obj | NO | NO | yes |
| Audit (`src/demo/audit/AuditShell.tsx` :44,:383) | bare `true` | NO | NO | — |
| MBSE (`src/demo/mbse/MbseShell.tsx`) | structural (own routing) | n/a | n/a | — |
| AnalyticsDashboard (`examples/decision-dashboards/src/AnalyticsDashboard.tsx`) | NONE | NO | NO | — |

Three defects: (1) four shells hand-rolled identical signal-state + button JSX;
(2) five canvases expose none of the refresh/relayout/isolate affordances;
(3) the flagship example dashboard demonstrates zero routing capability.

## Scope — HARD EXCLUSIONS (a concurrent worker owns these files)

Do NOT edit, format, or commit:
- `packages/core/src/layout/g3t-engine/**`
- `packages/core/src/layout/structural.ts`
- `src/demo/routing/RoutingShell.tsx` (and its test)

Do NOT bump any package version, do NOT run `docs:build`/deploy, do NOT push.
Commit ONLY the files you author/edit (`git add <explicit paths>`); the working
tree contains another worker's uncommitted edits which must not be swept in.
No changes to `packages/*` source at all — this brief is demo/examples-only.

## Step 1 — Shared wiring: `src/demo/components/routing-controls.tsx`

Extract the duplicated pattern into one module exporting:

- `useRoutingControls(defaults?)` — returns `{ routeMode, setRouteMode,
  routeEdgesConfig, routeRefreshSignal, refreshRoutes, relayoutSignal,
  relayout }`. `routeEdgesConfig` reproduces the existing per-shell shape
  (`false` when mode off, `{ mode: "direct" | "orthogonal" }` otherwise —
  read ScaleSurface/Rdf12Shell first and preserve their exact config values,
  including any maxEdges overrides).
- `RoutingControlStrip` — the Routes mode select + "Refresh routes" +
  "Re-layout" buttons, visually matching the existing inline JSX
  (ScaleSurface.tsx:584-613 is the canonical look; keep existing
  data-testids working — the strip must render the same testids the shell
  tests already query, parameterized by an `idPrefix` prop where shells
  differ).

Style it with the same inline-style conventions the shells already use (no new
CSS files, no new deps).

## Step 2 — Refactor the four current adopters onto the shared module

Scale, RDF 1.2, Legibility, Routing Explain: delete their local signal
useState + button JSX, use the hook + strip. Their existing tests must pass
UNMODIFIED except where a testid moves into the strip — prefer keeping testids
byte-identical so tests need no edits. Behavior must be unchanged.

## Step 3 — Upgrade the five partial canvases

Style Lab, Supply, Ontology (all four canvases share the shell's single
control row — one strip, signals fanned to each canvas), Bio, Audit:

- Replace bare/`ROUTE_EDGES`-gated configs with the hook (keep each shell's
  existing default mode and any per-shell `maxEdges`; keep the `ROUTE_EDGES`
  kill-switch constants as the outer gate exactly as today).
- Add `RoutingControlStrip` to each shell's existing toolbar/header row.
- Add `edgeClickIsolate` + `routeRefreshSignal` + `relayoutSignal` props to
  each CytoscapeCanvas that already takes `routeEdges`.
- Audit: upgrade `routeEdges={ROUTE_EDGES}` (bare boolean) to
  `routeEdges={ROUTE_EDGES ? routeEdgesConfig : false}` with mode "direct"
  as today's behavioral equivalent.
- Bio: keep `labelWrapRule` wiring untouched.
- Do NOT touch MBSE (structural scene routes in-engine; relayout/refresh
  signals are no-ops there by design — leave it out).

## Step 4 — AnalyticsDashboard example

`examples/decision-dashboards/src/AnalyticsDashboard.tsx`: enable
`routeEdges={{ mode: "direct" }}` and `edgeClickIsolate` on its
CytoscapeCanvas (small graphs, default maxEdges fine). Update its tests to
assert the props reach the canvas (mock-capture pattern:
`src/demo/scale/ScaleSurface.test.tsx:39-64`). No public API changes, so no
wiring-guide edit is required; do not edit `docs/wiring-guide.md`.

## Step 5 — Tests

- New unit test for `useRoutingControls` + `RoutingControlStrip` (signal
  increments on click, config shape per mode).
- For each upgraded shell, extend its existing `.test.tsx` with the
  signal-wiring assertion block (copy the ScaleSurface.test.tsx pattern).

## Verification (gate discipline)

1. `pnpm run typecheck && pnpm run lint && pnpm run test` — green. Run
   prettier on every touched file before committing (prior workers shipped
   prettier-dirty commits that false-greened `pnpm run lint`): 
   `pnpm exec prettier --write <touched files>` then `pnpm exec prettier --check <touched files>`.
2. Spec gates with python3 explicitly (host has no `python`):
   `python3 scripts/lint_specs.py specs/ && python3 scripts/sync_spec_status.py && python3 scripts/check_roadmap_coverage.py`.
3. Never pipe gate output through head/tail; check `$?` directly.
4. If `pnpm run gates`/`verify` fails on the pnpm store ("unable to open
   database file") that is the known sandbox limitation — record it, rely on
   typecheck+lint+test, and say so in the outcome summary.

Commit message: `feat(demo): shared routing controls + full modern-canvas surface on all shells (brief 26)`.

## Worker contract

Emit `kb log decision` for the shared-module design landing and `kb log
gotcha`/`kb log failure` for anything that bites. Write
`/tmp/$WEAVER_JOB_ID-outcome.json` with `outcome`, `atoms_emitted`,
`commit_shas`, `files_changed`, one-line `summary`. First stdout line:
`done: <n> atoms emitted; commit=<sha>; <outcome phrase>`.
