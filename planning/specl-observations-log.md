# Running observations log for specl

Feeds the Phase E observations report to specl's intake. Written as
observations, not proposals; disposition is specl's.

Kept as a running log because the PROMPT is explicit that the highest-value
finding is the one easiest to lose: "the natural reaction to a tool that will
not express something is to rephrase until it does. When you rephrase, write
down what you wanted to say first."

specl 1.0.0 opened its one-year governance window on 2026-08-19. A registered
adopter's substantive objection blocks a 2.0 change rather than being outvoted,
and silence at the close is assent, so **registering g3-toolkit as an adopter
precedes filing this**.

---

## O1. `layering` never counts shared personas or agents, and says so falsely

`cmd_layering` counts `affects`, `constrains`, `verifiedBy`, `supersededBy`
and `governs`. A resolved `role:` or `owner:` naming a peer's item is not
counted.

Reproduced with a two-specification probe. The child declares
`references: PP` with a readable `path:`, declares `refines: PP`, and reaches
the parent twice, through `owner: PP:AG2` and `role: PP:P1`. Both resolve
correctly in the emitted Turtle:

```
specl:owner <https://probe.invalid/specs/p#AG2> ;
specl:role  <https://probe.invalid/specs/p#P1> ;
```

`specl-validate layering c/spec.ttl --require-references` reports:

```
Layering: 0 external reference(s) checked
Result: fail. --require-references was given and this specification declares none,
so nothing was checked.
```

The specification declares one peer and names it in `refines:`. The message
states the count of checked item references as a fact about what the
specification declares, which is a different claim and a false one.

Why it matters beyond wording: sharing personas and agents through a parent is
the pattern specl's own guidance prescribes to a family. A peer whose only
cross-specification link is that pattern cannot satisfy `--require-references`,
so the flag cannot be applied family-wide, which is the wiring the flag was
added for.

## O2. `LIMITATIONS.md` scale note versus a real family

1.0.0 states "the largest specification specl has translated is roughly 750
lines and 120 items, and the largest family is three."

**Measured, now that the family is drafted and translating clean.** Seven
members, **213 items**, 2,459 merged triples:

| Class | Count |
|---|---|
| Requirement | 113 |
| UserStory | 23 |
| DecisionRecord | 21 |
| OpenIssue | 20 |
| DesignNote | 13 |
| Persona | 12 |
| Agent | 6 |
| AcceptanceQuery | 5 |

Two of the three stated limits are exceeded: the family is seven members
against a largest-known three, and 213 items against a largest-known 120. The
largest single member is routing at 63 items, below the 120 line.

**Cost is not the problem the note predicts.** Validation is 0.41s to 1.24s per
member and scales with member size rather than family size, since each member
validates alone. Merging all seven into one `rdflib` graph and querying it takes
**0.08s**. On this evidence SHACL-over-in-memory is comfortable at roughly
double the documented ceiling, and the honest report is that the limit is
untested rather than tight.

## O3. Documentation defects observed in passing

- The published 1.0.0 CHANGELOG duplicates its entire 1.0.0 section. Several
  subsections appear twice with identical text, and "Release readiness" appears
  twice carrying **different** content. One entry describes six changes where
  its table lists ten.
- The downstream drafting instructions and
  `docs/proposals/0003-g3t-component-identity-disposition.md` describe the
  absolute-IRI behaviour as unreleased and landing after `v0.11.0`. The
  CHANGELOG dates it inside 0.11.0, tagged 2026-08-16. Downstream was told to
  install from git main on the strength of that framing.

## O4. `# Design Considerations` expects `DN`, documented as auto-hash

`docs/SYNTAX.md` lists the section map as:

| `# Design Considerations` | DesignNote | auto-hash |

The parser expects `DN`. A bullet identified `P1` under that section emits
`warning: P1 in 'Design Considerations' does not match prefix ('DN',)`. The
documented prefix column and the implemented one disagree, and the difference
is load-bearing for a project migrating documents that already number those
items under another letter.

## O5. Identifier collision across sections is emitted, not refused

A specification declaring `- P1.` under `# Design Considerations` and `- P1`
under `# Personas` emits one node carrying two classes:

