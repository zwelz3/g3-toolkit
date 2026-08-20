# Wiring Guide: Driving g3-toolkit from Your Application

Audience: adopters embedding the toolkit inside a larger decision-
support or process application, who need their OWN buttons, panels,
and workflows to control toolkit behavior, and toolkit state to flow
back out into their components.

Every snippet here is typechecked in CI against the real package types
(`pnpm run verify:snippets`), so a recipe naming a removed or renamed
export fails the build rather than sitting here misleading you. The
integration paths they describe additionally run as executable tests in
`examples/wiring/src/`. Snippets show their imports and assume the
values you own (`ugm`, `cy`, your settings) are in scope.

## The integration surface

g3t is a component library with a deliberately thin integration
surface, in three parts:

1. **Stores** (zustand): selection, position pins, structural
   overlays, style overrides, and theme are global stores you can
   read, write, and subscribe to from ANY component, yours or ours.
   `useXStore(selector)` in React; `useXStore.getState()` /
   `useXStore.subscribe(...)` anywhere (event handlers, services,
   non-React code).
2. **Props + callbacks**: graph data (`ugm`), the encoding spec
   (`encodingSpec`), containment, and `onReady` (which hands you the
   Cytoscape `Core` for camera and layout control).
3. **Documents** (versioned JSON contracts): the encoding spec,
   workspace snapshots, and algorithm results all serialize to
   validated documents, which is how external processes (Python
   services, pipelines, saved state) participate.

A useful consequence: a "custom button" is almost always one line of
store or function call in an `onClick`.

## Composition levels (what to grab at which size)

- **Atoms**: `Icon`, the `g3t-btn` / `g3t-select` / `g3t-input` CSS
  classes, design tokens (`--g3t-*`). Use these to make YOUR controls
  look native next to ours.
- **Molecules**: `SearchBar`, `ZoomControls`, `SpecPort`,
  `ThemeSwitcher`, `SpecLegend`, `ContextMenu`. Single-purpose,
  callback-driven; compose them into your own bars and panels.
- **Compounds**: `CytoscapeCanvas`, `GraphToolbar`,
  `EncodingSpecPanel`, `AlgorithmPanel`, `LayoutManager`,
  `StatsPanel`, the view components. Opinionated assemblies wired to
  the stores; drop them in whole, or rebuild them from molecules
  using the same stores (GraphToolbar itself is the worked example:
  read its source).

## Custom buttons (the core recipes)

### Pin / unpin everything

```tsx
import { usePositionPinStore } from "@g3t/react";

function PinAllButton() {
  const allPinned = usePositionPinStore((s) => s.allPinned);
  return (
    <button
      className="g3t-btn"
      aria-pressed={allPinned}
      onClick={() => usePositionPinStore.getState().setAllPinned(!allPinned)}
    >
      {allPinned ? "Unpin all" : "Pin all"}
    </button>
  );
}
```

The canvas owns the locking: flipping the store flag is the whole
job, and releasing returns to any per-node pins your users set via
the context menu.

### Select and focus a node of interest

```tsx
import { useRef } from "react";
import type { Core } from "cytoscape";
import { useSelectionStore, CytoscapeCanvas } from "@g3t/react";

function FocusButton({ cy, nodeId }: { cy: Core | null; nodeId: string }) {
  return (
    <button
      className="g3t-btn"
      onClick={() => {
        useSelectionStore.getState().selectNodes([nodeId]);
        const ele = cy?.getElementById(nodeId);
        if (ele?.nonempty()) {
          cy?.animate({ center: { eles: ele }, zoom: 1.4 }, { duration: 250 });
        }
      }}
    >
      Focus suspect asset
    </button>
  );
}
// cy comes from <CytoscapeCanvas onReady={setCy} />
```

### Re-run or shuffle the layout

The canvas also accepts `layoutOptions`, merged into the layout
object after the built-in tuning (caller wins; keyed by content so
inline literals never re-init the instance). Use it for per-view
spacing (`idealEdgeLength`, `nodeRepulsion`, `padding`) or to switch
fcose to end-mode animation (`animate: "end"`) when per-tick
rendering is too heavy.

```tsx
import { runGraphLayout, DEFAULT_LAYOUT_OPTIONS } from "@g3t/react";

<button
  className="g3t-btn"
  onClick={() => runGraphLayout(cy, "force", DEFAULT_LAYOUT_OPTIONS)}
>
  Re-layout
</button>;
// Fourth argument `true` randomizes (the "shuffle" escape hatch).
```

### Theme from your app's settings

```tsx
import { useThemeStore } from "@g3t/react";
useThemeStore.getState().setTheme(orgSettings.darkMode ? "dark" : "light");
```

### Drive the encoding from app state

The spec is plain serializable state YOU own:

