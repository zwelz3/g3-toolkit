# Flagship build: acceptance-test ledger

Purpose: the flagship work (rounds 50+) is being built in a sandbox that
cannot run pnpm, the full workspace, a browser, or the repo gate sweep.
Everything below was built and verified as far as the sandbox allows; this
ledger tracks what still needs YOUR verification on the full toolchain, so
a single acceptance pass can clear it. Tick the boxes as you go.

Nothing here touches package PUBLIC behavior beyond the additive
components and the isolated `examples/flagship` engine, so a clean sweep
is the expectation, not a hope; the items below are where that
expectation has not been machine-confirmed.

---

## A. One gate sweep clears most of it

After overlaying the changed/new files onto a real checkout, run the
repo's standard sweep. Exact JS commands (from package.json):

```
pnpm install
pnpm run typecheck            # tsc --noEmit (whole workspace)
pnpm run lint                 # eslint + prettier --check (all src trees)
pnpm test                     # vitest run (full aggregate suite)
pnpm run verify               # build:packages, exports, treeshake, smoke,
                              # types, snippets, docs:check, bundle
```
Plus your standard python gate set (Jena riot/arq/shacl, pyshacl, ROBOT)
per the round-49 convention; the flagship changes do not touch RDF/SHACL
paths, so these are expected untouched, but run them to confirm.

- [ ] `typecheck` clean for the whole workspace (sandbox only checked the
      changed files in isolation; see notes per round).
- [ ] `lint` clean (eslint + prettier). NONE of the new code was run
      through eslint or prettier in the sandbox. Most likely nits:
      prettier line-wrap/quote normalization and import ordering. Run
      `pnpm run lint:fix` first if you just want it formatted.
