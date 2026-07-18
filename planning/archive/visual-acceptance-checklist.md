# Visual Acceptance Checklist — Structural + SHACL (rounds 31–45)

Everything below is built and gate-clean (tests, lint, typecheck,
verify, spec gates all pass) but has NOT had visual sign-off. The
gates cannot judge rendering quality, layout aesthetics, or
interaction feel; only a person at a desktop can. Work through this
on the latest visual-acceptance HTML (round 45+). Each item is a
concrete pass/fail check, not a description.

Desktop is required: several checks are right-click, drag, hover, or
theme-toggle interactions that do not exist on mobile.

The single most important still-open verdict is **the dagre verdict**
(VA-27, item G): it has been pending since round 31 and gates whether
dagre stays unbundled permanently.

---

## VA-27 — Structural (UML-style) view

The «Block» fixture: three compartmented containers (Sensor, Lens,
FlightComputer), a plain note node, ports, and edges.

**A. Container/compartment rendering**

- [ ] Three containers render as ROUNDED rectangles, each with a
      header strip over typed compartment rows.
- [ ] Rows stack with NO gaps, in declared order, all at one shared
      width; the container border hugs the rows exactly (no slack).
- [ ] The bottom row's lower corners match the container's rounding.
- [ ] Compartment titles ("attributes", "operations") render as
      italic divider rows.

**B. Row selection**

- [ ] Clicking a row selects EXACTLY that row (full accent ring), not
      the container, header, divider, or siblings.
- [ ] The selection ring shows on all four sides (not clipped by the
      zero-gap neighbours above/below).
- [ ] Selecting a row does NOT visibly grow the container border or
      push it into the ports (round 43 fix: the ring is inset).
- [ ] Rows never drag independently; dragging the container moves the
      whole unit (header, rows, ports) together.

**C. Ports** (rendering strategy is an acknowledged open question —
judge "acceptable for now," not "final")

- [ ] Ports render as open (border-only, unfilled) squares.
- [ ] Ports sit fully OUTSIDE the container, flush along the edge on
      their declared side, not floating inside it.
- [ ] The port border does NOT collide with the container border
      (round 42 offset); there is a small clean gap.
- [ ] Dragging a container carries its ports with it.

**D. Layout direction**

- [ ] "Re-layout DOWN/RIGHT" button restacks the DAG in the chosen
      direction; ports follow the flow (sides flip appropriately).

**E. Collapse — config surface**

- [ ] "Toggle ALL operations" collapses/expands the operations
      compartment across all containers; content rows vanish, a
      "(n hidden)" divider remains, and each container SHRINKS.

**F. Collapse — context-menu surfaces** (right-click)

- [ ] Right-clicking a container HEADER offers "Collapse / expand
      compartments" and toggles ALL its compartments.
- [ ] Right-clicking a specific compartment (a row or its divider)
      offers "Collapse / expand this compartment" and toggles ONLY
      that compartment, leaving siblings alone.
- [ ] Collapsing re-runs layout (other containers may shift position;
      this is intended — it is a structure change, not a restyle).

**G. THE DAGRE VERDICT** (the load-bearing check)

- [ ] The elk.layered layout reads as clean layers
      (Sensor → Lens → FlightComputer). If this layering quality is
      satisfactory, dagre stays unbundled permanently. **This is the
      decision that has been pending since round 31.**

**H. A3 UML edge vocabulary** (round 45)

- [ ] "composes" edge: FILLED DIAMOND at the FlightComputer (whole)
      end.
- [ ] "generalizes" edge: HOLLOW TRIANGLE at the parent end.
- [ ] "annotates" edge: DASHED line with an open arrow (dependency).
- [ ] "feeds"/"frames" data-flow edges: plain arrows, labeled.

**I. Dark mode** (round 41) — toggle the theme switcher

- [ ] In dark mode, rows/containers/headers/dividers/ports/edges all
      render in DARK theme colors, NOT light. (This was the round-41
      bug: rows rendered light in dark mode.)
- [ ] Switching back to light restores light colors. No stale colors.

---

## VA-28 — SHACL shape view (through the compartment API)

Two «NodeShape» containers (PersonShape, Organization) rendered via
the SAME compartment machinery as VA-27.

**A. Shape rendering**

