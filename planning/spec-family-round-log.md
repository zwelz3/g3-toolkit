# Round log: the specl specification family

2026-08-18 to 2026-08-20. Package: `g3t-family-package.zip`, plus the
`specl-main` snapshot supplied in place of a clone.

Companion documents, in the order they were produced:

| Document | What it is |
|---|---|
| `spec-family-gate1-identifier-plan.md` | Gate 1, the identifier plan, with AG2's ruling recorded |
| `spec-family-gate2-capability-inventory.md` | Gate 2, the cutting sheet and shared-entity register, with AG2's ruling |
| `spec-family-owner-needs.md` | Running list of what needs the owner rather than the agent |
| `specl-observations-log.md` | Working log, 18 observations with reproduction steps |
| `specl-observations-report.md` | The report specl is owed, ready to file |

## What the package asked for, and what was actually here

The brief assumed a greenfield family. The repository was not: `specs/` already
held eleven specl-flavoured documents carrying 76 requirements, governed by
three homegrown Python scripts rather than by specl, with their R-IDs cited 370
times across source and roadmap.

That single fact decided most of the design. It ruled out the brief's
instruction to split the family by package, because re-filing 76 requirements
would have renumbered them and invalidated every citation. The split that
shipped preserves the existing document boundaries instead, and the parent
absorbs the three documents that carried no R-IDs.

## What shipped

Seven members. 213 items, 113 requirements, 2,495 merged triples. Every member
translates with `--fail-on-warning` at exit 0 and validates at zero violations.
94 component IRIs: 43 shared, 51 member-local.

| Member | Prefix | Root | Items | Maturity |
|---|---|---|---|---|
| parent | `g3t` | `specs/g3t/spec.md` | 53 | 79% |
| functional | `g3tfunc` | `01-functional-views.md` + companion `02` | 42 | 89% |
| technical | `g3ttech` | `03-technical-data-layer.md` + companion `04` | 20 | 88% |
| integration | `g3tint` | `05-integration-holonic.md` + companion `06` | 14 | 86% |
| ux | `g3tux` | `07-ux-defaults-accessibility.md` | 13 | 85% |
| security | `g3tsec` | `08-security-deployment.md` | 6 | 91% |
| routing | `g3trouting` | `specs/routing/spec.md` | 63 | 95% |

## Sequence

Gate 1 and Gate 2 were reported and stopped at, as the PROMPT requires. No
requirement text was written before AG2 cut the inventory, and no `spec_base`
was chosen without a ruling.

1. Installed specl 1.0.0 from PyPI, superseding the package's "install from git
   main" instruction, which existed only because `UR23` was unreleased when it
   was written. Ran `conformance` before anything else.
2. Proved the absolute-IRI behaviour with an independent probe rather than
   trusting a version string, because the package's own documents disagreed
   about which release shipped it.
3. Landed the routing specification verbatim. Gate 1 to AG2. **Stopped.**
4. Gate 2: the inventory, the shared-entity register, and the evidence audit.
   **Stopped.**
5. Drafted the parent, converted routing, migrated the six peers, verified per
   member and across the family, rewrote the gates.

## Things that were wrong and had to be corrected

Recorded because the working agreement asks for root causes rather than
patches.

- **My persona reconciliation at Gate 2 was incomplete.** It read `role:`
  values and missed 18 `asA:` values, which become roles on migration. Three
  names surfaced during drafting, after AG2 had already ruled on the set. The
  set is 12, not the 11 approved; flagged as N8 rather than quietly absorbed.
- **My D/OQ detection regex required a space after the digits**, so it missed
  the dotted `D4.1` and I ran a partial migration before catching it. Reverted
  the three affected files from git and redid it section-aware.
- **I miscounted the routing renumber surface** as 66 tokens when it was 69,
  because three defining bullets cite another requirement inside their own
  sentence. The anchor assert caught it before the edit ran, which is the entire
  reason for that rule.
- **I piped a gate through `head` once** and reported an exit code that was
  `head`'s, not specl's. The repository's standing rule exists for exactly that
  and I broke it.
- **I asked AG2 to approve deleting three files without showing what would be
  lost.** Correctly pushed back on. The replacement is computed: every
  substantive line accounted for, the two dropped blurbs quoted in full, and the
  eight dropped `affects` strings tabulated by decision.

## What the family caught that per-member checks did not

`PresetRegistry` existed as two nodes 18 lines apart in one file, because
`constrains` accepts a bare name and mints locally while `affects` refuses one
and requires an IRI. `translate --fail-on-warning`, `validate`, `score` and
`layering` were all clean with the split present. Only merging the family and
grouping local names across IRIs found it.

The drafting instructions prescribe that merged check. This round is the
evidence it is load-bearing rather than a formality, and it is now the core of
`scripts/check_specs.py`.

## Honest numbers

