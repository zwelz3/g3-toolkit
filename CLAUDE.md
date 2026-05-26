# CLAUDE.md

Context for coding agents working on g3-toolkit.

## What This Is

g3t is a composable graph visualization **component library** (not
an application framework) for RDF, LPG, and Holonic graph paradigms.
Teams `pnpm install` components and compose them into their own
application. Read ARCHITECTURE.md for the toolkit/application
boundary; this is the most important design decision.

## Tech Stack

TypeScript, React 19, Vite 8. **pnpm** (content-addressable store, strict
deps, workspace support). Graph: Graphology (data model), Cytoscape.js
(canvas). State: Zustand. Charts: ECharts. Algorithms: graphology-metrics,
simple-statistics. Search: Fuse.js. Expressions: expr-eval. Testing:
Vitest + RTL (unit/component), Playwright (E2E).

**Why pnpm:** Content-addressable store. Strict dependency isolation
catches phantom-dep problems before adopters hit them. Native workspace
support for the @g3t/core, @g3t/react, @g3t/charts split. The root
package.json sets `packageManager: "pnpm@11.3.0"` and has a
`preinstall: "npx only-allow pnpm"` script that rejects `npm install` /
`yarn install` outright.

## Architecture Rules

**D6 (framework-agnostic):** `packages/core/src/` has zero React, zero
Zustand imports. Pure TypeScript usable from any framework. Tests use
`.test.ts`. Source-boundary tests in `packages/core/src/source-boundary.test.ts`
enforce this at build time (no exemptions).

**D13 (React):** `packages/react/src/` and `packages/charts/src/` are
React components. Tests use `.test.tsx`. Boundary test in
`packages/react/src/source-boundary.test.ts` enforces no imports from
demo/ or the workspace root into the published packages.

**Selection sync:** Canvas uses CSS class `.g3t-selected` (NOT
`:selected` pseudo-class) to avoid event loops. Never call
`cy.select()`/`cy.unselect()` in the store subscription.

**Theming:** All visual values use CSS custom properties
(`--g3t-*`). Never hardcode colors or spacing.

**Toolkit boundary:** If an adopter would use it as-is (pass a
UGM, get output), it goes in a `@g3t/*` package. If they'd need
to configure, replace, or orchestrate it, it goes in `src/demo/`
or `examples/`.

## Directory Layout (post-Phase-2 workspace split)

```
packages/
  core/                @g3t/core - framework-agnostic UGM, adapters,
    src/               pipeline, filter, middleware, event-bus,
                       style-override, shacl, algorithms, layouts,
                       projection, diff, holonic-adapter, undo-redo
  react/               @g3t/react - views + controls + state
    src/
      views/           12 views (canvas, table, map, tree, etc.)
      interaction/     controls (encoding, filter, toolbar, menu,
                       search, layout-manager, context-menu)
      state/           Zustand stores (selection, theme, overrides)
      theme/           ThemeManager
      a11y/            accessibility helpers
  charts/              @g3t/charts - LinkedChart + ECharts
    src/

src/demo/              Demo app + scenario shells (NOT published)
  DemoApp.tsx          Landing page + LayoutManager wiring
  shells/              Per-scenario layouts
                       (DataScientist, Analytics, CyberSupply,
                        AuditorMBSE, Healthcare)
  fixtures/            Test data per scenario

examples/              Standalone consumer-style examples
  full-workspace/      WorkspaceShell (extracted from a demo)

scripts/               Verify scripts (smoke, treeshake, bundle-size,
                       workspace-stats)
```

## Subpath Exports

Each package has subpaths for tree-shakable imports:

- **@g3t/core** (12): `adapters`, `middleware`, `events`, `projection`,
  `pipeline`, `shacl`, `diff`, `layout`, `algorithms`, `undo-redo`,
  `theme`, `path-analysis`
- **@g3t/react** (5): `views`, `controls`, `state`, `theme`, `a11y`
- **@g3t/charts** (0): top-level only

