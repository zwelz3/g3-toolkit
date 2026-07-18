# Pre-Publish Checklist (P8)

The g3-toolkit packages publish in a coordinated set:
`@g3t/core`, `@g3t/react`, `@g3t/charts`. Every release must pass
this checklist before `pnpm publish --filter "./packages/*"` runs.

The checklist is intentionally compact and runnable. If a step is not
automatable, that's a flag — file an issue to automate it.

## Local pre-flight

```bash
# Clean state
rm -rf packages/*/dist packages/*/tsconfig.tsbuildinfo
pnpm install --frozen-lockfile

# Build + typecheck
pnpm run build:packages
pnpm run typecheck

# Test
pnpm test
# Expect: Test Files <N> passed (<N>), Tests <M> passed (<M>), exit 0

# Per-package isolation
pnpm --filter @g3t/core   test
pnpm --filter @g3t/react  test
pnpm --filter @g3t/charts test
# Each should exit 0. The sum across the three should match the
# full-suite count minus tests in examples/*/src.

# Architectural integrity
pnpm run verify
# Runs: build:packages -> verify:treeshake -> verify:smoke -> verify:bundle
# Each step exits 0 on success.
```

## Manual review gates

These are not yet automated; reviewer confirms each.

- [ ] `CHANGELOG.md` has an entry for the new version
- [ ] Each `packages/<pkg>/package.json` `version` field is bumped
- [ ] Each `packages/<pkg>/package.json` `dependencies` and `peerDependencies`
      ranges still match real usage (the audit's "declared-but-missing"
      and "unused-but-declared" checks pass)
- [ ] `README.md` examples still compile (copy-paste into a fresh
      `npm create vite@latest` project; `pnpm add @g3t/core @g3t/react`;
      paste the example; build)
- [ ] No `workspace:*` ranges leak into published `dependencies`
      (pnpm rewrites these on publish; verify the dry-run output)
- [ ] License headers consistent across all source files (`Apache-2.0`)
- [ ] **LICENSE caveat:** the `LICENSE` file at the repo root was
      created from training-data Apache-2.0 text and may differ from
      the canonical text by whitespace only. Before publishing,
      replace with `curl https://www.apache.org/licenses/LICENSE-2.0.txt
    > LICENSE` and verify `sha256sum` matches the canonical hash.

## Manual browser smoke (post-bugfix rounds)

Bugfixes 8-21 were applied based on browser feedback but not all of
them can be verified in jsdom-based unit tests. Before publish, run
`pnpm dev` and confirm in a real browser:

- [ ] Right-click on a canvas node opens the custom context menu and
      does NOT also show the browser's native context menu (bugfix 16)
- [ ] Context menu items actually work: Pin Node locks position,
      Hide Node removes from view, View Neighbors opens the secondary
      canvas, Focus N-hop zooms (bugfix 17)
- [ ] Scroll-wheel zooms the canvas; the zoom slider tracks (bugfix 14, 19)
- [ ] Edges between distinct nodes draw as straight lines; only
      self-loops, parallel multi-edges, and bidirectional pairs curve
      (bugfix 21)
- [ ] Visual Encoding panel changes (e.g., switching `nodeSizeProperty`)
      visibly change node sizes in the canvas (bugfix 9, 18)
- [ ] Search box: typing highlights matching nodes; clear button (×)
      appears and resets cleanly (bugfix 10)
- [ ] No `Maximum update depth exceeded` errors in console for any
      demo (bugfix 11 was a regression that's now tested but
      "no console errors" is the smoke gate)
- [ ] No "mapping without corresponding data" or "continuous mapper
      non-numeric" warnings spamming the console (bugfix 12)
- [ ] Picking ELK, Dagre, or Hierarchy in the LayoutManager dropdown
      doesn't crash with `No such layout '<name>' found` (bugfix 15);
      these now translate to `breadthfirst`

If any of the above fails, file an issue before publish; don't ship.

## Dry-run publish

```bash
# Pack each package, inspect contents
for pkg in core react charts; do
  pnpm pack --filter @g3t/$pkg
done
# Output: <pkg>-<version>.tgz files in repo root.
# tar -tvzf each one and confirm:
#   - dist/index.{mjs,cjs,d.ts} present
#   - dist/<subpath>/index.d.ts files for every subpath in exports map
#   - package.json has correct `version`, `exports`, `dependencies`,
#     `peerDependencies` (NO `workspace:*`), and `sideEffects`
#   - NO `src/`, `*.test.ts`, `*.stories.tsx`, `tsconfig.tsbuildinfo`
#     in the tarball
```

What the audit looked for and what should still hold:

- `@g3t/core` tarball contains zero React, Cytoscape, ECharts, or Zustand
  imports (run `grep -l 'react\|cytoscape\|echarts\|zustand' dist/*.mjs`
  after extracting — should return nothing in core)
- `@g3t/react` tarball contains zero `@g3t/charts` imports in production
  source code (storybook stories may legitimately demonstrate it)
- The dist files for `@g3t/react` and `@g3t/charts` resolve when imported
  from a plain Node script with no bundler (the smoke test verifies)
- Subpath exports work as documented: `@g3t/core/adapters`,
  `@g3t/core/layout`, ... all yield the expected named exports

## Publish

```bash
# Order: core first (others depend on it via peerDependencies)
pnpm --filter @g3t/core publish --access public
pnpm --filter @g3t/react publish --access public
pnpm --filter @g3t/charts publish --access public

# pnpm rewrites workspace:* to the actual version on publish.
# Verify the published packages match what was packed.
```

## Post-publish verification

```bash
# In a fresh scratch directory:
mkdir /tmp/g3t-postpublish && cd /tmp/g3t-postpublish
pnpm init -y
pnpm add @g3t/core @g3t/react @g3t/charts

# Subpath imports work from the published artifact:
node --input-type=module -e "
  const c = await import('@g3t/core');
  const r = await import('@g3t/react');
  const ch = await import('@g3t/charts');
  console.log('core:',   typeof c.UGM);
  console.log('react:',  typeof r.CytoscapeCanvas);
  console.log('charts:', typeof ch.LinkedChart);
  console.log('subpath:', typeof (await import('@g3t/core/layout')).ForceLayout);
"
# Expect all four to print 'function'.
```

## Rollback

If post-publish verification fails:

```bash
# Within 72 hours of publish, npm allows unpublish:
npm unpublish @g3t/charts@<bad-version>
npm unpublish @g3t/react@<bad-version>
npm unpublish @g3t/core@<bad-version>

# After 72 hours: deprecate instead.
npm deprecate @g3t/<pkg>@<bad-version> "Released with known issues; use <next>"
```

Then file an incident note in `planning/incidents/`.
