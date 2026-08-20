---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 05b: channel router — rewire, delete ladder, re-pin baseline (PRF-003, phase 2 of 2)

This is phase 2 of the two-phase split of Brief 05 (channel router).
Phase 1 (05a, shipped `b803d47` + foreground fixups `39c6e4e`) landed
the channel/track model and the fallback classifier as PURE-ADDITIVE
code behind an off-by-default `useChannelRouter` flag, with full unit
oracles and a flag-off byte-identity guarantee. This brief (05b) does
the destructive half that 05a deferred: it turns the flag on by
default, deletes the escalation ladder + Brief-10 stage-A accept-site
(no-legacy), removes the transient flag, narrows the 01 nudging pass,
consumes Brief 03's waypoint hints, annotates the Brief 10 plan
supersession, and re-pins the six-scenario LAY005_BASELINE using the
05a flag-on run as the OBSERVED baseline. The re-pin is why this had
to be phase 2: the "after" crossings/bends numbers cannot be authored
blind; they must be observed from the working channel router that 05a
landed.

## Scope boundary (read first)

IN SCOPE (05b):
- Rewire `g3tLayoutStructural` (and `g3tLayoutFlat` where it drives
  structural routing) to BUILD a channel plan from the demand-sized
  corridors (Brief 04) and PASS it into `routeStructuralEdges` so the
  channel router is the default path. Note (verified live): the
  `useChannelRouter` branch in `g3t-routing.ts:163-165` only engages
  when BOTH `useChannelRouter` is true AND `options.channelPlan !==
  undefined`. So the rewire must construct and thread `channelPlan`,
  not merely flip a boolean.
- Delete the escalation ladder + its 4px-clearance retry and the
  obstacle-threshold-64 through-node "honesty bailout" in
  `g3t-routing.ts` (no-legacy). The ladder tail is documented around
  `g3t-routing.ts:919` ("documented obstacle threshold (64)").
- Delete Brief-10 stage-A accept-site: the `longEdgeNear` early-accept
  eligibility check (`near.length >= longEdgeNear` at
  `g3t-routing.ts:796`, option declared at `:119`, defaulted at
  `:161`). Confirm it exists before deleting (it does, verified live).
  Re-express its perimeter policy natively as boundary-channel
  preference per Brief 05 §4.
- Remove the transient `useChannelRouter` flag entirely (declaration
  `g3t-routing.ts:139`, resolution `:163-165`, and the comment sites
  in `layout/index.ts:10` and `g3t-channel-router.ts:13-17`). After
  the ladder is gone there is no dual path, so the flag has nothing to
  gate; leaving it is the exact aliasing the no-legacy doctrine
  forbids.
- Narrow the 01 nudging pass to fallback + mixed-mode edges only, per
  Brief 05 §5 (channel-routed edges have track separation guaranteed
  by construction; do not call the nudging function on all routes).
  Use 05a's exported fallback classifier to compute the subset.
- Consume Brief 03's dummy-chain `intermediate: Pt[]` waypoints as
  channel-selection hints for long spans, per Brief 05 §3. First emit
  the waypoint-miss-fraction diagnostic (Brief 05 §3): count the
  fraction of long-span waypoints falling outside any available
  channel corridor across the six lab scenarios; if >50% miss, log it
  prominently and keep per-span `routeOrthogonal` fallback (correctness
  holds regardless — the diagnostic gates the usefulness claim, not
  correctness).
- Annotate the Brief 10 plan atom's supersession (Brief 05 §4):
  resolve the IRI with `kb find --type kb:Plan --subject "Brief 10"
  --project g3_toolkit` (or `kb find --slug`), record that stage-A is
  superseded by this brief's boundary-channel preference, and record
  the resolved IRI + annotation command in the commit message. If the
  lookup returns nothing, HALT and report (the Brief 10 gate below
  would also have failed).
- Re-pin the six-scenario LAY005_BASELINE in
  `src/demo/routing/scenarios.test.ts:204` (the `LAY005_BASELINE`
  record, consumed by the loop at `:222`) to the OBSERVED flag-on
  numbers. See the re-pin protocol below — the observed numbers must be
  captured from an actual channel-router run, never guessed.

OUT OF SCOPE:
- Any new capability beyond wiring the 05a module in. This brief moves
  the default path onto already-landed, already-unit-tested code; it
  adds no new routing algorithm.
- Brief 06+ (dense-scene legibility, dependency/renderer/widget
  independence) remain their own briefs.

## Dependencies and dispatch gates (verify before implementing)

- **Brief 05a (additive module):** shipped (`b803d47`, foreground
  `39c6e4e`). Confirm `packages/core/src/layout/g3t-engine/
  g3t-channel-router.ts` and `g3t-fallback-classifier.ts` exist and are
  exported, and that `routeStructuralEdges` carries the
  `useChannelRouter` + `channelPlan` options (verified live at
  `g3t-routing.ts:139` and `:164`). If the module is absent, HALT: 05b
  has nothing to wire.
- **Brief 04 (corridor supply):** shipped (`725299e`). The channel
  plan reads the demand-sized corridor widths; confirm
  `computeCorridorGap` / `estimateCorridorDemand` are live in
  `g3tLayoutStructural`.
