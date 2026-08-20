---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 05: channel router (construction-time conflict avoidance, PRF-003)

Phase 3 of the engine-quality roadmap. ELK-technique orthogonal
generation (EPL project; techniques only, no code) replacing the
escalation ladder.

## Problem

`routeStructuralEdges` (`g3t-routing.ts`) routes edges independently:
simple midpoint template first, then a grid-router escalation ladder
whose retry drops clearance to 4px (g3t-routing.ts:666), with other
edges invisible. 01-nudging separates the results after the fact, but
separation-after-collision is strictly weaker than never colliding:
crossings created by independent routing remain.

## Dependencies and dispatch gates

This brief consumes three upstream briefs as live inputs. Dispatch
gates are required before implementation begins:

- **Brief 03 (dummy chains, LAY-005):** must be shipped (gates green,
  merged to main) before dispatch. Confirm by checking that
  `g3t-layered.ts` emits `intermediate: Pt[]` on long-span edge
  geometry. Interface: the `intermediate` field on emitted edge objects
  as specified in Brief 03 Design step 3. No interface-version pin is
  needed beyond verifying the field exists; do not read dummy-node
  objects after collapse.
- **Brief 04 (corridor supply contract):** must be shipped before
  dispatch. Confirm by verifying that `g3tLayoutFlat` and
  `g3tLayoutStructural` accept and use a `trackGap` / `maxGapFactor`
  option pair and that the gap sizing formula
  `gap = max(baseGap, demand * trackGap + 2 * clearance)` is live in
  both layout functions. If Brief 04 is still in-flight or has pending
  revisions, the channel widths this router reads will be incorrect
  and all track-gap geometry will be wrong; do not proceed.
- **Brief 10 (long-edge perimeter policy, stage A):** must be shipped
  before dispatch. Confirm by verifying that
  `routeStructuralEdges` accepts a `longEdgeNear` option and that the
  accept-site eligibility check (near-set size >= `LONG_EDGE_NEAR`)
  exists at approximately `g3t-routing.ts:642`. Brief 10 stage A is
  deleted by this brief; confirm it exists before deleting it.
- **Caller audit (routeStructuralEdges):** before implementation
  begins, grep all callers of `routeStructuralEdges` in the repo for
  code that branches on the perimeter route result format (specific
  point count, out-of-band coordinate assumptions). Document every
  such caller and confirm it will be updated before the deletion of
  the stage-A accept-site code lands. This audit is a hard gate: if
  any branching caller is found and not scheduled for repair, do not
  proceed. The audit output must be recorded in the commit message.

## Design

1. Corridor/channel model: the inter-layer gaps (now demand-sized by
   04) are first-class channels. Every edge's path is a sequence of
   channel traversals + node-side stubs (anchors/fans unchanged).

