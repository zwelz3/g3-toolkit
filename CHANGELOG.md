# Changelog

## G3L Round 45: D3b part 1: elkjs LEFT THE TREE; scale freeze NAMED

- **elkjs is gone**: dependency removed, elk pipeline deleted from
  structural.ts (local types replace the import; dispatch is
  unconditionally g3t; engineKind and the injection seam retired
  from options and cache key), ElkLayout replaced by
  G3tLayeredLayout (the toolbar's hierarchical option now dogfoods
  the engine). QLT-002 bands assert against FROZEN elk baselines
  captured on the last two-engine run (re-baseline needs an owner
  ruling). Full test-estate disposition in the design doc: identity
  semantics for cache oracles, builder-level spacing oracles,
  empirical converter unpinning (55/59 held; 1 rewritten to the g3t
  contract, 3 retired with rationale), LAY-018 elk holds retired,
  PRF-001b elk leg retired with the historical numbers preserved.
  Core rebased 196 -> 192 (measured 187.3; the real relief is part
  2's extraction). PRF-001 = 199 ms on the container: green locally
  now. 1,351 tests.
- **The scale freeze is NAMED**: the owner's self-profile shows
  getArrayKind/addValueToProperties (React DEV-BUILD performance-
  track prop serialization) consuming ~10 s self-time. It explains
  the inverted scaling exactly: the clusters UGM embeds all 8,000
  memberships, drill embeds ~200 (17.6 s vs 3.3 s). Two ten-second
  owner experiments confirm (DevTools closed; pnpm build + preview,
  header already wired): prediction is production-clean, dev-only.
- Flip ratified in substance ("parity is achieved"); owner's
  layout/routing quality list lands as post-flip rounds.
- Answered: no demo uses SVG/Canvas as PRIMARY renderer; MBSE's
  dropdown mounts StructuralSvgView on selection, Style Lab's panes
  exist to exercise SvgAdapter/CanvasAdapter; the rest are
  Cytoscape-only.

## G3L Round 44: e2e GREEN; the scale block cornered; self-profiling attribution

- **e2e 58/58 (owner-run, local and CI): the drag/routing saga
  closes.** The truth-carried basis (rounds 42-43) held in the real
  browser.
- **The scale freeze is cornered but not yet named, and every
  headless suspect is now eliminated by direct measurement**: the
  owner's paste showed ONE 17,928 ms longtask starting at +142 ms
  (right after settled) on the clusters RETURN, and 3.3 s after
  drill's layoutstop: both fire after layout completes, and the
  bigger block belongs to the SMALLER view, so the cost does not
  scale with drawn elements. Measured against the real model:
  applyEncodingSpec over the clustered graph 1 ms; the toolbar's
  Fuse index 4 ms clustered / 84 ms over the full 8,000-node graph;
  headless cytoscape (styleEnabled) over the exact converted
  clusters elements: convert 2 ms, init 46 ms, style update 6 ms.
  The block is renderer-side or otherwise browser-only.
- (Recorded for honesty: the headless harness appeared to hang
  nondeterministically; staged runs showed all work completing in
  milliseconds with the PROCESS refusing to exit: a missing
  cy.destroy() leaves cytoscape timers holding the node event loop.
  An idle loop is the opposite of a busy 17.9 s main thread: harness
  artifact, not the bug.)
- **Shipped: JS Self-Profiling attribution.** The dev server sends
  Document-Policy: js-profiling (server + preview); the scale
  surface starts a 10 ms sampling profiler at every switch, stops
  it when the longtask watch retires, and prints the top-12
  self-time functions with file:line into the console block the
  owner already pastes. Degrades silently where unsupported. The
  next paste names the functions consuming the block.

## G3L Round 43: truth-carried drag basis; the integration oracle; scale watch extended

- **The remaining browser-only drag failures came from the last two
  places the drag path still trusted real cy over the writer**:
  capture read cy's live sourceEndpoint/targetEndpoint (compounds
  clip against the PADDED bbox, not the geometry box) and host
  sizing read cy's padded width/height. Both now come from truth
  carried in data: the converter stamps _geomBox ("x y w h") on
  every top-level structural node, and capture takes endpoints AND
  bends from _routePts (cy endpoints only as a legacy fallback).
  Sides derive against geometry boxes. Straight resolver results
  now write via the converter's 2-point degenerate doctrine at both
  drag sites (they previously went silent).
- **The missing verification layer exists now**: an INTEGRATION
  oracle drives the real satellite BDD through the real converter
  and the real grab/drag/free handlers with the e2e's exact
  choreography (+170/+90 in 8 steps, which drops smallsat
  OVERLAPPING imager: the owner's screenshot), then applies the
  e2e's own three assertions headlessly. The fake is HOSTILE by
  design: padded dimensions and corrupted live endpoints, so the
  test passes only through the truth path. This is the third
  hardening of the same lesson (plain-node pin round 39, stub
  oracle round 41): idealized fakes pass while browsers fail.
- Headless BDD reproduction confirmed the LAYOUT is clean (all four
  directions, no overlaps): the screenshot's overlap is the e2e's
  own post-drag drop position, legitimate free placement.
- **Scale**: the freeze-after-settled had nothing logged because
  the longtask watch disconnected AT settled. It now runs 15 s past
  settlement (offsets from the switch persist) and logs its own
  retirement, so post-settle blocks get named.

## G3L Round 42: absolute route points (the zigzag root cause); scale named or fixed

- **The MBSE zigzag edges ("odd non-90-deg angles", the trace's
  crossing list, and the weird post-drag routing are ONE root
  cause): the seg parameterization reconstructs bends against cy's
  LIVE endpoints, and for compound-attached edges (g3t: no eport
  point nodes) that basis differs from the writer's (compound
  bboxes include padding and derive from children, unlike the
  geometry boxes the converter clips against), skewing every bend
  into diagonals.** Fixed by removing reconstruction from the
  visual path entirely: routed edges carry ABSOLUTE points
  (_routePts) written by the converter, rendered verbatim by the
  overlay, rewritten each drag frame, canonicalized on settle, and
  restored verbatim on return-to-grab (MR-9). Seg data remains only
  for cy's suppressed hit-testable edge. Oracles: converter pin
  asserts _routePts equals the geometry route byte-for-byte; the
  drag oracle asserts rewrite-on-drag and verbatim restore.
- **Scale**: the owner's phase paste both FIXED and SPLIT the
  problem: return-to-clusters settles in 137 ms (fcose owned that
  hang; position cache works), but return-to-drill showed 2.8 s of
  rAF starvation AFTER preset-applied with relocation continuing
  past "settled". Shipped: preset restores snap (animate: false); a
  longtask observer logs every main-thread block >= 100 ms with its
  offset; a layoutstart listener names EVERY layout that runs (if a
  stray layout fires after preset, the log convicts it). The next
  paste attributes the block instead of us theorizing.

## G3L Round 41: drag reroute under g3t (the parity root cause); scale phases + cache

- **MR-8 drag reroute fixed for the g3t engine** (the e2e crossing
  list AND the owner's parity description: "routes to center of
  target, doesn't route orthogonally, strange bend angles" are ONE
  defect): the drag sync captured routed edges only via the host's
  eport point nodes, which the g3t engine does not emit, so
  compound-attached edges were never captured and stale seg data
  re-projected against the moving center-line. onGrab now has a
  host-attached capture pass: endpoints from cy's LIVE drawn
  anchors, sides derived from anchor-vs-box geometry, eport
  repositioning made optional and guarded at all three touch points
  (drag, return-to-grab restore, canonicalize). Stub-harness oracle
  pins capture, re-anchoring, and the throw-free MR-9 restore.