```
spec:P1 a specl:DesignNote ;
spec:P1 a specl:Persona ;
```

No violation is raised. The only signal is the O4 prefix warning, which names
the prefix mismatch rather than the collision, so a section pair whose prefixes
both happen to be correct would produce this silently. Found while migrating a
repository whose design principles are numbered `P1` to `P6` and cited 360
times, into a parent specification that must also declare personas.

Recorded as an observation rather than a proposal: the disposition of whether
same-base identifier reuse across sections should be a shapes violation is
specl's.

## O6. A specification that loses all its content validates clean

Migrating a document whose title is H1 and whose sections are H2 (specl
delimits on H1 only) produces one unrecognized section and discards every item:

```
warning: section 'Security and Deployment' is not a recognized heading and its
content was dropped
wrote spec.ttl (1 parser warning(s))          exit 0
```

Five requirements were lost. The resulting graph then reports
`Violations: 0   Warnings: 0`, exit 0, and scores
`Maturity: 0%  (0/0 items clean, priority weighted)`.

The translate-time warning does say the content was dropped, and
`--fail-on-warning` catches it. The observation is about the steps after: a
specification carrying zero items is indistinguishable, at `validate` and
`score`, from a new specification nobody has written yet. For a project
migrating existing documents in bulk, those are the two states most worth
telling apart, and 0/0 reads as the innocent one.

## O7. `verifiedBy` resolving is not `verifiedBy` existing

`LIMITATIONS.md` says provenance is recorded rather than verified, and that a
verification claim means a name resolves. Worked example of the cost, found in
a real specification:

`packages/core/src/layout/structural-patterns.test.ts` is named in `verifiedBy`.
It does not exist. `packages/core/src/layout/g3t-engine/structural-patterns.test.ts`
does. The test moved directories and the claim became phantom in silence.

Of 14 distinct `verifiedBy` targets in that specification, 5 exist, 3 do not,
and 6 name a harness that has never been built. One target is the sentence
"deferred with the merging capability", which parses as happily as a path does.

Nothing in `translate`, `validate`, `score` or `layering` distinguishes these.
`layering` gained a path check for vocabularies in 1.0.0 on the reasoning that
"a misspelled class name is a valid IRI"; the same reasoning applies to a
path-shaped `verifiedBy` value, and a project that writes them as paths gets no
benefit from it.

## O8. Two naming conventions for `constrains`, one family

`LIMITATIONS.md` states: "There is no relation for a file as distinct from a
software component or a vocabulary term. Projects use `constrains` for all
three." A worked example of what that costs a family, rather than a single
specification.

Eleven documents in this family name abstract components (`CanvasRenderer`,
`LayoutEngine`); a twelfth names files (`structural-svg-view.tsx`,
`structural.ts`). 69 distinct targets against 9, and the literal overlap is
**zero** while several pairs denote the same artifact.

**What was wanted before rephrasing.** The intent was to say "this requirement
constrains the structural rendering surface, whose implementation is currently
`packages/react/src/views/svg/structural-svg-view.tsx`" as one statement with
two parts, so the component identity stays stable while the file moves. There
is no way to express that. The rephrase is to pick one and lose the other, and
the family is about to pick components and lose file-level precision.

1.0.0 solved the adjacent case by adding `governs:` plus `vocabularies:` rather
than widening `constrains`' range. The file-versus-component case looks like the
same shape of problem with no equivalent key.

---

## O9. Peer `path:` resolves against the working directory, not the file

`docs/SYNTAX.md` and the downstream drafting instructions both state that the
`path` under `references:` is relative to the file declaring it. It is resolved
relative to the process working directory.

Same graph, same declaration, two results:

```
$ cd chi && specl-validate layering spec.ttl
Layering: 1 external reference(s) checked
Result: pass                                            exit 0

$ cd .. && specl-validate layering chi/spec.ttl
  [unresolved]   g3t: peer not readable at ../par/spec.ttl
Result: inconclusive. A peer that could not be read is never a pass.   exit 3
```

This is worse than a documentation defect because it silently changes a gate
result. A family whose declarations are all correct reports inconclusive when
the check runs from the repository root, which is where CI runs it, and the
drafting instructions say to treat inconclusive as work to do rather than as a
pass. The failure mode is someone spending a day correcting declarations that
were right.

