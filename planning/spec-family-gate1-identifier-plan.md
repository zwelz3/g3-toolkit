# Gate 1: identifier plan for the g3-toolkit specification family

For AG2. Bases are permanent from the moment anything cites them, and only a
designated breaking release may move an IRI, so this document asks for a
ruling rather than reporting a choice. HANDOFF-003 is explicit on one of these:
"`spec_base` ... Raise it with AG2; do not pick one."

Nothing in `specs/routing/` has been edited. The specification was landed
verbatim so its front matter can be written once, after this gate, rather than
twice.

## Toolchain state, verified rather than assumed

specl **1.0.0** released 2026-08-19 and is on PyPI. The drafting instructions'
"install from git main, not PyPI or a tag" is obsolete: it existed only because
`UR23` was unreleased at the time of writing. Installed in a venv outside the
repository at `/home/vscode/.venv-specl`.

| Check | Result |
|---|---|
| `specl-validate conformance` | 7 findings, 7 expected. "This processor applies the shapes as intended." Exit 0 |
| Absolute IRI shared across two specifications | **One** node, named by two requirements. Confirmed by merged SPARQL, not by reading the changelog |
| Bare name spelled identically in two specifications | **Two** unrelated nodes, one under each `spec_base`. The defect this family guards against, reproduced |
| `owner:` / `role:` CURIE into a peer | Resolves to a peer IRI. 1.0.0 declares `specl:owner a owl:ObjectProperty ; rdfs:range prov:Agent` |
| Routing spec under 1.0.0 | Translates with **0 warnings**, validates **0 violations**, maturity **95%**, progress 0%, 70 items |
| Shipped `spec.ttl` vs 1.0.0-regenerated | **Byte-identical**. Emission is stable across 0.11.0 to 1.0.0 for this specification |

Two corrections to the package's own documents, both harmless but worth
recording so nobody re-derives them:

- The drafting instructions and the disposition describe the absolute-IRI
  behaviour as unreleased and post-`v0.11.0`. The snapshot's own CHANGELOG
  dates it **inside** 0.11.0, tagged 2026-08-16. The behaviour is what matters
  and it is verified above.
- The provided `specl-main` snapshot predates 1.0.0 and is stale where it
  counts: its `LIMITATIONS.md` still carries an "An owner is a literal" section
  claiming `specl:owner` is a datatype property. 1.0.0 removed that section and
  the property is an `owl:ObjectProperty`. **The brief and the disposition were
  right; the snapshot was wrong.** No contradiction survives, and this drops off
  the observations report.

## The situation the brief did not anticipate

`specs/` already holds eleven specl-flavored documents carrying **76
requirements**, currently governed by three homegrown Python gate scripts
rather than by specl. All three green as of now, including with
`specs/routing/` landed, because all three glob `specs/*.md` non-recursively
and never see a subdirectory.

Their R-IDs are load-bearing: **191 occurrences across 77 files** in
`packages/*/src` and `scripts/`, and **179 occurrences** in `roadmap/`.
`sync_spec_status.py` and `check_roadmap_coverage.py` both key on them.

That count is what rules out the brief's instruction to split the family by
package. Re-filing 76 requirements across `core`/`react`/`charts` renumbers
them and invalidates 370 citations plus two gate scripts, in exchange for
locality the `constrains` target already provides. The instruction was written
for a greenfield family and does not survive contact with this repository.

---

## a) Host

**Recommendation: `https://w3id.org/g3t/`.**

You asked whether the directory in the w3id repository can be named
`G3-Toolkit` while the URI reads `g3t`. It cannot: in `perma-id/w3id.org` the
directory name **is** the top-level path segment, and each directory holds an
`.htaccess` and a `README.md`. What you can have is the short URI with the
project name in the human-readable layer, which is what that `README.md` is
for. Register the directory `g3t`; put "G3-Toolkit" in its README and as an
`.htaccess` comment.

