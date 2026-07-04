# Agent onboarding — g3-toolkit flagship demo

You are picking up an in-progress effort to build a **cinematic flagship
demonstration** of the g3 graph-visualization toolkit. This file gets
you oriented fast. Read it fully before touching code.

> **Heads-up (2026-06-21):** active work has since broadened beyond the
> flagship. The current threads are structural-view rendering (layout
> stability, port-based edge attachment, obstacle-aware routing) and the
> Storybook atomic-design reshape. Start with `STATUS.md` (CURRENT FOCUS
> 2026-06-21) and `CLAUDE.md` (Open threads) for the live state and the
> immediate next step; this file remains the flagship-specific onboarding.

---

## 1 · What the project is

g3-toolkit is a composable graph-visualization **component library**
(not an app framework), feature-stable at v1.0.0-rc.2. Three packages:
`@g3t/core` (zero React: data model, adapters, projection pipeline,
algorithms, SHACL, theming), `@g3t/react` (views + interaction
controls), `@g3t/charts` (ECharts-backed linked charts).

The **current effort** is not library features — it is a flagship demo
that sells the toolkit's value through one complete, polished story:
turning a fictional firm's scattered corporate memory into a
business-meaning graph that separates **provable** past performance from
**performative** (claimable-only) past performance, so a bid/no-bid
decision runs on what is defensible. The buyer is capture/business-
development for engineering-services firms (domain-neutral enough for
MBSE / logistics / cyber audiences, not DoD-specific).

## 2 · Read these, in this order

1. **`planning/flagship-narrative.html`** — the full story design. The
   protagonist (Dr. Mara Reyes, Chief Solutions Architect, Northwind
   Analytics), the trigger (the MERIDIAN solicitation, 2-day fuse,
   10-page limit), the **two-strength meaning model** (substantiated vs.
   claimable, exposure delta, the Discriminator/Exposed/Gap states), the
   three acts beat by beat, the two-faced capture brief, and where the
   "wow" lives. This is the spec for what the demo must feel like.
2. **`planning/flagship-plan-option1-redesign.md`** — the build plan in
   force (it supersedes the implementation-plan's build sequence). The
   composition-first thesis: the toolkit is load-bearing across the
   story. `planning/flagship-implementation-plan.md` remains useful for
   the engine/enhancement detail.
3. **`examples/flagship/README.md`** — the build-state table and the
   honesty line to hold in code and copy.
4. **`planning/rdf-lpg-virtualization-audit.md`** — what the toolkit's
   data-paradigm surface genuinely supports vs. future gaps. The
   flagship rides only on what is shipped; do not build on a gap.
5. **`CLAUDE.md`** — the standing agent handoff: gates, editing
   discipline, architecture doctrine, and the working agreement with the
   maintainer (Zach). Non-negotiable; read it.

**If you are RESUMING after the browser visual review, do not start
here: go to `planning/flagship-resume.md`.** This onboarding is for
understanding the project; the resume doc is the action entry point
(it reads `examples/flagship/REVIEW-RESULTS.md` and routes from there).

## 3 · What exists right now (verified 2026-06-17)

**Current state: the composition-first build is COMPLETE and PACKAGED.**
Beyond the engine described below, the build has since added the encoding
that drives the stage, the beat sequence, the real stage + camera, the
coverage chart, the inspector, the teaming/path overlays, the brand theme,
the brief export + workspace snapshot, the interactive epilogue, and the
example packaging. All verified headlessly; the only package change was
three shipped `@g3t/react` components (CoverageMeter, ProvenanceTrace, the
camera controller). The authoritative round-by-round detail is
`planning/visual-acceptance-1.md`; the wiring map is
`examples/flagship/INTEGRATION.md`. The engine (the original foundation)
remains as described:

**The flagship ENGINE is built and gate-green** in
`examples/flagship/src/`:
- `corpus.ts` — Northwind Analytics' fictional corporate memory (awards,
  customer evaluations, people, documents), the concept vocabulary, and
  the MERIDIAN opportunity decomposed into weighted required concepts.