- **12 of 76** legacy requirements carry test evidence. 46 claim `implemented`
  but only 7 of those are cited in a test file. The family reports
  `implementation: implemented` rather than `verified` for the rest, so first
  scoring reads lower than the prose ever claimed. That is the correct reading.
- **All 35 routing requirements read `not-started` by inheritance, not by
  measurement.** The HANDOFF-003 assessment owns that and is out of scope here.
- **147 cross-member references, 0 checked by `layering`.** The family's clean
  layering result is not evidence the members are decoupled; it is evidence the
  check cannot see how they are coupled.
- **18 cross-member requirement dependencies exist only in prose**, because
  specl has no requirement-to-requirement reference.

## Later in the round, after the gates first ran

Five things landed after the first full gate run, each from an owner ruling.

**`verifiedBy` harvested, and three requirements found over-credited.** Twelve
requirements were cited in test files. Reading each test against its acceptance
criteria rather than trusting the citation, only **two** earned `verified`
(R7.8, R7.9). Five were already capped `in-progress` by the repository with
reasons. Three were over-credited: **R2.14** required `Ctrl+Z MUST undo` and no
such binding exists anywhere in the tree; **R7.3** truncates where the
requirement says aggregate or paginate; **R7.7** has an override API that
nothing instantiates outside tests.

**R2.14 withdrawn** per owner ruling, in the R1.9 pattern. `UndoRedoStack`
remains built, exported and tested under no requirement, which is the same
shape `SankeyView` has carried since R1.9. The family lost a component node as
a result.

**R7.3 and R7.7 given roadmap owners and issue drafts.** Grounding those drafts
corrected the diagnosis in R7.7's case: the override mechanism is built and
exported, so the first commit is wiring rather than a config format. It also
surfaced that D5 promises two things that interact, soft user-raisable defaults
and administrator ceilings, and the configuration model expresses neither.

**`STATUS.md` deleted.** 1,370 lines, 2% live. Its snapshots moved to
`planning/status-history.md` and its live section into `CLAUDE.md`'s CURRENT
FOCUS, which was stale at 2026-07-03 precisely because attention had gone to
`STATUS.md` instead. 16 live references rerouted; CHANGELOG and `audit/`
entries left as point-in-time records.

**Maturity baselines recorded**, and the first honest reading is much lower
than any prose claimed. `functional` reads 18%, not 89%. That is O19: `UR25`
makes the `verifiedBy` warning conditional on the graph declaring any
verification artifact, so adding five switched the check on for the 26 that
have none. Escalated to specl as the item this round would most like
dispositioned, because maturity is published on a badge and the incentive
points at staying silent.

## Gate result

`CI=true pnpm install` succeeded, which cleared the incomplete `node_modules`
that had blocked every JS gate earlier in the round. The five-step gate then ran
in full.

| Step | Result |
|---|---|
| `typecheck` | pass |
| `lint` | pass, warnings only (pre-existing unused eslint-disable directives) |
| `verify` (15 steps) | **14 pass**; `verify:exports` is a timeout flake, see N15 |
| `test` | not a usable signal in this container, see N16 |
| `gates:spec` | **pass** |

`gates:spec` passing matters beyond the round: it is the first run of
`scripts/check_specs.py` through the real chain, invoked as
`python scripts/check_specs.py` rather than with the venv on `PATH`. The
`shutil.which` lookup resolved, and the whole-family check ran: 7 members, 2,495
triples, 43 shared components, 51 member-local.

Neither red step is attributable to this round. Every line changed under
`packages/` is `@see` comment text, 8 lines across 8 files, verified with
`git diff -U0`. `verify:exports` produced four different failure sets across
four runs of identical code and passes 12/12 at a realistic timeout. The single
`test` failure is in a file this round edited, so it was run in isolation:
6/6 passing, exit 0.

An experiment was started and abandoned: stashing `packages/` to prove the
dist flake predates the round. It would have proved nothing, because `dist/` was
built from this round's source and stashing `src/` does not rebuild it, so the
test reads identical bytes either way. The stash round-tripped cleanly and the
tree was verified intact afterwards.

One process note worth keeping. The background task for the gate reported
"exit code 0" while the gate had actually failed: the command ended in
`echo "GATES_EXIT=$?"`, so the shell's exit code was the echo's. The real value,
`GATES_EXIT=1`, was only visible by reading the log. Same class of mistake as
piping a gate through `head`, which this repository already has a standing rule
about, and the rule should be read as covering any construct that puts something
between the gate and the reported status.

## Not done

The full test suite has never run to completion here; N16 records why. A clean
`test` verdict needs a machine that can start 172 vitest workers, and one
exists: `outputs/HANDOFF-round-2.md` records the previous round running **170
files and 1546 passing tests** on native Linux. So the suite is healthy and
this container is not, which is the reading N16 should be given.

The two red gate steps are recorded as N15 and N16 rather than fixed. Both are
one-line changes to test configuration, and making them inside a round about
specifications would smuggle an unrelated decision through.
