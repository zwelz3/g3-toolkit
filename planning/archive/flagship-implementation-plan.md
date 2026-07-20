# Flagship demo — implementation plan

Companion to `flagship-narrative.html`. This plans the full build: the
worked-example engine (mostly done), the toolkit enhancements the
cinematic shell needs, the shell itself, and the packaging/repo
decision. Work is priority-ordered, not day-estimated.

The guiding constraint from the narrative: a **polished turnkey story**,
one complete worked example, seams subtle, auto-play with manual
override, full provenance as the spotlight capability. Everything below
serves that.

---

## 0 · Current state (already built and gate-green)

Done, in `examples/flagship/src/`, 9 logic tests passing:

- `corpus.ts` — Northwind Analytics' fictional corporate memory (awards,
  evaluations, people, documents), the concept vocabulary, and the
  MERIDIAN opportunity decomposed into weighted required concepts.
- `pipeline.ts` — the three tier transforms as real functions over the
  UGM: `buildRawGraph`, `projectMeaning` (signed/weighted associations),
  `runRelevanceAnalytic`, `deriveActions`, and `assembleCaptureBrief`,
  with provenance (`tracesTo`) on every derived artifact.
- `pipeline.test.ts` — proves the worked example tells the intended
  story (substantiated fit 68%, cyber gap, marginal effort signs
  negative, awards rank correctly, brief is traceable).

**The single biggest gap vs. the final narrative**: the engine currently
computes ONE strength per concept. The narrative's core thesis is the
**two-strength model** (substantiated vs. claimable, and the exposure
delta). That is the first build item below, because everything visual
depends on it.

---

## 1 · Engine: the two-strength model (highest priority)

The narrative promises substantiated-vs-performative. The pipeline must
compute both. This is pure `@g3t/core`-level logic + data, no UI, fully
testable headlessly — so it lands first and locks the story.

### 1a · Corpus additions

- Add the substantiation signals to `AwardRecord`/`EvaluationRecord`
  already present (evaluation rating is the dominant one) and add the
  **claimable-only** signals: per-person self-asserted concept depth
  (résumé claims without a backing evaluated award), and adjacent-concept
  reach (a concept one hop from a touched concept in a concept-taxonomy).
- Add a lightweight **concept adjacency** (which concepts are "adjacent"
  for claimable reach) — a handful of edges, e.g. sustainment ~ predictive
  logistics, zero-trust ~ cyber-resilience.
- Add **ORCA Systems** as a partner org with prior **co-delivered,
  evaluated** awards in the exposed/gap concepts (cyber resilience,
  sustainment). This is the teaming confidence-boost data. Include the
  co-delivery edges (Northwind + ORCA on a shared past award) so the
  trace in Act III, beat 8 is real, not scripted.

### 1b · Projection → two strengths

- Extend `projectMeaning` so each concept carries `_substantiated` and
  `_claimable` (keep `_strength` as an alias of substantiated for back-
  compat with existing tests, or update the tests).
  - `_substantiated`: award + evaluation(≥ Satisfactory) + documentation
    - traceable delivery, recency-weighted. Marginal efforts still sign
      negative and drag it down.
  - `_claimable`: substantiated PLUS adjacent-concept reach PLUS résumé
    self-assertion PLUS unevaluated/marginal efforts (counted positively
    here, since a proposal would still cite them).
- Emit association traces tagged with which bucket they feed
  (`substantiating` vs `claimable-only`) so the drill-down can show _why_
  an area is exposed (claimable edges with no substantiating edge).

### 1c · Analytic → exposure + states

- `runRelevanceAnalytic` returns, per required concept, both coverages
  and the **exposure delta** (claimable − substantiated), and classifies
  into `discriminator | exposed | gap` per the narrative's table.
- `fitScore` runs on the **substantiated** floor (already the case;
  confirm). Add a `claimableFitScore` for the "what we'd claim" contrast.
- Add `traceTeaming(result)` → for each exposed/gap concept, find partner
  orgs with substantiated co-delivered work in it; return the partner and
  the converting evidence. This powers beat 8.

### 1d · Decision + two-faced brief

- `deriveActions` already fans out; add the teaming action sourced from
  `traceTeaming` (not a generic "team for gap" string — the _named_
  partner with the converting past performance).
- Split `assembleCaptureBrief` into the **internal** face (substantiated
  fit, discriminators, exposed, gap, closeable-by-partner) and the
  **proposal** face (lead citations, discriminator anchors, teaming
  backstop, section-M mapping). Both faces keep `tracesTo`.

### 1e · Tests

- Extend `pipeline.test.ts`: sustainment is `exposed` (high claimable,
  low substantiated); cyber is `gap` (both low); a discriminator has both
  high; `traceTeaming` returns ORCA for the cyber gap with real
  converting evidence; the two brief faces are populated and traceable;
  `claimableFitScore > fitScore` (the overclaim is visible).

