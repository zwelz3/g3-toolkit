---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief: route nudging post-pass (parallel-run separation)

Owner ask (Jake, 2026-08-14): drag-time routes collapse into shared
corridors with "not enough space between the routes"; pull the nudging
pass forward as the FIRST refactor slice (ahead of Phase 1 dummy
chains), and take the lessons/techniques (NOT code) from the surveyed
engines and do it better.

## Problem (verified against source)

`routeStructuralEdges` routes each edge independently with zero
inter-edge awareness (`packages/core/src/layout/g3t-engine/
g3t-routing.ts`):

- The simple template jogs every E/W edge at `midX = (sTip.x +
  tTip.x) / 2` (g3t-routing.ts:592) — edges spanning the same pair of
  layers share near-identical tips, so their jog segments land on the
  same x and run coincident.
- Escalated edges route with boxes as obstacles but OTHER EDGES
  INVISIBLE, and the retry ladder drops clearance to 4px for dense
  post-drag packings (g3t-routing.ts:666) — several escalated routes
  independently discover and stack in the same tight channel.
- The only separation anywhere is the anchor fan ON the node borders;
  nothing separates segments out in the corridor.

## Technique synthesis (lessons, not code)

| Source | Technique taken | How we apply it |
|---|---|---|
| MSAGL `nudging/` (MIT) | Nudging as constrained 1D optimization: free the interior segments, fix the terminals, solve min-displacement subject to min-gap, per parallel group | The core algorithm shape: post-pass over emitted polylines, terminal stubs stay anchored to the fan positions |
| MSAGL | Combinatorial order, not pixel order: segment order inside a group derives from the paths' structure so nudging can never introduce a crossing that wasn't there | Order group members by their neighbor-point cross coordinates (where each path comes from / goes to), tie-break by edge id — deterministic and drag-stable |
| libavoid (Adaptagrams) | Shared-path divergence ordering: edges sharing a channel are sorted by where they eventually diverge, minimizing intra-channel crossings; routes centered in channel free space | The group sort key is (entry cross-coord, exit cross-coord); track positions center on the corridor midline rather than hugging one wall |
| ELK layered routing (EPL) | Track assignment in the inter-layer gap: overlapping segments get distinct integer tracks, spacing = usable gap / (tracks + 1) | Fallback distribution when the corridor is too narrow for the requested 8px: degrade spacing evenly instead of giving up |
| dagre | Corridor supply must be layout's job: dummy columns reserve the space tracks need | OUT OF SCOPE here, but the pass MEASURES demand (max tracks per corridor) and exposes it — the Phase 2 corridor-supply contract consumes that number |
| Existing fan-align pass (this repo) | Forward/backward sweep with clamped span (g3t-routing.ts:278-289) solves exactly the 1D min-displacement problem | Reuse the same two-sweep technique for track placement — no new solver dependency |

**Where we do better than the sources:** (1) the pass is
producer-agnostic — it runs on the final route map, so simple-template,
grid-router, and detour outputs all get separated uniformly (MSAGL/ELK
each nudge only their own router's output); (2) determinism and drag
stability are contract, not accident — ordering keys are combinatorial
(fan order, edge id), so a 3px drag cannot reorder tracks and flicker;
(3) demand measurement feeds the next phase instead of being discarded.

## Design

New pure module `packages/core/src/layout/g3t-engine/g3t-nudging.ts`:

```
nudgeRoutes(routes, obstacles, options?) -> { routes, corridorDemand }
```

0. **Normalize** every input polyline through `dedupeCollinear` as an
   explicit first step. Nudging does NOT assume the router pre-deduped;
   the call is idempotent and cheap, and it guarantees step 1 never
   sees spurious near-zero-length segments.
   SOURCE FACTS (checked 2026-08-14; implementing worker re-verifies
   before coding): `dedupeCollinear` lives at
   packages/core/src/layout/g3t-engine/g3t-routing.ts:30 with signature
   `(points: Pt[]) => Pt[]`; it is PURE — it builds a fresh output
   array and never mutates its argument, so the copy-then-validate /
   revert pattern in step 5 is safe. It is currently MODULE-PRIVATE
   (no `export`); this slice adds `export` to it (or lifts it to a
   shared routing-util module) so g3t-nudging.ts can import it — do
   not duplicate the implementation.
1. **Decompose** each polyline into maximal axis-aligned segments.
   Interior segments are movable on their perpendicular axis. Anchor
   stubs (first/last segments) are FIXED in exactly this sense: the
   stub's own-axis line (its perpendicular coordinate, i.e. the fan
   position on the node border) never changes, but its LENGTH may
   extend or trim along its own axis when an adjacent interior
   segment moves — that length change is what keeps the polyline
   connected. "Fixed" constrains the anchor coordinate, never the
   stub endpoint shared with the moved neighbor.