## O10. `prefix` accepts lowercase; `item_prefix` does not

`prefix: g3t` translates with no warning and a lowercase CURIE resolves
correctly: `constrains: g3t:R1.1` emits
`<https://probe.invalid/specs/par#R1.1>`.

`item_prefix: rt` is refused with "must be two or more uppercase ASCII letters;
ignored". The consequence is not just that the prefix is dropped: every item
carrying it then fails the identifier grammar and **the items are dropped with
their sub-bullets**, five warnings for one requirement.

Not argued as a defect, since `check_item_prefix` documents the reasoning and
the single-letter space is deliberately reserved. Recorded because the two keys
sit adjacent in front matter, differ in a rule neither name suggests, and the
failure mode for getting it wrong is silent item loss rather than a rejected
value. A project with a lowercase house style, which is the case here, hits
this immediately.

## O11. `specl:role` is declared functional and emits multiple values anyway

`core.ttl` declares `specl:role a owl:FunctionalProperty`, so at most one value
is permitted. The annotation key reference agrees, listing `role` as "single"
while `acceptance` and `verifiedBy` are "multiple sub-bullets".

Repeated sub-bullets emit repeated values regardless:

```
- role: PER1
- role: PER2
```

```
spec:R1.2 specl:role spec:PER1 ;
          specl:role spec:PER2 ;
```

`specl-validate validate --explain` reports `Violations: 0`. Nothing in the
shapes enforces the functional declaration, so a graph that is OWL-inconsistent
by its own vocabulary passes.

Recorded without a preference on which half is wrong. The multi-value path is
the one this project needs, since **38 of 76 requirements serve more than one
persona**, so the useful outcome would be relaxing the declaration rather than
enforcing it. But a project reading `core.ttl` would conclude the opposite and
design around a limit that is not enforced.

Adjacent and easy to trip over: `role` is not in `MULTI_KEYS`, so
`role: PER1, PER2` on a single sub-bullet does **not** comma-split. It emits
the literal `"PER1, PER2"` and warns that the value "does not match the
identifier grammar". `constrains`, `affects`, `gates` and `governs` do split on
commas. Two reference-valued keys, adjacent in the same bullet, with opposite
comma behaviour and no signal in the key name.

## O12. Reserved section prefixes force a rename that citations cannot follow

`# Design Considerations` requires the `DN` prefix (see O4). This project's six
design principles are identified `P1` to `P6` and cited **360 times** across
source, roadmap, planning and agent-facing documentation.

**What was wanted before rephrasing.** To say "this design note *is* P1", with
the item keeping the identifier every reader and every citation already uses.

**The rephrase.** The items become `DN1` to `DN6` and the string `P1` is
demoted into the description text, so the 360 citations remain findable by grep
but no longer name the node. The identifier in the graph and the identifier in
the codebase are now different strings for the same thing, which is the
condition specl exists to remove.

`item_prefix` does not help: it is one value per specification, and the parent
also carries `D1` to `D15` and `OQ1` to `OQ14`, both cited, which would have to
move under it too.

## O13. `constrains` and `affects` disagree on bare names, and one component split

`constrains` accepts a bare name and mints a node under the naming
specification's own base. `affects` refuses one: a bare value "does not match
the identifier grammar and names no external artifact type" and is emitted as a
literal with a warning. So the two reference-valued keys have opposite defaults
for the same kind of value.

The consequence is not theoretical. In this family one component finished up as
two nodes **inside a single specification**:

```
  - constrains: PresetRegistry
  - affects: https://w3id.org/g3t/components#PresetRegistry
```

```
https://w3id.org/g3t/components#PresetRegistry
https://w3id.org/g3t/spec/technical#component-PresetRegistry
```

Both lines are 18 lines apart in the same file. The author wrote the same name
twice and got two nodes, which is the exact defect `UR23` exists to prevent,
reached from a direction the absolute-IRI guidance does not cover: not two
specifications spelling a name differently, but two **keys** with different
minting rules applied to one spelling.

