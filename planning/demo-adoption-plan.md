# Demo & Examples Enhancement Plan v1

Status: P0 EXECUTED 2026-07-03; P1 EXECUTED 2026-07-04 (P1.1 link resolution awaits push + Pages enablement); P2.1 / P2.4 EXECUTED and P2.2 motion slice EXECUTED 2026-07-04 (deeper keyboard/ARIA audit remains browser-verified follow-up); P2.3 stays deferred on demand. Supersedes the 2026-07-03 draft;
all five draft decision points are resolved below. Destined for
planning/demo-adoption-plan.md at the start of the first execution round.
Prior art: planning/enhancement-plan.md (M10-M13, complete; no overlap),
planning/demo-overhaul-spec.md, planning/pre-publish-checklist.md.

## 1. Objective

Audience: external / OSS adopters (maintainer ruling). The repo is public
today (ruling D5), which converts every truth defect from internal debt
into a live first impression. Two clocks govern priority:

- Time-to-conviction: how fast a stranger concludes the library is
  healthy, maintained, and capable.
- Time-to-first-graph: how fast a stranger renders a graph in THEIR app.

Quality means demos behave correctly and look intentional; reliability
means every demonstrated behavior is gate-enforced so it cannot silently
rot; adoptability means a curated, linked path from README to live demo to
wiring snippet to installed package.

## 2. Resolved decisions (ledger)

- D1 (beat-runner narrative): delete with flagship. No guided-tour
  abstraction is extracted; the pattern is noted in the audit matrix for
  on-demand resurrection.
- D2 (full-workspace): keep as the documented application-shell boundary
  example (README cites it; R1.12 traces to it). Reachability only; no
  feature investment.
- D3 (standalone HTMLs): delete scripts/demo and scripts/thread-demo.
  They were mobile-preview scaffolding; the Pages-deployed playground
  (docs:demo already builds src/demo to docs-out/playground) supersedes
  that use. Audit findings that condition the deletion:
  - Fold obligation (blocking): the projection pipeline
    (ProjectionPipeline, createPresetPipeline, typeCollapse and the other
    collapse steps) is demonstrated ONLY in scripts/thread-demo/
    projection.ts, has zero wiring-guide or wiring-test coverage, and is a
    headline capability in the README package table. The fold lands before
    the deletion in the same round (see P0.3).
  - Acceptable losses: Minimap, NodePropertyInspector, and NodeStyleEditor
    keep Storybook coverage (deployed to Pages); the Protege-style
    ontology viewer's extras over the Bio explorer (individuals tab,
    per-selection SHACL constraints, Wikidata alignment pane) die with
    thread-demo, with an optional enrichment noted at P2.3.
- D4 (screenshot gating): shells only until the baseline-update workflow
  proves low-friction.
- D5 (visibility): GitHub is public now. P1.1 is unblocked; P0.5's
  doc-truth items gain urgency because the defects are publicly visible
  (README advertises an "in-progress cinematic demo"; stale e2e specs).

## 3. Workstreams

Ordering within each priority is the proposed execution order. No calendar
estimates; each item carries its acceptance gate.

### P0: stop the rot, retire the dead surfaces

P0.1 CI-parity gate command. Add `pnpm run gates` mirroring ci.yml order
(typecheck, lint, verify, test); update CLAUDE.md and AGENT-ONBOARDING.md
to make it the round-closing requirement, replacing harness-era typecheck
guidance with the deliberate-error probe as an environment self-test.
Accept: a seeded type error in src/ fails the command; docs updated.
Rationale: this round began with typecheck and lint red in a repo whose CI
enforces both; the zip-handoff loop had no loud failure.

P0.2 Flagship retirement. (a) Fold/remove matrix in planning/ mapping
every flagship capability to a post-removal home or a drop rationale;
(b) fold CoverageMeter and CoverageChart demonstrations into the
decision-dashboards AnalyticsDashboard with headless render tests (these
are shipped @g3t/react components whose only demonstrations live in
flagship); (c) delete examples/flagship, its README mentions, and archive
the flagship-\*.md planning docs with a closing note. Beat-runner and
capture-brief export are dropped per D1. Accept: grep for flagship
returns only archived planning docs and CHANGELOG history; the coverage
components are demonstrated outside packages/; suite green.

