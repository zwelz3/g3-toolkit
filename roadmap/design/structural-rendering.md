# Structural Rendering: ELK Containers, Compartments, and Ports

**Area:** design
**Owns:** R1.18

Group A of the 2026-06-12 regrouped roadmap: the structural-rendering
engine whose compartment API has two committed clients (UML custom
views and the SHACL Shape view's compartment slice). This record
captures the strategy decision, the reference-library findings, the
spike-validated ELK recipe, and the slice plan. Round 31 shipped
slice A1 (the geometry layer in core).

## Reference library: what ipyelk teaches and what does not transfer

ipyelk (jupyrdf, BSD; reviewed round 31) drives ELK from a pydantic
element model and renders through Sprotty, with elkjs 0.9.x doing
layout. Four findings shaped this design:

1. **Compartments are layout options, not a renderer feature.** A
   "Record" is an ordinary node whose layout options (zero
   padding/spacing, size constraints, a shared child minimum width)
   make children stack as rows. ELK computes all geometry; nothing
   about compartments is bespoke rendering. This transfers directly
   and is the heart of the recipe below.
2. **Text measurement precedes layout.** ELK cannot measure text;
   ipyelk runs a text-sizer pipe (DOM measurement) before layout so
   labels drive node sizes. Transfers as an injected TextMeasure
   function: core ships a deterministic estimator (headless- and
   jsdom-safe), renderers may substitute canvas measurement.
3. **ipyelk's rows are node LABELS, not nodes.** Its Compartment
   stacks multiple labels via label-placement options. This does NOT
   transfer: g3t needs rows as REAL elements because the committed
   clients want per-row selection, per-row validation badges, and
   row-level cross-highlighting, all of which the toolkit's existing
   selection/overlay machinery provides for free if and only if rows
   are nodes. Rows-as-nodes is the load-bearing decision here.
4. **Sprotty is not adopted.** ipyelk pairs ELK with a second
   renderer. g3t keeps the single Cytoscape canvas: ELK produces
   geometry, the canvas consumes it as preset positions over the
   existing compound-parent mechanism. A second renderer would fork
   theming, encoding, overlays, selection, and the stylesheet
   precedence chain; the cost is structural and permanent, while
   everything the structural views need from Sprotty reduces to
   "apply externally computed boxes," which Cytoscape already does.

## The validated ELK recipe (spiked round 31, elkjs 0.11.1)

Three spike iterations; the failures are as instructive as the
recipe:

- **Naive transplant fails.** Disconnected row children of a layered
  container pack HORIZONTALLY (component packing), regardless of the
  container's DOWN direction.
- **INCLUDE_CHILDREN on the root fails.** It collapses the whole
  graph into one global layered pass using the ROOT's direction and
  IGNORES each container's own layout options. Containers only get
  their DOWN sub-layout under the default SEPARATE_CHILDREN
  handling. (INCLUDE_CHILDREN remains correct for the flat
  compound-DAG case with no per-container options; see the dagre
  note.)
- **ELK label-driven sizing misbehaves** for this use (row widths
  came back at roughly twice the label width); since the builder
  must pre-measure anyway, rows get EXPLICIT dimensions and ELK's
  NODE_LABELS sizing is not used.

The recipe that survives, asserted end to end in
packages/core/src/layout/structural.test.ts:

1. Pre-measure every header, compartment title, and row; assign all
   rows of a container ONE explicit width (max measured + padding).
2. Chain rows with synthetic invisible edges (g3t-chain: prefix;
   isChainEdgeId exported) to force declared order and vertical
   layering. Compartment titles are divider rows in the same chain.
3. Container layout options: elk.algorithm layered, direction DOWN,
   all spacings 0, elk.padding top = header-strip height.
4. Root: layered in the requested direction, default hierarchy
   handling (SEPARATE_CHILDREN). Containers participate in the
   top-level layout as sized boxes.
5. Ports: elk.portConstraints FIXED_SIDE with elk.port.side; ELK
   places the port straddling the declared boundary and routes
   port-attached edges to it.

Result quality: container size is exact (header strip + sum of row
heights by construction; spike produced 221x94 against a computed
221x94), rows stack zero-gap at uniform width in declared order,
ports land on their sides.

## The geometry document (slice A1, shipped round 31)

layoutStructural(input) -> StructuralGeometry v1: a versioned JSON
document (the third integration channel) of ABSOLUTE top-left boxes:
containers, rows (with parent, compartment, divider flag, and text
passthrough so renderers need no second lookup), ports (with node
and side), and the shared header-strip height. Renderer-neutral by
design: a Cytoscape consumer converts boxes to center positions; any
other consumer (SVG export, a future report renderer) reads the same
document. buildStructuralElkGraph is exported separately so the ELK
JSON is testable without running layout.

elkjs stays exactly as packaged today: a dependency of @g3t/core,
externalized by the build (it never enters the bundle; the consumer's
bundler pulls it), imported from elk.bundled.js which works in
browser and Node without a worker file. A host-supplied worker
factory is a later option if interactive re-layout of large
structural views demands it; it is not needed for the committed
clients' graph sizes.

## The dagre question (folded into Group A): ANSWERED, pending visual check

elk.layered laid out a 12-node DAG containing a compound group in
53ms with strict downward layering, including edges through the
container (INCLUDE_CHILDREN is appropriate THERE, where no container
carries its own sub-layout options). ELK layered is adequate as the
DAG layout; dagre stays unbundled permanently unless the visual
spot-check contradicts the headless result.

## Slices

- **A1 (SHIPPED, round 31):** geometry layer in core: input model
  (StructuralNode / StructuralCompartment / StructuralRow /
  StructuralPort), validated ELK builder, layoutStructural runner,
  StructuralGeometry v1 document, deterministic text estimator,
  12-test colocated suite, root-barrel + wiring-guide exposure.
- **A2 (canvas application):** apply a StructuralGeometry to
  CytoscapeCanvas: containers as compound parents (the slice-1
  COMPOUND_CONTAINER_RULE gains a compartment variant), rows as
  child nodes with preset positions and locked drag (container drags
  as a unit), divider rows styled as separators, header strip from
  the reserved padding, ports as TOP-LEVEL SIBLING nodes positioned
  flush outside the boundary (a child cannot escape a compound
  parent's bounds; wireStructuralPortDrag reattaches the drag-along
  ports lose as siblings). Row selection flows through the existing
  selection store, which closes R1.18's second acceptance criterion.
  Canvas text measurement substitutes the estimator here.
- **A3 (UML client):** the «Block»/part fixture renders through A1 +
  A2 end to end on the visual-acceptance page; stereotype header
  styling; edge-symbol vocabulary (composition, generalization)
  through the encoding grammar's shape channel where possible.
  SHIPPED round 45: StructuralEdge gained an optional `kind`
  (association/composition/aggregation/generalization/dependency)
  mapped to Cytoscape arrow shapes by the converter (filled/hollow
  diamond at the source whole-end, hollow triangle at the target
  parent-end, dashed dependency). Arrow shapes are an edge concern,
  not the node-shape channel, so this is a direct converter mapping
  rather than the encoding grammar; colors stay theme-reactive in
  structuralThemeRules. VA-27 demonstrates all four symbols. The
  stereotype header already rendered (the «Block» guillemets); A3
  adds no further header treatment.
- **Exit criterion (unchanged from the regrouping):** the
  compartment API renders typed rows for ANY client, demonstrated
  with the UML fixture; the SHACL Shape view's compartment slice
  then consumes it unchanged.

## Compartment collapse/expand (A2 slice, round 34 design)

VA-27 review (round 34) asks for toggling attribute/operation
compartment detail, as a right-click action and/or a component
configuration. Both, layered:

THE LOAD-BEARING DECISION: collapse happens BEFORE layout, not as a
post-layout style hide. A collapsed compartment must not occupy
space: its rows vanish and the container shrinks to header (plus any
still-expanded compartments). So collapse state is an INPUT to
layoutStructural, and toggling re-runs the layout. This is the
existing "re-running the structural layout is an explicit user
action, never a side effect of styling" discipline (restyle-only
holds for theme/spec; a structure change like collapse is not a
restyle). A post-layout hide would leave the container sized for
rows that aren't drawn, which is exactly the bbox dishonesty the
port fixes were chasing.

