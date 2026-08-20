# Gate 2: capability inventory and shared-entity register

For AG2, to cut before any requirement text is written. Cutting an inventory
line is cheap; cutting a drafted requirement means superseding a commitment.

This document does the double duty the PROMPT requires: it is the cutting
sheet, it is the shared-IRI register a human greps for near-misses, and it
carries the shared-entity count specl asked for.

Gate 1 is still open. Nothing here depends on it. Bases and prefixes decide
what an entity is *called*; this decides which entities exist and which earn a
requirement.

---

## 1. The count specl asked for

Across the eleven legacy documents and routing, `constrains` names **187
targets, 78 of them distinct**. Grouped by the proposed member split:

| Named by | Count | Share |
|---|---|---|
| one member only | 60 | 77% |
| several members | **18** | **23%** |

The request predicted a minority and a minority is what it is. The eighteen,
with the members naming each:

| Members | Entity |
|---|---|
| 4 | `CanvasRenderer` |
| 3 | `DetailInspector`, `DocumentLinker`, `GraphAdapter`, `HolonicAdapter`, `WorkspaceManager` |
| 2 | `AlgorithmResultAdapter`, `ContextMenuManager`, `CytoscapeCanvas`, `ExportManager`, `LayoutEngine`, `MatrixRenderer`, `ProjectionPipeline`, `SchemaRenderer`, `StreamAdapter`, `TableRenderer`, `TreeRenderer`, `WorkingSetManager` |

**That 23% is not trustworthy, and the reason is the most important finding in
this gate.**

## 2. The family currently speaks two incompatible naming conventions

Legacy names **abstract components**. Routing names **files**. The overlap
between the two sets is **zero**, and it is zero by construction rather than
because they describe different things:

```
legacy  : CanvasRenderer, LayoutEngine, ProjectionPipeline, ...  (69 distinct, 0 file-shaped)
routing : structural-svg-view.tsx, structural.ts, g3t-routing.ts, ... (9 distinct, 9 file-shaped)
```

`structural-svg-view.tsx` **is** the structural rendering surface that legacy
calls `CanvasRenderer` and `CytoscapeCanvas`. `structural.ts` is what legacy
calls `LayoutEngine`. Under the current spellings they are four unrelated nodes.

This is exactly the defect the absolute-IRI work exists to prevent, arriving
through a door nobody was watching: not two specifications spelling one name
differently by accident, but two specifications using different *kinds* of name
by convention. Minting absolute IRIs on top of this would harden the split
rather than fix it.

specl names the underlying gap itself, in `LIMITATIONS.md`: "There is no
relation for a file as distinct from a software component or a vocabulary term.
Projects use `constrains` for all three." This family is a worked example of the
cost, and it goes in the observations report.

**This needs a ruling before any absolute IRI is written, and it is the one
Gate 2 item with a hard ordering constraint.** Three options:

- **Components, not files.** Routing's nine become component names. Fits
  `specl:Component`, which 1.0.0 kept as `constrains`' range deliberately.
  Costs routing nine edits and loses the file-level precision the assessment
  wants.
- **Files, not components.** Legacy's sixty-nine become paths. Precise and
  greppable, and directly checkable against the filesystem, which is how I
  found the defects in section 4. Costs a large legacy rewrite and many legacy
  components have no single file.
- **Both, deliberately.** Component in `constrains`, file recorded elsewhere.
  Needs a home specl does not currently provide.

Recommendation: **components in `constrains`**, with file paths carried in
`verifiedBy` (which is already path-shaped in routing) and in prose. It is the
cheaper migration, it matches the declared range, and the file-level precision
is recoverable from `verifiedBy` plus the assessment.

## 3. What the 76 legacy requirements actually rest on

The brief is explicit that the number worth watching early is not maturity but
how many requirements carry a real `verifiedBy`, because that is what says the
specification describes the software rather than an intention.

**Legacy `verifiedBy` count: zero. In all eleven documents.**

Evidence available to harvest, computed against the current checkout using the
repository's own citation-exclusion rules:

| Signal | Count of 76 |
|---|---|
| carries at least one acceptance criterion | 75 |
| carries **no** acceptance criterion | 1 |
| R-ID cited in a **test** file | **12** |
| R-ID cited in source only | 49 |
| R-ID cited nowhere at all | 15 |

Crossed against the status each requirement claims:

