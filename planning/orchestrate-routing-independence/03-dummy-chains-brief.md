---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 03: dummy chains for long-span edges (LAY-005)

Phase 1 of the engine-quality roadmap (technique from dagre; no code
ported). Runs AFTER 01-nudging and 02-coverage so its effect is
measurable against the pinned oracle values.

## Problem

`g3tLayoutFlat` (`packages/core/src/layout/g3t-engine/g3t-layered.ts`)
treats an edge spanning k>1 layers as a single arc: `orderLayers`
cannot reduce its crossings against intermediate-layer nodes, and the
Brandes-Koepf type-1 conflict machinery in `placeBrandesKoepf`
(g3t-layered.ts:805) is dormant because no inner segments (dummy-dummy
edges) ever exist. Long spans are the dominant crossing source on the
Span Gauntlet and Crossing Storm lab scenarios.

## Design (technique, clean-room)

1. After `assignLayers` (g3t-layered.ts:194), split every edge whose
   endpoints sit more than one layer apart into a chain: one pseudo
   node per crossed layer, flagged `dummy: true`, carrying the owner
   edge id. Dummy width and height equal `DUMMY_NODE_SIZE`, a
   build-time constant with a positive non-zero value. Using zero is
   prohibited: zero-size dummies make box-violation checks vacuously
   pass for dummy-adjacent scenarios, which would let the oracle
   condition "no scenario's box violations increase" pass silently for
   dummy-induced regressions. The implementation MUST document the
   chosen value in the constant definition and include a dedicated test
   (see Verification) that fails when `DUMMY_NODE_SIZE` is set to zero.
2. `orderLayers` and `placeNodes`/`placeBrandesKoepf` receive the
   augmented graph as their normal input -- dummy nodes occupy real
   positions in the layer arrays and participate in the barycenter
   sweeps. Brandes-Koepf type-1 conflict detection
   (`placeBrandesKoepf`, g3t-layered.ts:805) is index-keyed over
   per-layer arrays; inserting dummies shifts those indices, so dummy
   nodes MUST be appended to their layer arrays before calling
   `placeBrandesKoepf` (not injected mid-array) and must carry a
   `dummy: true` flag that the type-1 scan can use to identify inner
   segments. The note at g3t-layered.ts:801 confirms this path is
   currently dormant and activates when dummies land. Appending dummies
   to layer tails biases the first barycenter pass; the implementation
   MUST run at least two barycenter sweeps (forward and reverse, the
   standard dagre practice) so the optimizer can escape the tail-biased
   starting configuration.
3. Post-placement, each chain collapses back: dummy positions become
   ordered bend hints on the owner edge (an `intermediate` field on the
   emitted edge geometry, added as an optional `intermediate?: { x:
   number; y: number }[]` on `StructuralEdgeGeometry` in
   `structural.ts:318`). Points are stored in source-to-target order.
   `routeStructuralEdges` (g3t-routing.ts:109) must be modified to read
   `intermediate` when present and seed its polyline from those points
   instead of the single midpoint jog. The modification MUST verify
   that edge endpoints are iterated in source-to-target order at the
   seeding site so that stored points and iteration direction agree; the
   unit test for this modification (see Verification) covers the
   direction assertion. This modification is an explicit deliverable of
   this brief; without it the hints are written and silently ignored.
   Downstream consumers of `StructuralEdgeGeometry` outside the routing
   module must be identified and updated to handle the new optional
   field before merging.
4. Parent assignment for the structural (nested) case: a dummy joins
   the container of the tighter of its two endpoint scopes. "Tighter"
   is resolved as follows: (a) if both endpoints share a compound
   ancestor, the dummy joins the innermost shared ancestor; (b) if one
   endpoint is at root scope (no container), the dummy joins the
   container of the other endpoint; if BOTH endpoints are at root scope
   (neither has a container), the dummy is also placed at root scope
   with no parent container; (c) for cross-sibling compound edges where
   neither container contains the other, the dummy joins the nearest
   common ancestor of the two endpoint containers. Equal-depth
   containers that are not in a parent-child relationship fall under
   case (c).
5. No-legacy: the previous long-span handling path is deleted, not
   kept behind a flag. This follows the project no-legacy doctrine.
   The recovery path for a regression discovered post-merge is a
   git-revert of the LAY-005 commit. To keep the recovery path
   unambiguous, the LAY-005 implementation MUST land as a single atomic
   commit (or at most two: one preparatory commit for type-definition
   changes and one implementation commit). Spanning multiple commits
   without a single revert target undermines the stated recovery path.
6. Perimeter policy precedence (brief 10): edges that are
   perimeter-eligible skip interior bend-hint seeding -- the outside
   route outranks the dummy hints for those edges. An edge is
   perimeter-eligible for the purpose of this guard iff its near-
   obstacle set at the routing accept site has size >= `LONG_EDGE_NEAR`
   (the threshold brief 10 exposes as the `longEdgeNear` routing
   option, defaulting to 12 when brief 10 is active). At the time this
   brief's tests execute, the `longEdgeNear` routing option does not
   yet exist; its absence MUST be treated as `Infinity` (policy
   disabled), making every edge non-perimeter-eligible and ensuring
   bend-hint seeding is applied to all edges. This preserves the
   default-false contract without requiring a flag property on edge
   objects. When brief 10 lands, it sets `longEdgeNear` to 12 and the
   guard activates automatically with no further change to this brief's
   code.

## Verification

- Oracle: no scenario's crossings increase on Span Gauntlet or
  Crossing Storm (strict decrease is too strong: pathological
  intermediate layers can force a dummy-induced crossing that the
  direct arc avoided). No scenario's bends or box violations increase.
  Pin before/after values in the test.
- Unit: chain construction (k-span edge yields k-1 dummies), collapse
  round-trip (no dummy leaks into emitted geometry), determinism.
- Unit: step 4 parent-assignment rule -- one test per case: shared
  ancestor, single root-scope endpoint, BOTH endpoints at root scope
  (the degenerate case where no container exists for either endpoint
  and the dummy must also land at root scope), and cross-sibling
  compound.
- Unit: step 6 perimeter guard -- verify that an edge with no
  `longEdgeNear` option (absent option) is seeded with bend hints
  (default-false / policy-disabled path), and that the guard is correct
  when `longEdgeNear` is explicitly set to `Infinity`.
- Unit: isolated test for the `routeStructuralEdges` modification in
  step 3 -- verify that `intermediate` points are consumed and produce
  the expected polyline, and that points stored in source-to-target
  order match the routing function's iteration direction.
- Unit: `DUMMY_NODE_SIZE` spacing/box-violation test -- verify that
  dummy-adjacent edges in a multi-layer scenario produce non-zero box
  extents for dummies, confirming the oracle cannot pass trivially. The
  test MUST fail if `DUMMY_NODE_SIZE` is set to zero.
- `pnpm run gates` green; never pipe gates through tail/head.