- `pipeline.ts` — the three tier transforms as real functions over the
  UGM: `buildRawGraph`, `projectMeaning` (signed/weighted concept
  associations), `runRelevanceAnalytic`, `deriveActions`,
  `assembleCaptureBrief`. Provenance (`tracesTo`) on every derived
  artifact.
- `pipeline.test.ts` — 9 tests proving the worked example tells the
  intended story (substantiated fit 68%, cyber gap, marginal effort
  signs negative, awards rank correctly, brief traceable).

**The cinematic shell does NOT exist yet.** Neither do the toolkit
enhancements it needs, nor the branded theme.

**Critical gap between the engine and the final narrative:** the engine
computes ONE strength per concept; the narrative's core thesis is the
**two-strength model** (substantiated vs. claimable). The narrative was
sharpened *after* the engine was written. So your first task rebuilds
the engine's projection/analytic to carry both strengths and the
exposure delta, plus adds the ORCA Systems teaming-partner data. This is
plan §1. Do it before any UI — it is headlessly testable and locks the
story.

**Demo shells (UNVERIFIED, separate from the verified engine above).** On
2026-06-17 the four dev-server shells (`src/demo/shells/`) got perf and
console-cleanup fixes: type-filtering is now a canvas `hidden` visibility
op (a restyle, not a re-init) with `animate={false}`; the per-frame
Cytoscape mapping-warning floods that stalled the block view were fixed
by scoping `data(_size)` to `node[_size]` and `data(_confidence)` to
`edge[_confidence]`; an inert negative `outline-offset` was removed. All
landed and gate-green, but the rendered behavior is NOT yet confirmed by
Zach (the block-view *freeze*/slow-load fix from the same session IS
confirmed). Full detail and the live-check list live in CLAUDE.md "Open
threads" and STATUS.md "Review state". This is demo/library work,
tangential to the flagship engine that is this section's focus.

## 4 · Repo map (where things live)

- `packages/core/src/` — the React-free core. Key spots:
  `ugm/` (the graph model), `adapter/` (SPARQL/Cypher/Gremlin/REST/
  Holonic), `projection/` (RDF→LPG transforms + pipeline),
  `shacl/` (validation/report), `export/` (Turtle/CSV), `layout/`
  (incremental), `algorithm-adapter/` (result ingest).
- `packages/react/src/` — views (`views/`: canvas, table, tree, matrix,
  map, schema, sankey, query, stats, timeline, inspector) and
  interaction (`interaction/`: toolbar, encoding, filter, algorithms,
  layout-manager). Public barrel: `packages/react/src/index.ts` (uses
  `export * from "./views/<x>"` — grep there to confirm what's exported).
- `packages/charts/src/` — `LinkedChart` (bar/pie/scatter/line).
- `examples/flagship/` — **your work area** (engine done, shell pending).
- `examples/decision-dashboards/` — the two capability dashboards
  (Analytics, Schema) that support the flagship by covering non-scenario
  views.
- `src/demo/` — the dev-server demo (`pnpm run dev`): four scenario
  shells in `src/demo/shells/`, shared pieces in `src/demo/components/`,
  fixtures in `src/demo/fixtures/`.
- `planning/` — design docs and the round log
  (`visual-acceptance-1.md`, authoritative history) plus the flagship
  narrative/plan/audit.
- `roadmap/` — the library roadmap and per-area design records
  (`roadmap/design/`), indexed in `roadmap/CLAUDE.md`.

## 5 · How to verify your work (gates)

Run before claiming anything done. NEVER pipe gate scripts through
`tail`/`head` — it masks exit codes; check `$?` directly.

```
pnpm run test          # whole suite incl. flagship engine (862 green)
pnpm run lint          # packages/ + tests/ ONLY
pnpm run typecheck
pnpm run verify        # build, exports, snippets, typedoc, bundle ledger
python3 scripts/lint_specs.py specs/
python3 scripts/sync_spec_status.py
python3 scripts/check_roadmap_coverage.py
pnpm run visual-acceptance
```

- The root `lint` covers `packages/` and `tests/` only. Lint examples
  and `src/` explicitly: `pnpm exec eslint examples/<dir>/src/` and
  `pnpm exec eslint src/`.
- Flagship engine tests run via the root suite or
  `pnpm -w exec vitest run examples/flagship/src/`. The per-package
  `pnpm --filter ... test` does NOT work (no local vitest config).
- Bundle growth requires a written rationale in
  `scripts/check-bundle-size.mjs` (the ledger). The flagship shell's
  heavy deps should be quarantined out of the root bundle gate (plan
  §4); the engine stays gate-covered.

## 6 · Hard-won editing discipline (from CLAUDE.md — heed it)

- Every programmatic string-replace gets an assert that the anchor
  exists, including boring import edits. Prettier reflows anchors;
  silent no-op replaces have recurred repeatedly.
- `cat >>` to a wrong filename creates an importless orphan test. Verify
  the target exists first.
- View a file immediately before editing; re-view after edits (str_replace
  invalidates prior line numbers).
- core stays React-free. Heavy graph algorithms stay external; the
  toolkit consumes result documents.
- Theme/spec changes are restyle-only — never re-init the canvas;
  positions must hold. Fixture graphs in React are `useMemo`'d.
- Data-mapped style props (`width: data(_size)`, `opacity:
  data(_confidence)`) MUST sit on a `[field]`-scoped selector
  (`node[_size]`, `edge[_confidence]`), never a bare `node`/`edge` rule:
  Cytoscape warns for every element missing the field on EVERY render
  frame, and in the block view (structural elements carry _w/_h/_label,
  not the force-graph fields) that console flood stalled the canvas
  (~1.7s/toggle, diagnosed 2026-06-17). Negative `outline-offset` is
  rejected by Cytoscape (parse-time discard plus one warning); an inset
  ring needs a border, not a negative offset.
- New library capability is exposed through one of three channels only
  (exported zustand store, props/callbacks, or a versioned JSON
  document) and gets a wiring-guide snippet + executable twin in
  `examples/wiring/`. The flagship's toolkit enhancements (CoverageMeter,
  ProvenanceTrace, camera control) are real reusable additions and
  should follow this.