| Claimed status | Test-cited | Source only | Uncited |
|---|---|---|---|
| `implemented` (46) | **7** | 38 | 1 |
| `in-progress` (12) | 5 | 7 | 0 |
| `proposed` (18) | 0 | 4 | 14 |

So of 46 requirements claiming `implemented`, **7 have a test citation**. The
rest rest on the repository's own weaker rule, which credits a source citation
when a colocated test file exists anywhere in the same directory.

Under specl's vocabulary that maps honestly: `verified` needs a named passing
test, `implemented` means present and untested. **At most 12 of 76 can carry a
real `verifiedBy` on the day they are written**, and 15 requirements have no
evidence of any kind and should be read as candidates for the cut rather than
as descriptions of the software.

This is not an argument for writing thin acceptance criteria to raise a number.
It is the honest reading of documents written ahead of the code, and the brief
predicts it.

## 4. Routing has the opposite problem, and three defects

All **35 of 35** routing requirements carry `verifiedBy`. Checked against the
filesystem, the 14 distinct targets resolve like this:

- **5 exist**: `orthogonal-router.test.ts`, `structural.test.ts`,
  `layout-metrics.test.ts`, `structural-svg-view.test.tsx`, `prf.perf.test.ts`
- **3 do not**: `g3t-routing.test.ts` and `separation.test.ts` are unwritten,
  which is consistent with 0% progress. The third is a **defect**:
  `packages/core/src/layout/structural-patterns.test.ts` does not exist, but
  `packages/core/src/layout/g3t-engine/structural-patterns.test.ts` does. The
  path is simply stale.
- **6 name a harness that does not exist**: five `route-audit` targets, plus
  one reading "deferred with the merging capability", which is a sentence
  rather than an artifact.

Two of routing's nine `constrains` targets are also absent: `separation.ts` and
`edge-model.ts`. Both are future components, which is coherent for a
not-started specification.

Nothing checks any of this. `verifiedBy` records a name and specl verifies that
it resolves as an IRI, not that it points at a file that exists. A test that
moves directories becomes a phantom verification claim in silence. That goes in
the observations report.

**Legacy has tests without `verifiedBy`; routing has `verifiedBy` without
tests.** Neither half currently demonstrates what it claims.

## 5. Migration surface, measured on a real file

Trial-translated `08-security-deployment.md` under specl 1.0.0. Two findings,
in the order they appeared.

**As-is, the file translates to nothing and passes.** The documents put their
title at H1 and their sections at H2, and specl delimits sections on H1 only.
So the entire document reads as one unrecognized section:

```
warning: section 'Security and Deployment' is not a recognized heading and its content was dropped
wrote spec.ttl (1 parser warning(s))     EXIT 0
```

All five requirements were discarded. The resulting graph then reports
`Violations: 0   Warnings: 0`, exit 0, and scores `Maturity: 0% (0/0 items
clean)`. A migration that silently loses 100% of its content passes validation
cleanly. Only `--fail-on-warning` at the translate step catches it, which the
drafting instructions do mandate, and which is now the single most important
line in our loop. Observation filed.

**With headings promoted, the real surface appears**, and it is small:

- `asA:` (18) and `soThat:` (18) are contract-1 keys, unrecognized now. This is
  precisely what `specl-migrate source` exists to rewrite.
- `role:` carries prose, not persona identifiers, on all 76 requirements:
  `role value 'Platform Administrator' does not match the identifier grammar
  and names no external artifact type; emitted as a literal`.
- `gap:` (1) is not a recognized key in any contract.

**The persona set needs consolidating, and that is an owner decision.** Thirteen
distinct role names across 118 uses:

| Uses | Name | | Uses | Name |
|---|---|---|---|---|
| 29 | Frontend Developer | | 4 | Knowledge Engineer |
| 29 | Analyst | | 3 | Ontologist |
| 21 | Data Engineer | | 3 | MBSE Engineer |
| 9 | Platform Administrator | | 2 | Systems Engineer |
| 9 | Ontology Engineer | | 2 | Curator |
| 5 | Data Scientist | | 1 | Investigator |
| 4 | Plugin Developer | | | |

Several are plainly the same person: Ontology Engineer / Ontologist / Knowledge
Engineer / Curator; Analyst / Investigator / Data Scientist; Systems Engineer /
MBSE Engineer. Routing separately declares four personas of its own (Systems
engineer, Reviewer, Diagram author, Maintainer), of which "Systems engineer"
collides by name with a legacy role.

