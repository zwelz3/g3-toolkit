# Review remediation plan

Source: p1-p2-review-checklist-filled.md (2026-07-06 review). Every
[!] finding maps to an item below; finding keys refer to the review's
sections (S0 setup, AD analytics, VF visual fit, SD schema dashboard,
SC supply chain, BT built-on-toolkit, SS scale, CM-A auditor menus,
CM-D dashboard menus, RM reduced motion, CI, CL changelog, OW
ontology workbench, OD open decisions, GC general, CY cytoscape
general, MB MBSE). Severities are P0 (broken or misleading), P1
(materially weakens the demo or toolkit story), P2 (improvement).
Sequencing approved 2026-07-06; decisions in section 8 resolved.
Spec requirement registration happens per-round as items enter
implementation, keeping spec statuses consistent with code citations.

---

## 0. Corrections to the review's premises

Two findings are correct behavior; one of them exposes an error I
made in the checklist itself.

**0.1 SPARQL communicatesWith counts (OW).** You observed 2 asserted
/ 4 inferred; my checklist predicted 1 / 2. The checklist was wrong:
the seed asserts TWO links (aquila1 -> gsAlpha and aquila2 ->
gsBravo), and symmetry adds two reverses. The code is correct; the
error was mine in writing the expectation. The per-query explainer
notes (item 4.6) will carry the correct expected counts so this class
of confusion cannot recur.

**0.2 SatelliteShape hasSubsystem severity disappearing under
inference (OW).** This is the demo working as designed: asserted-only,
aquila2 has no `hasSubsystem` (only the inverse `pwr2 subsystemOf
aquila2`), so minCount fires; the reasoner materializes the inverse,
the violation clears, the badge drops. It is the mirror of gsAlpha
(where inference ADDS a violation). The real finding is legibility:
nothing in the UI says a violation was resolved. Fix is item 4.5
(validation delta panel), not a code revert.

---

## 1. Cross-cutting root causes

Most findings cluster under eight causes. Fixing these once, at the
toolkit or shared-demo layer, resolves symptoms across every surface;
fixing symptoms per surface would multiply work and drift.

**RC1: No stable visual-encoding contract.** Palette assignment is
per-UGM-instance by type insertion order, so every projection rebuild
reshuffles colors (OW "colors change per tab"). There is no legend
component (OW, CY-3), no multi-type rendering (OW), no size-by
demonstrated, pin and custom icons collide (CY-1), and supply chain
wants icons not shapes (SC). Fix: encoding derives from a
caller-supplied stable domain; add Legend; extend node rendering.

**RC2: No standard graph chrome.** No layout/fit/reheat controls
(AD-4, CY-4), no graph search (CY-4), no animation toggle, and
therefore no way to demonstrate reduced motion (RM, CY-5). Fix: one
shared GraphToolbar + GraphSearch adopted by every shell.

**RC3: Selection conflated with emphasis.** Path results highlight
nodes like selection (CM-D, CY-2), nodes are muted with no narrative
in supply and auditor (SC, CM-A), and there is no first-class
"effect" concept. Fix: an emphasis/effects layer distinct from
selection state.

**RC4: Structural-view regressions.** Expand/collapse buttons dead in
both MBSE and the workbench (MB-1, OW), and edge routing looks broken
again despite the ELK obstacle-aware routing round (MB-4, OW). Two
targeted root-cause investigations; likely one cause each, shared
across surfaces.

**RC5: Workbench projection conflates display and validation
models.** I keyed instance-node properties BOTH by full predicate IRI
(for the validator) and local name (for the table), plus synthetic
`name`/`kind`/`iri` display keys. The core closed-shape check
correctly enumerates every property key, so gsBravo gets flagged for
`name`, `kind`, `iri`, and duplicate `callSign` (OW closed-shape
output), and the TableView shows IRI-polluted columns (OW datagrid).
Verified against `shacl-validator.ts:183-195`: the validator is
correct; my projection is the defect. Fix: split validation UGM
(full-IRI keys only) from display UGM (local names only).

**RC6: Windows portability + test stderr hygiene.** coverage-check.py
relied on the platform default encoding (cp1252 on Windows) (S0);
vitest emits echarts DOM-size warnings and act() warnings for
LinkedChart/TableView (S0). The act() class is likely the same
store-reset-while-mounted mechanism found in the workbench round.

**RC7: Fixture thinness.** Origin coverage only hits 0/100% (AD-3),
supply paths are too simple to be interesting (SC), the auditor
timeline is sparse (CM-A), MBSE has dangling references
(`payload.powerDraw` undefined) and incoherent IBD ports (MB-5), and
requirements lack satisfaction links (MB-2). Fix: one deliberate
fixture-authoring pass per surface with invariants tested.

**RC8: Front-door coherence.** Playground styling diverges from the
docs landing (VF, GC), cards lack screenshots (VF), landing has a
spider-web icon and internal links (GC), and the CHANGELOG entry I
wrote is bloated (CL).

---

## 2. Round 0: immediate, zero-design fixes [DONE 2026-07-06]

Mechanical items; no design decisions required. All P0 or trivial P1.

- **2.1 [S0, P0]** `coverage-check.py`: add `encoding="utf-8"` to all
  `open()` calls; audit every Python script in the repo for the same
  Windows default-encoding hazard (gates must pass on Windows
  unmodified).
- **2.2 [CL, P1]** CHANGELOG: cut the Ontology Workbench entry to a
  short factual summary (target under 12 lines).
- **2.3 [SS, P0]** Cluster list "(200)(200)": count is appended in two
  places (supernode label and panel row); emit once.
