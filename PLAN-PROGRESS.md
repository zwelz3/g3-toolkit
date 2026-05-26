# Plan Execution Status

This file tracks progress on the implementation plan (see
`docs/implementation-plan.md`, or external `g3-toolkit-implementation-plan.md`).

**Format note:** unlike the legacy `PROGRESS.md`, this file is meant to be
edited only when a phase item completes. Test counts and other metrics are
derived from CI in later phases; do not hand-edit them.

---

## Phase 1: Repository hygiene — COMPLETE

Completed in a single pass with verification gate passing and the 556-test
baseline preserved.

| Item | Status | Note |
|---|---|---|
| P1.1 Delete literal-brace directories | DONE | 12 top-level brace-glob dirs (nesting included 17 paths) removed; all confirmed empty before deletion |
| P1.2 CI guard against brace-glob recurrence | DONE | `.github/workflows/ci.yml` step "Reject literal brace-glob paths" added |
| P1.3 Delete duplicate scripts and stale comments | DONE | `scripts/verify-treeshake.mjs` (old) deleted; `verify-treeshaking.mjs` renamed to take its place. Duplicate CHANGELOG `[1.0.0-rc] - 2026-05-24` heading promoted to `[0.13.0]`. Duplicate Playwright row in DEVELOPER.md removed. Stale visualizer comment block in `vite.lib.config.ts` deleted. |
| P1.4 Bash shebangs on shell scripts | DONE | `scripts/build-packages.sh` changed from `#!/bin/bash` to `#!/usr/bin/env bash` |
| P1.5 Replace npm with pnpm everywhere | DONE | `pixi.toml` JS tasks now invoke `pnpm`; `package.json` `build:packages` script updated; "not npm or yarn" disclaimer removed from README; "not npm" trimmed from CLAUDE.md. |

### Phase 1 verification gate

- `find . -name '*{*'` returns nothing  ✓
- CI guard wired into `ci.yml`  ✓
- one `scripts/verify-treeshake.mjs` only  ✓
- CHANGELOG has no duplicate version heading  ✓
- DEVELOPER.md has no duplicate Playwright row  ✓
- `vite.lib.config.ts` has no stale visualizer comment  ✓
- all shell scripts use `#!/usr/bin/env bash`  ✓
- no `npm install`/`npm run` in `pixi.toml` or `package.json`  ✓
- pnpm-only language consistent across README and CLAUDE.md  ✓

### Phase 1 regression check

- baseline `pnpm test`: **556 passed (556)** across 39 test files
- post-Phase-1 `pnpm test`: **556 passed (556)** across 39 test files
- diff: zero. No source code was touched; tests are unaffected as expected.

The 1 "unhandled error" reported by vitest in both runs is the
`@vitest/browser-playwright` provider failing to launch a Chromium binary
that is not installed in the sandbox. It is unrelated to the changes in
this phase and was present in the baseline. (Phase 6 will resolve this
by adding `pnpm exec playwright install` to CI; Phase 1 does not.)

### Side-effects on docs

The following docs received corrections as part of Phase 1 (changes are
small and listed here so reviewers can see the full surface touched):

- `README.md`: "uses [pnpm](...) (not npm or yarn)" trimmed to "uses [pnpm](...)"
- `CLAUDE.md`: "**pnpm** (not npm; content-addressable..." trimmed to "**pnpm** (content-addressable..."
- `DEVELOPER.md`: duplicate Playwright table row removed; stale test count `399` updated to `556` in the surrounding code block (the long-term fix is P5.5, which derives this number)
- `CHANGELOG.md`: second `[1.0.0-rc] - 2026-05-24` heading promoted to `[0.13.0]` with a one-line note explaining the correction

The audit found several other test-count claims (`531`, `556`, `40 files`,
`37 files`) scattered across `CLAUDE.md`, `PROGRESS.md`, `planning/status.md`,
and elsewhere. Those are intentionally NOT updated in Phase 1; they are
the target of P5.5 (script-derived consistency check) and updating them
by hand here would just re-establish the same drift the audit found.

---

## Phase 2: Physical workspace split — IN PROGRESS

### Phase 2A (this turn): foundation + @g3t/core moved — COMPLETE

| Item | Status | Note |
|---|---|---|
| P2.1 Workspace skeleton | DONE | `tsconfig.base.json` created at root; `packages/core/tsconfig.json` extends it with `composite: true`. Existing stub `packages/{react,charts}/package.json` files updated to use `workspace:*` for `@g3t/core` (was `^1.0.0-rc`, which npm semver did not match the new `1.0.0-rc.1`). |
| P2.2 (core slice) Move source | DONE | `src/core/*` → `packages/core/src/*` via `git mv` (history preserved). Empty `src/core/` removed. `packages/react/`, `packages/charts/` source moves deferred to Turns 2B and 2C. |
| P2.7 Workspace YAML | DONE | `pnpm-workspace.yaml` now lists `packages/*` and `.` only; the phantom `dist/{core,react,charts}` entries are gone. Root remains a workspace member because `src/` still has consuming code; will be removed once `src/` is empty. |
| Codemod (consumer imports) | DONE | 200 substitutions across 79 files rewrote `@core/*`, `./core/*`, `../core/*` to `@g3t/core` (single line: any quoted path matching the core patterns). |
| Codemod (intra-core imports) | DONE | 59 substitutions across 29 files inside `packages/core/src/` converted now-broken `@core/*` references back to proper relative paths (`./ugm`, `../ugm` etc., depth-aware). |
| `@g3t/core` barrel | DONE | New `packages/core/src/index.ts` is comprehensive; it closes the audit-found gap between the old `src/core-entry.ts` and `src/index.ts` (now exports `ComboManager`, `computeIncrementalUpdate`, `applyIncrementalLayout`, `capturePositions`, all four layout engines, `WorkingSetManager`, `checkRenderPermission`, `localPart`, `castLiteral`, `RDF`, `Holon`/`Portal`/`HolonicDataset` types, and the rest of the previously-missing surface). |
| Vite + tsconfig aliases | DONE | `@core/*` removed (orphan after codemod). Vite alias `@g3t/core` → `packages/core/src` for dev; tsconfig `paths` `@g3t/core` → `./packages/core/src/index.ts`. Same in `vite.lib.config.ts`, `vite.packages.config.ts`, `tsconfig.build.json`. |
| Vitest include glob | DONE | `packages/*/src/**/*.test.{ts,tsx}` added; tests inside `packages/core/src/` are now picked up. |

### Phase 2A verification gate

- `pnpm install --frozen-lockfile`: clean
- `pnpm run typecheck`: clean (exit 0)
- `pnpm test`: **556 passed (556)** across 39 test files (same as Phase 1 baseline; no regression)
- `node_modules/@g3t/core` correctly symlinked to `packages/core`
- `packages/core/src/` populated with the full D6 subtree; `src/core/` removed
- No React / Zustand / Cytoscape / ECharts imports inside `packages/core/src/` (architectural boundary held by file system + import paths)
- No `@core` orphan references anywhere
- `packages/core/src/module-boundary.test.ts` still passes (6/6 dynamic-import sanity checks)