Nothing warns. `translate --fail-on-warning`, `validate`, `score` and
`layering` were all clean with the split present. It was found only by merging
the family and grouping local names across IRIs, which is the check the
drafting instructions prescribe, so the guidance is sound; the point is that
the check is load-bearing rather than a formality.

## O14. The whole family's cross-member linkage is invisible to `layering`

O1 measured on a probe. Measured on the real family, seven members:

| Property | References into the parent |
|---|---|
| `specl:role` | 136 |
| `specl:owner` | 11 |
| **total** | **147** |
| **checked by `layering`** | **0** |

Every member reports `Layering: 0 external reference(s) checked  Result: pass`,
so `--require-references` would fail all seven. A family that shares its
personas and agents through a parent, which is the pattern specl's own guidance
prescribes, produces exactly zero checkable references.

## O15. Peer paths must be written for the caller, not the file

Consequence of O9 in practice. Because `path:` resolves against the working
directory, the routing member's declaration had to change from

```
    path: ../g3t/spec.ttl        # correct relative to the file that declares it
```

to

```
    path: g3t/spec.ttl           # correct relative to specs/, where the check runs
```

The first is what `docs/SYNTAX.md` describes and it is now wrong on disk. The
value is no longer a property of the two files it relates; it is a property of
where the operator stands. A family whose members sit at different directory
depths cannot satisfy both readings at once.

## O16. Prose inside an item section cannot be excused item-by-item

`<!--specl: prose-->` marks a whole section as deliberate prose. There is no
per-block form, and HTML comments are not stripped: wrapping a note in
`<!-- ... -->` still produces
`section 'Requirements' contains prose that produced no Requirement,
starting '<!--'`.

So a note sitting *between* two requirements in a Requirements section has no
sanctioned form. Marking the section prose would discard the requirements in it.

This project hit it twice, on retirement notes reading "Formerly requirement 1.9
of this file, removed from the roadmap 2026-06-12". The resolution turned out to
be better than the note: specl models this natively with
`itemStatus: withdrawn`, which reserves the identifier permanently and stops the
shapes evaluating the item, so `R1.9` and `R7.5` came back as real items instead
of prose about absent ones.

Recorded because the diagnosis took a while and the warning points the wrong
way. It names the two escapes that do not work here, an identified bullet or a
section marker, and not the one that does. A line in `docs/SYNTAX.md` connecting
"prose about a removed requirement" to the retirement section would have saved
the detour.

## O17. A requirement cannot reference another requirement

The reference-valued keys are `constrains` and `verifiedBy` and `governs` on a
requirement, `affects` on a decision, `gates` on an acceptance query, and
`supersededBy` on any item. None of them says *this requirement depends on that
requirement*, and `affects` is a decision-record key rather than a general one.

So a dependency between requirements has nowhere to go but the description
text, where nothing resolves it and `layering` cannot see it. Counted in this
family after migration: **18 cross-member requirement references living only in
prose**, such as

> R4.3 ... The Schema view (**R1.5**) SHOULD run with Type Collapse disabled.

| From | To | Count |
|---|---|---|
| ux | functional | 5 |
| technical | functional | 4 |
| integration | functional | 4 |
| integration | technical | 3 |
| functional | technical | 1 |
| security | functional | 1 |

**What was wanted before rephrasing.** `R4.3 dependsOn g3tfunc:R1.5`, as a
triple, so the family's real coupling is in the graph and `layering` checks it.

**The rephrase.** Leave it in the sentence. The consequence is precise and
unwelcome: this is exactly the relation `specl-validate layering` exists to
police, and in a seven-member family every instance of it is invisible to the
check. `dependsOn` exists at specification scope but not at item scope, so a
family can declare that one member is upstream of another and cannot say which
items make it so.

A second-order effect worth naming: `functional` and `technical` reference each
other, 4 one way and 1 the other. Declaring either upstream of the other would
make the reverse direction a violation, so the family cannot layer its two
largest members relative to each other at all. Whether that is a specification
smell or a modelling limit is not resolvable from inside the format, because
the evidence for it is prose.

## O18. No way to name a set of components

`constrains`, `affects` and `governs` each name one thing. There is no way to
say that a decision or a requirement reaches **a set** of components, and the
sets a real specification names are not incidental.

Seven such values in this family, all on decision records, all now demoted to
prose:

| Decision | Value |
|---|---|
| D2 | `all renderers` |
| D4 | `all renderers that support size/color encoding` |
| D11 | `All renderers` |
| D13 | `All view components` |
| D14 | `all view components` |
| D15 | `all canvas-hosting views` |
| D15 | `consumers passing decoration props` |

**What was wanted before rephrasing.** `D2 affects <the set of all renderers>`,
as a triple, so that adding a renderer later inherits D2 without anyone
remembering to edit D2. That is the whole value of the claim: it is a standing
rule about a category, not a list of the members that happened to exist the day
it was written.

**The rephrase.** The names moved into each decision's `rationale`, which is
free prose. A fact that was structured is now unstructured, and the inheritance
property is gone: a renderer added tomorrow is not reached by D2 in the graph,
and nothing will notice.

Two things make this different from O8 and O17 rather than a duplicate of them.
First, the enumerable workaround is wrong even when it is available: writing out
today's seven renderers converts a standing rule into a snapshot that silently
goes stale. Second, the collectives here are **not** all the same shape.
`all renderers` is a class of component; `consumers passing decoration props` is
a class of *downstream user*, which is not a component at all.

**A shape that would work, offered as observation rather than proposal.** Nothing
in this needs a new class. `constrains` already has range `specl:Component`, and
a set of components is a component's supertype rather than a different kind of
thing. So a project could declare the category as an ordinary component and
relate its members to it, if the vocabulary carried one relation for membership:

    - R1.1 ... constrains: https://ns/components#CanvasRenderer
    - CanvasRenderer memberOf https://ns/components#Renderers
    - D2 affects: https://ns/components#Renderers

Then `affects` and `constrains` need no change at all, and traversal answers
"what does D2 reach" by following `memberOf` inward. The cost is one property.

**What g3-toolkit can do without waiting.** The same shape is expressible today
in a project-owned vocabulary, because `governs:` plus `vocabularies:` already
accepts terms specl does not own. A `g3t` ontology could declare `Renderers`,
`ViewComponents` and `CanvasHostingViews` as classes with the concrete
components as instances, and decisions could reach them through `governs:`
rather than `affects:`. That is a real option and it is being recorded rather
than taken, for two reasons: `governs:` is documented as naming a vocabulary
term whose *meaning* an item constrains, which is not the same claim as
affecting every member of a set, and inventing a parallel component ontology to
work around a missing property is the kind of thing that is easy to start and
hard to retire.

## O19. Partial `verifiedBy` adoption is penalised, heavily

`UR25` made the "should have `verifiedBy`" warning conditional: the shape fires
only when the graph already declares a `specl:Test` or `specl:AcceptanceQuery`.
The intent, unblocking `production` for a specification that declares no
verification artifacts, is sound. The consequence for a project **adopting**
traceability is not.

Measured on one member of this family, before and after adding `verifiedBy` to
five requirements and changing nothing else:

| | Before | After |
|---|---|---|
| requirements carrying `verifiedBy` | 0 | 5 |
| `verifiedBy` warnings | **0** | **26** |
| maturity | **89%** | **18%** |

The 26 warnings are on requirements that were not touched. The first
`verifiedBy` in a specification switches the check on for every requirement
lacking one, so honestly recording the evidence that does exist costs 71 points.
A second member behaved the same way: 85% to 26%.

**The reading is correct and the incentive is backwards.** 26 of that member's
requirements genuinely have no test, and a specification that says so is more
accurate than one that stays silent. But a project optimising the number is
better off adding **no** `verifiedBy` than adding some, and the cliff arrives on
the first one rather than gradually. A maintainer who adds one line of
traceability and watches maturity fall 71 points learns the wrong lesson.

Recorded without a preferred fix, though a shape of one seems available: the
same conditional could scale with adoption rather than switch, so that a
specification with 5 of 41 requirements traced scores better than one with 0 and
worse than one with 41.

Worth naming what this is not. It is not the drafting instructions' warning
about thin acceptance criteria written to raise a number. It is the opposite
failure: the number punishing a project for writing something true.

## Retracted

