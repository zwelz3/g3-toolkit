# Merging the hardening arc into the feature arc (2026-08-17)

Status: EXECUTED. Gate-green on Windows (`pnpm run gates`: typecheck,
lint, verify, 1798 tests, spec gates). Rendered output UNREVIEWED; see
"What this round did not do".

`ai-agent-guide` (the PR branch) merged with `fable-updates` (the
target). Both forked from `7f3e07a` on 2026-08-14 and did disjoint
work, so dates across the two arcs are CONCURRENT, not sequential. Any
future reader comparing timestamps between the two sets of CHANGELOG
entries needs that fact first.

- **ai-agent-guide**, ~70 commits, a FEATURE arc: route nudging, the
  long-edge perimeter policy, dummy chains, corridor supply, the
  channel router, dense-scene pseudo-nodes, force-directed edge
  bundling, RDF 1.2 triple-term hyperarcs, holon boundary projection,
  PNG image export, label wrapping, three demo shells, and the
  AI-agent guides.
- **fable-updates**, ~30 commits, a HARDENING arc: ESM-only publishing,
  withdrawal of 15 subpath exports, the frozen `api-surface.json`,
  adapter request hygiene, one versioned-JSON failure convention, a
  uniform store channel, `ViewErrorBoundary`, `TimelineView` on its own
  subpath, whole-tree lint, and eight new gate scripts.

## The governing rule used

Where the branches disagreed about a CONTRACT, theirs won: those are
maintainer rulings with written reasoning that ours never revisited.
Where they disagreed about CONTENT, both were kept. Ten files
conflicted; exactly ONE was a contract disagreement.

## The one contract conflict

`packages/core/src/layout/structural.ts`. Ours added `nudge` beside the
pre-existing `nodePlacement` and `crossingMinimization`; theirs deleted
five options as dead pass-throughs into an `elk.*` string map the g3t
engine does not read.

Theirs was right, and right about ours too. Verified before deciding:
`nudge` is LIVE (read at `g3t-structural.ts:451` and
`g3t-routing.ts:1094`), while `nodePlacement`/`crossingMinimization`
are read NOWHERE under `layout/g3t-engine/`. The `elk.layered.*` writes
that look like reads are a decoy: both sit inside the `options.sketch`
guard and assign the literal `"INTERACTIVE"`. Neither field was ours'
addition; both were at base, and ours only conflicted because `nudge`
landed beside them. The merged BODY had already taken theirs' side, so
keeping the declarations would have shipped three fields of which one
was wired and two no longer even perturbed the memo key.

Resolution: keep `nudge`, drop the other two. A note now sits in the
REMOVED block saying `nudge` is a g3t engine branch and not an `elk.*`
pass-through, so the next audit does not sweep it into the same bucket.

## The defect the conflict markers hid

