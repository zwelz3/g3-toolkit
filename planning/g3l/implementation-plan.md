# Implementation Plan: G3L Library Seeded from g3-toolkit

Version 0.1. Companion to `g3l-requirements-specification-v0.2.md` (the spec). This document owns sequencing, workstreams, experiments, gates, risks, and integration mechanics; the spec owns the shall-statements. Priorities are P0/P1/P2 with ordered rounds inside each; no day-based estimates by policy. All g3t current-state facts below were audited 2026-07-09 against the uploaded source (v1.0.0-rc.2, 1,044 tests / 107 files, gates green including the reconstructed verify suite).

---

## 1. Strategy in one paragraph

Grow the library out of g3t's existing seams rather than beside them. Three seams already exist and are gate-covered: the `ElkEngine` layout-engine seam, the `geometry.edges` absolute-route emission (`routeEdges`), and the `structural-to-cytoscape` converter with its documented Cytoscape relative-segments ceiling. The plan drives every new capability through one of those seams behind an option, proves it against ELK/fcose with a metrics gate before any switch (spec QLT-002), and only then extracts the proven code into library packages. This honors g3t principle P5 (defer limiting decisions) and the ruled routing architecture (interactive-mode experiment first; SVG overlay second; in-house router last, behind the revisit trigger).

---

## 2. Workstreams

Six parallel-capable workstreams. Dependencies are noted; anything not listed as a dependency can proceed concurrently.

### WS-A: Layout stability (spec LAY-017/018, CNT-003)

The highest-leverage, lowest-cost stream, and the ruled first move.

- **A1 (P0).** Execute the recorded-but-unshipped 12.20 experiment: on the collapse/expand same-graph-rebuild path, feed surviving nodes' prior coordinates as `elk.position` hints and switch the three ELK strategies to INTERACTIVE for that run only (the `crossingMinimization: "INTERACTIVE"` seam already exists in `StructuralLayoutOptions`). Accept criterion is spec LAY-018 verbatim: untouched containers move less than one grid unit; the toggled container resizes in place.
- **A2 (P0, contingent).** If ELK interactive mode still moves untouched nodes materially: fixed-region fallback (pin all nodes outside the toggled subtree; layered layout only for the changed region), accepting stale whitespace; the whitespace cost goes to the maintainer for a ruling.
- **A3 (P1).** Generalize the winning mechanism into the `LayoutEngine` sketch input (spec LAY-017): `capturePositions` output becomes the sketch parameter; `applyIncrementalLayout` consumes engine output. This is refactoring of shipped g3t code, not new capability.
- **Exit gate:** LAY-018 demonstration on the current demo surface; regression test pinning displacement under epsilon on the reference collapse scenario.

### WS-B: Edge rendering and routing (spec RTE-005/008/011, RND-002/003, QLT-007)

Follows the ruled staging exactly. B1 depends on nothing; B2 depends on A1 landing first (a stable scene makes routing regressions visible, per the ruled ordering).

