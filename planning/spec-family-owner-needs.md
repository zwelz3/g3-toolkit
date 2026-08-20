# Needs from AG2

Running list of things that need Zach rather than the agent. Kept current as
work proceeds. Two kinds: **decisions** only the owner can make, and **actions**
only a human with credentials can take.

Settled items move to the bottom rather than being deleted, so the reasoning
stays greppable.

---

## Blocking now

Nothing needs a ruling. Four pieces of family work remain that I can do without
one, listed here so the round's completeness is legible rather than assumed.

**R1. Harvest `verifiedBy` onto the 12 test-cited requirements.** The whole
family currently carries `verifiedBy` on routing only. All six migrated peers
carry **zero**, and the brief is explicit that this, not maturity, is the number
worth watching: it is what says the specification describes the software rather
than an intention. Gate 2 established that 12 of the 76 can carry real evidence
today, and they are identified:

| Requirement | Test |
|---|---|
| R1.4, R7.3, R7.7 | `packages/react/src/views/matrix/matrix-acceptance.test.tsx` |
| R1.13, R2.13, R2.14 | `packages/react/src/views/query/gap-analysis.test.tsx` |
| R1.16 | `packages/core/src/shacl/shacl-to-structural.test.ts` |
| R1.17 | `packages/core/src/shacl/shacl-report.test.ts` |
| R1.18 | `packages/core/src/layout/structural.test.ts` |
| R2.11 | `packages/core/src/export/subgraph-export.test.ts` |
| R7.8 | `packages/react/src/views/canvas/palette.test.ts` |
| R7.9 | `packages/react/src/a11y/a11y.test.tsx` |

Each would also move from `implementation: implemented` to `verified`, which is
the honest reading once a named passing test exists. Note O7: `verifiedBy`
records a name and nothing checks the test still exercises the requirement, so
each of the 12 needs reading before the claim is made rather than pattern
matching on the citation.

**R5. RESOLVED, and one follow-up.** R2.14 withdrawn per your ruling. R7.3 and
R7.7 now have roadmap owners and GitHub issue drafts:

| Requirement | Roadmap owner | Issue draft |
|---|---|---|
| R7.3 | `roadmap/engineering/pagination.md` | `planning/github-issues/pagination-across-views-and-ugm.md` |
| R7.7 | `roadmap/architecture/deployment-configuration.md` | `planning/github-issues/deployment-performance-configuration.md` |

All three gates are green. **Follow-up: post the two issues and replace
`Tracked as: GitHub issue TBD` in each roadmap file with the URL.** One edit
per file.

**On referencing the issue from the requirement itself: I recommend against
it.** specl has no key for it, so the URL would have to live in the description
or a nested line, and the two artifacts have different lifetimes. A requirement
is a durable commitment; an issue is transient work tracking that closes while
the requirement stands. Worse, the link would be unchecked prose inside an item
whose whole value is that its references resolve.

The roadmap file is the right home and the chain is already machine-checked:
`check_roadmap_coverage.py` enforces that every open requirement is owned by
exactly one roadmap file and that the `roadmap/CLAUDE.md` index agrees. So
requirement to roadmap is verified, and roadmap to issue is one documented hop
in a file that is meant to churn.

If you want the requirement to carry it anyway, the least-bad form is a nested
line under the item rather than the description, since nested content is an
ordered list of strings and makes no traceability claim.


**R6. Does `STATUS.md` need to exist?** You asked; measured answer below. My
view is that it should not exist **in this form**, and that most of what it does
is now done better elsewhere.

| | |
|---|---|
| total lines | 1,370 |
| live section | **29 lines, 2%** |
| superseded `## PRIOR SNAPSHOT` blocks | **75, 97%** |

Four things are true at once:

1. **It is 97% archive, and the repository already has a home for archive.**
   `CLAUDE.md` designates `planning/` round logs for history and
   `planning/milestone-history.md` for milestone-era tracking, marked "do not
   update it". `STATUS.md` duplicates that function inline, 75 times.