The parent declares the reconciled set once. **I am not picking it.** Note the
`P`-identifier collision documented in the Gate 1 plan: legacy `P1` to `P6` are
design principles cited 360 times, so the personas take a compound identifier
instead.

## 6. Evidence base available, in the brief's priority order

| # | Source | State |
|---|---|---|
| 1 | **Test suite** | 133 test files, 1367 cases, 428 describe blocks. The richest source and the one to work through first. Only 12 legacy requirements currently reach it by citation |
| 2 | `planning/g3l/prf-budgets.json` | 6 keys, frozen 2026-07-18. 4 assert now, 2 assert at-channel-router. GAP-017 established the routing keys aim outside the operating range; the same check is not yet done for the other four |
| 3 | **Public exports at 1.0.0, ESM-only** | 23 entry points, 521 exported symbols, recorded in `api-surface.json` and gated by `check-api-surface.mjs`. The package boundary is already a commitment |
| 4 | `AGENTS.md` and `llms.txt` | **Neither exists.** The brief expects both. Reported, not invented |
| 5 | G3L round records and PRF findings | `planning/g3l/`, `planning/` round logs. These become `# Decisions` items, not requirements |
| 6 | Source | Last, and only to settle what the above leave open |

Also absent: the **`route-audit` harness**, named in five routing `verifiedBy`
values. It is not in `scripts/` and not anywhere in the repository.

## 7. Recommended cuts, for your decision

Grouped by the earns-a-requirement test: would you want CI to fail if this
changed?

- **Cut candidates, 15 requirements cited nowhere and marked `proposed`.**
  No code, no test, no citation. These describe intent for capabilities that do
  not exist. Err toward too few: a missing requirement is an afternoon, a wrong
  one is a supersession.
- **Hold, 4 `proposed` requirements with source citations.** Partially begun;
  worth keeping if the work is queued.
- **Keep and harvest, 12 test-cited requirements.** These can carry a real
  `verifiedBy` and an honest `implementation:` on the day they are written.
  Work these first, per the brief.
- **Keep but downgrade, 38 `implemented` requirements with source citations
  only.** They map to `implementation: implemented`, not `verified`. This will
  make the family look less built than the prose claimed. That is the correct
  reading, not a regression.
- **Reassess after the routing assessment, all 35 routing requirements.**
  HANDOFF-003 owns this and it is deliberately out of scope here.

## 8. Deliberately not specified, as the brief requires

- **Everything the routing assessment touches.** The routing and legibility arc
  merged after the gap records were written, and HANDOFF-003's first task is
  establishing whether the specification still describes reality. Specifying a
  moving target produces requirements that are wrong before they are committed.
- **The `hitTestStructural` tolerance and tiebreak**, tracked by the
  architecture track as R-2. A scheduling dependency, not ours to design around.
- **`@g3t/core/events`.** Ruled a context-action command bus rather than a
  fourth integration channel on 2026-08-16, with the `eventBus` singleton
  deprecated. Specifying it would promote it by implication.
- **Anything gated on Gate 1.** Nothing in this document is, but the naming
  convention in section 2 must be settled before the first absolute IRI.

---

## RULING, AG2, 2026-08-19

| # | Item | Ruling |
|---|---|---|
| 1 | Naming convention for `constrains` | **Components**, with file paths carried in `verifiedBy` and in prose |
| 2 | The cut, and the 15 uncited `proposed` requirements | **Reassess after** |
| 3 | Persona set | **Reconcile the list.** Done below |
| 4 | 38 `implemented` requirements dropping to `implementation: implemented` | **Confirmed** |

### Item 1 as applied

`constrains` names software components only. This unblocks minting absolute
IRIs, which was the one hard ordering constraint in this gate.

Consequences to carry into drafting:

- Routing's nine file-shaped targets become component names. Two of the nine
  are not components at all and need a different home rather than a rename:
  `prf-budgets.json` is a versioned document and `prf.perf.test.ts` is a test.
  The test moves to `verifiedBy`, where it already appears. The document has no
  correct key and stays in `constrains` under protest, which is the second half
  of O8 and goes to specl as such.
- File-level precision is not lost, it moves. `verifiedBy` is already
  path-shaped in routing and stays that way, so the component-to-file mapping
  survives in the graph rather than only in prose.
- The four-way identity in section 2 collapses on drafting:
  `structural-svg-view.tsx` and `CytoscapeCanvas` and `CanvasRenderer` resolve
  to one component named by an absolute IRI, and the file path sits in
  `verifiedBy` beside the test that exercises it.