## 7 · The honesty line (non-negotiable in code and copy)

The projection rule and the analytic are **illustrative stand-ins** —
signal they are the adopter's to plug in; never imply a specific
proprietary method is "the answer." What is genuinely the toolkit's, and
what gets the spotlight, is the **composition and provenance**: tiered
transforms that stay traceable end to end. Ship ONE complete worked
example so it reads as a finished machine with just-visible access
panels, not a box of parts. A BD audience that catches a faked algorithm
distrusts everything.

## 8 · Working agreement with the maintainer (Zach)

Analytical tone, no sycophancy. No em-dashes in authored content (use
colons, semicolons, parentheses). No day estimates — priority ordering
only. Correct mistakes plainly without defensiveness. Complete, verified
outputs; run the full gate sweep before landing. Visual changes can only
be self-verified up to compile/test — rendered cinematics (timing,
easing, legibility) need his live review, so keep the beat script
data-driven for cheap retuning and call out explicitly what you could
not verify yourself. Each round: a planning-log entry
(`planning/visual-acceptance-1.md`), a CHANGELOG entry, and a packaged
zip + (for visual work) a page in `/mnt/user-data/outputs`. Root-cause
his review findings; do not patch symptoms.

## 9 · Your first concrete steps

1. Read the four flagship docs (§2) and skim `pipeline.ts` +
   `pipeline.test.ts` so you know the engine you are extending.
2. Execute implementation-plan **§1**: extend the corpus (claimable
   signals, concept adjacency, ORCA partner + co-delivery), rework
   `projectMeaning` to emit `_substantiated` and `_claimable`, extend
   `runRelevanceAnalytic` for the exposure delta and the
   Discriminator/Exposed/Gap states, add `traceTeaming`, split the brief
   into two faces, and extend `pipeline.test.ts` to prove it (sustainment
   exposed, cyber gap, claimable fit > substantiated fit, ORCA surfaced
   with real converting evidence). Verify headlessly.
3. Only then proceed to packaging (§4 skeleton) and the toolkit
   enhancements (§2), then the shell (§3).

Do not start the cinematic shell before the two-strength engine is built
and tested. The story depends on it, and it is the cheapest place to get
the narrative right.