2. **There are already two current-state artifacts and they have drifted.**
   `CLAUDE.md` line 12 says `CURRENT FOCUS (2026-07-03)`; `STATUS.md` line 3
   says `As of: 2026-08-16`. Six weeks apart, both claiming to be current. This
   is the failure mode `CLAUDE.md` itself warns about: "Hand-maintained counts
   have drifted several times."
3. **`CLAUDE.md` points at content `STATUS.md` does not contain.** Line 138
   reads "Open threads (head of queue; **full queue in STATUS.md**)". There is
   no queue in `STATUS.md`; the word "thread" appears twice in 1,370 lines.
4. **Everything countable in it is now data.** `specl-validate score` reports
   maturity and progress per member, `--history` records the trend as a
   `prov:Activity`, and the three gate scripts report the distributions.
   `CLAUDE.md`'s own rule already demoted the prose: "when a number disagrees
   with a gate script, the script is right."

**Recommendation: delete it and move its two live functions.** The 29-line
live paragraph is genuinely valuable, a human-written account of where the
project is and why that no gate can produce, but it belongs in `CLAUDE.md`'s
`CURRENT FOCUS` block, which already exists to hold exactly that and is
currently stale because attention went to `STATUS.md` instead. One
current-state artifact cannot drift against itself. The 75 snapshots move to
`planning/` alongside `milestone-history.md`, under the same "do not update"
marking.

If you would rather keep the file, the minimum is: move the snapshots out,
stop hand-maintaining any number a gate produces, and either build the queue
`CLAUDE.md` promises or correct `CLAUDE.md`. Keeping it as-is means two
current-state documents that have already disagreed for six weeks.

Related, and the reason this surfaced now: the family's honest maturity numbers
(N11, and O19 in the observations log) will disagree with anything
hand-written. `functional` reads 18%, not 89%. Whichever way you rule, the
numbers should come from `score --history` rather than from prose.

**R2. Decide whether the parent carries any requirements.** It currently has
**none**. The brief says the parent should hold "the cross-cutting
non-functional commitments", and `planning/g3l/prf-budgets.json` has six frozen
budget keys that are exactly that shape. Against it: GAP-017 established the
routing keys aim outside the operating range, the same check has not been run on
the other four, and routing already owns RT8.1-RT8.3 for the budget file under
AG2. A parent with zero requirements is defensible; it should be deliberate
rather than incidental.

**R3. Establish the maturity baseline with `score --history`.** No
`history.ttl` exists for any member. The brief's step 5 and HANDOFF-003 both
call for recording assessments this way so successive ones are comparable and
the trend is data rather than prose. Cheap now, and the baseline is only
recoverable at the moment it is taken.

**R4. RESOLVED except the commit.** Planning log, CHANGELOG entry,
`outputs/HANDOFF-spec-family.md` and `outputs/g3-toolkit-spec-family.zip`
(830 files, 6.4 MB, cleaned of `node_modules`, `dist`, `.git`, build output and
the two source zips) are all in place.

**Still outstanding: nothing is committed.** 64 changed or new paths, including
the seven `.ttl` files and seven `history.ttl` files, which must be committed
because `layering` reads peers' Turtle from disk and `check_specs.py` compares
the committed Turtle against a fresh translation to detect staleness. Committing
is yours to authorise; say the word and I will, on a branch.

---

## Needed soon, not blocking

**N0. The observations report is drafted and waiting on N4.**
`planning/specl-observations-report.md` is complete and ready to file through
specl's intake. It should not be filed before g3-toolkit is a registered
adopter, because an unregistered report carries no blocking weight in the 2.0
window. So N4 gates it.

**N3. Register `g3t` on `w3id.org`.** A pull request against `perma-id/w3id.org`
adding a `g3t/` directory with `.htaccess` and a `README.md` naming G3-Toolkit.
Needs a GitHub account, so it cannot be done from here. Until it merges, every
`https://w3id.org/g3t/...` IRI in the family is well-formed but does not
resolve. Nothing breaks meanwhile; the graph is valid either way.

specl's own release documentation carries the procedure it used, including the
ordering constraint that Pages goes live before the redirect merges, and a
post-merge `curl` verification loop.