Registering a second directory `g3-toolkit` that redirects to `/g3t/` is
possible and I recommend against it: it mints a second permanent identifier for
one thing, and eventually someone writes it into a `spec_base`.

A hard constraint from `docs/SYNTAX.md`: a base must carry a path segment
rather than being a bare authority, so `https://w3id.org/g3t#` is rejected
outright and no graph is written. Every base below needs a segment.

Cost of this choice: routing's placeholder `https://spec.g3-toolkit.dev/routing#`
moves once, now. Nothing cites it yet, so this is the cheapest moment it will
ever move. The alternative, adopting `spec.g3-toolkit.dev` as real, keeps
routing's base unmoved but ties permanent identifiers to a domain registration,
which is the failure mode w3id exists to prevent.

Precedent to follow rather than improvise: specl registered its own namespace
on w3id for 1.0, and its release documentation carries the upstream path, the
ordering constraint (Pages live before redirects merge), and a post-merge
`curl` verification loop.

## b) Member split

Both candidates preserve every R-ID and leave every file where it is. Neither
touches the 370 citations.

**Candidate 1, one member per document.** Nine members plus parent. Maximum
granularity, maximum permanent bases, and every member scores independently.

**Candidate 2, grouped with `companion_files`. Recommended.** Six members plus
parent. `companion_files` is the sanctioned mechanism for splitting *one*
specification across several files, which is what these pairs are. Files stay
at their current paths, R-IDs survive, and the family mints roughly half as
many permanent identifiers.

| Member | Prefix | Root file | Companions | Reqs |
|---|---|---|---|---|
| parent | `G3T` | new `specs/g3t/spec.md` | absorbs `00`, `09`, `10` | 0 |
| functional | `G3TFUNC` | `01-functional-views.md` | `02-functional-interaction.md` | 34 |
| technical | `G3TTECH` | `03-technical-data-layer.md` | `04-technical-projection.md` | 15 |
| integration | `G3TINT` | `05-integration-holonic.md` | `06-integration-connectors.md` | 11 |
| ux | `G3TUX` | `07-ux-defaults-accessibility.md` | none | 11 |
| security | `G3TSEC` | `08-security-deployment.md` | none | 5 |
| routing | `G3TROUTING` | `specs/routing/spec.md` | none | 35 |

The parent absorbs `00-overview.md` into Intent, Purpose and Design
Considerations, `09-design-decisions.md` (D1 to D12) into `# Decisions`, and
`10-open-questions.md` into `# Open Questions`. It also declares the personas
and agents **once**, which every peer then references by CURIE. None of those
three files carries an R-ID, so nothing is renumbered by folding them.

Routing joins as a peer. Its `refines:` target is a Gate 1 sub-question I would
rather you settle than assume: routing specialises the structural rendering
surface, which under this split sits inside `functional`. `refines: G3TFUNC` is
the honest reading. `refines: G3T` is the safer one if you expect the
structural surface to move.

Bases, under the recommended candidate:

```
https://w3id.org/g3t/spec/g3t#
https://w3id.org/g3t/spec/functional#
https://w3id.org/g3t/spec/technical#
https://w3id.org/g3t/spec/integration#
https://w3id.org/g3t/spec/ux#
https://w3id.org/g3t/spec/security#
https://w3id.org/g3t/spec/routing#
```

## c) Prefix convention

The routing specification declares `prefix: G3TR`; the drafting instructions'
example uses `G3ROUTING`. `prefix` is not part of any IRI, so changing it costs
nothing now and cannot be changed cheaply once peers declare it.

**Recommendation: the long form, `G3T`-stem plus area**, as tabulated above.
`G3TR` is one character from `G3T` and the two would sit adjacent in every
`references:` block in the family.

## d) Shared namespaces

The disposition asks whether the 2.0 component map should carry one namespace
or several. Proposing three, to be confirmed or collapsed by the Gate 2 count
rather than by argument:

```
https://w3id.org/g3t/components#     software components
https://w3id.org/g3t/tests#          test suites and cases
https://w3id.org/g3t/documents#      versioned JSON documents, budget files
```

specl 1.0.0 argues for "several" by construction: it added a `governs:`
annotation and a `vocabularies:` front-matter key precisely so a vocabulary
term stops being smuggled through `constrains`, whose range remains
`specl:Component` deliberately. So a fourth category, ontology terms, already
has a first-class home and must **not** land in a components namespace.

This split is also directly relevant to the legacy migration: the existing
specs mix component names and RDF/SHACL class references in single `constrains:`
lists, which is the exact case 1.0.0 cites as its motivation.

## e) The R-ID collision, which needs a ruling

**30 of routing's 35 R-IDs collide by spelling with legacy R-IDs**: R1.1 to
R1.3, R2.1 to R2.5, R3.1 to R3.4, R4.1 to R4.3, R5.1 to R5.5, R6.2 to R6.4,
R7.1 to R7.3, R8.1 to R8.4.

In the graph this is harmless: the bases differ, so the IRIs differ. In the
repository it is not. `sync_spec_status.py` and `check_roadmap_coverage.py`
match bare R-IDs, so once routing enters their scope, routing's R2.3 and
`02-functional-interaction.md`'s R2.3 become the same string.

**Recommendation, revised after testing: renumber routing with `item_prefix`.**

An earlier draft of this document recommended a prefix-qualified citation
convention instead, teaching the two gate scripts to key on `PREFIX:RID`.
Testing showed renumbering is both cheaper and stronger, so that recommendation
is withdrawn. It removes the ambiguity at the source rather than teaching two
scripts to tolerate it, and every argument against renumbering turns out not to
apply here.

The mechanism is specl-native. Declaring `item_prefix: RT` in routing's front
matter makes its requirements `RT1.1` through `RT9.2`:

```yaml
prefix: G3TROUTING
item_prefix: RT
```

Verified, not assumed:

- **`item_prefix` coexists with reserved prefixes.** The class comes from the
  section heading, not from the identifier, so routing's `US1` to `US5`,
  `D1` to `D5`, `OQ1` to `OQ6`, `Q1` to `Q5` and `DN1` to `DN7` keep their
  conventional identifiers untouched. Only the colliding section changes.
  Confirmed in the emitted Turtle: `spec:RT1.1 a specl:Requirement`,
  `spec:D2 a specl:DecisionRecord`, `spec:US1 a specl:UserStory`.
- **Internal cross-references follow.** `affects:` and `gates:` resolve to
  `spec:RT1.1`, `spec:RT9.2` and so on, as IRIs rather than unresolved
  literals.
- **The result is measurably identical.** 0 parser warnings under
  `--fail-on-warning`, 0 violations, maturity 95%, 70 items, same per-class
  breakdown as before.
- **It is provably a pure rename.** Reversing the substitution on the generated
  Turtle and diffing against the original leaves exactly three kinds of
  difference: the intended `prefix`/`itemPrefix` values, every `sourceLine`
  shifted by +1 because front matter gained a line, and one auto-derived
  `dct:title` eliding two characters earlier because `RT2.3` is one character
  longer than `R2.3` inside the requirement text. No triple changes
  structurally and no relationship breaks.

Edit surface: **69 R-ID tokens in one self-contained file**. 35 defining
bullets, 3 in-bullet references inside other requirements' text (`RT3.1`,
`RT6.4`, `RT7.1` each cite another requirement in their own sentence), 23
tokens across 10 `affects:`/`gates:` lines, and 8 prose mentions.

**Why the cost is zero right now, which will not stay true.** The brief says
routing's item IRIs are permanent and rewriting them is "a graph break for no
gain". That is correct about a published graph and does not bind here, for
three independent reasons:

1. Routing's `spec_base` is a placeholder that **must** move at this gate
   anyway. Moving the base already rewrites all 70 item IRIs. Renumbering in
   the same change adds no IRI churn that is not already happening.
2. The knowledge base cites **zero** R-IDs. `gaps/`, `decisions/`,
   `techniques/`, `implementations/`, `measurements/` and `backlog/` are all
   clean; the dependency runs the other way, with the specification citing
   record ids such as GAP-015 and MEA-002.
3. The routing-related sources carry no R-ID citations either.
   `orthogonal-router.ts`, `g3t-routing.ts`, `structural-svg-view.tsx` and
   `layout-metrics.ts` are clean, and `structural.ts` cites only `R1.18`, a
   legacy requirement correctly attributed to `specs/01-functional-views.md`.

So nothing outside `specs/routing/spec.md` names a routing R-ID today. That
window closes the moment the assessment starts citing evidence against these
requirements, which is why this belongs at Gate 1 rather than after it.

### Relabel the other item classes too, and D is the reason

Routing's `D1` to `D5`, `OQ1` to `OQ6` and `US1` to `US5` also collide by
spelling with legacy `D1` to `D15`, `OQ1` to `OQ14` and `US1` to `US8`. None of
this is visible to `sync_spec_status.py` or `check_roadmap_coverage.py`, which
match `\bR\d+\.\d+\b` and nothing else, so the harm is to human and grep
readability rather than to a gate.

That still matters, because the collision lands on the most-cited identifiers
in the repository. Counting only the colliding range, legacy `D1` to `D5` carry
**25 citations in package source** (D1 eleven, D3 six, D2 five, D5 two, D4 one),
plus `D`-range references across `roadmap/`, `planning/`, `CLAUDE.md` and
`STATUS.md`. Routing's `D3` is "coincidence treated by separation rather than
merging"; legacy `D3` is "the right-click context menu is the primary
interaction surface". `OQ` is similar, heavily referenced from `roadmap/`.
`US` is nearly inert. `Q1` to `Q5` and `DN1` to `DN7` do not collide with
anything, since no legacy document uses those prefixes.

**The mechanism extends cleanly, which I did not expect.** `item_prefix`
accepts compound identifiers, so the section's reserved letter can be kept
inside the prefixed form and the class stays readable from the identifier:

```
RT1.1   -> specl:Requirement
RTUS1   -> specl:UserStory
RTD1    -> specl:DecisionRecord
RTOQ1   -> specl:OpenIssue
```

Verified with a probe: all four resolve to the correct class under a single
`item_prefix: RT`, a cross-section `affects: RT1.1` on `RTD1` resolves to an
IRI, and translation emits zero warnings.

**Recommendation: relabel all five, including the two that do not collide.**
The edit surface is trivial and there is no cross-reference churn to speak of:
`US` 5 tokens, `D` 5, `OQ` 6, `Q` 5, `DN` 7, and each is exactly one token per
defining bullet, because nothing inside the routing specification references
its own decisions, stories, questions, queries or design notes by identifier.
28 token edits, no resolution to re-verify. Relabelling `Q` and `DN` costs 12 of
those 28 and buys uniformity; leaving them is the worst of both, since a reader
then has to remember which classes were prefixed and which were not.

`P1` to `P4` and `AG1` to `AG3` need no relabelling: they are deleted from
routing entirely and replaced by parent CURIEs as part of joining the family.

Recommend also keeping routing out of `lint_specs.py`'s glob regardless.
Its `ID_TOKEN` covers `US`, `OQ` and `D`, and its cross-reference check would
resolve routing's identifiers against the union of legacy ones. specl's own
`layering` and `validate` now cover what that script was written to
approximate.

### A collision the parent has with itself, found on the way

Not a routing question, but it is an identifier question and it is cheaper to
know now.