- **Brief 03 (dummy chains):** shipped (`cc38406`). Confirm the
  `intermediate: Pt[]` field is emitted on long-span edge geometry
  before consuming it for channel selection.
- **Caller audit (routeStructuralEdges):** 05a re-confirmed 5 caller
  sites, none branching on perimeter-route-specific format
  (`packages/core/src/index.ts` export, `layout/index.ts` re-export,
  four calls in `structural-patterns.test.ts`, one dynamic import in
  `g3t-layered.test.ts`). Because deleting the flag CHANGES the
  signature, re-audit and update every caller that passes
  `useChannelRouter`; record the audit in the commit message. This is a
  hard gate.

## Re-pin protocol (the reason this is phase 2 — do it honestly)

1. Land the rewire + deletions FIRST, with the six-scenario oracle
   temporarily unpinned or expected-to-change, so the channel router is
   actually the live path.
2. RUN the scenarios and OBSERVE the real crossings/bends/violations
   the channel router produces on each of the six scenarios at S/M/L.
   Capture these from the actual run output — do not hand-author them.
3. Re-pin `LAY005_BASELINE` to the observed numbers, subject to the
   Brief 05 §"Verification" bounds: box violations stay 0,
   coincidentRuns stays 0, total crossings do NOT increase anywhere
   (strict non-regression), bends do not regress beyond the pinned
   tolerance. A crossing DECREASE on Crossing Storm / Cycle Tangle is
   expected for fully channel-routed edges but is not a hard assertion
   (same-layer 5a and anti-monotone 5b edges route via
   `routeOrthogonal` and may not decrease).
4. If any scenario shows a crossing INCREASE vs the pre-05b baseline,
   that is a real regression, not a re-pin target: STOP, diagnose, and
   do not paper over it by pinning the higher number. Emit a `kb log
   gotcha` or `kb log failure` and report in `outcome.json`.
5. Add the track-count-bound oracle (Brief 05 §Verification): for every
   channel in each scenario, assigned-track-index count <= the Brief 04
   `demand` value; a gate-green assertion, not a debug log. Add the
   anti-monotone and compound-boundary oracles if the six scenarios do
   not already exercise them (05a built synthetic fixtures for the unit
   layer; here they must fire on lab scenarios or a scenario must gain
   the edge).

## Verification (05b gates)

- Full `pnpm run gates` (typecheck && lint && verify && test) green,
  plus the three `python3` spec scripts (`lint_specs.py`,
  `sync_spec_status.py`, `check_roadmap_coverage.py`) exit 0. Do NOT
  pipe gate scripts through tail/head; check `$?` directly. Run
  `prettier --write` on every touched file BEFORE committing (05a's
  worker false-greened lint by skipping the Prettier `--check`; see the
  Gotcha `weaver-sandbox-workers-report-gates-green...`). If the
  weaver pnpm store is read-only and you cannot run `pnpm run gates`,
  say so in `outcome.json` blockers so foreground re-runs the full gate
  + bundle ledger.
- The six-scenario oracle passes on the re-pinned observed baseline
  with the non-regression bounds above.
- Track-count-bound, anti-monotone, and compound-boundary oracles green
  on lab scenarios.
- Drag stability: 3px perturbation keeps discrete channel/track
  assignment (no flicker); dragging to the sort-key flip boundary does
  not re-render at the intermediate position.
- Bundle ledger: if deleting the ladder + flag SHRINKS `@g3t/core`
  below the 182 KB budget 05a raised it to, LOWER the budget back with
  a ledger rationale (the ledger tracks real size both directions).
- `kb verify --project g3_toolkit` passes cleanly AFTER the Brief 10
  annotation lands (invariants I-1/I-34/I-35/I-38 may check plan-atom /
  code-state consistency).

## Rollback

Single-commit atomic (rewire + deletions + flag removal + re-pin land
together). `git revert <sha>` restores the ladder, the stage-A
accept-site, the flag, and the broad nudging scope, and reverts the
baseline to its current pinned values. Because this brief adds the
Brief 10 supersession annotation, after any revert run `kb verify
--project g3_toolkit` immediately; if an invariant fires on the stale
annotation, remove it via `kb update` or `kb supersede --kind
invalidation` before declaring the revert complete. The rollback is
not done until `kb verify` passes.

## Worker contract

- Emit inline `kb log` atoms during the run: `kb log decision` for the
  rewire + ladder deletion as landed, `kb log discovery` for the
  waypoint-miss-fraction finding and any nontrivial fact about the
  channel-plan construction surface, `kb log gotcha`/`kb log failure`
  for any real regression found during re-pin. Link with `--part-of`
  the Plan IRI in this frontmatter.
- Link the commit with `--implemented-by <sha>`.
- Write `outcome.json` (outcome/atoms_emitted/commit_shas/
  files_changed/summary/duration_min/blockers) and end with the
  one-line stdout summary `done: <n> atoms; commit=<sha>; <outcome>`.
- If a genuine blocker stops you (module absent, Brief 10 IRI lookup
  empty, a real crossing regression you cannot resolve), do NOT exit 0
  silently: `kb log failure` + `outcome: bailed` + the reason. You are
  the authorized executor for this brief — execute it; do not defer or
  ask for confirmation.