- **B1 (P0).** Drag-scenario regression tests (spec QLT-007) against current behavior: body-edge drag, collapsible-container drag, mixed-attachment drag. Written first so B2/B3 have a fixed oracle; expected-failure annotations document the known segments-staleness defects rather than hiding them.
- **B2 (P0).** SVG overlay edge layer behind `structuralEdgeLayer: "cytoscape" | "svg-overlay"` (default unchanged), MBSE shell opts in first. Contract tests assert path generation from ELK's absolute polylines in `geometry.edges` (already emitted; the overlay finally draws them verbatim, satisfying the RTE-005 verbatim-draw half). Edge hover + context-menu parity is inside the definition of done. Declared-port perpendicular exits preserved (spec RTE-008): the overlay draws the port-fixed exit segment before following the route.
- **B3 (P1).** Retire the `curve-style: segments` squeeze on surfaces where the overlay has passed two live-review rounds; taxi remains the no-geometry fallback. The converter shrinks to endpoint/port emission.
- **B4 (P1, gated by the revisit trigger).** In-house obstacle-aware router (spec RTE-001/002/004), compute-only, behind the same `LayoutEngine`/route seam, off-thread. Trigger: a requirement ELK cannot serve, realistically live rerouting during free node dragging (spec RTE-011, CNT-005). Implemented from the visibility-graph papers; libavoid-js remains rejected (LGPL-lineage policy, spec LIC-002). Channel router (RTE-004) lands with it as the scale fallback.
- **B5 (P1).** Incremental rerouting during drag (spec RTE-011) consuming B4, rendered through B2's overlay. Frame budget per spec PRF-002.
- **Exit gates:** B2 = RND-003 demonstration (no visible lag at 4k on the MBSE diagram; failure degrades that surface per the ruled fallback). B4/B5 = QLT-007 scenarios pass without expected-failure annotations; PRF-002 benchmarks in CI.

### WS-C: Style resolution engine (spec STY-001..016, QLT-006)

Independent of A/B; the largest net-new subsystem.

- **C1 (P0).** `VisualAttributes` contract and the pure `resolve` function (spec ARC-002) with layer precedence (STY-001), field-presence gating (STY-003, retiring the `[field]`-selector convention into structure), and the diagnostics sink (QLT-006).
- **C2 (P0).** Dependency/output declarations and incremental invalidation (STY-004); benchmark harness for PRF-004.
- **C3 (P0).** Theme tokens (STY-006) interoperating with g3t's ThemeManager; JSON schema for rules/themes/LOD (STY-007).
- **C4 (P0).** Declarative LOD schedule (STY-010/011) replacing incident-driven visibility handling.
- **C5 (P1).** Decoration primitives (NOD-007: glyphs/halos/donuts/pulses); g3t's ad hoc pin badges and icon fixes retire into them. Edge encodings (STY-008/009): geometry arrowheads including the shipped UML symbol set lifted out of the structural view, tapered and gradient direction encodings. Bridges (STY-016) consume RTE-010 once B4 lands; until then the crossing set can be computed from ELK polylines as an interim.
- **C6 (P1).** Legend derivation including default-derived encodings (STY-014, generalizing the 12.15 fix); dimming composite rule (STY-013); classes (STY-012).
- **Adoption path in g3t:** C1–C4 first drive a single surface (one demo shell) side-by-side with the Cytoscape stylesheet, compared by snapshot; cutover per surface, never global.
- **Exit gate:** PRF-004/005 benchmarks green; one shell fully styled through the engine with pixel-tolerant snapshots matching the reviewed baseline.

### WS-D: Layout core (spec LAY-001..014, ARC-005, QLT-002)

Longest-horizon stream; strictly gated by falsifiability against ELK/fcose.

- **D1 (P0).** Metrics module (QLT-002: crossings, bends, edge length, displacement-from-sketch, aspect ratio) plus shared reference fixtures in ELK JSON (IOP-002 import is the fixture format). This lands before any algorithm so every algorithm arrives with its oracle.
- **D2 (P0).** Layered layout phases in order: cycle removal, network-simplex + Coffman-Graham layering (LAY-002), barycenter/median + transpose (LAY-003), Brandes-Köpf with size/port awareness (LAY-004), linear dummy handling (LAY-005). Each phase golden-tested independently; the assembled pipeline compared to ELK on the fixtures with regression tolerances. Sugiyama-classic only (LAY-006 IP constraint).
- **D3 (P0).** Stress majorization + annealing fast mode (LAY-008/009), seeded determinism (ARC-006).
- **D4 (P1).** Compound support: containment layout (LAY-012/013), fCoSE-lineage compound force (LAY-014). Switch criterion: meets or beats fcose on the shared demos per D1 metrics; until then fcose stays wired.
- **D5 (P1).** Constraints: ports/layers (LAY-007), separation via gradient projection (LAY-010), overlap removal stage (LAY-011), swimlanes (LAY-015), incremental insertion (LAY-019), region re-layout (LAY-020).
- **Exit gate per algorithm:** QLT-002 tolerances met on fixtures; PRF-001 budget met in-worker; only then does the `LayoutEngine` registry list it as selectable for a g3t surface.