```tsx
import { useState } from "react";
import {
  CytoscapeCanvas,
  EncodingSpecPanel,
  SpecLegend,
  type EncodingSpec,
} from "@g3t/react";

const [spec, setSpec] = useState<EncodingSpec>(initialSpec);

<>
  {/* Your button: */}
  <button onClick={() => setSpec(riskViewSpec)}>Risk view</button>
  {/* Our components: */}
  <EncodingSpecPanel ugm={ugm} spec={spec} onChange={setSpec} />
  <CytoscapeCanvas ugm={ugm} encodingSpec={spec} />
  <SpecLegend ugm={ugm} spec={spec} />
</>;
```

`parseEncodingSpec` / `serializeEncodingSpec` round-trip it through
storage or URLs; reserved-channel violations are rejected by name.

### Filter by hiding, not by rebuilding

`FacetFilter` emits the set of hidden TYPES. Map that to node ids and pass
it to the canvas as `hidden`; the canvas hides them with a class
(`display:none`) in a batched restyle, so node positions and the
Cytoscape instance survive. Do NOT feed a pre-filtered UGM as `ugm`: a new
`ugm` reference re-creates the instance and re-runs layout on every
toggle.

```tsx
import { useMemo, useState } from "react";
import { CytoscapeCanvas, FacetFilter } from "@g3t/react";

const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

// A node is hidden only when ALL of its types are hidden; it stays
// visible while it still has any shown type (faceted-filter semantics).
const hidden = useMemo(() => {
  const ids = new Set<string>();
  if (hiddenTypes.size === 0) return ids;
  ugm.forEachNode((id, attrs) => {
    if (attrs.types.length > 0 && attrs.types.every((t) => hiddenTypes.has(t)))
      ids.add(id);
  });
  return ids;
}, [ugm, hiddenTypes]);

<>
  <FacetFilter ugm={ugm} onFilterChange={setHiddenTypes} />
  <CytoscapeCanvas ugm={ugm} hidden={hidden} />
</>;
```

### Route edges around nodes on any layout

`CytoscapeCanvas` can post-process every non-structural layout to route edges
around intervening nodes, using an A\* obstacle-aware router. Pass `routeEdges`
(default off in the library; the shipped demo shells enable it). Structural
scenes are detected automatically and the pass is skipped there.

**Routing modes** (set via `routeEdges={{ mode: "..." }}`):

| Mode                 | Behaviour                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `"direct"` (default) | Only routes edges whose straight line crosses a node box. Clear edges stay as bezier curves — the common case keeps its natural look. |
| `"orthogonal"`       | Routes every edge orthogonally regardless of crossing, matching the look of the structural block router.                              |

`routeEdges={true}` or `routeEdges` (bare) uses `"direct"` mode.

```tsx
import { CytoscapeCanvas } from "@g3t/react";

// Direct mode (default): only edges that would cross a node get routed.
export const Simple = () => <CytoscapeCanvas ugm={ugm} routeEdges />;

// Orthogonal mode: always route every edge as an L-/Z-shape.
export const AlwaysOrthogonal = () => (
  <CytoscapeCanvas ugm={ugm} routeEdges={{ mode: "orthogonal" }} />
);

// Off: bezier (Cytoscape default), no obstacle-aware pass.
export const Off = () => <CytoscapeCanvas ugm={ugm} routeEdges={false} />;

// Tuning options compose with mode:
export const Tuned = () => (
  <CytoscapeCanvas
    ugm={ugm}
    routeEdges={{
      mode: "direct",
      maxEdges: 400,
      clearance: 16, // more breathing room around obstacles
      bendPenalty: 60, // straighter routes, fewer corners
      minStub: 24, // shorter perpendicular exits before a bend
    }}
  />
);
```

The pass runs on every `layoutstop` (subject to the `maxEdges` cap) and on
`drag-free` for the dragged node's incident edges. It is a restyle, never a
re-init: camera and positions hold. Edges that fail to route (or whose
polyline is straight) revert to bezier without phantom polylines.

### Refresh routes / re-layout / isolate an edge

Three developer ops that live on `CytoscapeCanvas` as counter-based signal
props (host bumps the number, canvas fires on real change) plus an opt-in edge
tap mode. Signals are per-instance — no global command bus — so several
canvases on a page respond only to their own bumps.

| Prop                          | What it does                                                                                                                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routeRefreshSignal?: number` | Re-runs the routing pass on the **current** node positions without moving any node. Use after a manual drag to clean up incident and neighbor edges. No-op when `routeEdges` is off/undefined or the scene is structural.                |
| `relayoutSignal?: number`     | Runs the crossing-aware placement optimizer over the visible scene, applies the returned positions, then re-runs routing. An explicit user op — this MOVES nodes; camera hold does not apply (same class as reheat). Non-structural.     |
| `edgeClickIsolate?: boolean`  | When true, tapping an edge isolates it via the emphasis layer (dims everything else, highlights the tapped line). Tapping the same edge or the background clears the isolate. Off by default so existing canvases keep click-to-select.  |

```tsx no-check
import { useState } from "react";
import { CytoscapeCanvas } from "@g3t/react";

