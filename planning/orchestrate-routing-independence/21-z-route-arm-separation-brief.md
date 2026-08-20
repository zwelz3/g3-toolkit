---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 21: nudge/separation on BOTH axes of a Z-route (arm separation via stub-insertion)

Owner ask (Jake, A42): "I need nudge/separation to work on both horiz
and vert paths of a z-route."

Today the nudge post-pass separates only the MIDDLE bar of a Z. The two
arms stay stacked on the same pixels, so a Z-route separates on exactly
one of its two axes. This brief extends `nudgeRoutes` so the arms get
their own tracks too, by INSERTING a jog (not translating a pinned
segment), preserving the terminal port anchors exactly.

This is opt-in `nudge` work only (default false). Do NOT change any
default-path geometry. Do NOT touch the non-structural scene router
(`route-scene-edges.ts`) — this is the structural nudge pass.

## Ground truth (verified in source 2026-08-19, cite these exact sites)

- `packages/core/src/layout/g3t-engine/g3t-nudging.ts`
  - Line 126: `const fixed = i === 0 || i === pts.length - 2;` — marks
    the first and last segment of every route `fixed`. For a 4-point /
    3-segment Z the axes alternate, so the single movable middle segment
    is one axis and BOTH arms are the other axis. Only the middle-bar
    axis is ever separated.
  - Line 132: `const movable = segments.filter((s) => !s.fixed);` — the
    grouping/placement pipeline operates ONLY on movable segments. Arms
    are excluded from grouping entirely.
  - Lines 507-584 `attemptGroupRewrite`: rewrites a segment by setting
    `a.<perp>` and `b.<perp>` of the SAME segment to `newPerp` (a
    translate). It then `dedupeCollinear`s, box-checks every rewritten
    polyline (line 564, revert-on-hit `failureKind:"box"`), and rejects
    any pair whose crossing count increased (line 578,
    `failureKind:"crossing"`). This validation + the atomic
    snapshot/commit at lines 370-428 is the contract to REUSE unchanged.
  - Lines 293-341: placement math (`faceLo`/`faceHi`/`spanAvailable`,
    own-centre-of-mass anchoring, degradation gap). Arm placement reuses
    the SAME corridor bounds and degradation ladder.
- `packages/core/src/layout/g3t-engine/g3t-nudging.test.ts`
  - Lines 15-32 `twoParallelHRoutes`: two identical `H(y=100) –
    V(x=30) – H(y=200)` Z-routes.
  - Lines 70-84: the current test asserts ONLY `a[1].x !== b[1].x` (the
    vertical bars). The two horizontal arms at y=100 and y=200 are left
    coincident and unchecked. This is the exact hole to close.

## The design (resolve these as written; do NOT re-litigate)

A "fixed" arm has one END pinned to the terminal anchor (p0 for seg 0,
p_last for the last segment). It cannot be translated, but its interior
run can be shifted onto a separate track by inserting a jog while the
anchor stays byte-identical.

1. **Candidate inclusion.** Arm segments (currently `fixed`) become
   grouping candidates under the SAME rules as interior segments
   (axis match, capture-band on perp, along-extent overlap,
   obstacle-split test at lines 168-178). Keep a `kind: "arm" | "bar"`
   discriminator on the segment; the anchored end index (0 or last)
   travels with an arm candidate so placement knows which end is nailed.
   An arm groups with bars and with other arms freely — a crowded arm
   next to a bar on the same axis is a real corridor.

2. **Placement = jog insertion, not translate.** For an arm assigned
   track perp `t` whose anchored end sits at perp `p_anchor`:
   - Emit `anchor → stub(along the arm for STUB_LEN at p_anchor) →
     bend to perp t → run to the arm's far bend → rejoin`.
   - `STUB_LEN = min(trackGap, armAlongExtent / 3)` so short arms never
     over-jog past their own far bend. If `armAlongExtent < 2*trackGap`
     the arm is too short to jog cleanly: leave it fixed (skip, do not
     force a jog).
   - The perpendicular stub at the anchor is exactly what a declared
     port wants (perpendicular exit), so this is port-compatible.
   - The anchored endpoint coordinate NEVER changes. Assert it in the
     rewrite: `rewritten[e][anchorIdx]` deep-equals the input anchor.

3. **Bars still translate** exactly as today (no jog). Only arms insert
   bends.

4. **Validation + atomicity UNCHANGED.** The jogged polyline goes
   through the same `polylineIntersectsBoxes` box-check and the same
   crossing-no-worse pair check in `attemptGroupRewrite`; a group that
   fails either reverts whole (box → retry at `trackGap/2` first, then
   revert; crossing → revert immediately). corridorDemand accounting is
   unchanged (arms count toward `tracksRequired` like any member).

5. **Idempotence preserved.** A second nudge pass over an
   already-jogged route must be a no-op: once arms sit >= trackGap apart
   the `crowdedRuns` split (lines 222-238) drops them from planning, so
   no second jog is inserted. Add a determinism test asserting
   `nudge(nudge(x)) === nudge(x)`.

## Verification (all must pass; cite the run)

- Flip `twoParallelHRoutes` test (line 70): assert BOTH arms land on
  distinct perps (`a[0].y !== b[0].y` after jog OR the jogged arm runs
  carry distinct perp) AND the bars stay distinct. Keep the existing bar
  assertion.
- Add a `V–H–V` mirror fixture and assert the same on the flipped axis.
- Add an anchor-preservation test: every route's p0 and p_last are
  byte-identical to input after nudge.
- Add the idempotence test (double-nudge no-op).
- Add a short-arm test: an arm with `armAlongExtent < 2*trackGap` is
  left fixed (no jog, no box violation).
- Box-clean invariant holds: no rewritten polyline intersects an
  obstacle (the existing line-268 test must still pass, extended to a
  scene with obstacles flanking the arms).
- Full gate: `pnpm run gates` (five steps; spec gates via python3 on
  this host per the standing quirk). Pre-existing reds (3 nudging
  snapshot fails predating this arc, readme-snippets) are the ONLY
  allowed reds — confirm via `git stash` A/B that this brief introduces
  none. Bundle ledger: this is pure logic in an existing file; if core
  grows past budget, add a dated rationale line in
  `scripts/check-bundle-size.mjs`, do NOT silently raise.

## Landing

- Commit LOCAL only to `docs/ai-agent-guide`. Do NOT push. Do NOT open a
  PR. (Standing owner instruction A32/A36.)
- Emit inline `kb log` atoms during the run (decision for the
  stub-insertion approach, gotcha for any port/anchor trap found) linked
  `--part-of` the plan IRI above.
- Write `/tmp/$WEAVER_JOB_ID-outcome.json` with commit sha + files
  changed + one-line summary.