Legacy `00-overview.md` declares **P1 through P6 as design principles** under
`## Design Considerations`, and they are the most-cited identifiers in the
repository: **360 references** across package source, `scripts/`, `roadmap/`,
`planning/`, `specs/`, `CLAUDE.md` and `STATUS.md`. The parent absorbs that
document. The parent must also declare the family's **personas**, which specl
identifies with `P`.

Reproduced: a specification declaring `- P1.` under `# Design Considerations`
and `- P1` under `# Personas` emits **one node carrying two classes**:

```
spec:P1 a specl:DesignNote ;
spec:P1 a specl:Persona ;
```

It is not refused. It surfaces only as a parser warning, which
`--fail-on-warning` would catch, and the warning names the prefix mismatch
rather than the collision.

Two further facts bearing on the fix:

- Personas accept compound identifiers the same way items do. `PER1` resolves
  to `specl:Persona` and `role: PER1` resolves to it correctly. So the personas
  can move off `P` and the 360 citations need not be touched.
- `# Design Considerations` expects prefix `DN`, not the auto-hash that
  `docs/SYNTAX.md` documents for that section. So keeping the principles as
  `P1` to `P6` warns, and warns under a rule the documentation does not state.
  Logged as a `SYNTAX.md` defect for the observations report.

This wants a decision at drafting rather than now, but the shape of it is:
personas take a compound identifier, the principles keep `P1` to `P6`, and the
residual `DN` prefix warning on the principles is resolved separately.

**One external casualty, accepted.** `HANDOFF-003-spec-ownership.md` names
`R1.1` and `R8.1` through `R8.3` in its cross-track ownership table. Preserving
the numbers across the rename, `R2.3` to `RT2.3` rather than resequencing,
keeps that document readable by mechanical substitution. It is held outside the
repository and should be annotated rather than rewritten.

---

## Two findings that change how this gets wired into CI

**1. `layering` does not count shared personas and agents, and its failure
message says something false.**

`specl-validate layering` counts only `affects`, `constrains`, `verifiedBy`,
`supersededBy`, and `governs`. A resolved `role:` or `owner:` pointing into a
peer is never counted. Reproduced with a two-specification probe: a child
declaring `references: PP` and `refines: PP`, reaching the parent through
`owner: PP:AG2` and `role: PP:P1`, reports

```
Layering: 0 external reference(s) checked
Result: fail. --require-references was given and this specification declares none
```

It declares one. It names it in `refines:`. The message describes the count of
checked item references and states it as a fact about what the specification
declares.

The consequence for us is concrete: the brief's prescribed pattern is to
declare personas and agents once in the parent and reference them from peers.
A peer whose only cross-specification link is that pattern will fail
`--require-references`. So `--require-references` cannot be applied blanket
across the family, only to members that genuinely reach a peer's items. This
also goes to specl as an observation.

**2. specl's own scale note.** 1.0.0's `LIMITATIONS.md` states "the largest
specification specl has translated is roughly 750 lines and 120 items, and the
largest family is three." Routing alone is 70 items. This family will be seven
members carrying 111 requirements (76 legacy plus 35 routing), before stories,
decisions, personas and design notes are counted. Not a blocker, but it means
we are the scale test, and slowness in SHACL validation is the predicted first
symptom.

---

## RULING, AG2, 2026-08-19

| # | Item | Ruling |
|---|---|---|
| 1 | Host `w3id.org/g3t`, directory `g3t`, "G3-Toolkit" in its README | **Accepted** |
| 2 | Member split: candidate 2, grouped, six members plus parent | **Accepted** |
| 3 | Routing's `refines:` target | **Not settled.** Resolved below on delegated authority |
| 4 | Prefix convention | **Lowercase preferred**, no other preference. Applied below, with one forced exception |
| 5 | Shared namespaces: components, tests, documents | **Accepted**, revisit against F2 |
| 6 | Renumber routing under `item_prefix` | **Accepted** |

### Item 4 as applied, and the one place it cannot be honoured

