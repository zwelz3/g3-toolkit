# Observations from drafting the first specl specification family

From the g3-toolkit track, for specl's intake. **Observations, not proposals.**
Disposition is specl's, and nothing here is pre-formatted as a requirement.

Written against **specl 1.0.0**, installed from PyPI. `specl-validate
conformance` reported 7 findings against 7 expected before anything else was
run.

The full working log, with reproduction steps for every item, is
`planning/specl-observations-log.md` in the g3-toolkit repository. This document
is the summary specl asked for.

---

## What was built

A seven-member family, migrated from eleven pre-existing markdown documents
that were specl-flavoured but had never been through the toolchain, plus the
`g3t-routing-001` specification transferred under HANDOFF-003.

| | |
|---|---|
| members | 7, one parent and six peers |
| items | 213 |
| requirements | 113 |
| merged triples | 2,495 |
| component IRIs | 94, of which 43 shared and 51 member-local |

Every member translates with `--fail-on-warning` at exit 0 and validates at
zero violations. The 19 remaining warnings are all one honest gap: legacy user
stories that never carried acceptance criteria.

---

## The four figures

### 1. Absolute-IRI verbosity, counted

| Figure | Value |
|---|---|
| absolute-IRI **occurrences** | **166** |
| distinct IRIs behind them | 43 |
| characters spent | 7,790 |
| characters if bare | 2,478 |
| **overhead the map removes** | **5,312, or 68%** |

**Occurrences is the figure the map should be designed against, not distinct
IRIs.** Names are written 166 times for 43 components, just under four times
each, and two thirds of every such line is namespace.

### 2. Distinct shared entities

**18 of 77 entities named in `constrains` are named by more than one member:
23%.** The request predicted a minority and the prediction holds.

It holds twice, by two routes. The count was 23% before the family's naming
convention was unified and 23% after, because collapsing the convention split
merged pairs without creating new sharing. Routing's components turned out to
be genuinely routing-local.

One caveat that matters for the map's design: counting `affects` as well as
`constrains`, which the parent uses heavily on decision records, gives **43
shared against 51 local, 46%**. The answer is sensitive to whether decision
records count, and the map should be designed knowing which question it is
answering.

The split that produced these numbers was not freely chosen. It preserves
existing document boundaries because the requirement identifiers are cited 370
times across the repository, so 23% describes an inherited, concept-based
division rather than an optimal one.

### 3. Whether shared entities fall into categories

**On observed sharing, one namespace would be enough: all 18 shared entities
are software components.** The case for several rests on singletons.

That understates it, though, and the understatement is the finding. A versioned
document (`prf-budgets.json`) and a test file were both sitting in `constrains`
because nothing else models them. That is a categorisation the format forced,
not one the project chose. The project believes it has at least three
categories; the graph can only show one.

### 4. What needed a contract break

Six candidates, ranked by what the rephrase cost. Each carries the "what was
wanted before rephrasing" note, written down before the rephrase was made.

**1. A requirement cannot reference another requirement.**
Wanted: `R4.3 dependsOn g3tfunc:R1.5`. Got: the dependency stays in the
sentence. **18 cross-member instances** in this family. This is exactly the
relation `specl-validate layering` exists to police, and every instance of it is
invisible to the check. `dependsOn` exists at specification scope but not at
item scope, so a family can declare that one member is upstream of another and
cannot say which items make it so.

A second-order effect: two members reference each other, 4 one way and 1 the
other. Declaring either upstream of the other would make the reverse a
violation, so the family cannot layer its two largest members at all, and the
evidence for that is prose.

**2. No way to name a set of components.**
Wanted: `D2 affects <all renderers>`, so a renderer added tomorrow inherits D2.
Got: prose in `rationale`, which inherits nothing. Seven instances.

The enumerable workaround is wrong even where available: writing out today's
renderers converts a standing rule into a snapshot that goes stale silently.
And the sets are not all one shape. `all renderers` is a class of component;
`consumers passing decoration props` is a class of downstream *user*.

Offered as observation rather than proposal: this needs one property, not a new
class. `constrains` already ranges over `specl:Component`, and a set of
components is a supertype rather than a different kind of thing. If the
vocabulary carried a membership relation, a project could declare the category
as an ordinary component and `affects` and `constrains` would need no change.

**3. No relation for a file as distinct from a component.**
Already in `LIMITATIONS.md`; this is a worked example of the cost at family
scale. Wanted: name the component and its current implementing file as one
statement with two parts, so component identity stays stable while the file
moves. Got: pick one. Eleven documents named abstract components and a twelfth
named files, 69 distinct against 9, **literal overlap zero** while several pairs
denoted the same artifact. Resolved by ruling that `constrains` names components
and paths move to `verifiedBy`.