export function CanvasWithOps({ ugm }) {
  const [refresh, setRefresh] = useState(0);
  const [relayout, setRelayout] = useState(0);
  return (
    <>
      <button onClick={() => setRefresh((n) => n + 1)}>Refresh routes</button>
      <button onClick={() => setRelayout((n) => n + 1)}>Untangle</button>
      <CytoscapeCanvas
        ugm={ugm}
        routeEdges
        edgeClickIsolate
        routeRefreshSignal={refresh}
        relayoutSignal={relayout}
      />
    </>
  );
}
```


### Register an algorithm result from your backend

```tsx
import {
  parseAlgorithmResult,
  applyAlgorithmResult,
  ingestAlgorithmResults,
  type UGM,
} from "@g3t/core";
import { useOverlayStore } from "@g3t/react";

async function showCommunities(ugm: UGM) {
  const json = await fetch("/api/algorithms/louvain").then((r) => r.text());
  const doc = parseAlgorithmResult(json); // versioned, validated
  const overlay = applyAlgorithmResult(ugm, doc, ingestAlgorithmResults);
  if (overlay) useOverlayStore.getState().register(overlay);
  // property-shaped results landed in the UGM: drive the spec from
  // them (color by community) and the legend follows.
}
```

### Add your action to the canvas context menu

The base menu is functional with zero config, and follows a strict
contract: items are wired or absent, never rendered dead. With no
menuManager the canvas shows one item, a clipboard-wired copy whose
label follows the element id ("Copy IRI" for schemed ids, the RDF
case; "Copy ID" otherwise). "Inspect properties" appears only when
you wire it, because only the host app knows its detail surface:

```tsx
import { createDefaultMenuManager, useSelectionStore } from "@g3t/react";

const manager = createDefaultMenuManager({
  // Selection IS the inspect surface in most g3t apps: the inspector,
  // table, or lineage panel renders whatever is selected.
  onInspect: (t) => {
    if (t.id) useSelectionStore.getState().selectNodes([t.id]);
  },
  // idLabel: "iri" | "id" overrides the heuristic; onCopy replaces
  // the clipboard behavior.
});
// <CytoscapeCanvas menuManager={manager} ... />
```

Register app-specific actions on the same manager (the playground's
Scale surface does this live with "Drill into cluster"):

```tsx
import { ContextMenuManager } from "@g3t/react";

const manager = new ContextMenuManager();
manager.register("my-app", [
  {
    id: "open-dossier",
    label: "Open dossier",
    filter: (t) => t.type === "node",
    action: (t) => navigate(`/dossier/${t.id}`),
  },
]);
// <CytoscapeCanvas menuManager={manager} ... />
```

### The full toolkit action set

`registerToolkitActions` registers the complete node/edge/multi-select
menu (pin, inspect, neighbors, focus, paths, appearance, hide, bulk
color). Store-backed items work immediately; the rest EMIT events, and
mounting the set without consuming them recreates dead menu items, so
wire every event you expose. The Analytics Dashboard in the playground
consumes all seven (CI-tested there); the pattern:

```tsx
import { useEffect } from "react";
import { ContextMenuManager, registerToolkitActions } from "@g3t/react";
import { G3tEventBus } from "@g3t/core";

const bus = new G3tEventBus();
const manager = new ContextMenuManager();
registerToolkitActions(manager, { ugm, eventBus: bus, defaultHops: 2 });

useEffect(() => {
  const unsubs = [
    bus.on("context:focusNode", ({ nodeId, hops }) => {
      // hide everything outside the k-hop neighborhood
    }),
    bus.on("context:findPath", ({ sourceId, targetId }) => {
      // findShortestPath + select the route
    }),
    // context:viewNeighbors, context:hideNodes, context:viewSubgraph,
    // context:editAppearance (mount NodeStyleEditor),
    // context:pinNodes
  ];
  return () => unsubs.forEach((u) => u());
}, [bus]);
```

### Lay out a structural (UML-style) view

Containers with typed compartment rows and boundary ports come back
as a versioned geometry document of absolute boxes; rows are REAL
elements, so selection, overlays, and badges apply to them like any
node:

```tsx
import { layoutStructural, isChainEdgeId } from "@g3t/core";

