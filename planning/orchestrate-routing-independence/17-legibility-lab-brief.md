---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 17: Legibility Lab demo (didactic pseudo nodes + holon boundary node)

Owner ask (Jake, A105): "make an easy to see demo with easy to follow
pseudo nodes, and i want a holon with a boundary node." This is a
pedagogy surface: the SMALLEST graphs where each device is readable at
a glance, not another scale stress test.

## What exists to reuse (verified 2026-08-15)

- `src/demo/legibility/fixtures.ts` ALREADY EXISTS in the tree,
  UNTRACKED (dropped by a parallel session 2026-08-15 12:22 UTC; no
  owner claimed it). It defines exactly the right fixtures:
  `buildHubFixture()` (14-degree hub), `buildBusFixture()` (6 feeds +
  a 2-edge control group that must NOT collapse), and a two-holon
  `HolonicDataset` whose boundary projection exposes exactly ONE
  boundary node. READ IT FIRST, adopt it, keep its docstring, add
  fixture tests. If its shapes disagree with the core APIs below, fix
  the fixture, not the API.
- Pseudo-node spreading shipped in brief 06 (commit 4526192):
  `hubBurst`, `busCollapse`, `isPseudoNode`, `filterPseudoNodes`,
  `PSEUDO_FLAG`, `PSEUDO_CONNECTOR_TYPE`, `PSEUDO_TRUNK_TYPE` — all
  exported from @g3t/core (packages/core/src/projection/pseudo-nodes.ts).
- Holon boundary rendering shipped in brief 12:
  `HolonicAdapter.projectHolonBoundary(holon)`
  (packages/core/src/adapter/holonic-adapter.ts:194) renders the
  boundary ring with exposed boundary nodes inside and portal edges
  transiting out to stubbed neighbors. The Ontology Workbench Holons
  tab (src/demo/ontology/OntologyShell.tsx:272-290) is the reference
  wiring for holarchy → boundary → interior drill.
- Shell pattern: any small shell (src/demo/stylelab/StyleLabShell.tsx
  is the cleanest) — SurfaceFrame-less standalone with back button,
  CapabilityBubble, contract test with CytoscapeCanvas stubbed.

## Work

1. **Shell** — `src/demo/legibility/LegibilityShell.tsx`, three
   panels (tabs or a segmented control), one device per panel:
   - **Hub burst**: render `buildHubFixture()` with a raw ↔ spread
     toggle. Spread = `hubBurst(ugm, { k: 6 })` (verify the real
     options shape in pseudo-nodes.ts:78 before use). The 14 direct
     edges regroup into exactly two satellites, one per
     (type, direction).
   - **Bus collapse**: `buildBusFixture()` with raw ↔ spread toggle
     via `busCollapse`. The 6 `feeds` edges collapse through a
     junction/trunk; the 2-edge `calibrates` group visibly stays
     direct (the control case — call it out in the panel copy).
   - **Holon boundary**: the holon fixture through `HolonicAdapter`,
     defaulting to the BOUNDARY projection: ring, the single exposed
     boundary node (the radio) inside it, portal transiting out to
     the stubbed neighbor. Holarchy and interior available as drill
     states (reuse the OntologyShell drill pattern, simplified).
2. **Pseudo nodes must be EASY TO FOLLOW** (the owner's exact ask):
   - Style pseudo nodes unmistakably: dashed border + distinct fill +
     smaller size, via an encodingSpec/stylesheet rule scoped to the
     pseudo flag field (`node[pseudo]`-style scoped selector — NEVER
     a bare `node` data-mapper, per the CLAUDE.md canvas doctrine).
   - A small in-panel legend: real node / pseudo satellite / pseudo
     junction / trunk edge.
   - Toggling raw ↔ spread must hold camera and the REAL nodes'
     positions (same-input-graph stability doctrine; the pseudo nodes
     appear around them). If the projection changes the node-id set
     (it does — pseudo ids), capture and restore pan/zoom across the
     rebuild the way CytoscapeCanvas's structural path does; at
     minimum the transition must not refit/recenter wildly.
   - `routeEdges` ON in all three panels (graphs are tiny; this also
     closes part of the A105 routing-coverage question for this new
     surface).
3. **Landing tile** — register in src/demo/DemoLanding.tsx +
   src/demo/Demo.tsx routing, following how the rdf12/stylelab tiles
   were added. Subtitle: "Hub burst, bus collapse, and holon
   boundary — the smallest graphs that make each device readable."
4. **Tests** — fixtures unit tests (hub degrees, bus group sizes,
   boundary exposes exactly one node); shell contract test with
   CytoscapeCanvas stubbed (panel switch, toggle wiring, legend
   present); pseudo-style rule is field-scoped (assert selector
   string).

## Constraints

- Demo layer ONLY: no packages/* changes. If a core API gap blocks
  the toggle-stability requirement, note it in the outcome and ship
  the best demo-layer approximation rather than patching core.
- `pnpm run gates` green before commit (spec gates via python3 on
  this host — `python` does not exist here).
- No bundle impact expected (demo code is not in the packages
  ledger); do not touch scripts/check-bundle-size.mjs.
- The untracked fixtures.ts: adopt + commit it WITH your work (it is
  unowned; you become the owner).

## Acceptance

- Playground shows a Legibility tile; all three panels render; raw ↔
  spread toggles are followable (camera holds); the holon boundary
  panel shows the ring with ONE boundary node inside and a portal
  transiting out.
- All gates green; committed.

## Worker contract

Emit inline `kb log` atoms during the run; write
/tmp/brief17-legibility-lab-outcome.json (outcome, atoms_emitted,
commit_shas, files_changed, summary, duration_min, blockers); first
stdout line `done: <n> atoms emitted; commit=<sha>; <outcome>`.
Commit on green gates.