A smoke test (`scripts/smoke-test.mjs`) verifies every subpath resolves
cleanly via Node's resolver, and a treeshake test
(`scripts/verify-treeshake.mjs`) confirms imports get stripped when unused.

## Commands

```bash
pnpm install            # Cold install (rejects npm/yarn via preinstall)
pnpm dev                # Demo at localhost:5173
pnpm storybook          # Components at localhost:6006
pnpm test               # 600 Vitest tests (jsdom only)
pnpm run test:storybook # Storybook+browser tests; requires
                        # `pnpm exec playwright install chromium`
pnpm typecheck          # TypeScript strict
pnpm lint               # ESLint + Prettier
pnpm run build:packages # tsc -b across the workspace + per-package Vite
                        # builds (core → react → charts in topo order)
pnpm run verify         # build:packages + smoke + treeshake + bundle-size
                        # This is what CI runs.
```

The legacy `pnpm build:lib` (monolithic ESM/CJS bundle) was removed in
Phase 2. Do not reintroduce it — per-package builds are the only
supported topology.

The storybook tests are split from `pnpm test` (commit bugfix 22) so
contributors without Playwright Chromium installed can still run the
unit suite. Run them together via `pnpm test && pnpm test:storybook`
when you have Playwright installed.

## Current State

**25 commits past the v1.0.0-rc baseline.** 600 tests passing in 52
files. Bundle sizes (within budget):
- @g3t/core: 95.2 KB / 120 KB
- @g3t/react: 172.1 KB / 200 KB
- @g3t/charts: 5.8 KB / 10 KB

Components: UGM, 5 adapters, RDF projection, 12 views, CytoscapeCanvas
(with auto straight/bezier per edge - bugfix 21, scroll-wheel zoom,
zoom slider, context-menu suppression, ref-stashed callbacks),
LayoutManager (7 layouts with cytoscape-name translation in DemoApp),
ComboManager, PropertyEditor, AnnotationPanel, TemporalSlider,
incremental layout engine, SearchBar (Fuse.js + clear button +
infinite-loop fix), FacetFilter (setState-in-render fix), EncodingPanel
(with `node[<prop>]` selector + null-on-no-numeric to silence cytoscape
warnings), LinkedChart, FilterBuilder, NodeStyleEditor, ShaclValidator,
DataPipeline, event bus, `wireCytoscapeContextActions` helper
(translates context-menu events to cy operations), middleware, theming
(3 presets + CSS custom properties).

5 demo shells (DataScientist, Analytics, CyberSupply, AuditorMBSE,
Healthcare) all with: visual encoding wired to canvas, context menu
events wired to cy via wireCytoscapeContextActions, search wired to
selection, neighborhood views render with `breadthfirst` (different
layout from primary fcose to demo layout flexibility).

## Immediate Next Work

**Not bugfixes**: the four rounds of bugfix work (commits 979f990 →
fc24744) are believed-complete pending a real browser smoke test.
Anything found in a live `pnpm dev` session is fair game for a
round 5.

**Demo-content overhaul** (deferred from the engagement): per-persona
styling so the five demos look distinct rather than "the same
application with different fixtures". Each shell would pick:
- Different node-shape mix (e.g. Healthcare = rounded rectangles for
  facilities + circles for people; MBSE = hexagons for components)
- Different palette (not just the type-palette default)
- Different default layout (Healthcare = `breadthfirst`, Analytics =
  `fcose`, etc.)
- A demo-specific story arc on the landing page

**Holonic-paradigm demo**: HolonicAdapter exists in @g3t/core but no
demo shell exercises it. Add a "Holonic Architecture" shell with a
hierarchical fixture and the adapter wired up.

**Pre-publish work**: see `planning/pre-publish-checklist.md`. Key
gates: clean install → verify → per-package isolation → pnpm pack
inspect → publish in topology order (core → react → charts) via
`pnpm --filter @g3t/<pkg> publish`.

## Known Pitfalls

1. **Cytoscape in jsdom:** Canvas 2D is mocked. Component tests
   verify props/events, not rendering. Use Playwright for visual.