- **2.4 [OW, P2]** Instances scope dropdown: alphabetical sort.
- **2.5 [CM-D, P1]** Remove the duplicate "pin node" menu entry.
- **2.6 [OW, P2]** Add per-preset SPARQL explainer text (what the
  query returns, expected row counts asserted vs inferred; corrects
  0.1 permanently).
- **2.7 [S0, P2]** Test stderr hygiene: give echarts test containers
  explicit dimensions (or stub resize), and apply the
  cleanup-before-store-reset ordering to the LinkedChart/TableView
  act() warnings if they share that mechanism.

## 3. Round 1: correctness (P0 unless noted) [DONE 2026-07-06; see CHANGELOG]

- **3.1 [OW, RC5]** Split validation and display UGMs in the
  workbench projection. Validation UGM: full-IRI predicate keys and
  class-IRI types only. Display UGM: labels, local-name property
  columns, no IRI keys. Acceptance: gsBravo passes GroundStationShape
  closed cleanly asserted; with inference on, gsAlpha's only
  violation is missing `callSign`; TableView columns are local names.
- **3.2 [OW]** Add `ex:communicatesWith` to GroundStationShape's
  `ignoredProperties` (modeling decision: the closed-shape demo story
  is the missing callSign, not comms noise).
- **3.3 [MB-1, OW, RC4]** Root-cause the dead expand/collapse: the
  compartment-collapse store and menu exist in packages/react; find
  why the button path does not mutate rendered structural state in
  the playground shells. Fix at the cause; regression-test the button
  path headlessly. Includes the 3b ruling: wire collapse/expand via
  BOTH button and context menu in MBSE.
- **3.4 [MB-4, OW, RC4]** Edge-routing regression investigation: the
  obstacle-aware ELK routing round exists in history; determine
  whether the workbench/MBSE views bypass the routed geometry, the
  routing regressed, or the port-attachment architecture is not
  applied to these diagram types. Fix at the cause; capture the
  contract in a test so "fixed again" cannot silently unhappen.
- **3.5 [AD-5]** Centrality-vs-risk chart fails to load: diagnose and
  fix. Statistics panel x-bounds broken: fix the domain computation.
- **3.6 [OW]** ShaclShapeBrowser pass/fail icon inconsistency: some
  passing shapes show a check, others nothing, failing shape shows no
  X. Diagnose the component's summary logic; make the three states
  (pass/fail/not-evaluated) explicit and tested.
- **3.7 [OW]** Hierarchy equivalence rendering: mutual inferred
  subClassOf between an equivalent pair reads as taxonomy noise.
  Projection change: detect mutual subclass (equivalence encoding),
  suppress the derived pair, render one distinct `equivalentClass`
  edge (asserted style, distinct type). Acceptance: alias pair shows
  exactly one equivalence edge; toggling inference does not add
  subclass edges between them.
- **3.8 [SC, P1]** "Expand suppliers" no-op on a fully expanded graph:
  either seed the shell collapsed so the action means something, or
  disable with a reason. Prefer seeding collapsed (gives the action a
  narrative).

## 4. Round 2: toolkit chrome (RC1, RC2, RC3) [DONE 2026-07-07; budgets raised core 160 / react 420 per ratified direction, ledgered in scripts/check-bundle-size.mjs]

New shared machinery, then adopt in every shell. This round unblocks
many per-surface complaints at once.

- **4.1 [CY-4, AD-4, P1] GraphToolbar.** Floating toolbar: layout
  select, fit, reheat, animation toggle (wired to reduced-motion
  state so RM finally has a demo, per RM and CY-5), legend toggle,
  minimap toggle. Clean icons. Adopted by all shells.
- **4.2 [CY-4, P1] GraphSearch.** Autocomplete over node labels,
  match highlighting, Enter/click zooms to and selects the node.
  Standalone or toolbar-embedded.
- **4.3 [CY-3, OW, P1] Legend component.** Derives entries from the
  encoding domain (color/shape/size/icon), supports floating (default
  in most shells) and docked variants. Workbench "graphs need
  legends" closes here.
- **4.4 [RC1, OW, CY-8, P1] Stable encoding contract.** Encoding
  assignment keyed by a caller-provided domain (e.g. the store's full
  class list), not per-instance insertion order. Workbench computes
  the domain once; colors/shapes become invariant across tabs and
  hop changes. Extend the encoding spec surface to demonstrate
  color-by, size-by, and shape-by in at least one shell each; assess
  whether the encoding component needs visual variants (CY-8).
- **4.5 [OW, P1] Validation delta panel.** In the SHACL view, list
  violations that appear or disappear when inference toggles, each
  with a one-line cause (closes the 0.2 legibility gap and makes the
  disclaimer concrete).
- **4.6 [CY-2, CM-D, RC3, P1] Emphasis/effects layer.** First-class
  effect state distinct from selection: path effects highlight edges
  along the path, mute non-path elements, and do NOT restyle nodes
  like selection. "Find paths" adopts it; supply/auditor muting
  becomes intentional (driven by a stated narrative filter, visible
  in the legend) instead of unexplained.
- **4.7 [CY-1, P1]** Pin badge and custom type icon coexist: render
  pin as a corner badge layered over the icon, not a replacement.
- **4.8 [CY-7, P2]** Multi-select drag moves all selected unpinned
  nodes.
- **4.9 [BT, P1] CapabilityCallout bubble.** Shared floating
  bottom-right icon opening the "Built on the toolkit" panel; removes
  it from the rails where it gets pushed off-screen. Adopted by all
  shells.
- **4.10 [CM-D, OW, P1] Neighborhood popout.** Floating (or dockable)
  mini graph: hierarchical layout, default 1 hop, +/- hop control.
  Reuses the workbench BFS projection (promote `neighborhoodUgm` to
  a shared demo util or core alongside `buildSubgraph`). "View
  neighbors" menu item opens it; the workbench Neighborhood tab can
  adopt the same component.