**`owner:` literal versus IRI.** Carried as a suspected contract-level
contradiction after reading the pre-1.0 snapshot's `LIMITATIONS.md`, which had
a section titled "An owner is a literal" stating `specl:owner` is a datatype
property joinable only by string equality. 1.0.0 removed that section and
declares `specl:owner a owl:ObjectProperty ; rdfs:range prov:Agent`, and the
probe confirms it emits an IRI. The brief and the disposition were correct and
the stale snapshot was not. Recorded here only so it is not re-derived.

## Worked, and worth recording as such

`itemStatus: withdrawn` did exactly what a bulk migration needs. Two legacy
requirements had been deleted and replaced by prose notes; restoring them as
withdrawn items reserved the identifiers permanently, kept the retirement
reason in the graph rather than in a comment, and, because retired items leave
the measured population in 1.0.0, cost the members nothing in maturity.

`item_prefix` accepts compound identifiers. Under `item_prefix: RT`, the tokens
`RT1.1`, `RTUS1`, `RTD1` and `RTOQ1` each resolve to the class of their own
section, and a cross-section `affects: RT1.1` on `RTD1` resolves to an IRI.
Personas accept the same treatment: `PER1` resolves to `specl:Persona` and
`role: PER1` resolves against it.

This is what made a whole-specification relabel viable without losing the class
reading of an identifier, and `docs/SYNTAX.md` does not say it is possible. It
is the difference between one shared numbering sequence and a per-section one.

---

# The four figures specl asked for

The drafting instructions name four things as worth more than anything else
that could be sent back, because they are what the 2.0 component map cannot be
designed without. All four are answered below, on the drafted family.

## F1. Distinct shared entities, counted rather than estimated

Measured across the eleven legacy documents and the routing specification,
grouped by the member split the family adopted (parent plus six peers).

| Figure | Value |
|---|---|
| `constrains` occurrences | **187** |
| distinct entities named | **78** |
| named by exactly one member | 60 (77%) |
| **named by several members** | **18 (23%)** |

The request predicted a minority and the prediction holds at 23%. The eighteen,
by how many members name each:

- 4 members: `CanvasRenderer`
- 3 members: `DetailInspector`, `DocumentLinker`, `GraphAdapter`,
  `HolonicAdapter`, `WorkspaceManager`
- 2 members: `AlgorithmResultAdapter`, `ContextMenuManager`, `CytoscapeCanvas`,
  `ExportManager`, `LayoutEngine`, `MatrixRenderer`, `ProjectionPipeline`,
  `SchemaRenderer`, `StreamAdapter`, `TableRenderer`, `TreeRenderer`,
  `WorkingSetManager`

**Whether the split kept it that way, which the instructions also ask.** The
split was not free to choose: it preserves the existing document boundaries
because the requirement identifiers are cited 370 times across the repository.
So 23% is what an inherited, concept-based split produces, not what a
package-based one would. It is a data point about a real constraint rather than
about an optimal division.

**Re-measured after the O8 naming ruling, on the drafted family.** The ruling
(components in `constrains`, file paths to `verifiedBy`) collapsed the
legacy-versus-routing spelling split, so this is now a count over one
convention rather than two:

| Figure | Before the ruling | Drafted family |
|---|---|---|
| distinct entities in `constrains` | 78 | **77** |
| named by several members | 18 (23%) | **18 (23%)** |

**The share did not move, and that is the finding.** Collapsing the convention
split merged the pairs but did not create new cross-member sharing, because
routing's components turned out to be genuinely routing-local: `SceneRouter`,
`SeparationSolver`, `OrthogonalRouter`, `EdgeModel` are named by no other
member. The prediction of a minority survives contact with a real family at
23%, twice measured, by two different routes.

Counting `affects` as well as `constrains`, which the drafted parent uses
heavily for its decision records, the family carries **94 component IRIs: 43 in
the shared namespace and 51 minted locally** under a single member's base. 46%
shared on that broader measure, so the answer is sensitive to whether decision
records count, and the 2.0 map should be designed knowing that.

## F2. Whether shared entities fall into categories

The instructions ask this because the map should carry several namespaces
rather than one if the answer is yes. Categorising all 78 distinct entities:

| Category | Distinct | Shared |
|---|---|---|
| software component | 69 | **18** |
| file naming a component | 7 | 0 |
| versioned document (`prf-budgets.json`) | 1 | 0 |
| test artifact (`prf.perf.test.ts`) | 1 | 0 |

Every one of the 18 shared entities is a software component. So on this
family's evidence, **one namespace would be sufficient for what is actually
shared today**, and the case for several rests on the two singletons rather
than on observed sharing.

Two qualifications that matter more than the raw table:

- A document and a test are both sitting in `constrains`, whose range is
  `specl:Component`. They are there because nothing else models them. That is a
  categorisation the format forced rather than one the project chose, so the
  table understates how many categories the project believes it has.
- `verifiedBy` carries the test artifacts properly and was counted separately.
  The routing specification names 14 distinct verification targets, of which 6
  are not artifacts at all but descriptions of a harness and, in one case, the
  sentence "deferred with the merging capability".

Recommendation implied by the data rather than asserted: the map wants at least
a component namespace and a document namespace, and the test case is already
served by `verifiedBy`.

## F3. Absolute-IRI verbosity, as a count

**Answered.** The family is drafted and translates clean, so these are counts
rather than estimates.

| Figure | Value |
|---|---|
| absolute-IRI **occurrences** written across the family | **166** |
| distinct IRIs behind them | 43 |
| characters spent on absolute IRIs | 7,790 |
| characters if the same names were bare | 2,478 |
| **overhead the 2.0 map would remove** | **5,312 characters, 68%** |
| namespace prefix repeated per occurrence | 32 characters |

Occurrences, not distinct IRIs, is the figure that matters: the map shortens
every writing of a name, and names are written 166 times for 43 components,
just under four times each. Two thirds of every reference-valued line that
names a shared component is namespace.

Distribution is uneven and worth noting for the map's design. The two
subdirectory members carry 72 of the 166 between them, because routing names
components densely and the parent's decision `affects` reach broadly. A
per-project namespace would shorten all of them equally; a per-category one
would not, since all 43 are components.

## F4. Anything that needed a contract break

Four candidates, each carrying the "what was wanted before rephrasing" note the
instructions ask for. Ranked by how much the rephrase cost.

1. **O17, no requirement-to-requirement reference.** Wanted:
   `R4.3 dependsOn g3tfunc:R1.5`. Rephrase: leave the coupling in a sentence.
   18 instances in this family, all invisible to the check written to police
   exactly this. Arguably ahead of O8 now.
2. **O18, no way to name a set of components.** Wanted: `D2 affects <all
   renderers>` as a standing rule that new renderers inherit. Rephrase: prose,
   which loses the inheritance entirely. 7 instances. One added property,
   membership, would fix it without touching `affects` or `constrains`.
3. **O8, no relation for a file distinct from a component.** Wanted: name the
   component and its current implementing file as one statement with two parts.
   Rephrase: pick one, lose the other. The family picked components and lost
   file-level precision, recovering part of it through `verifiedBy`.
4. **O12, reserved section prefixes.** Wanted: a design note that *is* `P1`.
   Rephrase: the node is `DN1` and `P1` survives only as description text, so
   the graph identifier and the 360 code citations are now different strings
   for one thing.
5. **O13, `constrains` and `affects` disagree on bare names.** Not an
   expressiveness limit but a minting inconsistency that silently split a
   component into two nodes. Cheap to fix and expensive to find.
6. **O11, `specl:role` declared functional.** Wanted: this requirement serves
   the analyst *and* the systems engineer. Expressible only by repeating the
   sub-bullet, which contradicts the vocabulary's own declaration. **38 of 76**
   migrated requirements needed it.

O1, O5, O6, O7, O9 and O14 are defects or documentation gaps rather than
expressiveness limits.

## Still to gather

- The routing assessment (HANDOFF-003) will set `implementation:` per routing
  requirement against evidence. Today all 35 are `not-started` by inheritance,
  not by measurement.
- Whether any further observation emerges while the repository's own gate
  scripts are reconciled to the migrated format.

Nothing else is outstanding: F1 through F4 are answered, and O2's cost figures
are measured rather than predicted.