P0.3 Standalone retirement. Order matters: folds first, deletion second,
in one round, so main never has a coverage gap. (a) Fold the projection
story: a wiring-guide section with a CI-executed snippet (examples/wiring)
covering createPresetPipeline and a custom ProjectionPipeline with
collapse steps, plus a visible home in the Bio shell (a raw-vs-projected
toggle: RDF triples rendered directly, then typeCollapse / listCollapse /
blankNodeCollapse applied; this is the natural RDF sales story and the
shell already owns the dataset). (b) Delete scripts/demo and
scripts/thread-demo, vite.demo.config.ts, vite.thread.config.ts, the
demo/thread-demo package scripts, the docs:build copy steps for
docs-out/demo and docs-out/thread, and the docs landing links.
Accept: wiring tests exercise the pipeline; Bio shell contract tests
cover the toggle; `pnpm run gates` green; docs:build produces no
demo/thread artifacts; README and docs/landing.html reference neither.

P0.4 e2e triage. Delete the stale capabilities tests (they reference
cards removed in the overhaul and self-skip); add one smoke spec per
shell (landing, enter shell, canvas visible, one interaction each:
diagram switch, cluster mode, slider move, query run), reusing the
data-testid hooks the contract tests established. Commit Linux screenshot
baselines for the shells via the documented CI flow and remove
--ignore-snapshots so visual gating stops being decorative. Accept: CI
e2e passes with snapshots enforced; a deliberate style change fails it.
Constraint: authored headlessly here, validated in CI (browser downloads
are blocked in this sandbox); flagged per the working agreement.

P0.5 Doc truth pass. STATUS.md (currently asserts gates green and 1011
tests as of 06-22), CLAUDE.md (still quarantines flagship as in-flight),
AGENT-ONBOARDING.md, README (flagship line, standalone mentions, counts),
docs/landing.html. Accept: no doc asserts a state the gates or the file
tree contradict.

### P1: the curated adoption path

P1.1 Live-demo front door. README gains a "See it running" block linking
the Pages playground and Storybook, one line of purpose each;
docs/landing.html mirrors it. Accept: every link resolves on the deployed
site.

P1.2 Executable README. Extract the 15-line integration into
examples/wiring so it compiles under CI like every guide snippet; mark
the README block CI-verified. Accept: breaking the snippet breaks the
build.

P1.3 Callout deep links. CapabilityCallout entries link to wiring-guide
anchors (guide gains per-mechanism anchors), converting the narrative
panel from a claim into a path. Accept: each mechanism named in a callout
resolves to a guide anchor with a runnable snippet.

P1.4 Surface reachability. decision-dashboards reachable from the dev
server (landing rows under a capability-surfaces divider, or a documented
script); full-workspace documented per D2. Accept: a fresh clone reaches
every surviving surface from README instructions alone.

P1.5 Minimap in a shell. The playground shells render no minimap; adding
one to the Supply or MBSE shell restores an in-context demonstration lost
with scripts/demo at trivial cost, with the Storybook story remaining the
reference. Accept: shell contract test pins the wiring.

### P2: depth that preempts adopter objections

P2.1 Scale story. One reachable demo path over a generated graph on the
order of 5k-10k nodes (planning/large-graph-design.md is prior art) with
a stated performance budget asserted headlessly where measurable.
Rationale: "does it handle my graph" is the first issue any OSS graph
library receives. Flagged for possible promotion to P1 at maintainer
discretion; not promoted unilaterally.

P2.2 Accessibility and motion pass over the four shells: keyboard paths
for the containment tree, range slider, and workbench; reduced-motion
respected throughout (CoverageMeter models the consumer-decides pattern).
RTL-assertable where possible; browser-verified otherwise.

P2.3 Ontology-explorer enrichment (optional, on demand). Port the
individuals tab and per-selection detail pane (SHACL constraints
targeting the selection) from the deleted thread-demo viewer into the Bio
shell's OntologyExplorer. Deferred until an adopter or demo audience
asks; recorded here so the capability's location in git history is known.

P2.4 npm package pages. The three package homepage links point to
per-package READMEs; ensure each exists and carries its own minimal
example, since npmjs.com renders these as the package front door.

## 4. Removed from the draft

- Draft P2.3 (standalone HTML size budget): moot after D3.
- Draft P2.5 (thread-demo disposition): resolved into P0.3 and P2.3.
- Draft D1-D5: resolved; ledger in section 2.

## 5. Round shape

P0 as one round: it is deletion-heavy (flagship, standalones, stale
specs) plus two bounded folds (coverage components, projection pipeline)
and the e2e smoke authoring. If the round grows past comfortable review
size, the split point is after P0.3 (the folds and deletions land
together; e2e and doc truth follow). P1 as one round. P2 items scheduled
individually. Every round closes with `pnpm run gates`, a CHANGELOG
entry, and a packaged zip; browser-only validation steps are listed per
round for maintainer execution, now including the Pages deployment check
after docs:build changes.