- **4.11 [CM-D, P1]** Inspect opens an actual inspection panel
  (NodePropertyInspector exists in the toolkit); menu wiring only.
- **4.12 [CM-D, P2]** "Expand neighbors" gains a "collapse neighbors"
  counterpart. "Find paths from here" relabeled "to here" per the
  source-first interaction; adopts the 4.6 effect.
- **4.13 [CM-D, P2]** Edit-appearance popover clipped by the right
  rail: flip/collision-aware positioning.

## 5. Round 3: surface redesigns [COMPLETE 2026-07-07; 5.15 closed NO]

**Analytics Dashboard (AD):**

- **5.1 [P1]** Reframe the algorithms panel as what it actually is:
  demonstrations that visibly change the graph ("demonstrate cluster
  viz", "demonstrate shortest path", "add computed data", "change
  styling"); every action must have an obvious visible consequence.
- **5.2 [P1]** Derived-property panel: rename and connect the derived
  value to a visible encoding (e.g. size-by-degree via 4.4) so its
  purpose is self-evident.
- **5.3 [P1]** Origin-coverage fixture: guarantee at least one tier
  each at 0%, partial (~50%), and 100%; assert the invariant in a
  test so fixture edits cannot regress it.
- **5.4 [P1]** Layout: data table gets at least half the window;
  degree distribution and statistics visually reworked after 3.5
  fixes them.

**Schema Dashboard (SD):**

- **5.5 [P0 ruling to confirm]** Retire the Schema Dashboard per your
  note, following the flagship-retirement precedent (audit doc, test
  migration, landing/router removal). MatrixView and SankeyView still
  need a demonstration home; proposal: fold a compact
  matrix+sankey section into the Analytics surface rather than the
  workbench (the workbench is already dense). Confirm before
  execution.

**Supply Chain (SC):**

- **5.6 [P1]** Better default layout; type icons via 4.4/4.7.
- **5.7 [P1]** Kill unexplained muting (4.6 adoption): default state
  shows everything; muting only via explicit narrative controls.
- **5.8 [P1]** Consumer-readable section headers ("Entities per
  source" not "Provenance"); cluster controls move next to the
  legend with one-line descriptions; "tier" gets defined or renamed;
  cluster labels become semantic (dominant type + distinguishing
  member) instead of "Component 1".
- **5.9 [P1]** Gap-computation provenance: the UI states HOW gaps are
  computed (verify in code whether the gap analysis is a graph diff
  or SHACL-driven; label accordingly, with a "how this works" line).
- **5.10 [P2]** Richer supply-path fixtures: multi-tier alternatives,
  a shared-supplier diamond, at least one surprising path; invariants
  tested.

**Scale (SS):**

- **5.11 [P1]** Spacing/zoom: tune cluster and drill-in layouts
  (spacing factor, fit padding); investigate the odd zoom behavior.
- **5.12 [P1]** Cluster labels disambiguate (dominant type + index or
  top member); panel explains clusters are Louvain communities.
- **5.13 [P1]** Drill-in shows animated layout progress (it takes 1+
  seconds; the animation IS the loading affordance), honoring
  reduced motion.
- **5.14 [P1]** Expand the surface to demonstrate capability AT
  scale: layout switch, encoding change, and search (via 4.1/4.2)
  against the 8k graph, not just initial render.
- **5.15 [closed]** README promotion: NO per your answer; recorded.

**Ontology Workbench (OW):**

- **5.16 [P1]** Shell fills the viewport like other shells (browser
  CSS issue invisible to jsdom; fix the SurfaceFrame child sizing).
- **5.17 [P1]** Hierarchy layout with inference on: switch to fcose
  (or keep breadthfirst asserted / fcose inferred) so dashed edges
  stay readable.
- **5.18 [P2]** Persistent entity table: dockable bottom datagrid
  across tabs (your "datagrid visible for all tabs?" read as yes;
  confirm), pithy columns from the 3.1 display UGM.
- **5.19 [P2]** SPARQL results rendered via the toolkit datagrid
  rather than the bespoke table (evaluate TableView/QueryEditor fit;
  if TableView stays UGM-bound, add a tabular adapter).
- **5.20 [P1]** SHACL rail: visually separate the property browser
  from entity details; widen or move to a bottom drawer so four
  shape reports fit (pairs with 3.6 icon fixes).
- **5.21 [P1]** Multi-type nodes: render multiple class memberships
  (badge stack or split ring) once 4.4 lands; the workbench is the
  natural demonstration.

**New finding (2026-07-07, slice 4):**

- **OW-F1 [P1]** With inference on, aquila1 (asserted Satellite) is
  entailed rdf:type Subsystem. Suspect a domain/range mis-declaration
  in the model or a reasoner rule applying domain/range to the wrong
  triple position; plausibly the same root-cause family as the
  reviewed CommsSubsystem/CommSubsystem inferred-subClassOf oddity
  (checklist 7b). Investigate the reasoner rule trail; add a negative
  entailment pin once the correct behavior is established. The 5.21
  split ring makes this class of bad entailment visible on the
  canvas.

## 6. Round 4: auditor + MBSE depth [IN PROGRESS: 6.1-6.3, 6.5, 6.7, OW-F1 done 2026-07-07; remaining: 6.6]

**Auditor (CM-A):**

- **6.1 [P1]** Lineage: rename to "Inspect lineage"; fix the
  tree-collapse-on-click misbehavior; offer lineage only where it is
  meaningful (entities tied to the SHACL report), not on AGENT;
  "Inspect properties" opens the properties panel (4.11).
- **6.2 [P1]** Default muting removed (4.6 adoption).
- **6.3 [P2]** Timeline scroller: per-event symbols/colors and
  hover tooltips; a play control if feasible within the range-slider
  architecture; denser fixture data (RC7).

**MBSE (MB):**

- **6.4 [P0]** Covered by 3.3/3.4 (collapse + routing).
- **6.5 [P1]** Requirements view becomes a requirements-breakdown
  tree; fixtures add a constraint and a test case satisfying
  requirements so verification traces render.
- **6.6 [P2]** Selection-driven property browser (limited datagrid)
  for model browser and graph.
- **6.7 [P1]** Fixture coherence pass: every referenced attribute
  (e.g. `payload.powerDraw`) is defined in the structure; IBD ports
  correspond to the structural browser; add an invariant test that
  cross-references fixture references against declarations.

## 7. Round 5: front door (RC8)

- **7.1 [P1]** Playground page restyled to match the deployed docs
  landing.
- **7.2 [P1]** Per-card screenshots (small/compressed), captured from
  the finished surfaces; do this AFTER rounds 2-4 so the screenshots
  are compelling rather than redone.
- **7.3 [P2]** Docs landing: replace the spider-web playground icon;
  remove the Sources-and-guides card (footer GitHub link suffices);
  remove the internal pre-publish checklist link.
- **7.4 [P2]** Verify playground descriptions and stats blocks
  against reality (counts, capability claims).
- **7.5 [CI, decision below]** Execute the screenshot-baseline
  decision.

## 8. Decisions (RESOLVED 2026-07-06)

**8.1 CI screenshot baselines (CI).** Recommendation: commit
Linux-generated baselines only, produced by a one-time CI job running
Playwright with --update-snapshots and uploading the artifact for a
commit; CI (Linux) is then the visual arbiter and drops
--ignore-snapshots; Windows local runs keep --ignore-snapshots since
platform-suffixed snapshots would otherwise double the maintenance
surface for no gating value. Shells-only scope per D4 stands. ACCEPTED: Linux-only CI baselines; workflow addition in Round 5.

**8.2 boxSelectOnDrag (OD).** What it means: today, box selection
requires holding Shift while dragging (cytoscape's convention; plain
drag pans the canvas). The proposed prop would make PLAIN drag draw a
selection box and disable drag-panning, like a drawing tool.
RESOLVED: keep shift+drag convention; parked.

**8.3 Edge collapse / "jump" edges (CY-6).** Worth doing but it is a
real feature: aggregate parallel or multi-hop edges into one styled
"jump" edge with an icon, re-expandable via context menu; plausible
input mechanism is multi-select plus a selection context menu action.
Proposal: write a short design doc first (state model, UGM
representation, interaction) as a P2 spec item; implementation in a
later round after the chrome work stabilizes interaction patterns.
ACCEPTED, with the added requirement that the feature is
demonstrated in at least one shell (ideally more) when implemented.

**8.4 Schema Dashboard retirement (5.5).** RESOLVED: retire Schema Dashboard; matrix/sankey relocate to
Analytics.

**8.5 Workbench persistent datagrid (5.18).** CONFIRMED: all-tabs docked datagrid.

## 9. Sequencing rationale

Round 0 and Round 1 are pure correctness and can start immediately;
nothing in them depends on a decision. Round 2 (chrome) precedes the
surface redesigns because 5.x items repeatedly consume 4.x
components (toolbar, legend, stable encoding, effects, callout
bubble); building surfaces first would mean rebuilding them after.
Round 5 runs last so screenshots and copy capture the final state.
Reduced-motion verification (RM) unblocks inside Round 2 via the
toolbar animation toggle. Findings closed with no action: SS
promotion (NO, 5.15), the two items in section 0.

Traceability check: S0(2.1, 2.7), AD(5.1-5.4, 3.5, 4.1), VF(7.1,
7.2), SD(5.5), SC(3.8, 5.6-5.10), BT(4.9), SS(2.3, 5.11-5.15),
CM-A(6.1-6.3), CM-D(2.5, 4.6, 4.10-4.13), MBSE menu ruling(3.3),
RM(4.1), CI(8.1, 7.5), CL(2.2), OW(0.1, 0.2, 2.4, 2.6, 3.1, 3.2,
3.3, 3.4, 3.6, 3.7, 4.3-4.5, 5.16-5.21), OD(8.2, 3.3), GC(7.1, 7.3,
7.4), CY(4.1-4.8, 8.3), MB(3.3, 3.4, 6.5-6.7).

## Browser verification backlog

Items the sandbox cannot verify (Playwright unavailable; jsdom has no
real renderer), accumulated per slice and maintained here at every
slice close. Check off during Windows passes; anything that FAILS a
check reopens as a finding with the originating item cited.

**Verify build identity FIRST.** 28 historical zips accumulate in the
outputs directory; a pass run against a stale build reports every
later slice as broken (incident 2026-07-07: pin/icon and workbench
layout reported unfixed; the latest zip byte-verified as containing
both fixes). BUILD_INFO.md in the repo root states the slice and
carries visible date-this-build markers; g3-toolkit-latest.zip is the
canonical artifact. Only failures reproduced on a marker-confirmed
current build reopen findings.

### Canvas mechanics (Rounds 0-2)

- [ ] Routed structural edges render along their ELK polylines: the
      routed rule maps segment-distances/weights from data(); if
      Cytoscape rejects data() for these multi-value props the
      fallback is the per-element style bypass (2.3, MBSE/structural)
- [ ] GraphToolbar and FloatingLegend overlay placement at real
      viewport sizes, workbench and scale shells (4.1-4.3)
- [ ] Emphasis effect contrast per shell theme: amber path on 0.15-dim
      complement, supply trace-route and Analytics path (4.6)
- [ ] NeighborhoodPopout legibility and hop stepper at real sizes (4.10)
- [ ] Pin badge composes over an encoded icon after Edit Appearance
      changes the icon (composePinStack, 4.7)
- [ ] Multi-select drag feel, including a pinned (locked) node inside
      the selection staying put (4.8)
- [ ] Dashboard style editor clear of the right rail at narrow
      viewports (4.13)

### Round 3 slice 1 (Analytics)

- [ ] Sankey visual parity after the SVG-renderer switch, Analytics
      "Type flows" tab (5.5)
- [ ] Whether the path demo was the invisible action in the original
      review: it registers a round-21 overlay the canvas should
      render; if it still shows nothing, the overlay rendering path
      is implicated, not the demo (5.1)
- [ ] Half-window data row and ~60% table pane proportions; flag if
      the intent was the table at half the TOTAL dashboard area (5.4)

### Round 4 slice 2 (OW-F1, MBSE)

- [ ] Workbench with inference on: aquila1 no longer carries a
      Subsystem ring slice; prop1 no longer shows Component (OW-F1)
- [ ] Requirements diagram: «verify» edge and the testCase stereotype
      box render distinctly from «satisfy»; the constraint block's
      satisfy edge reads sensibly beside its parametric role (6.5)

### Round 4 slice 1 (auditor)

- [ ] Default canvas shows everything at full strength; the highlight
      chips dim non-findings only while active (6.2)
- [ ] Tick glyphs legible at track density (23 events); tooltips
      readable; started/ended greys distinguishable from the accent (6.3)
- [ ] Play sweep pacing (200ms steps, 32 steps) reads as narration
      rather than flicker; pause and reset behave (6.3)
- [ ] Lineage panel: explicit open from the menu feels right; hop
      clicks select on canvas without the tree moving (6.1)
- [ ] Inspector panel placement in the left rail does not crowd the
      report at real sizes (6.1)

### Round 3 slice 5 (workbench datagrid)

- [ ] Entity dock proportions across tabs at real sizes: 200px grid
      plus header does not starve the hierarchy or shapes canvases;
      collapse state feels right as the escape hatch (5.18)
- [ ] Dock row click selects on whichever canvas is visible;
      selection styling in dock and canvas agree (5.18)
- [ ] SPARQL grid at 50-row pages: column menu, sorting, and paging
      behave on the inference-demo presets; unbound OPTIONAL cells
      read as intentionally empty (5.19)

### Round 3 slice 4 (workbench P1)

- [ ] Workbench fills the viewport after the explicit grid row
      template; no dead band below the panels (5.16)
- [ ] Hierarchy with inference on: fcose spreads the dashed
      inferred edges legibly; the toggle's re-layout transition is
      acceptable (5.17)
- [ ] Right rail at 380px: four shape reports fit; the three section
      cards read as separate panels; rail scrolls rather than
      clipping (5.20)
- [ ] Split rings on multi-type individuals: slice colors match the
      legend; rings legible at default node sizes; the aquila1
      Subsystem slice is VISIBLE (it is a recorded bad entailment,
      OW-F1, not a rendering bug) (5.21)

### Round 3 slice 3 (scale)

- [ ] Supernode view spacing at the tuned numbers (idealEdgeLength
      150, repulsion 50k, padding 60): comfortable or still cramped;
      and whether the odd zoom is gone with fit padding (5.11)
- [ ] Drilled-community spacing at its tuned numbers (5.11)
- [ ] Drill-in layout animation reads as a loading affordance over
      the 1s+ layout; freezes to final positions under reduced
      motion (5.13)
- [ ] Dominant-type recolor at scale: all supernodes restyle in place
      with no node movement (5.14)
- [ ] Disambiguated labels at real rail width ("Service cluster
      around Service 12-88" may need truncation) (5.12)

### Round 3 slice 2 (supply)

- [ ] Breadthfirst renders the supplier -> part -> assembly -> product
      DAG as readable tiers (5.6)
- [ ] Per-tier type icons render and coexist with pin badges (5.6/4.7)
- [ ] Confidence-dim toggle: default full strength, visible dimming
      only when enabled (5.7)
- [ ] Semantic cluster labels at real row widths; truncation tuning if
      "Mostly Part: around Control PCB" overflows (5.8)
- [ ] Any REMAINING node-side fading on the supply shell: the fix was
      edge-side (confidence); if nodes still read as muted, suspect
      label halo contrast and reopen (5.7; auditor counterpart is 6.2)

## 9. Round 6: browser-pass findings (2026-07-07, verified against build TBD)

Zach's first full Windows pass over the accumulated backlog. Build
identity NOT yet confirmed against g3-toolkit-latest.zip; three items
are stale-build diagnostics and gate their sections. Triage: four
categories with different next actions.

### 9.A Stale-build gates (re-verify on latest BEFORE treating as failed fixes)

- **9.1** Pin/icon coexistence "still persists" (4.7). Landed Round 2.
  If reproduced on a marker-confirmed latest build, composePinStack's
  two-write-path theory is wrong and 4.7 reopens as P0.
- **9.2** "None of the specified SysML workbench changes visible"
  (6.5/6.7). Landed in the FINAL slice (round4-slice2); highest prior
  of any item for a stale artifact. Markers: «verify» edge +
  testCase box on the requirements diagram.
- **9.3** FloatingLegend "not visible on any example" (4.3, Round 2).
  If absent on latest: real rendering/positioning bug (possibly
  rendered off-viewport), P0, since three shells claim it.

### 9.B Ruling needed (design questions, not defects)

- **9.4** Suppliers seeded hidden is BY DESIGN (3.8: reveal-chip
  narrative). Keep the narrative, make the reveal more discoverable,
  or reverse to visible-by-default?
- **9.5** Supply "Clusters (choose a mode)" vs the 5.8 legend:
  redundant now? Options: fold mode selection into legend
  interactions; keep both with clearer separation (also 9.22); or
  remove modes.
- **9.6** Analytics algorithm demonstrations "too complex for a
  demo": simplify to one-click story chips (e.g. three buttons, no
  panels), or keep panels behind an "advanced" disclosure?
- **9.7** ELK-style edge routing (answered in prose; decision
  needed): the durable fix for edges-behind-nodes / exact-overlap /
  wrong-port-exit is rendering structural edges as an SVG overlay
  driven directly by ELK's routed sections, instead of re-projecting
  into Cytoscape's edge model (lossy by construction). Candidate
  libraries if overlay is rejected: libavoid-js (orthogonal connector
  routing). Proposal: fold into the 8.3 design doc as one routing
  architecture decision.

### 9.C Investigate-first (mechanism unknown or regression-suspect)

- **9.8 [P0]** Scale: community-selection lag. Console clean
  (2026-07-07), warning-flood theory DEAD. Current theory: fcose
  animate:true renders every layout tick; drill/return re-init and
  re-run layout. Experiment shipped: scale overrides animate to
  "end" via layoutOptions (pinned). If lag persists: re-init cost
  itself; next step is element mutation instead of UGM identity swap
  (canvas-level change, design first).
- **9.9 [P0]** DONE 2026-07-07. Confirmed: stale viewCore across
  the instances -> neighborhood swap (reset was tab-switch-only).
  Toolkit-level guard: GraphToolbar treats a destroyed instance as
  absent; whole class closed for all shells.
- **9.10 [P0]** DONE 2026-07-07. Root cause: gap overlays
  registered ACTIVE (the dominant source of the ORIGINAL 5.7 muting;
  the confidence-edge fix was partial). Register-inactive + Highlight
  chips, mirroring 6.2. Re-check 9.22 legend complaints on the next
  pass before further legend work.
- **9.11 [P1]** Auditor t0: "Signed approval" visible at t0 is
  suspect (hiddenForRange handling of entities/activities without
  in-range events; the missing end time on act:approve is the likely
  hole). "Legacy spec" at t0 is CORRECT (generated 2025-01-05, the
  fixture's earliest event).
- **9.12 [P1]** Bio analytics bar chart "still broken"; mechanism
  unknown.
- **9.13 [P1]** Workbench layout config controls "do something but
  seem broken"; enumerate which options misbehave.
- **9.14 [P1]** 5.16 viewport fill re-flagged with no comment;
  re-verify on latest; if broken there, the implicit-row theory was
  incomplete.

### 9.D Confirmed work items

**P0 (dead or wrong behavior):**

- **9.15** Split rings render as circles OVER shaped nodes (5.21 vs
  the shape channel): pie backgrounds ignore node shape. Fix
  direction: suppress the shape channel on multi-type nodes, or
  replace pie with border-segment arcs; legend must gain the shape
  channel it currently omits.
- **9.16** DONE 2026-07-07: selection-coherent pin (target's new
  state applies to all selected); Pin Selected writes the store
  directly.
- **9.17** DONE 2026-07-07: allShortestPaths union in core (count
  capped at 50); Clear path chip on the analytics status strip.

**P1 (UX and correctness):**

- **9.18** Search: consistent wiring across shells; no re-layout
  shake while typing (scale); dropdown-selection performance; clear
  affordance (x button; selection clears input).
- **9.19** Emphasis styling: glow/stroke instead of full recolor;
  thickness reduced; clear affordance on every adopting surface.
- **9.20** DONE 2026-07-07: opens at 1 hop; absolute positioning
  inside the graph view; dependency-free header drag. Resizing not
  included (needs either a dep or hand-rolled resize handles; say if
  wanted).
- **9.21** Node style editor still clipped in shells (4.13
  insufficient; needs a portal or viewport-aware placement).
- **9.22** Supply rail: legend "seems just wrong" (enumerate on
  latest); legend and grouping as separate sections; "Dim record does
  nothing" (9.10 sibling); fixture still not "interesting" (pairs
  with 9.4/9.5 rulings).
- **9.23** PARTIAL 2026-07-07: lineage floats bottom-left and the
  inspector floats top-right over the graph on the new FloatingPanel
  (both draggable). REMAINING: accent colors follow type styles with
  severity to background; tree row selected state; near-node
  anchoring for the inspector; timeline panel width.
- **9.24** DONE 2026-07-07: static header inside the bubble on all
  shells; auditor bubble lifted above the timeline strip
  (bottomOffset).
- **9.25** Responsive layout across 1080/2k/4k for all shells
  (systematic, not per-shell tweaks).
- **9.26** DONE 2026-07-07: asserted first, then rendered text.
- **9.27** Structural collapse/expand resets the entire layout
  (round-trip camera/geometry preservation incomplete).

**P1 polish sweep (small tunables, one slice):**

- **9.28** DONE 2026-07-07 (all four).

### Ordering proposal

Slice A: 9.A re-verification (Zach) + 9.8/9.9/9.10 investigations.
Slice B: P0s (9.15-9.17) + whatever 9.A reopens.
Slice C: rulings applied (9.4-9.6) + supply/auditor UX (9.22-9.24).
Slice D: search/emphasis/popout (9.18-9.20) + polish sweep (9.28).
Round 5 (front door) stays parked until this round stabilizes; 9.7
folds into the 8.3 design doc.

## 10. Review protocol (consolidated 2026-07-07; supersedes the scattered backlog for the next pass)

Done items from earlier backlog sections are settled; this is the
complete, ordered list for the next Windows pass. Report per item:
PASS, FAIL (with what you saw), or N/A.

**Step 0: build identity (gates everything).**
Unzip g3-toolkit-latest.zip; confirm BUILD_INFO.md says "Round 6" or
later; in the app: workbench has the bottom Entity table header,
auditor report has Highlight chips, Analytics has a graph toolbar
over the canvas. If any marker is absent, stop and fetch the right
artifact.

**Step 1: the three stale-build gates (9.1-9.3).**

1. Edit Appearance an icon onto a pinned node: badge and icon
   coexist? (4.7)
2. MBSE requirements diagram: «verify» edge + testCase box render?
   (6.5)
3. FloatingLegend visible on workbench instances and supply canvas?
   (4.3)
   FAILs here reopen as P0 with my prior root-cause theories rejected.

**Step 2: regression experiment (9.8).**
Scale: select a community, return to clusters. Lag gone with the
end-mode animation? If lag persists, note whether the SNAP to final
positions is instant (implicates re-init cost, next step element
mutation).

**Step 3: this round's fixes, per shell.**

- Analytics: multiple diamond paths render on Find Paths To Here;
  Clear path chip works; toolbar (layout/fit/search) present and the
  scatter loads at mount (checklist line 51 re-check).
- Supply: canvas full-strength by default; Highlight chips dim only
  while active; confidence-dim toggle now visibly does something;
  re-judge the legend (9.22) AFTER this, since overlay dim was
  muddying it.
- Workbench: search-result click on the instances tab (with a
  neighborhood open) no longer crashes; dock starts collapsed;
  axioms sorted; SPARQL pages at 20.
- Auditor: bubble sits above the timeline; static header in the
  bubble panel; play at 250ms; t0 contents (9.11 still open:
  report what is visible at t0).
- Popout: opens at 1 hop, over the graph view, draggable by header.
- Multi-select pin: pins/unpins ALL selected coherently.

**Step 4: rulings needed (blocking slice C).**
9.4 suppliers hidden-by-default narrative: keep / make discoverable /
reverse. 9.5 cluster modes vs legend. 9.6 algorithm-demo
simplification shape. 9.7 SVG-overlay routing decision (for 8.3).

**Step 5: e2e.**
Run the suite; shell-supply-region.png needs --update-snapshots once
(rail restructure); everything else should pass unchanged.

**G5 (CI baselines, decision help you asked for):** commit Linux
baselines only after Step 1-3 pass on Windows, from a single CI run
on the then-current main, shells-only per D4; drop
--ignore-snapshots in the same commit. Committing before this pass
stabilizes would bake possibly-wrong renders into the gate. If you
want, the Round 5 slice can add a baseline-refresh workflow step so
regeneration is one CI dispatch rather than a local ritual.

## 11. Traceability sweep results (2026-07-07)

Every [!] finding in the original checklist audited against a
disposition. Gaps found and closed: checklist line 50 (graph controls
on Analytics; toolbar was adopted on workbench/scale only; now
mounted with a live core handle) and line 121 (CHANGELOG OW section;
verified already reduced to 14 lines). Line 51's "scatter doesn't
load" is code-correct at mount (degree ingests in the ugm memo);
browser re-check in Step 3. The 7b gsBravo closed-shape question is
ANSWERED: the pasted violations were pre-round-1 behavior, fixed by
the display/validation projection split (3.1, pinned in
project.test.ts); no fixture change was needed and the
conforms-on-asserted contract stands. All other findings trace to
done items, Round 6 items, or recorded rulings.

### Test-debt items (coverage analysis 2026-07-07)

- **9.29 [P1]** Zero-coverage load-bearing core modules: event-bus
  (typed events every shell rides), filter, undo-redo. Suites with
  behavior pins, not line-chasing.
- **9.30 [P2]** Zero-coverage peripheral modules: diff-engine,
  relational-virtualizer, theme/design-tokens.

### Dead-code disposition detail (2026-07-07, Zach's supersession question)

All four deleted files were src/demo/ scaffolding; packages/ was
untouched. Two were genuinely superseded by toolkit components
(FloatingInspector -> NodePropertyInspector 4.11; RightPanel ->
NeighborhoodPopout 4.10 plus shell rails). Two were orphaned with NO
successor, deleted purely as unreferenced, and both encode ideas
pending items may want:

- ResizablePanels (dependency-free two-pane splitter): candidate
  primitive for 9.25 responsive layouts and popout resizing.
- elkWorkerEngine (worker-thread elkjs; solved main-thread blocking
  and StrictMode double-invoke): input to the 9.7/8.3 routing
  architecture decision.

Both recoverable from any pre-deletion zip
(g3-toolkit-round4-slice2.zip or earlier); rewrite vs restore is a
call to make when a consumer exists.

## 12. Round 7: human-review results (2026-07-08, marker-confirmed current build)

e2e green. Three theory rejections, one experiment result, three
rulings. Items numbered 12.x.

### Theory rejections (P0 investigations, prior fixes insufficient)

- **12.1 [P0]** Pin badge invisible when an icon is set (4.7 REOPENED
  on a confirmed build; composePinStack theory rejected). Symptom
  detail: pinning FUNCTIONS (node locks); the badge does not render.
  Suspect the pinned rule's multi-image channel (data(\_bgStack) may
  not carry arrays, or layer-2 position/size params missing).
- **12.2 [P0]** MBSE requirements diagram: no «verify» edge visible;
  PowerBudget headers as "Block" not constraint; subrequirements
  absent from the model browser (6.5 projection PASSES its unit pins,
  so the gap is downstream: shell rendering path or ContainmentTree
  walk).
- **12.3 [P0]** 5.16 REOPENED: workbench fills ~60% of window; ow-grid
  implicated; dock expansion grows it to ~90%; SPARQL results
  overflow past 100%. Diagnosis: grid height is still CONTENT-driven,
  meaning flex:1 is inert (parent chain not a filled flex container);
  the row template fixed the inner rows but not the grid's own
  height.

### 9.8 resolution state

- **12.4 [P0]** Snap instant, relayout performant: animate="end"
  fixed the layout phase. Remaining: INITIATION lag, supernode view
  ~5x worse than drill, possibly accumulating across view switches.
  Prime suspect: the clusters-view UGM memo re-running
  collapseByCluster (Louvain over 8k nodes) on every return; the
  accumulation smell additionally suggests a leak (store
  subscriptions surviving re-init). Same lag family reported on the
  workbench Scope dropdown (12.13).

### Tuning rulings applied verbatim

- **12.5** Scale: idealEdgeLength 300 (clusters view); edge-labels
  toggle, default OFF; rail width 280px.
- **12.6** Analytics rail: REMOVE everything except "Origin coverage
  by tier" (Zach's 9.6 ruling: the demonstrations stay unhelpful).
- **12.7** Supply: keep suppliers hidden (9.4 ruling); flash/highlight
  the reveal-all notice.
- **12.8** Auditor: widen au-timeline further; au-event-kind width
  fits «generated».

### New defects

- **12.9 [P1]** Toolbar search auto-centers the first match while
  TYPING (jumpy); center only on explicit result click, and center
  the CLICKED result, not the first match (workbench variant: non-top
  dropdown picks select but never center).
- **12.10 [P1]** Popout canvas should FIT the neighborhood subgraph,
  not center the subject.
- **12.11 [P1]** Inspector, all usages: opens over the data grid, not
  the graph (analytics); wrapper box too small; RULING: render the
  g3t-inspector with its own close button (toolkit onClose), no
  wrapper; type-section colors must use the surface's categorical
  map.
- **12.12 [P1]** Confidence-dim toggle visually negligible (0.9 vs
  1.0): amplify the patched opacity when enabled (map sub-1
  confidence to a clearly-dimmed value), restoring true values off.
- **12.13 [P1]** Workbench Scope switch multi-second lag (12.4
  family): apply the end-mode animation experiment to workbench
  canvases; investigate re-init cost.
- **12.14 [P1]** Left-rail "Search entities": add clear (x); clear on
  any selection.
- **12.15 [P1]** Split rings clash with node shapes CONFIRMED (9.15):
  a colored circle renders over the shaped node. Direction: force
  multi-type nodes to ellipse (the ring IS the shape story), and the
  legend gains the missing SHAPE channel (workbench legend shows
  color only).
- **12.16 [P1]** Supply rail legend colors wrong (rgb(71,85,105)
  slate: a fallback, not the palette) and supply canvas has NO
  FloatingLegend at all (4.3 never adopted there).
- **12.17 [P1]** Auditor t0 CONFIRMED (9.11): "Signed approval"
  visible at the window's left edge; suspect hiddenForRange's
  handling of the record with no end time.
- **12.18 [P1]** Reduced motion not honored by @g3t/charts (echarts
  animation flag).
- **12.19 [P1]** Bio bar chart: bars black at 100% width (series
  item color + bar width config).
- **12.20 [P1]** Elk views: expand/collapse still resets the entire
  layout (9.27 confirmed, all structural surfaces).
- **12.21 [P2]** Analytics + workbench are the resolution worst
  offenders (9.25 focus narrows to these two).
- **12.22 [P2]** Supply layout/spacing pass.

### Rulings and research

- **12.23** DONE 2026-07-08: decision doc at
  planning/routing-architecture-decision.md. Recommendation: 12.20
  ELK interactive experiment first, then per-surface SVG overlay;
  libavoid-js rejected-for-now with a revisit trigger. AWAITING
  Zach's ruling on the recommendation.
- **12.24** 9.5 (cluster modes vs legend) remains UNANSWERED; ask
  again after 12.16 fixes the legend colors.
- **12.25 [P2]** README staleness check; docs homepage style aligned
  to the landing page's lighter minimal style.

### Ordering

Slice 1 DONE 2026-07-08 (12.4 instrumented after three suspects
eliminated; 12.5, 12.9, 12.12, 12.8 shipped; 12.13 rides the next
lag data). Slice 2 DONE 2026-07-08 (12.1 bypass rewrite; 12.3 SurfaceFrame
root cause; 12.2 tree walk + kind headers + scene pin). Slice 3 DONE 2026-07-08: 12.16 (value-keyed lookups; FloatingLegend
promoted and adopted on supply); 12.11 (typeColorOf on the toolkit
inspector; analytics floats over the graph, no wrapper); 12.6 (rail
reduced to Origin coverage per ruling); 12.7 (notice pulse). 12.15
ellipse half done; REMAINING: SpecLegend shape channel. Slice 4 DONE 2026-07-08 except 12.20: 12.15's legend shape channel
(default-channel rows), 12.17 (answered: undated-by-design; timeline
cue added), 12.19 (inline-span fill; display block), 12.18 (echarts
RM gate), 12.14 (clear x + clear-on-selection), 12.10 (fit contract).
12.20 folds into 12.23 (ELK interactive-mode experiment: camera is
already preserved; positions reset because ELK recomputes). Next:
12.23 research doc; 12.13 rides the 12.4 instrumentation numbers;
12.21/12.22/12.24/12.25 close-out.