- **Scale surface, measured not theorized**: "clusters ready in
  91ms then the tab hung" exposed that markReady fires at cy INIT,
  before layout and post-ready effects. Phase markers now bracket
  cy-init -> layoutstop -> settled(idle), and a module-scope
  position cache mounts revisited views with the PRESET layout fed
  from settled positions: fcose never re-runs on returns (the
  owner's exact repro path), and first-visit hangs, if any remain,
  get named by the phase log. The clusters graph itself is 40
  nodes/370 edges (measured): scale of the view was never the
  cause.
- Trace instructions delivered: attach the retry trace.zip (plus
  error-context.md) directly to chat.

## G3L Round 40: the REAL overlay root cause (compound centers); scale perspective

- **The zero-overlay-paths bug had a second, deeper root cause and
  round 39's fix was insufficient**: the converter's projection
  basis reads drawn positions, but CONTAINERS are cy compounds with
  no explicit position, so the center lookup missed for every
  container-attached edge and the routed gate never entered. Under
  elk this path never ran (body edges attached to positioned synth
  POINT ports); removing synth ports exposed it. Centers now fall
  back to the geometry box's center. Headless replication of the
  exact e2e pipeline (default BDD, default engine): 5/5 edges earn
  the routed class (was 0/5), degenerate and multi-point alike.
- **Round 39's regression pin was too weak and is now hardened**:
  it used plain nodes (positioned point elements) and passed while
  the browser failed; it now uses compartmented CONTAINERS with a
  straight-chain edge AND a multi-point long edge, asserting all
  three route.
- Scale-surface finding recorded for the owner conversation: the
  scale example runs the UGM/fcose pipeline, NOT layoutStructural;
  WS-D never touched its switch path. Its own instrumentation
  ([scale] ready-in-ms console lines) is the agreed measurement
  protocol; options analysis in the owner queue.

## G3L Round 39: overlay-paths fix, CI verdict recorded, rulings executed

- **CI VERDICT (the arbiter ruled): perf job GREEN. PRF-001 = 159
  ms vs the 300 budget on the ruling machine: 47% margin.** Every
  asserting key green (frame-mbse 3.37, style 11.14/~0). The
  container-red was machine-class, as recorded.
- **The one e2e failure fixed at its root** (zero overlay paths on
  the MBSE shell, local + CI): Brandes-Koepf straightens chains so
  well that cross-aligned anchors dedupe the jog away and the g3t
  route is a legitimate 2-POINT STRAIGHT LINE, which the
  converter's elk-era >= 3 gate treated as "no route" (taxi), so
  nothing earned the routed class the overlay draws. Better
  placement was producing FEWER drawn edges. Contract evolved:
  2-point routes are routes, rendered straight via a degenerate
  on-baseline segment; the old keep-taxi oracle was rewritten to
  the new contract with the rationale inline, and a chain-fixture
  regression pin now guards it at the converter level.
- **Bench honesty**: PRF-001b's elk leg now requests elk explicitly
  (post-flip, {} defaults to g3t; the first post-flip CI artifact
  mislabeled a warm g3t run as "elk" at 196 ms). The stale
  elkjs-era PRF-001 finding string replaced with the post-flip
  truth.
- **Rulings executed**: core 196 RATIFIED (ledger updated); D3b
  pre-authorized in full (remove elkjs; no external imports to
  preserve; budget-rebase authority granted). Owner queue reduced
  to the e2e re-run and the browser ratification session, both on
  this tree.

## G3L Round 38: WS-D D3a: THE DEFAULT ENGINE IS g3t

- **The flip**: layoutStructural defaults to the in-house engine;
  elkjs stays selectable via engineKind: "elk" until D3b removes
  it. Everything the flip forced, in one round:
- **Scene routing** for the g3t path: layered gap routes with
  deterministic fanning, bbox-prefiltered verification, and grid
  escalation ONLY below the router's 64-obstacle threshold under an
  80 ms budget (the PRF-002 finding applied; channel router at
  D3b).
- **Direction support** (RIGHT/LEFT/DOWN/UP) with cross-extent
  separation and cross-aware sketch warm-start; the engine was
  vertically hardcoded before this.
- **Engine-agnostic caching**: engineKind + strategy options in the
  key; dedupe wraps the dispatch; routeEdges honesty (absent means
  absent). Generic cache oracles added.
- **Triage of all 15 flip failures**: elk-mechanics oracles pinned
  engineKind: "elk" with recorded rationale (retire at D3b);
  LAY-018 position-hold under g3t recorded against the collapse
  reintroduction; a new oracle pins the default-g3t converter path.
- **QLT-002 corpus bands assert**: g3t 3-6x tighter, ~2x shorter
  edges, 14-37% more crossings, within bands on all four fixtures.
- **PRF-001 asserts now** (milestone landed) after a perf pass:
  in-scan deadlines, frontier tree growth, incremental degrees,
  route-verify prefilter. Container ~353 ms (red locally at R1 on
  slow machines, stated plainly); CI projection 170-235 ms against
  the ruled 300 baseline. Next lever if CI disagrees: incremental
  cut values. frame-mbse 5.4 ms over g3t geometry (green).
- **Core budget BRIDGE raise 184 -> 196 (owner ratification
  pending)**: D3a's forced code (+8.3 KB) tripped a package at 99%.
  Raised per the ledger doctrine rather than holding the landed
  flip hostage; loudly flagged, revert is one line, and D3b's
  extraction + elkjs removal returns core far under the original
  envelope.
- Session-recovery note: several D3a improvements (threshold-guarded
  escalation, prefilter, converter pins, PRF budget-gate flip) were
  found already landed from the interrupted session; each was
  verified in place rather than re-derived, and redundant edit
  attempts were correctly refused by anchor asserts.

## G3L Round 37: WS-D D2b: network-simplex, Coffman-Graham, Brandes-Koepf

- **LAY-002 selectable layering pair**: network-simplex (tight
  spanning forest, per-pivot cut values, min-slack entering edges,
  4\*E pivot cap, and a 120 ms anytime budget: NS starts from the
  tightened longest-path and every pivot weakly reduces span, so
  best-so-far under any budget is valid and never worse than
  tight-tree) and Coffman-Graham (lexicographic labels,
  width-bounded sink-up fill). `layering` /
  `layerWidth` / `layeringBudgetMs` options; tight-tree stays
  selectable.
- **LAY-004 Brandes-Koepf**: four alignments, median blocks,
  two-pass size-aware compaction, middle-pair balance, final
  overlap resolution. Conflict marking is vacuous until LAY-005
  dummies land (recorded). BK costs 13.5 ms at R1 scale: the
  quality is nearly free.
- **Defaults are now network-simplex + brandes-koepf.** R1-flat:
  284 ms on the build container (~165 ms implied on the ruling CI
  machine; budget 300 with margin). Phase attribution recorded in
  the design doc; incremental cut values are the D3 optimization
  seam if CI disagrees.
- **Verification honesty**: the three new D2b oracles failed once
  on introduction and never again (details uncaptured, file
  unchanged, 12+ green runs since). A ten-seed property sweep (NS
  validity + span dominance, CG width + validity, BK separation,
  byte-determinism) now guards the nondeterminism class that flip
  could have indicated. Fourteen engine-suite tests.

## G3L Round 37: WS-D D2b: network-simplex, Coffman-Graham, Brandes-Koepf

- **Network-simplex layering** (LAY-002 default): tight spanning
  forest, per-pivot cut values, minimum-slack entering edges, and a
  TIME BUDGET (120 ms default) exploiting the algorithm's anytime
  property (every pivot preserves feasibility, so expiry returns a
  valid best-so-far layering). Oracle: total edge span never exceeds
  tight-tree's, its defining property. Debugging finding worth
  keeping: the pivot shift is MINUS the entering slack (the tail
  moves down); the plus-sign version corrupts ranks into
  infeasibility, caught by the validity oracle.
- **Coffman-Graham layering** (LAY-002 selectable): lexicographic
  labeling, width-bounded sink-up fill; oracle pins the bound and
  validity.
- **Brandes-Koepf placement** (LAY-004 default): four alignments,
  median blocks, size-aware compaction, narrowest-layout candidate
  alignment, middle-pair balance. Two corrections found by oracle:
  candidates must align left-by-min/right-by-max to the narrowest
  layout (uniform min-normalization bends chains), and there is NO
  claimed-upper guard (align[m] != m marks the block TAIL's
  back-pointer; the strict position bound alone prevents double
  claims). Pinned guarantee: all-candidate-agreement segments exact,
  pure paths pixel-straight; conflict marking activates when
  LAY-005 dummies land.
- **Speed class held under the new defaults**: flat R1 303.5 ms on
  the slow container (same-run elkjs 14,902 ms), projecting ~180 ms
  on CI against the 300 ms flip gate. 13 engine oracles; 401 core
  tests.

## G3L Round 36: WS-D D2a: structural inputs in-house (containment, ports, sketch)

- **Containment pre-pass by REUSE, not reimplementation:** the g3t
  structural path calls buildStructuralElkGraph for measurement and
  sizing (same text metrics, same row plans, same header height,
  same port-side policy), so the two engines share one definition of
  what a container IS and differ only in where boxes land. Emission
  stacks rows exactly as the elk container layout does; the closure
  oracle pins header + rows equal to the container height to 1e-5.
- **Declared ports** emit evenly spaced on their declared side
  (border-centered, oracle-pinned both sides).
- **Sketch warm-start = the INTERACTIVE semantics by construction:**
  layer order initialized from prior x through a new initialOrder
  seam on orderLayers, ONE refinement sweep, placement seeded from
  prior positions; a reversed sketch order survives (oracle).
- **The seam now routes ALL g3t-requested inputs in-house** (the D1
  container fallback is gone); default remains elk until D3. Ten
  engine-suite oracles; 398 core tests green.
- D2b remains: LAY-002's selectable layering pair and LAY-004
  Brandes-Koepf placement.

## G3L Round 35: WS-D D1: the g3t layered engine, flat graphs end-to-end

- **The engine** (packages/core/src/layout/g3t-engine): greedy
  Eades-Lin-Smyth cycle removal, tightened longest-path layering
  (network-simplex's tight-tree phase; full pivoting and
  Coffman-Graham land in D2 per the recorded deviation), BUDGETED
  barycenter + transpose crossing minimization with early exit and
  best-so-far return (the design's load-bearing decision), iterative
  median placement with overlap resolution (Brandes-Koepf in D2),
  deterministic emission. No edge routing by design. House rule
  honored: zero non-null assertions in source (guarded accessor).
- **The seam**: `engineKind: "elk" | "g3t"` on layoutStructural
  (named to avoid the existing ElkEngine-instance `engine` option);
  D1 routes only FLAT inputs to the g3t engine, container inputs
  fall back to elk, oracle-pinned both ways. Default unchanged
  until D3.
- **FIRST NUMBERS: flat R1 in 103.8 ms vs elkjs 11,127 ms (107x),
  already UNDER the 300 ms budget on the build container.** The
  crossing-budget bet is empirically vindicated end-to-end.
  Dual-engine PRF-001b measurement added (report-only; the frozen
  PRF-001 key still gates at the engine flip).
- **QLT-002 harness first light**: both engines over shared flat
  fixtures with side-by-side metrics (g3t 5.6x tighter area, 2.4x
  shorter mean edges vs elk defaults; directional until crossings
  and bands land). Seven engine oracles: DAG-ness, layering
  validity, crossings monotonicity + budget cap, no overlaps,
  byte determinism, seam both ways.

## G3L Round 34: MR-5 FROZEN on CI numbers; wheel isolation fixed

- **MR-5 CLOSED, budgets FROZEN** on the first CI-baseline run:
  frame reroute 3.12 ms (8 budget), full R2 style 12.91 ms (100),
  incremental ~0 ms (2): all MEET and now ASSERT in CI. The one
  permitted revision restructured budgets by ACCOUNTABILITY: keys
  whose component is a scheduled milestone keep their spec targets
  and begin asserting when the component lands (PRF-001 at the WS-D
  engine flip; R1-scale routing at the channel router), encoded
  machine-readably ("asserts" gates) and enforced by the harness.
  The perf job is a live gate from this round.
- **Wheel isolation fixed** (owner: SVG-mode wheel "zooms the
  overall application shell and the graph view unreliably"): React
  attaches wheel listeners PASSIVELY at the root, so a React
  onWheel cannot preventDefault and the page scrolled the shell
  while the graph zoomed. The zoom now binds as a NATIVE
  non-passive listener that preventDefaults; a regression oracle
  dispatches a cancelable WheelEvent and asserts defaultPrevented.

## G3L Round 33: MBSE SVG preview: zoom crash, node drag, fill-the-host

- **Zoom crash fixed** (owner: "breaks the entire front-end"):
  onWheel read e.currentTarget inside the deferred setView updater;
  React nulls currentTarget after the handler returns, so the
  updater threw and unmounted the tree. Event-derived values are
  captured before the updater now; regression-tested through the
  deferred path.
- **Hit-aware dragging**: pointer-down resolves through RND-006:
  node body/header grabs drag the node (rendered via an offset map;
  rows and ports ride their owner; the node's edges drop their
  stale routes for MARKED straight fallbacks until RTE-011 wires
  live rerouting); anything else pans. Oracle pins node-moves,
  view-holds, fallback-marked, background-pans.
- **Fill-the-host sizing**: the preview was hard-coded 960x560
  inside a full-bleed host; a ResizeObserver wrapper now sizes it
  to the pane like the cy renderer.
- CI: see the round-32 note; workflow_dispatch only appears in the
  Actions UI once the workflow file with that trigger reaches the
  DEFAULT branch, which is why the branch could not be dispatched;
  the tree-replacement branch from main resolves both dispatch and
  the "nothing to compare" PR state.

## G3L Round 32: owner batch executed (rulings, MR-11 fixes, CI dispatch)

- **e2e 57/58 in the owner's browser**; the one failure was a missed
  combobox selector in overlay-acceptance (a third
  getByRole("combobox") the round-30 re-scope did not catch); fixed.
- **MBSE renderer dropdown fixed** (real bug the passing e2e
  masked): `.mbse-canvas-wrap > *` absolutized every direct child,
  burying the toolbar under the full-bleed canvas; programmatic
  selectOption bypasses pointer occlusion, a human cannot. Toolbar
  now sits outside a dedicated absolutized canvas host.
- **Canvas gradient-taper fixed** (owner: "edge color missing"):
  taper ops now carry the edge gradient like SVG's taper polygon
  carries the stroke paint; pinned by a new gradient-taper parity
  fact in the ARC-008 conformance suite.
- **Label readability**: the Style Lab merge defaults a dark label
  halo (cy panes outline labels; the adapters only halo on
  request). Canvas pane now captions its static pulse (declared
  stage-1 capability) instead of leaving the owner guessing.
- **Rulings executed**: react budget 420 -> 440 (owner-approved;
  ledgered as the bridge until the ARC-009 extraction); MR-4 CLOSED
  per owner ruling with gate references removed from the queue,
  STATUS, WS-D design, implementation-plan risk table, and
  LIC-003's gating clause (historical CHANGELOG/snapshot text left
  as records); WS-D APPROVED with decisions recorded (router as a
  MODULE of @g3t/layout; NO deprecation window, no external
  adopters). D1 is unblocked.
- **CI**: workflow_dispatch trigger added so any branch can run CI
  manually; pull_request against main already triggers.

## G3L Round 31: RND-006 hit testing + INT-001 uniform pointer events

- **Pure hit testing in CORE** (packages/core/src/hit): placed
  deliberately per ARC-009 (geometry consumable with no rendering
  package; core had headroom, react did not). `hitTestScene`
  resolves the topmost element by paint order with zone detail
  (shape-aware bodies for all seven shapes, glyph zones outranking
  bodies with the slot named, width-aware edge-segment tolerance).
  `hitTestStructural` resolves container header vs body vs border
  bands, rows outranking container fills, ports outranking
  everything, and routed polyline segments. Hits derive from the
  SAME scene data the adapters draw, so hit truth cannot drift from
  paint truth. Eight oracles.
- **INT-001 uniform pointer events**
  (packages/react/src/interaction/element-pointer-events.ts): one
  hook (click/down/up/context/enter/leave with zone info); the
  three components differ only in hit function and client-to-model
  transform (identity for the flat adapters; the inverse view
  transform for the structural view, where pan/zoom handlers
  compose with element events rather than fight them). Swapping
  renderers no longer touches interaction code: ARC-008 extended to
  input. Five dispatch oracles, including enter/leave keying and
  the transform-aware structural case.
- **BUDGET FLAG:** @g3t/react is at 417.2/420 KB (99%). Not raised
  unilaterally; the ARC-009 extraction (render adapters leaving
  @g3t/react) is the structural relief, and no react growth is
  planned before it. One word from the owner raises it with a
  ledger entry if preferred.

## G3L Round 30: F2 stage 1 (Canvas 2D adapter) + the ARC-008 conformance suite

- **Display-list Canvas adapter**
  (packages/react/src/views/canvas2d): `buildDisplayList` is PURE
  and consumes the IDENTICAL scene contract the SVG adapter
  consumes (same nodes/edges/VisualAttributes); the CanvasAdapter
  component merely replays ops onto a 2D context with
  devicePixelRatio scaling. Purity is what makes canvas conformance
  headless. Stage 2 of RND-004 (bitmap caching with partial
  invalidation, viewport snapshot transforms, interaction-time
  simplification) is explicitly deferred, not dropped.
- **ARC-008 conformance suite**
  (views/conformance/adapter-conformance.test.tsx): one shared
  fixture scene, one table of semantic facts (halo, pulse marking,
  donut arc count, glyph texts, taper, dashed edges, LOD label
  visibility), per-adapter probes (DOM for SVG, ops for canvas). A
  future WebGL adapter joins by adding a probe, not new facts.
  CAPABILITY HONESTY is itself tested: canvas declares pulse
  "static" and the suite verifies the halo draws while nothing
  animates; SVG's animated claim is verified symmetrically.
- **Style Lab third pane** gained an Adapter select (SVG F1 |
  Canvas 2D F2) over the same harvested scene and attribute maps;
  e2e asserts the canvas mounts with a non-empty display list. The
  LOD select gained a scoped testid (the new select made
  role-based selection ambiguous; three jsdom probes and the e2e
  spec re-scoped).

## G3L Round 29: WS-D design doc written; at owner review

- **planning/g3l/ws-d-design.md**: the in-house layered engine
  design, written against the sharpened measurement (crossing
  minimization as THE budgeted phase, with an explicit ms cap and
  best-so-far return: PRF-001 met by construction, quality moved to
  QLT-002 bands where it belongs) and the spec's phase mandates
  (LAY-001..006, including the recorded patent-avoidance posture).
  Covers the engine seam (options.engine, default unchanged until
  the flip), the QLT-002 two-engine conformance harness over
  IOP-001 fixture documents, the ARC-009 packaging execution
  (@g3t/layout extraction; core budget returns under its original
  envelope; elkjs exits at D3), per-phase performance budgets
  summing to 300 ms, and a three-stage migration in which every
  stage is gate-green shippable.
- Owner queue: WS-D design review added as item 1 (two decisions
  left open: route packaging, deprecation window).

## G3L Round 28: PRF-001 sharpened; LAY-020 shipped

**Part 1: PRF-001 measurement sharpening (owner-approved plan).**
Matrix at tests/perf/prf001-matrix.perf.test.ts (G3T_PERF_MATRIX=1,
kept out of the recurring CI gate); record and interpretation at
planning/g3l/prf-001-measurement.md. The caveats resolved AGAINST
elkjs: warm cost 12.6 s (init explained only ~3.8 s of cold 16.4);
assembly 4.3 ms (99.97% of cost inside elk.layout); crossing
minimization (LAYER_SWEEP) is the dominant term at ~9 of the 12.6
warm seconds (INTERACTIVE runs 3.5x faster); even the maximally
detuned combo (POLYLINE + SIMPLE + INTERACTIVE) is 2.2 s, still
~2.5x over the 300 ms target granting CI a generous 3x, WITH
degraded quality. WS-D's performance case is now specific: the
in-house engine wins or loses PRF-001 on its crossing-minimization
strategy. Sketch-mode re-layouts already run in the INTERACTIVE
class (the fast one).

**Part 2: LAY-020 change-set-driven layout.**
`layoutStructuralWithChangeSet` (packages/core/src/layout/
change-driven-layout.ts) consumes a MOD-010 change set and reports
which mode ran, per spec:

- LOCAL mode (local diffs per affectedRegion + added nodes): the
  region lays out as a SUBGRAPH, translates to the region's previous
  anchor (only-new regions append beyond the scene, never overlap),
  and splices: every non-region node/port entry carries over
  VERBATIM (oracle-pinned by OBJECT IDENTITY, not coordinate
  comparison); region-internal edges take translated fresh routes;
  boundary-crossing edges lose stale routes and are listed in
  `rerouteEdges` for the interactive router (RTE-011's fast class).
- GLOBAL-SKETCH fallback (container-touching or above-threshold
  diffs): full layout seeded with all surviving top-level prior
  positions, which runs in the INTERACTIVE strategy class the
  sharpening just measured at 3.5x cheaper.
- Five oracles: verbatim carryover + reroute reporting, added-node
  regioning, removal cascades, container fallback, threshold
  fallback.

## G3L Round 27: E2 shipped (IOP-001 graph document + IOP-002 ELK import)

- **Versioned graph document** (IOP-001;
  packages/core/src/model/graph-document.ts): the interchange
  format: topology WITH hierarchy (parent refs), ports with side
  hints, domain data, layout-option passthrough, style refs, and an
  optional geometry snapshot. Published JSON Schema
  (GRAPH_DOCUMENT_SCHEMA, draft 2020-12); validation diagnostics
  (duplicates, unknown parents, parent cycles, dangling endpoints,
  foreign ports); the spec's round-trip guarantee oracle-pinned
  (parse of serialize is deep-equal).
- **`toStructuralInput`**: the honest projection down to the
  structural pipeline: arbitrary hierarchy FLATTENS with a
  HIERARCHY_FLATTENED diagnostic per nested node (the structural
  model's containment is compartments, not nesting); ports and edge
  port refs survive.
- **ELK JSON import** (IOP-002; elk-import.ts): lossless for the
  topology/ports subset: child hierarchy becomes parent refs, ELK
  port-side options become document sides, labels and layoutOptions
  pass through verbatim, port-referencing edge endpoints resolve to
  owning node + port ref. Hyperedges import first endpoints WITH a
  diagnostic; routing sections are outside the subset and diagnosed,
  never silently dropped. The division of labor is what makes
  "lossless" true: the DOCUMENT holds everything ELK topology
  expresses; only the structural PROJECTION is lossy, and it says
  so.
- Seven new oracles (fifteen total in model/): round trip,
  validation codes, junk/version rejection, schema surface,
  projection honesty, lossless import, hyperedge/section diagnosis.

## G3L Round 26: WS-E begins: the change-set API (MOD-010)

- **`applyChangeSet`** (packages/core/src/model): the WRITE
  interface to a structural graph. Transactional add/remove/update
  batches producing the next input AND an exact structural diff by
  construction (the artifact LAY-020 incremental layout and RTE-011
  incremental routing are specified against; the existing diff/
  module reconstructs a diff from two snapshots after the fact, this
  is the forward path). Pure; cascades explicit (removing a node
  removes incident edges, RECORDED as cascadeRemovedEdges);
  diagnostics instead of throws (unknown ids, duplicates, dangling
  endpoints, removed-and-updated conflicts), with the valid
  remainder still applying; remove-plus-re-add of one id in one
  transaction is legal and reported as both.
- **`invertChangeSet`**: the undo set; applying the inverse to the
  after state restores the before state exactly, cascade
  restorations included (oracle-pinned round trip).
- **`affectedRegion`**: the LAY-020 locality seed: touched elements
  plus one-hop neighborhood; container-touching or above-threshold
  diffs report non-local (fall back to global sketch mode).
- **Versioned wire format** (IOP-001 alignment):
  serializeChangeSet/parseChangeSet with validation.
- Eight oracles: transaction semantics, cascade recording,
  per-entry diagnostics with valid-remainder application,
  remove-re-add, inversion round trip, locality both ways, wire
  round trip with junk rejection.

## G3L Round 25: F1 structural slice (the geometry document rendered through pure SVG)

- **`StructuralSvgView`** (packages/react/src/views/svg): renders
  the renderer-neutral StructuralGeometry document VERBATIM:
  containers with header strips and stereotyped titles, compartment
  rows (divider titles styled), plain nodes, boundary ports, and
  routed edge polylines with arrow-trimmed shafts, UML relationship
  symbols, dashing, and mid-edge labels. Arrow geometry REUSES the
  overlay's arrowShapes/shortenPolyline/isDashedKind, so the two
  rendering paths cannot drift on relationship semantics.
  Transform-only wheel-zoom (about the pointer) and drag-pan on the
  scene group (the MR-2-validated pattern); fit-to-content initial
  viewport with the documented adjust-state-during-render reset.
- **Where the cy path needed five browser reviews, this one is
  verified in jsdom:** five conformance oracles pin document
  coordinates, header strip height, row text and divider styling,
  shaft trim + filled composition diamond + mid label, port boxes,
  and dependency dashing. 14 SVG-family tests total.
- **MBSE Workbench renderer toggle** (Cytoscape default | SVG
  preview): the live comparison surface; all existing e2e hooks bind
  to the default. Browser test asserts drawn container count equals
  the geometry document's, routed edges and arrows present, and the
  toggle restores the cy canvas. e2e suite: 58 tests / 11 files.
- MR-11 re-review scope extended to include a first look at the
  structural preview.

## G3L Round 24: MR-5 executed (PRF harness + CI job); three architectural findings quantified

- **PRF benchmark harness** (tests/perf; env-gated G3T_PERF=1 so
  normal runs are untouched): seeded deterministic R1/R2 fixtures
  per spec section 14; report-only while
  planning/g3l/prf-budgets.json is "provisional", asserted once
  "frozen" (the ruled one-revision-then-freeze protocol encoded in
  the harness itself). CI perf job runs it on the ruled baseline
  (the CI runner class) and uploads the results artifact.
- **Findings, quantified** (container shakedown; CI produces the
  ruling numbers): PRF-001 R1 layout via elkjs at ~11-17 s vs the
  300 ms target is the numeric case for WS-D's in-house engine;
  PRF-002 from-scratch R1 routing extrapolates to minutes: the
  sparse-grid router is the INTERACTIVE router, and from-scratch
  scene routing belongs to the channel-router milestone; PRF-002
  incremental MEETS its 8 ms budget at production scene scale
  (~3.6-4.8 ms: today's shipped drag feel), degrading only at R1
  scale. PRF-004 style resolution meets both budgets with wide
  margin.
- **Router: prune-verify-fallback** landed from the first finding:
  above 64 obstacles the router routes against the terminals'
  region, VERIFIES against the full set, and falls back unpruned on
  any violation (correctness by construction; unit-pinned with a
  300-obstacle noise-plus-wall oracle).
- resolveDragAttachment exported from @g3t/react (the bench measures
  the production drag policy, not a copy).

## G3L Round 23: first 100% e2e run; four owner rulings executed

- **MILESTONE: the owner's e2e run went 57/57 green**, the first
  fully green browser run of the engagement, including the MR-9
  round-trip pin via the closed-loop return.
- **T2 ruling "archive don't delete" EXECUTED:** 38 symbols across
  six clusters left the public barrel; modules and tests remain in
  the tree and keep running (no rot, no deletion). Registry with the
  verbatim restore procedure: packages/core/ARCHIVE.md. Core dist
  147.6 -> 136.7 KB (74% of budget; 177.6 at the start of the
  dead-code effort, cumulative -40.9 KB).
- **MR-9 CLOSED** on the owner's verdict ("routing isn't perfect but
  it seems largely stable", recorded verbatim); residual polish
  lives in MR-10 (P2).
- **MR-5 RULED:** the CI runner class is the PRF baseline. The
  remaining work (D1 metrics + layout bench harness over R1/R2
  fixtures, CI job, one permitted re-baseline, freeze) is
  engineering, no longer owner-blocked.
- **MR-11 first-look verdict addressed:** the F1 pane hard-coded a
  white canvas inside the dark app shell; it now inherits the shell
  exactly like the cy panes, and the shell's merge supplies
  dark-readable default label ink. MR-11 moves to re-review.
- **Owner queue** updated to two open items (MR-11 re-review, MR-4
  FTO); resolved entries recorded and removed per the maintenance
  contract.

## G3L Round 22: F1 label gap fixed; owner queue established

- **F1 e2e failure root-caused** (the only red in an otherwise green
  run; the MR-9 round-trip pin now PASSES via the closed-loop
  return): the F1 pane rendered zero labels because label TEXT rides
  element data in the cy panes (label: data(label)) while the
  engine's resolved attributes carry label STYLING only; the adapter
  renders attributes only, by design. The shell now harvests the
  data-derived text at engine-ready and merges it into the F1
  attribute maps (both the initial and the LOD-tiered set), the same
  division of labor cytoscape's data mapping performs. LOD label
  hiding still works: labelVisible false wins over merged text.
- **Owner queue established** (owner-requested):
  planning/g3l/owner-queue.md is now the single list of items
  blocked on the owner: one entry per item with the exact ask, the
  concrete steps, and what it unblocks (currently: T2 rulings, MR-9
  review, MR-11 review, MR-4 FTO routing, MR-5 baseline decision).
  Linked from STATUS.md and the MR log index; maintained every
  round. The MR-5 entry was corrected against what the log actually
  mandates (one decision from the owner; execution comes back for
  sign-off).

## G3L Round 21: dead-code analysis; -49 KB of budget recovered; MR log audited

- **Analysis** (planning/g3l/dead-code-analysis.md): zero orphan
  modules; heavy deps all load-bearing and external to dist;
  near-zero true dead code. The repo's slack was (a) dist comments
  (~14% of shipped bytes, not consumer surface) and (b)
  unreferenced-but-TESTED public surface, which is an API-scope
  ruling, not a cleanup.
- **Recovered without functionality change:** dist comment-stripping
  pass (sourcemaps still ship, code layout preserved) plus 20
  internal helpers demoted from the core barrel (no consumer outside
  core; tests import relatively and stay green). core 177.6 -> 147.6
  KB (97% -> 80% of budget); react 416.8 -> 397.8 KB (99% -> 95%).
  The react budget-watch flag from round 20 is resolved.
- **T2 ruling table** (in the analysis doc): six clusters of
  delivered, tested, in-repo-unreferenced feature surface worth
  ~24 KB, each awaiting a per-cluster owner ruling; recommendations
  included (KEEP the SHACL/PROV-O clusters; DEFER incremental layout
  to WS-D; Gremlin/REST middleware and style-config JSON are the
  real byte candidates).
- **MR documentation audit** (owner-requested): index table added;
  two stale statuses corrected in place with audit notes (MR-7 had
  passed in live runs; MR-8 was owner-accepted); MR-9 heading now
  records the owner's explicit hold.

## G3L Round 20: F1 lands (SVG renderer adapter, G3L:RND-001)

- **`SvgAdapter`** (packages/react/src/views/svg): pure
  presentational renderer of resolved VisualAttributes: every
  channel the Cytoscape bypass projection reports as unsupported now
  renders natively: halo rings (with pulse as a reduced-motion-aware
  CSS animation), boundary-slot glyphs with truncation, donut
  fraction arcs (circumference dasharray with cumulative rotation),
  taper quadrilaterals (Holten/van Wijk direction encoding),
  content-keyed shared gradient defs, and label halos via SVG's
  native paint-order stroke. All seven NodeShape silhouettes; edges
  trim to silhouettes rather than centers.
- **Fully headless-verifiable, unlike the cy path:** SVG needs no
  canvas, so nine conformance oracles assert RENDERED STRUCTURE
  through jsdom (halo color/width/pulse-class gating, glyph slots
  and truncation, donut arc counts, taper geometry, gradient def
  sharing, paint-order label halos, labelVisible drops, silhouette
  trims) alongside the pure geometry helpers.
- **Style Lab third pane:** positions harvested from the engine cy
  (three geometrically comparable panes) and the SAME tiered
  attribute map, so the LOD dropdown drives the engine bypasses and
  the F1 SVG identically. Fixture gains donut, pulse, and gradient
  rules: the engine-only zone now exercises the complete decoration
  set. Browser acceptance extended (decorations attached, gradient
  def resolves, LOD hides and restores SVG labels).
- MR-11 queued for owner review (three-pane look, LOD coupling,
  reduced-motion pulse). e2e suite: 57 tests / 11 files.
- **Budget watch:** @g3t/react lands at 99% (416.8/420 KB) after the
  adapter's ~10 KB. The next F1 slice (structural-view SVG path)
  will need either a documented raise or the ARC-009 extraction
  conversation; flagged here so it is a decision, not a surprise.

## G3L Round 19: MR-9 pin goes closed-loop; the 1/6 gesture anomaly recorded as data

- Two falsified theories now stand as recorded facts: the symmetric
  programmatic gesture deterministically lands the dragged node at
  EXACTLY 5/6 of its return distance (steps: 6), and a 100ms settle
  does NOT recover the missing sixth (it was never a pending
  sample). The anomaly is real, deterministic, and unexplained; the
  pin now carries drag-event telemetry (event count in the failure
  message) so any future look starts from data.
- The pin's JOB is the restore contract, not input-pipeline
  forensics, so its return leg is now CLOSED-LOOP: measure the
  node's residual offset in model space, convert to page space via
  the live zoom, nudge, re-measure, up to four corrections, then
  release inside the restore band. This tests exactly what MR-9
  mandates (verbatim restore on return-to-grab) while being robust
  to whatever the pipeline does with atomic synthetic gestures.
- Human drags are unaffected throughout: real releases decelerate
  and land where the human puts them; the anomaly only manifests
  under atomic synthetic input.

## G3L Round 18 (== Round 17 + its four addenda; no new engineering)

Packaging round only. The round-17 zip was refreshed IN PLACE four
times under one filename as the MR-9 pin diagnosis progressed
(verbatim restore; premise check; onFree host-derivation; diagnostic
trace; settle-before-release), which made it impossible for the
owner to know the artifact had changed: two debugging round trips
were spent running stale specs. Process rule adopted: every content
change ships under a NEW artifact name. Round 18 is the current
tree, verbatim.

## G3L Round 17 addendum 4: root cause found in the trace (5/6 signature); spec settles before release

The diagnostic trace localized it in one run: outbound applied
exactly (drag delta matched page delta / zoom to 0.3px); the return
leg applied exactly 5/6 of its distance on BOTH axes with steps: 6;
after-release equals before-release (settle/restore exonerated;
grabbed=[smallsat] confirms targeting). Signature: a one-frame
store-then-apply drag pipeline whose final pending sample is
cancelled by mouseup. Real releases decelerate, so the lost sample
is sub-pixel for humans; the pin's atomic gesture now waits 100ms
after the return move before releasing, letting the final sample
apply, after which the node lands inside the 8px restore band and
the verbatim restore produces an exact match.

## G3L Round 17 addendum 3: premise confirmed (node does not return); full trace instrumented

Third run's premise check NAMED the class: the dragged node ends
50.5px from its start under a net-zero mouse gesture, so the defect
is in the drag mechanics (cytoscape compound behavior, grab
targeting, or an interaction with the per-frame eport writes), not
in the settle/restore path. The pin now captures a full diagnostic
trace into its failure message: which element(s) cytoscape grabbed,
the zoom, and the node position at four checkpoints (start,
after-outbound, after-return-before-release, after-release), so the
next run localizes where symmetry breaks in one shot.

## G3L Round 17 addendum 2: stale-tree diagnosis FALSIFIED; onFree host-mismatch class removed

The owner's grep proved the round-17 fix present in the failing
tree, falsifying the stale-tree diagnosis (the bit-identical float
has a mundane explanation: the canonicalization path is
deterministic, so identical inputs reproduce identical deltas on any
round's code). Corrected conclusion: the RESTORE PATH DID NOT
EXECUTE. One candidate class removed statically: onFree returned
early when the free event's target id differed from the session
host (possible on compound scenes), silently leaving LAST-FRAME drag
history in the seg data, itself a settle-contract violation. onFree
now derives geometry from the session host via cy.$id and never
skips settle while a session exists. The remaining class (node not
back within the 8px band) is what the pin's premise check names on
the next run.

## G3L Round 17 addendum: round-trip pin self-diagnoses its premise

The re-reported 76px failure carried the BIT-IDENTICAL float from the
pre-fix run, which the verbatim restore makes mechanically impossible
(a fired restore writes the grab-time raw strings back untouched:
delta exactly 0); the run almost certainly executed the round-16
tree. Regardless, the pin now verifies its own premise before
asserting: the node must be back within the 8px restore band of its
grab position, with a named failure message otherwise, so any future
failure states WHICH defect it is (node-did-not-return vs
restore-is-wrong) instead of requiring float forensics.

## G3L Round 17: MR-9 pin fixed (verbatim restore); MR-10 flagged; F1 begins next

- **MR-9 browser-pin failure (76px) root-caused and fixed:** the
  return-to-grab restore RECONSTRUCTED seg data through
  routeToSegments(segmentsToPoints(...)), which is exact only when
  the parameterization endpoints match the original writer's
  conventions; the browser proved they can differ. RoutedCapture now
  carries the grab-time RAW `_segDist`/`_segWeight` strings and the
  restore writes them back VERBATIM: the pre-drag truth, untouched.
- **MR-10 flagged (P2, owner notes):** two during-drag live-feel
  observations (attach point not fully tracking until release;
  source/target asymmetry in during-drag repositioning), recorded
  with warm-start suspects in the MR log. Settle-time behavior is
  correct and accepted ("much better and closer to predictable").

## G3L Round 16: MR-9 shipped (settled routes are a pure function of settled positions)

- **Canonicalize-on-dragfree:** on release, every routed edge of the
  dragged node is re-derived from FINAL geometry alone:
  `canonicalSide` (pure relative geometry, no hysteresis,
  deterministic diagonal ties), canonical bundle anchors via
  distributeFaceAnchors, and router bends via the candidate-face
  policy; the rescale path and its captured-bend history are not
  consulted at settle time. History-dependence is thereby confined to
  DURING the drag, where the hysteresis exists on purpose.
- **Return-to-grab restore:** releasing within 8px of the grab point
  restores the grab baseline exactly (box, ports, eports, seg data),
  so the settled state at the layout's own positions remains ELK's
  original routes and a single-gesture wiggle is a perfect identity.
- **Pinned three ways:** a two-paths-one-result unit oracle (same
  final position reached via different drag paths writes identical
  seg data), a return-restore unit oracle, and the browser pin the
  MR-9 flag mandated (out-and-back gesture; numeric seg comparison
  against pre-drag). e2e suite: 56 tests / 11 files.

## G3L Round 15 addendum (2026-07-11): MR-8 accepted "good enough for now"; MR-9 flagged

Owner verdict recorded on the round-15 routing stack: good enough for
now. New finding FLAGGED as MR-9 (P1, next round): right-then-left
drags are not round-trip idempotent (session-boundary state capture
and face hysteresis are the warm-start suspects; the candidate
contract is canonicalize-on-dragfree so settled routes are a pure
function of settled positions; details and a mandated browser pin in
the MR log).

## G3L Round 15: hygiene culprit named and fixed; face retry; bundling; stub buffer

- **Console hygiene root-caused by the instrumented assertion** (the
  round-14 instrumentation did its job): the cytoscape
  mapping-warning class on `label: data(_label)` over the base
  structural-edge selector, warned once per UNLABELED edge per style
  recalc. Fixed with the `[_label]`-scoped selector (cytoscape's own
  suggested remedy), the same flood class the flagship saga hit on a
  different field.
- **"c.adcs crosses imager" root-caused:** the desired face's stub
  was sealed in by a neighbor, the router returned null, and the
  fallback was UNCHECKED. New `resolveDragAttachment` policy: rescale
  when clear, then the router over CANDIDATE FACES (desired,
  original, remaining two) before any unchecked fallback; the chosen
  face travels back so the eport lands where the route actually
  anchors. Unit-pinned with a sealed-face fixture asserting a clear
  route via another face. `resolveDragRoute` remains the bends-only
  surface the flipped round-1 oracles pin.
- **Owner refinement 1 (bundle-aware anchors):** migrated edges
  sharing a face previously ALL anchored at the face center, which
  was the observed "grouping then breaking back out" mechanism.
  `distributeFaceAnchors` spreads them across the middle 70% of the
  face, ordered by the other endpoint's cross-axis coordinate
  (deterministic; lanes never swap mid-drag); riding (same-side)
  edges keep ELK's port spread.
- **Owner refinement 2 (pre-bend buffer):** the router's terminal
  stubs are now minimum 28px (degrading gracefully toward clearance
  when a long stub would land inside a neighbor's inflated box), so
  UML relationship symbols sit on a straight run before the first
  bend. Two router unit tests pin the buffer and the degradation.

## G3L Round 14: 4-way attach-side selection; second e2e triage

- **Attach-side refinement (MR-8 second pass):** `migratedSide` is
  now 4-way with hysteresis: the attach face rotates to the
  perpendicular axis when the other endpoint is decisively beyond
  that extent (the owner's case: EAST attachment with every connected
  block BELOW now attaches SOUTH); diagonals without a decisive
  margin hold the current axis so faces never flap mid-drag. Two pins
  evolved with rationale in place: the rescale-mechanics fixture
  re-sided so it keeps testing rescale, and the axis-preservation pin
  (up-and-over shape protection) overturned by the owner's live
  ruling and rewritten to the 4-way contract including the owner's
  scenario verbatim.
- **e2e triage (3 fails):** two shared one root cause found in the
  overlay SOURCE, not the specs' logic: the drawn path d is the
  ARROW-TRIMMED shaft, so terminal coordinates sit an arrow-length
  short of the true anchors. The overlay now publishes
  data-route-start/data-route-end (true untrimmed anchors) and both
  the projection and drag-reroute specs read those for border-band
  checks (crossing checks still parse d, where trimming is
  conservative). The third failure (MBSE console hygiene) carried no
  error body in the saved report; the assertion now embeds the
  collected console messages in the failure text so the next run
  names the culprit unconditionally.

## G3L Round 13: B4/B5 shipped (obstacle-aware drag rerouting, G3L:RTE-011)

- **Core router** (`packages/core/src/route/orthogonal-router.ts`,
  +6.4 KB): orthogonal obstacle-aware routing via the classic sparse
  visibility grid + A\* with a bend penalty (independent
  implementation from the published connector-routing literature;
  deliberately distinct from the three surveyed patents; no libavoid
  code, which stays rejected on LGPL grounds). Border anchors with
  perpendicular exit stubs are the MR-8(a) contract by construction;
  deterministic via an insertion-order tiebreak; returns null when
  sealed off (callers keep their previous behavior). Six unit
  oracles: clearance, perpendicular terminals, straight unobstructed
  lines, channel threading, sealed-target null, determinism.
- **Drag-route policy** (`resolveDragRoute`, exported and pure): a
  same-side drag first tries the cheap rescale, PRESERVING ELK's
  route shape (the user's mental map); if the reshaped polyline
  crosses any obstacle (`polylineIntersectsBoxes`, core) or the
  attachment migrated sides, the router produces fresh bends. Wired
  into `wireStructuralPortDrag`: obstacles captured once per drag
  session (all top-level boxes, host refreshed per frame; endpoint
  boxes stay in the set deliberately, since an edge must not cut
  through its own endpoints and anchors sit legally ON inflated
  borders).
- **The round-1 acceptance change executed:** both expected-fail drag
  oracles FLIPPED to plain tests running the production policy; the
  suite now has ZERO expected-fails. One fixture corrected at flip
  time and documented in place: the original mixed-attachment pin put
  the moved endpoint INSIDE the obstacle, geometrically
  unsatisfiable, masked by the it.fails marker (lesson: expected-fail
  pins need a satisfiability argument when authored).
- **MR-8 browser acceptance** (`tests/e2e/drag-reroute.spec.ts`): the
  owner's two symptoms verbatim: after dragging the SmallSat block,
  (a) every incident overlay endpoint stays in the border band of its
  endpoint box, (b) no overlay segment crosses a non-endpoint
  top-level box. Suite parses at 55 tests / 11 files.
- **Core budget raised 176 -> 184 KB** (documented in the check
  script): the router lands in core where route ownership belongs
  (RTE-005). Second raise; the standing recommendation reiterated in
  place: WS-D extracts @g3t/layout (ARC-009), takes the router with
  it, and returns core under its original envelope.

## G3L Round 12: first e2e execution triaged; specs hardened; MR-8 opened

- **First real-browser run of the round-11 specs** (owner-executed;
  report triaged): the confirmed failure was the IBD projection test,
  whose premise was wrong: IBD parts carry ports but no compartments,
  so their geometry kind is "node", never "container"; the
  container-only wait could not satisfy. Fixed: drawn-vs-geometry now
  asserts over ALL top-level structural nodes (strictly stronger),
  and the diagram-switch wait keys on the scene's node-id set
  actually CHANGING rather than on a shape predicate.
- **Headless-authoring audit applied to the rest:** overlay path
  count equality relaxed to the honest invariant (paths non-empty,
  every path maps to routed geometry; declared-port edges
  legitimately render on the cy taxi layer, so equality was a false
  premise), drag-pan replaced with wheel-zoom (a drag from any fixed
  point can grab a node under fit; zoom is a pure viewport op pinning
  the same transform-only invariant), parity regex loosened to its
  stable fragment.
- **MR-8 opened (P1):** owner-observed drag-time routing defects in
  MBSE ((a) dragged block's edge renders toward the block CENTER,
  (b) edges route OVER other blocks). Both are the known RTE-011 gap
  already pinned by the two expected-fail drag oracles; the owner's
  two symptoms are recorded verbatim as B4/B5's acceptance criteria,
  plus a mandated browser acceptance spec for both when it ships.
- Owner visual verdicts recorded: MBSE clean post-removal; ontology
  workbench clean.

## G3L Round 11: browser-acceptance harness extension (postmortem gates, executable)

- **Ruling executed:** the Playwright-class browser harness (which
  already existed with 7 spec files and a CI chromium job) is
  extended with the acceptance layer the collapse postmortem
  mandated, applied to SHIPPED features so the four-layer defect
  class can never again reach a human review first:
  - `tests/e2e/structural-projection.spec.ts` (postmortem gates 2+3):
    drawn compound bounds == geometry box, asserted through the real
    renderer, per flow direction (BDD/DOWN as the flagship default
    fixture, IBD/RIGHT second); overlay edge endpoints must terminate
    on the drawn borders of their endpoint containers.
  - `tests/e2e/stylelab-acceptance.spec.ts`: live parity table at 0
    mismatches; the LOD dropdown drives the engine pane INCLUDING the
    down-tier restore (the resetFirst stale-bypass class); back
    affordance; and a no-vertical-growth check (the resize-observer
    feedback-loop class).
  - `tests/e2e/overlay-acceptance.spec.ts`: one overlay path per
    routed edge; pan is TRANSFORM-ONLY (group transform changes, path
    `d` geometry does not: MR-2's lag-free-at-4k premise as an
    executable invariant); console hygiene: shells load, switch, and
    interact with ZERO console errors/warnings (the mapping-warning
    flood class, enforced).
- **Hook channel:** `src/demo/testing/e2e-hooks.ts` publishes live
  canvas instances and structural scenes to `window.__g3t` ONLY under
  `?e2e=1`, from DEMO code only (packages stay free of test
  plumbing); MBSE and Style Lab shells wired; unit-tested inert
  outside the flag.
- Suite now parses at 54 tests across 10 files
  (`playwright test --list` validated). AUTHORED HEADLESSLY per the
  suite's standing doctrine: this environment cannot download
  Playwright browsers; execution happens in the existing CI e2e job
  (`playwright install --with-deps chromium` + `pnpm run test:e2e`)
  or a maintainer's machine.

## G3L Round 10: expand/collapse REMOVED by ruling; postmortem written

- **Ruling executed:** after a fifth browser FAIL, the owner ruled the
  expand/collapse feature removed from the toolkit entirely. Deleted:
  `collapsedCompartments` + `compartmentKey` + the collapsed-row
  planning from layoutStructural (and the `collapsible` input field),
  `useStructuralCollapse`, `useCompartmentCollapseStore`,
  `registerCompartmentCollapseActions`, the on-container toggle chip
  (emission, styles, tap wiring, `wireStructuralCompartmentToggle`),
  the `collapsedContainers` decoration, the `onCompartmentToggle`
  canvas prop, the collapse Storybook story, the wiring-guide
  examples, and every collapse test. Spec R1.18 AMENDED (collapse
  clauses struck, amendment note points at the postmortem); the
  structural view itself (containers, compartments, rows, ports) is
  untouched.
- **The ruled warning document:**
  planning/expand-collapse-postmortem.md records the four-layer
  defect chain (flow-axis asymmetry -> destroy/recreate flash ->
  hook-unmount stale guard -> compound drawn-bounds vs geometry
  divergence, plus the drag-anchoring and stale-bypass adjacents),
  the transferable lessons (layered headless verification was
  necessary and NOT sufficient; test the flagship's default fixture;
  geometry-right is not picture-right; host conditional rendering is
  part of the feature; the elkjs probe facts; the sunk-cost cadence
  lesson including that agents should surface removal as an option
  earlier), and five HARD prerequisites gating any reintroduction
  (browser-level acceptance harness first among them).
- **What deliberately SURVIVES** (general infrastructure, spec-backed
  G3L:LAY-017/018, re-pointed tests): sketch mode (acceptance now
  perturbs via same-ids input variants instead of collapse), the
  in-place scene patch + epoch-keyed creation, the ::extent bounds
  pin, live-position capture, resetFirst bypass hygiene, and the new
  `useStructuralLayout` hook (the collapse-free successor carrying
  stale-while-revalidate + the same-input sketch; MBSE and ontology
  shells migrated; 3 hook tests).
- Round-56/57 canvas pins re-fixtured onto the surviving
  `closedContainers` decoration (they pin GENERAL same-graph patch
  behavior, not collapse).

## G3L Round 9: fourth review pass (the bounds pin)

- **MR-7 edge labels confirmed fixed** (verdict recorded).
- **MR-1 fourth finding root-caused at the converter boundary:** the
  layout no longer resets, but the TOGGLED container landed wrong and
  broke its edges. Cytoscape derives a compound parent's DRAWN bounds
  from its CHILDREN; when a collapse removed the rows, the drawn box
  shrank to the header strip while the ELK geometry box (held by the
  sketch floor, and the box the border PORTS are positioned on)
  stayed full-size. The visual box hugged the top of its reserved
  slot and edges attached to ports on the phantom border. The
  geometry-level pins were all green because the GEOMETRY was right;
  the defect lived in the geometry-to-Cytoscape projection of
  compound bounds, a layer no prior pin covered.
- **Fix: the bounds pin.** Every container now emits an invisible,
  inert 1x1 `::extent` child at the geometry box's bottom-right
  interior (opacity 0, events "no", unselectable, ungrabbable), so
  the drawn compound ALWAYS spans the same box the ports live on,
  rows or no rows; the constant-footprint contract becomes literally
  visible as the whitespace interior the A2 tradeoff described. Two
  converter tests pin it: the pin exists at the geometry corner for
  every container, and it tracks the floored box across a sketched
  DOWN-flow collapse (drawn bounds == port box).

## G3L Round 8: third review pass (drag-preserving sketch; edge-label halo)

- **Flash confirmed GONE** (third MR-1 verdict): the round-7
  stale-while-revalidate + in-place patch stack works in the browser.
- **Drag revert fixed (MR-1, remaining finding):** the sketch was
  anchored to the last LAYOUT OUTPUT, so a user drag was invisible to
  it and every collapse re-layout snapped moved containers back. The
  canvas now captures live top-level CENTER positions at toggle time
  (`captureStructuralTopLevelPositions`, headless-tested) and passes
  them through `onCompartmentToggle`'s new optional third parameter
  (backward compatible); the hook converts centers to top-left with
  the prior geometry's sizes and anchors the sketch to what is
  actually on screen. The contract is layered-engine semantics, the
  same as commercial interactive-layered tools: the IN-LAYER axis
  honors the drag tightly (< one grid unit), the FLOW axis may
  re-quantize to the layer band (a layered layout cannot hold a node
  between layers), and the full revert is impossible; the hook pin
  asserts all three per axis.
- **"Edge routing weird" triaged, not closed:** most plausibly the
  same defect's visible half (routes computed for the reverted
  arrangement while the user saw the dragged one). The MR-1 re-review
  procedure now separates plain-collapse routing from
  drag-then-collapse routing; if weirdness persists on plain
  collapse, the next suspect is INTERACTIVE crossing minimization's
  route quality under hints, which trades against stability and
  needs its own ruling rather than a silent tweak.
- **MR-7 edge labels ("weirdly muted") fixed:** edge labels sat on
  their lines with no halo while node labels had one; both paths now
  halo edge labels from SHARED_VALUES (size 9 -> 10), the
  text-outline channels joined PARITY_KEYS.edge, and the oracle
  re-passed at 0 mismatches. Dropdown confirmed working.

## G3L Round 7: second review pass (MR-2/3/6 PASS; MR-1 third root cause; MR-7 UX)

- **MR-2, MR-3, MR-6 PASS** (recorded in the verdict log): the SVG
  overlay pans/zooms lag-free at 4k, parity and drag behavior
  accepted, label halo accepted. The SVG-above-canvas pattern holds
  at scale: F1 (SVG adapter) is unblocked on its architectural
  premise.
- **MR-1 second FAIL, third root cause, and the reason round 6's
  fixes could not work:** the collapse hook's stale-scene guard
  (keys-match condition) nulled the scene for the DURATION of every
  re-layout; the MBSE host then rendered "Laying out..." and
  UNMOUNTED the canvas. The unmount/remount was the flash; the
  fresh-mount fit was the reset; and the round-6 in-place patch never
  executed because the component left the tree, a failure mode
  structurally invisible to rerender-based pins (they rerender a
  mounted component; the browser unmounted it). Fixed with
  stale-while-revalidate: a same-input rebuild keeps returning the
  prior scene until the new geometry lands (memoized identity), so
  the canvas stays mounted and the patch path finally runs; only a
  diagram switch shows loading (the original guard's actual intent).
  The hook pin now asserts the scene NEVER nulls across a toggle and
  waits on the geometry swap (row-node count) rather than racing the
  revalidate window.
- **MR-7 second verdict: parity correct, two shell UX defects
  fixed.** The shell now honors the router's onBack contract (back
  affordance, like every other shell). The LOD probe now DRIVES the
  engine pane instead of only changing a text line: resolveLod once
  per context, applyLod per element over the stored base attributes,
  bypasses re-applied; the legacy pane's lack of an LOD concept is
  labeled as the honest capability delta. Building the drive path
  surfaced a real defect before the browser did: a down-tier
  transition left stale text-opacity/opacity bypasses (the projection
  writes only present keys), so labels never restored;
  `applyVisualAttributes` gained a documented `resetFirst` mode
  (removeStyle before re-apply; not for callers sharing bypass
  ownership with the routed-segment writer) and the shell test pins
  the full up-tier/down-tier round trip.

## G3L Round 6: browser-review findings fixed (MR-1, MR-7)

The first live review returned two FAILs; both are root-caused and
fixed, with every fix pinned headlessly.

- **MR-1 root cause 1 (layout reset):** the sketch flow-extent hold
  was a NO-OP for vertical flows, and the default MBSE diagram (BDD)
  is direction DOWN, so collapsing shrank the flow-axis slot and slid
  every downstream layer. Fixed with a probe-verified
  `elk.nodeSize.minimum` floor (MINIMUM_SIZE) at the prior height:
  the box height is CONSTANT across collapse AND expand, so both
  directions are stable; the hidden-row interior reads as whitespace
  inside the border (the A2 tradeoff, vertical form; MR-1 re-review
  explicitly judges the look, and the ruled refinement if rejected is
  post-layout flow-axis compaction). New DOWN-flow acceptance test.
- **MR-1 root cause 2 (the flash):** the flash IS the
  destroy/recreate lifecycle; geometry stability cannot fix a
  remount. CytoscapeCanvas now splits graph IDENTITY (epoch-keyed
  recreation) from scene GEOMETRY: a same-graph rebuild (collapse,
  expand, re-layout, decoration change) PATCHES the live instance in
  one batch (`planScenePatch` pure + `applyScenePatch`:
  element-identity-preserving `json()` updates, adds, removals). No
  teardown, no refit, camera untouched BY CONSTRUCTION (D15 becomes a
  non-event on this path); the SVG overlay follows via the events it
  already listens to. Three prior-round pins evolved deliberately
  (round-56 camera restore -> rebuild-is-a-non-event; round-57
  decorations re-init -> patch-without-reinit; hook shrink ->
  constant-height stability contract), each with the rationale in the
  pin.
- **MR-7 fixes:** fixed 420px pane boxes (the resize-observer growth
  loop); deterministic grid layout on both panes (stochastic default
  layouts made identical scenes disagree on positions); and the label
  finding, which fired the designed FAIL rule exactly: PARITY_KEYS
  under-covered label channels AND the oracle compared bare mounts
  while the browser runs the canvas default+theme stack underneath.
  `labelHalo` is now a first-class VisualAttribute (G3L:LBL-002)
  projected to Cytoscape text-outline; every label channel is pinned
  in BOTH fixture paths from SHARED_VALUES; PARITY_KEYS gained
  label/color/font-size/text-opacity/text-outline; oracle and
  shell-test mounts now carry the real DEFAULT_STYLESHEET +
  themeColorRules stack (both newly exported); and a permanent oracle
  SELF-TEST strips the halo on purpose and demands detection, so the
  blind spot cannot silently return. Root cause of "missing" labels:
  no halo on colored fills (dark text on the red risk nodes) plus
  textSecondary edge labels from the token theme ("muted").
- Verdict log updated (MR-1, MR-7 FAIL -> RE-REVIEW; MR-2/3/6 noted
  not executed, unblocked by these fixes).

## G3L Round 5: Style Lab conformance shell + Cytoscape projection (the ruled side-by-side)

- **Surface ruling recorded:** the ontology shell was judged too
  narrow a styling representation for the side-by-side cutover; a
  DEDICATED conformance shell was ruled instead (2026-07-10). Core
  bundle-budget increase re-confirmed.
- **Cytoscape projection SHIPPED** (@g3t/react
  `visual-attributes-to-cytoscape.ts`): the style engine's FIRST
  consumer. VisualAttributes project onto per-element style BYPASSES
  (outranking every stylesheet rule: engine values are what renders,
  no selector arbitration underneath). Honesty contract built in: the
  projection returns `unsupported` keys (halo, glyphs, donut, pulse,
  taper, gradient: F1's job) and `approximated` keys (pill as
  round-rectangle) instead of silently dropping them. `CyStylesheet`
  is now exported (the `stylesheet` prop's element type; consumers
  building rule arrays need it).
- **Style Lab SHIPPED** (src/demo/stylelab/, landing card "Style
  Lab"): one fixture intent expressed through BOTH paths from ONE
  shared-values source (8 nodes, 6 edges; three nodes LACK riskLevel
  on purpose: the STY-003 gating proof; classes, :selected state,
  critical dashed edges; engine-only zone: halo, glyph, taper). Left
  pane legacy stylesheet, right pane engine bypass, and beneath them a
  LIVE parity table computed from cytoscape's own resolved styles,
  the engine-only honesty report, and a display-only LOD probe over
  the default schedule.
- **The parity oracle** (style-lab-parity.test.ts): both paths
  mounted in headless cytoscape (styleEnabled), computed styles
  compared key-by-key through cytoscape's OWN normalization: 0
  mismatches across every element and parity key (background/border/
  opacity/shape on nodes; line-color/width/line-style/opacity on
  edges). Engine elements derive FROM the live cy
  (`styleElementsFromCy`): the natural adapter direction, id-safe
  against converter-minted edge ids.
- **Shell smoke** follows the established stub pattern (jsdom has no
  2d canvas): the stub captures pane props, the test drives the
  captured onReady handlers with real headless instances, so the
  shell's actual logic (class/selection wiring, bypass application,
  live parity, honesty report, LOD probe) runs unmodified. First
  attempt mounted real canvases and failed ("Could not create canvas
  of type 2d"); recorded so the next agent starts from the stub
  pattern.
- **Landing pin updated:** the capability-surfaces test's exact id
  list gains "style-lab" (a deliberate spec change, not a loosened
  assertion). MR-7 added to the manual-review log: the live
  side-by-side review with its FAIL rule (a visible difference under
  a 0-mismatch table means PARITY_KEYS under-cover a channel; widen
  the keys, not the tolerance).

## G3L Round 4: theme tokens, LOD schedule, style-config JSON (C3 + C4)

- **Round provenance, stated plainly:** this round's files were written
  by an interrupted agent turn (container effects persisted, gates
  never ran, no package produced). The follow-up turn diffed the tree
  against the round-3 reference zip to enumerate exactly what the
  interrupted attempt left (6 new files, 2 barrel edits, doc edits),
  audited each file in full, then ran the complete gate stack before
  packaging. No content was silently kept or silently discarded.
  Gate execution note: the container restarted mid-round (clearing
  vitest caches), after which a cold one-shot `vitest run` exceeds the
  tool's per-call ceiling; the full suite was executed as chunked runs
  covering the IDENTICAL include set (packages/core 355, packages/
  react+charts 689+2 expected-fail, src/demo 167, tests/unit 10 within
  the src chunks, examples 62: 1,273 passed + 2 expected-fail pins).
  A background-run poll during the outage was fooled by a pgrep
  self-match (the check matched its own command line); noted so the
  next agent does not repeat it.

- **C3 SHIPPED: design tokens** (G3L:STY-006,
  packages/core/src/style/tokens.ts). Token vocabulary (color roles,
  stroke/radius/type scales, spacing with the LAY-018 grid unit),
  resolved into the engine's theme layer BEFORE rule evaluation
  (`themeFromTokens`), so one rule set drives light/dark/brand themes
  and a notation preset becomes tokens + rules, not code. Shipped
  LIGHT/DARK defaults carry the Okabe-Ito CVD-safe categorical palette
  (dark mode swaps black for white, the standard adjustment) and are
  WCAG-AA-checked COMPUTATIONALLY in tests via `contrastRatio`
  (primary AND secondary text against canvas, both themes:
  G3L:ACC-001's check for shipped defaults). ThemeManager interop
  lands as a pure projection in @g3t/react
  (`tokensFromG3tTheme`/`styleThemeFromG3tTheme`): ThemeManager stays
  the UI authority, the theme's own typePalette carries through.
- **C4 SHIPPED: declarative LOD schedule** (G3L:STY-010/011,
  packages/core/src/style/lod.ts). Tiers are DATA (coarse-first,
  first-match-wins), each condition holding on zoom <= maxZoom OR
  visible >= count: the two documented commercial schemes (count-based
  desktop-Cytoscape, zoom-based yFiles/CI) unified in one schedule.
  `resolveLod` runs once per zoom/viewport change; `applyLod` is the
  pure per-element combinator adapters apply at draw time, returning
  the SAME object at tier 0 (the hot path allocates nothing,
  G3L:PRF-005). DEFAULT_LOD_SCHEDULE fades labels first, decorations
  next, icons/edges last at hairball scale.
- **STY-007 SHIPPED: versioned style-config JSON**
  (packages/core/src/style/style-config-json.ts). Envelope {version:1,
  tokens, rules, classDefs, stateDefs, lod} with hand-rolled
  structural validation (no schema-library dependency: the bundle
  budget is a gate), JSON-pointer-ish error paths, and the published
  STYLE_CONFIG_SCHEMA object for external tooling. Honesty boundary:
  function attributes and predicate selectors are code, not presets;
  `serializeStyleConfig` REJECTS them with coded errors instead of
  silently dropping. Round-trip pinned in tests, including
  parsed-rules-drive-the-engine-identically.
- **Bundle watch:** core at 171.6/176 KB (98%) after C3/C4; ~4.4 KB
  headroom remains. The next core-side growth (the D2 layered engine)
  will force either another deliberate budget decision or the
  G3L:ARC-009 package extraction; flagged now so the choice is made
  deliberately, not under a red gate.

## G3L Round 3: style-resolution core (C1 + C2)

- **C1 SHIPPED: VisualAttributes contract + pure resolution**
  (G3L:ARC-002, packages/core/src/style/). `VisualAttributes` is the
  renderer-neutral flat visual description (box/shaft basics, labels
  with the LOD visibility hook, decoration primitives: glyphs, halo,
  donut, pulse per G3L:NOD-007, and edge direction encodings
  INCLUDING tapered width and source-to-target gradient per
  G3L:STY-008, plus the UML arrow vocabulary). `resolveStyles`/
  `resolveElement` are the pure reference semantics: fixed layer
  precedence defaults < theme < rules (insertion order) < classes <
  states < manual overrides (G3L:STY-001), declarative selectors
  (kind, dataHas, dataEquals, classAny, predicate escape hatch), and
  STY-003's field-presence gating made STRUCTURAL: a data-mapped rule
  cannot apply to an absent-field element and cannot emit a
  per-evaluation diagnostic (the 1,716 ms mapping-warning flood is
  unrepresentable in this engine by construction).
- **C2 SHIPPED: dependency-tracked incremental invalidation**
  (G3L:STY-004, the adopted Ogma nodeDependencies/nodeOutput design).
  Rules declare data-field dependencies and attribute-key outputs; the
  engine indexes fields to rules, so `applyDataChange` recomputes the
  minimum set: unmatched field = ZERO evaluations, matched field = the
  one element, adjacency-dependent rules fan out to neighbors ONLY.
  Function rules without declared dependencies degrade to conservative
  invalidation and say so ONCE through the pluggable diagnostics sink
  (G3L:QLT-006: coded diagnostics, no console calls anywhere in the
  module). State and class toggles recompute exactly one element
  (G3L:STY-005/STY-012). Tests pin the incremental path against the
  pure reference after mutation, and the R2-scale (5k nodes / 10k
  edges) mechanistic budgets: full load = exactly 16,000 evaluations
  on the fixture's rule set, single matched change <= 2 evaluations,
  unmatched change = 0. Wall-clock is a loose pathology bound only;
  freezing real PRF-004 numbers is MR-5's baseline ruling.
- **Bundle budget:** @g3t/core raised 160 -> 176 KB per the gate's
  own protocol (comment in scripts/check-bundle-size.mjs): +11.4 KB
  of deliberate P0 pure compute across G3L rounds (metrics oracle +
  style engine), with headroom noted for the C3/C4 declarative
  slices.
- Adoption posture unchanged: no surface consumes the engine yet; the
  ruled side-by-side cutover (one demo shell vs its Cytoscape
  stylesheet, snapshot-compared) starts with C3/C4 next round.

## G3L Round 2: SVG overlay edge layer (B2), manual-review procedural log

- **B2 SHIPPED: SVG overlay edge layer** (G3L:RND-002,
  packages/react/src/views/canvas/structural-edge-overlay.tsx) behind
  the ruled per-surface prop `structuralEdgeLayer: "cytoscape" |
"svg-overlay"` (default unchanged). Routed structural edges draw as
  TRUE absolute polylines in an SVG layer above the canvas: shaft,
  per-UML-kind arrowheads as explicit geometry aligned to the terminal
  tangent (G3L:STY-009: association filled triangle, generalization
  hollow triangle with shaft trim, composition/aggregation source
  diamonds, dependency dashed + open vee), and halo-text labels at the
  arc-length midpoint (G3L:LBL-002). Single source of truth preserved:
  the overlay reconstructs every frame from the SAME `_segDist`/
  `_segWeight` data the drag re-anchor maintains, against Cytoscape's
  live endpoints (`liveRoutedPoints`), so drags follow with no second
  geometry owner. Interaction parity by construction: the SVG is
  pointer-events:none and the underlying Cytoscape edges stay mounted
  at opacity 0 (NOT display:none, which would kill hit testing), so
  hover and context-menu behavior is untouched. Declared-port edges
  keep their taxi rendering in both modes (the ruled perpendicular-
  exit split, G3L:RTE-008). Pan/zoom updates only the group transform
  (no per-edge work, G3L:RND-003's budget); drag redraws are
  rAF-batched with zero per-frame React or console work
  (G3L:PRF-005). The MBSE shell is the ruled first opt-in surface.
  Headless findings kept honest: creation-time `position` fields came
  back (0,0) under headless+styleEnabled:false, so the fixture sets
  positions post-creation; `sourceEndpoint()` requires a renderer, so
  renderer-less environments fall back to node centers (browser
  always has the renderer; the endpoint-basis agreement is MR-3's
  live-review claim, not a headless one).
- **Manual-review procedural log** (planning/g3l/manual-review-log.md):
  the tracked register for human/live review tasks with procedures,
  accept criteria, verified requirements, and ruled FAIL consequences:
  MR-1 collapse stability live, MR-2 overlay 4k lag gate (the ruled
  RND-003 fallback), MR-3 overlay parity + drag, MR-4 FTO release
  gate, MR-5 PRF baseline ruling, MR-6 label taste check. Pointed to
  from roadmap/human-actions.md; agents append, humans record
  verdicts.

## G3L Round 1: sketch-mode layout stability, drag-route oracles, metrics module

The first execution round of the G3L plan (planning/g3l/): the ruled
ordering A1 + B1 + D1, all oracle-building, all gate-covered.

- **A1 SHIPPED, criterion met at zero displacement.** `layoutStructural`
  gains a `sketch` option (G3L:LAY-017): prior top-level positions AND
  extents. Sketch mode switches ELK layered's FOUR strategies to
  INTERACTIVE (cycle breaking, layering, crossing minimization, node
  placement) and holds each hinted node's flow-axis extent at its prior
  value. Measured experiment trail, kept honest in the code comments:
  three strategies alone left ~364px drift (BRANDES_KOEPF recenters
  within layers); adding INTERACTIVE node placement left a 49px
  non-rigid shift (a shrinking node shrinks its LAYER, sliding every
  downstream layer toward it); `elk.margins` was measured to be
  IGNORED by elkjs as a layoutOption, so slot reservation happens
  through the node's own size (`holdFlowExtent`): the collapsed box
  keeps its footprint width and collapses in height only, "resizes in
  place" literally (the ruled A2 whitespace tradeoff, folded into
  sketch mode). Result on the acceptance fixture: untouched containers
  move 0px across a collapse rebuild (criterion: < one grid unit,
  G3L:LAY-018). A rigid median re-anchor keeps the sketch frame when
  ELK's coordinate origin floats. The sketch participates in the
  layout memo key (rounded, sorted) so sketched runs are never served
  a stale unsketched result. `useStructuralCollapse` feeds the sketch
  automatically on same-input rebuilds (same-graph identity, mirroring
  D15) and now owns the `sketch` option (Omit widened).
- **B1 SHIPPED: drag-route oracles** (G3L:QLT-007,
  packages/react/src/views/canvas/drag-route-oracle.test.ts). Four
  PASS-pins fix the shipped guarantees (segment round-trip inversion;
  orthogonality under single-endpoint drag; rigid translation under
  subtree drag). Two `it.fails` OPEN-pins document the honest gap:
  rescaled routes do NOT re-route around obstacles (the G3L:RTE-011
  revisit trigger); flipping them to plain `it` is the acceptance
  change when incremental rerouting lands. One OPEN-pin's original
  fixture actually cleared the obstacle (compression moved the
  clearing segment AWAY from the box); corrected to a stretch drag
  with the arithmetic in the comment, an error `it.fails` itself
  caught.
- **D1 SHIPPED: layout quality metrics module** (G3L:QLT-002,
  packages/core/src/metrics/layout-metrics.ts, exported from the core
  barrel): crossings (proper intersections, shared endpoints excluded,
  collinear overlap counted), bends (collinear-skipping, double-backs
  counted), total edge length, bounds/aspect ratio, and
  displacement-from-sketch (mean/max/per-node with ignore + unmatched
  accounting). Deterministic pure functions; `metricsFromStructural` /
  `positionsFromStructural` adapt StructuralGeometry directly. The A1
  acceptance test consumes the metrics module as its oracle, so D1 is
  exercised against real elkjs geometry from day one.
- **Docs:** planning/g3l/requirements-specification.md (v0.2, the
  audited spec) and planning/g3l/implementation-plan.md land in the
  repo as the round's governing documents (planning is
  citation-exempt; G3L IDs in source are inert to gates:spec's R-ID
  scanner by construction and join the sync gate when the scanner
  learns the prefix).

## Round 7: routing architecture decision doc (12.23 / 8.3)

- planning/routing-architecture-decision.md: the dedicated research
  Zach ruled for. Grounded in registry facts (libavoid-js
  0.5.0-beta.5 active but beta, ~813KB, zero deps; elkjs current)
  and as-built constraints (Cytoscape's relative segments model is
  the ceiling causing every 9.7 symptom; react at ~91% budget).
  Recommendation: ELK interactive-mode experiment FIRST (12.20,
  cheap, uses the existing crossingMinimization seam), then a
  per-surface opt-in SVG overlay rendering ELK's absolute routes
  (testable path generation, no new dependency), libavoid-js
  explicitly rejected-for-now with a stated revisit trigger (live
  re-routing under free node dragging). Falsifiability criteria
  included.

## Round 7 slice 4 (12.15 legend, 12.17, 12.19, 12.18, 12.14, 12.10)

- 12.15 legend shape channel: SpecLegend already had shape rows but
  only for spec-declared encodings; the workbench's shapes come from
  the canvas DEFAULT (buildTypeVisualMap: sorted types cycled through
  shapeForIndex), which the legend never documented. When the spec
  declares no shape encoding, the legend now derives rows from that
  exact sort + cycle (titled "types (default)"), skipped when all
  nodes share one shape. Pinned.
- 12.17 ANSWERED, not a filter bug: "Signed approval" carries NO
  generatedAtTime BY DESIGN (the fixture's planted data-quality
  defect), and hiddenForRange's documented policy is that a missing
  timestamp is a finding the auditor surfaces, never a filter
  criterion; hiding it at t0 would hide the defect. The
  communication gap is fixed instead: the timeline header shows "N
  undated records always shown (missing timestamps are audit
  findings, not filters)".
- 12.19 root cause (why "black bars at 100%"): .bio-bar-fill is an
  inline span, and inline elements ignore width/height, so the fill
  was a zero-size box and only the near-black TRACK rendered.
  display: block on the fill. jsdom does no layout, which is why no
  test ever caught it.
- 12.18: echarts animates by default; LinkedChart's built options now
  set animation: false under prefers-reduced-motion (SSR-safe check),
  matching the graph views.
- 12.14: workbench left-rail search gains a clear (x) and clears on
  any class/property/individual selection (the select helper is the
  single entry point).
- 12.10: the popout's contract is the WHOLE neighborhood in frame:
  explicit fit on ready and again on layoutstop, destroyed-guarded.
- 12.20 direction recorded (not shipped): the camera IS preserved on
  collapse rebuilds; what resets is ELK recomputing positions for the
  changed input. The fix is an ELK interactive-mode/position-
  preservation experiment, folded into the 12.23 layout research
  rather than patched blind.
- Suite: 132 files / 1213 tests (partitioned: 228 + 985).

## Round 7 slice 3 completion (12.11, 12.6, 12.7, 12.15 ellipse half)

- 12.11 (inspector, all usages): NodePropertyInspector gains
  typeColorOf so surfaces with custom EncodingSpecs pass their
  value-keyed categorical map and the panel's type chips match the
  graph exactly (the internal theme-palette map only matched the
  DEFAULT encoding, which was the reviewed mismatch). Analytics: the
  inspector leaves its fixed box over the data grid and floats over
  the GRAPH on FloatingPanel (top-right, draggable, no sizing
  wrapper: the reviewed too-small box is gone); test ids preserved.
  Auditor passes its surface map too.
- 12.6 (Zach's ruling): the Algorithm demonstrations and Derive-a-
  property cards are REMOVED from the Analytics rail; Origin coverage
  by tier is the rail's one story. The components live on in
  packages/react with their own suites. The now-writerless revision
  machinery (bump/rev display) went with them; the scatter pipeline
  is static since degree ingests once at mount. Surface pins replaced
  with the ruling's contract.
- 12.7: the hidden-suppliers notice pulses twice at load (box-shadow
  keyframes, reduced-motion exempt) so the reveal affordance is
  discoverable without reversing the hidden-by-default narrative
  (9.4 ruling).
- 12.15 (ellipse half): any node carrying a pie forces shape:
  ellipse, so the multi-type ring IS the node's shape instead of a
  circle clashing over a kind shape. REMAINING: SpecLegend's shape
  channel.
- Suite: 132 files / 1212 tests (partitioned: 228 + 984).

## Round 7 slices 2-3: P0 trio + supply legend (12.1, 12.3, 12.2, 12.16)

- 12.1 (pin badge, two browser failures): data()-mapped ARRAY values
  for the multi-image background channel are gone for good. The pin
  indicator now writes literal arrays as per-element style BYPASSES
  (Cytoscape's documented multi-background usage); unpin removes the
  bypass set (PIN_BYPASS_PROPS) so rule-driven appearance returns
  intact; the pinned class rule maps nothing. Bypass precedence is
  safe: emphasis dims via opacity, hidden via display. Contract tests
  rewritten to the bypass shape.
- 12.3 (workbench 60% fill, REOPENED 5.16): ROOT CAUSE in
  SurfaceFrame: the children wrapper was flexed but NOT a flex
  container, so the grid's flex:1 was inert and its height fell back
  to content (explaining all three measurements: 60% fill, dock
  growth to 90%, SPARQL overflow-scroll). The wrapper is now
  display:flex column, which makes both child idioms work (flex:1 and
  scale's height:100%). Guard pinned on the grid's parent display.
- 12.2 (MBSE): the projection was NEVER the gap: a scene-level pin
  now proves the verify edge, testCase header, and constraint header
  reach the exact render input the screen consumes. Two real fixes:
  the ContainmentTree rendered only ROOT requirements (nested
  children now walk recursively: Pointing/R1.2 visible), and
  constraint blocks fell back to the "block" stereotype (headers now
  derive from kind: PowerBudget reads constraint).
- 12.16 (supply legend, twice-flagged): root cause found:
  categoricalColorMap keys by driver VALUES; the rail legend and
  cluster swatches looked up by node ID, missed every time, and fell
  back to slate #475569 (Zach's exact rgb). Both lookups now key by
  value. And the canvas gains the FloatingLegend (promoted to
  packages/react with corner-aware, stretch-proof offsets; the
  workbench imports the shared one; presence pinned on supply).
- Suite: 132 files / 1213 tests (166 demo + 1046 packages/examples
  - 1 e2e-adjacent, run partitioned).

## Round 7 slice 1 (lag investigation + rulings + search + dim + widths)

- 12.4 (scale initiation lag): three suspects ELIMINATED by code
  audit: Louvain runs once ([]-memoized in buildModel), super-edges
  aggregate into weighted cluster-links, and instances destroy
  properly on every switch (effect cleanup plus a defensive destroy
  at init). Rather than a fourth theory, INSTRUMENTATION ships:
  every view switch logs click -> canvas-ready to the console; the
  next pass reports numbers per direction, including whether the
  supernode view's ~5x holds and whether times grow across switches
  (the leak smell).
- 12.5 rulings applied: clusters idealEdgeLength 300; edge labels OFF
  by default with a rail chip; rail at 280px.
- 12.9 (search jump): SearchBar gains onPick (explicit dropdown click
  or Enter); GraphToolbar moves the camera ONLY on picks and centers
  the PICKED node, fixing both the typing jump and the workbench
  non-top-result no-center in one seam. Contract pin rewritten.
- 12.12 (inert dim toggle): when dimming, the presentation AMPLIFIES
  the confidence deficit (0.9 renders at 0.4, floor 0.15); the
  originals map still restores exact fixture values, so data stays
  honest and only presentation exaggerates. A blanket test-update
  initially corrupted the originals-map assertion; caught and the
  first-seen contract restored (the map keeps TRUE values).
- 12.8: auditor timeline panel to 440px; event-kind column min-width
  fits «generated».
- Suite: 131 files / 1210 tests.

## Round 6: dead-code reconsideration (elk verification; FloatingPanel fold)

Zach's challenge on the four deletions, re-examined per file.

- elkWorkerEngine VERIFIED routing-free: the full 44 lines are a
  transport wrapper (elkjs workerFactory, cast to core's ElkEngine
  seam, cached, sync fallback). Every routing-relevant option lives
  in core's layoutStructural, which the wrapper merely injected into;
  the deletion changed where layout EXECUTES, never what it computes.
  The engine?: ElkEngine seam survives in core, so worker layout is a
  small reinstatement if the 9.7/8.3 routing decision raises layout
  cost.
- FloatingInspector's deletion-then-request (9.23) was the fold
  signal: the drag/float/close pattern had reached three consumers
  (the popout inline, and the auditor twice). Folded as
  packages/react FloatingPanel: corner anchoring (four corners),
  fixed/absolute positioning, dependency-free pointer-capture header
  drag, close button, explicit test-id props so consumers keep
  established ids. All four offsets are set inline (auto for unused
  sides) so host containers that stretch children (the auditor's
  inset: 0 canvas wrap) cannot deform it. NeighborhoodPopout now
  composes it (zero test churn); the auditor's lineage (bottom-left)
  and inspector (top-right) panels float over the graph on it,
  delivering 9.23's floating placement (near-node anchoring remains
  open; both panels drag).
- ResizablePanels and RightPanel deletions REAFFIRMED: no current
  consumer for a splitter (9.25's solution shape is undecided) and
  the docked-neighborhood pattern is a recompose of existing toolkit
  pieces if preferred over floating; recovery pointers stand.
- Suite: 131 files / 1210 tests.

## Round 6: sweep, protocol, hygiene (traceability, dead code, coverage, docs)

- Review protocol consolidated (plan section 10): a single ordered
  checklist for the next Windows pass (build identity first, the
  three stale-build gates, the 9.8 experiment, per-shell checks,
  rulings, e2e), superseding the scattered per-slice backlog. G5
  answered: commit Linux screenshot baselines only after the pass
  stabilizes, one CI run, shells-only, dropping --ignore-snapshots in
  the same commit.
- Traceability sweep (plan section 11): every original checklist
  finding audited. Two gaps closed: graph controls on the ANALYTICS
  surface (checklist line 50; the Round 2 toolbar adoption covered
  workbench/scale only; now mounted with a live core handle) and the
  gsBravo closed-shape question (ANSWERED: the pasted violations were
  pre-round-1 behavior, fixed by the 3.1 projection split and pinned;
  an exploratory fixture edit was reverted when the pinned
  conforms-on-asserted contract caught it).
- Dead code purged: four whole files (FloatingInspector,
  ResizablePanels, RightPanel, elkWorkerEngine; 554 lines, superseded
  by toolkit components across the rounds) and four definition-only
  exports (colorByCandidates, tripleCount, eventsInRange, PROV).
- Coverage analysis: six modules have NO test file in their entire
  directory: core event-bus, filter, undo-redo, diff-engine,
  relational-virtualizer, theme/design-tokens. Filed as test-debt
  items 9.29 (P1: event-bus, filter, undo-redo) and 9.30 (P2:
  diff-engine, virtualizer, design-tokens).
- Docs: wiring guide gains allShortestPaths (path analysis) and the
  canvas layoutOptions contract (merge order, content keying,
  end-mode animation). Anchor integrity verified (all capability
  bubble links resolve); no stale Schema Dashboard references; the
  checklist's CHANGELOG-reduction ask verified already satisfied.
- Suite: 131 files / 1210 tests.

## Round 6 slice: paths, popout, bubble, axioms (9.17, 9.20, 9.24, 9.26)

- All shortest paths (9.17): "Find Paths To Here" was a one-path demo
  by construction (findShortestPath is singular). New core primitive
  allShortestPaths returns the UNION subgraph of every shortest route
  (layered BFS distance field; backward walk keeps
  distance-descending edges) plus a route count capped at 50 so the
  label stays honest on dense graphs. Pinned: diamond yields both
  routes and excludes the longer detour; the count caps instead of
  exploding. The analytics status strip gains a Clear path chip
  driven by the emphasis store, closing "the muted styling is
  unremovable".
- NeighborhoodPopout (9.20): always opens at ONE hop (the stepper
  widens); a positioning="absolute" mode anchors it inside the graph
  view instead of the viewport (the dashboard's canvas section is
  the positioned ancestor); the header is a dependency-free
  pointer-capture drag handle.
- Capability bubble (9.24): the inner disclosure toggle was a second,
  pointless collapse control (the FAB already opens and closes the
  panel); the bubble now renders a static header, inline usages keep
  the disclosure. A bottomOffset prop lifts the auditor's bubble
  above its timeline strip.
- Workbench axioms sorted (9.26): asserted before inferred, then by
  rendered text; store order was insertion order, which interleaved
  unrelated axiom kinds.
- Suite: 131 files / 1210 tests.

## Round 6 slice: P0 root causes + polish sweep (9.9, 9.10, 9.16, 9.28)

- 9.9 (workbench search crash): shells hand GraphToolbar a
  live-instance handle that goes stale between a canvas unmount and
  its successor's onReady; the workbench's instances -> neighborhood
  swap resets viewCore only on TAB switches, so search animated a
  destroyed instance. Toolkit fix: the toolbar normalizes a destroyed
  handle to absent, so every control no-ops until a live handle
  arrives, closing the class for all shells. Pinned with a
  destroyed-instance fake.
- 9.10 (supply emphasis stuck / dim does nothing): the shell
  registered its gap overlays ACTIVE ("risk visible without
  interaction"), so the overlay renderer dimmed every non-finding
  element at all times. HONEST CORRECTION: this, not the
  0.9-confidence edges, was the dominant source of the original 5.7
  "most nodes muted" finding; the slice-2 fix was partial. Same
  treatment as the auditor (6.2): overlays register inactive, with
  explicit Highlight chips in the Gaps section. Inactive default
  pinned. This should also clear the "legend seems just wrong"
  muddiness; re-check 9.22 on the next pass before further legend
  work.
- 9.16 (multi-select pin): the primary pin action toggled only the
  context node; it now acts on the whole selection COHERENTLY when
  the target is multi-selected (every node adopts the target's new
  state, so mixed selections cannot flip in opposite directions),
  and "Pin Selected" writes the pin store directly instead of only
  emitting an event that most shells never consumed. Mixed-selection
  contract pinned.
- 9.28 polish sweep: auditor play at 250ms; workbench entity dock
  starts collapsed; SPARQL grid pages at 20 rows; bio Run button
  removed (presets already auto-ran; edits now auto-run too).
- Suite: 130 files / 1207 tests.

## Round 6 opening fixes (e2e locator, 9.8 experiment)

- e2e shells.spec: the supply cluster-mode locator targeted
  role=button with an exact name; review 5.8 deliberately converted
  the modes to a radio group with descriptions inside each label, so
  the locator could never match. The spec now checks the stable
  sc-mode-region testid. The shell-supply-region.png baseline needs
  regeneration (the rail changed since capture).
- 9.8 (scale drill lag): a clean devtools console kills the
  mapping-warning-flood theory. New prime suspect: fcose animate:true
  renders every layout tick, and drill/return both re-init and
  re-run layout. Experiment shipped: the scale shell overrides to
  animate "end" via layoutOptions (single transition to final
  positions; reduced-motion still yields no animation because the
  override is conditionally withheld). Pinned. If lag persists on
  the next pass, the remaining suspect is re-init cost itself, which
  means element mutation instead of UGM identity swap (a larger
  canvas change).
- Suite: 130 files / 1204 tests.

## Review remediation, Round 4 slice 2 (OW-F1, MBSE depth)

Executes OW-F1, 6.5, and 6.7. Item 6.6 (P2 selection-driven property
browser) is the sole Round 4 remainder, deferred deliberately rather
than rushed.

- OW-F1 root cause and fix: hasComponent was declared inverseOf
  partOf, pairing a specific property (Subsystem -> Component) with
  the generic transitive mereology (Artifact -> Artifact). The
  asserted "prop1 partOf aquila1" materialized "aquila1 hasComponent
  prop1", whose domain then entailed aquila1 (a Satellite) rdf:type
  Subsystem; the range likewise typed prop1 as a spurious Component.
  No demo rode this inverse (transitivity rides partOf itself, the
  subproperty demo rides hasPrimaryAntenna, the inverse-entailment
  demo rides hasSubsystem/subsystemOf), so the declaration is simply
  removed, with negative entailment pins guarding both the type and
  the materialized triple. The reviewed CommsSubsystem inferred
  subClassOf oddity is a separate, semantically correct expansion
  (equivalence implies mutual subclass), already rendered as a single
  double-stroke edge since Round 1.
- Fixture coherence invariants (6.7): new coherence.test.ts
  formalizes the resolution rules the renderers actually use and
  cross-references every fixture reference against a declaration:
  binding values resolve through part aliases to declared value
  properties (payload.powerDraw resolves via the payload part to the
  imager block), binding params to constraint parameters, connector
  ends to part IDS and their ports, relationship endpoints to blocks
  or NESTED requirements, diagram member lists and the package tree
  to their records. First contact caught two wrong assumptions in
  the invariant itself (connectors use part ids, not names; the
  requirements record keys roots only), both corrected against the
  renderer as authority. The fixture was already coherent; the
  invariant is the guard.
- Verification traces render (6.5): the requirements projection
  filtered trace links to «satisfy» only, so a «verify» link could
  never render; the filter now admits satisfy and verify, labels per
  stereotype, and renders tracing elements with their own stereotype
  header. Fixture adds ImagingAcceptanceTest («testCase») verifying
  req.image and the power-budget constraint block satisfying
  req.power analytically. The requirements-breakdown tree itself was
  already produced by the projection (recursive walk, composition
  edges, pinned).
- Suite: 130 files / 1204 tests.

## Review remediation, Round 4 slice 1 (auditor)

Executes plan items 6.1-6.3.

- Menu labels do what they say (6.1): "Inspect properties" opens a
  floating NodePropertyInspector (the 4.11 pattern); "Inspect
  lineage" is a separate action offered only on Entities (a
  derivation chain is meaningless on an Agent). The reviewed
  tree-collapse-on-click had a selection-coupling root cause: the
  trace rooted at whatever was selected, so clicking a hop selected
  that ancestor and re-rooted the tree to its shorter chain. The
  trace now roots EXPLICITLY from the menu action; hop clicks select
  on the canvas without re-rooting; a close button clears the panel.
  The root-survives-selection-change behavior is pinned.
- Default muting removed (6.2): the shell registered its SHACL
  violation and warning overlays ACTIVE at mount, so the overlay
  renderer dimmed every non-finding node by default (the reviewed
  "most nodes are muted"). Overlays now register inactive; two
  labeled chips in the report panel are the explicit narrative
  controls ("Highlight violations on canvas"), and the inactive
  default is pinned. Same finding family as supply 5.7, different
  mechanism (overlay dim there was confidence-mapped edge opacity).
- Timeline legibility and play (6.3): slider ticks are per-kind
  glyphs (generated / started / ended) with hover tooltips carrying
  name, kind, and date; the event list shares the same symbols; a
  Play control sweeps the window end forward in discrete steps
  (pausable; a full window rewinds to the start first; the sweep is
  discrete state, no tween, so reduced-motion is not violated).
  Fixture densified per RC7: a safety workstream (hazard analysis,
  safety review, regression run) with three entities and a derivation
  joining the main chain at review; 23 timeline events, up from 14.
- Suite: 129 files / 1197 tests.

## Review remediation, Round 3 slice 5 (workbench datagrid pair; Round 3 complete)

Executes plan items 5.18 and 5.19, closing Round 3.

- Fit evaluation (5.19 prerequisite): TableView stays UGM-bound. Its
  lower half is node-selection and context-menu semantics over the
  shared selection store, not a neutral grid; extracting a
  presentational core would reshuffle a suite-covered interaction
  surface for no user-visible gain. The plan's sanctioned adapter
  path applies, hardened by three additive TableView props:
  hideBuiltinColumns (adapter-fed UGMs would otherwise render an
  ordinal-id column and a constant-type column as noise), idFormatter
  (display-only; IRIs show local names, the full id rides the title
  and selection), and selectable=false (adapter rows are inert:
  ordinal ids written into the SHARED selection store would clobber
  a live canvas selection; this hazard is pinned).
- SPARQL via the toolkit grid (5.19): sparqlResultUgm adapts bindings
  (one node per row, SELECT-clause column order preserved by stamping
  every head variable on every row, unbound OPTIONALs as empty
  strings). The bespoke table is gone; results get sorting, paging,
  and the column menu for free. The 22-class preset pin migrated to
  the grid.
- Persistent entity dock (5.18, ruling 8.5): the scoped entity table
  is a collapsible bottom dock across every center tab, replacing the
  instances-tab-only strip. Row clicks select entities through the
  shared store (every canvas renders the selection); the header shows
  the live row count and scope. Pithy columns: the raw Types builtin
  is hidden (the display projection's pithy type property carries
  it) and ids format as local names. local() is now exported from
  project.ts (one definition, one truncation policy).
- Already fixed, verified in passing: the scope dropdown was
  alphabetized in a prior round (localeCompare in place).
- Suite: 129 files / 1194 tests.

## Review remediation, Round 3 slice 4 (workbench P1 items)

Executes plan items 5.16, 5.17, 5.20, 5.21. The P2 datagrid pair
(5.18, 5.19) shares one design and lands as the next slice.

- Viewport fill (5.16): the workbench grid declared columns but no
  row template, so its single implicit row was auto-sized and
  height:100% children resolved against content height; the shell
  never filled the viewport in a real browser, and jsdom (which does
  no layout) could not see it. The grid now declares
  gridTemplateRows minmax(0, 1fr); a regression guard pins the
  template's presence, and the visual result stays a browser check.
- Hierarchy layout under inference (5.17): asserted mode keeps
  breadthfirst (the hierarchy is a tree and reads as one); the
  inference toggle switches to fcose, which spreads the equivalence
  and transitivity cross-edges that breadthfirst tangled. Pinned via
  the canvas stub's layout capture.
- SHACL rail separation (5.20): the right rail widens 320 -> 380px
  and becomes a scrollable column of visually distinct section cards
  (entity details, SHACL property browser, ontology statistics), each
  with a tinted header bar, so shape reports no longer bleed into the
  node attributes.
- Multi-type membership (5.21): new src/demo/ontology/multi-type.ts
  renders multiple class memberships as a SPLIT RING via Cytoscape
  pie backgrounds. Slice colors come from the same categoricalColorMap
  as the spec and legend (a ring slice always matches a legend row;
  nodes whose types lack a mapped color are skipped rather than
  colored wrongly), rules are attribute-guarded per slice (the
  mapping-warning discipline), and memberships cap at four slices.
  Both instance-bearing canvases (instances, neighborhood) stamp and
  render; the seed materializes 17 multi-type individuals with
  inference on, pinned end to end.
- FINDING (recorded, out of slice scope): with inference on, aquila1
  (a Satellite) is entailed as a Subsystem. This looks like a
  domain/range mis-declaration in the model or a reasoner rule
  applying the wrong position, and is plausibly the same root-cause
  family as the reviewed CommsSubsystem/CommSubsystem inferred
  subClassOf oddity. The new split ring makes such entailments
  visible, which is the feature working as intended. Filed in the
  plan as finding OW-F1 for a Round 4 look.
- Suite: 128 files / 1188 tests.

## Review remediation, Round 3 slice 3 (scale surface)

Executes plan items 5.11-5.14 (5.15 was ruled NO and stays closed).

- Spacing and fit tuning (5.11): CytoscapeCanvas gains a
  layoutOptions prop, merged into the layout object after the
  built-in fcose/cose numbers (caller wins) and keyed by CONTENT so
  inline literals never churn the instance; the structural preset
  fit:false override merges last, so no caller option can break the
  structural camera policy. The scale shell passes per-view tuning:
  long ideal edges, strong repulsion, and 60px fit padding for the
  supernode view; tighter but padded numbers for a drilled community.
  The padding is also the working theory for the odd zoom (supernodes
  no longer touch the viewport edges); the numbers themselves are
  browser-verify items, the passthrough is the tested part.
- Cluster labels disambiguate (5.12): dominant type alone collides
  whenever communities share a type mix (the planted-partition
  generator assigns types round-robin, so half the rail read "Service
  cluster"). collapseByCluster now names each supernode by dominant
  type plus its highest-degree member ("Service cluster around
  Service 12-88"); communities are disjoint, so the labels are unique
  by construction, pinned in the core suite. The rail explains that
  clusters are Louvain communities and how they are named. The
  double-rendered count from the review was already fixed in core
  (the label is a bare name; memberCount is data).
- Drill-in animation (5.13): the animate flag (reduced-motion aware)
  was already wired in Round 2; the drill re-init runs its layout
  with it, which is the loading affordance the review asked for. The
  shell test now pins the flag reaching the canvas.
- Encoding change AT scale (5.14): collapseByCluster stamps
  dominantType as a first-class supernode property; the shell adds a
  rail toggle that recolors all supernodes by it in place (spec
  changes restyle without re-layout, the canvas contract). Layout
  switching and search at scale already ride the Round 2
  GraphToolbar. The toggle scopes to the clusters view: member nodes
  carry no dominantType, so drill always colors by type (pinned).
- Suite: 127 files / 1180 tests.

## Review remediation, Round 3 slice 2 (supply thread shell)

Executes plan items 5.6-5.10.

- Unexplained muting killed (5.7): the fixture's `supplies` edges
  carry confidence 0.9 and the canvas's D1 channel rendered most
  edges faint by default with no stated reason. The default now shows
  everything at full strength; confidence dimming appears only via an
  explicit labeled control (confidence-dim.ts: a DATA patch on
  `_confidence`, not a style bypass, so the emphasis layer's
  trace-route dim keeps its precedence; first-seen values restore the
  fixture's true confidences on re-enable).
- Consumer-readable rail (5.8): "Provenance" is now "Entities per
  source"; grouping controls sit next to the legend with one-line
  descriptions of each mode; and connected-component clusters carry
  semantic labels (dominant node type plus highest-degree member)
  instead of "Component 1".
- Gap provenance stated (5.9): the Gaps section says exactly how
  findings are computed, matching the verified analyzeGaps hybrid:
  graph analysis (sole-source parts, single-point-of-failure
  suppliers) merged with SHACL validation (missing certification,
  incomplete consolidated records).
- Type icons and DAG layout (5.6): the encoding spec gains an icon
  channel per tier (safe alongside pin badges via composePinStack),
  and the canvas uses breadthfirst so the supplier -> part ->
  assembly -> product DAG reads as tiers. Browser-verify item.
- Richer path fixtures (5.10): a shared-supplier diamond, a
  multi-tier alternative (the gyro, sourced at tiers 1 and 3, adding
  no gap findings by design), and a nested Sensor Core Module so one
  trace runs a structural level deeper (the surprising path).
  Invariants pinned in analytics.test.ts; the provenance-count pin
  updated for the enriched fixture (ERP now 10: 7 parts + 3
  assemblies).
- Suite: 127 files / 1176 tests.

## Review remediation, Round 3 slice 1 (Analytics reframe, Schema Dashboard retired)

Executes plan items 5.1-5.5.

- Demonstrations, not algorithms (5.1): the Analytics rail is
  reframed around visible consequences. A components run RECOLORS the
  canvas (the dashboard reacts to the panel's reported property keys
  and switches the color encoding to \_component); centrality RESIZES
  nodes; the path demo draws the round-21 overlay (already visible;
  now captioned). A reset chip restores size-by-degree and
  color-by-type, which is itself the change-styling demonstration.
- Derived property connects to encoding (5.2): DerivedPropertyPanel's
  onCompute now carries the computed key (no-arg callers unaffected);
  the dashboard re-sizes nodes by the derived value the moment it
  computes, and the card says so in its title.
- Origin-coverage fixture (5.3): exactly half the Parts declare a
  country of manufacture, so the coverage panel exhibits all three
  meter states with real tiers (0 percent: Assembly/Product; 50
  percent: Part; 100 percent: Supplier). The invariant test requires
  one tier in each state, so fixture edits cannot regress the panel
  to an all-or-nothing display.
- Layout (5.4): the data row is HALF the window (was a 240px strip);
  within it the table takes the remaining ~60 percent beside a 40
  percent chart pane, with a larger page size.
- Schema Dashboard retired (5.5, ruling 8.4): fold/remove matrix in
  planning/schema-dashboard-retirement.md following the flagship
  precedent. MatrixView and SankeyView relocate to full-width
  Analytics tabs; SchemaView keeps its Storybook coverage with the
  concept demonstrated live in the workbench hierarchy. Retirement
  audit found SankeyView had NO test suite; it switched to the
  ECharts SVG renderer (equivalent at type-graph scale, jsdom-capable)
  and gained a smoke suite. The router test migrated to pin the
  relocated home.
- Suite: 126 files / 1166 tests.

## Review remediation, Round 2 slice 5 (pin/icon coexistence, multi-drag, popover; ROUND 2 COMPLETE)

Executes plan items 4.7, 4.8, and 4.13, closing Round 2. Bundle
budgets raised per ratified review direction with ledger entries:
core 140 -> 160 KB (measured 139.1), react 384 -> 420 KB (measured
379.9 before this slice, 381.7 after).

- Pin badge + encoding icon coexistence (4.7): the pinned-node
  background stack ([icon, badge]) was composed point-in-time at
  pin/theme changes only, while spec application can (re)stamp \_icon
  afterwards; since the pinned-class rule sources background-image
  from \_bgStack, a later icon never showed under the badge (read as
  "pin and custom icon cannot render together"). The composition is
  now an exported single-truth helper (composePinStack) called from
  BOTH \_icon write paths: the pin effect and the spec-patch effect.
  Unit pins cover coexistence, badge-only, and the
  re-composition-after-icon-arrives sequence that was the bug.
- Multi-select drag (4.8): the toolkit never calls cy.select() (its
  selection is CSS classes), so cytoscape's native
  drag-selected-together never engages. The canvas reconstructs it:
  grabbing a store-selected node anchors a group; the anchor's delta
  applies to every other selected unlocked node (pinned nodes are
  locked and stay put); free ends the group. Structural scenes are
  excluded (port/compartment drags own their wiring). Simulated
  grab/drag/free tests pin the delta math, the pin exemption, group
  teardown, and the no-group cases.
- Edit-appearance popover (4.13): fixed positioning clear of the
  380px right panel by construction, escaping the canvas section's
  overflow clipping.
- Suite: 125 files / 1161 tests.

## Review remediation, Round 2 slice 4 (popout, inspector, collapse counterpart)

Executes plan items 4.10, 4.11, and the 4.12 remainder.

- Neighborhood popout (4.10): "View Neighbors" opens a floating
  second graph view (hierarchical breadthfirst, default from the
  configured hop count, +/- stepper bounded 1..max, close) instead of
  selecting the whole neighborhood on the main canvas. New toolkit
  pieces: core `khopNeighborhood` (BFS composed with buildSubgraph,
  so the working-set cap and truncation flag match the scale
  drill-in; the header states truncation rather than dropping nodes
  silently) and `NeighborhoodPopout` in @g3t/react. The hop count no
  longer appears in the menu label.
- Inspect (4.11): the toolkit action emits a typed `context:inspect`
  event alongside selection; the Analytics dashboard wires it to a
  floating NodePropertyInspector panel with a close affordance.
- Collapse Neighbors (4.12 remainder): new toolkit action, offered
  only when the node has selected neighbors (wired-or-absent),
  removing them via the new `removeNodesFromSelection` on the
  selection store (the symmetric half addNodesToSelection lacked).
- Test-architecture note: a toolkit component composing another
  toolkit component internally (popout -> canvas) bypasses consumer
  partial mocks of "@g3t/react"; consumer tests stub the composed
  component at the package boundary and its internals keep their own
  suite.
- Suite: 124 files / 1156 tests. BUDGET FLAG: @g3t/core 139.1/140 KB
  and @g3t/react 379.9/384 KB are both at 99%; the next substantive
  toolkit addition breaches without a raise (decision needed).

## Review remediation, Round 2 slice 3 (emphasis/effects layer)

Executes plan items 4.6 and the 4.12 relabel/direction fix.

- Emphasis layer (4.6 / CY-2): new `useEmphasisStore` in @g3t/react
  plus `applyEmphasisClasses`, mirroring the selection-sync
  architecture (store subscription, CSS classes in a batch, initial
  apply on instance rebuild). The contract, pinned in tests: effect
  edges take a distinct amber class, everything outside the effect
  dims to 0.15 opacity, and effect NODES carry no class at all, so a
  computed route can never read as a selection. Stale ids in an
  effect never throw against a rebuilt instance.
- Adoption: the supply thread's "Shortest route to selected" and the
  Analytics find-path consumer both replace `selectNodes(path)` (the
  review's antipattern) with the effect; the supply status chip gains
  a clear affordance that drops the effect.
- Direction fix (4.12): "Find Paths From Here" is now "Find Paths To
  Here", and the payload flips to match the actual interaction order
  (the pre-selected node is the source; the right-clicked node is the
  destination). The dashboard test pins the direction in the status
  text and pins that the clicked node is NOT selected afterward.
- Two cytoscape fakes (canvas suite, README quickstart twin)
  completed with the class methods real collections provide.
- Suite: 123 files / 1148 tests; @g3t/react 375.7/384 KB.

## Review remediation, Round 2 slice 2 (graph chrome adoption, validation delta)

Executes plan items 4.1, 4.2, and 4.5. Finding worth recording: the
toolkit ALREADY shipped a complete GraphToolbar (rounds 15-16: search
with zoom-to-match, deliberate layout runs with an options popover,
pin-all, zoom/fit, export, reduced-motion-aware animations); the
review gap was adoption, not construction, and this slice nearly
rebuilt it before inventorying the toolbar directory.

- Toolbar adoption (4.1/4.2): the Ontology Workbench mounts
  GraphToolbar on all three graph views (hierarchy, neighborhood,
  instances; one live-Core handle that resets on tab switch since the
  old instance is destroyed), and the Scale surface mounts it over
  its canvas, which previews plan 5.14 (layout switching and search
  against the 8k-node supernode view and drilled clusters). Toolbar
  layout runs already honor prefers-reduced-motion, so the RM finding
  (reduced motion demonstrable nowhere) closes with adoption.
- Validation delta panel (4.5): the workbench SHACL view lists which
  violations inference RESOLVES (aquila2's hasSubsystem, satisfied by
  the materialized inverse) and which it INTRODUCES (gsAlpha's
  missing callSign, reachable only via entailed typing), computed
  over both toggle states so the panel explains the toggle rather
  than following it. This closes the premise-0.2 legibility gap
  (a disappearing severity badge previously read as a bug).
- Hierarchy legend now names the equivalentClass edge.
- Suite: 122 files / 1144 tests.

## Review remediation, Round 2 slice 1 (stable encoding, legends, callout bubble)

Executes plan items 4.4, 4.3, and 4.9; the remaining Round 2 chrome
(toolbar, search, effects layer, neighborhood popout, pin badge,
multi-select drag, inspect wiring, validation delta panel, popover
positioning) follows in the next slice.

- Stable categorical encoding (4.4): `CategoricalScale` gains an
  explicit `domain`. Domain values take palette slots by POSITION;
  encounter-order assignment (which reshuffled colors on every
  projection rebuild, the workbench's "colors change per tab"
  finding) now applies only to out-of-domain extras, after the
  domain. Both categorical resolvers (color, shape) seed from it and
  `categoricalColorMap` lists domain values first, so legends render
  a stable sequence. Four contract tests pin reversed-traversal
  invariance, legacy no-domain behavior, extras never stealing
  domain slots, and domain-first map order.
- Legends (4.3): `SpecLegend` gains `labelFor` (display transform;
  resolution keys stay raw) and orders categorical rows by domain.
  The workbench builds one spec whose domain is the store's class
  universe, passes it to the instances AND neighborhood canvases, and
  overlays a floating collapsible legend with IRI-shortened labels; a
  shell test pins that both views carry the identical domain.
- Callout bubble (4.9): `CapabilityBubble` renders a fixed
  bottom-right button opening the "Built on the toolkit" panel in a
  popover (the in-rail placement kept scrolling below the fold). All
  five shells swapped; same {accent, items} contract.
- Suite: 122 files / 1144 tests; @g3t/react 372.3/384 KB.

## Review remediation, Rounds 0-1 (correctness)

Executes planning/review-remediation-plan.md items 2.1-2.7 and
3.1-3.8 (all P0 correctness findings from the 2026-07-06 review).

- Windows portability: every `read_text()` in the spec scripts now
  passes `encoding="utf-8"` (gates previously required a local patch
  on Windows).
- Compartment collapse WORKS (3.3): new `useStructuralCollapse` hook
  in @g3t/react closes the store -> re-layout -> decorations loop
  that only a Storybook story carried before, which left the collapse
  chip rendering as a dead control in MBSE and the workbench. Both
  shells adopt it; MBSE also registers the collapse context menu
  (button AND right-click per the 3b ruling); the story now consumes
  the hook.
- Edge routing (3.4): routed structural edges no longer depend on
  data() mapping of segment-distances/weights (flagged in-code as
  browser-unverified; the review reported odd routing). A per-element
  style bypass mirrors the data truth at scene mount and after every
  drag write-back, verified on a headless style-enabled instance and
  pinned in lockstep with data writes.
- Workbench projection split (3.1/3.2): display and validation UGMs
  are separate models. The old dual-keyed projection leaked synthetic
  display keys into the closed-shape check (false violations on
  gsBravo) and IRIs into table columns. gsAlpha's only
  inference-state violation is now the missing callSign. Fixing the
  acceptance test also exposed a seed-ontology modeling flaw: the
  symmetric communicatesWith had range GroundStation, so the reasoner
  faithfully typed satellites as ground stations; the range is now
  System and a non-symmetric uplinksTo carries the range-entailment
  demo (regression-pinned).
- Hierarchy equivalence (3.7): an owl:equivalentClass pair renders as
  one equivalentClass edge; the reasoner's mutual-subclass encoding is
  suppressed in the hierarchy view.
- Analytics (3.5): the centrality-vs-risk scatter charted a `risk`
  property no fixture node carried (empty chart). The supply fixture
  now computes a deterministic risk model (geographic base,
  single-source concentration, downstream max-propagation) with
  invariant tests. StatsPanel histograms bin integer domains one per
  integer with integer labels, handle single-value domains, and use
  compact labels (the fixed-20-bin construction read as broken x
  bounds).
- ShaclShapeBrowser (3.6): target IRIs display as shrinkable local
  names (full IRI on hover) and badges can no longer be pushed out of
  narrow rails; the three badge states are explicit and tested.
- Supply thread (3.8): suppliers seed hidden and "Expand suppliers"
  REVEALS them (the old action only grew the selection on a fully
  drawn graph); the item appears only when the node has hidden
  suppliers, per the wired-or-absent contract. Hidden state lives in
  a small zustand store so menu closures read it at event time.
- Menu hygiene (2.5): the duplicate pin entry is gone; pin-position
  is the single pin concept per node.
- Test hygiene (2.7): dashboard act() warnings fixed by the
  cleanup-before-store-reset ordering; echarts DOM-size warnings
  silenced via an opt-in jsdom dimension stub for chart-mounting test
  files. Scale supernode labels no longer embed member counts (2.3;
  the count is data and rendered once).
- Suite: 122 files / 1139 tests.

## Ontology Workbench capability surface

- New demo shell (`src/demo/ontology/`, fourth capability card):
  Protege-style browsing over a seeded spacecraft ontology with an
  Asserted|Inferred toggle backed by a demo RDFS-plus reasoner (all
  inferences flagged). Views: class hierarchy, k-hop neighborhood,
  class-scoped instances with TableView, SHACL shapes via the core
  structural pipeline (ELK, cardinality rows, closed borders, row
  severities, ShaclShapeBrowser), and preset SPARQL.
- RDF import: Turtle family (n3) and JSON-LD (jsonld), lazy-loaded,
  playground-only; RDF/XML declined with a riot-conversion message.
- Tests: 22 pure + 4 shell contract + routing; suite 117/1112.

## [1.0.0-rc.2] - 2026-06-10

### views/coverage landed; coverage barrel resolved (2026-06-22)

- **Added** `packages/react/src/views/coverage/` (CoverageMeter,
  CoverageMeterList, CoverageState; 10 tests, strict typecheck clean). This
  resolves the dangling `export * from "./views/coverage"` in the
  `@g3t/react` barrel that had blocked the flagship's CoveragePanel and the
  demonstration-surface items DS1, DS3, and the DS2 chart sub-part.
- **Removed** the build-time coverage-stub workaround now that the real
  directory exists: the `g3t-coverage-stub` resolveId hooks in
  `vite.sb-client.config.ts`, `vitest.sb.config.ts`, and
  `vite.demo.config.ts`, plus `scripts/storybook-static/coverage-stub.ts`.
  Leaving the hooks would have shadowed the real component with the empty stub.

### Structural edge-routing render + Minimap + demo view-switch (2026-06-22)

- **Added** a Minimap component (`@g3t/react`, interaction/camera;
  Molecules/Minimap): a canvas overview with a draggable viewport rectangle
  that pans the main view on click/drag. Compound containers draw as one
  rectangle (not a dot per child row/port); edges route between top-level
  ancestors; an optional `nodeFilter` hides rendering-only nodes (the demo
  drops structural ports). Wired into the gallery and overlaid on the
  standalone demo in both views. Added `CameraController.panToPoint(x, y)`.
- **Landed** the obstacle-aware routing CONVERTER slice:
  `structural-to-cytoscape.ts` projects ELK route polylines onto
  `curve-style: segments` for body and synthetic-point-port edges, with the
  taxi as fallback when `routeEdges` is off or a route has no interior bend;
  declared-port edges keep the perpendicular taxi exit on purpose.
  Headless-landed; the rendered result ships for visual review (VA-31).
- **Added** the standalone demo's Graph/Structural view-switch with an ELK
  direction toggle (`scripts/demo`).
- All gate-green headlessly (test, lint, typecheck) against the partial
  sandbox baseline; rendered behaviour awaits Zach's live review.

### Flagship packaging + integration guide (2026-06-17): build section 4

- **Added** `examples/flagship/package.json` (private @g3t/flagship-example;
  declares the packages as workspace:\* and carries @g3t/react's heavy peer
  deps so the published packages stay light), `tsconfig.json` (extends the
  base), and `INTEGRATION.md` (the sandbox-alias cleanup list, the
  module->toolkit-surface wiring map, the bundle-budget procedure, and the
  live-review checklist).
- Verified every direct flagship import is declared. The composition-first
  build (steps 1-6) is complete and packaged.

### Flagship interactive epilogue (2026-06-17): build step 6

- **Added** `examples/flagship/src/epilogue.ts` (epiloguePanels: the
  exploration controls, grounded in EPILOGUE_SURFACES) and
  `shell/EpilogueShell.tsx` (composes the existing GraphToolbar, SearchBar,
  FilterBuilder, LayoutSwitcher, AlgorithmPanel, NodeStyleEditor around the
  canvas; search/filter route to selection, tap opens the style editor).
- The panel spec is tested; EpilogueShell typechecks against transcribed
  signatures with the real EncodingSpec/LayoutEngine types. Its render is a
  live-review item. Completes the composition-first build (steps 1-6).

### Flagship brand theme + brief export + workspace (2026-06-17): build step 5

- **Added** `examples/flagship/src/theme.ts` (NORTHWIND_THEME via the
  toolkit's createTheme), `brief-export.ts` (the cited subgraph exported as
  Turtle/JSON/CSV via exportSubgraph\*), and `workspace-snapshot.ts`
  (captureWorkspace/serializeWorkspace). The decision beat brands the
  toolkit; the brief beat takes the pursuit away as portable artifacts + a
  snapshot.
- 5 tests exercise the REAL toolkit functions (brand theme passes WCAG with
  no warning; the subgraph exports in three formats; the snapshot carries
  the encoding spec). Backs the s.theme / s.export / s.workspace credits.

### Flagship teaming + provenance path (2026-06-17): build step 4

- **Added** `examples/flagship/src/teaming.ts` (buildPartnerGraph +
  teamingNeighborhood: the partner subgraph pulled in and focused via the
  toolkit's buildNeighborhoodUGM) and `provenance-path.ts`
  (evidencePathForConcept via the toolkit's findShortestPath, for the drill
  overlay).
- 7 tests exercise the REAL toolkit graph functions: ORCA's neighborhood
  reaches the gap concept within 2 hops; the concept->evidence path is
  found with edge ids for highlighting. Backs the s.neighbors / s.path
  beat credits.

### Flagship DetailInspector wiring (2026-06-17): build step 3 complete

- **Added** `shell/InspectorPanel.tsx` (the toolkit's DetailInspector over
  the meaning UGM) and stage helpers `drillTargetForBeat` /
  `inspectorSelectionForBeat`. FlagshipShell now annotates and exposes the
  meaning UGM, gates the inspector from the two-weaknesses beat, and drives
  its selection from the active drill node.
- Fully headless-verified (DetailInspector is React-only): render tests
  confirm the inspector shows a concept's analytic attributes (state,
  coverage). Engine 73, react 55, eight tsc configs clean.

### Flagship LinkedChart integration (2026-06-17)

- **Added** `examples/flagship/src/coverage-pipeline.ts`: a real
  DataPipeline driving the toolkit's existing ECharts LinkedChart in
  scatter mode (each required concept a point at substantiated x claimable,
  with a y=x honesty diagonal; points above the line are exposed). query()
  reads both strengths from the meaning UGM; reverseMap() links a clicked
  point back to concept selection. `shell/CoverageChart.tsx` is the thin
  wrapper. `annotateForEncoding` now writes the coverage strengths onto nodes.
- 3 pipeline tests verify the rendered data and the selection mapping; the
  pipeline typechecks against the real DataPipeline/ScatterData types.

### Flagship real stage wiring (2026-06-17)

- **Added** `examples/flagship/src/stage.ts` (pure stage director: which
  EncodingSpec and layout per beat; the raw->meaning spec swap is restyle-
  only on one stable layout), `camera-directives.ts` (maps a beat's
  CameraDirective to the camera controller), and `shell/StageCanvas.tsx`
  (the real stage: CytoscapeCanvas + per-beat spec + camera + highlight).
- 9 headless tests cover the director (swap happens once, at
  consolidate->project) and the camera applier (every directive maps).
  StageCanvas typechecks against the real camera/encoding types; its live
  render is the browser-review artifact.

### Flagship per-beat toolkit credits (2026-06-17)

- **Added** `examples/flagship/src/toolkit-credits.ts`: a registry of the
  19 toolkit surfaces the demo composes, and a `toolkit: string[]` field on
  every beat naming the components it wires together. `shell/ToolkitCredits`
  renders the on-screen "Powered by" credit per beat.
- 23 grounding tests scan the real `@g3t/react` / `@g3t/core` / `@g3t/charts`
  sources and assert every credited name is a genuine export, so a credit
  cannot drift into fiction. The walkthrough is verified to span >=10
  distinct surfaces and to be mostly existing toolkit (<=3 demo-built).

### Flagship stage encoding (2026-06-17): the toolkit owns the visual logic

- **Added** `examples/flagship/src/encoding.ts`: RAW and MEANING
  `EncodingSpec`s plus `annotateForEncoding`. The stage's visual meaning is
  produced by the toolkit's shipped encoding system (node size <-
  substantiated, color <- the three states, shape <- type; edge color <-
  supports/contests, width <- weight), not by bespoke drawing. The Act I->II
  transition is a spec swap (restyle-only) on the same layout.
- 9 tests resolve the specs against the real meaning UGM with the toolkit's
  `applyEncodingSpec` and assert the produced color/size/shape/edge mapping;
  proof that the toolkit, not the demo, owns the stage.
- Part of the Option 1 (composition-first) redesign:
  `planning/flagship-plan-option1-redesign.md` supersedes plan §2-3, making
  each beat exercise a named existing toolkit surface.

### Flagship cinematic shell, started (2026-06-17): composition + panels + transport

- **Added** `examples/flagship/src/shell/`: the slot-based cinematic shell.
  FlagshipShell composes the real engine, the real toolkit components
  (CoverageMeter, ProvenanceTrace), and the beat-runner into a narrated
  walkthrough with a transport (play/pause, prev/next, replay, scrub). The
  graph stage is a `renderStage` slot; production fills it with
  CytoscapeCanvas + the camera controller. Sub-components: NarrationBar,
  Transport, CoveragePanel, BriefPanel (two faces), ProvenancePanel.
- 9 jsdom tests cover panel gating, transport, the stage slot's beat
  props, and drill wiring. A self-contained visual-acceptance page renders
  the real shell with a real-data SVG stage stand-in (`scripts/shell-va`).
- Not yet: the real CytoscapeCanvas stage + camera wiring, the Act I->II
  cross-fade (§2b), and the branded theme (§2e); these are the live-review
  items (see the acceptance ledger).

### Flagship narrative beat-runner (2026-06-17): the §2f transport

- **Added** `examples/flagship/src/narrative.ts`: the ten walkthrough
  beats as declarative data (act, narration, op, camera directive,
  encoding layer, highlights) plus a pure, total transport reducer
  (play/pause/toggle, next/prev, goTo, replay, tick) with selectors. No
  React/Cytoscape/toolkit dependency; the shell maps each beat's camera
  directive onto `createCameraController`. 10 tests, including an
  integrity check that every beat id resolves against the engine corpus.

### Camera controller (2026-06-17): programmatic viewport moves

- **Added** `createCameraController(cy)` to `@g3t/react`
  (`interaction/camera`): a thin wrapper around `cy.animate`/`cy.fit`/
  `cy.center` exposing `focusNodes` (zoom-to-subgraph), `panToNode`
  (center without zooming), `frameAll`, and `resetView`, with per-call
  and controller-level padding/duration/easing. Reduced motion is the
  caller's decision via the `animate` option; duration 0 or animate:false
  applies instantly. Reachable via `CytoscapeCanvas` `onReady(cy)`. 12
  tests (spied cy mock). Same bundle-budget note as the other §2
  components (see the acceptance ledger).

### ProvenanceTrace (2026-06-17): drill-anywhere provenance panel

- **Added** `ProvenanceTrace` to `@g3t/react` (`views/provenance`): renders
  an ordered provenance chain (depth-indented, each hop clickable) from a
  derived conclusion to the raw evidence at the leaf, or to the documented
  ABSENCE of evidence for an exposed/gap concept. Presentational and
  reusable for any provenance-bearing graph. 7 render tests (jsdom).
- **Added** a flagship provenance builder (`examples/flagship/src/
provenance.ts`): a generic `buildProvenanceChain` walker (cycle and size
  guards) plus a `traceProvenance` adapter over the live engine artifacts.
  8 tests against the real engine.
- A self-contained visual-acceptance page with a drill-target picker
  (`scripts/provenance-va`).
- Same bundle-budget note as CoverageMeter: re-measure and bump the
  `@g3t/react` budget on landing (see the acceptance ledger).

### CoverageMeter (2026-06-17): two-strength coverage visualization

- **Added** `CoverageMeter` and `CoverageMeterList` to `@g3t/react`
  (`views/coverage`): a solid substantiated bar behind a ghost claimable
  bar, with the exposure delta drawn as a hatched band. Per-state accent
  (discriminator / exposed / gap / neutral). Presentational and
  dependency-light (React only); the consumer decides reduced-motion via
  the `animate` prop. Props align to the flagship `ConceptRelevance`
  shape but the component is generic target-vs-actual. 10 render-level
  tests (jsdom).
- A self-contained visual-acceptance page renders the real component from
  the real flagship engine output (`scripts/coverage-va`).
- NOTE for landing: the `@g3t/react` bundle budget had roughly 1.6 KB of
  headroom (about 302.4 of 304.0 KB). Adding this component requires
  re-measuring the bundle and bumping the react budget in
  `scripts/check-bundle-size.mjs` with a ledger entry. The delta is not
  measured in the build sandbox.

### Flagship two-strength engine (2026-06-17): substantiated vs. claimable

- **Added** a two-strength meaning model to the flagship example
  (`examples/flagship`). Each concept now carries `_substantiated` (the
  defensible bid floor: the prior single strength, unchanged) and
  `_claimable` (the proposal ceiling: substantiating efforts counted
  positively, plus adjacency reach and resume self-assertion). The
  per-concept gap between them is the exposure. Claimable is greater than
  or equal to substantiated by construction.
- **Added** the three honest states per required concept (discriminator,
  exposed, gap), an analytic that reports both a substantiated fit and a
  claimable fit, `traceTeaming` (surfaces a named partner with
  co-delivered evaluated converting evidence for each exposed or gapped
  concept), and a two-faced capture brief (internal truth vs. proposal
  story), every line provenance-bearing.
- **Added** ORCA Systems as a teaming partner and the TIDEGUARD joint
  past performance to the corpus; co-delivered work is surfaced only via
  teaming, never folded into the firm's solo strength.
- **Changed** `deriveActions` to team with a named partner (not a generic
  string) and to source discriminators from the two-strength state.
- **Removed** the single `_strength` concept property; consumers and
  tests move to `_substantiated` / `_claimable`.
- Worked example is unchanged in its headline: substantiated fit 68%,
  pursue-with-teaming. It now also reports claimable fit 94%, classifies
  Sustainment as exposed and Cyber Resilience as a gap, and closes both
  through ORCA. Pipeline logic tests go from 9 to 18.

### Mapping-warning sweep (2026-06-17): \_confidence flood + invalid outline-offset

- **Fixed** a second per-frame Cytoscape mapping-warning flood in the block
  view: the base `edge` rule mapped `opacity` to `data(_confidence)`, which
  warned for every structural connector (no `_confidence`) on every render
  frame. The mapping is now scoped to an `edge[_confidence]` rule. Same
  class of fix as the `data(_size)` one.
- **Fixed** an invalid `outline-offset: -2` on the selected structural-row
  rule. Cytoscape rejects negative `outline-offset` and discarded it at
  parse time (a one-time warning), so the intended inset selection ring
  never rendered. The inert override is removed; the row keeps its z-lift.
  A true inset (a theme-driven border, so a selected child does not grow
  the compound container into its ports) is a follow-up.

### Block-view lag fix (2026-06-17): data(\_size) mapping-warning flood

- **Fixed** a severe block-view stall (about 1.7 s on toggle) caused by the
  base `node` stylesheet rule mapping `width`/`height` to `data(_size)`.
  Structural block nodes size via `_w`/`_h` and carry no `_size`, so
  Cytoscape logged a mapping warning for every such node on every render
  frame, and the console flood blocked the main thread. The size mapping is
  now scoped to a `node[_size]` rule, so it applies only to nodes that
  carry `_size` (force and encoded nodes), and the per-frame warning stops.
  No change to how any node is sized.

### Toggle/filter lag round (2026-06-17): visibility filtering, layout animation off

- **Added** a `hidden?: ReadonlySet<string>` prop to `CytoscapeCanvas`
  (@g3t/react): a visibility filter applied as a batched `g3t-hidden`
  (display:none) class toggle. It is NOT in the canvas init dependency
  array, so changing it is a restyle, not a re-init: the Cytoscape
  instance and node positions survive, and Cytoscape auto-hides edges
  incident to a hidden node.
- **Changed** the four demo shells (Auditor, MBSE, Biomedical,
  SupplyChain) to filter by hiding rather than by rebuilding. They now
  pass the stable full UGM plus a computed `hidden` id set, instead of
  feeding a pre-filtered UGM as the canvas data; the old approach
  re-created the Cytoscape instance and re-ran layout on every checkbox
  toggle. The hidden-id derivation uses faceted semantics (a node is
  hidden only when ALL of its types are hidden), fixing a predicate that
  previously considered only a node's first type.
- **Changed** the demo canvases to `animate={false}`, so the force
  (node/edge) view is interactive immediately instead of blocking during
  an animated fcose layout.
- **Added** a "Filter by hiding, not by rebuilding" recipe to the wiring
  guide, with a matching executable twin in `examples/wiring`.

### Block-view freeze round (2026-06-17): structural-layout mount cost

- **Fixed** the MBSE demo Block view stalling the tab on entry. The root
  cause was a heavy synchronous mount (not a render loop): a throwaway
  force-directed canvas mounted before the structural geometry resolved,
  StrictMode double-invoked the layout effect in dev, and elkjs ran
  synchronously on the main thread with a fresh instance per call.
- **Changed** `layoutStructural` (@g3t/core) to reuse one shared ELK
  instance and de-dup layouts by input identity, so a repeated layout of
  the same input (StrictMode double-invoke, structural-view re-open) runs
  ELK once. Bypassed when a custom `measure` is supplied; cleared on
  rejection.
- **Added** an injectable `ElkEngine` seam to `layoutStructural`
  (`options.engine`, default the shared synchronous instance; exported
  from the core and layout barrels), so a caller can move layout off the
  main thread without coupling core to a bundler or Worker.
- **Added** a worker-backed ELK engine in the demo
  (src/demo/lib/elkWorkerEngine.ts) that runs structural layout off the
  main thread, with a graceful fallback to the synchronous engine if a
  Worker cannot be constructed.
- **Changed** the MBSE shell to show a skeleton placeholder while the
  block-view geometry computes, instead of flashing a force-directed
  canvas that is immediately discarded.

### Examples-coverage round (2026-06-16): showcase removed, dashboards reworked

- **Removed** the showcase example (and its standalone-page build): made
  redundant by the four dev-server scenario shells.
- **Changed** the decision-dashboards from two thin near-duplicates into
  two capability-first dashboards chosen by a gap analysis against the
  toolkit surface: AnalyticsDashboard (StatsPanel, bar + scatter
  LinkedChart, AlgorithmPanel, DerivedPropertyPanel) and SchemaDashboard
  (SchemaView, MatrixView, SankeyView, live Turtle export, QueryEditor).
  Together with the four shells these now demonstrate essentially every
  view, chart type, and major interaction feature.
- **Removed** both standalone-page builds (showcase-page, dashboards-page)
  and their vite configs; the examples remain as reference source.

### Demo-capabilities round (2026-06-16): surface more of the toolkit

- **Added** raster-image icon support: the encoding icon channel now
  accepts PNG/data-URI/URL values (not just SVG glyph names), so custom
  logos render on nodes. New `isImageRef` passthrough in spec-apply.
- **Added** collapse to SpecLegend (`collapsible`/`defaultCollapsed`/
  `title`), so the on-canvas legend can be tucked away.
- **Added** a demo FloatingInspector (draggable inspector overlay) and
  wired it into the Biomedical shell.
- **Changed** the four demo shells to surface more of the toolkit:
  GraphToolbar (with embedded search + layout controls) on all four; an
  AlgorithmPanel tab and floating-inspector toggle in Biomedical;
  custom PNG company icons in Supply Chain; a NodeStyleEditor
  "customize style" dialog in Supply Chain and MBSE.
- **Changed** the landing page: corrected stale counts, added a
  capability strip, refreshed styling and per-scenario tags.

### Demo-fixes round (2026-06-16): four-shell preferences + bug fixes

- **Fixed** TableView column-visibility menu had no way to close once
  open: added outside-click and Escape handling plus a close button.
- **Fixed** TreeView breadcrumb showed an arbitrary click trail; it now
  shows the ancestor path (root -> ... -> selected) from containment
  edges, and clicking a crumb navigates to that ancestor.
- **Fixed** context-menu actions (View Neighbors, Pin) did nothing in
  the structural block view: the canvas now resolves right-clicks on
  structural rows/headers to the owning container's node id.
- **Added** `categoricalColorMap(spec, ugm)` and a `colorForType` prop
  on FacetFilter, so type-filter swatches match the colors the canvas
  encoding actually assigns (previously sorted-index vs insertion-order
  disagreed).
- **Added** an `anchor` option to the demo ResizablePanels so the right
  rail holds a fixed width while the center flexes.
- **Changed** the demo: a docked Neighborhood tab (hops + layout
  controls) replaces the floating neighborhood overlay; the MBSE
  scenario is listed second and opens in the block view; the encoding
  panel defaults its color/size channels expanded.
- @g3t/react bundle budget 300 -> 304 KB (ledgered; the fixes touched
  five library components).

### Round 49 (2026-06-13): flagship capability showcase

- **Added** examples/showcase: a Neo4j-Bloom / Stardog-Studio class
  application exercising the full capability surface: a custom theme
  (Nebula) + custom accent palette + custom node icons; a 1000+ node
  graph; native g3t widgets (TableView datagrid, LinkedChart/ECharts)
  AND an external widget (Plotly) all linked through the shared
  selection store; mocked algorithm results (criticality/risk) driving
  size and a ranked panel; and an incident blast-radius decision trace.
- **Added** a "showcase-page" build producing a single self-contained
  HTML file (scripts/showcase-page/dist/showcase.html; all g3t inlined,
  Plotly from CDN) for live review including on mobile.
- Distinct from examples/decision-dashboards (which teaches the minimal
  integration pattern); the showcase pushes breadth.

### Round 48 (2026-06-13): dashboards reworked (scale, layout, app structure)

- **Fixed** the dashboards page growing vertically without bound: the
  canvas host used height:100% inside a content-sized grid row
  (Cytoscape content size grew the row, the row grew the canvas). Canvas
  hosts now use a fixed height with overflow:hidden and the grids
  declare an explicit row track.
- **Changed** the dashboard fixtures from toy size (6/11 nodes) to
  realistic scale (~35-component satellite across six subsystems; ~25-node
  supply network across four tiers), built from row data to mimic a
  query result.
- **Changed** the dashboards to teach application structure: a four-layer
  architecture (data/ingest boundary, derived signals, view config,
  wiring) split into a separate data module per domain, documented in
  the README and marked inline, so the integration surface is legible.

### Round 47 (2026-06-13): standalone dashboards HTML page

- **Added** a self-contained HTML build of the decision dashboards for
  live review on any browser, including mobile: scripts/dashboards-page
  (island + emitter), vite.dashboards.config.ts and
  vite.dashboards-emit.config.ts, and a "dashboards-page" npm script.
  The page bundles both dashboards with a domain switcher and theme
  toggle into one file (zero external references). The graph itself is
  not pre-rendered (CytoscapeCanvas needs a live DOM); the page runs
  the dashboards live in the browser. Separate pipeline from the
  visual-acceptance build.

### Round 46 (2026-06-12): cross-domain decision-dashboard examples

- **Added** examples/decision-dashboards: two reference dashboards
  showing graph visualization wired into a decision workflow across
  domains. `ConformanceDashboard` (systems engineering: SHACL design-
  gate review of a satellite subsystem) and `ImpactDashboard` (supply
  chain: centrality-driven choke-point sizing + downstream blast-
  radius trace). They share one spine (a UGM substrate, computed
  signals driving the encoding, selection linking canvas to panels)
  while using deliberately different machinery, evidencing that the
  "graph-in-a-decision-dashboard" capability is reusable across
  domains. README tells the narrative; 7 headless tests cover the
  domain logic. The pre-existing full-workspace example remains as the
  layout-shell reference.

### Round 45 (2026-06-12): A3 UML edge vocabulary + VA checklist

- **Added** A3 UML edge symbols (completing Group A's styling):
  `StructuralEdge.kind` (association/composition/aggregation/
  generalization/dependency) maps to Cytoscape arrow shapes (filled/
  hollow source diamond, hollow target triangle, dashed dependency).
  A direct converter mapping (arrow shapes are an edge concern, not
  the node-shape channel); colors stay theme-reactive. VA-27 shows
  all four symbols.
- **Added** planning/visual-acceptance-checklist.md: a consolidated
  pass/fail checklist for every unverified structural/SHACL feature
  (rounds 31-45), flagging the still-open dagre verdict.
- **Changed** @g3t/react budget 297 -> 300 KB (ledger: +0.1 KB, the
  UML edge rules).

### Round 44 (2026-06-12): linked SHACL shape + data views (B4)

- **Added** SHACL linked views (B4, the last substantive piece of
  R1.17): `shacl-links` (`resultTargets`, `resultSelectionIds`,
  `resultDetail`, `resultsForFocusNode`) ties a validation result to
  its cross-canvas highlight targets. Selecting a result feeds
  `resultSelectionIds` to the shared selection store, highlighting the
  focus node (data canvas) and the source shape container + offending
  property row (shape canvas) at once. Pure selection-store reuse, no
  new machinery. VA-30 demonstrates the three-panel linked view.
- **Changed** @g3t/core budget 128 -> 130 KB (ledger: +0.1 KB, the
  linking module).
- R1.17's one remaining item is wiring `resultDetail` into the
  production DetailInspector (shaping built and tested).

### Round 43 (2026-06-12): selected-row outline no longer expands the container

- **Fixed** a selected structural row growing the container border
  into the ports: a child's selection outline expands the compound
  parent's bbox, so the global gasket ring (outward offset) pushed the
  container border outward on selection. Structural rows now use an
  INSET selection outline (negative offset), keeping the container
  bbox stable; the ring stays fully visible via the existing z-lift.

### Round 42 (2026-06-12): port border offset

- **Fixed** structural ports encroaching on the container: ELK puts
  the port's inner edge on the boundary line, but Cytoscape strokes
  the container border centered on the bbox edge, so its outer half
  crossed into the port (and the port's own border compounded it).
  Ports now offset outward by the border width (2px) in their mounted
  direction. Drag-follow unaffected.

### Round 41 (2026-06-12): structural dark-mode fix

- **Fixed** structural/compartment views rendering light in dark mode:
  STRUCTURAL_RULES hardcoded light hex colors (Cytoscape cannot read
  CSS variables, so they never tracked the theme). Split into
  structure-only STRUCTURAL_RULES plus a new theme-reactive
  `structuralThemeRules(theme)` (exported), composed after
  themeColorRules and recomposed on theme change. The SHACL shape view
  and per-row severity badges become theme-correct through the same
  rules.

### Round 40 (2026-06-12): VA review fixes

- **Fixed** multi-canvas overlay cross-contamination: the overlay
  store is a global singleton, so on a page with several canvases an
  overlay registered for one canvas's nodes dimmed the others. The
  overlay effect now ignores overlays that reference none of its own
  elements (single-canvas apps unaffected). The deeper global-store
  design point is logged in roadmap/human-actions.md.
- **Added** sh:severity support to `ShaclPropertyConstraint`: a
  constraint may declare its result severity, overriding the per-check
  default. Lets reports carry all three tiers (violation/warning/info).
- **Added** a compartment-scoped collapse menu action: right-clicking
  a compartment row/divider toggles only that compartment; the
  container header still toggles all. No engine change (the cxttap
  target already carries the row's parent and compartment).
- **Changed** @g3t/react budget 294 -> 297 KB (ledger: +1.5 KB for the
  overlay scoping guard and the row-collapse action).

### Round 39 (2026-06-12): SHACL validation report over the data graph (B1)

- **Added** SHACL validation-report visualization (R1.17, the report
  half of the SHACL story): a versioned `ShaclReportDocument`,
  `reportFromValidationResults` adapter from the in-core validator,
  `severityOverlays` (one toggleable overlay per severity tier over
  focus nodes, optional path-edge emphasis), `shaclResultDrivers`
  (per-node `_shacl_resultCount`/`_shacl_maxSeverity` encoding
  drivers), and `reportFocusNodes`/`resultsForShape` filtering
  helpers. A pure reuse slice over the shipped overlay + encoding
  machinery; VA-29 demonstrates it over the data graph.
- Severity COLOR is driven by the encoding spec (`_shacl_maxSeverity`)
  rather than per-tier overlay classes (deviation recorded in
  shacl-views.md; the union overlay-membership rule collapses tier
  identity, and the driver path reuses the legend/restyle semantics).
- **Changed** @g3t/core budget 124 -> 128 KB (ledger: +1.9 KB, the
  report module, pure core).
- **Added** roadmap/human-actions.md for items deferred to human
  judgment (first entry: improve SHACL fixture realism).

### Round 38 (2026-06-12): SHACL shape-view polish (VA-28 review)

- **Fixed** closed-shape header label clipping (header text estimator
  under-measured the bold guillemet-bearing «NodeShape» string; widened
  to 9px/char + margin).
- **Changed** the shape compartment label "constraints" -> "properties"
  (SHACL sh:property shapes).
- **Added** edge labels: `StructuralEdge.label`, rendered by the
  converter (autorotate, white halo); SHACL reference edges are
  labeled with the property path carrying sh:node.
- **Added** an explicit SHACL coverage matrix to
  roadmap/design/shacl-views.md documenting what renders today vs the
  spec gap (sh:class/sh:node parsing, logical operators, path
  expressions, severity/order/targets) as parser-dependent follow-on.

### Round 37 (2026-06-12): SHACL shape view through the compartment API (B3)

- **Added** the SHACL shape view as a second client of the structural
  compartment API (Group A's exit criterion): `shaclShapesToStructural`
  maps `ShaclShape[]` to the same `StructuralGraphInput` the UML views
  use (NodeShape containers, property-constraint rows as
  `path : xsd:type [min..max]` with a `(+n)` value-constraint chip),
  with no parallel rendering engine. `shaclRowSeverities` badges exact
  property rows from a validation report (worst-severity-wins);
  `closedShapeIds` drives closed/open borders.
- **Added** a `StructuralDecorations` converter arg and a
  `structuralDecorations` CytoscapeCanvas prop: closed/open container
  borders and per-row violation/warning/info severity classes
  (SHACL-agnostic; any client can decorate). VA-28 demonstrates the
  shape view live with a report toggle.
- **Changed** @g3t/core budget 120 -> 124 KB (ledger: +1.5 KB for the
  SHACL mapper, pure core).
- B2 (shape view on plain child nodes) was subsumed into B3 since
  Group A shipped first; the view was built directly on compartments.

### Round 36 (2026-06-12): compartment collapse canvas slice

- **Added** the compartment-collapse store
  (`useCompartmentCollapseStore`) and the built-in
  "Collapse/expand compartments" context-menu action
  (`registerCompartmentCollapseActions`), completing R1.18's
  per-container collapse surface. The store holds collapsed
  `${node}::${compartment}` keys; the menu filters to structural
  containers and toggles their compartments; the host subscribes and
  re-runs layoutStructural (the canvas needs no collapse code). The
  container element now carries `_compartmentIds` for the menu.
- **Changed** VA-27 to drive collapse through the real store
  (right-click per-container surface + a config-default button).
- **Changed** @g3t/react budget 288 -> 294 KB (ledger: +5.8 KB for
  the store and menu contribution).

### Round 35 (2026-06-12): ports rendered fully outside the container

- **Fixed** ports to sit completely outside the container, flush to
  the edge, by making them TOP-LEVEL SIBLINGS instead of children: a
  Cytoscape compound parent always grows to enclose its children, so
  a child port can never escape it (rounds 33-34 fought this and
  could not win). The converter now uses ELK's outside port
  coordinates verbatim.
- **Added** `wireStructuralPortDrag` (auto-wired by the
  CytoscapeCanvas structural path): sibling ports do not inherit the
  compound drag-along, so this offsets a container's ports by its
  drag delta.
- **Changed** @g3t/react budget 285 -> 288 KB (ledger: +1.2 KB for
  the drag helper; the round-34 entry forecast this).

### Round 34 (2026-06-12): port straddle fix + compartment collapse

- **Fixed** ports to straddle the container boundary (center on the
  border line) instead of clamping fully inside, so they read as
  sitting on the edge (round 33 over-corrected). Small symmetric
  bbox inflation is the accepted tradeoff under compound parents.
- **Added** compartment collapse (R1.18): StructuralCompartment
  `collapsible` flag and a `collapsedCompartments` option on
  layoutStructural (keyed via the new `compartmentKey` helper); a
  collapsed compartment shows a hidden-count divider and omits its
  content rows so the container shrinks. Collapse is a layout-time
  input: toggling re-lays-out, never a style hide. Design (two toggle
  surfaces: component config + per-container action) in
  roadmap/design/structural-rendering.md; config surface demonstrated
  in VA-27 with two toggle buttons. Wiring-guide recipe + twin added;
  the per-container store and context-menu contribution land next.

### Round 33 (2026-06-12): structural rendering A3 polish (VA-27 review)

- **Changed** structural containers to rounded rectangles with
  matching header/bottom-row corners; ports are larger (default 12)
  and border-only (no fill, ready for direction glyphs); ports clamp
  flush inside the boundary, fixing the doubled container line
  (compound bbox inflation from straddling ports); selected rows
  z-lift so the full accent ring shows over zero-gap siblings; plain
  nodes label with their id when headerless (the "empty box").
- **Changed** VA-27 fixture: port sides follow the layout direction
  (SOUTH/NORTH under DOWN), fixing the vertical port-to-port routing.

### Round 32 (2026-06-12): structural rendering slice A2 (canvas application)

- **Added** `structural` prop on CytoscapeCanvas plus
  `structuralToCytoscapeElements` / `STRUCTURAL_RULES` (@g3t/react):
  the StructuralGeometry document renders as a preset-positioned
  scene: compound containers with synthetic header strips, selectable
  drag-locked compartment rows (id-matching pattern wires
  selection/inspector machinery unmodified), divider/header
  furniture, decoration ports (promotable to selectable later by
  design), port-attached edges. Structural scenes never run force
  layouts and skip encoding-spec application.
- **Added** VA-27: live three-block fixture with a DOWN/RIGHT
  re-layout toggle; doubles as the dagre verdict's visual surface.
- **Changed** @g3t/react budget 280 -> 285 KB (ledger: +4.8 KB for
  the structural scene renderer; elkjs remains build-external).
- Review threads closed: round-25 item 5 was an erroneous list
  continuation; ports confirmed promotable-but-decorations in A2.

### Round 31 (2026-06-12): structural rendering slice A1 + tracking consolidation

- **Added** structural rendering geometry in @g3t/core (Group A
  slice A1, R1.18 in-progress): `layoutStructural` produces a
  versioned `StructuralGeometry` document (absolute boxes) for
  compound containers with typed compartment rows as REAL elements
  and fixed-side boundary ports, laid out by ELK per a
  spike-validated recipe (explicit pre-measured equal row widths,
  synthetic chain edges for order, layered-DOWN zero-spacing
  containers, SEPARATE_CHILDREN root). 12-test suite; wiring-guide
  recipe with executable twin; design record
  roadmap/design/structural-rendering.md (ipyelk findings, recipe,
  failures, slice plan). elkjs remains build-external (core
  116.0/120 KB, ledger noted).
- **Answered (headless)** the dagre question: elk.layered handles
  compound DAGs (53ms, strict layering); dagre stays unbundled
  pending visual spot-check.
- **Consolidated** tracking docs: PROGRESS.md and planning/status.md
  archived verbatim to planning/milestone-history.md and removed;
  durable lore promoted to DEVELOPER.md; STATUS.md and
  roadmap/CLAUDE.md rollups corrected (user stories had been
  conflated into proposed-requirement counts since round 27; gate
  scripts were authoritative all along).

### Round 30 (2026-06-12): roadmap regrouped

- Queue restructured into sequenced functional groups: ELK
  structural rendering first (compartment API as the shared reuse
  point), SHACL consuming it (report-viz slice independent), then
  provenance affordances, analyst workflow, visualization
  algorithms, streaming, continuous platform work; dagre decision
  folded into the ELK evaluation.

### Round 29 (2026-06-12): SHACL views on the roadmap

- New proposed requirements: SHACL shape view (containers,
  constraint summaries, reference/target edges) and validation-report
  visualization (severity-tier overlays, counts as encoding drivers,
  inspector detail, shape cross-highlighting); design record in
  roadmap/design/shacl-views.md; report slice rides shipped
  machinery.

### Round 28 (2026-06-12): roadmap descope

- Sankey (and its flow-cap default) removed from the roadmap with
  spec tombstones; partial code remains uncommitted.
- Algorithm roadmap narrowed to visualization-only (embeddings as
  layout, overlay set algebra); async runners and GraphBLAS batch
  shapes removed.
- Virtualization rescoped to visualization affordances (source
  indication + provenance on virtualized nodes); connector
  requirement removed; relational-virtualizer demoted to host-side
  utility.

### Round 27 (2026-06-12): status + handoff

- STATUS.md: live-numbered repo and roadmap snapshot with the
  priority-ordered queue.
- Root CLAUDE.md rewritten as a lean agent handoff (gates, editing
  discipline, doctrine, working agreement, open threads).

### Round 26 (2026-06-12): review findings + export

- Pin badge: filled, theme-accent fill with canvas halo, fixed-pixel
  size (container-safe), theme-reactive.
- VA-23 context menu curated to a host-registered trio.
- Width cap moved from canvas host to panel (canvas fills container).
- Export slice: Turtle/JSON/CSV subgraph exporters in core
  (selection-aware, inter-edges only) + toolbar Export control with
  2x PNG.

### Round 25 (2026-06-12): review findings

- Pin indicator: registry pin glyph as a top-right node badge
  (stacked backgrounds) replacing the amber underlay.
- VA-23: real right-click context menu wired (full toolkit actions).
- VA-26: disconnected-subsystem fixture, runners auto-wire results
  into color/size channels, narrative external document; panel
  reports written property keys via onIngested.
- Live canvases width-capped.

### Round 24 (2026-06-12): VA-26 growth fix

- VA-26 made constant-height by construction after a browser growth
  report (control column scrolls internally; canvas pane capped and
  clipped; all canvas hosts clip overflow). Render-count probe added
  as a regression guard; React-state and cy-event loops ruled out by
  evidence.

### Round 23 (2026-06-12): deployed docs refresh

- GitHub Pages pipeline audited (docs.yml: live and sound); landing
  page refreshed (React 19, current-era descriptions, Wiring Guide
  and Visual Acceptance cards); wiring guide rendered inside the API
  reference via TypeDoc projectDocuments; acceptance walkthrough
  joins the deployed site; workflow deduplicated onto docs:build;
  legacy Sphinx skeleton flagged for next-major removal.

### Round 22 (2026-06-12): documentation assessment + wiring guide

- docs/wiring-guide.md: stores/props/documents integration surface,
  composition levels, eight custom-control recipes, host-direction
  subscriptions; every snippet executable in examples/wiring/ (CI).
- Public-API gaps fixed (found by the executable docs): root barrel
  gained workspace + AlgorithmPanel; toolbar and layout-manager
  barrels completed.
- Canvas story migrated off the deprecated encoding path; stories
  added for GraphToolbar and AlgorithmPanel; README/DEVELOPER
  freshness pass; typedoc validation joined the verify chain.

### Visual round 21 (2026-06-12): algorithm overlays

- Result interchange contract v1 (core): versioned documents for
  property- and structure-shaped algorithm results from any engine;
  edge-property ingestion; reference built-ins (components, degree).
- Structural overlays: registry with independent toggles, union
  membership, emphasized-members/dimmed-rest rendering that restores
  exactly on deactivation; instance pins shadow overlay borders by
  documented decision.
- AlgorithmPanel controls + VA-26: shortest-path overlay, external
  MST document ingest, and components driving the encoding spec's
  color channel (results as drivers).

### Visual round 20 (2026-06-12): theme -> canvas wiring

- The canvas follows the theme: themeColorRules (labels, edges,
  selection highlight, :parent surfaces) merged through one shared
  stylesheet assembly used by init and a restyle-in-place theme
  effect (positions hold; spec mappers win by specificity; user
  stylesheets still override). Root cause behind two earlier visual
  findings, now closed.

### Visual round 19 (2026-06-12): glyph fixes, shuffle, workspaces

- Node glyphs: explicit SVG intrinsic size (crisp rasterization) and
  contrast-ratio glyph color against each node's resolved fill;
  preview and canvas share the rule.
- Toolbar Shuffle: randomized force re-run (incremental Re-run
  unchanged).
- Workspace durability slice 1: versioned snapshot of spec,
  positions, pins, and theme with capture/apply/serialize/parse;
  storage left to the host. VA-25 exercises it live.

### Visual round 18 (2026-06-12): review fixes

- Color-picker rows: label click-forwarding removed (only the swatch
  triggers the picker).
- VA-23 menu sample contained via a transform containing-block; items
  fire real actions with a visible wiring check.
- node.shape fixed mode implemented (was unreachable).
- Pin indicator: amber disc (universal visibility, CVD-distinct from
  the selection accent).
- Runtime canvas selection modernized: the gasket outline replaces
  the legacy 3px border; :active overlay slimmed; VA-24 menu reduced
  to a purpose-built pair of actions; stale ELK copy removed.

### Visual round 17 (2026-06-11): containers + per-node pinning

- Per-node position pinning: store + pure composition rule
  (pin-all = union, release returns to per-node set), canvas lock
  effect with soft-underlay indicator, context-menu toggle action;
  the toolbar's Pin all routes through the same store.
- Compound containers slice 1: containment option maps edges to
  Cytoscape parents, UML «Stereotype» container styling, fcose
  compound layout; theme→canvas derivation wiring recorded as a gap.
- VA-24 exercises both live on a SysML-flavored fixture.

### Visual round 16 (2026-06-11): toolbar review fixes

- Context menu themed (tokens + hover + color-scheme); VA-23 shows a
  static menu sample per theme.
- LayoutManager: slider commits debounced (re-layout storm fix),
  dagre/ELK removed from the selectable list (ELK roadmapped with
  compound/UML containers), model exported, sliders labeled.
- GraphToolbar rebuilt: single 26px row, options popover with
  explicit Run layout, Pin all (whole-graph position lock with
  disabled-with-explanation controls), compact zoom group; no
  animate toggle (motion follows prefers-reduced-motion). Per-node
  pinning roadmapped in roadmap/design/toolbar-and-layouts.md.

### Visual round 15 (2026-06-11): graph toolbar

- GraphToolbar: search (camera centers on match), layout switching
  with force controls (fcose repulsion/edge-length/gravity), visible
  degradation for unbundled engines, freeze, zoom/fit: the cy glue
  the existing components lacked. layoutConfig/runGraphLayout
  exported; nine tests. VA-23 exercises it live.

### Visual round 14 (2026-06-11): override application, SpecPort

- M12 per-instance style overrides now APPLY: bypass-style effect in
  CytoscapeCanvas consuming the override store (which previously had
  no canvas consumer); node and type scopes; restores on removal;
  precedence by mechanism documented in encoding-controls.md.
- SpecPort: tier-3 spec JSON import/export surface with verbatim
  validation errors (including reserved-channel rejections).
- VA-22 demonstrates the full precedence stack live.

### Visual round 13 (2026-06-11): canvas glyphs, shape channel, migration

- node.icon renders on the canvas via SVG data URIs (iconDataUri +
  node[_icon] rule); component icons degrade gracefully.
- node.shape: ShapeScale + slot-stable resolver, panel row,
  paired-redundancy warning, legend glyph section, \_shape emission.
- All demo shells (five) and DemoApp migrated off EncodingPanel /
  CanvasLegend / encodingToCytoscapeStyle; legacy exports retained
  only for external stability pending the next major.

### Visual round 12 (2026-06-11): position stability, page width

- CytoscapeCanvas contracts made explicit: ugm must be referentially
  stable (new identity = new graph = re-init + layout); encodingSpec
  changes restyle only and never move nodes. Acceptance fixtures
  memoize their graphs (the round-11 re-layout was fixture-side).
- Acceptance page: 1320px container with prose capped at a readable
  measure; VA-22 pass criteria include position stability.

### Visual round 11 (2026-06-11): spec drives the canvas

- applyEncodingSpec: element-data patches from the encoding spec via
  the shared resolvers; CytoscapeCanvas encodingSpec prop with
  batch-apply on mount and change; attribute-presence edge rules
  (edge[_ewidth]/edge[_ecolor]) keep unclaimed channels on legacy
  style. SpecLegend: spec-mirroring legend through the same
  resolvers. VA-22: first live-canvas acceptance check (panel ->
  canvas -> legend loop). Icons and shape remain canvas-absent by
  design (documented).

### Visual round 10 (2026-06-11): fixed editors, ThemeSwitcher

- Encoding panel: chip strips use one resolver per strip (multi-color
  regression fixed); FixedNumberEditor for fixed node.size and
  edge.width; edge.color chip strip plus categorical/fixed editors;
  preview sizes rounded for crisp borders.
- ThemeSwitcher component exported from the theme barrel
  (store-driven, aria-pressed, onSelect for host chrome); acceptance
  page hosts it in a main-level sticky bar (sticky-within-short-parent
  bug fixed).
- node.shape documented as a future paired-redundancy channel in
  encoding-controls.md.

### Visual round 9 (2026-06-11): review fixes + icon sets

- Encoding panel: driver-aware chip/preview sampling (label/pagerank
  drivers rendered blank), numeric color drivers default to a
  sequential ramp, preview defaults to real node attrs.
- Custom palettes: pickers edit array slots (overrides folded on
  switch), warnings evaluate EFFECTIVE colors against the live canvas
  background and clear when fixed; silent while palette-safe.
- registerIconSet: bulk icon sets with sanitize-by-default (named
  rejections for script/on\*/foreignObject/url() content), trusted
  mode for adopter-compiled sets, pre-mappings +
  applyIconMappings into the encoding spec. VA-21 exercises all of
  it live.

### Visual round 8 (2026-06-11): live encoding island

- VA-20 is interactive: the Va20Live composition is SSR'd as fallback
  and mounted by an inlined client bundle built from the same source;
  preview and spec JSON update live through the shipped resolvers.
- VA-18 shows EncodingSpecPanel; the deprecated EncodingPanel remains
  only for the demo shells (migration queued).
- Layout containment: min-width:0 hygiene for grid/flex children,
  wrap-tolerant encoding rows.
- Harness lesson: inline bundles via a replacer function;
  String.replace's string form expands $-sequences (caught by the
  page self-check as a 2.3 MB explosion).

### Visual round 7 (2026-06-11): encoding grammar

- Encoding overhaul per roadmap/design/encoding-controls.md: spec
  model (channel <- driver via scale; fixed/categorical/sequential;
  slot-stable overrides; reserved-channel guard; versioned JSON;
  legacy adapter; palette warnings), EncodingSpecPanel (progressive
  disclosure: rows + chips + inline scale editors), EncodingPreview
  (resolver-driven proof strip). Legacy EncodingPanel deprecated but
  intact; 23 new tests.

### Visual round 6 (2026-06-11): sh:closed, createTheme, panel slice 2

- SHACL closed-world support: ShaclShape.closed + ignoredProperties,
  enforced by validateShacl (undeclared properties violate); lock
  indicator in the shape browser; `lock` icon added (23 glyphs).
- createTheme()/contrastRatio() exported: partial-over-preset theme
  creation with WCAG contrast warnings.
- Panel anatomy adopted by AnnotationPanel, EncodingPanel, and legend
  headings (C4 complete for current panels).
- Acceptance page: four-panel VA-18 with a closed shape; VA-19 live
  accent-override editor.

### Visual round 5 (2026-06-11): gasket halo, panel anatomy

- Selection halo rebuilt as a gasket: offset accent outline over a
  canvas-colored gap (Cytoscape outline-\*), replacing the double ring
  that failed review in all themes; new --g3t-selection-gap-width
  token; derived-style regression test.
- Panel anatomy classes (.g3t-panel\*) in the base stylesheet, adopted
  by DetailInspector and ShaclShapeBrowser (C4 first slice).

### Visual round 4 (2026-06-11): review fixes, skeletons, tree density

- Map background and graticule onto theme vars (dark mode bug).
- Table pagination buttons onto g3t-btn; high-contrast colorScheme
  corrected to "light" (round-1 error).
- Canvas selection ring is now double (geometry redundancy; halo
  token 4px) so selection reads on black high-contrast nodes.
- Skeleton component completes the B2 pattern (reduce-motion-safe
  shimmer); TreeView density="compact".

### Visual round 3 (2026-06-11): rem scale, states, density, map signature

- Type tokens converted to rem with the xs floor raised to
  11px-equivalent (browser text-zoom now works).
- Button disabled state and tokenized active surface.
- TableView density="compact" prop.
- MapView selection: accent halo replaces the fill-swap-to-blue
  (channel-allocation compliance), theme-var fills and labels;
  regression-guarded. Matrix column-label boundary padding fixed.

### Visual review round 1 fixes (2026-06-11)

- G3tTheme: per-theme `colorScheme` injected onto the root; scoped
  `accent-color` for native checkboxes/radios (dark-mode native
  controls stayed UA-light).
- Focus rule class drift fixed: `.g3t-button` (nonexistent) →
  `.g3t-btn` (the real tokenized class).
- MatrixView header typography: vertical-rl column headers replacing
  unsized rotate(-45deg) overlap; right-aligned `th scope="row"` row
  headers; mono axis labels; boundary padding.
- Acceptance page: ring-clearance fix, themed controls, VA-11 canvas
  halo swatch derived from deriveCytoscapeStyle at generation time.

### Visual acceptance harness (2026-06-11)

- `pnpm run visual-acceptance`: jsdom-rendered, self-checked,
  single-file gallery of the design-pass-2 work (real components,
  real tokens, three live themes) with checks VA-1..VA-10 for human
  review; the reviewed page seeds the Playwright baseline set.
  Plan and execution record: planning/visual-acceptance-1.md.

### Design pass 2 (2026-06-11): icons, states, selection signature

- **Icon system (B1).** 22-glyph stroke set behind an IconRegistry
  (@g3t/react/icons subpath): semantic names, currentColor, strict
  a11y contract (labeled when standalone, hidden when decorative),
  adopter-swappable without forking components. All Unicode glyph
  call sites migrated (tree, inspector, table sort, SHACL badges,
  search clear, play/pause, zoom).
- **EmptyState/ErrorState (B2).** One anatomy replacing eight per-view
  improvisations; copy rewritten to say what the view is, why it is
  empty, and what fills it. Existing testids preserved.
- **Reduced motion to JS animation (A2).** prefersReducedMotion()
  consulted by the canvas animate default and the ECharts theme.
- **Selection signature (C1).** Geometry tokens
  (--g3t-selection-\*); table selection migrated off hardcoded #2563eb
  (which was not even the theme accent) onto theme + tokens; canvas
  halo width from the shared token; charts select/emphasis on the
  accent. Channel-allocation table recorded in
  roadmap/design/projection-and-encoding.md: selection owns accent
  exclusively, overlays own weight, inference owns dash.
- **Matrix truncation notice.** The silent .slice() at maxSize now
  announces "showing N of M types" (R7.7's no-silent-limits
  principle).
- **R1.4 verification executed.** Gradient and limit-notice
  acceptance pass; two gaps found and scoped (no type-pair selection;
  truncation is not aggregation). R1.4 remains in-progress: the
  verification tier producing its designed outcome.

### Design-system quality floor (roadmap/design/design-system.md)

- Motion: easing tokens added; `prefers-reduced-motion` now zeroes the
  duration tokens toolkit-wide.
- Focus: `:focus-visible` ring tokens and base rules; keyboard
  navigation gets one unmistakable treatment, pointer clicks stay
  quiet.
- Data scales: viridis sequential and PuOr diverging scale tokens plus
  `scaleColor()`, extending the colorblind-safe commitment (R7.8) to
  continuous encodings; MatrixView migrated off its hardcoded
  alpha-blue ramp (illegible on dark themes).
- Z-index scale tokens added.
- Capability landscape survey (research/capability-landscape.md):
  4 requirements adopted (R1.15 entity page, R2.16 change history,
  R2.17 saved queries, R3.9 algorithm subgraph overlays), spec corpus
  now 76; roadmap coverage gate extended to 31 open requirements.

### M15: Audit Remediation

Full inventory and validation evidence: planning/audit-remediation.md.

#### Fixed (release-blocking)

- **Consumer type resolution.** Published packages shipped untyped:
  `build:packages` ran tsc declaration emit and then Vite's
  `emptyOutDir: true` deleted the emitted .d.ts files, and the
  exports maps listed the `types` condition after `import`/`require`
  (so it could never match) while pointing at the now-phantom paths.
  Fixed by disabling emptyOutDir (explicit clean via
  scripts/clean-dist.mjs instead), reordering `types` first in every
  conditional export across all three packages, and post-processing
  emitted declarations for node16 extension rules
  (scripts/fix-dts-extensions.mjs). Gated by `verify:types`, which
  typechecks a scratch consumer under node16 and bundler resolution.
- **Broken quickstarts.** All four README code examples failed as
  written (SparqlAdapter object-arg constructor that doesn't exist,
  missing React hook imports, getters called as methods, a phantom
  `ThemeProvider` export, a string passed where a DataPipeline is
  required). Fixed and gated by `verify:snippets`, which typechecks
  every fenced ts/tsx block in the READMEs against the real types.

#### Fixed (process integrity)

- **Spec lint gate.** scripts/lint_specs.py now exits non-zero on
  warnings (it previously returned 0 unconditionally across two
  audits) and additionally enforces: required sub-bullets per item
  kind, RFC 2119 text vs `priority` agreement, acceptance criteria on
  MUST requirements, and cross-file identifier resolution. Spec
  linting and status-sync now run in CI (spec-lint job).
- **Spec corpus.** Relocated R1.13/R1.14 and R2.13-R2.15 out of User
  Stories sections; aligned seven MUST-text/SHOULD-priority
  disagreements to their priority fields; added acceptance criteria
  to eleven requirements; corrected OQ9's false attribution;
  deduplicated the open-questions register (OQ2/OQ5 vs the Holonic
  spec) and added OQ13 (fog-redaction export gap) and OQ14; anchored
  the capability clusters (C1-C8) and the 90% coverage claim to
  research/use-case-survey.md.
- **Truth in claims.** The "72/72 spec requirements referenced"
  metric is retired; spec statuses are the record (currently 45
  implemented / 13 in-progress / 14 proposed), kept consistent with
  code citations by scripts/sync_spec_status.py, which guards against
  the comment-only phantom citations this pass removed (R2.15, R3.6,
  R3.8, R6.2 and others were status-credited off comments with no
  implementation behind them). HolonicAdapter's header now states
  what it implements and that R5.1's backend acceptance criteria are
  unmet; its query() logs when it ignores a query string instead of
  doing so silently. PROGRESS.md, planning/status.md, planning/
  roadmap.md, and pixi.toml ticket/test/version figures reconciled.

#### Changed

- tests/dist/public-api.test.ts (moved from packages/core/src) runs
  via `verify` after the build instead of via `pnpm test`, so a fresh
  clone passes the unit/component suite without building packages.
- CI gained spec-lint and e2e jobs. The e2e job gates functional
  assertions with `--ignore-snapshots` until Linux screenshot
  baselines are committed (bootstrap instructions inline in ci.yml).
- Private root package.json no longer carries publish-only fields
  (peerDependencies, peerDependenciesMeta, files, sideEffects);
  lockfile regenerated; full suite re-verified.
- NOTICE and LICENSE files added to each package (they were declared
  in `files` arrays but absent).

#### Known limitations

- Typed CommonJS consumption (`require` from a TS .cts file under
  node16) fails with TS1479: the packages emit a single ESM-flavored
  .d.ts per entry. Runtime CJS works (verify:smoke). Durable fix is
  per-entry declaration bundling (.d.ts/.d.cts); tracked in
  planning/audit-remediation.md.

## [1.0.0-rc] - 2026-05-24

### M14: Release Engineering

- Replaced mathjs (17.6 MB) with expr-eval (3 KB) in
  DerivedPropertyEngine. Bundle reduced 20%.
- Reclassified optional view dependencies (@tanstack/react-table,
  fuse.js, echarts-for-react) as optional peer deps.
- Added `sideEffects: ["*.css"]` for tree-shaking.
- Created per-package entry points (core-entry.ts, react-entry.ts,
  charts-entry.ts) and Vite build configs.
- Created per-package package.json in dist/ for npm publish.
- Added GitHub Actions CI (.github/workflows/ci.yml) and publish
  (.github/workflows/publish.yml) workflows.
- Added bundle analysis (rollup-plugin-visualizer) and
  treeshaking verification script.
- Annotated all 72/72 spec requirements in source code.

### F1-F8: Feature Enhancements

- F1: Animated layout transitions (animate, animationDuration props)
- F2: Adaptive/incremental layouts (computeIncrementalUpdate,
  lock existing nodes on small changes)
- F3: Node group collapsing (ComboManager, combo create/dissolve/
  collapse/expand/nest, Cytoscape compound nodes, serialization)
- F4: Annotations framework (AnnotationStore interface,
  localStorage default, AnnotationPanel component)
- F5: Node/edge property editor (PropertyEditor, inline editing,
  PropertyEditCallback for backend persistence)
- F6: Enhanced map view (edges between geo nodes, tile URL prop,
  TemporalSlider with play/pause/speed controls)
- F7: Link label styling (background, border, padding, radius
  via Cytoscape text-background properties)
- F8: Orthogonal edge routing (taxi curve-style, straight-triangle)
- LayoutManager: layout selection (7 layouts), force parameter
  tuning (repulsion, gravity, edge length), reset, freeze/unfreeze,
  animate toggle, edge style selector

## [0.13.0] - 2026-05-24

Four enhancement milestones completing the toolkit's analytical
and customization capabilities. (Previously this block was published
as a second [1.0.0-rc] section in CHANGELOG.md; corrected to its own
version as part of Phase 1 release-engineering hygiene.)

### M10.5: Integration Core

- **Middleware pattern (D6):** Composable request/response
  interceptors. Built-in: `bearerAuth()`, `apiKeyHeader()`,
  `retryOnError()`, `requestLogger()`.
- **RestAdapter (D6):** Generic REST/GraphQL with `mapResponse`
  function and middleware support.
- **GremlinAdapter (D6):** HTTP-based Gremlin adapter for
  Neptune, Cosmos DB, and JanusGraph.
- **Event bus (D6):** `G3tEventBus` typed pub/sub with 20 event
  types. Context action events for multi-view wiring.
- **Build pipeline:** Vite library mode producing ESM + CJS
  bundles with 88 TypeScript declaration files.
- **Adapter middleware:** SPARQL and Cypher adapters updated to
  accept `middleware` option.

### M11: Pipeline Infrastructure

- **DataPipeline interface (D6):** `query(ugm) -> ChartData` +
  `reverseMap(selection, data) -> nodeIds`. PipelineRegistry for
  named pipelines.
- **8 built-in pipelines:** countByType, countByProperty,
  degreeDistribution, edgeTypeBreakdown, propertyCorrelation
  (OLS trend via simple-statistics), centralityVsProperty,
  activityTimeline, communityBreakdown.
- **LinkedChart (D13):** React component wiring DataPipeline to
  ECharts. 5 chart types: bar, scatter+trend, line/area, pie,
  parallel coordinates. Bidirectional selection sync.
- **PropertyFilter (D6):** AND/OR filter groups with 8 operators
  (gt, gte, lt, lte, eq, neq, contains, exists). Nested groups.
- **ViewFilter (D6):** showOnlySelected, hideSelected,
  expandToNHops, subgraph pinning.
- **FilterBuilder (D13):** Visual filter builder UI.
- **Table enhancements:** Column visibility toggle, inline
  per-column property filters.

### M12: Customization & Filters

- **NodeStyleOverride (D6):** Per-node and per-type visual
  overrides (color, shape, size, icon, border, opacity).
  Cytoscape stylesheet merge with correct CSS specificity.
- **SVG icon library:** 20 built-in icons (person, building,
  globe, shield, server, etc.) as path data constants.
- **NodeStyleEditor (D13):** Color palette, shape selector,
  size slider, icon grid, scope toggle (this node / all of type).
- **Context-sensitive menus (D6):** TypeMenuProvider with
  per-type menu items. Default items for Person, Location, Event.
- **Bulk operations:** Multi-select context menu (color, pin,
  hide, show-only, view subgraph, find path). applyBulkStyle().

### M13: Advanced Features

- **PROV-O extraction (D6):** Maps prov:startedAtTime,
  prov:endedAtTime, etc. to toolkit temporal properties.
- **DerivedPropertyEngine (D6):** Safe expression evaluator
  (expr-eval). User-defined computed properties on nodes.
- **Subgraph pinning (D6):** Pinned nodes stay visible despite
  ViewFilter hide operations.
- **TemporalRangeFilter (D13):** Dual-handle time range slider.
- **DerivedPropertyPanel (D13):** Define/compute/remove UI.

### Toolkit Context Menu Actions

- **registerToolkitActions():** Single function registers 19
  context menu items (9 single-node, 3 single-edge, 7 multi-select).
- **buildNeighborhoodUGM():** Creates subgraph UGM for secondary
  canvas views.
- **Event-driven wiring:** Context actions emit events
  (context:viewNeighbors, context:findPath, etc.) for application
  to wire up secondary views.

### Documentation

- **ARCHITECTURE.md:** Toolkit boundary, package diagram, data
  flow, extension examples.
- **DEVELOPER.md:** D6/D13 rules, project structure, testing.
- **CLAUDE.md:** Agent handoff context.

### FOSS Dependencies Added

graphology-shortest-path, graphology-metrics,
graphology-communities-louvain, graphology-components,
crossfilter2, simple-statistics, expr-eval.

### Test Coverage

520 tests across 36 files, all passing.

## [0.8.5] - 2026-05-22

### M8.5: UX Surface & Theming

Vendor-quality visual controls, centralized theming, and interaction
affordances.

#### Added

- **ThemeManager:** Centralized theming via CSS custom properties
  (--g3t-\*). Three presets: light, dark, high-contrast. Zustand
  store with setTheme(). Derived Cytoscape stylesheets and ECharts
  theme objects. All components read from CSS variables.

- **VisualEncodingManager (D6):** Maps UGM property keys to visual
  channels (nodeSize, nodeColor, edgeWidth, nodeLabel). Produces
  Cytoscape mapData() stylesheet entries. Type-based palette
  coloring. Property range auto-detection.

- **EncodingPanel:** React sidebar with dropdowns for each encoding
  channel. Includes label selector (M8.5.E4.T2).

- **CanvasLegend:** Auto-generated from active encoding. Type-color
  dots, size scale, edge line-style meanings.

- **HoverTooltip:** Positioned tooltip on node mouseover with label,
  type, and top 5 properties.

- **ZoomControls:** +, -, fit-to-screen button group.

- **Toolbar:** Mode buttons (select/pan), layout trigger, filter and
  encoding toggles, theme selector dropdown (light/dark/HC).

- **StatusBar:** Reactive node count, edge count, selection count,
  zoom level.

- **KeyboardShortcutModal:** "?" key opens reference with 12 shortcuts.

#### Test Coverage

- 372 tests across 27 files, all passing.

## [0.8.0] - 2026-05-22

### M8: Accessibility

WCAG 2.1 AA support with ARIA companion, keyboard navigation,
screen reader summaries, and high-contrast mode.

#### Added

- **AriaCompanion (R7.9, R7.10):** Hidden focusable node list
  mirroring the UGM. Degree-ordered tab sequence. Structured
  aria-labels ("Alice, Person, 5 connections: 3 to Person, 2 to
  Organization"). Keyboard edge traversal via arrow keys.

- **aria-live region (R7.10):** Polite announcements for context
  changes (selection, expansion, layout switches).

- **High-contrast mode (R7.12):** HighContrastConfig with WCAG AA
  defaults. Black on white (21:1 contrast ratio), 4px strokes.

- **Table fallback (R7.11):** Verified cross-view selection store
  ensures table always reflects current selection from any view.

#### Test Coverage

- 327 tests across 26 files, all passing.

## [0.7.0] - 2026-05-22

### M7: Charts & Enhancements + Gap Analysis

Sankey/chord and matrix views. Three critical gap-analysis additions:
path analysis, query editor, undo/redo.

#### Added

- **Shortest Path Analysis (R2.13):** BFS path finder between two
  nodes with edge type filter and maxHops constraint. Returns
  ordered node/edge IDs for canvas highlighting.

- **Query Editor (R1.13):** SPARQL/Cypher/GQL text input with
  execute button, Ctrl+Enter shortcut, error display, and adapter
  integration.

- **Undo/Redo Stack (R2.14):** UGM snapshot stack with configurable
  depth. Redo cleared on new action. Framework-agnostic.

- **SankeyView (R1.9):** ECharts Sankey + chord mode toggle.
  Aggregates edge counts between node types.

- **MatrixView (R1.4):** Adjacency heatmap by node type. Color-
  scaled cells with click-to-select. maxSize limit (R7.3).

#### Spec Additions

- R2.13 (path analysis), R2.14 (undo/redo), R2.15 (bookmarks),
  R1.13 (query editor), R1.14 (community overlay) added to spec.
- Gap analysis document: `planning/enhancement-plan.md`.

#### Test Coverage

- 314 tests across 25 files, all passing.

## [0.6.0] - 2026-05-22

### M6: Workspace & Schema

Multi-view workspace composition, schema visualization with SHACL
overlay, graph diff engine, and ontology version tracking.

#### Added

- **WorkspaceShell (FlexLayout):** Tabbed/split-pane workspace host.
  ViewFactory pattern. Role-based defaults (analyst, engineer).

- **Save/Load:** Workspace state serialized to JSON including
  FlexLayout model and schema hash. Round-trip verified.

- **SchemaView:** Class hierarchy from UGM registry or SchemaModel.
  SHACL shape badges on target classes with constraint counts.

- **DiffRenderer:** Color-coded diff visualization (green=added,
  red=removed, amber=changed). Property-level change display.

- **Graph Diff Engine:** diffGraphs() compares nodes, edges, and
  properties. computeSchemaHash() for version tracking.

#### Test Coverage

- 290 tests across 23 files, all passing.

## [0.5.0] - 2026-05-22

### M5: Secondary Views

Timeline, map, statistics, and tree views implemented with
cross-view selection linking.

#### Added

- **TimelineView (vis-timeline):** Renders temporal nodes. Brush
  selection filters by time range and writes to selection store.

- **MapView (SVG equirectangular):** Renders geo-located nodes as
  markers. Click-to-select and pan-to-selected via useMemo viewBox.

- **StatsPanel (ECharts):** Histogram of numeric property values
  with brush-to-select for highlighting matching nodes.

- **TreeView:** Lazy-load containment hierarchy with configurable
  initial depth, expand/collapse, breadcrumb trail, and working-set
  limit enforcement. BFS cycle handling.

#### Test Coverage

- 290 tests across 23 files, all passing.

## [0.4.0] - 2026-05-22

### M4: Projection Pipeline

RDF data projected to UGM through configurable collapse transforms.
Pre-extraction architecture ensures types and properties are always
preserved regardless of which collapses are enabled.

### Testing Infrastructure (D14)

Four-layer testing strategy adopted: Vitest unit, RTL component,
Playwright visual regression, Robot Framework acceptance.

#### Added

- **Shared test harness:** `/?test-harness` URL activates a
  deterministic rendering of all components (20 nodes, 30 edges,
  3 types) for screenshot-stable testing.

- **Playwright e2e tests:** 3 spec files (canvas, selection, sidebar)
  with `toHaveScreenshot()` visual regression baselines. Consistent
  1280x800 viewport, single worker, 1% pixel tolerance.

- **Robot Framework acceptance tests:** 2 suites (M0 foundation,
  M1 interaction) with keyword-driven tests tagged by requirement
  ID (R1.1, R2.5, D3, etc.). HTML reports with embedded screenshots.

- **CI pipeline updated:** Robot Framework steps added alongside
  Playwright. Test artifacts (screenshots, reports) uploaded on
  all runs.

#### Added

- **ProjectionPipeline:** Ordered sequence of collapse steps with
  pre-extraction of types and properties from the full RDF graph.
  Steps can be enabled/disabled by name.

- **5 Collapse Transforms:** Type (rdf:type → types array), Literal
  (datatype triples → properties), Blank-Node (inline as nested
  objects), List (rdf:first/rest → arrays), Reification (rdf:Statement
  metadata → edge annotations).

- **3 Presets:** Standard (all on), Ontology (type edges visible),
  Provenance-Preserving (reification nodes visible).

- **ViewRouter Gate:** checkRenderPermission() blocks raw RDF from
  renderers; schema and inspector views exempt (R4.6).

- **Holonic Compatibility:** Pipeline satisfies HolonicProjectionPipeline
  interface via structural typing.

#### Architecture

- Pre-extraction runs BEFORE collapse steps to avoid ordering
  dependency between literalCollapse and structural collapses.
- literalCollapse preserves blank-node-subject literals so BNode,
  List, and Reification collapses can still read them.
- localPart() handles IRIs, CURIEs, and plain strings.

#### Test Coverage

- 290 tests across 23 files, all passing.

## [0.3.0] - 2026-05-22

### M3: Data Adapters & Integration

Toolkit connects to external graph data sources. SPARQL, Cypher,
and Holonic adapters populate the UGM. Algorithm results and
relational data merge as supplementary properties. D6 module
boundary verified.

#### Added

- **GraphAdapter interface:** query(), expandNeighborhood(),
  getSchema(), getNodeProperties().
- **SparqlAdapter:** SPARQL SELECT/CONSTRUCT via HTTP.
- **CypherAdapter:** Neo4j HTTP transaction API with graph results.
- **HolonicAdapter:** P6 four-graph model; projectToLPG() for
  holarchy visualization; portal right-click menu items.
- **AlgorithmResultAdapter:** ingestAlgorithmResults() merges
  algorithm output (PageRank, community ID) into UGM nodes.
- **RelationalVirtualizer:** Tabular data merge by shared key.
  parseCSV() with quoted field support.
- **D6 Module Boundary Test:** All core modules import without React.

#### Test Coverage

- 230 tests across 20 files, all passing.

## [0.2.0] - 2026-05-22

### M2: Layout Engines

Four pluggable layout engines with a common interface, layout
switcher UI, and pin/unpin state management.

#### Added

- **LayoutEngine interface:** `compute(ugm, options) → Promise<LayoutResult>`.
  All engines are async, stateless, and honor pinned node positions.

- **ForceLayout (d3-force):** Force-directed with configurable tick
  count. Uses forceManyBody, forceCenter, forceCollide. Pinned via
  fx/fy constraints.

- **HierarchyLayout (d3-hierarchy):** Tree/cluster layout with auto
  root detection and BFS cycle handling. Orphan nodes placed separately.

- **DagreLayout (@dagrejs/dagre):** DAG layout with configurable
  direction (TB/LR/BT/RL). 50-node DAG in <100ms.

- **ElkLayout (elkjs):** Layered hierarchical layout via async ELK
  computation. Handles 200-node DAGs.

- **LayoutSwitcher:** React component rendering engine selection
  buttons with active highlight.

- **usePinState:** React hook managing pinned node positions with
  pin/unpin/isPinned API.

#### Test Coverage

- 230 tests across 20 files, all passing.

## [0.1.0] - 2026-05-22

### M1: Interaction & Selection

Cross-view selection model proven: canvas and table are linked
through a shared Zustand store. Core interaction primitives
(expand, filter, search, tag, group) implemented.

#### Added

- **Selection Store (Zustand):** Shared selection state with
  selectNodes, selectEdges, addToSelection, clearSelection, setHover.
  All views read/write the same store. Redux DevTools support.

- **Table View (TanStack Table):** Dynamic columns from UGM
  property-key registry. Sortable headers, pagination. Click-to-select
  syncs with canvas. Right-click shows same context menu as canvas
  (R2.1 universality).

- **N-Degree Neighbor Expansion:** BFS at configurable depth.
  Returns discovered IDs with working-set limit check. Framework-
  agnostic; ready for adapter integration in M3.

- **Faceted Filter:** Checkbox toggle per node type with color
  swatches and counts. Reports hidden types set for canvas filtering.

- **Full-Text Search:** Case-insensitive substring matching across
  node labels. Reports matching/non-matching ID sets for canvas
  highlight/dim.

- **Tag Manager:** User-defined labels persisted as UGM node
  properties. Survives serialization round-trip. Query by tag.

- **Grouping Manager:** Compound node creation with expand/collapse
  state tracking. Children get `_parent` reference; group nodes
  get `_isGroup` flag.

- **Working-Set Manager:** Per-view-type element limits (canvas 500,
  table 10k, tree 1k, matrix 200, sankey 100, streaming 500).
  Admin override. Constructor accepts initial overrides.

- **Multi-Select:** Shift-click accumulates selection. Lasso
  (box selection) enabled; boxend event syncs to store.

#### Test Coverage

- 165 tests across 16 files, all passing.

## [0.0.1] - 2026-05-20

### M0: Foundation

First milestone complete. Proves the data-to-rendering pipeline:
UGM (Graphology) → Cytoscape.js canvas with right-click context
menu and detail inspector.

#### Added

- **Unified Graph Model (UGM):** Graphology MultiGraph wrapper with
  typed nodes (multi-label), Qualified Edge model (confidence,
  provenance, temporal, asserted), event bus (7 event types with
  unsubscribe), and JSON serialization/deserialization.

- **Cytoscape Canvas:** React wrapper component accepting UGM as
  prop. Okabe-Ito colorblind-safe palette (8 colors × 8 shapes).
  Node encoding: type → color+shape, name → label, size → diameter.
  Edge encoding: type → label, confidence → opacity, asserted/inferred
  → solid/dashed (D9). fcose layout registered.

- **Context Menu:** Framework-agnostic ContextMenuManager with
  plugin extension API. Default items: "Inspect properties" and
  "Copy IRI" (filtered by target type). React ContextMenu component
  with positioned rendering, click-outside close, Escape close.

- **Detail Inspector:** Property panel rendering node types,
  properties (with nested object expansion), and Qualified Edge
  metadata (confidence, provenance, temporal, asserted). Updates
  on selection change.

- **Build Tooling:** Vite 8, TypeScript 6 (strict), Vitest 4,
  Playwright, ESLint 10 (flat config), Prettier. Path aliases
  (@core, @views, @state, @interaction, @a11y). CI pipeline
  (GitHub Actions).

#### Performance

- 500 nodes + 2,000 edges: 305ms initialization (headless).
  Go/no-go gate passed; no Sigma.js pivot needed.

#### Architecture

- `src/core/` has zero React imports (D6 verified).
- `src/views/` uses React (D13).
- Module boundary enforced by convention; build-time test
  scheduled for M3.E4.T1.

#### Test Coverage

- 90 tests across 9 files, all passing.
- Layers: Vitest unit (core logic), RTL component (React views),
  Playwright e2e (stub; full visual tests require browser install).