**4. Reserved section prefixes force a rename citations cannot follow.**
`# Design Considerations` requires `DN`. This project's design principles are
`P1` to `P6` and are cited **360 times**. Wanted: a design note that *is* `P1`.
Got: the node is `DN1` and `P1` survives only in description text, so the graph
identifier and the code citations are now different strings for one thing, which
is the condition specl exists to remove. `item_prefix` does not help: it is one
value per specification, and the same document carries `D1`-`D15` and
`OQ1`-`OQ14`, also cited.

**5. `constrains` and `affects` disagree on bare names.**
`constrains` accepts a bare name and mints locally; `affects` refuses one. A
component named through both keys became two nodes 18 lines apart in one file,
which is the defect `UR23` prevents, reached from a direction the guidance does
not cover: not two specifications spelling a name differently, but two **keys**
with different minting rules on one spelling. Nothing warned.

**6. `specl:role` is declared functional and emits multiple values anyway.**
`core.ttl` declares `owl:FunctionalProperty`; repeated sub-bullets emit repeated
values and `validate` reports zero violations. No preference on which half is
wrong, but the multi-value path is the one this project needs: **38 of 76**
migrated requirements serve more than one persona.

---

## The scoring penalises honesty, and this is the item we would most like disposed

Reported separately from the contract-break list because it is not an
expressiveness limit. It is an incentive, and it points the wrong way.

`UR25` made the "should have `verifiedBy`" warning conditional: the shape fires
only when the graph already declares a `specl:Test` or `specl:AcceptanceQuery`.
For a specification that declares none, the check is silent. Sound as far as it
goes, and it does what `UR25` intended.

The consequence for a project **adopting** traceability was not anticipated.
Measured on one member of this family, adding `verifiedBy` to five requirements
and changing nothing else:

| | Before | After |
|---|---|---|
| requirements carrying `verifiedBy` | 0 | 5 |
| `verifiedBy` warnings | **0** | **26** |
| maturity | **89%** | **18%** |

The 26 new warnings are on requirements that were not touched. The first
`verifiedBy` in a specification switches the check on for every requirement
lacking one. A second member behaved identically: 85% to 26%.

**The reading is accurate. The incentive is backwards.** Those 26 requirements
genuinely have no test, and a specification that says so describes the software
better than one that stays silent. But a maintainer who adds a single line of
real traceability watches maturity fall 71 points, and the arithmetic tells them
to stop. A project optimising its number is strictly better off with **zero**
`verifiedBy` than with some, and the cliff arrives on the first one rather than
proportionally.

This matters more than an internal number because maturity is published.
`specl-validate badge` renders it, `RELEASING.md` puts it on a README, and 1.0.0
spent real effort on badge contrast and accessibility. A public badge that drops
by 71 points when a project starts telling the truth about its test coverage is
a strong signal aimed in the wrong direction.

Two things we are **not** saying. We are not asking for the warning to be
removed: 26 untested requirements is exactly what a reader should see. And this
is not the failure the drafting instructions warn about, where thin acceptance
criteria get written to raise a number. It is the mirror image, where the number
punishes a project for writing something true.

Offered as observation rather than proposal, but the shape of a fix seems
available: the conditional could scale with adoption rather than switch, so a
specification with 5 of 41 requirements traced scores above one with 0 and below
one with 41. That preserves everything `UR25` was for while removing the cliff.

If only one item in this report is dispositioned, we would choose this one.

## Where a clean result meant less than it looked

Three places where the toolchain was green and something was still wrong. These
are offered because each one cost real time to notice.

**A specification that lost 100% of its content validated clean.** The legacy
documents put their title at H1 and sections at H2. specl delimits on H1, so
the whole document read as one unrecognised section and every requirement was
discarded. `validate` then reported `Violations: 0  Warnings: 0` and `score`
reported `Maturity: 0% (0/0 items clean)`. The translate-time warning does say
the content was dropped, and `--fail-on-warning` catches it. The observation is
about the steps after: an item-less specification is indistinguishable, at
`validate` and `score`, from one nobody has written yet. For a bulk migration
those are the two states most worth telling apart, and `0/0` reads as the
innocent one.

**`verifiedBy` resolving is not `verifiedBy` existing.** Of 14 distinct targets
in the transferred specification, 5 existed, 3 did not, and 6 named a harness
never built. One target was the sentence "deferred with the merging capability",
which parses as happily as a path. One was a real defect: a test had moved
directories, so the claim was phantom. `layering` gained a path check for
vocabularies in 1.0.0 because "a misspelled class name is a valid IRI"; the same
reasoning applies to a path-shaped `verifiedBy`.