- [ ] `pnpm test` green, including the new tests once they run under the
      real config (sandbox ran them under a standalone harness, not the
      repo's vitest config / setup file).
- [ ] `pnpm run verify` green EXCEPT the bundle step until item B is done.
- [ ] python gates green (expected untouched).

## B. Bundle-size budget (the one near-certain action)

The `@g3t/react` budget was at roughly 302.4 of 304.0 KB (about 1.6 KB
headroom). Two new components (CoverageMeter, ProvenanceTrace) almost
certainly exceed that. The sandbox cannot build the package, so the delta
is unmeasured.

- [ ] Run `pnpm run verify:bundle`; read the actual react size.
- [ ] Bump `react` in `scripts/check-bundle-size.mjs` to the measured
      size (rounded up to the next whole KB per the ledger convention),
      with a dated ledger comment naming the two components.
- [ ] Confirm `@g3t/core` budget unaffected (no core source changed;
      the only core-adjacent edit is type-only and erases to zero bytes).

## C. Visual sign-off (open in a browser; sandbox has none)

Each VA page is self-contained (React inlined, no external refs) and
renders the REAL component from the REAL engine output, not a mock.

- [ ] `coverage-meter.html` (§2c): the MERIDIAN coverage table. Check the
      solid/ghost read, the hatched exposure band on Sustainment, the
      state colors (green/amber/red), spacing, and the 68 vs 94 headline.
- [ ] `provenance-trace.html` (§2d): pick each drill target; confirm a
      discriminator bottoms out in its evaluation leaf (HELIOS ->
      Exceptional), the exposure and gap bottom out in an absence leaf,
      and the teaming action reaches ORCA + the TIDEGUARD joint evidence.
      Click hops to confirm highlight.

## D. Decisions needing your sign-off (not defects, choices)

- [ ] Packaging (plan §4): the plan sequences "flagship as a quarantined
      optional package" BEFORE the toolkit enhancements. I built §2c/§2d
      first because they are verifiable and high-signal. Decide whether to
      do the §4 packaging skeleton now or after the remaining components.
- [ ] Component placement: CoverageMeter and ProvenanceTrace live in
      `@g3t/react` (`views/coverage`, `views/provenance`) per the plan's
      "real, reusable, gate-covered" intent. Confirm that is where you
      want them (vs demo-side in `examples/flagship`), since it is what
      drives the budget bump in B.
- [ ] Shell stage architecture: confirm the `renderStage` SLOT (the
      shell does not hard-depend on CytoscapeCanvas) is the shape you
      want, vs the shell importing the canvas directly.
- [ ] The dagre layout verdict remains the separate standing
      architectural decision, untouched by this work.

---

## Per-round detail

### Round 50: two-strength engine (§1)
Files: `examples/flagship/src/{corpus,pipeline,pipeline.test}.ts`,
`README.md`, `CHANGELOG.md`, `planning/visual-acceptance-1.md`.
Verified in sandbox: engine logic on the real `@g3t/core` UGM + vitest
(18/18); `tsc --noEmit` strict + noUncheckedIndexedAccess on the engine
files (clean); zero em-dashes; no source non-null assertions.
- [ ] Covered by the A sweep (no extra action beyond A).

### Round 51: CoverageMeter (§2c)
Files: `packages/react/src/views/coverage/{CoverageMeter.tsx,
CoverageMeter.test.tsx,index.ts}`, `packages/react/src/index.ts` (+1
export line), docs, `scripts/coverage-va/`.
Verified in sandbox: 10 render tests on jsdom with real
@testing-library/react; `tsc` strict + react-jsx on the component +
test (clean); VA page bundles + self-checks; zero em-dashes; no source
non-null assertions.
- [ ] A sweep. - [ ] B budget. - [ ] C: coverage-meter.html.

### Round 52: ProvenanceTrace (§2d)
Files: `packages/react/src/views/provenance/{ProvenanceTrace.tsx,
ProvenanceTrace.test.tsx,index.ts}`, `packages/react/src/index.ts` (+1
export line), `examples/flagship/src/{provenance.ts,provenance.test.ts}`,
docs, `scripts/provenance-va/`.
Verified in sandbox: 7 component render tests (jsdom) + 8 builder tests
against the real engine (the walker's tree-flattening, cycle and size
guards, and the concrete discriminator/exposure/gap/teaming traces);
`tsc` strict on the component, the adapter, and the generic walker
(clean, three configs); VA page bundles + self-checks; zero em-dashes;
no source non-null assertions.
- [ ] A sweep. - [ ] B budget. - [ ] C: provenance-trace.html.
- [ ] Confirm the provenance WALK belonging to the example (not the
      toolkit) is the split you want: the `ProvenanceTrace` component is
      reusable; the meaning of a `tracesTo` id is the adopter's, so the
      walk (`examples/flagship/src/provenance.ts`) lives demo-side. The
      generic `buildProvenanceChain` helper also lives there; promote it
      into `@g3t/core` later if other examples need it.

### Round 53: camera controller (§2a)
Files: `packages/react/src/interaction/camera/{cameraController.ts,
cameraController.test.ts,index.ts}`, `packages/react/src/index.ts` (+1
export line), docs.
Verified in sandbox: 12 tests (spied cy mock, the method the plan
prescribes for 2a); `tsc` strict with the real cytoscape types (clean);
zero em-dashes; no source non-null assertions.
- [ ] A sweep. - [ ] B budget (now three components; size them together).
- [ ] No VA page by design (contract is the animate/fit/center calls,
      covered by the spy tests); exercise visually inside the §3 shell.

### Round 54: narrative beat-runner (§2f)
Files: `examples/flagship/src/{narrative.ts,narrative.test.ts}`, docs.
Verified in sandbox: 10 tests (the pure transport reducer + a data-
integrity check that every beat id resolves against the engine corpus);
`tsc` strict (clean); zero em-dashes; no source non-null assertions. Pure
data + logic: no React/Cytoscape/toolkit dependency.
- [ ] A sweep (no B budget: nothing added to package bundles; no C page,
      it is a state machine whose visual is the shell).

### Round 55: cinematic shell, composition + panels + transport (§3, started)
Files: `examples/flagship/src/shell/*` (NarrationBar, Transport,
CoveragePanel, BriefPanel, ProvenancePanel, FlagshipShell, index),
`scripts/shell-va/`, docs.
Verified in sandbox: 9 jsdom tests (panel gating, transport, stage-slot
beat props, drill wiring); `tsc` strict across the shell config (clean);
VA page bundles + self-checks; zero em-dashes; no source non-null
assertions.
- [ ] A sweep (the shell is example code; it does not change package
      bundles, so no separate B item beyond the §51-53 component bump).
- [ ] C (NEW): `flagship-shell.html` (§3) - the real shell with an SVG
      stage stand-in. Accept the flow: auto-play, transport (pause/step/
      scrub), the coverage panel from the analytic beat, the two-faced
      brief on the last beat, and drilling a coverage row or brief line
      into the provenance panel.

### Round 56: Option 1 redesign + stage encoding (§2g)
Plan: `planning/flagship-plan-option1-redesign.md` (supersedes §2-3,
composition-first). Files: `examples/flagship/src/{encoding.ts,
encoding.test.ts}`, slim harness barrels, docs.
Verified in sandbox: 9 tests running the TOOLKIT's applyEncodingSpec
against the real meaning UGM (the proof the toolkit owns the stage's
visual logic); `tsc` strict across the encoding chain (clean); zero
em-dashes; no source non-null assertions.
- [ ] A sweep (encoding.ts is example data + one annotate function; the
      specs are validated by parse/serialize in-test). No package source
      changed, so no B item.

### Round 57: per-beat toolkit credits
Files: `examples/flagship/src/{toolkit-credits.ts,toolkit-credits.test.ts}`,
`examples/flagship/src/shell/ToolkitCredits.tsx(+test)`, `narrative.ts`
(Beat.toolkit), docs.
Verified in sandbox: 23 grounding tests (every credited surface is a real
export of its package; beats reference the registry; breadth >=10
surfaces); the shell renders the per-beat credit; `tsc` strict clean across
all five configs; zero em-dashes; no source non-null assertions. No
package source changed.
- [x] Credits are grounded against real exports (anti-drift). No A/B item.

- [ ] C (mobile): `flagship-storyboard.html` (round 64) - the real shell +
      real encoding-colored stage, self-contained and mobile-friendly.
      Review the narrative flow, the per-beat toolkit credits, the
      raw->meaning recolor, the coverage/inspector/provenance/brief panels.

- [x] Packaging (round 65): examples/flagship/{package.json,tsconfig.json}
      + INTEGRATION.md. Deps quarantined and manifest verified complete.
- [ ] Bundle (in-repo only): run pnpm verify:bundle; react budget 304 KB,
      ~165 KB measured, three small new components very likely fit. Bump
      only if it fails (template in INTEGRATION.md).

## E. Shell live review

- [~] Interactive epilogue (round 63): epiloguePanels (spec) + EpilogueShell
      (composition) are BUILT; the spec is tested and the shell typechecks
      against transcribed signatures. LIVE REVIEW (the largest, all UI):
      the epilogue renders and SearchBar/FilterBuilder/LayoutSwitcher/
      AlgorithmPanel/NodeStyleEditor/GraphToolbar actually drive the canvas.

- [~] Theme + export + workspace (round 62): NORTHWIND_THEME (createTheme),
      exportBriefSubgraph (exportSubgraph*), and briefWorkspaceSnapshot
      (captureWorkspace/serializeWorkspace) are BUILT and verified against
      the real toolkit functions. LIVE REVIEW: apply the brand theme to the
      canvas, and the export/snapshot download UX.

- [~] Teaming + path (round 61): buildPartnerGraph + teamingNeighborhood
      (real buildNeighborhoodUGM) and evidencePathForConcept (real
      findShortestPath) are BUILT and verified against the real toolkit
      functions. LIVE REVIEW: render the pulled-in partner neighborhood and
      the path overlay ON the canvas.

- [~] LinkedChart (round 59): the coverage pipeline + CoverageChart are
      BUILT and verified (pipeline data + selection mapping tested; typed
      against the real DataPipeline/ScatterData). LIVE REVIEW: confirm the
      scatter renders in ECharts and a point click selects the concept on
      the canvas.
- [x] DetailInspector for node drill (round 60): wired AND render-verified
      headlessly (React-only view). Build step 3 complete; only
      LinkedChart's ECharts render remains a step-3 live item. (cannot be judged without a browser + full stack)

The plan flags these as live-only. They are NOT built/verified yet; they
are the next shell increment and need your toolchain and eyes.

- [~] Stage wiring (round 58): `StageCanvas` + the pure stage director +
      `applyCameraDirective` are BUILT and verified (director/camera tested;
      StageCanvas typechecks against real camera/encoding types). LIVE
      REVIEW still needed: drop StageCanvas into the browser build and
      confirm the graph renders, the spec produces the intended
      colors/sizes ON the canvas, the raw->meaning swap restyles WITHOUT
      relayout (nodes do not move), and the per-beat camera moves read well.
- [ ] Act I to II graph-swap cross-fade (§2b v1, shell-side); decide
      whether the cross-fade is enough or the encoding-interpolation
      helper is worth building.
- [ ] Branded Northwind theme + icons (§2e) via `createTheme` and the icon
      channel.
- [ ] Motion/easing/legibility pass (§3 step 7): timing, and whether the
      two bars read instantly. Retune the data-driven beats as needed.

---

## Still ahead (not yet built; no acceptance needed yet)
Animated transitions (§2b, shell-side cross-fade first), branded theme
(§2e), the beat-runner's React wiring (timer + canvas mapping),
the shell's real-stage increment (CytoscapeCanvas + camera + cross-fade
+ branded theme; see section E), brief export (§5.7), and the §4
packaging.