**N4. Register g3-toolkit as a specl adopter.** Through the
`adopter-registration` issue template. From 1.0 a registered adopter's
substantive objection blocks a 2.0 change rather than being outvoted, and
silence at the close is assent. The window opened 2026-08-19 and closes in a
year. Filing the observations report without registering gives up the only
leverage the process offers.

**N5. Schedule the routing assessment (HANDOFF-003).** Deliberately out of scope
for the family work and now the largest open thread. It sets `implementation:`
per routing requirement against real evidence; today all 35 read `not-started`
by inheritance rather than by measurement. It also owns the missing
`route-audit` harness and the absent `g3t-routing.test.ts`.

---

## Open for your pushback

Nothing outstanding. N6, N7 and N8 were ruled on 2026-08-20; see Settled.

---

## Watch items, no action yet

**N15. `tests/dist/public-api.test.ts` has no `testTimeout` and needs ~48s.**
`vitest.dist.config.ts` sets none, so it inherits vitest's 5000ms default for a
test that dynamically imports each built bundle and diffs its named exports
against the source barrel. Four runs on identical code gave four different
results: 2 failures, then 1, then 0, then 3, with a different package failing
each time. With `--testTimeout=120000` the whole file passes 12/12 at exit 0.

`verify:exports` is therefore latently red on any runner as slow as this
container, independent of anything in this round. The one-line fix is obvious
and I did not make it: that file encodes a contract about how long the dist
surface check may take, and changing it inside a round about specifications
would be smuggling an unrelated decision through. Your call.

**N16. `pnpm run test` could not execute 80% of the suite in this container.**
Not a flake, a capability limit worth recording before someone reads a green or
red `test` result here as meaningful.

| | |
|---|---|
| test files in the repo | 172 |
| files vitest actually ran | **35** |
| files whose worker failed to start | **137** |
| worker-startup errors | 274 |

35 + 137 = 172 exactly, so every file that did not run failed to start rather
than being skipped. Errors are `[vitest-pool]: Failed to start forks worker` and
`Timeout waiting for worker to respond`. The machine is not short of resources
(22 CPUs, 21 GB free), and the shape gives it away: 577s wall clock against
`environment 1659.16s`, so environment setup alone took three times the run.
This is fork-pool contention in the container.

The single reported failure, `module-boundary.test.ts > Layout engines export
without React dependency`, is a 5000ms timeout at 5190ms on an
`await import("./layout")`. That file is one I edited, so I ran it in isolation:
**6/6 passing, exit 0.**

No action proposed. Recorded so that a future run here is not mistaken for a
verdict on the suite, and so the same 5000ms default that produced N15 is
visible as a pattern rather than a one-off.

**N9. `prf-budgets.json` sits in `constrains` under protest.** It is a versioned
document; `constrains` has range `specl:Component`; `governs:` covers ontology
terms. No key models it. Reported to specl as the second half of O8. If they
add one, this moves.

**N10. The 15 uncited `proposed` requirements are held, not drafted.** Per your
"reassess after" ruling. Safe only while they stay undrafted, since the brief's
point is that cutting an inventory line is cheap and superseding a commitment is
not. They are held out of the family and raised again with N5.

**N11. Maturity is honest now, and much lower than any prose claimed.**
Originally raised as "first scoring will read lower than STATUS.md". Resolved
twice over: `STATUS.md` was deleted under R6, and the numbers turned out to be
far lower than predicted. `functional` reads **18%**, not the 89% it showed
before `verifiedBy` was harvested, because adding real traceability switched on
the check for the 26 requirements that have none (O19).

No action. Recorded because anyone comparing against an older figure will think
something broke. Nothing did; the specification started telling the truth.

**N14. Restore the collective `affects` targets when a mechanism exists.**
Per your N2b ruling, seven collective values (`all renderers`,
`all renderers that support size/color encoding`, `All renderers`,
`All view components`, `all view components`, `all canvas-hosting views`,
`consumers passing decoration props`) now live in each decision's `rationale`
in `specs/g3t/spec.md`, each marked with the phrase **"Collective targets"** so
they are greppable. Affected: D2, D4, D11, D13, D14, D15.

What was lost is not the names but the **inheritance**: `D2 affects <all
renderers>` would have reached a renderer added tomorrow, and the prose form
reaches nothing. Enumerating today's renderers instead would be worse, since it
converts a standing rule into a snapshot that silently goes stale.

Filed to specl as **O18**, with a shape that needs one new property rather than
a new class: declare the category as an ordinary component and relate members
to it with a `memberOf` relation, leaving `affects` and `constrains` untouched.

A g3t-local alternative exists and was deliberately **not** taken: `governs:`
plus `vocabularies:` already accepts project-owned terms, so a g3t ontology
could declare `Renderers`, `ViewComponents` and `CanvasHostingViews` as classes
with the components as instances. Recorded rather than done, because `governs:`
means "constrains the meaning of this term", which is a different claim from
"affects every member of this set", and standing a parallel component ontology
up to route around a missing property is easy to begin and hard to retire. Your
call if you want it before specl moves.

**N12. `functional` and `technical` cannot be layered relative to each other.**
Their requirements reference each other in prose, 4 one way and 1 the other, so
declaring either upstream of the other makes the reverse direction a layering
violation. Today neither declares a relation to the other and the coupling is
invisible, which is honest but unchecked.

Not blocking, and not obviously a defect: bidirectional coupling between the
archetype views and the data layer may be correct for this toolkit. Raising it
because if it is *not* correct, the family is the first artifact that could
have told us, and the fix is a boundary change rather than a wording one.

**N13. 18 cross-member requirement dependencies exist only in prose.** specl has
no requirement-to-requirement reference, so these cannot be expressed as
triples. Reported as O17 and now the leading contract-break candidate. No action
here; noted so nobody mistakes the family's clean `layering` result for evidence
that the members are actually decoupled.

## Settled

| # | Item | Ruling | When |
|---|---|---|---|
| S15 | N6, `PER3` and `PER4` kept separate | Approved. A knowledge engineer has tasks an ontology engineer does not, and that distinction drives which graph analytics and visualizations each needs to do their job. Folded into the persona descriptions in `specs/g3t/spec.md` | 2026-08-20 |
| S16 | N7, routing `refines: g3t` | Ratified | 2026-08-20 |
| S17 | N8, `PER12` Assistive Technology User | Approved; the persona set is 12 | 2026-08-20 |
| S11 | N1, the three Python spec gates | Approved, use specl CLI where appropriate. `lint_specs.py` retired; `scripts/check_specs.py` delegates to `specl-translate`/`specl-validate` and adds the whole-family check; the two scripts specl cannot replace updated for `implementation:` and for retired items | 2026-08-20 |
| S12 | N2a, the two section blurbs | Let them go. 09's contained a now-false sentence about `considering` | 2026-08-20 |
| S13 | N2b, the collective `affects` targets | Moved to `rationale`, filed to specl as O18, tracked for restoration as N14 | 2026-08-20 |
| S14 | N2c, the three absorbed files | Deleted; 16 citations across 12 files rerouted to `specs/g3t/spec.md#decisions` / `#open-questions`; Sphinx toctree updated | 2026-08-20 |

### Earlier

| # | Item | Ruling | When |
|---|---|---|---|
| S1 | Host and namespace | `w3id.org/g3t`, directory `g3t`, G3-Toolkit in its README | 2026-08-19 |
| S2 | Member split | Grouped, six peers plus parent, `companion_files` for the pairs | 2026-08-19 |
| S3 | Prefix convention | Lowercase `prefix`, uppercase `item_prefix: RT` where specl forces it | 2026-08-19 |
| S4 | Shared namespaces | `components#`, `tests#`, `documents#` | 2026-08-19 |
| S5 | R-ID collision | Renumber routing under `item_prefix: RT`, legacy citations untouched | 2026-08-19 |
| S6 | Relabel scope | All five routing item classes, not just requirements | 2026-08-19 |
| S7 | `constrains` naming | Components, with file paths in `verifiedBy` and prose | 2026-08-19 |
| S8 | The cut | Reassess after the routing assessment; see N10 | 2026-08-19 |
| S9 | Persona set | Reconcile, 17 names in; see N8 for the late correction | 2026-08-19 |
| S10 | `implemented` downgrade | Confirmed; see N11 | 2026-08-19 |
