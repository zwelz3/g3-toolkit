---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 09: widget independence -- charts, timeline, table, demo RDF (Tier 3b)

Companion to 08; removes the remaining shipped runtime deps. Same
rules: clean-room, parity by our own tests, dep deleted when its own
parity gates pass (see staged deletion policy below), bundle ledger
records each deletion's shrink.

**Note on part_of IRI:** All nine briefs in this orchestration series
share the same `part_of` IRI (`orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324`).
That IRI is the parent orchestration plan under which widget
independence is one workstream -- not a copy-paste artifact. Verified:
every brief in `planning/orchestrate-routing-independence/` carries
the same IRI.

## Prerequisite: Brief 08 display-list API must be stable before W1 starts

W1 builds on the display-list foundation Brief 08 defines
(`canvas2d/display-list.ts` + `canvas-adapter.tsx`,
`buildDisplayList`). W1 does not dispatch until Brief 08 is merged
and its `buildDisplayList` API is stable (no open interface changes
pending). This is a hard prerequisite, not a soft ordering preference.
If Brief 08 is still in-flight when W1 would otherwise start, W1 is
blocked until the merge lands.

**Enforcement:** The W1 worker brief declares `depends_on: brief-08-merged`
in its YAML frontmatter. The weaverd dispatch pipeline reads this field
and blocks W1 submission until Brief 08's completion is recorded in the
kb:Activity log. An executor must not manually submit W1 before the
dependency is satisfied; the orchestrator will reject the submission.

## Staged deletion policy (per-widget independent merges)

Each widget's dep deletion is independent. A failing parity gate for
W1 does not block dep deletion for W2, W3, or W4. The PR structure is
per-widget: each widget ships as its own sub-PR so that any passing
widget's dep can be merged independently without waiting on any other
widget's status.

No dispatch sequence is imposed across widgets. The ordering
W3/W4 -> W2 -> W5 -> W1 reflects ascending implementation complexity
and is advisory guidance on which widgets to tackle first -- not a
mandatory constraint on reviewers or the merge queue. Reviewers must
not hold any widget's PR pending another widget's status.

**Rollback:** If a widget's parity gate fails permanently, the widget's
sub-PR is closed without merging. The old dep remains in package.json
until a revised implementation brief is dispatched and passes its
gates. No partial revert of a dep deletion is required because each
widget's PR includes both the new clean-room implementation and the dep
deletion in the same merge unit -- the merge queue never sees a state
where the dep is absent but the replacement is incomplete.

## S1 surface audit gate (applies to W1 Sankey and each widget)

The S1-style surface audit for each widget is a prerequisite gate, not
deferred documentation. The audit enumerates the exact API surface the
widget uses before any implementation work is dispatched. The audit
artifact is committed to a file in
`planning/orchestrate-routing-independence/` (e.g.,
`09-w1-sankey-surface-audit.md`) before the W1 implementation worker
is submitted. The audit commit SHA is cited in the W1 PR description.
The PR review checklist requires the audit artifact to exist and be
visible before any implementation review begins. Coding cannot start
until the audit artifact is committed.

## W1 echarts (+ echarts-for-react) -- @g3t/charts and react views

Used by: LinkedChart (bar, scatter, line, pie, parallel),
StatsPanel (histogram), SankeyView.

**Prerequisite:** Brief 08 merged and `buildDisplayList` API stable
(see above and the enforcement rule in the prerequisite section).

- Native chart renderer on the display-list foundation Brief 08
  defines (`buildDisplayList` + canvas adapter): axes, scales, and the
  seven plot primitives we actually use.
- **Parity gate:** linked-selection and brush behavioral contracts are
  the parity criteria. Before rewriting any assertion, the executor
  captures the existing echarts behavioral baseline by adding a
  temporary instrumentation pass to the relevant test that logs echarts
  selection events or canvas call sequences to a JSON fixture. The
  fixture is committed alongside the rewritten assertions so reviewers
  can verify behavioral equivalence against the recorded baseline --
  not against the executor's judgment alone. The m7 and m11 test suites
  plus SankeyView tests must assert the same observable behaviors
  (selection propagation, brush range, data binding) as the echarts
  baseline. Assertions that tested echarts-specific DOM or canvas
  internals are rewritten to assert the equivalent behavior via
  display-list ops -- the contract is the behavior, not the
  implementation path. Tests that assert echarts DOM structure with no
  behavioral equivalent are replaced with display-list op assertions of
  equivalent scope. Any test removal requires a written justification
  in the PR.
- Sankey layout is clean-room: standard layered band placement
  (Sugiyama-family column ordering). `assignLayers` and `orderLayers`
  are reused for column ordering. Grep-verified: both are exported
  functions in `packages/core/src/layout/g3t-engine/g3t-layered.ts`
  (`assignLayers` at line 194, `orderLayers` at line 270). Bandwidth-
  proportional lane widths are a separate implementation responsibility
  scoped to this brief; the S1 audit (see the surface audit gate
  section above) enumerates the exact lane-width API surface before
  coding starts.