Tested rather than assumed. `prefix:` accepts lowercase: `prefix: g3t`
translates with zero warnings and a lowercase CURIE resolves correctly, with
`constrains: g3t:R1.1` emitting the peer's IRI.

`item_prefix:` does not. `check_item_prefix` requires "two or more uppercase
ASCII letters" and refuses anything else. The refusal is not contained: the
prefix is ignored, every item carrying it then fails the identifier grammar,
and **the items are dropped along with their sub-bullets**. One lowercase
requirement produced five warnings and vanished from the graph.

So the family reads lowercase everywhere the format allows, and uppercase in
the one place it does not:

| Member | `prefix` | `item_prefix` | Base |
|---|---|---|---|
| parent | `g3t` | none | `https://w3id.org/g3t/spec/g3t#` |
| functional | `g3tfunc` | none | `https://w3id.org/g3t/spec/functional#` |
| technical | `g3ttech` | none | `https://w3id.org/g3t/spec/technical#` |
| integration | `g3tint` | none | `https://w3id.org/g3t/spec/integration#` |
| ux | `g3tux` | none | `https://w3id.org/g3t/spec/ux#` |
| security | `g3tsec` | none | `https://w3id.org/g3t/spec/security#` |
| routing | `g3trouting` | **`RT`** | `https://w3id.org/g3t/spec/routing#` |

Only routing declares an `item_prefix`, because only routing is being
renumbered. The legacy members keep their reserved prefixes and their 370
citations.

Shared namespaces, per item 5:

```
https://w3id.org/g3t/components#
https://w3id.org/g3t/tests#
https://w3id.org/g3t/documents#
```

F2 in the observations log reports that all 18 shared entities are software
components, so `tests#` and `documents#` are currently justified by one
singleton each rather than by observed sharing. Recommend declaring all three
anyway: they cost nothing unused, and the alternative is minting a second
namespace later for something already named under the first.

### Item 3 resolved: `refines: g3t`

The answer was "sure?" rather than a choice, so this is settled on delegated
authority and is cheap to revisit before anything cites it.

Routing refines the **parent**, not `functional`. Three reasons, in order:

1. `refines` should be stable, and the structural rendering surface is not.
   `DEC-001` retired the Cytoscape structural path and the SVG view is
   currently sole surface; that is exactly the kind of boundary that moves.
   Pointing at `functional` bets on it not moving.
2. Routing's own Purpose section disclaims most of what `functional` covers:
   "Layout and node placement, hit testing, the graph exploration views, data
   loading, the SysML and SHACL adapters, and the toolkit's public API surface
   are all outside it." It specialises the product, not the archetype-view
   catalogue.
3. `functional` is the largest member at 34 requirements and the most likely to
   be split later. A `refines` edge into it would have to move with any split.

The cost is that `layering` cannot catch a routing reference reaching into
`functional`'s items, since neither is declared upstream or downstream of the
other. Acceptable: routing names no `functional` item today, and O1 already
establishes that `layering`'s coverage here is narrower than it appears.

## What was asked

1. Host: `w3id.org/g3t`, with the directory named `g3t` and "G3-Toolkit" in its
   README. Yes or no.
2. Member split: candidate 2, grouped, six members plus parent. Yes, or
   candidate 1.
3. Routing's `refines:` target: `G3TFUNC` or `G3T`.
4. Prefix convention: long form, `G3TROUTING` rather than `G3TR`. Yes or no.
5. Shared namespaces: three (`components`, `tests`, `documents`), revisited
   against the Gate 2 count.
6. R-ID collision: renumber routing to `item_prefix: RT`, `R2.3` becoming
   `RT2.3`, leaving its `US`/`D`/`OQ`/`Q`/`DN` items and all 370 legacy
   citations untouched. Yes or no. This is the only item here with an expiry:
   it is free until something cites a routing R-ID.

No requirement text is written and no front matter is edited until this is
settled.
