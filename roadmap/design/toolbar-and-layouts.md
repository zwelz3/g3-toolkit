# Toolbar and Layouts: Design Notes

**Area:** design
**Owns:** no spec requirements; resolutions and roadmap items from the
round-15 toolbar review (2026-06-11).

## Motion vs running (the "animate" semantics, settled)

"Animate" on a layout never meant "the engine runs": the engine runs
either way. Animate ON means you WATCH the simulation (heatup and
cooldown for force layouts, transition for discrete ones); OFF means
you get the converged result without the motion. The toolbar
therefore carries no animate toggle at all: watching-vs-not is a
motion preference, and motion preferences belong to the OS
(prefers-reduced-motion) and the page-level toggle, which layoutConfig
already honors. LayoutManager (the sidebar form) keeps its checkbox
for hosts that want explicit control.

## Pinning model

- **Whole-graph (SHIPPED, toolbar "Pin all"):** locks every node
  position; layout controls are DISABLED with an explanatory title,
  never silently ignored (the round-15 freeze guard swallowed layout
  switches while the select still changed: a lying UI).
- **Per-node (SHIPPED, round 17):** position-pin per node from the
  context menu ("Pin / unpin position"), stored in
  position-pin-store (same nodeId scope model as style overrides),
  locking the node against layout runs. Indicator decision: a soft
  gray UNDERLAY hugging the node (the selection gasket is an OFFSET
  outline, so the two compose without collision; border channels
  stay reserved). Composition shipped exactly as designed:
  computeLockedIds is the pure rule (pin-all = union; pin-all
  release returns to the per-node pin set), and the toolbar's Pin
  all only flips the whole-graph flag: the canvas pin effect owns
  all locking, so there is one source of truth.

## Compound containers and ELK (slice 1 SHIPPED, round 17)

Sequencing note (2026-06-12 regrouping): the ELK slice is GROUP A of
the reprioritized roadmap, pulled forward because its compartment
API has two committed clients (UML custom views and the SHACL shape
view). The dagre bundling question is folded into this work:
evaluate ELK layered as the DAG layout; if adequate, dagre stays
unbundled permanently. Round-31 update: the Group A strategy,
spike-validated ELK recipe, and slice plan now live in their own
design record, design/structural-rendering.md (which owns R1.18);
slice A1 (the geometry layer in core) shipped, and the headless
answer to the dagre question is that ELK layered suffices.

Slice 1: ugmToCytoscapeElements accepts a containment option
({edgeType, direction}); matching edges become Cytoscape parent
assignments (and are omitted as rendered edges), containers render
as UML element containers (round-rectangle, light fill,
«Stereotype» + name label pinned top) via COMPOUND_CONTAINER_RULE,
and fcose's compound awareness keeps children inside through force
runs. Gap (1) from this slice CLOSED in round 20: themeColorRules in
CytoscapeCanvas carries theme-resolved canvas colors (labels, edges,
selection, :parent surfaces) merged between the structural defaults
and the user stylesheet; a theme switch restyles IN PLACE through
the shared stylesheet assembly (never re-initializing, so positions
hold), and generic selectors guarantee the spec's attribute mappers
always win. The standalone deriveCytoscapeStyle export remains for
hosts composing their own stylesheets. Gap (2), boundary ports and
true compartments, remains with the ELK milestone below.

## Original framing (pre-slice-1)

ELK's layered layouts earn their keep when nodes are CONTAINERS:
UML/SysML element rendering (blocks with parts, ports on boundaries,
internal structure) over Cytoscape compound parents. Until that
rendering exists, a layered engine over plain dots adds nothing over
breadthfirst, which is why ELK (and dagre, pending its extension
being bundled) left the selectable list in round 16: both silently
degraded to breadthfirst, which misleads. The container milestone:
compound-parent mapping from UGM containment edges, boundary ports,
ELK (or fcose compound support) as the layout pairing, and the
node.shape/UML stereotypes work feeding the same rendering.

## Round-16 layout audit (requested pass)

Issues found and dispositions:

1. **Slider re-layout storm (FIXED):** LayoutManager committed
   onLayoutChange on every option tick; a single drag queued dozens
   of competing layout runs. Commits now debounce 250ms after the
   drag settles (regression-tested); the toolbar's popover goes
   further with an explicit "Run layout" commit.
2. **Freeze swallowed layout switches silently (FIXED):** controls
   now disable with an explanation while pinned.
3. **dagre/elk degradation lie (FIXED):** removed from the selectable
   list; layoutConfig still maps the ids sanely for external callers.
4. **fit-on-every-run resets user zoom (KEPT, deliberate):** layout
   switches should re-frame; Fit is one click away when it surprises.
5. **fcose randomize:false (KEPT, deliberate):** runs are incremental
   from current positions, which preserves the user's mental map.
   The "shuffle" escape hatch SHIPPED (round 19): a toolbar control
   re-running force from randomized positions, force-layouts only,
   disabled while pinned; Re-run stays incremental.
6. **Search zoom floor 1.2 (KEPT):** centering a match from a
   zoomed-out overview should land somewhere readable.