2. **ECharts in jsdom:** Charts render empty (warns about width/height).
   RTL tests verify container only. Chart interaction needs Playwright.

3. **Selection loops:** Canvas subscription uses `addClass` /
   `removeClass`, never `cy.select()`. See "ONE-WAY data flow"
   comment in CytoscapeCanvas.tsx.

4. **Callbacks in useEffect deps cause infinite loops:** Several
   components (CytoscapeCanvas, SearchBar) ref-stash their callback
   props because callers commonly pass inline lambdas. If you add a
   new component that takes a callback prop AND uses it inside a
   useEffect, follow that pattern. Write a regression test that
   re-renders the parent with a fresh-identity callback.

5. **Cytoscape mapping warnings:** When applying a `mapData()` style
   over a property that some nodes don't have, cytoscape spams "Do
   not assign mappings to elements without corresponding data" every
   frame. Always scope the selector with `[<property>]`, e.g.
   `node[pagerank]` rather than `node`. encodingToCytoscapeStyle does
   this already.

6. **Cytoscape doesn't ship dagre/elk:** LayoutManager exposes
   `dagre`, `elk`, `hierarchy` as logical names; DemoApp.tsx
   translates them to `breadthfirst` because we don't load the
   cytoscape-dagre / cytoscape-elk extensions. (The dagre/elk
   engines in @g3t/core are pre-render layouts, not cytoscape
   layouts.) If you need real hierarchical layout, register the
   extension or run the @g3t/core elk-layout module and feed the
   positions in via `layout: 'preset'`.

7. **Bezier curves are expensive aesthetically:** As of bugfix 21,
   ugmToCytoscapeElements marks each edge with `_curveStyle:
   "straight" | "bezier"`. Curves only happen for self-loops,
   parallel multi-edges, and bidirectional pairs. Don't undo this
   by setting `edgeStyle="bezier"` everywhere - that prop is a
   force-override.

8. **expr-eval (not mathjs):** DerivedPropertyEngine uses expr-eval
   for safe expressions. mathjs was removed in M14 (17 MB savings).
   Don't re-add it.

9. **Graphology edge IDs:** Auto-generated (geid_*). `_asserted`
   stored as 0/1 numeric for Cytoscape selector compatibility.

10. **GitHub Actions pnpm version:** `pnpm/action-setup@v4` MUST NOT
    have a `version:` argument; it conflicts with the `packageManager`
    field in package.json. The fix is committed in ci.yml and
    publish.yml; don't reintroduce the `version:` key.

11. **Node 22 required:** pnpm 11.3.0 (pinned via `packageManager`)
    requires Node ≥22.13 because it imports `node:sqlite` (a Node 22+
    built-in). Both CI workflows use `node-version: 22`, and root
    package.json has `engines.node: ">=22.13"` so a wrong-version
    local install fails fast rather than crashing with
    `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` mid-resolve. If you
    need to support older Node (you probably shouldn't), downgrade
    pnpm — don't loosen the engines field.

## Engagement History

The codebase went through several distinct phases of work after the
v1.0.0-rc baseline. PLAN-PROGRESS.md has the full ledger. Highlights:

- **Phase 1-8 (commits c1f7345 → a3ba534):** physical workspace split,
  subpath exports, boundary tests, verify scripts, pre-publish
  checklist.
- **Self-audit (89d2b01):** found 4 doc/build issues missed during
  the refactor; added build idempotency.
- **Bugfix rounds 1-4 (979f990 → 6b7451b):** external patch
  application, CI fixes, then three rounds of UX wiring fixes for
  issues found during manual browser testing.
- **Bugfix 21 (fc24744):** per-edge straight-vs-bezier auto-selection.

## Reading Order

1. This file
2. ARCHITECTURE.md (boundary rules + current dep classification)
3. PLAN-PROGRESS.md (engagement history, what's been done/deferred)
4. planning/pre-publish-checklist.md (operational gates)
5. The module you're modifying + its test file
6. specs/ (if you need requirement context)