**Exit criteria for section 1**: the narrative's Act II table and the
two-faced brief are reproducible from the engine alone, proven by tests,
before any pixel is drawn.

---

## 2 · Toolkit enhancements the shell needs

The cinematic shell needs capabilities the toolkit doesn't fully expose
yet. Each is a real, reusable `@g3t/react` (or core) addition, not demo-
only scaffolding — which keeps them gate-covered and benefits the
library. Priority-ordered.

### 2a · Camera / viewport control (required)

The act transitions need programmatic camera moves (fit, pan-to-node,
zoom-to-subgraph, smooth animated transitions). `CytoscapeCanvas`
exposes `onReady(cy)`, so the primitive is reachable, but the demo
should not poke Cytoscape directly all over. Add a small, documented
imperative handle or a `camera` prop/controller:

- `focusNodes(ids, opts)` — animate to fit a set with padding.
- `frameAll(opts)`, `resetView()`.
- ease/duration options.
  Implement as a thin wrapper around `cy.animate`/`cy.fit`; ship with
  tests that assert the calls (jsdom can't render, but can spy on the cy
  mock, consistent with existing canvas tests).

### 2b · Animated graph/encoding transitions (required)

Act I→II is a _graph swap_ (record graph → meaning graph) and a re-
encode, and it must read as a transformation, not a hard cut. Options,
cheapest first:

- Cross-fade two `CytoscapeCanvas` layers (pure shell-side; no toolkit
  change) — likely sufficient for v1.
- If smoother morphing is wanted, add an encoding-transition helper that
  interpolates node color/size between two `EncodingSpec`s over time.
  This is a genuinely reusable `@g3t/react` capability (animated
  encoding changes) and worth doing if the cross-fade looks cheap.
  Decision gate: build the cross-fade first, evaluate visually, only build
  the interpolation helper if needed.

### 2c · Two-bar "coverage" visualization (required)

The substantiated-vs-claimable bars (Act II, beat 5) are the signature
visual. `@g3t/charts` (LinkedChart/ECharts) can do grouped/overlaid bars,
but a bespoke, animated "coverage meter" component (two concentric or
stacked bars per concept, the ghost claimable behind the solid
substantiated, the exposure delta highlighted) will land far harder.

- Build as a small reusable `@g3t/react` component
  (`CoverageMeter` / `ExposureBar`) — concept label, two values, state
  color, animated fill. Reusable beyond the demo (any
  target-vs-actual). Gate-covered.

### 2d · Provenance drill-down panel (required — the spotlight)

The drill-anywhere trace (action → analytic → concept → award →
evaluation) is _the_ capability the demo sells. There's an inspector and
a neighborhood view, but not a purpose-built **provenance trace** panel
that walks `tracesTo` chains across tiers and renders the path with the
raw evidence at the leaf.

- Build a `ProvenanceTrace` component: given a node/action id and the
  graph(s), render the ordered chain to its raw evidence, each hop
  clickable, the leaf showing the award + evaluation (or the _absence_
  for an exposed concept). Reusable for any provenance-bearing graph.
- This is the highest-value toolkit addition; give it real polish and
  tests.

### 2e · Branded theme + raster/logo icons (required, low risk)

`createTheme` and the icon channel (with the `isImageRef` raster
passthrough already shipped) cover this. The demo defines a Northwind
theme (custom palette, fonts) and a logo/iconography. No new toolkit
capability — just exercise the existing ones. Confirms the "this becomes
_our_ product" beat.

### 2f · Narrative/step controller (demo-side, not toolkit)

Auto-play with manual override (play/pause, next/prev, scrub, replay) is
demo harness, not a library concern. Build it in the example. Keep it
data-driven: an array of beats, each beat a `{ narration, op, camera,
encoding, highlight }` descriptor the runner executes. This makes the
acts declarative and easy to retune.

---

## 3 · The cinematic shell (after 1 and 2)

Built in the example, composing the real toolkit components. Structure:

- `branding.ts` — Northwind theme + logo + icon set.
- `beats.ts` — the declarative act/beat script (drives auto-play).
- `FlagshipDemo.tsx` — the narrative shell: stage (canvas layers),
  narration overlay, transport controls, the coverage panel, the
  provenance panel, the two-faced brief. Orchestrates the beat runner,
  camera, and graph/encoding swaps.
- Sub-components: `StageCanvas` (layered canvases + camera),
  `NarrationBar`, `Transport`, `CoveragePanel` (uses `CoverageMeter`),
  `BriefPanel` (two faces), wiring to `ProvenanceTrace`.

Build order within the shell (each independently viewable):