const geometry = await layoutStructural({
  nodes: [
    {
      id: "sensor",
      header: { stereotype: "Block", name: "Sensor" },
      compartments: [
        {
          id: "attributes",
          title: "attributes",
          rows: [
            { id: "sensor.cal", text: "calibrationDate : xsd:date [1..1]" },
          ],
        },
      ],
      ports: [{ id: "sensor.out", side: "EAST" }],
    },
    { id: "lens", header: { name: "Lens" } },
  ],
  edges: [
    { id: "feeds", source: "sensor", target: "lens", sourcePort: "sensor.out" },
  ],
});
// geometry.nodes: absolute top-left boxes; rows carry parent,
// compartment, text, and a divider flag for compartment titles.
// geometry.ports: boundary positions with their declared side.
// Filter synthetic row-ordering edges anywhere you enumerate edges:
// isChainEdgeId(id).
//
// UML edge symbols (A3): set `kind` on a StructuralEdge for the
// relationship arrow vocabulary: "composition" (filled diamond at the
// source/whole end), "aggregation" (hollow diamond), "generalization"
// (hollow triangle at the target/parent end), "dependency" (dashed,
// open arrow), or "association" (plain arrow, the default).
```

Compartment collapse is NOT part of the surface. A layout-time
collapse input (`compartmentKey`, `collapsedCompartments`) and its
context-menu store shipped once and were removed by maintainer
ruling on 2026-07-10; see `planning/expand-collapse-postmortem.md`
for why, and read it before proposing anything equivalent. To hide
detail today, build the `StructuralGraphInput` with the rows you
want and re-run `layoutStructural`: the input IS the projection, so
a host that owns which rows it emits already owns collapse.

### Render a SHACL shape graph (same compartment API)

A SHACL shapes graph renders through the identical structural
pipeline: shapes become containers, property constraints become
compartment rows, and a validation report badges individual rows.
No SHACL-specific renderer:

```tsx
import {
  shaclShapesToStructural,
  shaclRowSeverities,
  closedShapeIds,
  layoutStructural,
} from "@g3t/core";
import { CytoscapeCanvas } from "@g3t/react";

const input = shaclShapesToStructural(shapes, {
  references: { "PersonShape::worksFor": "OrgShape" }, // sh:node edges
});
const geometry = await layoutStructural(input);

// Pass closed/open borders and per-row severities as decorations:
<CytoscapeCanvas
  ugm={shapeUgm}
  structural={{ input, geometry }}
  structuralDecorations={{
    closedContainers: closedShapeIds(shapes),
    rowSeverities: shaclRowSeverities(validationResults), // worst-wins
  }}
/>;
```

### Visualize a SHACL validation report over the data graph

A report renders by reusing the overlay + encoding machinery, no
SHACL-specific canvas code. Conformance runs wherever (pyshacl, Jena,
the in-core validator); the toolkit consumes a versioned document:

```tsx
import {
  validateShacl,
  reportFromValidationResults,
  severityOverlays,
  shaclResultDrivers,
  ingestAlgorithmResults,
} from "@g3t/core";
import { useOverlayStore } from "@g3t/react";

const report = reportFromValidationResults(validateShacl(ugm, shapes));
// (or parseShaclReport(externalPyshaclReport) for an external engine)

// Severity tiers as independently toggleable overlays:
for (const overlay of severityOverlays(report)) {
  useOverlayStore.getState().register(overlay, true);
}
// Count + worst-severity as encoding drivers (color/size via the grammar):
ingestAlgorithmResults(ugm, shaclResultDrivers(report));
// then point spec.node.color at "_shacl_maxSeverity" and
// spec.node.size at "_shacl_resultCount".
```

### Link the shape view and the data view

When both canvases are open, cross-link them through the shared
selection store: selecting a validation result highlights the focus
node (data canvas) and the source shape's container plus the
offending property row (shape canvas) at once. No new machinery:

```tsx
import { resultSelectionIds, resultDetail } from "@g3t/core";
import { useSelectionStore } from "@g3t/react";

// On clicking a result in your report list:
useSelectionStore.getState().selectNodes(resultSelectionIds(result));
// -> selects [focusNode, sourceShapeContainer, propertyRow] across
//    every canvas subscribed to the store. A node-level result omits
//    the row; a result with no source shape selects only the node.

// For an inspector panel, shape the result for display:
const detail = resultDetail(result); // { focusNode, sourceShape, path, severity, message, value }
```

Canvas application (compound parents + preset row positions) is the
next slice; the document is renderer-neutral, so you can already
consume it for SVG export or your own drawing layer.

### Render a provenance trace

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`. The
ProvenanceTrace panel renders a pre-order hop chain (any lineage your
app derives; the auditor shell walks PROV-O edges) with tiers, edge
details, and ABSENCE hops for evidence that should exist and does not:

```tsx
import { ProvenanceTrace, type ProvenanceChain } from "@g3t/react";

const chain: ProvenanceChain = [
  { id: "rel", tier: "entity", label: "Release 1.2", depth: 0 },
  {
    id: "build",
    tier: "activity",
    label: "CI build",
    detail: "wasGeneratedBy",
    depth: 1,
    parentId: "rel",
  },
  {
    id: "rel::gap",
    tier: "gap",
    label: "No attribution recorded",
    depth: 1,
    parentId: "rel",
    leaf: true,
    absence: true,
  },
];

<ProvenanceTrace
  chain={chain}
  title="Lineage"
  onSelectHop={(id) => console.log(id)}
/>;
```

## Box (lasso) selection: the gesture