- Delete echarts + echarts-for-react from charts/react/root after W1
  parity gates pass.

## W2 vis-timeline + vis-data -- TimelineView

Already OPTIONAL peers with a vendor-css shim (vendor-css.test.ts).
Native lane-based timeline: time scale, item lanes, zoom/pan sharing
the cameraController idiom, range brush integrating the existing
TemporalRangeFilter/TemporalSlider. Parity gate: timeline view tests +
temporal e2e behavior. Delete the optional peers and the css shim
(no-legacy) when W2 parity gates pass independently of W1 status.

**Verified scope:** `vis-data` is imported exclusively in
`packages/react/src/views/timeline/TimelineView.tsx:14`
(`import { DataSet } from "vis-data/standalone"`). No other file in
the workspace imports it. W2's deletion scope is confirmed bounded to
TimelineView; no other component breaks when vis-data is removed.

## W3 @tanstack/react-table -- TableView

TableView needs column defs, sorting, filtering, and density -- a
bounded headless-table core (sort comparators, filter predicates,
column sizing state in a zustand store like every other control).
Parity gates: table.test, table-density.test, accessibility
(table-as-fallback, R7.11 posture) unchanged. Delete the dep when W3
parity gates pass independently.

## W4 fuse.js -- SearchBar (moved here from 07/W7, unchanged scope)

Brief 07 explicitly deferred W7 (fuse.js/SearchBar) to this brief
with no implementation started. Brief 09 inherits a clean slate for
W4 -- there is no intermediate partial state to resolve.

Clean-room scored subsequence/trigram matcher to replace Fuse.js
(`packages/react/src/interaction/search/SearchBar.tsx:10`). SearchBar
ranking tests gate. Delete the dep when W4 parity gates pass
independently.

## W5 n3 + jsonld -- demo app only (src/demo/ontology/import.ts)

**Verified scope:** n3 and jsonld are used exclusively in
`src/demo/ontology/import.ts` via dynamic import (`await import("n3")`
at line 60; `await import("jsonld")` at line 92). No static or dynamic
import of either package exists in any file outside `src/demo/`. Both
packages appear only in the root `package.json`, which is the private
demo app. No library package (`packages/core`, `packages/react`,
`packages/charts`) depends on either. Library consumers cannot be
broken by their removal.

**Selected path: option (a) -- clean-room minimal Turtle + JSON-LD
subset reader.** Rationale: option (b) adds a Vite plugin, a build-time
precompile step, and a hash-divergence CI failure mode whose escalation
path and regeneration trigger would require a separate design step;
option (a)'s scope is bounded by the demo fixtures' vocabulary, which
the W5 surface audit enumerates before coding starts. If the surface
audit reveals the fixture vocabulary exceeds 200 terms or requires
language features outside the W3C Turtle/JSON-LD core profiles, the
executor logs a kb:Decision selecting option (b) and updates this brief
before proceeding -- that choice cannot be made silently at execution
time. Either way n3/jsonld leave package.json.

## Explicit non-goals

- A general-purpose charting/table/timeline library: we implement
  exactly the surface our views use. The S1-style surface audit runs
  per widget before coding starts and its artifact is committed to
  `planning/orchestrate-routing-independence/` as a gate (see the
  surface audit gate section above). For Sankey: the audit enumerates
  the exact lane-width and column-ordering API before any layout code
  is written. Column ordering reuses `assignLayers`/`orderLayers` (both
  verified exported at the lines cited in the W1 section);
  bandwidth-proportional widths are net-new and explicitly scoped.
- React/zustand replacement (see brief 08 "kept platform").

## Verification

- Every replaced widget's existing test file passes, or its assertions
  are rewritten to assert the same behavioral contract via display-list
  ops with a written justification per removed or rewritten test. For
  W1, the pre-migration echarts behavioral fixture (see parity gate
  above) must be committed before any assertion is rewritten.
- e2e shells green; visual acceptance by Zach. If Zach is unavailable,
  a screenshot diff against reference renders serves as the automated
  gate. Reference renders are captured immediately before any migration
  work begins by running `pnpm exec playwright test --update-snapshots`
  targeting the widget's e2e test file; snapshot artifacts are stored in
  `tests/e2e/snapshots/` and committed to the branch in a dedicated
  "capture baseline snapshots" commit before any implementation commit.
- `pnpm run gates`; bundle ledger (`scripts/check-bundle-size.mjs`)
  records each deletion's shrink as a separate ledger entry. The ratchet
  condition applies at widget completion: each widget's sub-PR includes
  both the new clean-room implementation and the old dep deletion, so
  the net bundle delta for the affected package is a shrink (or
  break-even). The ratchet check runs against the post-deletion package
  size after `pnpm run verify` on the complete widget PR; mid-PR states
  where the new implementation is present before deletion are not
  submitted to the ratchet check.
