# Structural edge routing: model and regression testing

How structural-scene edges are routed, why the routing can go stale, and how
to test it so regressions are caught without a browser.

## Routing model

Structural edges are emitted by `structuralToCytoscapeElements`. Each edge
takes one of two routes:

- Dynamic taxi (default). The base rule `edge.g3t-structural-edge` sets
  `curve-style: taxi`, `taxi-direction: auto`. Taxi is orthogonal and
  recomputed live by Cytoscape against the current endpoint positions. When
  ELK gave the source an attachment side, `taxiDirectionClass(side)` adds a
  `g3t-structural-edge-{up,down,left,right}ward` class fixing the exit
  direction; otherwise the edge uses `auto`.
- Static segments (obstacle-aware). When the layout produced a node-avoiding
  polyline (`routeEdges` on) for a body-attached edge, `routeToSegments`
  projects the interior ELK bends onto the source->target line as
  `segment-distances` / `segment-weights`, and the edge carries
  `g3t-structural-edge-routed` (`curve-style: segments`), which overrides the
  base taxi rule. This follows ELK's exact path so the edge does not pass
  behind a block.

Edges attach to invisible edge-port nodes (`__g3t_eport__<edgeId>__{s,t}`,
class `g3t-structural-edge-port`) that ELK pins to each box boundary. Ports
are top-level siblings, not compound children, so they do not travel with a
dragged box automatically.

## Why routing goes stale on drag, and the fix

`segment-distances` / `segment-weights` are projected against the original
endpoint line, so they are translation/scale sensitive: if the control values
are left untouched while an endpoint moves, the bends no longer land on the
orthogonal grid and the edge visibly kinks. Reverting to dynamic taxi instead
is worse: taxi has no obstacle avoidance and no inter-edge spacing, so a small
drag can send an edge straight through a node that ELK had routed around, and
let parallel edges from the same side collapse onto each other after the turn.
ELK cannot re-route with fixed positions either (its interactive mode discards
the supplied coordinates and re-lays-out the whole graph).

`wireStructuralPortDrag` (wired automatically by `CytoscapeCanvas` for
structural scenes) keeps ELK's route and recomputes it live, for every
structural box, compartmented containers and plain `g3t-structural-node`
boxes alike:

1. On grab it filters the box's ports once (by `_portHost`) and caches them,
   and reconstructs each routed incident edge's absolute interior bends from
   its `_segDist` / `_segWeight` and current endpoints (`segmentsToPoints`).
   It also records, per edge, the dragged box's half-extents, the moved
   eport's emission side (`_side`) and the fixed endpoint's eport + side.
   Each drag step is then O(incident edges), not a re-query. The moved
   eports are pulled out of the uniform delta-translate set, since their
   face can migrate (step 3).
2. Same-face case (the common small/medium drag). The eport rides the box
   (its side offset preserved) and the interior bends are rescaled
   proportionally inside the source->target bounding box (`rescaleBends`):
   x and y scale INDEPENDENTLY, so a segment that shared an x (vertical) or a
   y (horizontal) still shares it (orthogonality preserved) while every bend
   slides with the drag. This is what stops a bend looking "locked" along the
   edge on a drastic move; it also keeps endpoint-tied bends (fraction 0/1 on
   an axis) perpendicular to their port. A degenerate (zero-extent) axis
   falls back to a fixed offset from the source.