2. **Group** parallel interior segments into corridors: same axis,
   perpendicular coordinates within a capture band (2x target gap),
   parallel extents overlapping. Union-find over the overlap relation,
   with a SPLIT RULE: two segments are never unioned when an obstacle
   box lies between them on the perpendicular axis within their shared
   extent. This keeps the 16px band from absorbing logically distinct
   corridors in dense 4px post-drag packings (the retry ladder's
   minimum clearance, g3t-routing.ts:666) — a box between two tight
   channels is exactly what distinguishes them.
3. **Order** each group by (entry cross coord, exit cross coord, edge
   id) — the libavoid divergence sort. These are CORRIDOR-LOCAL
   coordinates: for each member segment, the cross coordinates of the
   polyline points immediately adjacent to that segment (where the
   path enters and leaves the corridor) — NOT the route's global
   source/target coordinates, which diverge from the local ones on
   multi-bend paths and would break sort stability. Never order by
   current pixel position alone.
4. **Place** tracks with a forward/backward two-sweep — the same
   TECHNIQUE the fan-align pass uses, implemented FRESH in
   g3t-nudging.ts (verified 2026-08-14: the existing sweep is INLINE
   code at g3t-routing.ts:278-289 inside the fan pass, not a
   callable API; it is ~12 lines, and extracting it would touch the
   fan pass this brief's scope guard protects — do not refactor it,
   write the sweep locally with nudging's own contract): desired =
   current position, min separation = `trackGap` (default
   8px), freedom interval = corridor free span from the obstacle boxes
   minus `clearance` (8px). ONE spacing convention everywhere:
   `spanRequired = (n + 1) * trackGap` — full gap between every
   adjacent track pair PLUS a full-gap margin at each edge of the
   spread (matching the CorridorDemand schema; deficit is 0 exactly
   when the ladder selects case (a)). Degradation ladder, in order:
   (a) span >= (n + 1) * gap: full-gap placement. CENTERING
   CONVENTION: the n tracks are placed symmetric about the FREE-SPAN
   midline — the midpoint between the clearance-adjusted faces of the
   two bounding obstacle boxes; when boxes are asymmetric this midline
   (not any geometric average of the original segment positions) wins.
   (b) 0 < span < (n + 1) * gap: distribute evenly ELK-style
   (span / (n + 1)) — reduced but positive spacing, never overlapping a
   box. STARTING ANCHOR AND CENTERING CONVENTION: identical to branch
   (a) -- the n tracks are placed symmetric about the free-span midline
   (the midpoint between the clearance-adjusted obstacle box faces), with
   inter-track spacing span/(n+1). Branch (a) and branch (b) share
   exactly one centering convention; the only difference is the spacing
   value. (c) span <= 0 (corridor fully occluded): TERMINAL FALLBACK —
   the whole group keeps its original positions untouched, and the
   corridor is recorded in `corridorDemand` with `blocked: true`,
   `blockedReason: 'occluded'`, and its full deficit. No exception,
   no undefined coordinates. OPEN CORRIDORS: when one or both sides
   of a corridor have no bounding obstacle box (edges routed near the
   scene boundary), the free span on that side is bounded by
   `min(layoutBound, ownExtreme + trackGap)`: the group's own
   outermost original segment position on that side (from the input
   snapshot) plus ONE trackGap, clamped inside the layout bounds
   (geometry bounding box plus routing margin). The own-extreme term
   is PRIMARY — a group never spreads more than one trackGap beyond
   its own original extreme on an open side, no matter how much open
   space the layout bounds offer. This restores per-group
   independence BY CONSTRUCTION for open corridors: two distinct
   groups are separated by MORE than the 16px capture band (strict,
   else they'd have been unioned), and each can reach at most
   trackGap = 8px beyond its own extreme toward the other, so their
   track sets cannot meet (>16 - 8 - 8 > 0). It also removes any
   dependency on the router's margin value being coherent with this
   pass: the bound derives from the snapshot geometry the pass
   already owns; layout bounds act only as an outer clamp. Midline
   and corridorKey are computed from these substitute bounds, so
   both are always defined. Bounding the open-side spread also
   bounds ANCHOR-STUB extension by construction: no track sits
   farther than one trackGap beyond the group's original extreme
   (bounded corridors are bounded by the boxes themselves), so a
   stub can never grow toward a neighboring node unchecked. A stub
   trimmed to zero length produces a degenerate zero-length segment
   (endpoint equals its neighbor). SOURCE FACT (verified 2026-08-14
   against g3t-routing.ts:31-47): `dedupeCollinear` removes
   COLLINEAR INTERMEDIATE points only (the middle of three
   consecutive same-x or same-y points); it does NOT remove
   consecutive IDENTICAL points (zero-length segments). The rewrite
   step must apply a separate explicit filter AFTER `dedupeCollinear`
   to drop consecutive identical points:
   `pts.filter((p, i) => i === 0 || p.x !== pts[i-1].x || p.y !== pts[i-1].y)`.
   No degenerate zero-length segments are emitted.
5. **Rewrite** with SNAPSHOT-PLAN / ATOMIC-COMMIT semantics. ALL of
   steps 2-4 (grouping, sort keys, track placement) are computed from
   ONE immutable snapshot of the input geometry — no group ever sees
   another group's moves, so sort keys can never go stale against the
   geometry they govern. Rewrites for every group are computed on
   COPIES (move each segment to its track, extend/trim the two
   perpendicular neighbor segments, `dedupeCollinear`), validated per
   group, and then committed in ONE final pass. Per-group validity is
   independent by construction: validation is against the STATIC
   obstacle boxes (which no group moves), and distinct corridors are
   separated beyond the capture band (or split by a box), so one
   group's tracks cannot land on another group's (open corridors:
   guaranteed by the own-extreme + trackGap bound in step 4).
   Validate the whole group, TWO checks: (1) BOX CHECK — every
   rewritten route must pass `polylineIntersectsBoxes`. RETURN-VALUE
   SENSE (checked 2026-08-14 against source; worker re-verifies):
   the function returns TRUE when any segment overlaps a box
   interior — true means INVALID; a route validates when the call
   returns FALSE. SOURCE FACTS (worker re-greps before coding and
   adapts import path/signature if it moved): exported from
   packages/core/src/route/orthogonal-router.ts:389 as
   `(points, boxes) => boolean`, already imported by g3t-routing.ts.
   (2) CROSSING CHECK — pairwise segment crossings AMONG the group's
   rewritten members must not exceed the same pairs' crossing count
   in the input snapshot. This is the runtime backstop for the one
   case the combinatorial-order argument does not cover: the 16px
   capture band unioning two legitimately distinct dense channels
   (e.g. 4px post-drag packings with no obstacle box between them,
   where the split rule cannot fire) — a merged group's global sort
   can interleave routes from different channels and introduce a
   crossing. Within a true single corridor the check passes by
   construction; for a wrongly merged corridor it converts a
   potential rendering regression into a clean group revert.
   Failure semantics are DISTINGUISHED by failure type:
   - BOX CHECK failure (spacing-driven): retry once with
     `trackGap' = trackGap / 2`, RE-RUNNING THE FULL three-branch
     ladder at the halved gap (not a direct fixed-spacing emit). A
     tighter gap may find a valid placement. If the retry still fails
     the box check, the ENTIRE group reverts to its original polylines
     and the corridor is recorded in `corridorDemand` as blocked with
     `blockedReason: 'reverted'`.
   - CROSSING CHECK failure (group-membership-driven): immediately
     revert the ENTIRE group WITHOUT any retry. Crossing failures
     indicate the capture band merged two legitimately distinct dense
     channels with no obstacle box between them. The sort order and
     group composition are unchanged at a halved gap; re-running the
     ladder cannot alter the ordering that introduced the crossing.
     Consuming the one-retry budget on a geometrically impossible
     outcome silently misclassifies an algorithmic edge case as a
     spacing problem. Record the group in `corridorDemand` as blocked
     with `blockedReason: 'reverted'`.
   In both failure paths, revert is ALL-OR-NOTHING per group: no
   mixed-nudge states, so the pass can never produce a co-located
   pair that was not already in the input -- the un-nudged input is
   the guaranteed worst case. A 2-point straight route is never nudged (a
   straight line must not gain bends) and never joins a group.
   Rollback granularity is the GROUP (which contains whole routes'
   corridor segments); a route outside any committed group is
   byte-identical to its input.
6. **Wire in** at the end of `routeStructuralEdges` ITSELF behind
   option `nudge?: boolean`, default ON. "Default ON" mirrors the
   DEFAULT POSTURE of the existing `routeEdges` option — verified
   2026-08-14: structural.ts:746 resolves `routeEdges: options?.
   routeEdges ?? true` — i.e. quality passes in this engine ship
   enabled with an opt-out; it does NOT claim routeEdges itself has
   any nudge sub-option (this brief introduces nudging for the first
   time). Thread through `layoutStructural`'s routing options.
   OPTIONS BAG SIGNATURE (verified 2026-08-14 against g3t-routing.ts:
   111-122): the current options object carries exactly three fields --
   `routingBudgetMs?`, `direction?`, `anchor?`. Adding `nudge?: boolean`
   has no field name collision. Implementing worker re-verifies this
   signature before adding the new field to confirm no collision was
   introduced after this date.
   Non-test call sites enumerated (checked 2026-08-14; worker
   re-greps): g3t-structural.ts:295 (the `layoutStructural` flow) and
   packages/react/src/views/svg/structural-svg-view.tsx:408 (a DIRECT
   call bypassing `layoutStructural`). Because the wire-in is inside
   `routeStructuralEdges`, the direct SVG call and any external
   caller of the exported function get nudging by default — no call
   site is silently skipped.
   DRAG-STABILITY CLAIM, precisely scoped: track ORDER within a
   corridor group is drag-stable (combinatorial keys). Group
   MEMBERSHIP is recomputed per pass; a drag that moves a segment
   across the capture-band boundary legitimately re-corridors it —
   that is a real geometry change, not flicker. Membership hysteresis
   is explicitly OUT OF SCOPE for this slice.
   Default-ON changes geometry for every existing structural render:
   the implementing worker MUST re-pin every affected snapshot /
   pixel / geometry assertion in the SAME PR (test churn is expected
   and accepted; a red baseline left for the next brief is not).
   AUDIT RULE: deleting or skipping a test to make the suite pass is
   FORBIDDEN; baseline re-pins land as ONE SEPARATE commit in the
   same PR (implementation commit + re-pin commit), the re-pin commit
   body lists every re-pinned test by file, and the worker reports
   the count in its outcome summary. ROLLBACK PATH (nudging-caused
   regressions only): when bisection confirms the regression traces to
   the nudging pass itself (track placement, group formation, or
   ordering), recovery is ONE revert PR that flips the default
   (`nudge: false`) AND reverts the re-pin commit -- that's why re-pins
   are a separate, cleanly revertible commit; the owner (Jake/Zach)
   decides the flip, no config atom or infra involved. This path does
   NOT cover normalization-caused regressions -- see NORMALIZATION
   CAVEAT below. NORMALIZATION CAVEAT: Step 0 applies `dedupeCollinear`
   normalization to ALL input polylines unconditionally, regardless of
   the `nudge` flag value. A regression caused by normalization alone
   (collinear-point removal changing a route's bounding geometry or
   hit-test behavior) is NOT isolatable by flipping the default. If
   bisection points to normalization as the root cause, a separate
   minimal revert (removing the Step 0 call or guarding it behind the
   `nudge` flag) is required before the default flip; the owner decides.

### corridorDemand schema (the Phase 2 contract — defined, not opaque)

```ts
// Discriminated union: when blocked is true, blockedReason is REQUIRED.
// TypeScript enforces this — a consumer checking (entry.blocked &&
// !entry.blockedReason) is a type error, not a silent undefined fallthrough.
// Brief 04's dispatch rule ("never on blocked alone") is thus type-safe.
type CorridorDemand =
  | {
      axis: 'h' | 'v';          // segment orientation in the corridor
      corridorKey: string;       // deterministic id, spec below
      midline: number;           // CLEARANCE-ADJUSTED free-span midline
      extent: [number, number];  // corridor span along the segment axis
      edgeIds: string[];         // members, in final track order
      tracksRequired: number;    // n = group size
      spanAvailable: number;     // free span between obstacle boxes minus clearance
      spanRequired: number;      // (n + 1) * trackGap
      deficit: number;           // max(0, spanRequired - spanAvailable)
      blocked: true;
      blockedReason: 'occluded' | 'reverted';
                                 // 'occluded' = spanAvailable <= 0: GEOMETRY
                                 // deficiency — brief 04 must reserve space here.
                                 // 'reverted' = space existed but validation
                                 // rejected a member: ALGORITHM edge case —
                                 // brief 04 must NOT treat it as a space request.
    }
  | {
      axis: 'h' | 'v';
      corridorKey: string;
      midline: number;
      extent: [number, number];
      edgeIds: string[];
      tracksRequired: number;
      spanAvailable: number;
      spanRequired: number;
      deficit: number;
      blocked: false;
      blockedReason?: never;     // absent on non-blocked entries
    };
```

`corridorKey` QUANTIZATION SPEC (deterministic, versioned with the
layout): coordinate space is the layout coordinate space of
`geometry.edges` (the same numbers the polylines carry); quantization
is `Math.round` to integer pixels (round-half-up, JS default); key =
`` `${axis}:${Math.round(midline)}:${Math.round(extent[0])}..${Math.round(extent[1])}` ``.
Two passes over the same geometry produce identical keys; a genuine
layout change legitimately changes them (keys identify corridors
within a layout, they are not stable across relayouts — brief 04
matches by key within one pass, never across passes).
FLOATING-POINT DISCIPLINE: midline and extent are computed EXACTLY
ONCE per corridor per pass, from the immutable snapshot, and that
single value is reused for both track placement and the key -- no
caller recomputes the "same" midline via a different arithmetic
path, so within-pass key identity cannot be broken by FP rounding
divergence. `layoutBound` (used for the open-side clamp in step 4)
is computed ONCE at the start of the pass from the immutable input
geometry -- the bounding box of all obstacle node boxes plus the
routing margin from the options -- and that single value is reused
throughout the pass. It is never recomputed from live geometry
mid-pass, giving it the same one-source-of-truth guarantee as
midline and extent.
KEY COLLISION EDGE CASE: the split rule separates corridors on
either side of an obstacle box, but if the box is thin enough that
the two clearance-adjusted midlines (each calculated from its own
side of the box) differ by less than 0.5px, `Math.round` produces
the same integer and the extent ranges may also round identically,
yielding a key collision within one pass. The implementing worker
MUST detect this case at construction time and append a per-pass
index suffix (e.g. `:0`, `:1`) to disambiguate: deduplicate emitted
keys within the pass and suffix any duplicate in DETERMINISTIC
CORRIDOR EMISSION ORDER: corridors are enumerated in lexicographic
order of their pre-collision key -- axis ascending ('h' < 'v'), then
`Math.round(midline)` ascending, then `Math.round(extent[0])`
ascending. This order is fully determined by the immutable input
snapshot. Two passes over identical geometry therefore assign :0/:1
to the same corridors, preserving the 'two passes produce identical
keys' guarantee.
Brief 04 matches by key within one pass and must handle suffixed
keys transparently (the suffix is part of the opaque key string).

`nudgeRoutes` returns `corridorDemand: CorridorDemand[]` sorted by
deficit descending — brief 04 (corridor supply) consumes exactly this
shape. BLOCKED SEMANTICS for brief 04 — dispatch on `blockedReason`,
never on `blocked` alone (this is the ONE rule; the schema footnote
above states the same discrimination):
- `blockedReason: 'occluded'` — a GEOMETRY deficiency: "this corridor
  NEEDS spanRequired but layout supplied spanAvailable <= 0". This is
  a space-reservation REQUEST at highest priority, never a
  skip-this-corridor signal.
- `blockedReason: 'reverted'` — an ALGORITHM edge case (validation
  rejected a placement that had space). DIAGNOSTIC ONLY: brief 04
  MUST NOT reserve layout space for it; it surfaces engine work.
- `blocked: false, deficit > 0` — degradation case (b): ELK-style
  evenly distributed, positive but below-target spacing. Nudging
  succeeded but at reduced quality. Brief 04 MAY optionally reserve
  additional corridor span for these entries (treating deficit as a
  soft space request), but is NOT required to. The entry's
  `blockedReason` is absent (`never`), distinguishing it from the
  two blocked cases above at the type level.

## Verification

- **Oracle metric first:** add `coincidentRuns` to the Routing Lab
  quality oracle (`src/demo/routing/quality.ts`) — pairs of distinct
  edges with parallel overlapping segments closer than 4px. Pin the
  CURRENT values for ALL SIX lab scenarios in a test (Fan-In Bus and
  Port Storm carry the known-bad counts; the others pin whatever
  their current value is), then assert the nudged value reaches 0
  where corridor width allows and never increases on any scenario.
  CARVE-OUT: when one route in a coincident pair is a 2-point
  straight, the 2-point route is excluded from nudging by design —
  the oracle assertion for such pairs is "count does not increase",
  not "reaches 0". Any lab scenario containing a coincident 2-point
  route must have this carve-out applied per pair to avoid false
  positive failures.
- **Nudge-bypass test:** with `nudge: false` explicitly set, assert
  each output route is byte-identical to applying `dedupeCollinear` to
  its input polyline and nothing else -- no group is formed, no track
  placement occurs. This is the ONLY test that empirically confirms the
  flag provides a complete bypass of steps 1-5 (grouping through
  rewrite), and it establishes the normalization/nudging boundary: any
  output difference on `nudge: false` vs the raw input is attributable
  to Step 0 normalization alone, and any further difference between
  `nudge: false` and `nudge: true` is attributable to steps 1-5 alone.
  Without this test, the rollback promise (flip the default to recover
  nudging regressions) is untested and the regression source
  unresolvable by inspection.
- **Return-value sense test:** add a direct unit test asserting
  `polylineIntersectsBoxes` return polarity: a polyline segment that
  passes through a box interior must return `true`; a polyline that
  avoids all boxes must return `false`. This test is a guard against
  inversion during the import -- it verifies the convention the
  validation logic depends on, independent of the nudging pass.
- Unit tests on the module: order preservation (no new crossings by
  construction — assert crossings metric does not increase on all six
  lab scenarios), box-violation count does not increase, straight
  routes untouched, determinism (two runs byte-identical), drag
  stability (perturb one node 3px, assert track ORDER unchanged).
- Sort-order test: assert that the returned `corridorDemand` array is
  sorted by `deficit` descending — `corridorDemand[i].deficit >=
  corridorDemand[i+1].deficit` for all i. Brief 04's priority-first
  processing depends on this; a bug emitting corridors in input or
  key order would silently deprioritize the highest-deficit cases.
- Degradation-ladder unit tests, one per branch, using the SAME
  boundary convention as step 4: (a) span >= (n+1)*gap asserts
  full-gap spacing exactly `trackGap`, gap-consistent, and every
  track at least `clearance` from both bounding box faces; (b) the
  ELK-degraded branch (0 < span < (n+1)*gap) asserts the emitted
  spacing equals span/(n+1), is strictly positive, no track overlaps
  a box, AND the outermost tracks respect the clearance margin from
  the box faces; plus an explicit boundary case at span exactly
  (n+1)*gap asserting branch (a) is selected and deficit is 0 (the
  off-by-one canary); (c) fully blocked corridor (span <= 0) asserts
  byte-identical passthrough of the group AND a `corridorDemand`
  entry with `blocked: true`, `blockedReason: 'occluded'`, and the
  correct deficit. RUNTIME NOTE: `polylineIntersectsBoxes` enforces
  box interior non-intersection only -- it does not verify clearance
  margin. The outermost-track clearance assertion in branch (b) is a
  unit test invariant only; there is no runtime validation backstop
  analogous to the box check for this property. The unit test is the
  sole enforcement layer for branch (b) clearance.
- Retry-branch test: a group whose first placement fails the BOX CHECK
  but succeeds at trackGap/2 asserts the retry re-runs the full ladder
  at the halved gap and commits; a group that fails the box check on
  both attempts asserts whole-group revert with
  `blockedReason: 'reverted'`; a group that fails the CROSSING CHECK
  on the first attempt asserts immediate whole-group revert with
  `blockedReason: 'reverted'` and NO retry (the half-gap retry must
  not fire for crossing failures).
- Split-rule test: two segments within the 16px capture band with an
  obstacle box between them on the perpendicular axis assert they are
  NOT grouped (two distinct corridors emitted, neither track set
  crosses the box); removing the box asserts they ARE grouped — the
  test fails if the split rule is omitted or inverted.
- Open-corridor test: a corridor with no bounding obstacle box on
  one side (and a variant open on both sides) asserts midline,
  corridorKey, extent, and every track position are defined and
  finite, no track exceeds `ownExtreme + trackGap` on an open side,
  and no track leaves the layout bounds.
- Cross-group contamination test: two distinct corridors just
  OUTSIDE the capture band, open on their facing sides, each dense
  enough to spread; assert after nudging that the two committed
  track sets do not overlap and no route from one group collides
  with the other — the empirical backstop for the per-group
  independence claim exactly where it is weakest. Use a separation
  of exactly 16px + 1 (the minimum that satisfies the non-union
  condition) to exercise the limit case: at this geometry the gap
  between the outermost tracks of the two groups is 1px, which is
  formally non-overlapping but below trackGap. The test asserts
  non-overlap (the correctness guarantee), not 8px spacing (which
  is a best-effort target, not a guarantee, at near-capture-band
  separations).
- Merged-channel test: two legitimately distinct 4px-spaced channels
  WITHIN the 16px capture band with no obstacle box between them
  (the split rule cannot fire, so they union into one group); assert
  the outcome is either a commit with no crossing increase or a
  clean whole-group revert — never a committed crossing regression.
- Group-atomicity test: construct a corridor where one member cannot
  move without a box hit; assert the WHOLE group is byte-identical to
  input (no mixed-nudge state) and `coincidentRuns` did not increase.
- Stub-degeneracy test: a track placement that trims an anchor stub
  to zero length asserts the explicit identical-point filter (applied
  after `dedupeCollinear`) removes the degenerate segment (no
  zero-length segment emitted) and the polyline stays connected.
  Additionally asserts that `dedupeCollinear` alone does NOT remove
  the zero-length segment — confirming the filter is necessary. A
  placement at the open-side bound asserts stub extension never
  exceeds `ownExtreme + trackGap`.
- Multi-bend ordering test: a path with 3+ bends before and after a
  shared corridor, crossing a second corridor, asserting the
  corridor-local sort keys still yield a crossing count that does not
  increase — the empirical backstop for the combinatorial-order
  argument on exactly the geometry where local and global cross
  coords diverge.
- Routing Lab gets a `nudge` on/off knob next to `routeEdges` for
  visual A/B; live check on g3.ghostsystems.ai is the acceptance
  surface (edge rendering is not headlessly verifiable — CLAUDE.md).
- `pnpm run gates` green; bundle delta gets a ledger rationale if the
  core chunk grows.

## Scope guard

No public API widening beyond the `nudge` routing option and the
exported `corridorDemand` shape. `dedupeCollinear`'s new export is
ENGINE-INTERNAL only: exported from g3t-routing.ts so g3t-nudging.ts
can import it, but NOT re-exported from packages/core/src/index.ts --
it stays out of the package's declared public surface. KNOWN
LIMITATION: adding `export` to dedupeCollinear causes it to appear
in the package's generated .d.ts declaration files, making it
technically reachable via deep imports (`packages/core/src/layout/
g3t-engine/g3t-routing`) and visible to IDE auto-import suggestions.
This .d.ts leakage is accepted: ENGINE-INTERNAL is a semantic
designation, not a compile-time enforcement boundary. If .d.ts
leakage is later judged unacceptable, extract dedupeCollinear to a
private helper file that neither module re-exports. Future refactors
may still treat it as internal. No changes to anchor fans, the escalation
ladder, or the simple template — this slice ONLY separates what they
emit. Dummy chains (LAY-005) and the channel router
(PRF-003) remain later phases; corridorDemand is the bridge to them.