### WS-E: Modelractions and packages (spec MOD-*, ARC-009, IOP-*)

- **E1 (P0).** Library model package: nodes/edges/ports (declared vs synthetic, MOD-004), containers (MOD-003), compartments (MOD-011, lifted from `StructuralNode`/`StructuralCompartment` shapes), outline geometry accessors (MOD-002), data/style/geometry separation (MOD-005), ID discipline (MOD-007). g3t's structural interfaces are the seed types; the extraction is mostly relocation plus generalization beyond the structural view.
- **E2 (P0).** ELK JSON import (IOP-002) and the versioned document format (IOP-001).
- **E3 (P1).** Change-set API (MOD-010) feeding LAY-020/RTE-011; Cytoscape adapter formalization (IOP-003, overlay posture); d3 adapter (IOP-004); GraphML/DOT (IOP-005).
- **E4 (P1/P2).** RDF projection package (IOP-006, P4-aligned collapse vocabulary); Holonic projection package (IOP-008).

### WS-F: Renderers beyond the overlay (spec RND-001/004/007..010, NOD-009, LBL-*)

- **F1 (P0).** SVG adapter (RND-001) rendering the full C1 contract, including compartment rendering lifted from the structural view (NOD-009 compartment half); label basics (LBL-001..003) with halo text and min-pixel visibility.
- **F2 (P1).** Canvas 2D adapter (RND-004) with the documented performance levers; adapter conformance suite (ARC-008, QLT-005); export fidelity tests (RND-007).
- **F3 (P1).** Label decluttering + shared measurement service (LBL-005/006); edge labels along routes (LBL-004).
- **F4 (P2).** Template/panel layer (NOD-009 stretch half, NOD-010 size negotiation); WebGL adapter + MSDF atlas subsystem (RND-008/009); renderer handoff (RND-010).

---

## 3. Sequencing summary (rounds, not dates)

Round ordering within P0; streams interleave where independent:

1. **A1** (interactive-mode experiment) and **B1** (drag oracles) and **D1** (metrics module): all cheap, all oracle-building, no interdependencies.
2. **B2** (SVG overlay) after A1: the ruled ordering (stable scene before routing work). **C1/C2** (style core) concurrently.
3. **C3/C4** (themes, LOD) and **E1/E2** (model package, ELK import) concurrently with early **D2** phases.
4. **F1** (SVG adapter) once C1 and E1 exist; first g3t surface cutover (one shell, side-by-side).
5. **D2/D3** completion against D1 gates; **A3** sketch generalization.
6. P1 rounds: B3 (retire segments), C5/C6 (decorations, legends), D4/D5 (compound, constraints), E3, F2/F3, then B4/B5 when the revisit trigger fires or CNT-005 is prioritized.
7. P2 on demand: F4, LAY-016/021, RTE-013/014, IOP-008.

---

## 4. g3t integration mechanics

- **Repository posture (needs a ruling, decision point 3 below):** options are (a) new packages inside the g3t monorepo (`packages/layout`, `packages/style`, ...) sharing the gate scripts, later extractable; or (b) a separate repo consumed as a dependency. Default recommendation: (a) for P0 (shared gates, shared fixtures, atomic refactors across the seam), revisit at first public library release.
- **Gates:** every stream lands through `pnpm run gates` (typecheck, lint, verify incl. exports/treeshake/smoke/types/snippets/docs/bundle, test, gates:spec). G3L requirement IDs cited in source join the `gates:spec` citation sync (spec QLT-004); the verify-suite reconstruction lesson applies: any new gate must fail loudly if its test sources vanish.
- **Live review:** the original VA surface is retired; demonstrations (D-verification) run on the current demo/Storybook surfaces under the demo-adoption doctrine (every demonstrated behavior gate-enforced; OSS adopters are the audience). Rendered-behavior claims stay marked unverified until live-confirmed.
- **Docs cadence:** CHANGELOG and STATUS per round; per-area design records in `roadmap/design/` (the structural-rendering record continues as the WS-A/WS-B narrative home); migration guide (DOC-003) grows a section per extracted seam.