3. Face-migration case. `migratedSide` decides the attachment face each tick:
   it KEEPS the route's original axis (a NORTH/SOUTH attach stays vertical, an
   EAST/WEST one horizontal) and flips to the opposite face only once the
   fixed endpoint has crossed clear past the dragged box's far edge on that
   axis (the box's own half-extent is the hysteresis band). This is what lets
   a target terminate on the bottom once the box is dragged above the edge,
   instead of staying pinned to the top and cutting back through the node. On
   a flip the eport moves to the new face (`sidePoint`) and the edge is
   re-routed orthogonally with perpendicular stubs off each face
   (`routeBetweenSides`: a corner when the two exits are on perpendicular
   axes, a Z when they share an axis and are offset, a straight line when
   aligned). Axis-preservation is deliberate: an up-and-over route
   legitimately exits NORTH even when its target is due east, so a naive
   "face the other endpoint" rule would wrongly flip it on the first drag tick
   and discard the obstacle-aware route.
4. In both cases the control values are recomputed (`routeToSegments`) and
   written to the edge data (the routed rule maps the render from that data,
   so this renders live and stays truthful for the next grab's
   reconstruction).
5. Straight taxi-fallback edges (no interior bends) simply follow their moved
   port; nothing to recompute. On free it clears the session.

Graceful degradation and limits. Same-face rescaling preserves the
obstacle-avoiding shape approximately for small moves (the bends barely move)
and slides naturally for large ones; a re-layout (`layoutStructural`)
recomputes a fully obstacle-aware route for the new positions. The face
migration flips the DRAGGED endpoint only; the fixed endpoint keeps its
emission face, so a re-routed edge can show a small stub-sized hook at the
fixed end when the dragged box ends up on the far side of the fixed endpoint's
exit direction (a separable refinement: flip the fixed face too). When a box
is dragged so far it overlaps the other endpoint's node, no attachment is
clean and the route can momentarily cross the overlapped node until separation.

### Why a reposition usually reads as a U-turn, not a side swap

This is expected behavior under the current gate, not a routing bug. When you
restack two connected nodes (invert their relative position), the edge will
typically loop around in a 180-degree turn while staying orthogonal, rather
than the attachment hopping to the now-facing faces. Two conservative choices
produce that:

1. The migration gate is deliberately late. `migratedSide` only swaps a face
   once the other endpoint has crossed clear past the dragged box's FAR edge
   on the attachment axis (the half-extent is the hysteresis band). This
   protects the obstacle-aware ELK route on ordinary drags, but it means a
   normal reposition almost never trips the flip: you stay in the same-face
   rescale path, both eports keep their original faces, and `rescaleBends`
   honors those (now-inverted) faces the only way it orthogonally can: by
   looping the route around. That loop is the U-turn.
2. Even when the gate does fire (in practice only near node overlap), only the
   dragged endpoint migrates. The fixed endpoint keeps its emission face and
   its original exit direction, so `routeBetweenSides` must still U-turn out of
   that stub when the exit direction is opposed.

So the route reshapes intelligently and stays orthogonal, but the attachment
rarely migrates, which presents as a U-turn instead of a clean side swap.

To make attachments swap to the facing faces instead (a bottom-to-top style
restack), two changes are needed, and they are coupled:
(a) trigger migration earlier, when the other endpoint crosses the node's
CENTER on that axis (a small dead-band instead of the full half-extent), and
(b) recompute BOTH endpoints each tick so each attaches to the face pointing
at the other (this needs the fixed node's center/half captured on grab; the
pure `migratedSide` / `sidePoint` / `routeBetweenSides` helpers already cover
the rest). The tradeoff is intrinsic: pinning the original faces (to preserve
the ELK obstacle route) and migrating them are mutually exclusive, so an
early-and-symmetric gate gives up the preserved ELK route sooner and converges
toward taxi-style facing-sides routing once positions move much. The
small-drag rescale still protects clearance for the close `rdf:core` /
`map:obda` channel; only larger repositions would switch to the swap.

Perpendicular attachment. Routed edges still carry a dormant side-derived
`taxiDirectionClass(sourceSide)` class at emission. It is inert while the edge
is routed (segments), and only governs the exit axis of the rare straight
taxi-fallback edge. Routed edges keep ELK's perpendicular exit through their
rescaled bends, and a re-routed (migrated) edge re-establishes perpendicular
exit/entry through `routeBetweenSides`' stubs.

## Edge density / parallel-edge spacing

Static routes come from ELK. When several edges fan from one side to
vertically-aligned targets, their orthogonal segments can bunch up or
superimpose in the shared routing channel. `layoutStructural`'s
`edgeEdgeSpacing` controls the minimum gap between parallel edge segments;
it maps to both `elk.spacing.edgeEdge` and
`elk.layered.spacing.edgeEdgeBetweenLayers`. The default is 24 (a sane gap
that keeps fans legible); raise it for denser edge sets. For the structural
layouts here it is the effective lever (node/layer spacing does not separate
parallel edges in the same channel). It is verified two ways: a deterministic
wiring test (an injected ELK engine captures the layout options and asserts
the configured gap reaches both spacing keys) and an empirical check that the
minimum inter-edge gap on the thread layout grows as the value rises.

## Test layers (all run under vitest, no browser)

1. Pure geometry. `routeToSegments`, `segmentsToPoints`, `rescaleBends`,
   `migratedSide`, `sidePoint`, `routeBetweenSides`, `clipToBox`,
   `taxiDirectionClass` are pure and exported. Tests assert exact
   reconstruction of interior bends on axis-aligned and diagonal routes, the
   null cases (straight 2-point route, degenerate axis), one control value per
   bend, the side->class mapping, an orthogonality invariant, a
   `segmentsToPoints`/`routeToSegments` round-trip, that `rescaleBends` slides
   bends proportionally while keeping the route orthogonal (and falls back to a
   fixed offset on a degenerate axis), that `migratedSide` flips only once the
   endpoint clears the box's far edge (axis preserved, hysteresis held within
   the band), and that `routeBetweenSides` is orthogonal for every side
   pairing with perpendicular stubs. See the "obstacle-aware edge routing",
   "routed-edge geometry helpers", and "taxiDirectionClass" describes in
   `structural-to-cytoscape.test.ts`.

