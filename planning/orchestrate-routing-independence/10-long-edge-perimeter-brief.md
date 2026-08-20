---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 10: long-edge perimeter policy (route long lines around the outside)

Owner ask (Jake, 2026-08-14, Routing Lab / Prune Wall): the full-field
skip edges route LEGALLY through the interior row corridors — zero box
violations, gauntlet green — but a long line cutting straight through
the middle of the wall is illegible. Long lines must move toward the
OUTSIDE of the scene.

Runs AFTER 01-nudging (same file; nudging separates the perimeter
tracks this brief creates). Superseded mechanism note: brief 05
deletes the escalation ladder wholesale — §Durability below is the
contract that the POLICY survives that rewrite.

## Problem (re-verify at implementation time; checked 2026-08-14)

In `routeStructuralEdges` (`packages/core/src/layout/g3t-engine/
g3t-routing.ts`), a simple route that clears the near-obstacle set is
accepted immediately (the `!polylineIntersectsBoxes(simple, near)`
early-accept, ~line 642). For a skip edge spanning the whole field the
simple Z threads inter-row corridors: legal, and exactly the line Jake
flagged. The VR-9 `detourAround` perimeter sweep exists (~line 57) but
is reached ONLY as a last-resort fallback after a violation.

## Design (stage A — current engine)

1. **Eligibility predicate.** An edge is perimeter-eligible iff its
   simple route's near set (the bbox prefilter result already computed
   at the accept site) contains >= `LONG_EDGE_NEAR` boxes (default
   12). Expose as `longEdgeNear` in the routing options alongside
   `routingBudgetMs`; `Infinity` disables the policy (the single-line
   rollback, mirroring brief 01's pattern).
2. **Perimeter preference at the accept site.** For an eligible edge,
   attempt the perimeter route BEFORE accepting a clean simple route:
   call `detourAround(s.point, sTip, t.point, tTip, near)`. Non-null
   result wins; null keeps the (clean) simple route — the policy never
   converts a legal route into a violation. Ineligible edges are
   byte-identical to today.
3. **Deterministic stagger.** All perimeter routes on one side of a
   band derive the same cross coordinate (band extreme +/- 16), so
   two eligible edges would overlap exactly. After route assignment,
   offset each side's perimeter tracks outward by `index * 8px` in
   (edge id) order. This is input hygiene, not a substitute for
   01-nudging: once 01 lands, its group machinery owns separation and
   must treat a perimeter band as an ordinary corridor group; the
   stagger stays as a deterministic pre-ordering.
4. **No behavior change** for: port-anchored edges, edges under the
   eligibility threshold, and scenes below `LONG_EDGE_NEAR` obstacles
   (every existing non-lab scene: the four demo shells' scenes are far
   smaller than the threshold).

## Durability (stage B — one-line contracts already folded into 03/05)

- Brief 03 (dummy chains): perimeter-eligible edges skip interior
  bend-hint seeding — the policy outranks the hints.
- Brief 05 (channel router): the policy is re-expressed as channel
  preference — eligible edges take the outermost (boundary) channel;
  the stage-A accept-site code is then deleted with the ladder
  (no-legacy).

## Verification

- New pinned lab assertion (`src/demo/routing/scenarios.test.ts`):
  prune-wall M and L — every `pskip.*` route's interior points lie
  OUTSIDE the field's row band (cross coordinate beyond the outermost
  row borders +/- clearance); `ptie.*` and `prow*` routes unchanged.
- Gauntlet floors hold everywhere: coverage full, diagonals 0,
  violations 0; prune-wall crossings do not increase (perimeter
  routes cross fewer interior edges, so a decrease is expected but
  not pinned).
- Determinism: two runs byte-identical. Any snapshot re-pins land as
  a separate revertible commit listing the re-pinned set in the
  commit body (brief 01 convention).
- `pnpm run gates` green; never pipe gate scripts through tail/head.
- Rollback: flip `longEdgeNear` default to `Infinity` (single line).