- [ ] Both shapes render as «NodeShape» containers, each with a
      "properties" compartment (NOT "constraints").
- [ ] Property rows read as `path : xsd:type [min..max]`, with a
      `(+n)` chip where value constraints (pattern/range/in) exist.
- [ ] The closed-shape header label is NOT clipped (round-38 fix).

**B. Closed vs open**

- [ ] PersonShape (sh:closed) has a SOLID, heavier border.
- [ ] Organization (open) has a DASHED border.

**C. Reference edge**

- [ ] A reference edge runs Person → Organization, LABELED with the
      property path ("worksFor"); the `worksFor : IRI` row and the
      edge clearly refer to the same thing.

**D. Validation badges** (toggle the report button)

- [ ] "Load validation report" badges the "name" row (violation) and
      "age" row (warning); the row fill/border reflects severity.
- [ ] Clearing the report removes the badges.

**E. Dark mode**

- [ ] All of the above render correctly in dark mode (shares the
      round-41 theme rules with VA-27).

**Fixture realism caveat:** the data is demo-grade and acknowledged
as such (logged in roadmap/human-actions.md). Judge the RENDERING,
not the plausibility of the example shapes.

---

## VA-29 — SHACL validation report over the data graph

The satellite data graph with a report loaded over it (pure reuse of
overlay + encoding machinery).

**A. Three severity tiers** (round 40) — "Load validation report"

- [ ] Results span ALL THREE tiers: at least one violation (red),
      one warning (amber), one info (blue). (Round-40 fix: previously
      only violations appeared.)
- [ ] Node COLOR reflects worst severity (red/amber/blue) via the
      encoding legend; node SIZE reflects result count.
- [ ] The legend lists the severity categories.

**B. Severity overlays**

- [ ] Failing nodes are emphasized; conforming nodes are dimmed.
- [ ] There is a toggle PER tier; toggling one tier does not disturb
      the others.

**C. Multi-canvas isolation** (round 40, the cross-contamination fix)

- [ ] Loading/toggling the report here does NOT dim or alter VA-26
      (the algorithm-overlay section) or any other canvas on the page.
      (This was the round-40 bug: a shared global overlay store let
      one canvas's overlays dim every other canvas.)

**D. Restore**

- [ ] "Clear report" restores the graph EXACTLY (no residual dimming,
      color, or size).

---

## VA-30 — Linked SHACL shape + data views (round 44)

Three panels: result list, shape view, data view.

**A. Cross-selection** (click a result in the left list)

- [ ] A PROPERTY-scoped result selects, AT ONCE: the focus node in
      the data view (right) AND the source shape container PLUS the
      offending property ROW in the shape view (middle).
- [ ] A NODE-level result selects the focus node and the shape
      container, but no specific row.
- [ ] The result list shows severity color, focus node, path, and
      source shape per entry.

**B. Linked behavior is intended here**

- [ ] Confirm the two canvases stay in lockstep on selection. (Unlike
      VA-29 item C, the shared SELECTION store linking these two
      canvases is the DESIRED behavior — different store, opposite
      intent.)

---

## Cross-cutting

- [ ] **Theme toggle** affects every structural/SHACL canvas
      consistently (no section stuck in the wrong theme).
- [ ] **No console errors** when mounting the page or exercising any
      toggle/drag/right-click above.
- [ ] **Performance**: collapse/expand and re-layout feel responsive,
      not janky, on the fixture sizes shown.

---

## Known-open items (do NOT file as bugs; already tracked)

- **Port rendering strategy** (VA-27 C): the sibling-node + offset
  approach is acknowledged as not-final; further strategies will be
  considered later. Judge "acceptable," not "ideal."
- **SHACL fixture realism** (VA-28): demo-grade data, tracked in
  roadmap/human-actions.md.
- **Global Zustand stores for per-canvas state**: the round-40 fix is
  defensive; the deeper design (per-canvas scoping) is tracked in
  roadmap/human-actions.md as a non-urgent reconsideration.
- **R1.17 inspector wiring**: resultDetail is built and tested but not
  yet rendered by the production DetailInspector; this is the one
  remaining R1.17 item, not a VA defect.
- **Full SHACL spec coverage**: only a subset of constraint
  components is modeled (see the coverage matrix in
  roadmap/design/shacl-views.md); needs an RDF shapes parser. Not a
  VA defect.
