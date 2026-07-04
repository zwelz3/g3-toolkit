# Wiring Guide: Driving g3-toolkit from Your Application

Audience: adopters embedding the toolkit inside a larger decision-
support or process application, who need their OWN buttons, panels,
and workflows to control toolkit behavior, and toolkit state to flow
back out into their components.

Every snippet in this guide runs in CI: `examples/wiring/src/`
contains each one as an executable test, so this document cannot rot
silently.

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
const [spec, setSpec] = useState<EncodingSpec>(initialSpec);
// Your button:
<button onClick={() => setSpec(riskViewSpec)}>Risk view</button>
// Our components:
<EncodingSpecPanel ugm={ugm} spec={spec} onChange={setSpec} />
<CytoscapeCanvas ugm={ugm} encodingSpec={spec} />
<SpecLegend ugm={ugm} spec={spec} />
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

<FacetFilter ugm={ugm} onFilterChange={setHiddenTypes} />
<CytoscapeCanvas ugm={ugm} hidden={hidden} />
```

### Register an algorithm result from your backend

```tsx
import {
  parseAlgorithmResult,
  applyAlgorithmResult,
  ingestAlgorithmResults,
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

Collapse compartments by feeding their keys to the layout (collapse
is a layout-time input, so the container actually shrinks; re-run on
toggle). Build keys with `compartmentKey(nodeId, compartmentId)`:

```tsx
import { layoutStructural, compartmentKey } from "@g3t/core";

const collapsed = new Set([compartmentKey("sensor", "operations")]);
const geometry = await layoutStructural(input, {
  collapsedCompartments: collapsed,
});
// "operations" now shows only a divider noting the hidden count; the
// sensor container is shorter by the omitted rows. Toggle by adding
// or removing keys and re-running. Hold the set in your own state
// (or a store) and drive it from a button or a context-menu action.
```

For the per-container right-click toggle, register the built-in
action and let the toolkit's collapse store hold the state; subscribe
and re-run layout:

```tsx
import {
  ContextMenuManager,
  registerCompartmentCollapseActions,
  useCompartmentCollapseStore,
  collapsedCompartmentSet,
} from "@g3t/react";

const manager = new ContextMenuManager();
registerCompartmentCollapseActions(manager); // right-click a container

// Re-run layout whenever the collapse set changes:
useCompartmentCollapseStore.subscribe((s) => {
  void layoutStructural(input, {
    collapsedCompartments: collapsedCompartmentSet(s.collapsedKeys),
  }).then(setGeometry);
});
// The component-config surface is just seeding the store up front:
// useCompartmentCollapseStore.getState().setCollapsed([...]).
```

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

## Programmatic APIs

Every snippet here runs under CI in
`examples/wiring/src/wiring-examples.test.tsx` ("programmatic APIs"
describe). These are the imperative entry points an integrator calls
from their own handlers rather than mounting as components.

### Path analysis

```ts
import { findShortestPath } from "@g3t/core";
const path = findShortestPath(ugm, "a", "c");
// path.found, path.nodeIds (["a","b","c"]), path.edgeIds, path.length
```

### Subgraph export

```ts
import { exportSubgraphJson, exportSubgraphCsv } from "@g3t/core";
const json = exportSubgraphJson(ugm); // whole graph
const csv = exportSubgraphCsv(ugm, selection); // or a selection
```

Turtle export (`exportSubgraphTurtle`) is demonstrated in
`examples/decision-dashboards`.

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
