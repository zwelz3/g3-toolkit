# g3-toolkit Status

**As of:** 2026-08-17 (active: **the routing/legibility feature arc and
the audit-remediation arc are now on one tree.** `ai-agent-guide` merged
with `fable-updates`; the two forked from one commit on 2026-08-14 and
did disjoint work, so entries dated across the two arcs are concurrent,
not sequential.

HARDENING (audit remediation CLOSED except item 23, **against the
pre-merge tree**: no audit pass ever saw the feature branch). Item 19
ruled branch A: the packages publish ESM ONLY. The `require` condition
is gone from all 23 exports entries, `main` is gone from all three
manifests, the vite builds emit `formats: ["es"]`, and zero .cjs files
ship. Rationale: typed CJS never worked (TS1479 from one ESM-flavored
.d.ts per entry), nothing in the repo required a @g3t package, and
TS1479 was the only thing preventing a consumer from mixing formats and
duplicating the exported store singletons. Paired .d.cts was REJECTED as
fixing the compile error while worsening the hazard. Guarded in
tests/dist/public-api.test.ts. Also landed: 15 subpath exports withdrawn,
the published surface frozen as a golden file (`api-surface.json` plus
`verify:surface`), adapter request hygiene (timeout, cancel,
`AdapterHttpError`), one failure convention for the versioned-JSON
channel (`model/document-errors.ts`), a uniform store channel,
`ViewErrorBoundary`, `TimelineView` on its own subpath with vis-* as
OPTIONAL peers, whole-tree lint, the community files, and a rehearsable
release path. E2E: the 12 failures are fixed and the suite is RETARGETED
off the deprecated Cytoscape renderer onto SVG. **E2E was confirmed
green locally and in CI 2026-08-16 (PR #2) on the hardening branch; it
has NOT been re-run on this merged tree.**

FEATURES (briefs 01-18, from `ai-agent-guide`). Routing: the nudging
post-pass (`nudge`, still OPT-IN, default false), the long-edge
perimeter policy with the VR-10 travel-band collision fix (8 violations
to 0 across the 108-cell sweep), LAY-005 dummy chains, the
corridor-supply contract, the additive channel-router module (its flag
still off by default after 05b measured it regressing crossings 2-8x),
and `routeEdges` on `CytoscapeCanvas` for non-structural scenes.
Legibility: dense-scene pseudo-nodes and force-directed edge bundling.
Data: RDF 1.2 triple-term ingest in `SparqlAdapter` plus the hyperarc
and edge projections, and holon boundary projection. Export:
`buildImageExport` (PNG). Style: `labelWrapRule`. Demo:
`src/demo/DemoLanding.tsx` now registers ELEVEN scenarios (Routing Lab,
RDF 1.2 Hyperarcs and Legibility Lab joined the eight), and the repo
root carries the AI-agent guides `llms.txt` and `AGENTS.md`.

MERGE RESOLUTION, the parts worth knowing. The five inert structural
layout options stay removed and `nudge` stays. A duplicated RDF 1.2
declaration block was deleted from `SparqlAdapter`: the same commits
landed on both branches, git merged two identical copies, and the
resulting `TS2300` was invisible because conflict markers suppress
semantic diagnostics program-wide. Ten new exports were WITHDRAWN before
the surface was refrozen, on the 2026-08-15 ruling (undocumented, no
consumer); six more were kept and DOCUMENTED instead. `api-surface.json`
refrozen at 34 additions across 5 entries and ZERO removals, the zero
being what proves no hardening-side withdrawal was lost. All four budget
gates re-measured rather than merged, since both branches raised caps in
parallel off one baseline: core 209 KB (measured 206.3), react 397
(393.9), `core-layout` 69 (66.0), `core-all` 182 (178.9). `core-ugm`
held at 4.8 KB, so no routing code became reachable from `UGM` alone.
The `@g3t/layout` (ARC-009) extraction stays retired.

v1.0.0 still UNTAGGED and deliberately held until the latent MRs land
(owner, 2026-08-16); this merge is one of them.

REMAINING: (1) **Zach's visual review** of routing, bundling and the
three new shells in one Pages playground session. Nothing in the gate
covers rendered output; the orthogonal-on-force look is the review
target and the per-shell `ROUTE_EDGES` constants revert individually.
(2) E2E on the merged tree. (3) Audit item 23 (phase 2), never run,
covering typing, performance, memory, bundle delivery, accessibility and
concurrency. **The audit artifacts were RESTORED from backup 2026-08-16
and the audit is RESUMABLE**: state.json is v2, 4/10 stages complete,
123 confirmed phase-1 findings, next stage `structure-p2`, 21 pass
instances left. Two corrections that restoration forced: the 23 roadmap
items are a prioritized synthesis of 25 deduped top findings, NOT the
123 findings themselves; and phase-1 coverage was never exhaustive,
since 7 of 11 passes hit the findings cap with roughly 27 findings seen
and unwritten, putting the true phase-1 total nearer 154.)

## PRIOR SNAPSHOT (2026-08-16 remediation round)


**As of:** 2026-08-16 (active: **audit remediation CLOSED except 23.**
Item 19 ruled branch A: the packages publish ESM ONLY. The `require`
condition is gone from all 23 exports entries, `main` is gone from all
three manifests, the vite builds emit `formats: ["es"]`, and zero .cjs
files ship (44% less runtime JS). Rationale: typed CJS never worked
(TS1479 from one ESM-flavored .d.ts per entry), nothing in the repo
required a @g3t package, and TS1479 was the only thing preventing a
consumer from mixing formats and duplicating the exported store
singletons. Paired .d.cts was REJECTED as fixing the compile error
while worsening the hazard. Guarded in tests/dist/public-api.test.ts.
E2E: the 12 failures are fixed and the suite is RETARGETED off the
deprecated Cytoscape renderer onto SVG; verified by running it against
the production bundle (49 passed; the rest fail only on this
container's blocked font CDN). **E2E CONFIRMED GREEN locally and in CI
2026-08-16 (PR #2)**, which closes that verification. v1.0.0 still
UNTAGGED and deliberately held until the latent MRs land (owner,
2026-08-16). REMAINING: item 23 (phase 2), never run and covering
typing, performance, memory, bundle delivery, accessibility and
concurrency. **The audit artifacts were RESTORED from backup 2026-08-16
and the audit is RESUMABLE**: state.json is v2, 4/10 stages complete,
123 confirmed phase-1 findings, next stage `structure-p2`, 21 pass
instances left. Two corrections that restoration forced: the 23 roadmap
items are a prioritized synthesis of 25 deduped top findings, NOT the
123 findings themselves; and phase-1 coverage was never exhaustive,
since 7 of 11 passes hit the findings cap with roughly 27 findings seen
and unwritten, putting the true phase-1 total nearer 154.)

## PRIOR SNAPSHOT (2026-08-15 remediation round)

**As of:** 2026-08-15 (active: audit remediation items 17, 20 and 21
CLOSED; 18 PARTIAL; 19 needs an owner ruling. Adapters honor or reject
`depth` instead of discarding it, and algorithm ingest reports
matched-versus-supplied counts. Five layout options that had reached no
engine since elkjs left are removed, with the docs that described them
and five perf "tuning variants" that were measuring nothing. The event
bus is ruled a context-action command bus, NOT a fourth integration
channel; 13 never-emitted event types deleted, `eventBus` singleton
deprecated. FIRST COVERAGE NUMBER EVER COLLECTED: 84.63% stmts / 75.90%
branch, reported not gated. `passWithNoTests` removed and it caught an
empty describe block that had been reporting as a pass. All 16 inert
screenshot assertions and every e2e `isVisible()` guard are gone.
Measured on native Linux: verify green including verify:exports at the
default timeout, full suite ~4.5 min on one vCPU. v1.0.0 still UNTAGGED.
REMAINING: **e2e has been red since roughly 2026-07-20 and the CI job is
blocking, so the whole CI signal is being ignored** (owner is supplying
the findings); then item 19's format ruling, then phase 2.)

## PRIOR SNAPSHOT (2026-08-06 register)

**As of:** 2026-08-06 (active: register R-15/R-16/R-17 answered:
capability-gated editor controls (and the same over-promise fixed
in StructuralNodeStyle itself), FloatingLegend elements
descriptor, and a new verify:typeref gate that found three
unreachable public types beyond the one reported. 1,433 tests
exit-0. v1.0.0 still UNTAGGED. REMAINING: the owner's review
walk.)

## PRIOR SNAPSHOT (round 21)

**As of:** 2026-08-05 (active: round 21 full text answered: R-12
all four parts (structural applier with stated precedence,
renderer-neutral editor target, size REPORTED per their option 2
rather than my provisional option 3, controlled drag offsets) and
R-13.3 (one legend serving both renderers). 1,428 tests exit-0.
v1.0.0 still UNTAGGED. REMAINING: the owner's review walk.)

## PRIOR SNAPSHOT (2026-08-05 register)

**As of:** 2026-08-05 (active: the 2026-08-05 register: R-10
(affordance presses no longer pan; screen-space slop reversing my
model-unit error), R-9 (pinch zoom + controlled view transform +
proportional wheel), R-11 (row glyphs), R-13 correctness half
(override selectors + legend disclosure). R-12 SCOPED, not
started, pending its full text. Their re-measurement confirms the
R-4 fix: 34/34 views differ, 900 to 826 bends. 1,419 tests
exit-0. v1.0.0 still UNTAGGED; all of this is release content.
REMAINING: the owner's review walk.)

## PRIOR SNAPSHOT (2026-08-03 register)

**As of:** 2026-08-03 (active: consolidated upstream register
answered: R-4 as shipped in 1.0.0 was a MEASURED NO-OP (consumer
found it; my oracle did not discriminate) and is now real and
oracle-pinned; a latent CI flake in the determinism test fixed
(anytime layout vs wall-clock budget); R-5 plain-node glyphs and
two-line headers, R-6 anchor forwarding, R-7 relayoutAroundFixed,
R-8 pie shape suppression. 1,406 tests exit-0. NOTE: 1.0.0 has
NOT been tagged; these fixes fold into the release rather than
following it. REMAINING: the owner's review walk.)

## PRIOR SNAPSHOT (v1.0.0 release prep)

**As of:** 2026-08-03 (active: v1.0.0 RELEASE PREP executed: the
consumer-facing gaps closed (typed CSS entry point, Install
section, docs/consuming-g3t.md), verify:package gate added (77
entry points), stability/deprecation policy stated, versions
bumped rc.2 -> 1.0.0. Gates green. REMAINING BEFORE TAG: owner's
deferred review walk (supply first, then MBSE under the SVG
default), and the two owner decisions if they change the release
shape (registry publishing was deferred; the publish workflow is
tag-driven and ready when it is not).)

## PRIOR SNAPSHOT (Round 66)

**As of:** 2026-07-28 late (active: G3L Round 66 executed: the
round-17 upstream requests, all four adopted: R-1 drag-suppressed
clicks (a real bug on the now-default SVG surface), R-2 glyph
slots with their own hit zone, R-3 two-line headers, R-4
anchor: source|target with a corrected diagnosis (fans already
spread; the gap was ordering input). 1,395 tests exit-0; e2e
68/14. NEXT: the owner's deferred review walk (supply first, then
MBSE under the SVG default).)

## PRIOR SNAPSHOT (Round 65b)

**As of:** 2026-07-28 late (active: G3L Round 65b executed: the
round-6 upstream report dispositioned: containment prop
content-keyed (the REAL snap-back gap their static suspicion
found), multi-type promoted to @g3t/react, compound verification
matrix (headless), TreeView onSelect, inspector titleAccessory;
two items already resolved post-round61 (legend delegation,
subtle :active overlay). 1,387 tests exit-0; e2e 68/14. NEXT: the
owner's deferred review walk (supply first, then MBSE under the
SVG default with an eye on flicker).)

## PRIOR SNAPSHOT (Round 65)

**As of:** 2026-07-28 late (active: G3L Round 65 executed: the
three owner directives: (1) cytoscape-structural deprecated (SVG
default in the MBSE shell, @deprecated prop + dev warning; the
filed drag flicker lives in the deprecated path and may dissolve
with the SVG default); (2) congestion sizing first increment
(exact port demand + degree fan floor, oracle-pinned); (3)
docs/structural-patterns.md with five recipes whose guarantees
run as the executable pattern-oracle suite. 1,383 tests exit-0;
e2e 68/14. NEXT: owner review walk (supply guard fix from 64e
first), then flicker re-check under the SVG default, then the
filed upstream backlog.)

## PRIOR SNAPSHOT (Round 64e)

**As of:** 2026-07-28 late (active: G3L Round 64e executed: the
owner's walk findings: MY 64b guard regression root-caused and
fixed (group-keyed validateAssembledElements; supply restored);
legend star/barrel glyphs drawn + rect grown; matrix square via
inner div (td ignores aspect-ratio); stats chart de-theme-blinded;
parametric PORT pairs snap within their own bodies (my
container+port change had regressed the verified straightening);
IBD edge labels moved to the opposite quadrant from port labels.
FILED: IBD drag flicker (sticky-face mechanism identified).
Owner: publishing deferred, d.ts queued. 1,376 tests exit-0; e2e
68/14. NEXT: owner re-walk (supply above all), then the flicker
fix and the filed upstream backlog.)

## PRIOR SNAPSHOT (Round 64d)

**As of:** 2026-07-28 evening (active: G3L Round 64d executed:
G3 all four mechanisms (charts fill via CSS-length height,
datagrid natural width + host scroll, pageSize 16, matrix cells
square UP via aspect-ratio); edge labels END-ANCHORED at the
target with perpendicular offset (was the middle vertex = a
bend); parametric value properties as container + EAST port.
1,371 tests exit-0; e2e 68/14. The owner batch of 2026-07-28 is
now fully dispositioned; open: owner re-verifies (fresh IBD look,
VR-2 revert + legend, 64c/64d walk), the two parked decisions
(registry publishing, d.ts round ordering), and the filed
upstream items.)

## PRIOR SNAPSHOT (Round 64c)

**As of:** 2026-07-28 evening (active: G3L Round 64c executed:
VR-9 lead fixed (router-failure fallback detours around the
obstacle band instead of drawing through it; helper unit-tested
+ screenshot-shaped integration oracle); G4 both halves
(neighborhood hierarchic by default AND hop-ranked via
breadthfirst roots=[selected]); G5 legend rect squared; shapes
edge predicates as local names. 1,371 tests exit-0; e2e 68/14.
NEXT (64d): G3 analytics fills (vertical space, datagrid
overflow, square-up matrix cells), end-anchored edge labels
(VR-9's label collisions + shapes placement), parametric
container+port model.)

## PRIOR SNAPSHOT (Round 64b)

**As of:** 2026-07-28 evening (active: G3L Round 64b executed:
upstream prm-analyzer report dispositioned (adopted: element
validation guard, interactionOptions, popout
encoding/stylesheet/camera = VR-24, TreeView showBreadcrumb, dev
stylesheet warning; filed: d.ts emission, line-style/border
channels, peer isolation, consumption guide, fill wrapper,
findShortestPath option); IBD screenshots analyzed, VR-9
mechanisms filed (through-container fallback is the 64c lead).
1,369 tests exit-0; e2e 68/14. NEXT (64c): VR-9
through-container fix, G3 analytics fills, G4 neighborhood
hierarchy default + hop-rank, G5 legend rect, shapes
edge-predicate labels, parametric container+port.)

## PRIOR SNAPSHOT (Round 64a)

**As of:** 2026-07-28 evening (active: G3L Round 64a executed:
the owner's evening batch: VR-2b stale-channel clearing (Color
now reverts) + VR-2c edge-color legend rows; VR-27 v2 dashed
open shapes per ruling; G1 outside+offset port labels; G2
userSelect none; VR-29 v2 spacing only; popover Run removed;
VR-17b tick ink. 1,370 tests exit-0; e2e 68/14. NEXT (64b): G3
analytics fills + datagrid overflow + square matrix cells, G4
neighborhood hierarchy default + hop-rank investigation, G5
legend rect scale, shapes edge-predicate localName +
end-anchored labels, parametric container+port model. VR-9
waits on the IBD screenshots that did not arrive.)

## PRIOR SNAPSHOT (Round 63d)

**As of:** 2026-07-28 (active: G3L Round 63d executed: VR-8
(mixed-pair straightening; port pairs keep their centered jog by
design), VR-11 (length-tapered width estimate: the "padding" was
estimation error accumulating with text length), VR-27 («closed»
keyword + heavier border, oracle asserts both). 1,369 tests
exit-0; e2e 68/14. The VR batch remainder: VR-9 (IBD pass: a
fresh owner screenshot against 63b+ recalibrates the target),
VR-6 large-count palettes, VR-19..24 analytics inspector cluster
(round 64). VR-2 awaits the owner's e2e re-run.)

## PRIOR SNAPSHOT (Round 63c)

**As of:** 2026-07-28 (active: G3L Round 63c executed: VR-4
closed at both mechanisms (live debounced option apply +
hierarchy consuming both sliders), VR-5 (initialLayout truth,
keyed for the inferred toggle), VR-18 (matrix fill). 1,367 tests
exit-0; e2e 68/14. REMAINING VR: VR-8 (unify straightening
across views), VR-9 (IBD pass; the 63b routing work runs under
it), VR-11 (padding scaling), VR-27 (closed-shape
strengthening), VR-6 + VR-19..24 (round 64). VR-2 awaits the
owner's e2e re-run.)

## PRIOR SNAPSHOT (Round 63b)

**As of:** 2026-07-28 (active: G3L Round 63b executed: the BDD
trio VR-7d/e/f closed at their shared flow-vs-side root
(side-driven simple template with straight-line collapse,
side-relative snap, border-gap sides + exposure-aware anchors),
plus VR-25 (track width, the real mechanism), VR-26 (+ most of
VR-10: local names + inside labels), VR-17 (axis legibility,
charts budget 7->7.5 with rationale), VR-29 (landing divider).
1,365 tests exit-0; e2e 68/14. NEXT (63c): VR-4/5 toolbar
propagation investigation, VR-8 unify straightening across
views, VR-9 IBD pass against the owner screenshots, VR-18 matrix
rail fill, VR-27 closed-shape strengthening.)

## PRIOR SNAPSHOT (Round 63a)

**As of:** 2026-07-28 (active: G3L Round 63a executed: VR-2
root-caused from the owner's browser evidence (theme rules
clobbered encoding rules in the merge order); the merge is now an
exported pure function with an order contract and a computed-style
presentation oracle. Owner feedback filed as VR-7d/e/f + IBD
evidence on VR-9/10. 1,361 tests exit-0; e2e 68/14. NEXT (63b):
the BDD routing trio (VR-7d simple-route preference, VR-7e
side-relative snap, VR-7f overlap side choice), VR-29 landing
spacing, then the toolbar propagation investigation VR-4/5.)

## PRIOR SNAPSHOT (Round 62)

**As of:** 2026-07-27 (active: G3L Round 62 executed: owner
inputs resolved (LR-3 URL live, chunk ruled, LR-25 ruled ->
VR-15); VR-1 drag-stuck and VR-3 gray dots root-caused and fixed;
VR-2 data path proven with a permanent oracle + browser falsifier
authored (needs a browser run); VR-7 BDD routing rebuilt seven
mechanisms deep (universal stubs, dominant-axis sides, point-based
terminals, zero-rung stub ladder, roomy-first retries, fixed-face
swing, settle-pass parity). 1,360 tests exit-0; e2e 68/14. NEXT:
round 62's smalls (VR-25/26/29, VR-17/18) then the round-63
clusters (VR-4/5 toolbar propagation; VR-8..11 routing remainder).)

## PRIOR SNAPSHOT (Round 61)

**As of:** 2026-07-23 (active: G3L Round 61 executed: the ENTIRE
remaining LR backlog in one batch: LR-12 (violation to the hazard
log), LR-18 closed (multiplicity end to end), LR-23 (compartment
separators), LR-35 (Channel tier, five-stage sankey), LR-46
(shapes tab on the interactive SVG view with severity/closed
decorations), LR-47 (any-membership type scopes). Container reset
mid-batch was owned and the work replayed from the round-60 zip.
1,358 tests exit-0; e2e 67/13. ALL LR-1..50 items now carry final
dispositions. Owner inputs open: repo URL, LR-25 scope, chunk
a/b/c; owner verification passes queued for rounds 52-61.)

## PRIOR SNAPSHOT (Round 60)

**As of:** 2026-07-23 (active: G3L Round 60 executed: inspector
pair closed in BOTH shells (bare inspector, own close, height cap;
selection-follow via render derivation), plus an owned correction:
round 57's LR-40 dashboard wiring had never reached disk and is
now applied and grep-verified. 1,358 tests exit-0; e2e 67/13.
REMAINING LR backlog: fixture round (LR-12/18-remainder/35), LR-23
design, LR-46/47 enhancement. Owner inputs open: repo URL, LR-25
scope, chunk a/b/c; owner verification passes queued for rounds
52-60.)

## PRIOR SNAPSHOT (Round 59)

**As of:** 2026-07-23 (active: G3L Round 59 executed: LR-45
closed: the CNT-003 same-graph mechanism extended to ugm graphs
(identity = node+edge ids; positions captured at teardown; same
graph -> preset replay + camera restore), so the inferred toggle
is visually data-only; instUgm builds its projection once.
LR-50 partial: hops re-layouts are semantically right; a
hops=1-specific mechanism not pinnable statically; stale-viewCore
suspicion recorded for owner repro. 1,358 tests exit-0; e2e
67/13. NEXT: fixture round (LR-12/18-remainder/35) or auditor
inspector (LR-10/11), owner's pick. Owner inputs open: repo URL,
LR-25 scope, chunk a/b/c.)

## PRIOR SNAPSHOT (Round 58)

**As of:** 2026-07-23 (active: G3L Round 58 executed: LR-37
closed: the editor's icon overrides bypassed composePinStack's
single truth (_icon data) as flat background-image styles; both
reported symptoms trace to that one mismatch. Icons now travel as
_icon data via a pure tested split; pinned stacks re-compose per
override pass. Analytics cluster (LR-31..44) fully closed.
1,358 tests exit-0; e2e 67/13. NEXT: owner's pick of perf pair
(LR-45/50) / fixture round (LR-12/18-remainder/35) / auditor
inspector (LR-10/11). Owner inputs open: repo URL, LR-25 scope,
chunk a/b/c.)

## PRIOR SNAPSHOT (Round 57)

**As of:** 2026-07-23 (active: G3L Round 57 executed: Analytics
remainder: Spacing reaches the force layout (LR-31; Re-run's
incremental behavior is the round-16 ruling, kept + explained);
inspector dots show ACTUAL applied colors with type maps gated to
the types driver (LR-40); edit-appearance widget inside the
canvas, geometry root-caused (LR-41, supersedes 4.13); custom
color wheel (LR-42); unified status-bar dismiss model (LR-44).
LR-37 deferred with mechanism hypothesis (background-image slot
conflict). 1,356 tests exit-0; e2e 67/13. NEXT: LR-37 focused
round, or owner's pick of perf pair (LR-45/50) / fixture round
(LR-12/18-remainder/35) / auditor inspector (LR-10/11). Owner
inputs open: repo URL, LR-25 scope, chunk a/b/c.)

## PRIOR SNAPSHOT (Round 56)

**As of:** 2026-07-23 (active: G3L Round 56 executed: Analytics
batch 1: export dropdown styled + BOTH dropdowns close on outside
click (LR-32; .g3t-menu had no rule at all); search clears on
selection (LR-36); focus-neighborhood FITS the remainder (LR-39);
charts fill their pane with named axes (LR-33); adjacency matrix
in the rail under coverage (LR-34, supersedes 8.4 placement,
narrows 12.6, recorded in the oracle). 1,356 tests exit-0; e2e
67/13. NEXT: round 57 = analytics remainder
(LR-31/37/40/41/42/44). Owner inputs open: repo URL, LR-25 scope,
chunk a/b/c.)

## PRIOR SNAPSHOT (Round 55)

**As of:** 2026-07-23 (active: G3L Round 55 executed: routing round
B: ports mount fully OUTSIDE (LR-19, D2a contract updated), edges
terminate at the outer face (LR-20), port approaches run along the
port axis via stubs (LR-17), own-box obstacle for port ends
(LR-16), side-aware port name labels (LR-18 label parts; fixture
research + multiplicity remain). 1,356 tests exit-0; e2e 67/13.
NEXT: Analytics arc (LR-31..44) or perf pair (LR-45/50), owner's
pick; LR-12/18/35 fixture round available. Owner inputs open: repo
URL, LR-25 scope, chunk a/b/c.)

## PRIOR SNAPSHOT (Round 54)

**As of:** 2026-07-23 (active: G3L Round 54 executed: MBSE SVG
routing round A: RTE-011 live drag re-routing (offset geometry +
pure router; orthogonal routes and labels survive drags), LR-21
snap-to-alignment (phantom Z-jogs for pixel-level center deltas
collapse straight, oracle falsifiable both ways), LR-13 row-grabs
drag their container, LR-14 centered sections. 1,355 tests exit-0;
e2e 67/13. NEXT: routing round B (LR-16..20: IBD initial routes
inside nodes, port-side-aware entry, ports mounted fully outside,
arrow termination offsets). Owner inputs open: repo URL, LR-25
adapter scope, chunk a/b/c.)

## PRIOR SNAPSHOT (Round 53)

**As of:** 2026-07-22 (active: G3L Round 53 executed: the
supply/bio/ontology batch: supply zoom clamp + top-right legible
legend + three-mode confidence control (Color via encoding grammar,
thicker inverted-width edges); bio scatter axis labels + class-dot
sync (localName keying); ontology stable-height datagrid pages +
legend collecting ALL type memberships (inferred supertypes now
listed). LR-24/26/27/28/29/48/49 closed pending owner eyes.
1,354 tests exit-0; e2e 67/13. NEXT: MBSE SVG routing rounds A/B
(LR-13..23) unless the owner reorders; Analytics arc after. Owner
inputs still open: repo URL, LR-25 adapter scope, chunk a/b/c.)

## PRIOR SNAPSHOT (Round 52)

**As of:** 2026-07-22 (active: G3L Round 52 executed: owner review
FILED as LR-1..50 (tracked, round-assigned); quick-win batch landed
(landing LR-1..6, gating LR-7/8 with e2e-flag override preserving
the MR-7 oracles, small fixes LR-9/30/38/43) with downstream
oracles updated. 1,354 tests exit-0; e2e 67/13. NEXT: round 53 =
supply/bio/ontology small-medium batch (LR-24/26/27/28/29/48/49);
then MBSE SVG routing rounds A/B (LR-13..23); Analytics round(s);
perf round. Owner inputs queued: repo URL (LR-3), adapter
interactivity scope (LR-25), chunk warning a/b/c.)

## PRIOR SNAPSHOT (Round 51)

**As of:** 2026-07-22 (active: G3L Round 51 executed: preview arc
CLOSED: owner confirms preview fixed; stylesheet witness green in
production; toolbar interaction pass console-clean. The single red
(67th) was the spec clicking design-disabled Shuffle: fixed
(force-layout first + enabledness guard). NEXT: the owner's held
routing/dev notes land as MR-style rounds; then D3b part 2
(ARC-009 extraction). Open owner call: chunk warning a/b/c.)

## PRIOR SNAPSHOT (Round 50)

**As of:** 2026-07-20 (active: G3L Round 50 executed: TOOLBAR
PREVIEW BREAK FIXED: g3t-base.css was tree-shaken out of prod (bare
*.css sideEffects glob missed subdirectory css); explicit app-entry
import + recursive glob + gate expectation corrected; dist now
ships index-*.css with the toolbar styles (empirically verified
absent -> present). Stylesheet witness added to the toolbar e2e
spec (computed display === flex). Owner must `pnpm exec playwright
install` (1.61.1 binaries) before running. NEXT: owner's round-50
e2e run (expect toolbar green in preview); then the owner's held
routing/dev notes; then D3b part 2.)

## PRIOR SNAPSHOT (Round 49)

**As of:** 2026-07-20 (active: G3L Round 49 executed: esbuild/oxc
warning eliminated at root (lib minify trio removed; dist now FULL
minify: core 146.0/react 357.1/charts 6.4; budgets rebased 152/372/7,
ledger); eight shells code-split (landing paints small; vendor +
lazy-echarts chunks documented); toolbar-interaction e2e witness
added (67/13) for the owner's persistent preview break; dependency
churn repaired (react pair 19.2.7, vite 8.1.5, playwright pair
1.61.1) with all chunks at exit 0. 1,354 tests. NEXT: owner runs
e2e (toolbar spec names the broken step); then D3b part 2.)

## PRIOR SNAPSHOT (Round 48)

**As of:** 2026-07-20 (active: G3L Round 48 executed: the owner's
production e2e run triaged: all three failures dispositioned (one
was my round-45 e2e-expectation miss, recorded; two were smoke-spec
title/affordance guesses). SCALE SMOKE PASSED: the toolbar mounts
clean in production. Failures-only digest shipped
(scripts/filter-e2e-failures.mjs + `pnpm run e2e:failures` + CI
artifact), validated on the owner's actual upload. e2e 66/12.
NEXT: owner re-runs e2e (expect 66/66), describes the toolbar
symptom if it persists, finishes the cut-off question; then D3b
part 2 (extraction).)

## PRIOR SNAPSHOT (Round 47)

**As of:** 2026-07-19 (active: G3L Round 47 executed: scale freeze
RULED dev-only (production clean; DevTools sub-claim corrected on
the record); e2e now runs against the PRODUCTION bundle (build +
preview webServer) and a production-smoke spec walks every example
(66 e2e/12 files): the toolbar-in-preview class is closed, the
instance lands on the next e2e run or console paste. NEXT: D3b part
2 (ARC-009 extraction). Owner: run e2e on round 47 (first
production-bundle run), paste smoke failures or the preview console
line for the toolbar.)

## PRIOR SNAPSHOT (Round 46)

**As of:** 2026-07-19 (active: G3L Round 47 executed: e2e targets
the PRODUCTION bundle (build+preview webServer) + an 8-example
production-smoke spec with console-clean assertions (e2e 66/12).
Scale freeze CLOSED: owner-verified dev-only, DevTools-independent;
verdict + P2 lever recorded in the surface. Toolbar prod break:
statically clean, browser-witnessed by the smoke spec: owner's next
e2e run names it. NEXT: D3b part 2 (extraction) once the toolbar
break is dispositioned (it may be a round-45 regression; extraction
would move the evidence). Owner: run e2e on round 47; complete the
cut-off question ("should we add the...").)

## PRIOR SNAPSHOT (Round 46)

**As of:** 2026-07-19 (active: G3L Round 46 executed: Supply Thread
Renderer toggle (Cytoscape | SVG | Canvas) over a HARVESTED scene;
harvestSceneFromCy exported (any cy instance -> adapter scene, one
import per demo); measured adapter hosts; opt-in fake-core test
seam. 1,354 tests. NEXT: D3b part 2 (ARC-009 extraction) slid one
round for this owner request; proceeds now. Owner: scale
experiments + quality list + browser-check the new toggle.)

## PRIOR SNAPSHOT (Round 45)

**As of:** 2026-07-19 (active: G3L Round 45 executed: D3b PART 1:
elkjs LEFT THE TREE (pipeline deleted, seam retired, bands frozen
against recorded elk baselines, G3tLayeredLayout replaces ElkLayout,
full disposition in the design doc; core rebased 192; PRF-001 199 ms
container-green). Scale freeze NAMED: React dev-build prop
serialization (owner profile); two 10-second experiments confirm.
Flip ratified in substance. 1,351 tests. NEXT: D3b part 2 = ARC-009
extraction (@g3t/layout, vocabulary rename, fresh budgets). Owner:
scale experiments + quality-bug list when ready.)

## PRIOR SNAPSHOT (Round 44)

**As of:** 2026-07-18 (active: G3L Round 44 executed: e2e 58/58
owner-confirmed (drag/routing closed). Scale block cornered: one
17.9 s longtask right after settled on clusters return; every
headless suspect eliminated by measurement (spec-apply 1 ms, Fuse
4/84 ms, headless-cy 46 ms); renderer-side or browser-only. Shipped
JS Self-Profiling: Document-Policy header + per-switch sampler
printing top self-time functions into the owner's console paste.
1,356 tests. Awaiting: the profile paste; the browser session (flip
ratification = the ONLY gate left on D3b).)

## PRIOR SNAPSHOT (Round 43)

**As of:** 2026-07-18 (active: G3L Round 43 executed: drag basis is
truth-carried end-to-end (_geomBox stamped; capture from _routePts;
padded-cy values out of the loop; straight results write via the
degenerate doctrine). NEW integration oracle: real BDD, real
converter, real handlers, e2e's exact choreography, HOSTILE fake
(padded dims, corrupted endpoints). Scale longtask watch runs 15 s
past settled. 1,356 tests. Awaiting: e2e on round 43, browser
session, scale paste. D3b holds for flip ratification.)

## PRIOR SNAPSHOT (Round 42)

**As of:** 2026-07-18 (active: G3L Round 42 executed: the zigzag
root cause fixed (absolute _routePts end-to-end: converter writes,
overlay renders verbatim, drag rewrites, MR-9 restores; seg data is
hit-testing only now). Scale: preset restores snap; longtask +
layoutstart diagnostics land the next paste on the culprit. 1,355
tests. Awaiting: e2e on round 42, the browser session, fresh scale
console lines. D3b holds for flip ratification.)

## PRIOR SNAPSHOT (Round 41)

**As of:** 2026-07-18 (active: G3L Round 41 executed: MR-8 drag
reroute fixed under g3t (host-attached capture; no eports to find;
the owner's "routes to center" parity item and the e2e crossing
failure were one defect; stub oracle added). Scale surface gains
phase instrumentation (cy-init/layoutstop/settled) and a
position cache: returns mount PRESET from settled positions. 1,355
tests. Awaiting: e2e on round 41 (drag-reroute spec should flip),
the parity list, fresh scale console lines. D3b holds for flip
ratification.)

## PRIOR SNAPSHOT (Round 40)

**As of:** 2026-07-18 (active: G3L Round 40 executed: the overlay
bug's REAL root cause fixed (compound containers carry no cy
position; projection centers now fall back to geometry boxes;
headless replication of the exact e2e pipeline goes 0/5 -> 5/5
routed). Regression pin hardened to containers. Owner reports
rendering-parity issues (detail incoming next round) and
scale-surface switch lag (fcose pipeline, not layoutStructural;
instrumented numbers requested; options analysis in queue).
Awaiting: e2e 58/58 on round 40, parity list, scale numbers. D3b
holds until flip ratification.)

## PRIOR SNAPSHOT (Round 39)

**As of:** 2026-07-18 (active: G3L Round 39 executed: CI ruled the
flip GREEN (PRF-001 = 159 ms vs 300; all asserting keys green). The
one e2e failure fixed at its root: 2-point straight g3t routes now
earn the routed class (the elk-era >= 3 gate made better placement
draw fewer edges); converter regression pin added; old oracle
evolved. PRF-001b elk leg made explicit post-flip. Core 196
ratified; D3b fully pre-authorized (elkjs removal, no external
imports, rebase authority). Awaiting: e2e 58/58 on this tree + the
flip/MR-11 browser ratification; then D3b closes WS-D.)

## PRIOR SNAPSHOT (Round 38)

**As of:** 2026-07-18 (active: G3L Round 38 executed: WS-D D3a
LANDED: THE DEFAULT ENGINE IS g3t. Gap routing + grid escalation
under threshold/budget; direction support; engine-agnostic caching
(engineKind in the key); all 15 flip failures dispositioned (elk
pins recorded, retire at D3b); QLT-002 corpus bands ASSERT; PRF-001
asserts now (container ~353 ms red locally, CI projection 170-235
vs the ruled 300; next lever named). OWNER: push and run CI: the
perf job is the arbiter. D3b next: elkjs removal + ARC-009
extraction + budget rebases. MR-11 round-4 re-look still open.)

## PRIOR SNAPSHOT (Round 37)

**As of:** 2026-07-18 (active: G3L Round 37 executed: WS-D D2b
LANDED: network-simplex (time-budgeted anytime), Coffman-Graham,
Brandes-Koepf; defaults flipped to NS+BK on both engine paths; D1
deviations closed. Flat R1 303.5 ms on the slow container (elkjs
14,902 ms same run; ~180 ms projected on CI vs the 300 ms flip
gate). Next: D3 (fixture-corpus conformance bands via QLT-002,
PRF-001 green on g3t in CI, default flip, elkjs removal, ARC-009
extraction). MR-11 round-4 re-look still open.)

## PRIOR SNAPSHOT (Round 36)

**As of:** 2026-07-18 (active: G3L Round 37 executed: WS-D D2b
LANDED: network-simplex (anytime-budgeted, never worse than
tight-tree), Coffman-Graham, Brandes-Koepf; defaults flipped to
NS+BK inside the engine. R1-flat 284 ms on the container (~165 ms
implied CI), BK nearly free at 13.5 ms. Ten-seed property sweep
guards the strategies. D3 next: conformance bands, PRF-001 green in
CI, default engineKind flip, elkjs removal, ARC-009 extraction.
MR-11 round-4 re-look still open.)

## PRIOR SNAPSHOT (Round 36)

**As of:** 2026-07-18 (active: G3L Round 36 executed: WS-D D2a
LANDED: structural inputs in-house (containment pre-pass reusing the
elk assembly's sizing; row-stacking closure oracle; side-placed
ports; sketch warm-start = INTERACTIVE by construction). Seam routes
all g3t-requested inputs in-house; default still elk. D2b next:
LAY-002 layering pair + LAY-004 Brandes-Koepf; then D3 conformance
bands + the flip + ARC-009 extraction. MR-11 round-4 re-look still
open.)

## PRIOR SNAPSHOT (Round 35)

**As of:** 2026-07-18 (active: G3L Round 35 executed: WS-D D1
LANDED: the g3t layered engine, flat end-to-end behind the
engineKind seam. Flat R1: 103.8 ms vs elkjs 11,127 ms (107x),
already under the 300 ms budget on the slow container. QLT-002
harness running both engines. Recorded D1 deviations: layering
tight-tree only, placement median (both D2). Next: D2 (containment
pre-pass, ports, sketch warm-start, LAY-002/004 strategies, full
oracle suite behind the seam) or the MR-11 round-4 re-look.)

## PRIOR SNAPSHOT (Round 34)

**As of:** 2026-07-18 (active: G3L Round 34 executed: MR-5 CLOSED:
budgets frozen on CI numbers (all asserting-now keys MEET; perf job
is a live gate; milestone-gated keys flip at engine/channel-router
landings). Wheel isolation fixed (native non-passive listener;
React's passive root listener was letting the page scroll under the
zoom). Open: MR-11 round-4 re-look. Next: WS-D D1.)

## PRIOR SNAPSHOT (Round 33)

**As of:** 2026-07-18 (active: G3L Round 33 executed: MBSE SVG
preview hardened from the second owner batch: zoom crash fixed
(currentTarget captured before the deferred updater; regression
test), hit-aware node dragging with marked straight-edge fallbacks,
fill-the-host sizing via ResizeObserver. MR-11 at round-3 re-look.
MR-5 freeze still awaits CI numbers; D1 remains unblocked and next.)

## PRIOR SNAPSHOT (Round 32)

**As of:** 2026-07-18 (active: G3L Round 32 executed: owner batch.
e2e 57/58 (selector fix landed); MBSE dropdown occlusion bug fixed;
canvas gradient-taper fixed + conformance-pinned; label-halo
readability default; react budget 440 (ledgered); MR-4 closed and
de-referenced per ruling; WS-D APPROVED (route = module of
@g3t/layout, no deprecation window): D1 UNBLOCKED. CI gains
workflow_dispatch. Open: MR-5 freeze awaits CI numbers; MR-11 at
round-3 re-look. Next: WS-D D1.)

## PRIOR SNAPSHOT (Round 31)

**As of:** 2026-07-12 (active: G3L Round 31 executed: RND-006 hit
testing shipped in CORE (scene + structural, zone detail, eight
oracles); INT-001 uniform pointer events across all three headless
components (one hook, five dispatch oracles). React budget at 99%
(flagged; extraction is the relief; no unilateral raise). Awaiting:
CI perf numbers (MR-5 freeze), WS-D design approval (D1 start),
MR-11 re-look.)

## PRIOR SNAPSHOT (Round 30)

**As of:** 2026-07-12 (active: G3L Round 30 executed: F2 stage 1
shipped: pure display-list Canvas adapter consuming the identical
scene contract; ARC-008 conformance suite running one fact table
against both adapters with capability-honesty verification; Style
Lab adapter select + e2e. RND-004 stage 2 (caching/snapshot/
simplification) deferred explicitly. Owner queue: WS-D design
review, MR-11 re-review (now three renderers to glance at), MR-4.
Awaiting tomorrow's CI for MR-5 freeze numbers.)

## PRIOR SNAPSHOT (Round 29)

**As of:** 2026-07-12 (active: G3L Round 29 executed: WS-D design
doc written against the sharpened numbers; at owner review (queue
item 1) with two open decisions (route packaging, deprecation
window). Build starts on approval with D1. Meanwhile the batch can
proceed with F2 (Canvas2D adapter + the ARC-008 conformance suite)
or MR-5 freeze when CI numbers arrive.)

## PRIOR SNAPSHOT (Round 28)

**As of:** 2026-07-12 (active: G3L Round 28 executed: PRF-001
sharpened (warm 12.6 s; crossing minimization dominates; detuned
elkjs still misses target; record at
planning/archive/g3l/prf-001-measurement.md) and LAY-020 shipped
(layoutStructuralWithChangeSet: local region splice with verbatim
carryover pinned by object identity, global-sketch fallback, reroute
reporting; five oracles). The incremental chain MOD-010 -> LAY-020
-> RTE-011 is now closed at the layout end. Next: WS-D design doc
against the sharpened numbers.)

## PRIOR SNAPSHOT (Round 27)

**As of:** 2026-07-12 (active: G3L Round 27 executed: E2 shipped:
IOP-001 versioned graph document (hierarchy, ports, data, layout
options, style refs, geometry snapshot; published JSON Schema;
round-trip pinned) with the honest lossy projection to structural
input; IOP-002 lossless ELK JSON import into the document. WS-E now
has E2+E3 done; E1 (model package extraction) rides with WS-D/
ARC-009. Batch next: LAY-020 (change-set-driven local re-layout) or
the WS-D design doc per owner priority.)

## PRIOR SNAPSHOT (Round 26)

**As of:** 2026-07-12 (active: G3L Round 26 executed: WS-E begins.
MOD-010 change-set API shipped in core: transactional apply with
exact diffs by construction, explicit recorded cascades, diagnostics
posture, inversion for undo (round-trip pinned), the affectedRegion
locality seed for LAY-020, versioned wire format. Eight oracles.
Next in batch: LAY-020 consumption (local re-layout) or E2 (ELK JSON
import + versioned document format) per owner priority; WS-D design
doc also ready to start given the PRF-001 numbers.)

## PRIOR SNAPSHOT (Round 25)

**As of:** 2026-07-12 (active: G3L Round 25 executed: F1 structural
slice shipped: StructuralSvgView renders the geometry document
verbatim (containers/rows/ports/routed edges with UML symbols),
reusing the overlay's arrow geometry; five jsdom conformance
oracles; MBSE renderer toggle (cy default | SVG preview) with a
browser test. MR-11 re-review scope extended. Batch continues: WS-E
(change-set API) next unless redirected.)

## PRIOR SNAPSHOT (Round 24)

**As of:** 2026-07-12 (active: G3L Round 24 executed: MR-5 harness
built and CI-wired (report-only until frozen per the ruled
protocol). Three findings quantified: elkjs R1 layout ~40x over
target (the WS-D case, now numeric); from-scratch R1 routing belongs
to the channel-router milestone; the interactive drag path MEETS its
frame budget at production scale. Router gained prune-verify-
fallback. Batch continues: F1 continuation next.)

## PRIOR SNAPSHOT (Round 23)

**As of:** 2026-07-12 (active: G3L Round 23 executed: FIRST 100%
e2e RUN in the owner's environment (57/57). Four rulings executed:
T2 archived per "archive don't delete" (core at 74% of budget,
ARCHIVE.md registry with restore procedure); MR-9 closed ("largely
stable"); MR-5 ruled (CI baseline; bench harness is the remaining
engineering); MR-11 background fix shipped, at re-review. Owner
queue at two items: MR-11 re-review, MR-4 FTO. Next engineering:
MR-5 bench harness, F1 continuation, or WS-E per owner priority.)

**Owner queue:** planning/archive/g3l/owner-queue.md is the single list of
items blocked on the owner, each with the exact ask and what it
unblocks.

**As of:** 2026-07-11 (active: G3L Round 22 executed: the F1 pane's
zero-label e2e failure fixed at the shell (data-derived label text
merged into the F1 attribute maps; adapter stays attributes-only).
MR-9's browser pin passed in the owner's run (closed-loop return
worked); MR-9 itself remains held for owner review. Owner queue
established at planning/archive/g3l/owner-queue.md.)

## PRIOR SNAPSHOT (Round 21)

**As of:** 2026-07-11 (active: G3L Round 21 executed: dead-code
round. -49 KB recovered with zero functionality change (dist comment
stripping + 20 barrel demotions): core at 80% of budget, react at
95%. Analysis doc with the T2 ruling table (six tested-but-unused
feature clusters, ~24 KB, per-cluster owner ruling requested). MR
log audited: index added, MR-7/MR-8 statuses corrected, MR-9 hold
recorded. Open owner items: MR-4 FTO, MR-5 PRF, MR-9 review, MR-11
F1 look, T2 rulings.)

## PRIOR SNAPSHOT (Round 20)

**As of:** 2026-07-11 (active: G3L Round 20 executed: F1 SHIPPED:
the SvgAdapter renders the full VisualAttributes contract natively
(halo/pulse, glyphs, donut, taper, gradient, paint-order label
halos, 7 shapes), nine jsdom conformance oracles (SVG is fully
headless-verifiable), Style Lab three-pane comparison with shared
positions and LOD coupling, fixture extended with donut/pulse/
gradient rules, browser acceptance added. MR-9 held open at owner
request pending review; MR-11 queued (F1 first look). Next: F1
continuation (structural-view SVG rendering path) or WS-E per owner
priority.)

## PRIOR SNAPSHOT (Round 19)

**As of:** 2026-07-11 (active: G3L Round 19: the MR-9 browser pin is
now CLOSED-LOOP (measured corrective return, release inside the
restore band) after two falsified gesture theories; the
deterministic 5/6 synthetic-gesture anomaly is recorded with
telemetry as an open curiosity (human drags unaffected). Artifact
naming is now versioned per content change (round 18 lesson).
Awaiting the round-19 run; F1 next on green + MR-9 eyeball.)

## PRIOR SNAPSHOT (Round 17)

**As of:** 2026-07-11 (active: G3L Round 17 executed: MR-9 browser
pin fixed (verbatim raw-string restore replaces reconstruction).
MR-10 flagged (P2): during-drag endpoint tracking notes with
warm-start suspects. Routing accepted "much better and closer to
predictable". NEXT BATCH: F1, the SVG renderer adapter, starting
immediately: full VisualAttributes to pixels (halo, glyphs, donut,
taper, gradient), Style Lab F1 pane, browser-first acceptance.)

## PRIOR SNAPSHOT (Round 16)

**As of:** 2026-07-11 (active: G3L Round 16 executed: MR-9 shipped
per the recorded contract: settled routes are a pure function of
settled positions (canonicalize-on-dragfree; return-to-grab restores
exactly; during-drag hysteresis untouched). Pinned by two unit
oracles + the mandated browser pin. Awaiting e2e run + MR-9
re-review. Next: F1 (SVG adapter), no open blockers.)

**As of:** 2026-07-11 (updated: MR-8 accepted by owner "good enough
for now". MR-9 FLAGGED for next round (P1): right-then-left drag
round trips are not idempotent; warm-start analysis and the
canonicalize-on-dragfree candidate contract recorded in the MR log.
Next round: MR-9 first, then F1.)

**As of:** 2026-07-11 (active: G3L Round 15 executed: the
instrumented hygiene assertion NAMED its culprit (cytoscape
mapping-warning class on data(_label); fixed with the scoped
selector). The remaining drag crossing root-caused (sealed desired
face -> router null -> unchecked fallback) and fixed with candidate-
face retry (resolveDragAttachment). Both owner refinements shipped:
bundle-aware face-distributed anchors (the group-then-break-out
mechanism) and the 28px pre-bend terminal buffer for UML symbols.
Awaiting fourth e2e run (expect green) + MR-8 re-review; F1 next.)

## PRIOR SNAPSHOT (Round 14)

**As of:** 2026-07-11 (active: G3L Round 14 executed: MR-8 second
pass ("much better") produced the 4-way attach-side selection
(hysteresis, no flapping; two pins evolved, one by explicit owner
ruling over the old axis-lock). Second e2e run triaged: the
arrow-trim anchor gap fixed at the overlay source
(data-route-start/end published, specs read true anchors); MBSE
console hygiene instrumented to name its messages next run. Awaiting
third e2e run + MR-8 re-review; F1 next.)

## PRIOR SNAPSHOT (Round 13)

**As of:** 2026-07-11 (active: G3L Round 13 executed: B4/B5 shipped.
In-house orthogonal obstacle router in core + resolveDragRoute policy
(rescale-when-clear, reroute-on-collision-or-side-migration) wired
into the drag path. Both round-1 expected-fail oracles FLIPPED (zero
expected-fails remain; one fixture corrected at flip time, it was
unsatisfiable as authored). MR-8 browser acceptance encodes the
owner's symptoms verbatim. Core budget 176 -> 184 KB, documented;
@g3t/layout extraction remains the WS-D plan. MR-8 at RE-REVIEW:
repeat the SmallSat drag after a green e2e run. Next: F1 (SVG
adapter).)

## PRIOR SNAPSHOT (Round 12)

**As of:** 2026-07-11 (active: G3L Round 12 executed: first
real-browser e2e run triaged (IBD premise fixed: top-level nodes, not
containers-only; scene-swap wait; overlay/pan/parity assertions
hardened against headless-authoring assumptions). MR-8 opened for the
owner-observed drag-routing defects: both symptoms are the pinned
RTE-011 gap and become B4/B5's acceptance criteria. ORDER CHANGE
under consideration: B4/B5 (routing) ahead of F1 given twice-reported
owner pain; see the round summary for the recommendation. Post-removal
visual verdicts: MBSE clean, ontology clean.)

## PRIOR SNAPSHOT (Round 11)

**As of:** 2026-07-10 (active: G3L Round 11 executed: the
browser-acceptance layer the postmortem mandated is in place and
CI-wired: drawn-bounds-vs-geometry per flow direction, overlay
endpoints on drawn borders, transform-only pan, Style Lab
parity/LOD-restore/no-growth, and console hygiene, all against
shipped features, with an e2e-gated window hook channel (demo-side
only). Specs authored headlessly per suite doctrine; first execution
in CI. Next: F1 (SVG adapter), which lands INTO this harness: its
conformance pane gets browser acceptance from round one.)

## PRIOR SNAPSHOT (Round 10)

**As of:** 2026-07-10 (active: G3L Round 10 executed: expand/collapse
REMOVED from the toolkit by owner ruling after a fifth browser FAIL;
planning/expand-collapse-postmortem.md is the ruled warning document
(defect chain, lessons, hard reintroduction gates: read before ever
proposing collapse again). Spec R1.18 amended. The stability
infrastructure the saga produced survives deliberately (sketch mode,
in-place scene patch, bounds pin, live-position capture,
useStructuralLayout). MR-1 CLOSED. Next: F1 (SVG adapter), unblocked
by MR-2's PASS.)

## PRIOR SNAPSHOT (Round 9)

**As of:** 2026-07-10 (active: G3L Round 9 executed: fourth review
pass. MR-7 fully PASS (edge labels confirmed). MR-1's remaining
finding (toggled container misplaced, edges broken) root-caused at
the converter boundary: compound DRAWN bounds derive from children
and diverged from the floored geometry box the ports sit on; fixed
with the invisible ::extent bounds pin, converter-pinned. Awaiting
MR-1 final re-review (drag-then-collapse placement + routing on both
plain and dragged paths); F1 next on PASS.)

## PRIOR SNAPSHOT (Round 8)

**As of:** 2026-07-10 (active: G3L Round 8 executed: third review
pass. Flash CONFIRMED GONE. Drag-revert root-caused and fixed (live
top-level positions captured at toggle time anchor the sketch;
layered per-axis contract pinned). Edge-label halo shipped in the lab
(both paths, parity keys widened, oracle 0 mismatches). "Edge routing
weird" triaged as most plausibly the revert's visible half; MR-1
re-review procedure now separates plain-collapse from
drag-then-collapse routing observation. Awaiting MR-1/MR-7 final
re-review; F1 remains next.)

## PRIOR SNAPSHOT (Round 7)

**As of:** 2026-07-10 (active: G3L Round 7 executed: second review
pass recorded (MR-2/3/6 PASS: overlay pattern holds at 4k, F1
unblocked). MR-1's persistence exposed the THIRD root cause: the
collapse hook unmounted the canvas per toggle (stale-scene guard),
making round 6's patch path unreachable; stale-while-revalidate fix
shipped and pinned. MR-7 parity judged correct; back affordance and
a LOD probe that actually drives the engine pane shipped, surfacing
and fixing a stale-bypass restore defect. MR-1/MR-7 await re-review
(MR-1's constant-height collapse look remains the explicit judgment
call). Next: MR-1/MR-7 re-review, then F1.)

## PRIOR SNAPSHOT (Round 6)

**As of:** 2026-07-10 (active: G3L Round 6 executed: the first live
review's two FAILs (MR-1 flash+reset, MR-7 lab findings) are
root-caused, fixed, and pinned; MR-1/MR-7 await RE-REVIEW (the
constant-height collapse look is the explicit judgment call);
MR-2/3/6 unblocked. Prior rounds: R5 Style Lab + projection, R4
tokens/LOD/config-JSON, R3 style engine, R2 SVG overlay, R1
sketch/oracles/metrics. Next: MR re-review, then F1 (SVG adapter) per
the standing recommendation.)

## PRIOR SNAPSHOT (2026-07-09)

**As of:** 2026-07-09 (active: G3L Round 1 executed: sketch-mode
layout stability (A1, criterion met at zero displacement), drag-route
oracles (B1, 4 pass-pins + 2 expected-fail pins on the RTE-011 gap),
and the layout-metrics module (D1, exported from @g3t/core). Governing
documents: planning/archive/g3l/requirements-specification.md and
planning/g3l/implementation-plan.md. G3L Round 2 executed: B2 SVG
overlay edge layer shipped behind `structuralEdgeLayer` with the MBSE
shell as the ruled first opt-in surface; manual/human review tasks now
tracked procedurally in planning/g3l/manual-review-log.md (MR-1..MR-6
OPEN). G3L Round 3 executed: C1/C2
style-resolution core shipped in @g3t/core (VisualAttributes contract,
layered pure resolution, dependency-tracked incremental invalidation,
diagnostics sink; 14 new tests including R2-scale mechanistic
budgets). Core bundle budget raised 160 -> 176 KB per gate protocol.
G3L Round 4 executed: C3/C4
shipped (design tokens with WCAG-checked Okabe-Ito defaults +
ThemeManager bridge; declarative LOD schedule; versioned style-config
JSON with published schema). Core bundle at 98% of the raised budget;
the D2 layered engine will force a budget-or-extraction decision.
G3L Round 5 executed: the surface
question was RULED (ontology shell too narrow; dedicated shell
instead) and the Style Lab shipped as the side-by-side conformance
surface: legacy stylesheet vs engine bypass on one shared fixture
intent, parity computed from cytoscape's own resolved styles (0
mismatches headlessly AND live in the shell's parity table),
engine-only attributes surfaced honestly (halo/glyphs/taper await the
F1 SVG adapter), LOD probe included. The engine now HAS a consuming
surface. MR-7 (live side-by-side review) is OPEN. Next per the plan:
D rounds (metrics-gated internal layout) or F1 (SVG adapter, which
unlocks rendering the engine-only zone); F1 is the recommended next
since it converts the lab's honesty report into pixels. All rendered-behavior claims (collapse stability, overlay
parity, 4k lag) remain unverified until their MR items are executed
live.)

## PRIOR FOCUS SNAPSHOT (2026-07-03)

**As of:** 2026-07-03 (active: demo quality, reliability, and OSS
adoptability; plan in planning/demo-adoption-plan.md. The flagship
demo and the two standalone single-file demos were RETIRED this round
after fold audits: planning/flagship-retirement.md and the CHANGELOG
entry. `pnpm run gates` is the CI-parity round gate.)
**Version:** 1.0.0-rc.2 | **Tests:** the gate scripts are authoritative
for the count (1044 across 107 files at this writing; verify adds the
dist/public-api suite). | **Gates:** all green, INCLUDING verify, which
had been silently dead since its test sources (tests/dist) were lost in
a packaging round; reconstructed 2026-07-03.
**Requirement rollup:** 46 implemented, 12 in-progress, 18 proposed
(30 open requirements singly owned across the roadmap; the spec
corpus additionally carries 18 user stories, all proposed, which are
NOT requirements and are excluded from this rollup; decision log:
10 accepted, 5 considering, 3 deferred, 11 open questions). Earlier
rollups (rounds 27-30) conflated user-story status lines into the
proposed count; the gate scripts were always right. Descope
2026-06-12 roadmap descope (NOT code removal): Sankey, relational
connectors, and broad virtualization were removed as pending ROADMAP
items, not deleted from the codebase. SankeyView shipped (R1.9) and is
in the public barrel; virtualizeRelationalData/parseCSV and the
incremental-layout API remain exported. "Removed" here means "no
further roadmap investment," not "absent." See
planning/rdf-lpg-virtualization-audit.md for the full
shipped-vs-gap accounting and the reconciliation.

This document is the current-state snapshot for humans; agents start
at CLAUDE.md. The authoritative round-by-round history is the CHANGELOG
(the former planning/visual-acceptance-1.md round log was deleted with
the visual-acceptance surface on 2026-07-04); per-area design records
live in roadmap/design/; milestone-era tracking (the former PROGRESS.md
and planning/status.md) is archived verbatim in
planning/milestone-history.md.

**Where planning documents live.** `planning/` holds the records that
tracked files cite, so every such citation resolves in a clone.
`planning/archive/` is retained in the maintainer's working copy and is
NOT published: a path under it is a local reference, not a link.

## PRIOR FOCUS (2026-06-21, superseded 2026-07-03): structural-view rendering + Storybook reshape

Two active threads layered on the feature-stable library.

**Structural-view rendering (ELK/Cytoscape).** Full design narrative and
decisions in `roadmap/design/structural-rendering.md` (section "Layout
stability, edge routing, and ports"). Landed and gate-green:
- Camera/position stability (decision D15 in specs/09-design-decisions.md):
  the same input graph holds pan/zoom and node positions; refit only on a
  genuinely different graph or an explicit user op.
- Port-based body-edge attachment: synthetic boundary ports distribute
  edges along a node side, render invisibly, drag with their host, and
  exit perpendicular (away from the source node).
- Obstacle-aware routing, CORE slice: `layoutStructural` now emits ELK's
  node-avoiding edge routes into `geometry.edges` (option `routeEdges`,
  default on). Verified that the routes carry absolute polylines whose
  endpoints sit on the ports, and that disabling omits them.

CONVERTER SLICE LANDED (2026-06-22, gate-green headless): the Cytoscape
converter (`structural-to-cytoscape.ts`) projects each ELK route polyline
onto `curve-style: segments` (an enum, so it rides a class) for body and
synthetic-point-port edges, with the port-to-port taxi as the fallback
when `routeEdges` is off or a route has no interior bend. Declared-port
edges keep the taxi exit ON PURPOSE: the port already fixes a perpendicular
direction the projected basis would fight. This is the visible payoff
("edges route around blocks, not behind") and is NOT headlessly verifiable;
it shipped for Zach through the visual-acceptance page (RETIRED 2026-07-04; VA-31, packaged in
outputs). IMMEDIATE NEXT STEP: that review, then A3 polish from findings.

**Storybook atomic-design reshape.** Target taxonomy (in
`packages/react/src/Overview.mdx`): Atoms / Molecules / Compounds /
Patterns, plus a Reference group for supporting material. State:
- Done: Atoms (SpecPort, EmptyState, Skeleton) and Molecules (SearchBar,
  FacetFilter, FilterBuilder, TemporalRangeFilter, and Minimap, new
  2026-06-22) titled under the new tiers; the Toolbar & Algorithms story
  moved to Compounds (the old "Organisms" term is gone repo-wide); Charts
  and Features moved to Reference; the Patterns tier now carries
  Coordinated Selection (DS2: live cross-view linking) and Node Editor
  Modal. Both are new 2026-06-22; the modal sits on the new
  `views/inspector/` suite (NodePropertyInspector, NodeEditorModal,
  PropertyField, property-spec), the node inspection-and-editing surface
  the standalone demo's Properties tab also consumes.
- Remaining: retitle the other Compounds (CytoscapeCanvas, the Views
  story, the UX-Surface toolbar and encoding stories) from their legacy
  sections into `Compounds/*`, and AppLayouts into `Patterns/*`.
- Beyond the reshape: the renaming is step one of demonstrating adopter
  value. The continuation is the DS plan in
  roadmap/design/demonstration-surface.md (DS1-DS6, priority-ordered).
  LANDED 2026-06-22: DS2 (the Patterns tier shows cross-view linking live
  via Coordinated Selection, replacing the hardcoded selection), DS4
  (the intent-indexed capability map, docs/capability-index.md), and DS6
  (the capabilities-and-limits page, docs/capabilities-and-limits.md).
  COVERAGE BARREL RESOLVED 2026-06-22: packages/react/src/views/coverage
  landed (CoverageMeter + CoverageMeterList, 10 tests passing, strict
  typecheck clean), so the dangling ./views/coverage barrel export now
  resolves and the build-time coverage-stub workaround (the resolveId hooks
  in vite.sb-client / vitest.sb / vite.demo and the stub file) was retired.
  REAL REMAINDER, now UNBLOCKED: DS1 (co-locate the CI-tested wiring recipe
  in each Compound's Docs tab), DS3 (the theming demo from design-system.md
  D2), and the DS2 chart-rendering sub-part; plus DS5 (a minimal starter
  example), open.

## PRIOR FOCUS (2026-06-17, superseded 2026-07-03): the flagship demo

NOTE (2026-08-14): the flagship demo was RETIRED on 2026-07-03 and its
planning documents were deleted with it. The four reading-order entries
below are kept for the record; only `planning/rdf-lpg-virtualization-audit.md`
still resolves. What the flagship alone demonstrated was folded into
the shells and the wiring guide first; the audit of that fold is
`planning/flagship-retirement.md`.

The library is feature-stable at v1.0.0-rc.2. Active work has shifted
from library features to a **cinematic flagship demonstration** of the
toolkit, plus the demo/examples surface that supports it. A new agent
picking this up should read, in order:

1. `examples/flagship/README.md` — what the flagship is and its build
   state (composition build complete; visual review pending).
2. `planning/flagship-narrative.html` — the full story design (the
   buyer, the three acts, the two-strength model, the deliverable).
3. `planning/flagship-implementation-plan.md` — the software plan
   (superseded for the build sequence by the Option 1 redesign:
   `planning/flagship-plan-option1-redesign.md`).
4. `planning/rdf-lpg-virtualization-audit.md` — honest shipped-vs-gap
   accounting for the data-paradigm and scale dimensions.

**Flagship state right now:** the composition-first build (Option 1) is
COMPLETE and PACKAGED. The two-strength engine, the encoding that
drives the stage, the beat sequence, the real stage + camera, the
coverage chart, the inspector, the teaming/path overlays, the brand
theme, the brief export + workspace snapshot, and the interactive
epilogue are all built and verified headlessly, with packaging
(`examples/flagship/package.json`) that quarantines the heavy deps. The
three toolkit components the shell needed (CoverageMeter,
ProvenanceTrace, the camera controller) shipped in `@g3t/react`. No
other package source changed. What remains is browser-only: the live
visual review, then step 7 (motion/legibility polish).

**Resuming after the visual review:** start at
`planning/flagship-resume.md` (it reads `examples/flagship/
REVIEW-RESULTS.md` and routes failures to the owning module). The
review procedure is `examples/flagship/REVIEW-RUNBOOK.md`; landing and
wiring detail is `examples/flagship/INTEGRATION.md`.

**Demo/examples surface (supporting the flagship):** the dev-server
demo (`pnpm run dev`) has four scenario shells (Auditor, MBSE, Supply
Chain, Biomedical) that demonstrate the toolkit in domain stories;
`examples/decision-dashboards` holds two capability-first dashboards
(Analytics, Schema) that foreground the views the scenarios do not. The
old showcase example was deleted. Custom raster/logo node icons are
supported via the icon channel (`isImageRef` passthrough) and shown in
the Supply Chain shell with hosted Iconify icons. The roadmap groups
below (A-G) are the LIBRARY roadmap and remain valid, but are not the
current focus.



g3t is a composable graph-visualization component library (three
packages: @g3t/core with zero React, @g3t/react, @g3t/charts) that a
host application wires into its own decision-support and process
components through three channels: exported zustand stores, props and
callbacks, and versioned JSON documents. A custom control is usually
one store call in an onClick; the reverse direction (toolkit state
driving host components) is a store subscription. docs/wiring-guide.md
documents the surface and every snippet there runs in CI
(examples/wiring/), which doubles as a public-barrel completeness
gate.

## Shipped capability inventory (core through the demo overhaul)

(The inventory below is current as of 2026-06-16. It was originally
written for rounds 1-31; the entries remain accurate and the SHACL
B-series, structural rendering, the icon raster passthrough, and the
demo/examples overhaul are reflected in the round log and CHANGELOG.
For the data-paradigm and scale dimensions specifically, see
planning/rdf-lpg-virtualization-audit.md.)

**Encoding grammar.** EncodingSpec v1: a versioned, serializable
channel/driver/scale spec (color, size, icon, shape, labels; fixed,
categorical, sequential scales; slot-stable overrides) with
reserved-channel guards that reject by owner name (selection owns
effects.accent, inference owns edge.dash, overlays own borderWeight,
theme owns canvas.\*). Surfaces: EncodingSpecPanel (three tiers),
EncodingPreview (contrast-aware glyphs), SpecLegend (same resolvers
as the canvas, so legend and canvas cannot disagree), SpecPort (JSON
in/out, errors verbatim). All legacy encoding components are
deprecated shims scheduled for removal next major.

**Canvas.** CytoscapeCanvas applies the spec through element-data
patches (restyle-only: spec edits never re-run layout). Effect chain:
init, spec patch, instance-override bypass, position-pin lock, theme
restyle-in-place, overlay classes. One shared stylesheet assembly
orders precedence: structural defaults, spec attribute-mapper rules,
pin badge rule, compound-container rule, overlay rules, theme color
rules (generic selectors only, so the spec out-specifics them by
construction), then the user stylesheet. Compound containers (slice

1. derive parent assignments from a containment edge type; ELK with
   ports and compartments is roadmapped. Pinned nodes show a filled,
   theme-accent pin badge with a canvas-colored halo at fixed pixel
   size (container-safe), composed via stacked background images.

**Interaction.** GraphToolbar (search with camera centering, layout
switching with force controls, Shuffle as the randomized escape
hatch, Pin all, zoom, and a selection-aware Export popover);
per-node position pinning through usePositionPinStore with a
context-menu action; ContextMenuManager with host-registered
actions; selection and hover stores; style-override store (bypass
mechanism, deliberately shadows overlay borders).

**Algorithm story.** Doctrine: results, not computation. A versioned
interchange document (nodeProperties / edgeProperties / overlay)
carries results from networkx, GraphBLAS, or any engine
(roadmap/design/algorithm-overlays.md has worked exports).
Property-shaped results ingest into the UGM where the spec drives
channels from them (clustering is a driver, not a feature);
structure-shaped results are named overlays (independent toggles,
union membership, emphasize/dim via classes, exact restore).
AlgorithmPanel provides runners (deliberately trivial reference
built-ins), overlay toggles, and the ingest surface, and reports
written property keys so hosts can wire visible consequences.

**Workspaces.** WorkspaceSnapshot v1 (encoding spec, positions,
pins, theme id) with capture/apply/serialize/parse; apply order
encoded once; storage is deliberately the host's choice.

**Structural rendering (slice A1, round 31).** layoutStructural in
@g3t/core: compartmented containers (stereotyped headers, typed
compartments, rows as REAL elements with text/compartment/divider
passthroughs) and fixed-side boundary ports, laid out by ELK per the
spike-validated recipe and returned as a versioned StructuralGeometry
document of absolute boxes (renderer-neutral). Synthetic row-ordering
edges are filterable via isChainEdgeId. SLICE A2 (round 32): the
canvas renders the document via the `structural` prop (preset
layout, compound parents with header strips, selectable drag-locked
rows, decoration ports, port-routed edges; STRUCTURAL_RULES merge
class-scoped). UML custom views and the SHACL shape view's
compartment slice are the committed clients.

**Export (slice 1).** exportSubgraphTurtle/Json/Csv over the induced
subgraph of a selection (nodes, properties, inter-edges only;
provenance IRIs pass through to prov:wasDerivedFrom) plus 2x canvas
PNG, all reachable from the toolbar. Later slices: JSON-LD, SVG,
structured reports.

**Theming.** Three presets (light, dark, high-contrast) flow through
CSS variables AND the canvas (themeColorRules; restyle-in-place, so
positions hold through a switch). createTheme/contrastRatio support
custom themes; deriveCytoscapeStyle remains a host-facing export.

**Documentation and deployment.** GitHub Pages site
(.github/workflows/docs.yml, single docs:build assembly): landing
page, TypeDoc API reference (wiring guide rendered inside it),
Storybook and the demo playground (the visual-acceptance walkthrough is retired).
typedoc validation (docs:check) is in the verify chain. The legacy
Sphinx skeleton in docs/source/ belongs to the old toolkit and is
flagged for next-major removal.

## Quality infrastructure

pnpm test (727), lint (eslint + react-compiler, warning budget),
typecheck, and pnpm verify (build, export/treeshake/smoke/type
checks, README-snippet compilation, typedoc validation, bundle
budget with a written ledger in scripts/check-bundle-size.mjs;
@g3t/react currently 278.7 of 280 KB). Spec gates:
scripts/lint_specs.py, scripts/sync_spec_status.py (status vs
citation drift; exits nonzero on drift), and
scripts/check_roadmap_coverage.py (every open requirement singly
owned; closed requirements must leave Owns headers and the
roadmap/CLAUDE.md index). (Historical: pnpm run visual-acceptance built the
living review page with live Cytoscape islands and a string-marker
self-check.

## Review state

Rounds 18 through 26 VERIFIED in the browser (user, 2026-06-12),
including the stacked-background pin badges that jsdom could not
confirm; the SVG-composition fallback is retired unneeded. Round-25
item 5 was an erroneous list continuation: closed. AWAITING REVIEW (a growing visual-acceptance backlog, all
desktop-only):
- VA-31 + minimap + demo view-switch (2026-06-22, headless-landed): (a) the
  structural edge-routing CONVERTER slice (the `curve-style: segments`
  projection above; VA-31 island packaged in outputs): edges should route
  around blocks, not behind, while declared-port edges still exit
  perpendicular; (b) the new Minimap component (Molecules/Minimap: a canvas
  overview with a draggable viewport rectangle, compound containers drawn as
  one rectangle rather than per-child, click/drag-to-pan) in the gallery and
  overlaid on the standalone demo in both views; (c) the standalone demo
  (`scripts/demo`) now carries a Graph/Structural view-switch with an ELK
  direction toggle. None of the three is headlessly verifiable: confirm
  rendering and interaction live.
- UNVERIFIED perf/warning fixes (2026-06-17): block-view lag and console
  floods were root-caused (via an instrumented build) to per-frame
  Cytoscape data-mapping warnings, not React. Landed and gate-green:
  type-filtering is a canvas `hidden` visibility op (restyle, not re-init)
  plus `animate={false}` on the demo canvases; `data(_size)` width/height
  scoped to `node[_size]`; `data(_confidence)` opacity scoped to
  `edge[_confidence]`; the inert `outline-offset: -2` removed from the
  selected structural-row rule. LIVE CHECK NEEDED: filter hides in place
  (no re-layout), force view immediately interactive, block-view console
  clean (no per-frame _size/_confidence warnings, no outline-offset
  warning). Deferred, needs sign-off: theme-driven border inset for the
  selected structural row (Round-43 intent, never rendered because
  Cytoscape rejects negative outline-offset); a stable scene-ref to drop
  the double structural re-init on block-view-on; routing the Cytoscape
  Core out of React state/props (GraphToolbar `cy` contract; profiling
  hygiene only). The block-view *freeze* (slow-load) fix this session is
  VERIFIED (Zach: load is fast).
- VA-29 (rounds 39-40): SHACL validation report over the DATA graph
  (R1.17, B1): all three severity tiers (violation/warning/info via
  sh:severity) as toggleable overlays, color from _shacl_maxSeverity
  and size from _shacl_resultCount through the encoding grammar.
  Round 40 also fixed multi-canvas overlay cross-dimming (global
  store) and added compartment-scoped right-click collapse to VA-27.
- VA-28 (rounds 37-38): the SHACL shape view via the compartment API
  («NodeShape» containers, "properties" rows, closed/open borders, a
  labeled reference edge, per-row badges).
- VA-27 (rounds 32-36): the structural view, ports, and collapse;
  the dagre verdict rides on it.
Bundles: @g3t/core 130 KB (129.3 used), @g3t/react 304 KB (302.4
used).

## Roadmap by functional group (reprioritized 2026-06-12)

Groups are sequenced by enablement, not by area age: the ELK
structural-rendering work lands FIRST because UML custom views and
the SHACL shape view are both clients of its compartment machinery
(build once, reuse twice). Within and across groups, order is
priority; no effort estimates.

**Group A: Structural rendering engine (ELK). IN PROGRESS (R1.18;
A1 geometry shipped round 31, A2 canvas application shipped round
32).** layoutStructural (core) produces the versioned
StructuralGeometry document; the canvas renders it via the
`structural` prop as a preset scene: compound containers with header
strips, SELECTABLE drag-locked compartment rows (id-matching wires
selection/inspector unmodified), decoration ports (promotable by
design), port-routed edges. VA-27 carries the live fixture and the
dagre verdict's visual surface. Design record:
roadmap/design/structural-rendering.md. Remaining: VA-27 review and
A3 polish from it, then the exit criterion (unchanged, REUSE-SHAPED):
the SHACL shape view consumes the compartment API unchanged.

**Group B: SHACL views (R1.16, R1.17), consuming Group A.**
Sequenced for early value with the reuse point explicit:
B1 (NO ELK dependency, can begin immediately): the validation-report
document contract, the adapter from the in-core validator, severity
tiers as structural overlays, counts and max severity as encoding
drivers. Almost entirely wiring of shipped machinery.
B2 (no ELK dependency): shape view slice 1 on CURRENT containers:
NodeShape containers, blank-node property shapes as child items with
path/type/cardinality summaries, reference and target edges,
closed/open border variants.
B3 (consumes Group A): property shapes graduate to compartment rows;
per-row result badges from loaded reports. This is the appropriate-
reuse milestone: SHACL renders through the same compartment API the
UML views use, zero parallel machinery.
B4: linked shape-and-data views (cross-highlighting, report
filtering), then logical-operator nesting with collapse.

**Group C: Provenance and virtualization affordances (R3.7,
rescoped).** Source-system indication on virtualized nodes plus
provenance (system, table, key) in inspector and tooltip. Reuses the
badge composition mechanism (pins) and the provenance passthrough
already in the Turtle exporter; thematically adjacent to B's
source-shape provenance display, so it follows B1 cheaply.

**Group D: Analyst workflow completion.** Temporal playback (R1.2,
R2.10) and the analytics panel (R1.8) close the in-progress views;
export later slices (R2.11: JSON-LD, SVG, structured reports) and
investigation bookmarks (R2.15, building on workspace snapshots)
complete the capture-investigate-report loop.

**Group E: Visualization algorithms.** Embeddings as layout
(property-shaped vectors feeding projection positioning) and overlay
set algebra if union semantics prove insufficient in review. Held
behind D because D's items are MUST/in-progress and these are SHOULD.

**Group F: Streaming visualization (R3.6 with R7.6).** The sliding-
window operational view; sequenced after D since it shares the
temporal machinery R1.2 builds.

**Group G: Platform and quality (continuous).** Documentation debt
(stories for EncodingSpecPanel tiers, SpecPort, workspace flows;
user handbook extraction after review settles; charts README parity;
Storybook publishing); Playwright canvas baselines (also pins the
round-24 growth trigger if it matters). These interleave with
feature groups rather than queueing behind them.

**Awaiting external input (not sequenced).** Holonic requirements
(R5.1, R5.6, R5.8) await community-group direction; the security
cluster (R8.x) awaits deployment posture; long tail: R2.16, R2.17,
R1.15, R7.11, R3.8 document linkage. Next-major cleanup (deprecated
encoding exports, Sphinx removal) executes at the version boundary.