Box selection is on by default (`boxSelectionEnabled: true`), but with
panning also enabled cytoscape treats a plain background drag as a PAN;
box mode engages only while a multi-select modifier is held. So:
shift+drag (or ctrl/cmd+drag) the background to box-select; the
box-selection sync pushes the picked nodes into `useSelectionStore`
like any other selection. (Implementation note: cytoscape emits
`boxend` BEFORE applying the box's selection, so the sync collects the
per-element `box` events instead of reading `:selected` in `boxend`;
see box-selection-sync.ts.) If your app prefers plain-drag box selection,
disable user panning on the canvas and offer another pan affordance.
The "Patterns/Coordinated Selection" story demonstrates it live.

## The other direction: toolkit state driving YOUR components

Subscribe to stores from anything:

```tsx
import { useSelectionStore } from "@g3t/react";

// React: your detail pane follows the toolkit selection
function MyDossierPane() {
  const selected = useSelectionStore((s) => [...s.selectedNodeIds]);
  return <DossierLookup ids={selected} />;
}

// Non-React (services, telemetry, process orchestration):
const unsubscribe = useSelectionStore.subscribe((state) => {
  processEngine.notify("selection", [...state.selectedNodeIds]);
});
```

Workspace snapshots make the WHOLE working state portable into your
persistence and process layer:

```tsx
import {
  captureWorkspace,
  applyWorkspace,
  serializeWorkspace,
  parseWorkspace,
} from "@g3t/react";
const snapshot = captureWorkspace({ cy, spec });
await saveToCase(caseId, serializeWorkspace(snapshot)); // your storage
// later, possibly another session:
applyWorkspace(parseWorkspace(saved), { cy, setSpec });
```

## Projection pipeline (RDF to LPG)

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`
("projection pipeline" describe). The pipeline turns a triple graph
into the labeled-property graph the views render; the collapse steps
are what make an RDF dataset legible on a canvas (rdf:type becomes the
node's type, literals become properties, blank nodes and RDF lists
resolve into the structures they encode).

```ts
import { createPresetPipeline } from "@g3t/core";
const ugm = createPresetPipeline("standard").project(rdfGraph);
// rdf:type -> node.types; literals -> node.properties; blank-node and
// list structures resolved. Presets: "standard", "ontology",
// "provenance-preserving".
```

Compose your own step set when the presets don't fit:

```ts
import { ProjectionPipeline, typeCollapse } from "@g3t/core";
const p = new ProjectionPipeline();
p.addStep({ name: "Type Collapse", transform: typeCollapse, enabled: true });
const ugm = p.project(rdfGraph);
p.getSteps(); // inspectable, so a UI can show or toggle steps
```

The biomedical playground shell renders this live: its canvas toggle
shows the raw triple view beside the projected one, and its caption
lists the preset's step names straight from `getSteps()`.

## RDF 1.2 hyperarcs (triple terms)

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`
("rdf 1.2 hyperarcs" describe). RDF 1.2 lets a statement be a term
(`« s p o »`), so you can annotate a fact with who stated it,
confidence, time. `SparqlAdapter` parses the SPARQL-1.2-JSON `triple`
binding shape; `tripleTermToValue` folds it losslessly to a JSON
value; two projections shape it for a canvas:
`projectTripleTermsAsEdges` (haunt g-xplore style, one dashed `star`
edge per annotation) and `projectTripleTermsAsHyperarcs` (reification
onto a diamond `_Statement` pseudo-node). The hyperarc render is the
one that survives NESTING (`« « s p o » p2 o2 »`): a UGM edge cannot
have an edge as an endpoint; a node can.

```ts
import {
  projectTripleTermsAsHyperarcs,
  projectTripleTermsAsEdges,
  type TripleTermAnnotation,
} from "@g3t/core";

const rows: TripleTermAnnotation[] = [
  /* from your SPARQL results */
];
const hyperarcUgm = projectTripleTermsAsHyperarcs(rows);
// _Statement nodes carry `_rdfStatement: true`; a `confidence`
// annotation folds onto the node as `_confidence`. Scope the opacity
// rule to `[_confidence]` so nodes without the field don't flood
// Cytoscape with per-frame warnings.
const stylesheet = [
  { selector: "node[?_rdfStatement]", style: { shape: "diamond" } },
  { selector: "node[_confidence]", style: { opacity: "data(_confidence)" } },
];

// Same rows, edge render: one dashed star edge per annotation.
const edgeUgm = projectTripleTermsAsEdges(rows);
```

Five smaller exports come with the pair, for hosts that write their own
labels or select the projected elements themselves:

```ts
import {
  tripleLabel,
  termLabel,
  localName,
  STAR_EDGE_TYPE,
  RDF_STATEMENT_FLAG,
  type TripleTerm,
} from "@g3t/core";

declare const term: TripleTerm;

// Display labels. `termLabel` renders one RDF term, `tripleLabel` the
// whole `s p o` as one string, and `localName` shortens an IRI to its
// last path or fragment segment. All three are what the two
// projections use internally, exported so a host relabeling nodes
// gets the same text the default render shows.
const label = tripleLabel(term); // "alice knows bob"
const short = localName("http://ex.org/ns#Person"); // "Person"
const one = termLabel(term.subject);

// The two markers the projections stamp, so a selector or a filter
// can name them instead of hardcoding the string.
const isStatementNode = (attrs: { properties: Record<string, unknown> }) =>
  attrs.properties[RDF_STATEMENT_FLAG] === true;
const starEdges = `edge[type = "${STAR_EDGE_TYPE}"]`;
```