**The merged-family check is load-bearing, not a formality.** The
split-component defect above was found only by merging every member and grouping
local names across IRIs, exactly as the drafting instructions prescribe. Per
member, everything was clean. The guidance is right; the point is that a project
skipping that step would have shipped the defect.

---

## `layering` and shared personas

`cmd_layering` counts `affects`, `constrains`, `verifiedBy`, `supersededBy` and
`governs`. A resolved `role:` or `owner:` naming a peer is not counted.

Measured on the finished family:

| Property | References into the parent |
|---|---|
| `specl:role` | 136 |
| `specl:owner` | 11 |
| **total** | **147** |
| **checked by `layering`** | **0** |

Every member reports `Layering: 0 external reference(s) checked  Result: pass`,
so `--require-references` would fail all seven. Sharing personas and agents
through a parent is the pattern specl's own guidance prescribes to a family, and
a member whose only cross-specification link is that pattern produces zero
checkable references.

The failure message compounds it: `--require-references` reports "this
specification declares none". The specification declares one peer and names it
in `refines:`. The message states a count of checked item references as a fact
about what the specification declares.

---

## Documentation, one line each

- **`docs/SYNTAX.md` maps `# Design Considerations` to "auto-hash".** The parser
  requires `DN` and warns on anything else.
- **Peer `path:` resolves against the working directory, not the declaring
  file**, contrary to `docs/SYNTAX.md` and to the downstream drafting
  instructions. The same graph passes from one directory and reports
  inconclusive from another. This silently changes a gate result, and the
  instructions say to treat inconclusive as work to do.
- **`item_prefix` accepts compound identifiers**, so `RT1.1`, `RTUS1`, `RTD1`
  and `RTOQ1` each resolve to the class of their own section. This is what made
  a whole-specification relabel viable without losing the class reading of an
  identifier, and the documentation does not mention it.
- **`prefix` accepts lowercase and `item_prefix` does not.** The failure mode
  for getting it wrong is silent item loss rather than a rejected value: the
  prefix is ignored, every item carrying it then fails the identifier grammar,
  and the items are dropped with their sub-bullets.
- **Prose inside an item section cannot be excused item-by-item.**
  `<!--specl: prose-->` marks a whole section, and HTML comments are not
  stripped. A note between two requirements has no sanctioned form. The right
  answer turned out to be `itemStatus: withdrawn`, which the warning does not
  point at.
- **Identifier reuse across sections is emitted, not refused.** `- P1.` under
  Design Considerations and `- P1` under Personas produce one node with two
  classes and no violation.
- **The published 1.0.0 CHANGELOG duplicates its entire 1.0.0 section**, with
  "Release readiness" appearing twice carrying different content, and one entry
  describing six changes where its table lists ten.
- **The absolute-IRI behaviour is described as unreleased** in the downstream
  drafting instructions and in
  `docs/proposals/0003-g3t-component-identity-disposition.md`, while the
  CHANGELOG dates it inside 0.11.0. Downstream was told to install from git main
  on the strength of that framing.

**Where specl's source had to be read to proceed**, which is a documentation
defect by definition: `validate_spec.py` for the `layering` counting rules and
the working-directory resolution, `spec_to_rdf.py` for the `item_prefix`
grammar and the `MULTI_KEYS` comma-splitting set.

---

## Things that worked, recorded because they are not obvious

- **Absolute IRIs do exactly what `UR23` says.** Verified independently before
  drafting, then at family scale: `CanvasRenderer` is one node named by 7
  requirements across 4 members.
- **`itemStatus: withdrawn` is right for a bulk migration.** Two requirements
  had been deleted and replaced by prose notes. Restoring them as withdrawn
  reserved the identifiers permanently, kept the retirement reason in the graph,
  and cost nothing in maturity because retired items leave the measured
  population in 1.0.0.
- **`specl-migrate source` refused to guess.** It renamed the contract-1 keys
  and reported the persona values it could not resolve, exiting 3 rather than
  inventing. That is the correct behaviour and it was the right call.
- **Scale is not the problem `LIMITATIONS.md` predicts.** Two of the three
  stated limits are exceeded, seven members against a largest-known three and
  213 items against 120. Validation is 0.41s to 1.24s per member and scales with
  member size rather than family size; merging all seven and querying takes
  **0.08s**. The honest report is that the ceiling is untested, not tight.