2. Track assignment inside each channel is combinatorial at
   construction time: edges entering a channel are ordered by the
   libavoid divergence sort (entry cross-coord, exit cross-coord,
   edge id) and assigned integer tracks BEFORE geometry exists --
   crossings inside a channel are minimized by ordering, not
   discovered by collision.

   Track count bound: the number of edges assigned tracks in a given
   channel must not exceed the `demand` value Brief 04 used to size
   that channel's gap (`gap = max(baseGap, demand * trackGap + 2 *
   clearance)`). If the actual edge count entering a channel exceeds
   `demand` (due to a stale demand estimate, mid-graph-edit count
   change, or cross-layer multi-hop collapse miscounting), the
   implementation must detect the overflow, log an error in debug
   mode, and route the excess edges via `routeOrthogonal` rather than
   assigning tracks outside the gap geometry. The verification oracle
   checks this: after routing, assert that for every channel the
   assigned track index count is <= the demand value recorded in the
   Brief 04 layout output. This assertion must be a gate-green
   criterion (a test failure, not a console warning).

   Degenerate tied coordinates: when multiple edges share the same
   entry cross-coord, the exit cross-coord secondary key produces the
   rainbow ordering that minimizes crossings (the "uncrossing" step).
   When multiple edges share both entry and exit cross-coords (fully
   tied), the edges are geometrically coincident for that channel
   traversal; any stable sort is crossing-equivalent, and edge id
   provides the required determinism. Fully tied entry+exit is the
   degenerate case: note it explicitly in the implementation with an
   assertion that the coincident case never produces coincidentRuns
   violations (the tracks assigned are still distinct integers).

3. Geometry emission: track index -> y (or x) offset from the channel
   midline at trackGap spacing; bend points at channel entry/exit;
   `dedupeCollinear` finish pass. Track identity is an assignment-time
   integer record, never encoded as a zero-length or collinear
   polyline artifact. `dedupeCollinear` may safely remove any collinear
   run; the implementation must express track separation as genuine
   orthogonal bends (nonzero y-offset or x-offset), not as collinear
   markers that `dedupeCollinear` would collapse.

   Dummy-chain bend hints (03): Brief 03's dummy-chain collapse emits
   `intermediate: Pt[]` waypoints on long-span edges. This brief's
   channel router reads those waypoints to pick the channel sequence
   for long spans -- the channel path must pass through each waypoint's
   corridor. This is additive: Brief 03's `intermediate` field contract
   is unchanged; the channel router treats the waypoints as corridor
   selection hints, not as geometry literals. If a waypoint falls
   outside any available channel (e.g., it was seeded for the
   escalation-ladder model and does not map to a valid channel
   crossing), the edge falls back to `routeOrthogonal` for that span.
   The Brief 03 guarantee (no crossings increase) still applies because
   the channel router selects channels honoring hint order; repurposing
   the waypoints as channel selectors does not change the crossing
   bound if the channel model covers all hint-accessible corridors.

   Waypoint miss fraction diagnostic: at implementation time, before
   integrating the channel selector path, count the fraction of
   long-span waypoints that fall outside any available channel
   corridor across the six lab scenarios. If the majority (>50%) miss
   and fall back per-span, the integration adds routing complexity
   with no legibility benefit for those edges; log this finding
   prominently and re-evaluate whether the channel-selector
   interpretation is viable before landing. The per-span fallback
   remains correct regardless; this diagnostic gates the usefulness
   claim, not the correctness claim.

4. Long-edge perimeter policy (brief 10) is re-expressed natively:
   perimeter-eligible edges prefer the outermost (boundary) channels.
   Brief 10's stage-A accept-site implementation (the
   `!polylineIntersectsBoxes` early-accept with `LONG_EDGE_NEAR`
   eligibility check, approximately `g3t-routing.ts:642`) is deleted
   here alongside the escalation ladder (no-legacy). The policy's
   observable effect is preserved: the channel router's boundary-channel
   preference produces equivalent or better perimeter routing. The
   pinned lab assertion in `src/demo/routing/scenarios.test.ts`
   (prune-wall M and L, `pskip.*` routes outside the row band) must
   remain green. The Brief 10 plan atom must be annotated at
   implementation time to record that stage-A is superseded by this
   brief's channel preference (stage B in Brief 10's Durability
   section); this prevents `kb verify` from treating a deleted
   implementation as a live policy gap.

   Brief 10 plan atom IRI lookup: the IRI is not fixed in this brief
   because it is assigned at Brief 10 dispatch time. Before annotating,
   resolve it with: `kb find --type kb:Plan --subject "Brief 10" --project g3_toolkit`
   (or equivalent `kb find --slug` query). Record the resolved IRI in
   the commit message alongside the annotation command. If the lookup
   returns no result, halt and report: the Brief 10 gate (above) would
   also have failed, so this state indicates the gate check was skipped.

5. Fallback predicate (algorithmic, not by example): `routeOrthogonal`
   (A*) is used iff the edge satisfies at least one of the following
   conditions, all of which are verifiable from the layered graph
   produced by `g3tLayoutStructural` or `g3tLayoutFlat`:

   a. Same-layer edge: `source.layer === target.layer`. No inter-layer
      corridor exists for this edge, so the channel model cannot
      express it. (Cycle arcs and self-layer connections are the
      typical case.)
   b. Anti-monotone edge: the shortest path from source layer to target
      layer in the layer-adjacency graph requires a step in the
      direction opposite to the dominant layout flow (a backward arc).
      These edges cannot be expressed as a monotone sequence of
      inter-layer channel traversals.
   c. Compound-boundary edge: the edge crosses a compound node
      boundary in a direction where the inter-layer channel is not
      accessible from outside the compound. The detection criterion is
      a geometry-free bounding-box containment check, computable from
      the layered layout output before any routing is attempted: the
      axis-aligned bounding box of the source endpoint to the target
      endpoint (the route AABB) overlaps at least one compound
      container node's bounding box, and neither endpoint's parent is
      that container (i.e., the container is not a shared ancestor of
      both endpoints). This check requires only the node geometry
      emitted by `g3tLayoutStructural` or `g3tLayoutFlat` (bounding
      boxes and parent fields from the structural input, which carries
      `parent?: string` on every node). It does not require running
      any portion of the channel routing algorithm. If the containment
      check is ambiguous for a given edge (e.g., multiple nested
      compounds), classify as fallback conservatively.

   All other edges use the channel model. The fallback set is computed
   at the start of the routing pass, logged in debug mode, and verified
   by the compound-boundary oracle in the test matrix.

   The 01 nudging pass operates on fallback routes only. The
   implementation must pass only the fallback-routed edge subset to the
   nudging function; it must not call the existing nudging function on
   all routes. Channel-routed edges have track separation guaranteed by
   construction and do not need nudge separation. If channel-routed
   edges degenerate (same-exit stub with zero track separation), the
   dedupeCollinear finish and coincidentRuns oracle will catch it.

   Mixed-mode edges: an edge with at least one per-span orthogonal
   fallback (step 3: a waypoint miss routed via `routeOrthogonal` for
   that span) is treated as a whole-edge fallback for nudging purposes.
   Its entire route -- including any channel-routed spans -- is passed
   to the nudging function. This is the conservative classification: a
   mixed-mode edge cannot be guaranteed collision-free by the channel
   model alone because its orthogonal spans are not track-separated by
   construction. Edges that are channel-routed for ALL spans are
   excluded from the nudging pass; only whole-edge fallbacks (conditions
   5a-5c) and mixed-mode edges (at least one per-span fallback) are
   included. The `dedupeCollinear` pass applies to all edges regardless
   of nudging classification; the coincidentRuns oracle applies to
   channel-routed spans within mixed-mode edges as well as to fully
   channel-routed edges.

6. The escalation ladder and its 4px retry are DELETED (no-legacy).
   The recovery path if a regression appears outside the six lab
   scenarios is a git-revert of this brief's commit. The verification
   gate in the Verification section (oracle on all six scenarios, gates
   green) is the primary regression barrier before merge. No feature
   flag, phased rollout, or parallel-path is introduced; the no-legacy
   doctrine applies.

## Rollback

Single-commit atomic: the escalation ladder deletion, Brief 10
accept-site deletion, and `routeOrthogonal` contract narrowing land in
one commit. To revert: `git revert <sha>`. The revert restores the
ladder, the accept-site code, and the broad nudging scope. The six lab
scenarios' oracle values must be re-pinned if a revert lands after
re-pinning under this brief.

Knowledge-graph state after revert: the Brief 10 plan atom annotation
added in step 4 records a supersession arc pointing to code that no
longer exists after the revert. This is not automatically harmless:
`kb verify` invariants I-1, I-34, I-35, and I-38 may enforce
consistency between a plan atom carrying a supersession arc and the
code state it references. After a `git revert`, run `kb verify
--project g3_toolkit` immediately. If any invariant fires on the
stale annotation, remove the annotation manually via `kb update` or
`kb supersede --kind invalidation` before declaring the revert
complete. The rollback is not done until `kb verify` passes cleanly.
The fallback-set debug log is additive and does not require cleanup.

## Verification

- Oracle on all six lab scenarios: box violations stay 0, crossings
  do not increase anywhere (a strict non-regression bound). On Crossing
  Storm and Cycle Tangle, a crossing decrease is expected from the
  channel model for edges that are fully channel-routed, but this is
  not a hard oracle assertion: same-layer (5a) and anti-monotone (5b)
  edges are routed via `routeOrthogonal` and their crossing
  contribution may not decrease. The oracle asserts only non-regression
  for the full crossing count; a separate sub-assertion may track
  channel-only crossing counts if the scenarios isolate them cleanly.
  coincidentRuns stays 0, bends do not regress beyond a pinned
  tolerance.
- Track count bound oracle: for every channel in each lab scenario,
  assert that the number of edges assigned tracks is <= the `demand`
  value from Brief 04 layout output. This is a gate-green test
  assertion, not a debug log. Any overflow must produce a test failure
  and trigger the per-channel `routeOrthogonal` overflow path.
- Drag stability: 3px perturbation keeps channel/track assignment
  (discrete keys) -- no flicker. Additional: drag an edge to the
  track-assignment threshold boundary (the exact cross-coord where
  the sort key would flip) and assert the discrete key does not
  produce a visible re-render at the intermediate drag position.
- Compound-boundary oracle: at least one lab scenario must include a
  same-layer backedge around a compound boundary. The oracle asserts
  (a) the channel router classifies that edge as a fallback (condition
  5a or 5c above) using the bounding-box containment check (not a
  partial routing run), (b) `routeOrthogonal` handles it, and (c)
  coincidentRuns stays 0. The channel/fallback handoff point is
  logged in the test output.
- Anti-monotone oracle: at least one lab scenario must include an
  anti-monotone edge (backward arc, condition 5b). The oracle asserts
  (a) the channel router classifies it as a fallback using the
  layer-adjacency graph direction check, (b) `routeOrthogonal` handles
  it, and (c) coincidentRuns stays 0. If no existing lab scenario
  contains an anti-monotone edge, add one.
- Unit: track assignment combinatorics -- given N edges with specified
  (entry, exit) cross-coord pairs, assert assigned track indices match
  the rainbow order expected from the libavoid sort. Pathological
  inputs: all-same entry (ordered by exit), all-same entry and exit
  (any stable order; assert coincidentRuns = 0), single-node-to-many-
  channel fan. Also: N edges where N > demand; assert the overflow
  edges are routed via `routeOrthogonal` and the track count bound
  oracle passes.
- Unit: dedupeCollinear round-trip -- given track-separated geometry
  with genuine orthogonal bends, assert dedupeCollinear does not
  remove any bend point. Given a polyline with a collinear intermediate
  (three collinear points), assert the middle is removed. This
  confirms the implementation does not rely on collinear markers.
- Determinism byte-identical; gates green; ledger note for any core
  chunk growth.