`packages/core/src/adapter/sparql-adapter.ts` carried a byte-identical
DUPLICATE of the RDF 1.2 `RdfTerm`/`TripleTerm` block. The triple-term
commits landed independently on both branches (`1a9555a`/`97df361`/
`d96546d` here, `c686e55`/`2796af9`/`452f21c` there, same titles,
reaching the target through PR #4), so git merged two copies into a
file that showed as cleanly merged.

The duplicated type alias is a hard `TS2300`. It was invisible because
**syntax errors suppress semantic diagnostics program-wide**: the 15
`TS1185` conflict-marker errors meant `tsc` reported nothing else, so
the pre-resolution typecheck looked like it had only marker noise.

Lesson worth keeping: during a merge, a clean `typecheck` that reports
only `TS1185` is not a clean typecheck. It is no typecheck at all. The
way this was found was to resolve every marker in a scratch copy
OUTSIDE the repo and compile that; two scans then bounded the blast
radius (duplicate top-level exported declarations tree-wide: one file;
duplicate test titles: none in the affected file).

## The real work: gates the feature arc was never measured against

Clearing the markers produced a tree that compiled and still failed the
gate in four places, because the hardening arc added gates that ran
inside `verify` and had never seen the feature arc's surface.

- `verify:surface`. The frozen `api-surface.json` predated every
  feature-arc export. Raw delta was 53 additions across 6 entries and
  ZERO removals. The zero is the load-bearing half: it proves no
  hardening-side withdrawal was lost in a conflict resolution, and it
  is the check to repeat if this merge is ever redone.
- `verify:landing`. `docs/landing.html` is generated from the demo
  sources and still said "Seven surfaces". Regenerated, not hand-edited.
- `verify:snippets`. Four wiring-guide fences did not compile against
  the gate the hardening arc added; THREE were outside any conflict
  region, so a reviewer reading only the conflicts would have missed
  them.
- `verify:bundle` and `verify:consumer-cost`. Covered below.

## Surface ruling

Of the 53 additions, TEN were withdrawn before refreezing, on the
2026-08-15 ruling (named in no adopter document, called by nothing
outside their own module): `assignTracks`, `emitChannelRoute`,
`routeChannelOverflow`, `classifyFallback` (internals of a router
behind an off-by-default flag; their TYPES still ship because they
describe public geometry), `filterPseudoNodes`, `filterPseudoEdges`,
`PSEUDO_FLAG`, `PSEUDO_CONNECTOR_TYPE`, `PSEUDO_TRUNK_TYPE`
(`isPseudoNode` is the one predicate a host needs and stays), and
`inferTerminalSides`. Modules and tests stay in the tree per
archive-don't-delete.

SIX more were undocumented but had real consumers, and were DOCUMENTED
rather than withdrawn (maintainer call): `tripleLabel`, `termLabel`,
`localName`, `STAR_EDGE_TYPE`, `RDF_STATEMENT_FLAG` in the wiring
guide's RDF 1.2 section, and `buildExport` alongside `buildImageExport`
in the export section. Writing the last one caught a real error: the
snippet gate rejected a documented `blob` return because `buildExport`
returns `content: string`. That is the gate paying for itself.

Final: 34 additions, 5 entries, zero removals.

OPEN QUESTION, deliberately not settled here: `localName` is
functionally the `localPart` withdrawn two days earlier (`f7f222d`) for
being generic RDF plumbing. It ships because the two projections need
one shortening rule and a host relabeling their output needs the SAME
rule, and the wiring guide now says so and tells adopters to prefer
their own. If that reasoning does not hold, the withdrawal is the
consistent move.

## Budgets: re-measured, not merged

Both branches raised caps in parallel off ONE baseline, so the numbers
were siblings and not a sequence. The `169` appearing on both sides is
arithmetic coincidence. Neither surviving cap covered the other's code,
so all four were re-measured:

| gate | budget | measured |
| --- | --- | --- |
| publish weight, core | 209 KB | 203.9 |
| publish weight, react | 397 KB | 393.9 |
| consumer cost, `core-layout` | 69 KB | 66.0 |
| consumer cost, `core-all` | 182 KB | 178.9 |

Sourcemap audit run as the 2026-07-03 entry requires: ZERO
`node_modules` source bytes across all 250 sourcemaps in the three
dists, so every byte of growth is first-party.

`core-ugm` HELD at 4.8 KB. That is the check that mattered: none of the
new routing code became reachable from `UGM` alone, so this is a budget
question and not a tree-shaking regression.

The `@g3t/layout` (ARC-009) extraction stays RETIRED, and this round
strengthens the reason rather than weakening it. The feature arc added
roughly 43 KB of routing and layout code, which makes the distinction
between publish weight and adopter cost matter more: `core-all` is a
ceiling nobody pays, and `core-layout` is what someone naming a layout
engine actually gets.

## Two portability bugs found in passing

Neither is merge fallout; both predate it and both would fail on any
commit.

- `scripts/check_roadmap_coverage.py` compared `str(Path)` owner paths
  against a forward-slash index table, so on Windows every pair
  mismatched in both directions: 60 spurious violations. Fixed with
  `.as_posix()`. Linux and CI never saw it.
- `scripts/check-readme-snippets.mjs` matched only ` ```ts ` and
  ` ```tsx `, so a ` ```typescript ` fence was invisible to the gate.
  That is how README's Theming snippet kept importing `useThemeStore`
  from `@g3t/react/state`, which does not export it. Both the regex and
  the snippet are fixed; the gate went from 49 fences to 50.

## Three test timeouts, and why the clock moved rather than the test

`tests/dist/public-api.test.ts` (react entry), the `OKABE_ITO` test in
`cross-package-names.test.ts`, and the JSON-LD test in
`src/demo/ontology/import.test.ts` all crossed vitest's 5000 ms default
on ordinary hardware.

All three are IMPORT-BOUND, not compute-bound: each dynamically imports
a large module for the first time (a source barrel transpiled on the
fly, four react barrels, `jsonld`). The 5000 ms was never a claim about
correctness, and in each case the import cost IS the thing under test,
so shrinking the assertion to fit the clock would have removed the
point. Raised per-test (30 s) and per-suite for the dist config (60 s),
each with the reason written at the site. Still bounded, so a genuine
hang fails.

Not a global raise: slackening 1804 tests to accommodate 3 would mean a
real hang anywhere takes 30 s to surface.

## What this round did not do

- **Zach's visual review.** Nothing in the gate covers rendered output.
  Routing, bundling and the three new shells need one Pages playground
  session; the orthogonal-on-force look is the review target and the
  per-shell `ROUTE_EDGES` constants revert individually.
- **E2E on the merged tree.** Confirmed green on the hardening branch
  in CI 2026-08-16 (PR #2); not re-run here.
- **Audit item 23** (phase 2), still never run.
- **The 14 lint warnings** are 0 errors and pre-existing; the 4
  auto-fixable stale `eslint-disable` directives were cleared, the 6
  `exhaustive-deps` ones were left alone because several sit near the
  canvas camera-stability rules and want a deliberate look, not a batch
  fix.