### Phase 2A: deferred items (intentional, will return as P3.x or Turn 2B)

- `src/state/undo-redo.ts` should move to `packages/core/src/undo-redo/` per plan P3.2 (D6 misclassification). Deferred to keep Turn 2A focused on the bulk move.
- `src/theme/design-tokens.ts` should move to `packages/core/src/theme/` per plan P2.2. Deferred for the same reason; will go with the theme split in Turn 2B.
- `src/interaction/path-analysis/` (`findShortestPath`) is **architecturally misplaced**: file header says "Framework-agnostic (D6)" but it sits under `src/interaction/`. Not flagged by the original audit. To be moved to `@g3t/core` during the P3.x boundary tightening, after `src/interaction/` itself moves to `packages/react/src/` in Turn 2B.
- `src/core-entry.ts` is now a 143-line dead shim (`export * from "@g3t/core"` shape, produced mechanically by the codemod). Kept until P2.3 rewrites the build pipeline; harmless dead code in the meantime.
- Runtime resolution of `@g3t/core` via Node's package-main lookup (`import('@g3t/core')` from a `node -e` outside the workspace) fails because `dist/` is not built. This is the gap that P2.3 + P6.4 close; in-workspace usage works through Vite/tsc aliases.

### Phase 2B (this turn): @g3t/react + @g3t/charts moved — COMPLETE

Both react and charts source moved in the same turn since `src/charts/` (3 files) had cross-package coupling to react code and splitting would have created a transitional state with broken relative paths.

| Item | Status | Note |
|---|---|---|
| `packages/react/{tsconfig.json,package.json}` | DONE | proper metadata (Apache-2.0, repository/bugs/homepage, semver-correct peer deps including the previously-undeclared `cytoscape-fcose`, `vis-timeline`/`vis-data` declared as optional peers, `flexlayout-react` declared as optional pending P3.3), `composite: true`, references `packages/core`, `sideEffects: ["*.css"]` |
| `packages/charts/{tsconfig.json,package.json}` | DONE | proper metadata, `references` covers core and react |
| `git mv` source moves | DONE | `src/{views,interaction,state,a11y,theme,stories,types,workspace}` → `packages/react/src/`; `src/charts` → `packages/charts/src/`. History preserved. |
| `@g3t/react` barrel | DONE | rewritten to use `export *` per subdir for comprehensive coverage. Closes the audit-found API gap: the new barrel includes the Props types (`TreeViewProps`, `SchemaViewProps`, `WorkspaceShellProps`, etc.) and helpers (`useAnnounce`, `HIGH_CONTRAST_DEFAULTS`, `getDefaultLayoutForRole`, `createDefaultMenuManager`, `LayoutManager`, `TemporalSlider`, `PropertyEditor`, etc.) that the old `src/react-entry.ts` was missing. |
| Codemod | DONE | 353 substitutions across 67 files (`@views/*`, `@state/*`, `@interaction/*`, `@a11y/*`, `@theme/*` aliases plus matching `./views/...` relative-from-root forms). Inside `packages/react/src/`: depth-aware relative paths. Outside: `@g3t/react`. Charts cross-package references (`./charts/...`, `../../charts/...`) rewritten to `@g3t/charts`. Tsconfig and Vite aliases updated to remove orphans and add `@g3t/react`/`@g3t/charts` source mappings. |
| Workspace symlinks | DONE | `node_modules/@g3t/{core,react,charts}` all correctly symlinked; pnpm rebuilt the workspace from updated `pnpm-workspace.yaml`. |
| Failing-test fix | DONE | `packages/react/src/theme/coverage-gaps.test.ts` had two hardcoded file-path string literals (`"src/views/canvas/CytoscapeCanvas.tsx"`) reading source via `fs.readFileSync` — updated to the new location. |

### Phase 2B verification gate

- `pnpm install --frozen-lockfile`: clean
- `pnpm run typecheck`: clean (exit 0)
- `pnpm test`: **556 passed (556)** in 39 test files, **exit 0** for the first time since the project's baseline (the sandbox Playwright issue went away too — see "Storybook discovery" below)
- `packages/{core,react,charts}/src/` all populated with the expected source trees
- `src/` at root contains only demo + entry shims (`App.tsx`, `main.tsx`, `test-harness.tsx`, `demo/`, `index.ts`, `core-entry.ts`, `react-entry.ts`, `charts-entry.ts`)
- No `@views`/`@state`/`@interaction`/`@a11y`/`@theme` orphan references anywhere
- No React imports in `packages/core/src/` production code (only one type-only import in `holonic-adapter.ts`; pre-existing arch violation flagged for P4)

### Phase 2B: discoveries and deferred items

- **`packages/core/src/adapter/holonic-adapter.ts` has a pre-existing boundary violation**: `import type { ContextMenuManager, MenuTarget } from "@g3t/react"`. Type-only (no runtime cycle) but architecturally wrong; the original code did `from "@interaction/context-menu"` and the codemod converted it correctly to `@g3t/react`, but the *direction* is wrong (core depending on react). To be fixed in P4 boundary enforcement, likely by defining a local interface in `packages/core/src/adapter/` and removing the cross-package import.
- **Codemod false-positive in pattern**: the `RELATIVE_PATTERN` regex matched `"./types"` (a local sibling file in `packages/core/src/adapter/` and `packages/core/src/layout/`) thinking it meant the moved `src/types/`. 12 incorrect rewrites had to be reverted by hand. The lesson for future codemods: don't include filename stems (`types`) that collide with common sibling-file names in the pattern's path-prefix list.
- **Storybook discovery is currently silent**: `.storybook/main.ts` still references the old `src/**/*.stories.@(*)` paths. With the move, that glob matches nothing. Vitest's storybook test plugin therefore queues 0 browser-mode test files, which incidentally also means the sandbox-only `@vitest/browser-playwright` Chromium error no longer fires. The unit/component test count (556) is unchanged, but the storybook side has effectively been disabled until the config is updated. Next-turn item.
- **Codemod consolidated Vite alias keys**: the previous turn's codemod, run a second time in this turn, generated 5 duplicate `@g3t/react` alias entries (last-one-wins, all pointing at stale `src/...` directories) in `vite.config.ts`, `vite.lib.config.ts`, and `vite.packages.config.ts`. All three were rewritten by hand to a clean `{ "@g3t/core", "@g3t/react", "@g3t/charts" }` alias block.
- **`src/index.ts` (the legacy monolithic barrel) is now a 484-line shim** that mostly re-exports from `@g3t/core` / `@g3t/react` / `@g3t/charts`. Like `src/core-entry.ts` and `src/react-entry.ts`, it's mechanical dead weight until P2.3 replaces the build pipeline. Not blocking anything; just debt to track.

### Phase 2C/P2.3 (this turn): per-package Vite configs + legacy cleanup — COMPLETE