1. Static three-tier stage: render raw graph, meaning graph, branded.
2. The coverage panel from real analytic output.
3. The two-faced brief from real `assembleCaptureBrief`.
4. The provenance drill-down wired to `tracesTo`.
5. The beat runner + transport (auto-play/manual) tying it together.
6. Camera moves and the Act I→II transition polish.
7. Motion/easing/visual-polish pass.

Caution carried throughout: the build can verify compile/test, but the
_rendered_ cinematics (timing, easing, legibility of the transformation,
whether the two bars read instantly) can only be judged live — so steps
6–7 will need a visual review pass with you, and the beat script is
deliberately data-driven so retuning is cheap.

---

## 4 · Packaging / repo decision

You're open to a separate repo or an optional bundled package. Analysis:

### The tension

The four scenario shells and the two capability dashboards live _inside_
the toolkit repo and depend only on `@g3t/{core,react,charts}` via
workspace paths. The flagship wants heavier, demonstrative dependencies
(richer animation/easing, maybe a layout/physics lib, branded fonts,
possibly a PDF generator for the exported brief) that you do NOT want
polluting the toolkit's own dependency graph or bundle budgets.

### Options

1. **In-repo example (status quo)** — simplest, but drags demo-only deps
   into the workspace and tempts bundle/lint scope creep. Fine for the
   engine; awkward for the cinematic deps.
2. **Optional bundled package in-repo** (`examples/flagship` as its own
   package with its OWN `package.json` deps, excluded from the root
   lint/verify/bundle gates) — keeps it co-located and using live source
   via workspace paths, while quarantining its dependencies and build.
   The engine (`corpus`/`pipeline`/tests) stays gate-covered; the shell's
   heavy deps don't touch the toolkit's budgets. **Recommended.**
3. **Separate repo** — maximal isolation, consumes the toolkit as
   published packages (or a git/workspace link). Best if the flagship
   becomes a living sales asset with its own release cadence, branding,
   and deploy target. Costs: dependency-sync friction, can't use live
   in-repo source as easily, duplicate CI.

### Recommendation

Stage it: **build now as option 2** (optional in-repo package, deps
quarantined, engine gate-covered, shell excluded from root bundle/lint
gates). If/when the flagship becomes a externally-hosted sales site with
its own cadence, **promote to option 3** (separate repo) — the code is
already package-shaped, so the lift is moving it and swapping workspace
paths for published deps.

Concretely for option 2:

- Give `examples/flagship` its own `package.json` with the demonstrative
  deps; keep `@g3t/*` as `workspace:*`.
- Exclude `examples/flagship/**` from the root `lint`/`verify`/bundle-
  budget scripts (the engine still gets typecheck + its own vitest).
- A dedicated `flagship` build script (Vite) producing a standalone
  bundle that can be hosted, screen-shared, or embedded.
- Document the promote-to-separate-repo path in the example README so it
  isn't a surprise later.

---

## 5 · Build sequence (the actual order of work)

1. **Engine two-strength model** (§1) — corpus + ORCA, projection,
   analytic, teaming trace, two-faced brief, tests. Locks the story.
2. **Packaging skeleton** (§4 option 2) — flagship as quarantined
   package, gates wired, standalone build stands up "hello flagship".
3. **Toolkit enhancements** (§2), in this order: `CoverageMeter` →
   `ProvenanceTrace` → camera handle → (cross-fade transition; encoding
   interpolation only if needed). Each lands in `@g3t/react` with tests.
4. **Branded theme + icons** (§2e).
5. **Shell, build order 1→7** (§3).
6. **Visual review pass** with you (timing/easing/legibility) — retune
   the data-driven beat script.
7. **Brief export** (PDF or print-styled HTML of the two-faced brief).
8. Full gate sweep on the engine + toolkit additions; flagship shell
   verified by its own build/test; bookkeeping; package.

---

## 6 · Risks &amp; honesty checkpoints

- **The cinematics can't be self-verified.** Compile/test pass tells us
  nothing about whether the transformation _reads_. Mitigate with the
  data-driven beat script (cheap retuning) and explicit visual-review
  gates at §5.6.
- **Over-claiming the algorithm.** The plan keeps the projection/analytic
  as illustrative stand-ins, signposted as pluggable, with provenance as
  the real (non-mocked) capability. Hold this line in copy and UI.
- **Scope creep into "platform demo".** The narrative chose turnkey-with-
  subtle-seams. Resist surfacing every pluggable point; one complete run,
  access panels just visible.
- **Bundle/gate pollution.** Quarantine the shell's heavy deps (§4);
  keep the engine gate-covered so the valuable logic stays honest.
- **Two-gap nuance pacing.** The exposed-vs-gap distinction is the
  intellectual core but needs room; if a beat feels heavy in review,
  collapse to the distinction shown on one concept and mention the
  other.