- The convention-normalised shared count can now be computed, which unblocks
  **F1's caveat and F3** in the observations log.

### Item 2 as applied, and one consequence worth stating once

Read as: hold the 15, do not cut them and do not draft them, revisit after the
routing assessment reports. That keeps them out of the graph without discarding
the intent they record.

The brief's reasoning runs the other way and it is worth stating once rather
than repeatedly: "cutting it is cheaper than cutting drafted requirements",
because a wrong requirement is a commitment that has to be superseded and
0.4.0's supersession machinery exists because that is expensive. Holding rather
than drafting avoids that cost entirely, so the deferral is safe **as long as
the 15 stay undrafted**. I will keep them in a holding list rather than letting
them drift into a draft, and raise them again with the assessment.

### Item 3, the reconciled persona set

Reconciled from usage rather than from the names. The discriminating test used:
a persona earns its own identity if it appears on a requirement **alone**, or if
its requirement set is thematically distinct from every persona it co-occurs
with. Five legacy names failed it, and one merges across the legacy-routing
boundary.

**Seventeen names in, eleven out.**

| Identifier | Persona | Absorbs | Evidence for the merge |
|---|---|---|---|
| `PER1` | Analyst | Investigator, Data Scientist | Neither appears alone; both appear only alongside Analyst, on 6 requirements |
| `PER2` | Systems Engineer | MBSE Engineer, routing P1 | Never alone. R1.16/R1.18 pair Systems Engineer with SHACL and UML structural views, which is routing P1's "reads a structural diagram to understand composition" |
| `PER3` | Ontology Engineer | Ontologist | Ontologist appears only on R1.16/R1.17/R1.18, all SHACL and UML modelling. A spelling, not a role |
| `PER4` | Knowledge Engineer | Curator | Curator appears twice, both alongside Knowledge Engineer, on entity pages and change history |
| `PER5` | Data Engineer | | Distinct throughout |
| `PER6` | Frontend Developer | | The host integrator. 29 uses, dominant in `ux` |
| `PER7` | Plugin Developer | | Extension author, distinct from the integrator |
| `PER8` | Platform Administrator | | Deployment and security. Carries all 5 `security` requirements |
| `PER9` | Reviewer | routing P2 | Checks a diagram against the model it claims to depict. No legacy equivalent |
| `PER10` | Diagram Author | routing P3 | Arranges a diagram for legibility. No legacy equivalent |
| `PER11` | Maintainer | routing P4 | Maintains the toolkit and diagnoses its output. An internal persona, distinct from every consumer one |

Compound identifiers per the Gate 1 ruling, because legacy `P1` to `P6` are
design principles cited 360 times and personas cannot take `P`. Verified:
`PER1` resolves to `specl:Persona` and `role: PER1` resolves against it.

**One merge to push back on if you disagree.** `PER3` Ontology Engineer and
`PER4` Knowledge Engineer are kept separate, and the signal is ambiguous rather
than clean: they never co-occur, which reads either as two distinct roles or as
one role named inconsistently across files. Their requirement sets do differ
thematically, schema modelling and validation against curation and write-back
history, so I kept them. Merging them would take the set to ten and would be
defensible.

The parent declares all eleven once. No peer redeclares any of them; peers
reference `g3t:PER1` and so on, per the brief.

### Item 4 as applied

Accepted. When the family first scores, requirement progress will read lower
than the prose claimed, because 38 requirements that currently claim
`implemented` on a source citation will carry `implementation: implemented`
rather than `verified`. That is the specification describing the software
accurately, not a regression, and the number to watch instead is how many carry
a real `verifiedBy`, which starts at 12 of 76.

---

## Now unblocked

Every Gate 1 and Gate 2 question is settled. Drafting can begin, in this order:

1. Convert routing's `constrains` to component names and renumber it under
   `item_prefix: RT` (Gate 1 item 6).
2. Draft the parent: personas `PER1` to `PER11`, agents, the design principles
   `P1` to `P6` from `00-overview.md`, decisions from `09-design-decisions.md`,
   open questions from `10-open-questions.md`.
3. Migrate the six peers with `specl-migrate source`, then the residue:
   headings to H1, `status:` to `implementation:`, `role:` prose to `g3t:PER*`
   CURIEs, `constrains` to absolute IRIs where shared.
4. Compute F1-normalised and F3 for the observations log.
5. Verify per member and across the family, then `pnpm run gates`.

Holding, not drafted: the 15 uncited `proposed` requirements, per item 2.
