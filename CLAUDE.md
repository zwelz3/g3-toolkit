# CLAUDE.md

Context for coding agents working on g3-toolkit.

## What This Is

g3t is a composable graph visualization **component library** (not
an application framework) for RDF, LPG, and Holonic graph paradigms.
Teams `pnpm install` components and compose them into their own
application. Read ARCHITECTURE.md for the toolkit/application
boundary; this is the most important design decision.

## Tech Stack

TypeScript, React 19, Vite 8. **pnpm** (not npm; content-addressable
store, strict deps, workspace support). Graph: Graphology (data
model), Cytoscape.js (canvas). State: Zustand. Charts: ECharts.
Algorithms: graphology-metrics, simple-statistics. Search: Fuse.js.
Expressions: expr-eval. Testing: Vitest + RTL (unit/component),
Playwright (E2E).

**Why pnpm:** Content-addressable store means packages are downloaded
once globally and hard-linked into projects. Installs are 2-3x
faster. Strict dependency isolation catches phantom dependency
problems before adopters hit them. Native workspace support for
the @g3t/core, @g3t/react, @g3t/charts split.

## Architecture Rules

**D6 (framework-agnostic):** `src/core/` has zero React, zero
Zustand imports. Pure TypeScript usable from any framework.
Tests use `.test.ts`.

**D13 (React):** `src/views/`, `src/interaction/`, `src/charts/`
are React components. Tests use `.test.tsx`.

**Selection sync:** Canvas uses CSS class `.g3t-selected` (NOT
`:selected` pseudo-class) to avoid event loops. Never call
`cy.select()`/`cy.unselect()` in the store subscription.

**Theming:** All visual values use CSS custom properties
(`--g3t-*`). Never hardcode colors or spacing.

**Toolkit boundary:** If an adopter would use it as-is (pass a
UGM, get output), it goes in the toolkit package. If they'd need
to configure, replace, or orchestrate it, it goes in `examples/`
or `demo/`.

## Directory Layout

```
src/core/          D6: UGM, adapters, pipeline, filter, middleware,
                       event-bus, style-override, shacl, advanced
src/views/         D13: 12 views (canvas, table, map, tree, etc.)
src/interaction/   D13: controls (encoding, filter, toolbar, menu)
src/charts/        D13: LinkedChart + ECharts renderers
src/state/         D13: Zustand stores (selection, theme, overrides)
src/theme/         Mixed: tokens (D6) + ThemeManager store (D13)
src/demo/          Demo app + scenario shells (NOT published)
  shells/          Per-scenario layouts (Healthcare, MBSE, etc.)
  fixtures/        Test data per scenario
```

## Packages (ready for split)

```
@g3t/core    src/core-entry.ts   (D6, 0 React deps)
@g3t/react   src/react-entry.ts  (views + controls + state)
@g3t/charts  src/charts-entry.ts (LinkedChart + ECharts)
```

Each has a per-package `package.json` in `dist/` and a Vite
config in `vite.packages.config.ts`. Publish via GitHub Actions
(`.github/workflows/publish.yml`).

## Commands

```bash
pnpm dev          # Demo at localhost:5173
pnpm storybook    # Components at localhost:6006
pnpm test         # 531 Vitest tests
pnpm typecheck    # TypeScript strict
pnpm lint         # ESLint + Prettier
pnpm build:lib    # Monolithic ESM+CJS+.d.ts → dist/
pnpm build:packages  # Per-package builds → dist/core|react|charts/
```

## Current State (v1.0.0-rc)

556 tests, 40 files. 72/72 spec requirements referenced. Core
toolkit complete (M0-M14 + F1-F8 features). Bundle: 3,345 KB
ESM (806 KB gzipped).

Components: UGM, 5 adapters, RDF projection, 12 views,
CytoscapeCanvas (with animate, edgeStyle, taxi routing),
LayoutManager (7 layouts with per-layout force/hierarchy/dagre
parameter tuning, reset, freeze), ComboManager (user-driven
node grouping with collapse/expand/nest), PropertyEditor
(inline property editing with backend callback), AnnotationPanel
(notes on nodes/edges with pluggable storage), TemporalSlider
(play/pause/speed temporal controls), incremental layout engine
(lock existing nodes on small changes), SearchBar (Fuse.js),
FacetFilter, EncodingPanel, LinkedChart, FilterBuilder,
NodeStyleEditor, ShaclValidator, ShaclShapeBrowser, DataPipeline,
event bus, middleware, theming (3 presets + CSS custom properties).

9 demo scenarios on landing page. 5 have custom shells
(Healthcare, Data Scientist, Analytics, Auditor, MBSE). All
demos wire LayoutManager, PropertyEditor, and AnnotationPanel.

## Immediate Next Work

Read `planning/demo-overhaul-spec.md` (22 tickets, 7 demos).
Remaining: Phase 4 polish (landing page redesign, per-demo
icons, Storybook stories, acceptance tests).

Post-v1.0: large graph support via CollapseByCluster (v1.1) and
Worker layout + viewport culling (v1.2). Design rationale in
`planning/large-graph-design.md`. WebGL (Sigma.js) was rejected
as detrimental to composability.

Post-v1.0 features (8 planned, 12 known gaps documented as
not-planned): `planning/v1-plus-features.md`. Key additions:
animated layouts, combos, annotations, property editing,
enhanced map view with temporal controls.

## Known Pitfalls

1. **Cytoscape in jsdom:** Canvas 2D is mocked. Component tests
   verify props/events, not rendering. Use Playwright for visual.

2. **ECharts in jsdom:** Charts render empty. RTL tests verify
   container. Chart interaction needs Playwright.

3. **Selection loops:** Canvas subscription uses `addClass` /
   `removeClass`, never `cy.select()`. See "ONE-WAY data flow"
   comment in CytoscapeCanvas.tsx.

4. **Graphology edge IDs:** Auto-generated (geid_*). `_asserted`
   stored as 0/1 numeric for Cytoscape selector compatibility.

5. **FacetFilter callback:** Provides `hiddenTypes: Set<string>`,
   not visible types. The demo creates a filtered UGM by
   excluding hidden types.

6. **expr-eval (not mathjs):** DerivedPropertyEngine uses
   expr-eval for safe expressions. mathjs was removed in M14
   (17MB savings). Don't re-add it.

## Reading Order

1. This file
2. ARCHITECTURE.md (boundary rules)
3. The module you're modifying + its test file
4. planning/demo-overhaul-spec.md (if working on demos)
5. specs/ (if you need requirement context)