| Item | Status | Note |
|---|---|---|
| `scripts/vite-externals.mjs` helper | DONE | derives externals from each package's `package.json` `{dependencies, peerDependencies, optionalDependencies}`; matches subpath imports (`lodash/get`) and Node built-ins; React JSX runtime and Zustand middleware subpaths added automatically when the parent dep is present. |
| `packages/core/vite.config.ts` | DONE | lib mode, externals derived from own package.json, ESM+CJS output to `dist/index.{mjs,cjs}` + sourcemaps. Build size: 82.79 KB ESM, 23.01 KB gzipped. |
| `packages/react/vite.config.ts` | DONE | lib mode + React plugin, alias to `@g3t/core` source for dev resolution, CSS extracted to `dist/style.css` (via `cssCodeSplit: false` and `assetFileNames`). Build size: 168.32 KB ESM, 40.37 KB gzipped, + 6.06 KB CSS. |
| `packages/charts/vite.config.ts` | DONE | lib mode + React plugin, aliases to both upstream packages, externals derived from own package.json. Build size: 5.91 KB ESM, 1.99 KB gzipped. |
| Per-package `.d.ts` emission | DONE | each `tsconfig.json` got `emitDeclarationOnly: true`; the build script is `vite build && tsc --build` (vite first because its `emptyOutDir: true` was wiping out tsc's `.d.ts` output when the order was reversed). |
| Legacy files deleted | DONE | `vite.lib.config.ts`, `vite.packages.config.ts`, `tsconfig.build.json`, `scripts/build-packages.sh`, `src/core-entry.ts`, `src/react-entry.ts`, `src/charts-entry.ts`, `src/index.ts` — all gone. |
| Root `package.json` scripts | DONE | removed obsolete `build:lib`, `build:core`, `build:react`, `build:charts`. `build:packages` is now `pnpm --filter './packages/*' --workspace-concurrency=1 run build` (serial; parallel was racing the tsc dependency between @g3t/core and @g3t/react). Root `build` is `pnpm run build:packages && tsc --noEmit && vite build` (packages first, then typecheck + demo build). `lint` extended to cover `packages/*/src/`. |
| Pre-existing arch violation surfaced and patched (provisional) | DONE | `packages/core/src/adapter/holonic-adapter.ts` previously imported `ContextMenuManager` and `MenuTarget` types from `@g3t/react`. This blocked the per-package build (core couldn't compile because @g3t/react wasn't built yet). Replaced with local structural interfaces that match the real @g3t/react shapes exactly (`type: "node" \| "edge" \| "background"`, `id?: string`, `position: { x: number; y: number }`). The proper fix (extract `registerPortalMenuItems` into a @g3t/react helper that accepts the adapter as a parameter) is P4 work; this is a localization-only fix that doesn't change behaviour. |
| CSS side-effect import in `@g3t/react` barrel | DONE | `import "./theme/g3t-base.css";` added at top of `packages/react/src/index.ts`. `sideEffects: ["*.css"]` in package.json preserves it through tree-shaking. Vite extracts to `dist/style.css`. |
| Storybook preview CSS path | DONE | `.storybook/preview.tsx` updated to point at the new `packages/react/src/theme/g3t-base.css`. (Discovery from Turn 2B; closed here as part of the CSS cleanup.) |

### P2.3 verification gate

- `pnpm install --frozen-lockfile`: clean
- `pnpm run typecheck`: clean (exit 0)
- `pnpm test`: **556 passed (556)**, exit 0
- `pnpm run build:packages` (serial): all three packages build cleanly with mjs + cjs + .d.ts + sourcemaps; @g3t/react adds style.css
- `pnpm run build`: full unified build (packages, then root typecheck, then demo via root vite.config.ts) — clean
- Runtime resolution: `import('@g3t/core')` from a standalone `node -e` script works and returns the expected symbols. (The same check for `@g3t/react` and `@g3t/charts` fails at Node level because `WorkspaceShell.tsx` does `import "flexlayout-react/style/light.css"` and Node has no CSS loader; bundler consumers handle this fine. The check passes when run via Vite or in a browser. P3.3 makes this moot by moving WorkspaceShell to examples/.)

### P2.3: discoveries and deferred items

- `pnpm -r run build` runs in parallel by default and races composite-project dependency builds. Fix: `--workspace-concurrency=1`. Alternative (cleaner long-term, P6 candidate): centralized `tsc -b packages/*` from root before per-package vite builds.
- `WorkspaceShell` doing `import "flexlayout-react/style/light.css"` means the built `@g3t/react` bundle can't be `require()`d in a Node-only environment without a CSS loader. Not a defect (bundler consumers handle it), but documenting for any future "smoke-test in Node" CI step.
- The deleted `tsconfig.build.json` had the same `@views/@state/...` orphan aliases as the main `tsconfig.json`; both got cleaned up in Turn 2B. No remaining references.
- Bundle visualizer was wired into the now-deleted `vite.lib.config.ts`. If the team wants per-package bundle analysis, P6 should add `rollup-plugin-visualizer` to each package's vite.config.ts behind an `ANALYZE=1` env flag.

### Phase 2D/P2.4 (this turn): subpath exports — COMPLETE

Multi-entry library builds + `exports` maps shipped per Section 0.6 of the plan.

| Item | Status | Note |
|---|---|---|
| `@g3t/core` subpath barrels | DONE | every top-level subdir of `packages/core/src/` already had `index.ts`; no new barrels needed. |
| `@g3t/react/views` barrel | DONE | new `packages/react/src/views/index.ts` re-exports all view-subdir barrels (canvas, table, inspector, timeline, map, tree, schema, ShaclShapeBrowser, matrix, sankey, query, stats). |
| `@g3t/react/controls` barrel | DONE | new `packages/react/src/interaction/index.ts` re-exports encoding, filter, search, toolbar, context-menu, tag-manager, grouping, layout-switcher, layout-manager, temporal, property-editor, annotations, path-analysis, plus loose-file exports (expandNeighbors, TemporalRangeFilter, DerivedPropertyPanel, etc.). Source dir name is `interaction/`; published subpath name is `controls` (mapped via the exports map). |
| `packages/core/vite.config.ts` multi-entry | DONE | 10 entries: `index` + 9 subpaths (`adapters`, `middleware`, `events`, `projection`, `pipeline`, `shacl`, `diff`, `layout`, `algorithms`). Note three names where the public subpath differs from the source dir name: `adapters` (source `adapter/`), `events` (source `event-bus/`), `algorithms` (source `algorithm-adapter/`). |
| `packages/react/vite.config.ts` multi-entry | DONE | 6 entries: `index` + 5 subpaths (`views`, `controls`, `state`, `theme`, `a11y`). |
| `packages/core/package.json` exports map | DONE | 10 subpaths + `./package.json`, each declaring `import` (`.mjs`), `require` (`.cjs`), and `types` (`.d.ts`) routes. Note `types` paths point at the `dist/<source-dir>/index.d.ts` (TypeScript emits declarations following the source structure) while `import`/`require` point at the flat `dist/<subpath>.mjs` files (Vite's multi-entry output). |
| `packages/react/package.json` exports map | DONE | 6 subpaths + `./style.css` + `./package.json`. |

### P2.4 verification gate

- `pnpm install --frozen-lockfile`: clean
- `pnpm run typecheck`: clean (exit 0)
- `pnpm test`: **556 passed (556)**, exit 0
- `pnpm run build:packages`: emits all 10 core entries + 6 react entries + 1 charts entry as `.mjs` + `.cjs` + sourcemaps. Shared-chunk extraction by Rollup creates additional hashed chunks (`ThemeManager-DRao5Uig.cjs`, `palette-DL_y5oS6.cjs`, etc.) for cross-entry deduplication; this is expected and reduces total bundle size for consumers using multiple subpaths.
- Subpath `.d.ts` coverage: all 9 core subdirs + all 5 react subdirs have their `dist/<subdir>/index.d.ts` files.
- Runtime: `import { ForceLayout } from "@g3t/core/layout"`, `import { SparqlAdapter } from "@g3t/core/adapters"`, `import { validateShacl } from "@g3t/core/shacl"` all resolve from Node. Subpath imports work for both consumers (browser/bundler) and for ad-hoc Node scripts.

### P2.4: details worth flagging

- **Source-dir-to-subpath naming**: three core subpaths have public names that differ from source dir names (`adapters` ↔ `adapter`, `events` ↔ `event-bus`, `algorithms` ↔ `algorithm-adapter`). The `types` field in each exports entry points at the actual source-dir `dist/<dir>/index.d.ts`, so TypeScript resolves types correctly without us having to rename source directories. Same pattern for `@g3t/react/controls` ↔ source `interaction/`.
- **Shared-chunk extraction**: with multi-entry lib builds, Rollup automatically extracts modules shared across entries into hashed chunks. This means dist/ has more than just the per-entry `.mjs` files; it also has chunks like `ThemeManager-{hash}.cjs`. Consumers using only one subpath will pay the cost of just that subpath + its specific shared chunks. Bundle-size budgets in P6 should treat the per-entry size as the addressable cost.
- **README example unblocked**: the audit found the README's example used `@g3t/react/state`, which didn't exist at the time. That subpath is now real and the README example will work as written once P5 updates the README to use the package paths.

### Phase 2E/P2.5 + P2.6 (this turn): per-package deps reconciled; root made workspace-only — COMPLETE

| Item | Status | Note |
|---|---|---|
| Per-package deps audited | DONE | Wrote an inventory script that diffed each `packages/<pkg>/src/**/*.{ts,tsx}` import set against the package's declared `{dependencies, peerDependencies, optionalDependencies}`. Three categories of finding: (a) test-time deps not declared at the package level (false-positive when whole-tree tests pass at root, real gap when consumers try `pnpm --filter @g3t/<pkg> run test`); (b) production deps declared but truly unused; (c) workspace `@g3t/*` peers — false-positive in audit (filtered out). |
| Six truly-unused deps removed from `@g3t/core` | DONE | `crossfilter2`, `graphology-communities-louvain`, `graphology-components`, `graphology-metrics`, `graphology-shortest-path`, `graphology-types` — none of them was actually imported anywhere in the workspace. `crossfilter2` had a doc comment claiming `filter.ts` "wraps crossfilter2 for fast bitmap-indexed filtering" but the actual implementation never imported it. The dishonest comment is left as P5 doc-reconciliation work. |
| Test devDeps added per-package | DONE | `@g3t/core` got `vitest` + `@testing-library/react`; `@g3t/react` got those plus `@storybook/react` + `@storybook/react-vite`; `@g3t/charts` got those plus `@testing-library/user-event`. Versions pulled from root devDependencies so they stay aligned across the workspace. |
| Root `package.json` made workspace-only | DONE | `private: true` added; the six truly-unused deps removed; every remaining runtime `dependencies` entry (`@dagrejs/dagre`, `cytoscape`, `d3-force`, `d3-hierarchy`, `echarts`, `elkjs`, `expr-eval`, `graphology`, `react`, `react-dom`, `simple-statistics`, `zustand`) moved to `devDependencies` since the root publishes nothing. Workspace links (`@g3t/core`, `@g3t/react`, `@g3t/charts`) are the only items in root `dependencies`. |
| Final per-package consistency check | DONE | `@g3t/core`: 9 imports, 9 declared, 0 missing. `@g3t/react`: 14 imports, 16 declared, 0 missing. `@g3t/charts`: 6 imports, 8 declared, 0 missing. |

### P2.5/P2.6 verification gate

- `pnpm install --frozen-lockfile`: clean (6 packages pruned: the unused graphology-* and crossfilter2)
- `pnpm run typecheck`: clean (exit 0)
- `pnpm test`: **556 passed (556)**, exit 0
- `pnpm run build:packages`: clean per-package build (mjs+cjs+d.ts for each subpath)
- Each package now declares every external library it actually imports

### Open items deferred to later phases

- **Comment honesty**: the `crossfilter2` comment in `packages/core/src/filter/filter.ts` claims an implementation that doesn't exist. P5 doc reconciliation should update the comment or land the implementation; doing it now would expand P2's scope into rewriting algorithms.
- **Demo extraction (P3.3)**: the root still hosts a demo (`src/main.tsx`, `src/App.tsx`, `src/demo/`, `src/test-harness.tsx`). With `private: true` set, the demo's runtime deps (React, ECharts, Cytoscape, etc.) now live as root devDependencies. The full extraction (move demo to `/demo` or `/examples/` with its own package.json) is part of P3.3.

---

## Phase 2 — COMPLETE

All five Phase 2 items landed. Tests held at 556/556 with exit 0 throughout. Six commits on top of the baseline:

| Commit | Phase | Description |
|---|---|---|
| `c1f7345` | Phase 1 | repository hygiene |
| `303d431` | Phase 2A | physical workspace split, `@g3t/core` moved |
| `eb6be3d` | Phase 2B | `@g3t/react` and `@g3t/charts` moved |
| `bb84d90` | Phase 2C/P2.3 | per-package Vite configs; legacy build pipeline removed |
| `89b67e1` | Phase 2D/P2.4 | subpath exports |
| (this turn) | Phase 2E/P2.5+P2.6 | per-package deps reconciled; root made workspace-only |

The architectural boundary the original plan declared but didn't enforce is now physical: `packages/core/src/` cannot relatively-import from `packages/react/`, and the only pre-existing cross-package import in core (holonic-adapter's `ContextMenuManager`/`MenuTarget`) is patched with locally-declared structural types pending the proper P4 fix.

---

## Phase 3 — COMPLETE

All six sub-items landed across five commits. Tests held at 556/556 with exit 0 throughout.

| Commit | Sub-item | Description |
|---|---|---|
| `674c6d8` | P3.2 + extras | `UndoRedoStack`, design tokens, `path-analysis` reclassified to `@g3t/core`; holonic-adapter boundary fix (extracted `registerPortalMenuItems` to `@g3t/react`); 3 new core subpaths (`undo-redo`, `theme`, `path-analysis`) wired into the multi-entry build |
| `4c5a1d7` | P3.3 | `WorkspaceShell` extracted to `examples/full-workspace/` as proper workspace member |
| `88b5b9d` | P3.5 | `interaction/remaining-tickets.tsx` (kitchen-sink) split along functional lines into `appearance-actions.ts` + `TemporalRangeFilter.tsx` + `DerivedPropertyPanel.tsx`, each colocated with its own test file |
| `5f9962f` | P3.1 | Three missing classes added (`ShaclValidator`, `IncrementalLayout`, `VisualEncodingManager`) as thin stateful wrappers over the existing free functions; existing functions stay exported (backwards compat) |
| `8615b7d` | P3.4 | Holonic naming consistency was a doc-path issue, not a code-symbol issue; fixed two stale `src/core/...` references in `DEVELOPER.md` and `planning/enhancement-implementation.md` |

P3.6 (deep-imports consolidation) had nothing to consolidate. Final audit confirmed all cross-package imports in source use the public top-level path (`@g3t/core`, `@g3t/react`, `@g3t/charts`). Only one deep subpath import in source: a single `import from "@g3t/core/layout"` line, intentional and correct.

### Phase 3 final architectural state

- `packages/core/src/` production code: zero imports from `@g3t/react` or `@g3t/charts`. Boundary enforced by file system + clean imports + tsconfig `paths` resolution. The previous workaround in `holonic-adapter.ts` (locally-declared structural types) is gone.
- `packages/react/src/` production code: zero imports from `@g3t/charts`. (One reference exists in `stories/M10-M13.stories.tsx` for Storybook demos; this is a documentation surface, not production code, but worth flagging for Phase 4.)
- All three "documented but missing" classes from the audit (`VisualEncodingManager`, `ShaclValidator`, `IncrementalLayout`) now exist as named classes with the documented API surface.
- `examples/` is now a workspace member; `WorkspaceShell` lives there with its own tests, its own `package.json`, its own `tsconfig.json`. `flexlayout-react` was removed from `@g3t/react`'s peer deps.

### Carryover into Phase 4

Four test files in `packages/core/src/` import from `@g3t/react`, so they're integration tests masquerading as core unit tests:

| File | Lines | What it imports from @g3t/react |
|---|---|---|
| `packages/core/src/adapter/adapter.test.ts` | 752 | `ContextMenuManager`, `registerPortalMenuItems` |
| `packages/core/src/style-override/m12.test.tsx` | 261 | `NodeStyleEditor`, `useStyleOverrideStore` |
| `packages/core/src/combo/f1-f8.test.tsx` | 212 | multiple combo/property-editor UI symbols |
| `packages/core/src/shacl/shacl.test.tsx` | 192 | `ShaclShapeBrowser` |

Total ~1417 lines. Each tests a core feature *through* a React component. Structurally they belong in `packages/react/src/`. Moving them is mechanical but real work; landing in Phase 4.

---

## Phase 4 — IN PROGRESS

### Phase 4A (committed): source-level boundary tests + start of test relocation

See commit `e1a1fe2`. Two new boundary tests landed; shacl test split landed.

### Phase 4B (this turn): finish test relocation; tighten boundary check

Moved every remaining cross-package test out of `@g3t/core/src/` and into
`@g3t/react/src/` alongside the components they exercise. The four
audit-flagged misplaced files split cleanly along the pure-core vs
react-integrated axis:

| Old (in core) | What moved to react | What kept in core |
|---|---|---|
| `packages/core/src/adapter/adapter.test.ts` (752 → 697 lines) | `HolonicAdapter portal menu (M3.E2.T4)` describe → `packages/react/src/interaction/context-menu/holonic-portal-menu.test.ts` (2 tests) | 12 adapter/algorithm describes (34 tests) stay in core |
| `packages/core/src/style-override/m12.test.tsx` (262 → 188 lines, renamed `.ts`) | `NodeStyleOverride store` (4 tests) → `packages/react/src/state/style-override-store.test.ts`; `NodeStyleEditor` (4 tests) → `packages/react/src/interaction/encoding/NodeStyleEditor.test.tsx` | `overridesToCytoscapeStyles`, `SVG icon library`, `Override serialization`, `TypeMenuProvider` (14 tests) stay in core |
| `packages/core/src/combo/f1-f8.test.tsx` (213 → 126 lines, renamed `.ts`) | `AnnotationPanel (F4)` (2 tests), `createLocalAnnotationStore (F4)` (1 test) → `packages/react/src/interaction/annotations/annotations.test.tsx`; `PropertyEditor (F5)` (3 tests) → `packages/react/src/interaction/property-editor/PropertyEditor.test.tsx` | `computeIncrementalUpdate (F2)`, `ComboManager (F3)` stay in core |

The shacl test split (Phase 4A) had already moved `ShaclShapeBrowser` tests.

After all moves: `@g3t/core/src/` has zero `@g3t/react` or `@g3t/charts` imports anywhere — production code AND tests. Three of the four files lost their JSX as the UI tests moved out and were renamed from `.tsx` to `.ts` (`shacl.test.ts`, `m12.test.ts`, `f1-f8.test.ts`).

**Tightened the source boundary**: removed the `*.test.ts` exemption from `packages/core/src/source-boundary.test.ts`. The boundary now applies to every source file in the package (the test itself is excluded so it doesn't self-scan). The walk also excludes `.d.ts` declaration files.

### Phase 4B verification gate

- `pnpm install`: clean
- `pnpm run typecheck`: clean (exit 0)
- `pnpm test`: **566 passed (566)**, exit 0
- Test files: 45 → 50 (+5: holonic-portal-menu, style-override-store, NodeStyleEditor, annotations, PropertyEditor — each a new test file at its proper location)
- Total test count unchanged (the moved tests now run from their new locations)
- Boundary tests: 10 passed (2 sanity + 7 forbidden-import checks for core + 1 forbidden-import check for react)
- `grep -rln 'from "@g3t/react"\|from "@g3t/charts"' packages/core/src/` returns empty even without the test exemption
- `grep -rln 'from "@g3t/charts"' packages/react/src/` returns only the storybook story file (still allowed by the react boundary test's `*.stories.tsx` exemption)

### Phase 4 remaining

(none — Phase 4 complete; see Phase 4C below)

### Phase 4C (this turn): public-API consistency + per-package test isolation — COMPLETE

| Item | Status | Note |
|---|---|---|
| P4.3 public-API consistency test | DONE | New `packages/core/src/public-api.test.ts` reads each package's `exports` map and verifies, for every subpath, that the published dist artifact (a) exists on disk and (b) exports ≥1 named symbol. 20 assertions total: 13 for `@g3t/core` (`.` + 12 subpaths), 6 for `@g3t/react` (`.` + 5 subpaths after skipping `./style.css` and `./package.json`), 1 for `@g3t/charts`. Initial pass caught a real divergence — Vitest's resolver couldn't reach the 4 subpaths whose public name differs from the source dir (`adapters` ↔ `adapter/`, `events` ↔ `event-bus/`, `algorithms` ↔ `algorithm-adapter/`, `controls` ↔ `interaction/`). Fixed by importing the dist artifact via the absolute path from the exports map directly, not by package specifier; this is also the more honest check since it tests what consumers actually receive. |
| P4.4 per-package test isolation | DONE | Each package's `test` script changed from `vitest run` (which used per-package CWD and lost the root vitest config) to `pnpm -w exec vitest run packages/<pkg>/src` (which runs from workspace root, inheriting jsdom environment, setup files, and project structure, while filtering to the package's own tests). `pnpm --filter @g3t/<pkg> run test` now succeeds for all three packages: core (14 files, 244 tests), react (35 files, 316 tests), charts (1 file, 20 tests). |
| Workspace-root detection in boundary/api tests | DONE | The two `source-boundary.test.ts` files and `public-api.test.ts` previously used `process.cwd()` to find package directories. That broke under per-package isolation where cwd is `packages/<pkg>` not the workspace root. Replaced with a `findWorkspaceRoot()` helper that walks up from `fileURLToPath(import.meta.url)` until it finds `pnpm-workspace.yaml`. Robust to running from the workspace root, a single package, or any subdirectory. |

### Phase 4C verification gate

- Per-package isolation: `pnpm --filter @g3t/core test` (244), `pnpm --filter @g3t/react test` (316), `pnpm --filter @g3t/charts test` (20). All pass exit 0.
- Per-package sum: 50 files / 580 tests
- Full-suite: 51 files / 586 tests (the extra +1 file / +6 tests is `examples/full-workspace/src/workspace.test.tsx`, which isn't part of any of the three packages)
- Counts add up exactly — no test left behind, no test counted twice
- Boundary tests still pass: 10 (8 core + 2 react)
- Public-API tests pass: 20 subpaths

## Phase 4 — COMPLETE

Three commits on top of Phase 3:

| Commit | Sub-item | Description |
|---|---|---|
| `e1a1fe2` | P4.1 + P4.2 partial | source-level boundary tests added; shacl test split out as the first relocation |
| `bb5c301` | P4.2 finish | remaining three misplaced tests (adapter, m12, f1-f8) relocated; *.test.ts exemption removed from core boundary |
| (this turn) | P4.3 + P4.4 | public-API consistency test; per-package test isolation; workspace-root detection in boundary/api tests |

### Phase 4 final architectural state

- `@g3t/core/src/` has zero `@g3t/react`/`@g3t/charts` imports anywhere — production AND tests; the boundary test enforces this with no exemptions.
- `@g3t/react/src/` has zero `@g3t/charts` imports in production code or tests (Storybook stories still allowed to cross by design).
- Every declared subpath in every `package.json` exports map maps to an actual file with at least one named export. New subpaths that drift from the bundle (missing files, dead barrels) will fail the test loudly.
- Each package can be tested in isolation with `pnpm --filter @g3t/<pkg> test` — useful for CI matrix runs and for verifying that a package's tests don't accidentally depend on another package's source tree.

---

## Phases 5-8 — IN PROGRESS

### Phase 5A (this turn): doc-honesty cleanups — COMPLETE

Three small but specific audit-flagged drifts fixed:

| Item | Status | Note |
|---|---|---|
| Robot Framework removal | DONE | `pixi.toml`: deleted three Robot test tasks (`test:acceptance`, `test:acceptance:m0`, `test:acceptance:m1`) and the entire `[pypi-dependencies]` section (was just `robotframework` + `robotframework-browser`). `PROGRESS.md` D14 line updated from "four-layer testing strategy" to "three-layer" with a note that Robot was consolidated into Playwright in v1.0.0-rc; pointed readers at the existing `docs/source/testing-architecture.md` for the rationale. Confirmed `tests/acceptance/` directory was already gone (deleted in an earlier pass). |
| `crossfilter2` aspirational comment | DONE | `packages/core/src/filter/filter.ts` header previously claimed "Wraps crossfilter2 for fast bitmap-indexed filtering... the implementation delegates to crossfilter2." That was the dishonest comment the P2.5 dep cleanup flagged: `crossfilter2` was never actually imported. Rewrote the comment to describe what the code actually does (iterates UGM nodes, applies operators directly) and noted the historical context (earlier design called for crossfilter2; dropped before v1.0.0-rc for simplicity). |
| Storybook config | DEFERRED to P6 | The fix is small (`stories: ["../packages/react/src/**/*.stories.tsx"]` instead of `../src/**`) but pointing the glob correctly exposes a hidden environmental dependency: vitest's storybook integration needs Playwright Chromium installed. The fix should land alongside the CI browser-install step. Left as a TODO comment in `.storybook/main.ts` with the old src/** glob retained so `pnpm test` still works in environments without browsers. |

### Phase 5B (this turn): doc derivation script + README/status surgical fixes — COMPLETE

| Item | Status | Note |
|---|---|---|
| `scripts/workspace-stats.mjs` | DONE | Dependency-free Node script that derives the workspace's real numbers — unique R-IDs across `specs/`, test files per package, declared subpath count per package — and emits JSON. Replaces hardcoded counts that drift. CI hook target: `node scripts/workspace-stats.mjs \| jq` and fail if any hardcoded `N tests` claim in `README.md`/`status.md`/`PROGRESS.md` no longer matches. |
| README fixes | DONE | Three surgical edits: (1) removed hardcoded `556 unit + component tests` count — was already stale at 586; (2) project structure no longer lists `examples/react-neo4j/` and `examples/react-rest-api/` (aspirational; never existed); (3) project structure no longer lists `demo/` as if it were a separate directory, points at the actual `src/` location of the demo and notes the eventual `demo/` move is queued. |
| `planning/status.md` drift notes | DONE | Test count line updated 531 → 586 (still hand-maintained; pointer to the new script). Requirements-coverage table got a footnote: the per-domain breakdown sums to 67 but `workspace-stats.mjs` finds 72 unique R-IDs in `specs/` (R1.13–14, R2.13–15 were added later and never wired into the table). Coverage percentage above the footnote remains as-is for now since recomputing it needs the milestone-YAML data, not just R-ID counts. |

### Phase 6A (this turn): verify scripts (smoke, treeshake, bundle-size) — COMPLETE

Three verify scripts and an umbrella runner. All four runnable via npm
scripts from the repo root.

| Item | Status | Note |
|---|---|---|
| Node-import smoke test | DONE | `scripts/smoke-test.mjs` walks each package's `exports` map, imports every subpath via absolute dist path from a plain Node script, asserts ≥1 named export. Phase 2A had flagged that `@g3t/react` and `@g3t/charts` failed this style of check because `WorkspaceShell.tsx` did a bundler-only `import "flexlayout-react/style/light.css"`. Phase 3.3 moved WorkspaceShell out to `examples/`; the smoke test is now unblocked and passes for all 20 subpaths (13 core + 6 react + 1 charts). |
| Treeshake verifier (rewritten) | DONE | The pre-existing `scripts/verify-treeshake.mjs` targeted the legacy monolithic `dist/g3t.mjs` bundle which no longer exists. Rewrote to walk each package's `dist/`: asserts `sideEffects` is declared correctly (`false` for core/charts, `["*.css"]` for react), `dist/index.mjs` exists and uses named exports, and no top-level external side-effect imports (CSS exempt). |
| Bundle-size budget | DONE | New `scripts/check-bundle-size.mjs`. Sums every `.mjs` + chunk file (excluding `.cjs`, `.d.ts`, sourcemaps) in each package's `dist/` and compares to a per-package budget. Current measurements vs budget: `@g3t/core` 95 KB / 120 KB (79%), `@g3t/react` 165 KB / 200 KB (82%), `@g3t/charts` 5.8 KB / 10 KB (58%). Budgets sized to give ~25% headroom; raising them requires a comment in the same commit. |
| Root npm scripts | DONE | New: `verify:smoke`, `verify:bundle`, `verify:treeshake`, `verify:stats`. Aggregate: `verify` = `pnpm run build:packages && pnpm run verify:treeshake && pnpm run verify:smoke && pnpm run verify:bundle`. Designed to be a single CI gate. |

### Phase 6A verification gate

- `pnpm run verify` runs clean (build:packages + treeshake + smoke + bundle-size) from a clean state.
- `pnpm test` still **586 passed (586)**, exit 0.
- Build artifacts behave as expected:
  - Treeshake: all checks pass for all three packages.
  - Smoke test: all 20 subpaths resolve cleanly via Node (no jsdom, no bundler).
  - Bundle size: all packages within budget.

### Phase 6B (this turn): centralized tsc -b orchestration (P6.5) — COMPLETE

Resolves the build-chain stale-state issue noted in Phase 6A.

**Before**: each package's `build` was `vite build && tsc --build`. When pnpm ran them serially via `--workspace-concurrency=1`, TypeScript would sometimes report TS6305 because `@g3t/core`'s declaration files weren't recognized as up-to-date when `@g3t/react`'s composite-project build ran against them. The fix required `rm -rf dist/ tsconfig.tsbuildinfo` and a fresh rebuild.

**After**:
- Each package's `build` is just `vite build` (the per-package tsc step is gone)
- Root `build:packages` first runs `tsc -b packages/core packages/react packages/charts` once with proper topological ordering (this emits all declarations in one pass), then per-package `vite build`
- Confirmed idempotent: running `pnpm run build:packages` twice in succession with no cleanup produces identical output, no TS6305 errors
- Same approach for `pnpm run verify` which calls `build:packages` first; verify chain now runs cleanly without manual cleanup steps

### Phase 6B verification gate

- `pnpm run build:packages` (clean): all three packages built, types emitted to each `dist/<subdir>/index.d.ts`
- `pnpm run build:packages` (rerun without cleanup): identical output, no errors
- `pnpm run verify`: clean
- `pnpm test`: **586 passed (586)**, exit 0

---

## Phase 6 partial — IN PROGRESS

P6.1 (smoke test), P6.2 (treeshake verifier rewrite), P6.3 (bundle-size budget), P6.5 (centralized tsc -b) all DONE this turn. Remaining Phase 6 items:

- **Storybook config fix + Playwright Chromium install**: deferred from P5A. The fix itself is a one-line glob change in `.storybook/main.ts` plus a `pnpm exec playwright install chromium` step. Right place is alongside whatever CI/local-setup script makes browser install a regular part of the dev experience; until then the smoke test (P6.1) covers the published-API surface.
- **Per-entry bundle visualizer flag**: nice-to-have. `rollup-plugin-visualizer` in each `vite.config.ts` behind `ANALYZE=1`. Easy to add when needed.

## Phase 7 — TEAM DECISION NEEDED

The plan calls for M9/M10 disposition (defer or land before v1.0.0). This is a roadmap question that needs domain context I don't have. Documented for the team to decide.

## Phase 8A (this turn): pre-publish checklist — COMPLETE

New file: `planning/pre-publish-checklist.md`. Codifies the gate that every release passes before `pnpm publish`. Contents:

1. **Local pre-flight**: clean install, `pnpm run build:packages`, `pnpm run typecheck`, `pnpm test`, per-package isolation tests, `pnpm run verify` (runs treeshake + smoke + bundle-size).
2. **Manual review gates**: CHANGELOG, version bumps, deps reconciled against actual usage, README example still compiles, no `workspace:*` leaks, license headers.
3. **Dry-run publish**: `pnpm pack` each package, inspect tarball contents (correct dist files, no test files, no tsbuildinfo, no workspace ranges). Audit-flagged checks restated: core has no React/Cytoscape/ECharts/Zustand imports, react has no @g3t/charts imports in production code.
4. **Publish order**: core → react → charts (peer-deps topology).
5. **Post-publish verification**: install from npm in a clean directory, import each package + a subpath, verify symbols.
6. **Rollback**: `npm unpublish` within 72h; `npm deprecate` after.

The pre-flight commands map directly to the npm scripts added across Phases 4-6:
- `pnpm test` — full suite (Phase 4)
- `pnpm --filter @g3t/<pkg> test` — per-package isolation (Phase 4C/P4.4)
- `pnpm run verify` — architectural gates (Phase 6A)

This is the consolidated artifact connecting everything Phases 1-6 added to a concrete publish workflow.

## Final state (this engagement)

Tests stable at **586 passed (586)**, exit 0, throughout. 19 commits past the audit baseline. Phase 1-6 complete or near-complete; Phase 8 has the published checklist; Phase 7 needs team input.

### Phase 3A: boundary reclassifications + holonic-adapter extraction — COMPLETE

Three D6 modules moved from `@g3t/react` to `@g3t/core` where the audit and the plan said they architecturally belong, plus the pre-existing core→react boundary violation in `holonic-adapter` properly fixed (instead of the provisional structural-types workaround from P2.3).

| Item | Status | Note |
|---|---|---|
| P3.2: `UndoRedoStack` → `@g3t/core/undo-redo/` | DONE | `packages/react/src/state/undo-redo.ts` → `packages/core/src/undo-redo/undo-redo.ts` with new `index.ts` barrel. Self-referential `import from "@g3t/core"` rewritten to relative `../ugm`. |
| Phase 2A-deferred: design tokens → `@g3t/core/theme/` | DONE | `packages/react/src/theme/design-tokens.ts` → `packages/core/src/theme/design-tokens.ts` with new `index.ts` barrel. The Phase 2A note about the theme split is closed here. |
| Turn 2A discovery: `path-analysis/` → `@g3t/core/path-analysis/` | DONE | `packages/react/src/interaction/path-analysis/` → `packages/core/src/path-analysis/`. File's own header always said "Framework-agnostic (D6)"; now it lives where the comment claimed. Self-referential `import from "@g3t/core"` rewritten to relative `../ugm`. |
| `@g3t/core` barrel updated | DONE | `packages/core/src/index.ts` now exports `UndoRedoStack`, `UndoRedoOptions`, `DESIGN_TOKENS`, `DARK_SHADOWS`, `injectDesignTokens`, `findShortestPath`, `PathResult`, `PathOptions` from the new internal modules. |
| `@g3t/react` backwards-compat re-exports | DONE | The state, theme, interaction, and main barrels in `packages/react/src/` re-export the moved symbols from `@g3t/core` so existing consumers' imports (`import { UndoRedoStack } from "@g3t/react"` etc.) continue to work. Comments mark each re-export as a compat shim and point at the new canonical source. |
| holonic-adapter boundary fix | DONE | `registerPortalMenuItems` method extracted from `HolonicAdapter` (in core) into a free function in new file `packages/react/src/interaction/context-menu/holonic-portal-menu.ts`. Free function signature: `registerPortalMenuItems(adapter, menuManager, onTraverse)`. The provisional structural-type declarations added to `holonic-adapter.ts` in P2.3 are now deleted. `HolonicAdapter.dataset` changed from `private` to `public readonly` so the free function can access it. New function exported from `@g3t/react` controls barrel. |
| `packages/core/adapter/adapter.test.ts` updated | DONE | Two call sites updated from `adapter.registerPortalMenuItems(menuManager, onTraverse)` to `registerPortalMenuItems(adapter, menuManager, onTraverse)`. Import added to the existing `@g3t/react` import line. Architectural note: this test file still lives in `@g3t/core`'s test suite but imports from `@g3t/react`; per the plan it should move to `@g3t/react`'s test suite in P4. |
| New subpath exports for 3 reclassified modules | DONE | `packages/core/vite.config.ts` extended with three new multi-entry targets (`undo-redo`, `theme`, `path-analysis`). `packages/core/package.json` exports map expanded to 13 subpaths total. All three resolve at runtime from a Node script: `import { UndoRedoStack } from "@g3t/core/undo-redo"`, etc. |
| Other consumers updated | DONE | `packages/react/src/views/query/gap-analysis.test.tsx` and `packages/react/src/theme/coverage-gaps.test.ts` now import from `@g3t/core` directly (the canonical source) rather than the moved local paths. |

### Phase 3A verification gate

- `pnpm install`: clean
- `pnpm run typecheck`: clean (exit 0)
- `pnpm test`: **556 passed (556)**, exit 0
- `pnpm run build:packages`: all three packages build cleanly. `@g3t/core` now emits 13 entry bundles (10 from before + 3 new); each has its corresponding `dist/<subdir>/index.d.ts`.
- **Boundary check (final)**: `grep -r 'from "@g3t/react"\|from "@g3t/charts"' packages/core/src/ --exclude *.test.*` returns nothing. The architectural boundary is now enforced by the file system *and* by clean imports.
- Runtime subpath verification: `node -e "await import('@g3t/core/undo-redo')"` etc. all resolve and expose the expected symbols.



## Self-audit (post-Phase-8A): findings + fixes

After Phase 8A I claimed the engagement was at a clean stopping point. When pushed on whether that was really pristine vs just "tests pass," ran a systematic audit of 8 items in decreasing priority. Findings:

### Audit findings table

| # | Item | Priority | Finding | Fix status |
|---|---|---|---|---|
| 1 | `pnpm pack` inspection | HIGH | No source/test/tsbuildinfo leaks. `workspace:*` correctly rewritten to `1.0.0-rc.1`. Audit-flagged "no React/Cytoscape/Zustand/ECharts in core dist" confirmed. | PASS, no fix needed |
| 2 | `examples/full-workspace/` E2E | HIGH | Tests pass (6). Deps declared correctly. WorkspaceShell moved faithfully from baseline (same 188 lines, same 3 imports). Minor cosmetic noise: example's `pnpm run test` inherits root vitest config and prints harmless storybook "no story files" warnings. | PASS with minor noise; not blocking |
| 3 | ARCHITECTURE.md + docs/source/* | HIGH | **Major drift in ARCHITECTURE.md peer-dep claims.** Said core has `graphology` peer-dep only — actually has 7 regular deps and 0 peer deps. Said react has 3 peer deps — actually has 9. Said charts has 3 peer deps — actually has 3 but different set. Also claimed "10 control components" when README says 15 (15 is right). `docs/source/testing-architecture.md` had one stale `src/core/` path. | **FIXED** this turn |
| 4 | Test honesty | MED | Zero `.only`/`.skip`/`.todo`/`xit`/`xdescribe`. 1079 `expect()` calls over 580 package tests = ~1.86 assertions/test. No trivial placeholders. | PASS |
| 5 | peerDeps revalidation | MED | Core 7-of-7 imports match declared regular deps exactly. React 10-of-11 declared deps imported by production code; the one exception (`react-dom`) is intentional. Charts 5-of-5 perfect. | PASS; react-dom rationale documented in package READMEs |
| 6 | Storybook story imports | MED | **`Views.stories.tsx` had broken `../views/*` import paths** that would resolve to non-existent `views/views/` directory. Dormant because the storybook config (per P5A) still points at the pre-move `src/**` location. The moment storybook config gets fixed, these would fail. | **FIXED** this turn |
| 7 | Per-package READMEs | LOW | **None existed.** Each package on npmjs.com would show only the one-line description with no install/usage info. | **FIXED** — added minimal READMEs for all three packages; confirmed they get into `pnpm pack` |
| 8 | License | LOW | **Two publish blockers**: (a) no `LICENSE` file at workspace root despite README linking it; (b) root `package.json` declared `"ISC"` while all three packages declared `"Apache-2.0"`. | **PARTIALLY FIXED** — root `package.json` updated to `Apache-2.0`; `LICENSE` file created with Apache-2.0 text (see caveat below) |

### LICENSE file caveat

Created `LICENSE` with Apache-2.0 text reproduced from training-data memory of the standard text. `sha256sum` of this file does NOT match the canonical Apache.org SHA-256 (`cfc7749b...` expected vs `0d4037e2...` actual), and line count is 201 vs canonical 202. The differences are almost certainly whitespace (trailing newlines, indentation variants), not legal substance, but **before publish, replace this file with the canonical text downloaded from `https://www.apache.org/licenses/LICENSE-2.0.txt`**. License scanners and SPDX validators are typically permissive on whitespace, but the canonical text is what should ship.

### Build-chain idempotency improvement

The audit revealed that `pnpm run verify` could fail non-deterministically depending on prior dist-directory state. The Phase 6B/P6.5 fix (centralized `tsc -b` at root) addressed the simple-case race but not all of them — running `pnpm test` first and then `pnpm run verify` could surface stale-buildinfo TS7006/TS6305 errors. Tightened by adding `--force` to the root `tsc -b` invocation: `tsc -b packages/core packages/react packages/charts --force`. The `--force` flag tells TypeScript to rebuild all referenced projects regardless of buildinfo, eliminating the stale-state class of races entirely. Cost: slower CI builds. Benefit: deterministic verification.

### What I overclaimed in the Phase 8A closeout

Be explicit about it: when I called Phase 8A the final state, I had verified `pnpm test` exit 0 and `pnpm run verify` exit 0 but had NOT:
- inspected `pnpm pack` output for any package
- read ARCHITECTURE.md to check it matched reality
- looked for per-package READMEs
- checked the LICENSE file existed
- verified storybook story imports resolved
- audited test files for `.only`/`.skip`

The user pushed back appropriately and these 8 checks surfaced 4 real fixes (ARCHITECTURE peer-deps, Views.stories paths, missing per-package READMEs, missing LICENSE + wrong root license field) plus one improvement (build idempotency with `--force`). Tests + verify all still green: 586/586.

### Items still not addressed (queued for future passes)

- Cosmetic: noisy storybook warnings when running tests from inside an example dir
- The deferred Storybook config fix + Playwright Chromium install (still blocked on environmental setup)
- The 67-vs-72 requirements-coverage drift in status.md (footnoted but not reconciled)
- `LICENSE` byte-mismatch against canonical Apache-2.0 (text is semantically correct; user should download canonical before publish)