DATA MODEL: StructuralCompartment gains an optional
`collapsible` flag (default true) and the builder reads a
per-compartment collapsed-state set. When a compartment is
collapsed, the builder emits its title divider row (so the user can
see what is collapsed and re-expand it) but NOT its content rows; a
fully collapsed container is header + divider rows only. A
compartment with no title still collapses but shows a synthetic
"(n hidden)" divider so it is not silently empty.

TWO TOGGLE SURFACES, ONE STATE:

1. COMPONENT CONFIG (global + per-compartment default): a
   `compartments` prop on the structural config:
   `{ defaultCollapsed?: boolean; collapsed?: Record<string,
   boolean> }` keyed by `${nodeId}::${compartmentId}`. This sets
   initial state and lets a host open a view with operations
   collapsed by default (the common "show me just the data
   properties" case).

2. CONTEXT MENU (runtime toggle, two scopes): built-in menu
   contributions that filter on the cxttap target's data (the
   converter sets `_structuralContainer`/`_compartmentIds` on
   containers and `parent`/`_compartment` on rows). Right-clicking
   the container HEADER gives "Collapse/expand compartments"
   (toggles all of the container's compartments); right-clicking a
   specific compartment (its divider or rows) gives "Collapse/expand
   this compartment" (toggles only that one). Both flip keys in the
   collapse-state store, which the host re-lays-out from. (Round 40:
   the compartment-scoped row action was added after VA review; it
   needed no engine change because the cxttap target already carries
   the row's parent and compartment id. compartmentCollapseSubmenu
   remains for hosts wanting all compartments listed on a single
   container menu.)

STATE OWNERSHIP: a small Zustand store (collapse-state-store),
mirroring position-pin-store: the canvas subscribes, and a change
triggers a layout re-run with the new collapsed set folded into the
input. Host code can also drive it directly (the wiring-guide
pattern), and it serializes into the workspace document alongside
pins and positions (a later workspace-slice concern; the store shape
is chosen to drop in).

SELECTION INTERACTION: collapsing a compartment whose row is
currently selected clears that row from the selection (the element
no longer exists); the canvas already removes stale ids on
re-render, so this needs no special handling beyond not
resurrecting them.

SLICE BOUNDARY: round 34 shipped the INPUT-side model (builder reads
collapsed state; geometry omits collapsed rows; tests). Round 36
shipped the CANVAS side: the compartment-collapse-store (Zustand,
mirroring position-pin-store; serializes into the workspace document
later) and the built-in "Collapse/expand compartments" context-menu
contribution (filters to structural containers via the converter's
`_structuralContainer`/`_compartmentIds` tags, toggles the
container's compartment keys in the store). The canvas renders
whatever geometry the host computes, so the host subscribing to the
store and re-running layoutStructural is the clean separation; the
canvas itself needs no collapse-specific code. VA-27 demonstrates
both surfaces: the right-click action (per-container) and a global
button (component-config, which just seeds the store).

- Heavy-computation-external is NOT violated: layout is interactive
  visualization machinery (like fcose), not analytic computation;
  the algorithm-results interchange is unaffected.
- Restyle-only discipline holds: theme and spec changes over a
  structural view restyle in place; re-running the structural layout
  is an explicit user action, never a side effect of styling.
- Chain edges and divider rows are synthetic and never render as
  graph elements; exporters must filter them (isChainEdgeId; divider
  rows carry the divider flag). The A2 slice owns wiring that filter
  into the export path.

## Layout stability, edge routing, and ports (recent effort)

This section records the layout-stability and edge-routing work layered
onto the structural view after the A1/A2 slices: the dead ends and why
they failed (so they are not retried), the architecture that worked, the
trade-offs, and the open item. It is deliberately explicit about the
Cytoscape and ELK internals that drove each decision, because none of it
is obvious from the public APIs.

### Camera and node-position stability (decision D15)

Symptom: collapsing a container, dragging it, then selecting another
container reverted both the drag and the camera. The canvas was
recreating its Cytoscape instance on essentially every parent render,
and a fresh instance loses the viewport and every manual node position.

Three compounding causes, each fixed:

- The instance is built in `initCytoscape` (a useCallback) and run from a
  `useEffect` keyed on it. The effect cleanup runs first on any change and
  destroys + nulls `cyRef` BEFORE the next init, so the original
  "capture pan/zoom before destroy" inside init always read a null ref
  and fell through to a fit. Fix: capture the live camera in the effect
  CLEANUP (while the instance is alive) into a ref, and restore it in the
  next init when the rebuild is same-graph.
- The rebuild trigger was the `structuralDecorations` object, which the
  host passes as a fresh literal (`{{ collapsedContainers }}`) every
  render. So selection or hover (which re-render the host) changed the
  dependency by identity and recreated the instance. Fix: key the rebuild
  on decoration CONTENT (a stable string over the three decoration sets),
  and read the live decorations through a ref.
- Same-graph identity is the sorted top-level node-id set. It is stable
  across collapse/expand and re-layout (same nodes) and survives the
  asynchronous two-render geometry update (decorations land first, the
  new geometry second). Fit happens only on first mount or a genuinely
  different graph.

Principle (D15 in specs/09-design-decisions.md, doctrine in CLAUDE.md):
SAME INPUT GRAPH => camera (pan/zoom) and node positions HOLD. Re-init or
refit only on a different graph or an explicit user op (fit/zoom buttons,
focus, reheat, layout-algorithm selection). Known gaps: a genuine
geometry change (collapse, re-layout) still recreates from layout
geometry, so manual drags are not preserved across it; the force-directed
path does not yet restore the camera across a same-graph re-init.

### Edge routing: what does NOT work with the Cytoscape taxi style

Body edges (no declared port) originally attached to node centers, so
multiple edges leaving one side of a block converged at a single point.
Two attempts to spread them with Cytoscape failed; both are recorded so
they are not retried.

- Offset endpoints via `source-endpoint`/`target-endpoint` data: the
  edges visibly moved (those props ARE data()-mappable) but rendered
  angled and sometimes routed back across the block. Root cause, read
  from the Cytoscape source: `findTaxiPoints` computes the route from
  `pairInfo.posPts`, the node CENTER positions, not the resolved
  endpoints. So an offset attachment plus a center-based turn forces a
  diagonal connector by construction, and `taxi-direction` only chooses
  the axis from those same center deltas. Taxi cannot route orthogonally
  to an offset point on a node body. No tuning fixes this.
- Pinning `taxi-direction` via a `data()` mapping: silently ignored.
  `taxi-direction` has Cytoscape type `axisDirection`, a pure enum with no
  mapping capability, so `data(_taxiDir)` is rejected at stylesheet parse
  time and the base `auto` wins (this looked exactly like "the change
  reverted"). Lesson: enum-typed style properties are NOT data()-mappable;
  carry per-element enum values as CLASSES with static rules.

Conclusion: the offset-endpoint-on-taxi approach was reverted in full.

### ELK layout control surface (modeled on yFiles)

The top-level layout previously set only algorithm, direction, and node
spacing. The yFiles routers (OrthogonalEdgeRouter, the newer EdgeRouter,
ChannelEdgeRouter) were used as the reference for the controllable
surface, mapped to ELK and exposed on `StructuralLayoutOptions`:

- routing style -> `edgeRouting` (ORTHOGONAL | POLYLINE | SPLINES),
  `elk.edgeRouting`
- port constraints (which side / exact position) -> `elk.portConstraints`
  (FIXED_SIDE | FIXED_ORDER | FIXED_POS) + `elk.port.side`
- segment spacing (to node sides, between segments) -> `edgeNodeSpacing`,
  `edgeEdgeSpacing` (`elk.spacing.edgeNode`, `elk.spacing.edgeEdge`, plus
  the between-layer variants)
- node / layer spacing -> `spacing`, `layerSpacing`
- monotonic direction -> `direction`
- node placement, crossing minimization -> `nodePlacement`,
  `crossingMinimization`

Defaults favor legibility: 16px edge-to-node, 12px edge-to-edge,
BRANDES_KOEPF placement, LAYER_SWEEP crossing minimization. These knobs
move node placement and are verifiable from the geometry (a wider
`layerSpacing` widens the extent; covered by a test). NOTE: `edgeRouting`
presently affects only how much room ELK reserves, because the geometry
document does not yet carry ELK's computed edge sections (see the open
item). `layoutOptionsKey` includes every knob so the layout cache is
correct.

### Port-based body-edge attachment (the approach that works)

Rather than draw body edges between node bodies, every body edge (no
declared `sourcePort`/`targetPort`) gets a SYNTHETIC attachment port on
each end (`edgePortId(edgeId, "s"|"t")`, prefix `__g3t_eport__`):

- ELK places and DISTRIBUTES these ports along the node side under
  `FIXED_SIDE`, so multiple edges on one side fan out automatically. ELK
  does the distribution; we do not compute offsets. (Verified: two edges
  leaving one node get distinct positions on the same side.)
- Side policy. Data-flow (declared) ports default to the flow axis
  (EAST/WEST for a RIGHT/LEFT layout), so they sit left/right; body edges
  attach perpendicular to the flow (NORTH/SOUTH for a horizontal layout):
  "ports left/right, links top/bottom". A declared port with no explicit
  side defaults to the flow-forward side if it is used as a sourcePort
  (output) or the flow-backward side if used as a targetPort (input);
  explicit sides still win. The policy follows `direction` (a DOWN layout
  flips the axes).
- The synth ports flow through `geometry.ports` and render as INVISIBLE
  Cytoscape nodes (class `g3t-structural-edge-port`: 1x1, no fill, no
  border, events off). The edge attaches to the port node, reusing the
  existing port-attached-edge render path (the one with no reported
  routing problems).
- Drag-sync. `wireStructuralPortDrag` moves sibling ports with their host
  (ports are top-level siblings, not compound children). It now selects
  BOTH the visible and the synth port classes; previously synth ports
  stayed behind and the body edge detached when its node was dragged.
- Perpendicular exit. Because the edge now attaches to a real port NODE
  (not a body offset), `taxi-direction` finally takes effect. Each edge
  carries a static direction class from its source port side
  (SOUTH -> downward, NORTH -> upward, EAST -> rightward, WEST -> leftward)
  so it leaves the port heading AWAY from the node rather than doubling
  back. This is the same class mechanism that did nothing for
  body-offset edges; it works here only because the source is a genuine
  node.

### Trade-offs and open decisions

- N/S body ports vs target-facing. In a horizontal layout a backward body
  edge (target in an earlier layer) attached on N/S ports must travel
  across and around to reach the other block; the perpendicular exit
  keeps that clean (it does not cross the source) but does not shorten it.
  The alternative is FREE port constraints, where ELK faces each port
  toward its partner so routes are short, at the cost of not being
  strictly top/bottom. Candidate policy: `bodyEdgePorts: "topBottom" |
  "auto"`.
- Per-node constraint. `elk.portConstraints` is a node-level option, so a
  node carrying both declared and synth ports cannot mix FIXED_SIDE and
  FREE. Most real nodes are mixed, so the choice is effectively
  graph-wide.
- Drag-time attachment: U-turn vs side swap. When a node is repositioned at
  runtime, `wireStructuralPortDrag` keeps the obstacle-aware ELK route and
  reshapes it (`rescaleBends`) rather than re-running layout. Because the
  attachment-face migration is gated conservatively (it flips only once the
  other endpoint clears the box's FAR edge, and flips the dragged endpoint
  only), a reposition that inverts two nodes' relative position usually reads
  as an orthogonal 180-degree turn, NOT as the attachment hopping to the
  now-facing faces. This is intended behavior under the current gate, and the
  full rationale plus the change required to get true facing-side swaps (an
  earlier center-crossing gate and symmetric both-endpoint migration, trading
  away the preserved ELK route sooner) is documented in
  `packages/react/src/views/canvas/ROUTING.md` ("Why a reposition usually
  reads as a U-turn, not a side swap").

### Open item: edges route AROUND elements, not behind (next change)

Taxi (and any center-anchored Cytoscape curve style) routes orthogonally
between its endpoints but does NOT avoid intervening nodes, so an edge can
pass behind a block. Obstacle-aware routing requires rendering ELK's own
orthogonal routes (ELK's router routes around nodes). Plan: have
`layoutStructural` emit edge sections (start point, bend points, end
point, in absolute coordinates) into the geometry document, and render
them in Cytoscape via `curve-style: segments`, computing
`segment-distances`/`segment-weights` from the bend points relative to the
resolved endpoints. Ship as a default with a config option to disable
(fall back to the current port-to-port taxi). This is the next
substantive change.

### Code change map

- `packages/core/src/layout/structural.ts`: `StructuralLayoutOptions`
  knobs; `StructuralPort.side` made optional; `edgePortId`/`isEdgePortId`;
  side policy (forward/backward/body sides, `declaredPortSide`); synth
  port synthesis; ELK graph options (edgeRouting, nodePlacement,
  crossingMin, edge-node/edge-edge spacing); edges repointed to synth
  ports; geometry flattening reads the resolved side and includes synth
  ports; `layoutOptionsKey` includes the new knobs.
- `packages/core/src/index.ts`: export `edgePortId`/`isEdgePortId`.
- `packages/react/src/views/canvas/structural-to-cytoscape.ts`: synth
  ports rendered invisibly (`g3t-structural-edge-port`); body edges
  attach to synth ports; per-edge perpendicular-exit direction class plus
  four static `taxi-direction` rules; invisible-port style rule;
  `wireStructuralPortDrag` includes synth ports.
- `packages/react/src/views/canvas/CytoscapeCanvas.tsx`: camera captured
  in the effect cleanup; same-graph restore keyed on node-id identity;
  decoration rebuild keyed on content (D15).
- `CLAUDE.md`, `specs/09-design-decisions.md`: D15.
- Tests: `structural.test.ts` (layerSpacing effect + cache bypass);
  `structural-to-cytoscape.test.ts` (synth-port distribution, invisible
  rendering, perpendicular-exit class, declared-port end unchanged);
  `CytoscapeCanvas.test.tsx` (camera preserve across same-graph rebuild,
  decoration churn does not re-init).
