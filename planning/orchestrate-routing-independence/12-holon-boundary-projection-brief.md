---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 12: holon boundary + projection representation

Owner ask (Jake, A29): "is there anything space you can do for holon
representations and boundary/projection space."

## What exists (verified 2026-08-14 against holonic-adapter.ts)

`HolonicAdapter` (packages/core/src/adapter/holonic-adapter.ts) names
the four-graph model — Interior, Boundary, Projection, Context — in
its Holon docstring, but implements only two projections:
`projectToLPG()` (holons as flat nodes, portals as edges, with
`_isHolon`/`_portalCount` marker properties) and
`projectHolonInterior()` (flat interior LPG). **Boundary and
Projection have no data shape and no rendering.** Portals are plain
edges; nothing represents WHERE on the holon's boundary a portal
attaches or WHAT the holon exposes versus hides.

## Design direction (Jake ruling A30:q1 — portals stay EDGES; boundary
## is a RING, not structural ports)

- **Portal = a plain edge**, exactly as `projectToLPG` emits today.
  No declared-port machinery, no structural-block mapping. Portal
  identity keeps riding `_portalId`/`_hasConstruct` edge properties.
- **Boundary = a visible ring** around the holon node: an annulus
  between the holon's interior representation and the outside,
  rendered as node styling (border band / concentric outline via the
  style engine), not as extra graph elements. Portal edges CROSS the
  ring; where an edge crosses, a small crossing glyph/marker makes
  the portal's transit point legible. `_hasConstruct` portals get a
  distinct glyph. Crossing positions are wherever the router puts the
  edge — no anchor constraint solving in this brief.
- **Projection space = the exposed subgraph.** New
  `projectHolonBoundary(holon)`: what the holon PUBLISHES — exposed
  boundary nodes + portal stubs — as a UGM, sitting between
  `projectToLPG` (opaque) and `projectHolonInterior` (fully open).
  In this middle view the ring is drawn as an enclosing boundary
  (parent compound or background annulus) with exposed nodes inside
  it and portal edges crossing out.
- **Context stays out of scope** for this brief (it needs the
  backend-connected adapter; R5.1 is honestly tracked as unmet).

## Work

1. **Data shape** — extend `Holon` (additive, optional fields):
   `boundaryNodeIds?: string[]` (interior nodes exposed at the
   boundary) and on `Portal`: `boundaryNodeId?: string` (which
   exposed node the portal transits). No breaking change to
   existing datasets.
2. **Core** — `projectHolonBoundary(holon): UGM` on the adapter.
   Boundary-ring styling ships as style-engine rules + a
   `_boundaryRing` marker property the projection sets on holon
   nodes (data-mapped styles MUST sit on a `[field]`-scoped
   selector per CLAUDE.md — never a bare `node` rule).
3. **React** — drill state: holarchy view → double-click/context-menu
   "Open boundary" → boundary view → "Open interior". Wire through
   the existing holonic-portal-menu (R5.4 data side already done).
4. **Demo** — the ontology shell (src/demo/ontology/) gains a small
   holonic fixture exercising all three levels.
5. **Docs** — specs/05-integration-holonic.md status updates (R5.2/
   R5.3 partial-scope notes), wiring-guide section + executable twin.

## Acceptance

- Boundary view renders the holon with a visible boundary ring and
  portal edges crossing it with transit glyphs;
  interior/boundary/holarchy round-trip preserves camera per the D15
  stability doctrine (same-graph = no refit).
- Existing HolonicDataset fixtures (no boundary fields) render
  exactly as today (additive-only proof: adapter tests unchanged).
- `pnpm run gates` green.

## Rollback

New exports + optional fields only; single revert.