---

## 5. Falsifiability criteria (what a FAIL looks like)

- **A1 fails** if ELK interactive mode still moves untouched nodes materially → A2 fixed-region fallback; if that also fails, LAY-018 is re-scoped to the internal layered engine (D2) and the requirement's g3t interim is documented as unmet.
- **B2 fails** if overlay pan/zoom sync lags visibly at 4k on the MBSE diagram → that surface degrades to the Cytoscape edge renderer (per-surface opt-in makes this a switch); B4's priority rises since the overlay was the router's rendering path.
- **D2/D3/D4 fail** per algorithm if D1 metrics do not meet tolerance against ELK/fcose on shared fixtures → the algorithm stays unlisted in the engine registry; no g3t surface switches; the gap analysis feeds the next revision.
- **C2 fails** if PRF-004 incremental budgets are unmet → dependency-tracking design revisited before any surface cutover (the engine without fast invalidation is worse than the stylesheet status quo).
- **PRF budgets**: one re-baseline permitted (spec open decision 2), then frozen; a second miss is a requirement change, not a budget edit.

---

## 6. Risk register

| Risk | Exposure | Mitigation |
|---|---|---|
| ELK interactive mode insufficient for LAY-018 | WS-A blocked; stability promise slips | A2 fixed-region fallback designed up front; escalation ruling on whitespace cost |
| Overlay transform sync jank at 4k | WS-B rendering path | Ruled per-surface degradation; keep converter path alive until B3 |
| In-house router quality below ELK's | WS-B4 credibility | Compute-only behind seam; QLT-007 + PRF-002 gates before any surface adoption |
| Style engine slower than Cytoscape stylesheets on hot paths | WS-C adoption stalls | PRF-004/005 benchmarks in CI from C1; side-by-side per-surface cutover only |
| Metrics tolerances chosen too loose/tight | WS-D gate meaningless or unpassable | Tolerances set from measured ELK variance across seeds on fixtures, then frozen |
| Scope creep from the 132-use-case survey (g3t spec corpus) | Library grows g3t-shaped features | NG-1..NG-5 boundaries; anything paradigm-specific goes to IOP-006/008 packages |
| IP register drift (LAY-006, RTE-003) | Release-gate failure late | IP register reviewed at each algorithm's D1-gate entry (MR-4 resolved by owner ruling 2026-07-18; IP questions handled outside the repo) |
| Monorepo coupling makes later extraction costly | Governance | ARC-009 package boundaries enforced by `verify:treeshake`/dependency-cruiser-style checks from E1 onward |

---

## 7. Decision points requiring a ruling

1. **PRF budget freeze** (spec open decision 2): accept initial numbers or re-baseline first. Recommendation: re-baseline once on the CI profile during D1, then freeze.
2. **Hyperedge scope** (spec open decision 5): bus-routing input only vs full hyperedge modeling. Recommendation: bus-only until a consuming surface exists.
3. **Repository posture** (section 4): in-monorepo packages vs separate repo for P0. Recommendation: in-monorepo, revisit at first public library release.
4. **A2 whitespace cost** (conditional): only if A1 fails; stale whitespace vs full recompute is a UX ruling.
5. **B4 activation** (conditional): fires on the ruled revisit trigger (live rerouting under free drag) or an explicit prioritization of CNT-005; not scheduled otherwise.