2. Emission. `structuralToCytoscapeElements` over a fixture geometry: assert
   routed edges carry `g3t-structural-edge-routed` plus well-formed
   `_segDist` / `_segWeight` and no taxi class; declared-port and straight
   2-point edges keep taxi; endpoints resolve to the right port ids; a
   routed edge carries the dormant source-side direction class; UML edge kinds
   get the right classes and arrow rules. See the
   `structuralToCytoscapeElements` describe. `layoutStructural`'s edge-edge
   spacing wiring is asserted via an injected engine (see the "edge-edge
   spacing control" describe in the core `structural.test.ts`).

3. Interaction. `wireStructuralPortDrag` is driven by a minimal cy stub that
   records handlers, selectors, and edge-data writes. Tests assert: ports
   offset by the drag delta; a routed edge's segments rescale on drag (bends
   slide with the box, the moved end staying axis-aligned, the reconstructed
   route orthogonal); the selector binds plain nodes and containers; an
   ungrabbed box is a no-op; and the session clears on free. See the
   `wireStructuralPortDrag` describe. The live render, the face-migration
   re-route, and the geometric outcomes (a small drag clearing `map:obda`; a
   target face migrating top->bottom without cutting through the node) are
   browser-only or verified by simulating the drag against representative
   geometry with the exported helpers.

## Adding a regression test when a routing bug is found

- Math bug (wrong bend, broken orthogonality): add a `routeToSegments`,
  `rescaleBends`, or `routeBetweenSides` case with the offending polyline;
  assert the reconstructed path is axis-aligned or matches expected control
  values.
- Class/curve-style bug (wrong style chosen): add a `structuralToCytoscape
Elements` case asserting the classes and `_segDist` presence/absence.
- Drag bug (edges detach, double-move, cut through nodes, wrong face): extend
  the cy stub and fire grab/drag/free; assert port positions and the recomputed
  segment control values.

## What is not unit-testable

Cytoscape's live taxi recomputation and the visual result of a drag are
browser-only (jsdom has no renderer). Cover those in the visual-acceptance
harness or a manual review checklist: drag a plain box and a container,
confirm edges stay attached and orthogonal, and confirm a re-layout restores
the obstacle-aware route.