`localName` overlaps what most RDF-shaped hosts already have. It ships
because the two projections need one shortening rule and a host
relabeling their output needs the SAME rule; reach for your own if you
have one.

The RDF 1.2 shell in `src/demo/rdf12/` toggles between the two live
over a small constellation fixture with a nested review, where the
statement-to-statement link is the shape the edge render cannot
express.

## Holon boundary views (holarchy → boundary → interior)

CI-executed in `examples/wiring/src/wiring-examples.test.tsx` ("holon
boundary" describe). The `HolonicAdapter` projects three drill levels
of the four-graph holon model: `projectToLPG()` (opaque holons,
portals as edges), `projectHolonBoundary(holon)` (what the holon
PUBLISHES: exposed nodes inside a boundary ring, portal edges crossing
out to stubbed neighbors), and `projectHolonInterior(holon)` (the
fully open flat LPG). Boundary exposure is additive data: list
interior node ids in `boundaryNodeIds` and optionally pin a portal to
its transit node via `boundaryNodeId`.

```ts
import { HolonicAdapter, type HolonicDataset } from "@g3t/core";

// Your holarchy, however you load it.
declare const dataset: HolonicDataset;

const adapter = new HolonicAdapter(dataset);
const boundary = adapter.projectHolonBoundary(dataset.holons[0]);
// Holon node carries _boundaryRing (double-ring styling in the
// canvas defaults); exposed nodes link from the holon via
// HolonicAdapter.BOUNDARY_CONTAINMENT_EDGE; hand that type to the
// canvas containment prop to render them inside the ring compound.
// Portal edges carry _portalTransit (mid-edge glyph; diamond when
// CONSTRUCT-backed).
```

Drill via the context menu with `registerHolonDrillItems(adapter,
menuManager, onOpen)` from `@g3t/react`: it adds "Open boundary" on
every holon node and "Open interior" where an interior exists; your
`onOpen(level, holon, ugm)` swaps the canvas UGM. The ontology
workbench shell's Holons tab shows all three levels live.

## Scaling: collapse large graphs to clusters

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`. When a
graph exceeds what the renderer handles comfortably (~5k nodes),
collapse it to community supernodes; the full graph stays in your UGM
and the canvas sees dozens of nodes. Drill in with `buildSubgraph`.
The playground's Scale surface runs this live over 8,000 nodes with
the measured timings on screen.

```ts
import { collapseByCluster, buildSubgraph } from "@g3t/core";

const {
  ugm: clustered,
  members,
  collapsed,
} = collapseByCluster(big, {
  threshold: 2000, // below this, returned unchanged
  maxSupernodes: 200, // smallest communities pool into one "other"
  rng: seededRng, // deterministic Louvain (optional)
  // clusterProperty: "team",  // or skip detection: group by a property
});

// Drill-in: the induced member subgraph, working-set capped.
const memberIds = members.get("cluster:c3") ?? [];
const { ugm: sub, truncated } = buildSubgraph(big, memberIds, 1500);
```

Supernodes carry `memberCount` (drive the size channel with it),
`interiorEdgeCount` (edges wholly inside the cluster, the "how many
paths in it" number an analyst asks for first), `boundaryEdgeCount`
(edges crossing the cluster boundary), `typeBreakdown`, and a
disambiguated name like "Person cluster around alice"; inter-cluster
edges aggregate into weighted `cluster-link` edges.

Compose the count badge into the canvas label with the pure helper
`clusterBadgeText(attrs)`, renderer-neutral so it survives brief
08's per-view renderer independence. The typical wiring precomputes
`_badge` onto each supernode and points the Cytoscape label at it:

```ts
import { clusterBadgeText, type UGM } from "@g3t/core";

// The collapsed graph from the previous snippet.
declare const clustered: UGM;

clustered.forEachNode((id, attrs) => {
  attrs.properties._badge = clusterBadgeText(attrs.properties);
});

// Then in the stylesheet you pass to CytoscapeCanvas:
const stylesheet = [
  {
    selector: "node",
    style: {
      label: "data(_badge)",
      "text-valign": "bottom",
      "text-margin-y": 6,
      "font-size": 10,
    },
  },
];
```

Never bake counts into `name`: the label is a NAME and doubling the
count wherever a consumer also shows `memberCount` (side panels,
rails) was a real regression. This is Approach 1 of
planning/large-graph-design.md; Approach 4 (worker layout with
viewport culling, for drilled sets past ~5k) is designed but not yet
implemented.

## Edge bundling (dense-scene legibility)

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`. The
"hairball" middle ground, hundreds to low-thousands of visible edges
that obscure structure, is what force-directed edge bundling (FDEB,
Holten & van Wijk 2009) is for. Pairs naturally with
`collapseByCluster`: bundle the aggregated cluster links, not the
raw 8,000-edge graph.

```ts
import { bundleEdges, bundledPolylineToSegments } from "@g3t/core";

// positions: whatever your layout settled on (cy.nodes() -> position,
// ELK output, cached preset positions: anything id -> {x,y}).
// Minimal shape of the Cytoscape elements this touches; `cy` is your
// Cytoscape core instance.
type CyNode = { id(): string; position(): { x: number; y: number } };
type CyEdge = { id(): string; source(): CyNode; target(): CyNode };

const positions: Record<string, { x: number; y: number }> = {};
cy.nodes().forEach((n: CyNode) => (positions[n.id()] = n.position()));

const edges = cy.edges().map((e: CyEdge) => ({
  id: e.id(),
  source: e.source().id(),
  target: e.target().id(),
}));

const { routes, skipped } = bundleEdges(positions, edges);
// skipped === true when input exceeds opts.maxEdges (default 2000):
// bundling is O(E^2) in compatibility, so it bypasses cleanly.
if (!skipped) {
  for (const [edgeId, poly] of routes) {
    const seg = bundledPolylineToSegments(poly);
    if (!seg) continue; // straight polyline, no interior bend
    cy.$id(edgeId).style({
      "curve-style": "segments",
      "segment-distances": seg.distances.join(" "),
      "segment-weights": seg.weights.join(" "),
    });
  }
}
```

Deterministic by construction (no RNG, fixed subdivision + iteration
schedule): same input yields byte-identical polylines. Endpoints are
never moved: `route[0]` and `route[last]` are the source and target
positions verbatim, so bundling never detaches an edge from its node.
Recompute on toggle or on a genuine layout change; a bundling pass
is a restyle plus per-edge bypass, so pan/zoom and node positions
hold (same-input-graph camera doctrine).

Options: `maxEdges` (default 2000), `cycles` (6), `iterations` (50,
halved per cycle), `stepSize` (0.4, halved per cycle), `stiffness`
(0.1), `compatibilityThreshold` (0.6). The defaults match Holten's
paper. Increase `compatibilityThreshold` to bundle only near-parallel
edges; lower it to bundle more aggressively at the cost of longer
routes.

## When a view fails to render

A render-phase throw unmounts every React ancestor, so without a
boundary somewhere above the canvas the user gets a blank page: no
message, no reload, nothing to act on. There is no hook form of an
error boundary, so the toolkit ships the component.

```tsx
import { ViewErrorBoundary, CytoscapeCanvas } from "@g3t/react";

export function Panel() {
  return (
    <ViewErrorBoundary
      // Your reporting. `info.componentStack` locates the throw in a
      // production build, where the message alone will not.
      onError={(error, info) => logError(error, info.componentStack)}
      fallback={({ error, retry }) => (
        <div>
          <p>The graph could not render: {error.message}</p>
          <button onClick={retry}>Try again</button>
        </div>
      )}
    >
      <CytoscapeCanvas ugm={ugm} />
    </ViewErrorBoundary>
  );
}
```

Omit `fallback` for a built-in message and retry button. `retry`
remounts the subtree, which is enough for a transient failure; it is
NOT enough for a `React.lazy` whose import rejected, because lazy
caches its rejection permanently. If you code-split a view, build a
new lazy from the loader when `retry` fires.

An ASYNC failure never reaches a boundary, so the hooks report it
themselves. `useStructuralLayout` returns an error channel alongside
the scene, because a rejected layout and a layout still in flight both
leave `structural` null and a host that only checks for null spins a
loading state forever:

```tsx
import type { StructuralGraphInput } from "@g3t/core";
import { useStructuralLayout } from "@g3t/react";

export function StructuralPanel({ input }: { input: StructuralGraphInput }) {
  const { structural, error } = useStructuralLayout(input);
  if (error) return <p>Layout failed: {error.message}</p>;
  if (!structural) return <p>Laying out…</p>;
  return <pre>{JSON.stringify(structural.geometry.nodes, null, 2)}</pre>;
}
```

The error belongs to the input that produced it: switching inputs
clears it, and a later successful layout of the same input clears it
too.

## Programmatic APIs

Every snippet here runs under CI in
`examples/wiring/src/wiring-examples.test.tsx` ("programmatic APIs"
describe). These are the imperative entry points an integrator calls
from their own handlers rather than mounting as components.

### Path analysis

```ts
import { findShortestPath, allShortestPaths } from "@g3t/core";
const path = findShortestPath(ugm, "a", "c");
// path.found, path.nodeIds (["a","b","c"]), path.edgeIds, path.length

// The UNION of every shortest route (a subgraph, not one
// representative), plus a route count capped at 50 so labels on
// dense graphs stay honest ("50+").
const all = allShortestPaths(ugm, "a", "c");
// all.nodeIds, all.edgeIds, all.pathCount
```

### Subgraph export

```ts
import { exportSubgraphJson, exportSubgraphCsv } from "@g3t/core";
const json = exportSubgraphJson(ugm); // whole graph
const csv = exportSubgraphCsv(ugm, selection); // or a selection
```

Turtle export (`exportSubgraphTurtle`) is demonstrated in
`examples/decision-dashboards`.

### Image export (PNG snapshot)

The toolbar's Export menu ships a PNG entry ("Image (PNG)"). The same
helper is exported for programmatic use, so a host can bind snapshot
export to a keyboard shortcut, a Save-to-case action, or a headless
capture path:

```ts
import { buildImageExport } from "@g3t/react";
// cy comes from CytoscapeCanvas onReady.
const { filename, mime, blob } = buildImageExport(cy, { scale: 2 });
const url = URL.createObjectURL(blob);
// download it, upload it, or hand it to your image pipeline
URL.revokeObjectURL(url);
```

Options: `full` (default `true`) exports the whole graph regardless
of the current viewport; `full: false` snapshots what the user sees.
`scale` (default `2`) multiplies pixel density. `bg` sets a solid
background colour (Cytoscape defaults to transparent).

SVG export is not bundled: it needs the `cytoscape-svg` extension
(new dependency plus a bundle-ledger entry). Add it in your host if
you need vector snapshots.

`buildExport` is the data-side counterpart, and the function the
toolbar's other Export entries call. Note the two differ where the
payloads differ: `buildExport` returns text as `content`, while
`buildImageExport` returns binary as a `blob`. It also takes the
selection explicitly, so the same call serves both the whole-graph and
the selection-scoped menu entries (a non-empty id list switches the
filename from `g3t-graph.*` to `g3t-selection.*`):

```ts
import { buildExport } from "@g3t/react";

declare const format: "json" | "turtle" | "csv";
declare const selectedNodeIds: string[];

// Whole graph.
const all = buildExport(format, ugm, []);
// Just the selection.
const some = buildExport(format, ugm, selectedNodeIds);

const blob = new Blob([some.content], { type: some.mime });
const url = URL.createObjectURL(blob);
// hand `url` to an <a download={some.filename}> or your upload path
URL.revokeObjectURL(url);
void all;
```

### Applying an encoding spec without the panel

```ts
import { applyEncodingSpec } from "@g3t/react";
const patch = applyEncodingSpec(spec, ugm);
// patch.nodes / patch.edges: Maps of materialized visual channels
// (_color, _size, _icon, _shape, label) keyed by element id.
```

### Themes, programmatically

```ts
import { createTheme } from "@g3t/react";
const theme = createTheme({ id: "acme", name: "Acme", accentPrimary: "#0af" });
// Derives from LIGHT_THEME and warns when a chosen color fails WCAG
// contrast against its background.
```

### Word-wrapping long node labels

Node labels word-wrap by DEFAULT (110px: long RDF entity names,
protein or disease terms would otherwise render single-line and
overlap neighbors). `labelWrapRule` is the single knob over that
default: a number re-widths the wrap, `false` disables it. Pass it
through the `stylesheet` prop, which is a style refresh by the
relayout contract, so toggling never re-runs layout or moves the
camera:

```tsx no-check
import { CytoscapeCanvas, labelWrapRule } from "@g3t/react";

const wrapSheet = useMemo(
  () => [labelWrapRule(wrap ? 90 : false)], // px (default 120) or false = off
  [wrap],
);
<CytoscapeCanvas ugm={ugm} stylesheet={wrapSheet} />;
```

The rule is scoped to `node[label]` (only nodes carrying a data-driven
label match), so it composes with encoding specs and never triggers
per-frame mapping warnings. The Biomedical shell's "Wrap labels"
switch is the live demonstration.

### Camera control

```ts
import { createCameraController } from "@g3t/react";
const camera = createCameraController(cy, { padding: 48 });
camera.focusNodes(selectedIds); // zoom-to-subgraph
camera.frameAll(); // fit everything
```

`cy` is the Cytoscape core the canvas hands you through `onReady`.
The same core feeds the `Minimap` component (an overview inset whose
viewport rectangle tracks and drives the camera): store the core from
`onReady` in state and render `<Minimap core={core} />`; while the
core is null it shows a disabled placeholder, so it mounts safely
before the canvas is ready.

## Where the rest lives

- API reference (generated from source): `pnpm run docs:api` →
  `docs-out/api` (every exported type, prop interface, and function).
- Component gallery: `pnpm run storybook`.
- Architecture and boundaries: `ARCHITECTURE.md`, `DEVELOPER.md`.
- Interchange contracts in depth:
  `roadmap/design/algorithm-overlays.md` (algorithm documents with
  networkx / GraphBLAS exports), `roadmap/design/encoding-controls.md`
  (the spec grammar).
