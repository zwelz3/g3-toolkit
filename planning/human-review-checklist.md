# Human review checklist (2026-07-07 build)

Fill inline: mark `[x]` pass, `[!]` fail (describe what you saw on
the `Result:` line), `[-]` skipped/blocked. Sections are ordered so
one pass through the app covers everything; per-shell steps are
grouped to avoid bouncing.

---

## 0. Build identity (do this first; gates everything below)

- [ ] Unzip `g3-toolkit-latest.zip`; BUILD_INFO.md says
      "FloatingPanel fold + elk verification" (or newer)
- [ ] In-app markers: Analytics has a graph toolbar over the canvas;
      workbench shows an "Entity table (N)" header bar at the bottom;
      auditor report has "Highlight ... on canvas" chips
      Result:

If any marker is absent, STOP: wrong artifact. Everything below
assumes this build.

## 1. Stale-build gates (prior FAILs re-tested; a FAIL here rejects my root-cause theory and reopens as P0)

- [ ] **Pin + icon (4.7):** pin a node, then Edit Appearance and set
      an icon on it. Expected: badge AND icon render together.
      Result:
- [ ] **SysML changes (6.5/6.7):** MBSE shell, Requirements diagram.
      Expected: a «verify» edge from an ImagingAcceptanceTest box
      (testCase header) plus a «satisfy» edge from the PowerBudget
      constraint block.
      Result:
- [ ] **FloatingLegend (4.3):** workbench Instances view and the
      supply canvas. Expected: a floating legend over each canvas
      whose colors match node colors.
      Result:

## 2. Scale shell (regression experiment + spacing)

- [ ] **Drill lag (9.8):** click a community, then return to
      clusters. Expected: no multi-second freeze; layout snaps or
      animates once to final positions (end-mode). If lag persists,
      note whether the eventual snap is INSTANT (that implicates
      re-init cost, the remaining theory).
      Result:
- [ ] Supernode spacing at the tuned numbers: readable, or does edge
      length still need to go up? (You said "way higher"; current is
      150.) Suggest a number if still cramped.
      Result:
- [ ] Dominant-type recolor chip: all supernodes restyle in place,
      zero node movement.
      Result:
- [ ] Labels: "X cluster around Y" unique per row, truncation
      acceptable at rail width.
      Result:

## 3. Analytics dashboard

- [ ] **Toolbar (new):** layout select + Run, search, zoom/fit, pin
      all: present over the canvas and functional.
      Result:
- [ ] **Multi-path (9.17):** right-click a node -> Find Paths To
      Here. Expected: ALL equally-short routes highlight (amber),
      label reads "N shortest path(s)", and a "Clear path" chip
      appears in the status strip and clears the dim.
      Result:
- [ ] Scatter tab (Centrality vs risk) has points at mount, before
      running anything.
      Result:
- [ ] Popout (9.20): View Neighbors opens at 1 hop, over the graph
      view corner, and drags by its header.
      Result:
- [ ] Multi-select 3+ nodes (one already pinned), right-click one,
      Pin/unpin. Expected: ALL selected end up pinned; repeat unpins
      all.
      Result:

## 4. Supply thread shell

- [ ] **Default canvas (9.10):** everything full strength at load; no
      unexplained dimming anywhere.
      Result:
- [ ] Gaps section: "Highlight violations/warnings on canvas" chips
      dim non-findings ONLY while toggled on.
      Result:
- [ ] Confidence-dim toggle now visibly fades `supplies` edges when
      enabled, back to full when off.
      Result:
- [ ] **Re-judge the legend (9.22):** with the overlay muting gone,
      is the legend still "just wrong"? If yes, describe what is
      wrong now (colors, entries, order, grouping).
      Result:

## 5. Ontology workbench

- [ ] **Search crash (9.9):** Instances tab, select a node so the
      neighborhood view appears, then use toolbar search and click a
      result. Expected: no crash; view centers or no-ops gracefully.
      Result:
- [ ] Viewport fill (5.16): panels reach the bottom of the window; no
      dead band.
      Result:
- [ ] Entity dock: starts collapsed; expand shows the table; row
      click selects on the visible canvas.
      Result:
- [ ] Axioms in the right rail: asserted first, then alphabetical.
      Result:
- [ ] SPARQL: presets run, results grid pages at 20 with sorting and
      the column menu; clicking a result row does NOT change canvas
      selection.
      Result:
- [ ] Split rings with inference on: aquila1 shows NO Subsystem slice
      (OW-F1 fixed); rings vs node shapes: still clashing (9.15 is
      open; describe severity)?
      Result:
- [ ] gsBravo in the SHACL report: conforms (the closed-shape errors
      you pasted were pre-fix behavior; confirm gone).
      Result:

## 6. Auditor shell

- [ ] **Floating panels (9.23 partial):** right-click an Entity ->
      Inspect lineage: panel floats bottom-left OVER the graph,
      drags by header. Inspect properties: floats top-right,
      drags. Both close.
      Result:
- [ ] Lineage root is stable: with a lineage open, click hops and
      other nodes; the tree must not re-root or collapse.
      Result:
- [ ] "Inspect lineage" absent on Agents.
      Result:
- [ ] Play at 250ms: reads as narration? Bubble sits above the
      timeline strip; bubble panel has a plain header (no inner
      collapse control).
      Result:
- [ ] Timeline ticks: kind glyphs visible, tooltips on hover; report
      what is visible at t0 (9.11: "Signed approval" at t0 is the
      open suspicion).
      Result:

## 7. Cross-cutting

- [ ] Reduced motion (OS setting on): layouts snap instead of
      animating everywhere; scale drill included.
      Result:
- [ ] Resolution sanity at your 1080/2k/4k monitors: worst offender
      shell and what breaks (feeds 9.25).
      Result:
- [ ] Bio shell: presets and edits auto-run (no Run button); is the
      analytics bar chart still broken (9.12)? Describe.
      Result:

## 8. Rulings (answer inline; these block the next slice)

- 9.4 Suppliers hidden-by-default: keep narrative / make reveal more
  discoverable / reverse to visible?
  Answer:
- 9.5 Cluster modes vs legend: fold modes into legend / keep both
  separated / remove modes?
  Answer:
- 9.6 Algorithm demos: one-click story chips / keep panels behind an
  "advanced" disclosure / other?
  Answer:
- 9.7 Structural edge routing: SVG overlay from ELK sections (my
  recommendation) / libavoid-js / keep patching Cytoscape?
  Answer:

## 9. e2e

- [ ] Run the Playwright suite. Expected: all green except
      `shell-supply-region.png` needing `--update-snapshots` once
      (rail restructure).
      Result:
