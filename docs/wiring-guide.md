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

The `ugm` you hand to the props channel is yours to build. Give each
edge a `key` when your data already has a stable edge identity: the
UGM then uses it as the edge id, so selection, overlays, and a
"selected edge" in your URL survive a rebuild from the same data
(without a key, every rebuild generates fresh ids). Keys are unique
across the whole graph, and a duplicate throws.

```ts
import { UGM } from "@g3-toolkit/core";
const ugm = new UGM();
ugm.addNode("pump-1", { types: ["Asset"], properties: { name: "Pump" } });
ugm.addNode("site-north", { types: ["Site"], properties: {} });
const edgeId = ugm.addEdge("pump-1", "site-north", {
  key: "pump-1|locatedAt|site-north", // your id, kept as-is
  type: "locatedAt",
});
// edgeId === "pump-1|locatedAt|site-north"; toJSON/fromJSON and
// exportSubgraphJson carry it unchanged.
```

A useful consequence: a "custom button" is almost always one line of
store or function call in an `onClick`.

## Composition levels (what to grab at which size)

- **Atoms**: `Icon`, the `g3t-btn` / `g3t-select` / `g3t-input` CSS
  classes, design tokens (`--g3t-*`). Use these to make YOUR controls
  look native next to ours. The complete token vocabulary is in
  [design-tokens.md](./design-tokens.md); check a name against that
  table before using it, because a `var()` on a name we do not emit
  falls back to your literal and silently ignores the theme forever.
- **Molecules**: `SearchBar`, `ZoomControls`, `SpecPort`,
  `ThemeSwitcher`, `SpecLegend`, `ContextMenu`. Single-purpose,
  callback-driven; compose them into your own bars and panels.
- **Compounds**: `CytoscapeCanvas`, `GraphToolbar`,
  `EncodingSpecPanel`, `AlgorithmPanel`, `LayoutManager`,
  `StatsPanel`, the view components. Opinionated assemblies wired to
  the stores; drop them in whole, or rebuild them from molecules
  using the same stores (GraphToolbar itself is the worked example:
  read its source).

**`GraphToolbar` already contains a `SearchBar`.** Its anatomy is
`[search (flex)] [layout select] [options popover] [Run]`. Placing
your own `SearchBar` beside the toolbar ships two search fields that
both drive the selection store, which is an easy and confusing
duplicate. Use one or the other.

**One name for the handle: `core`.** Every component that takes the
Cytoscape instance `onReady` hands you (`GraphToolbar`, `Minimap`)
takes it as `core`. `GraphToolbar` shipped it as `cy`; that name is
still accepted as a deprecated alias through 1.x and is removed in
the next major, so migrate to `core` when convenient. Resolution is
`core ?? cy`: when both are supplied, `core` wins. Development builds
warn once per component when only `cy` is given; production builds
are silent.

**`SearchBar` needs no callback.** `onSearchChange` is optional; the
bar drives the selection store on an explicit pick either way (this
is what `GraphToolbar`'s internal `SearchBar` relies on). Pass it only
when your host also wants the live match set on every keystroke.

## Patterns (which components pair, and why)

Single components are catalogued in
[capability-index.md](./capability-index.md). The leverage is in the
pairings, and each demo shell exercises a near-disjoint slice of
them, so reading the one shell closest to your domain teaches that
slice and quietly hides the rest. These six are the ones worth
knowing before you start.

**Selection is the universal join.** Every view component subscribes
to `useSelectionStore` itself. There is no selection prop to thread,
so adding four linked views is four JSX lines over one referentially
stable `ugm`. This is the single highest-leverage fact in the
library.

**Emphasis is not selection.** Selection is the user's current focus,
one store, one treatment. Overlays are computed membership sets
(algorithm results, SHACL tiers) with their own toggles. Reaching for
selection to express "these nodes matter" fights the user for the
cursor; register an overlay instead.

**Register overlays inactive.** `register(overlay, false)`. An
overlay active at mount de-emphasizes every non-member, and a
reviewer meeting a mostly-muted graph reads it as a rendering fault
rather than as a filter. Let activation be their act. Overlays carry
an optional `tone` (`neutral` / `info` / `warning` / `danger`) so
distinct tiers stay visually distinct once activated.

**The context menu is a command bus.** `@g3-toolkit/core/events` is a
context-action command bus, NOT a fourth integration channel. Add
your verbs as menu actions; do not build a general pub/sub on it.

**Scale is a two-graph pattern.** Large-graph work holds a detail
graph and a cluster graph, and swaps which one the canvas renders.
It is not a setting on one graph. See "Scaling: collapse large graphs
to clusters" below.

**Schema renders through a parallel pipeline.** A shape graph is not
your data graph with different colors; it projects through its own
compartment API. See "Render a SHACL shape graph" below.

## Custom buttons (the core recipes)

### Pin / unpin everything

```tsx
import { usePositionPinStore } from "@g3-toolkit/react";

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
import { useSelectionStore, CytoscapeCanvas } from "@g3-toolkit/react";

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
import { runGraphLayout, DEFAULT_LAYOUT_OPTIONS } from "@g3-toolkit/react";

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
import { useThemeStore } from "@g3-toolkit/react";
useThemeStore.getState().setTheme(orgSettings.darkMode ? "dark" : "light");
```

By default the store writes `color-scheme` and the `--g3t-*` tokens
inline on `<html>`, which also flips the host page's scrollbars and
form controls. If your app owns the page's light/dark/automatic
scheme, scope the writes to the element that wraps the graph views and
remove them when the last view unmounts:

```tsx
import { useEffect, useRef } from "react";
import { useThemeStore } from "@g3-toolkit/react";

function GraphArea() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const { setThemeTarget, clearTheme } = useThemeStore.getState();
    setThemeTarget(ref.current!);
    return () => clearTheme();
  }, []);
  return <div ref={ref} className="graph-area" />;
}
```

`setThemeTarget` moves the current theme to the element (restoring
anything the store had written to `<html>`), and later `setTheme`
calls, `ThemeSwitcher`, and workspace snapshots write there too.
`clearTheme` removes the inline properties the store set, restoring
any the host had on the element, and keeps the store's theme and
target. The target scopes the DOM chrome (panels, search, legend,
context menu) and `color-scheme`; the Cytoscape canvas and the Minimap
read the theme object from the store, not CSS variables, so they
follow the theme wherever the target is. `injectDesignTokens` (the
spatial and typographic constants from `@g3-toolkit/core`) is separate
and still writes to `<html>`; nothing in it changes with the theme
except the dark shadow set.

### Style the toolkit's text (the `g3t-view` root class)

Every view and panel root carries the class `g3t-view`, composed after
your own `className` and after the component's own class (`g3t-table`,
`g3t-minimap`), so selectors on those keep working. `style.css` sets
the toolkit face, size, line-height and ink on `.g3t-view` and nowhere
outside it: a view reads in the toolkit face whether or not the host
imports `style.base.css`, inline sizes inside a view still win, and
nothing on your page changes. Style the toolkit's text through it,
with one rule for every view or a scoped one for a region:

```css
.g3t-view {
  font-size: 14px;
}
.sidebar .g3t-view {
  font-size: 12px;
}
```

```tsx
import { TableView } from "@g3-toolkit/react";

<TableView ugm={ugm} className="host-table" />;
// renders <div class="g3t-table host-table g3t-view" ...>
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
} from "@g3-toolkit/react";

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

### Word the legend for your audience

By default `SpecLegend` (and `FloatingLegend`, which forwards these
props) heads each section with the encoding internals, `color: types`
and `edge color: relation`. For an end-user view, hand it the words
your readers use. `sectionTitle` receives the section channel and the
driver; `labelFor` receives the value and the same channel, so one
function can label node types and relation types differently. Edge
color rows come from the data (distinct driver values, colored by the
same resolver the canvas uses), so a categorical edge scale needs no
`overrides` to appear in the legend.

```tsx
import { FloatingLegend, type LegendChannel } from "@g3-toolkit/react";

const words: Record<LegendChannel, string> = {
  "node.color": "Node type",
  "node.size": "Importance",
  "node.shape": "Node type",
  "node.icon": "Node type",
  "edge.color": "Relation",
  "edge.width": "Strength",
};
const relationLabels: Record<string, string> = { worksAt: "works at" };

<FloatingLegend
  ugm={ugm}
  spec={spec}
  sectionTitle={(channel) => words[channel]}
  labelFor={(value, channel) =>
    channel === "edge.color" ? (relationLabels[value] ?? value) : value
  }
/>;
```

### Double-click a node to open detail

There is no `onNodeDoubleClick` prop. Double-click is a Cytoscape
gesture (`dbltap`, which also covers touch), so bind it on the core
`onReady` hands you. `NeighborhoodPopout` is the usual target, but
any detail surface works:

```tsx
import { useCallback } from "react";
import type { Core } from "cytoscape";
import type { UGM } from "@g3-toolkit/core";
import { CytoscapeCanvas, useSelectionStore } from "@g3-toolkit/react";

function GraphWithDetail({ ugm }: { ugm: UGM }) {
  const handleReady = useCallback((cy: Core) => {
    cy.on("dbltap", "node", (evt) => {
      const id = evt.target.id();
      useSelectionStore.getState().selectNodes([id]);
      openYourDetailPanel(id);
    });
    // Background double-click: a conventional "fit to screen".
    cy.on("dbltap", (evt) => {
      if (evt.target === cy) {
        cy.animate(
          { fit: { eles: cy.elements(), padding: 40 } },
          { duration: 200 },
        );
      }
    });
  }, []);
  return <CytoscapeCanvas ugm={ugm} onReady={handleReady} />;
}
```

Bind inside `onReady` rather than in an effect over a stored `cy`: the
canvas re-initializes on a genuinely different input graph, and
handlers bound to a destroyed core are silently lost.

> **`onReady` is load-bearing, and that is a known risk.** Gestures,
> position capture, `cy.fit`, and ad-hoc class application all reach
> through the raw Cytoscape `Core`. That handle is a renderer
> implementation detail, so a future move toward renderer
> independence would break every consumer doing this at once. It is
> stable for 1.x. If you can express something through a store, a
> prop, or a document instead, prefer that; treat `onReady` as the
> escape hatch it is, and keep your uses of it few and centralized.

### Filter by hiding, not by rebuilding

`FacetFilter` emits the set of hidden TYPES. Map that to node ids and pass
it to the canvas as `hidden`; the canvas hides them with a class
(`display:none`) in a batched restyle, so node positions and the
Cytoscape instance survive. Do NOT feed a pre-filtered UGM as `ugm`: a new
`ugm` reference re-creates the instance and re-runs layout on every
toggle (additive mode, next section, only ever grows a graph; a filter
removes, so it would rebuild there too).

```tsx
import { useMemo, useState } from "react";
import { CytoscapeCanvas, FacetFilter } from "@g3-toolkit/react";

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

### Grow a drawn graph without rebuilding it

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`. An
explorer that adds one neighborhood at a time hands the canvas a new
`ugm` on every step, and a new identity is a different graph: the
instance is re-created, positions and the camera reset. With
`graphUpdate="additive"` a new ugm whose node-id set is a SUPERSET of
the drawn one grows the live instance instead: the new nodes and edges
join in place, only the new nodes are laid out (one fcose pass with
every existing node held by `fixedNodeConstraint`, seeded next to the
neighbors they were expanded from), and the camera does not move. The
host still owns the growth; it just builds each step as a superset.

```tsx
import { useState } from "react";
import { UGM } from "@g3-toolkit/core";
import { CytoscapeCanvas } from "@g3-toolkit/react";

// Each step is a NEW ugm holding every node of the previous one plus
// the neighborhood. toJSON/fromJSON keeps the edge ids, and `key` names
// the ones you add, so the diff adds only what is new; generated ids
// differ per UGM instance and would replace every edge each step.
const [graph, setGraph] = useState<UGM>(ugm);
const expand = (nodeId: string) => {
  const next = UGM.fromJSON(graph.toJSON());
  for (const n of neighborhood(nodeId)) {
    if (!next.hasNode(n.id))
      next.addNode(n.id, { types: n.types, properties: n.properties });
    next.addEdge(nodeId, n.id, { type: n.relation, key: `${nodeId}->${n.id}` });
  }
  setGraph(next);
};

<>
  <button onClick={() => expand(selectedIds[0])}>Expand</button>
  <CytoscapeCanvas ugm={graph} graphUpdate="additive" />
</>;
```

A step that REMOVES a node (pruning, a different subject) takes the
normal rebuild path; so does a containment change that re-parents a
drawn node. Edges the new ugm no longer has are removed in place, and
drawn elements take the new ugm's data, so a data-only change is also
in place. `animate` and `animationDuration` apply to the growth pass.

### Register an algorithm result from your backend

```tsx
import {
  parseAlgorithmResult,
  applyAlgorithmResult,
  ingestAlgorithmResults,
  type UGM,
} from "@g3-toolkit/core";
import { useOverlayStore } from "@g3-toolkit/react";

async function showCommunities(ugm: UGM) {
  const json = await fetch("/api/algorithms/louvain").then((r) => r.text());
  const doc = parseAlgorithmResult(json); // versioned, validated
  const overlay = applyAlgorithmResult(ugm, doc, ingestAlgorithmResults);
  if (overlay) useOverlayStore.getState().register(overlay);
  // property-shaped results landed in the UGM: drive the spec from
  // them (color by community) and the legend follows.
}
```

### Step through overlays in order (tiers, phases, time slices)

Overlays are the natural unit for a staged narrative: SHACL severity
tiers, algorithm phases, time slices, provenance steps. The store has
no notion of order, so sequencing is a layer over it:
`useOverlaySequence` holds the index and the transport, and on every
step it sets active EXACTLY the ids it owns. Every other overlay (a
path overlay, a tier registered elsewhere) keeps its state before,
during and after, because the hook merges into `activeIds` rather
than replacing them. Registration stays yours, and happens before the
sequence takes the ids:

```tsx
import {
  reportFromValidationResults,
  severityOverlays,
} from "@g3-toolkit/core";
import {
  useOverlayStore,
  useOverlaySequence,
  OverlayTransport,
} from "@g3-toolkit/react";
import { useEffect, useState } from "react";

// Worst tier last, so the cumulative walk ends on the full picture.
const TIER_ORDER = ["shacl-info", "shacl-warning", "shacl-violation"];

function SeverityWalkthrough() {
  const [speedMs, setSpeedMs] = useState(1500);
  const [loop, setLoop] = useState(false);
  useEffect(() => {
    const report = reportFromValidationResults(validationResults);
    const tiers = severityOverlays(report);
    for (const overlay of tiers) {
      useOverlayStore.getState().register(overlay, false);
    }
    return () => {
      for (const overlay of tiers) {
        useOverlayStore.getState().unregister(overlay.id);
      }
    };
  }, []);
  // "cumulative": step N shows tiers 0..N; "single" shows only step N.
  const sequence = useOverlaySequence({
    ids: TIER_ORDER,
    mode: "cumulative",
    speedMs,
    loop,
  });
  // Speed and loop controls render only when wired; drop them (and
  // showReadout) to reduce the control to prev / play / next.
  return (
    <OverlayTransport
      sequence={sequence}
      speedMs={speedMs}
      onSpeedChange={setSpeedMs}
      loop={loop}
      onLoopChange={setLoop}
    />
  );
}
```

`sequence` carries `index`, `length`, `isPlaying`, `play`, `pause`,
`next`, `prev` and `goTo` for your own controls. Playback runs on
`setInterval`, cleared on pause and unmount; without `loop` the last
step holds for one interval and playback pauses. When the sequence
unmounts (or its `ids` change) it RESTORES the ids it owned to the
active state they had when it took them, so a tier the reviewer had
toggled on by hand comes back; it never touches the others. The
index-to-ids rule is the pure `computeSequenceActiveIds(ids, index,
mode)`, and `stepSequence(index, direction, length, loop)` is the
transport arithmetic, both exported for hosts that drive the store
from their own loop.

### Add your action to the canvas context menu

The base menu is functional with zero config, and follows a strict
contract: items are wired or absent, never rendered dead. With no
menuManager the canvas shows one item, a clipboard-wired copy whose
label follows the element id ("Copy IRI" for schemed ids, the RDF
case; "Copy ID" otherwise). "Inspect properties" appears only when
you wire it, because only the host app knows its detail surface:

```tsx
import { createDefaultMenuManager, useSelectionStore } from "@g3-toolkit/react";

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
import { ContextMenuManager } from "@g3-toolkit/react";

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
import { ContextMenuManager, registerToolkitActions } from "@g3-toolkit/react";
import { G3tEventBus } from "@g3-toolkit/core";

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
import { layoutStructural, isChainEdgeId } from "@g3-toolkit/core";

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
} from "@g3-toolkit/core";
import { CytoscapeCanvas } from "@g3-toolkit/react";

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
} from "@g3-toolkit/core";
import { useOverlayStore } from "@g3-toolkit/react";
// parseShaclReport is NOT on the root: it lives on the /shacl
// subpath. Adding it to the import above fails to resolve.
import { parseShaclReport } from "@g3-toolkit/core/shacl";

const report = reportFromValidationResults(validateShacl(ugm, shapes));
// (or parseShaclReport(externalPyshaclReport) for an external engine)

// Severity tiers as independently toggleable overlays. Register them
// INACTIVE: activating at mount dims every non-finding node, and a
// reviewer meeting a mostly-muted graph reads it as broken rather
// than as filtered. Let the toggle be the reviewer's act.
for (const overlay of severityOverlays(report)) {
  useOverlayStore.getState().register(overlay, false);
}
// Each tier carries a tone (violation -> danger, warning -> warning,
// info -> info), so an activated violation tier draws red and a
// warning tier amber rather than both drawing the same emphasis.
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
import { resultSelectionIds, resultDetail } from "@g3-toolkit/core";
import { useSelectionStore } from "@g3-toolkit/react";

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

### Drive the shape browser from a deep link or an aggregated report

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`.
`ShaclShapeBrowser` counts one result per focus node by default. A
host whose report is already summarized (pyshacl, Jena, a SPARQL
COUNT) hands the totals over through `summary`, which wins over
counting for the shapes it names, so passing focus nodes need no
placeholder results. `selectedShape` / `onSelectShape` make the
selection controlled; the selected shape renders expanded, so a shape
chosen from the URL opens on load. Leave both props off and the
browser keeps its own expanded state as before. A shape declares every
target it has through `targets`; `targetClass` stays the class the
validator matches:

```tsx
import { useState } from "react";
import { ShaclShapeBrowser, type ShaclShape } from "@g3-toolkit/react";

const shapes: ShaclShape[] = [
  {
    id: "ex:QuoteShape",
    targetClass: "ex:Quote",
    targets: [
      { kind: "class", value: "ex:Quote" },
      { kind: "subjectsOf", value: "ex:quoteVerified" },
    ],
    properties: [
      // Two property shapes on one path: give each its own id.
      { id: "ex:QuoteShape-verified", path: "ex:quoteVerified", minCount: 1 },
      {
        id: "ex:QuoteShape-verified-bool",
        path: "ex:quoteVerified",
        datatype: "boolean",
      },
    ],
  },
];

// From the URL: /shapes?selected=ex:QuoteShape
const [selected, setSelected] = useState<string | null>("ex:QuoteShape");

<ShaclShapeBrowser
  shapes={shapes}
  validationResults={validationResults}
  // Per-shape totals from the report; bySeverity sets the badge tier.
  summary={{
    "ex:QuoteShape": { focus: 120, failing: 3, bySeverity: { warning: 3 } },
  }}
  selectedShape={selected}
  onSelectShape={setSelected} // null when the selected shape collapses
/>;
// The badge exposes its tier for host CSS or tests:
//   [data-testid="shape-badge-ex:QuoteShape"][data-severity="warning"]
```

### Class hierarchy: SchemaView nesting and TreeView forests

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`. Neither
`SchemaModel` nor the UGM registry carries subclass edges, so the host
passes rdfs:subClassOf as `class -> parent(s)`; a parent that is not a
listed class leaves its child at the top level. Every shape targeting
a class counts toward its badge (constraints, shapes), and with
results the badge also reports the most severe status (violation >
warning > info, or conforms):

```tsx
import { SchemaView, TreeView } from "@g3-toolkit/react";

<SchemaView
  schema={{
    nodeTypes: ["Agent", "Person"],
    edgeTypes: [],
    nodeProperties: { Person: ["name", "email"] },
    edgeProperties: {},
  }}
  subClassOf={{ Person: "Agent" }}
  shapes={shapes}
  validationResults={validationResults}
/>;

// TreeView: several roots render as a forest (no synthetic parent row),
// initialDepth only SEEDS expansion (every row toggles afterwards), the
// [type] prefix is optional, and the rows form a WAI-ARIA tree: one tab
// stop, ArrowUp/Down move, ArrowRight opens or enters, ArrowLeft closes
// or climbs, Home/End jump, Enter or Space selects.
<TreeView
  ugm={ugm}
  rootIds={["owl:Thing", "prov:Entity"]}
  initialDepth={1}
  showType={false}
/>;
```

### Ontology rails: TreeView filter, group rows, rich labels, controlled selection

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`. Issue
#59 added what a host needs to replace its own keyboard tree with
`TreeView` for a class, property or vocabulary rail:

- `filter` (a string, case-insensitive on the label, or a predicate
  over the row) keeps the matches plus their ancestors and HOLDS those
  ancestors open while it is active: their chevron is inert and
  ArrowLeft climbs instead of closing. Clearing it restores the
  expansion the user had. No match renders a filter-specific empty
  state (`tree-view-filter-empty`).
- `renderLabel(node, ctx)` replaces the label text; `ctx` carries
  `depth`, `expanded`, `selected`, `group` and `childCount` (children
  in the hierarchy, filter or not, so a count badge holds still while
  the host types). The `[type]` prefix and chevron stay around it.
- `isGroup(node)` marks expand-only rows ("Object properties" over its
  members): click, Enter and Space toggle instead of selecting, the
  row carries no `aria-selected`, and `data-group="true"` is there for
  host CSS. It is a predicate rather than a reserved node property
  because the UGM data model belongs to the adapter and a host's group
  rows are usually synthetic nodes it injected itself.
- `selected` (a string or null) makes the selection CONTROLLED: the
  tree highlights that id, writes nothing to `useSelectionStore`, and
  ignores what the store holds, so a URL-driven rail no longer collides
  with the canvas or table on the same page. `onSelect` is then the
  only channel. Omit `selected` and the tree reads and writes the store
  as before (the default path); do not switch between the two after
  mount.
- A selection that arrives from OUTSIDE the tree (the store, or
  `selected`, including the one present at mount) opens the branch
  holding it and calls `scrollIntoView({ block: "nearest" })` on the
  row. A pick made in the tree does neither.
- `initialExpanded` seeds ids open in addition to `initialDepth` (same
  seed semantics: toggles survive a reseed), and `ariaLabel` names the
  tree (default "Hierarchy").
- A node under several parents (a class with two superclasses, a DAG)
  renders under EACH parent, with its subtree. Row identity is the
  path (`data-path`; expansion and focus are per copy), selection is
  the node id (selecting one copy highlights every copy, and the
  `tree-node-<id>` testid repeats), a declared root is still never
  repeated as a descendant, and a cycle is cut where a node is already
  on the current path. The working-set limit counts rows, so a repeated
  node counts each time.

```tsx
import { useState } from "react";
import {
  TreeView,
  type TreeRowNode,
  type TreeLabelContext,
} from "@g3-toolkit/react";

function ClassRail() {
  // URL-driven: the route owns the selection, not the shared store.
  const [selectedClass, setSelectedClass] = useState<string | null>(
    "ex:Requirement",
  );
  const [query, setQuery] = useState("");
  return (
    <>
      <input
        aria-label="Filter classes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <TreeView
        ugm={ugm}
        rootIds={["owl:Thing"]}
        ariaLabel="Classes"
        showType={false}
        initialDepth={1}
        initialExpanded={["ex:Artifact"]}
        filter={query}
        isGroup={(node: TreeRowNode) => node.type === "Group"}
        renderLabel={(node: TreeRowNode, ctx: TreeLabelContext) => (
          <span style={{ fontStyle: ctx.group ? "italic" : undefined }}>
            {node.label}
            {ctx.childCount > 0 && (
              <span title={`${ctx.childCount} subclasses`}>
                {" "}
                ({ctx.childCount})
              </span>
            )}
          </span>
        )}
        selected={selectedClass}
        onSelect={(id) => {
          setSelectedClass(id);
          navigate(`/classes/${encodeURIComponent(id)}`);
        }}
      />
    </>
  );
}
```

### Render a provenance trace

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`. The
ProvenanceTrace panel renders a pre-order hop chain (any lineage your
app derives; the auditor shell walks PROV-O edges) with tiers, edge
details, and ABSENCE hops for evidence that should exist and does not:

```tsx
import { ProvenanceTrace, type ProvenanceChain } from "@g3-toolkit/react";

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

### Announce graph state to a screen reader

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`;
demonstrated in the Provenance Auditor shell. A graph canvas is
opaque to assistive technology, so `AriaCompanion` renders the same
graph as a hidden, focusable, degree-ordered node list (focus selects,
arrow right follows an edge) and one polite live region. The host owns
the wording that only it knows: pass it as `announcement` (here through
`useAnnouncer`), let the component debounce rapid changes, mute it
while an animation plays, mirror the canvas `hidden` set so the list
and the canvas agree, and name the list for your domain:

```tsx
import { useEffect } from "react";
import {
  AriaCompanion,
  useAnnouncer,
  useSelectionStore,
} from "@g3-toolkit/react";

// Your chain, however you derive it (the auditor walks PROV-O edges).
const chain: string[] = ["ent:release", "act:approve", "ent:review"];
// The same set you pass to CytoscapeCanvas `hidden`.
const hidden = new Set<string>();

function Narrated({ playing }: { playing: boolean }) {
  const selectedId = useSelectionStore(
    (s) => [...s.selectedNodeIds][0] ?? null,
  );
  const { announcement, announce } = useAnnouncer();
  useEffect(() => {
    if (selectedId === null) return;
    const name = String(ugm.getNode(selectedId)?.properties.name);
    const step = chain.indexOf(selectedId) + 1;
    announce(
      step > 0
        ? `Lineage step ${step} of ${chain.length}: ${name}`
        : `Selected ${name}`,
    );
  }, [selectedId, announce]);
  return (
    <AriaCompanion
      ugm={ugm}
      hidden={hidden}
      label="Provenance nodes"
      instructions="Focusing a node selects it on the canvas; arrow right follows an edge."
      summarizeNode={(g, id) =>
        `${String(g.getNode(id)?.properties.name)}, ${g.getNodeEdges(id).length} provenance edges`
      }
      announcement={announcement}
      announceDebounceMs={300}
      muted={playing}
    />
  );
}
```

The region only speaks on a DOM change, so an unchanged re-render and
a repeated identical message are silent by construction. Give the
canvas region itself an accessible name (`aria-label` on the element
that wraps the canvas) and a one-line `aria-describedby` saying the
canvas is decorative and how to reach the list. `useAnnounce` (the
older export) is deprecated: it never reached a region.

## Table view recipes

All of these run under CI in `examples/wiring/src/wiring-examples.test.tsx`
("table view recipes" describe).

### Table without a UGM

`TableView` is a UGM adapter by default (one row per node, columns
from the property registry), but tabular data that is not a graph
(SPARQL SELECT bindings, a named-graph register, a validation-result
list) does not need converting first. Pass `rows` and `columns`; a
column names a `value` reader, optionally a `render`, and an inline
filter kind (`"text"` for a substring match, `"values"` for a
checklist over the distinct values with counts, `"range"` for a
numeric min/max, `"none"`). Leave `filter` out and the kind is
inferred from the column's values: `"range"` when every present value
is a number, `"values"` when the distinct values number at most 20
and at most half the rows, `"text"` otherwise; an explicit kind
always wins. `renderCell` is a table-wide override on either path
(return `undefined` to fall back to the column). `selection` decides
where a row click goes: `"store"` (default, the shared selection
store, right for a view linked to a canvas), `"none"` for a standalone
register, or `{ selected, onSelect }` to keep it in your own state;
the host receives the full next set, modifier rules already applied.

```tsx
import { useState } from "react";
import { TableView, type DataGridColumn } from "@g3-toolkit/react";

interface Binding {
  s: string;
  label: string;
  count: number;
}

const columns: DataGridColumn<Binding>[] = [
  { id: "s", header: "Subject", value: (r) => r.s },
  {
    id: "label",
    header: "Label",
    value: (r) => r.label,
    render: (v, r) => <a href={r.s}>{String(v)}</a>,
  },
  { id: "count", header: "Count", value: (r) => r.count, filter: "range" },
];

function Register({ rows }: { rows: Binding[] }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  return (
    <TableView
      rows={rows}
      columns={columns}
      rowId={(r) => r.s}
      selection={{ selected, onSelect: (ids) => setSelected(new Set(ids)) }}
    />
  );
}
```

### Export, search, reorder, multi-value filters

Four toolbar affordances, each off by default so the chrome you have
does not change. `exportCsv` adds an "Export CSV" button that writes
the FILTERED rows in the current sort, the visible columns in their
current order, as RFC 4180 text from cell values (not rendered
nodes); pass `{ filename, download }` to name the file or to replace
the browser download with your own sink. `search` adds one box above
the per-column filters, over the VISIBLE columns only (hidden columns
and `filter: "none"` columns are skipped, and hiding a column drops
its matches at once), stacked on the per-column filters, with the
"N of M rows" count following it. The query is split on whitespace
and every word must appear, as a case-insensitive substring,
somewhere in the row, not necessarily in the same cell (`alice acme`
finds the row whose name is Alice and whose org is Acme); wrap a
phrase in double quotes to match it as one substring.
The column menu's move buttons reorder columns; hand the table a
`columnOrder` (TanStack's shape: listed ids first, the rest after in
definition order) and `onColumnOrderChange` to persist it, or omit
`columnOrder` and only listen. A `"values"` column is a checklist
with All/None shortcuts; several ticks are a union within the column,
and the counts follow the other filters and the search.

```tsx
import { useState } from "react";
import { TableView, type DataGridColumn } from "@g3-toolkit/react";

interface Binding {
  s: string;
  label: string;
  kind: string;
}

const columns: DataGridColumn<Binding>[] = [
  { id: "s", header: "Subject", value: (r) => r.s },
  { id: "label", header: "Label", value: (r) => r.label },
  { id: "kind", header: "Kind", value: (r) => r.kind, filter: "values" },
];

function Register({ rows }: { rows: Binding[] }) {
  // Persist the order wherever your settings live (here: local state).
  const [order, setOrder] = useState<string[]>(["kind", "label", "s"]);
  return (
    <TableView
      rows={rows}
      columns={columns}
      rowId={(r) => r.s}
      selection="none"
      search
      exportCsv={{ filename: "bindings.csv" }}
      columnOrder={order}
      onColumnOrderChange={setOrder}
    />
  );
}
```

`getCsv` is the pure half of the export, exported for a host that
owns its own TanStack table or wires its own button: give it the rows
of a row model (`table.getSortedRowModel().rows` is the filtered set
in the current sort) and the columns to write (`table
.getVisibleLeafColumns()` applies visibility and order), and it
returns the text. It is headless, so it runs in a test; the browser
download is the only part that needs a DOM.

```ts
import { getCsv } from "@g3-toolkit/react";

// hostTable: your own useReactTable(...) instance.
const csv = getCsv(
  hostTable.getSortedRowModel().rows,
  hostTable.getVisibleLeafColumns(),
);
```

### Sorting, hidden columns, CSV values, empty state, toolbar slot

What a host replacing its own TanStack table needs beyond the recipes
above. `sorting` and `onSortingChange` control the sort (TanStack's
shape, `{ id, desc }[]`, first rule outermost) the way `columnOrder`
does, so it can live in the URL; `initialSorting` seeds an
uncontrolled table instead. A column with `hidden: true` starts
toggled off but stays in the column menu. A column's `csv` reader
replaces the cell value in the export (a cell that renders a local
name exports the full IRI); `getCsv` takes the same hook as its third
argument, `{ value: (row, column) => ... }`. `emptyMessage` is what
the body shows when nothing matches (a `role="status"` row; the
default names the path's noun). `toolbar` renders your own controls
beside the Export CSV button. `pageSizeOptions` adds a rows-per-page
select to the pagination bar, which also carries first/last buttons
now; pass `onPageSizeChange` and set `pageSize` yourself, or leave it
out and the pick is held internally. Per column, `align: "num"`
right-aligns on tabular figures, `width` sizes the header, and
`title` is the header tooltip. Two things happen without a prop:
repeated `rowId`s are suffixed `#2`, `#3` in data order so every row
stays addressable, and when the column SET changes (one SPARQL result
replacing another with different variables) filters and the internal
sort on columns that left are dropped, so they do not resurface when
the variable comes back; a controlled sort is reported back pruned
through `onSortingChange`.

```tsx
import { useState } from "react";
import {
  TableView,
  type DataGridColumn,
  type TableSort,
} from "@g3-toolkit/react";

interface Binding {
  iri: string;
  label: string;
  statements: number;
  graph: string;
}

const columns: DataGridColumn<Binding>[] = [
  {
    id: "label",
    header: "Label",
    title: "The rdfs:label, or the IRI's local name",
    value: (r) => r.label,
    csv: (r) => r.iri, // the export carries the full IRI
    width: 240,
  },
  {
    id: "statements",
    header: "N",
    title: "Statements about the subject",
    value: (r) => r.statements,
    align: "num", // right-aligned, tabular figures; filter inferred as range
  },
  { id: "graph", header: "Graph", value: (r) => r.graph, hidden: true },
];

function Register({ rows }: { rows: Binding[] }) {
  // The sort lives wherever your URL state does (here: local state).
  const [sorting, setSorting] = useState<TableSort[]>([
    { id: "statements", desc: true },
  ]);
  const [pageSize, setPageSize] = useState(25);
  return (
    <TableView
      rows={rows}
      columns={columns}
      rowId={(r) => r.iri}
      selection="none"
      sorting={sorting}
      onSortingChange={setSorting}
      pageSize={pageSize}
      pageSizeOptions={[25, 100, 500]}
      onPageSizeChange={setPageSize}
      emptyMessage="No subjects match. Clear a filter to widen the set."
      exportCsv={{ filename: "subjects.csv" }}
      toolbar={
        <button type="button" onClick={() => exportJson(rows)}>
          Export JSON
        </button>
      }
    />
  );
}
```

### Fill a sized host (dock panel)

By default the table sizes to its CONTENT, which is wrong for a panel
that has a definite height: rows run off the bottom and take the
Prev/Next controls with them. `fill` makes the root a flex column at
100% of the host, the body scrolls under a sticky header, and the
pagination bar stays pinned (the rules live in
`@g3-toolkit/react/style.css`; the regions carry stable classes,
`g3t-table-toolbar`, `g3t-table-scroll`, `g3t-table-pagination`, for
your own overrides). `pageSize` is live, so a count you compute from
the host applies on the next render without a remount; or pass
`rowHeight` with `autoPageSize` and the table measures its scroll
region itself and re-fits on resize.

```tsx
import { TableView } from "@g3-toolkit/react";

<div style={{ height: 480 }}>
  <TableView ugm={ugm} fill rowHeight={28} autoPageSize density="compact" />
</div>;
```

### Virtualize a long page

Pagination bounds the DOM by default, which is the wrong lever when
the analyst wants to scroll one long list (a SPARQL result of a few
thousand bindings) rather than page through it. `virtualize` renders
only the rows in and around the scroll window of the `fill` body,
with spacer rows holding the table's height so the scrollbar is
honest and the header stays sticky; it is `@tanstack/react-virtual`
underneath, a regular dependency of `@g3-toolkit/react`, nothing to
install. It engages per page once the page holds more than
`threshold` rows (default 150), so a small table's DOM is exactly the
unvirtualized one; `overscan` (default 10) is the rows rendered
beyond the window on each side. Give it a large `pageSize` (the
working-set limit is 10,000) and a scrolling body: `fill`, or your own
height and overflow on `.g3t-table-scroll`. `rowHeight` is the size
estimate when given; without it rows are measured as they mount.
`autoPageSize` is ignored while `virtualize` is set, because it sizes
the page to the viewport and that is the one thing virtualization
makes unnecessary. Selection, `renderCell`, the per-column filters
and their value counts, search and the CSV export all read the row
model, not the DOM, so they see every row on the page; a row holding
keyboard focus (a link or button in a cell) stays mounted while you
scroll.

```tsx
import { TableView, type DataGridColumn } from "@g3-toolkit/react";

interface Binding {
  s: string;
  label: string;
}

const columns: DataGridColumn<Binding>[] = [
  { id: "s", header: "Subject", value: (r) => r.s },
  { id: "label", header: "Label", value: (r) => r.label },
];

function LongRegister({ rows }: { rows: Binding[] }) {
  return (
    <div style={{ height: 480 }}>
      <TableView
        rows={rows}
        columns={columns}
        rowId={(r) => r.s}
        fill
        rowHeight={24}
        pageSize={10_000}
        virtualize={{ overscan: 20 }}
        exportCsv
      />
    </div>
  );
}
```

## Working-set limits: page past them

`WorkingSetManager` owns every per-view limit (canvas 500, table
10,000, tree 1,000, matrix 200, sankey 100, streaming 500), and since
issue #6 its answer says what to DO about an excess, not only whether
there is one. `checkLimit` returns `strategy` ("allow" within the
limit; otherwise the view type's row of `DEFAULT_LIMIT_STRATEGIES`:
canvas, tree and streaming "refuse", table and matrix "page", sankey
"truncate") and `pageSize` (the limit), with `allowed` kept for the
callers that only ask the old question. Pass a third argument to
override the row for one call. Both run under CI in
`examples/wiring/src/wiring-examples.test.tsx` ("working-set limits"
describe).

```ts
import {
  WorkingSetManager,
  pageNodes,
  pageCount,
  type PageWindow,
} from "@g3-toolkit/core";

const limits = new WorkingSetManager();
const check = limits.checkLimit("matrix", 350);
// { allowed: false, limit: 200, requested: 350, strategy: "page", pageSize: 200 }

if (check.strategy === "page") {
  const page = pageNodes(ugm, { offset: 0, size: check.pageSize });
  const window: PageWindow = page.window;
  // { offset: 0, size: 200, total: 350, totalExact: true }
  const pages = pageCount(window); // 2
  const next = pageNodes(ugm, { offset: window.size, size: window.size });
  void pages;
  void next;
}
```

A page is only meaningful over an ordered result, so `pageNodes` and
`pageCategories` sort by id (a code-unit comparison, the same in every
locale) before cutting; the same request returns the same page on
every call, and a comparator in `order` replaces the sort with id as
the tie-break. The descriptor is offset-based: the in-memory UGM has
no cursor layer, and `totalExact: false` is reserved for a backend
that answers with an estimate (the control below then says "about").

### Page a matrix

`MatrixView` pages itself: past `maxSize` types (default 200, the
R7.3 number) it renders a `maxSize` x `maxSize` window with one
`PaginationControl` per axis, rows and columns independent, so a
350x350 request opens at 200x200 and every cell is two clicks away at
most. Feed it the limit from your manager so a deployment override
reaches the view. The same control pages anything of yours; it holds
no state, so a zero-based `page`, the `pageSize` and the `total` are
all it needs, and ArrowLeft/ArrowRight/Home/End work from anywhere
inside it.

```tsx
import { useState } from "react";
import { WorkingSetManager, pageNodes } from "@g3-toolkit/core";
import { MatrixView, PaginationControl } from "@g3-toolkit/react";

const limits = new WorkingSetManager();

function TypeMatrix() {
  return <MatrixView ugm={ugm} maxSize={limits.getLimit("matrix")} />;
}

function NodeRegister() {
  const [page, setPage] = useState(0);
  const size = 50;
  const { items, window } = pageNodes(ugm, { offset: page * size, size });
  return (
    <>
      <ul>
        {items.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
      <PaginationControl
        page={page}
        pageSize={size}
        total={window.total}
        totalExact={window.totalExact}
        noun="nodes"
        onPageChange={setPage}
      />
    </>
  );
}
```

Not in this slice: `TableView` keeps its own TanStack bar (adopting
the shared control there is the follow-up), and canvas and tree still
refuse past their limits, because paging a layout is a different
problem from paging a list.

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
import { useSelectionStore } from "@g3-toolkit/react";

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
} from "@g3-toolkit/react";
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
import { createPresetPipeline } from "@g3-toolkit/core";
const ugm = createPresetPipeline("standard").project(rdfGraph);
// rdf:type -> node.types; literals -> node.properties; blank-node and
// list structures resolved. Presets: "standard", "ontology",
// "provenance-preserving".
```

Compose your own step set when the presets don't fit:

```ts
import { ProjectionPipeline, typeCollapse } from "@g3-toolkit/core";
const p = new ProjectionPipeline();
p.addStep({ name: "Type Collapse", transform: typeCollapse, enabled: true });
const ugm = p.project(rdfGraph);
p.getSteps(); // inspectable, so a UI can show or toggle steps
```

Edge ids are a function of the triple, not of the projection run.
Every resource-object triple becomes one edge whose id is
`tripleEdgeKey(subject, predicate, object)`, the same key the SPARQL
adapter uses, so projecting the same input twice gives the same ids,
a triple listed twice (a SELECT that binds it in two rows) is one
edge rather than two parallel ones (first occurrence wins), and a host
can address an edge by its triple without reading the graph. The key
begins with `<`, which no IRI, CURIE or blank-node label can, so it
never collides with a node id in the one id space Cytoscape gives
nodes and edges. The optional fourth argument is a named graph: the
pipeline and the adapter merge graphs and never pass one, so it is for
a host that keys its own quads and keeps graphs distinct.

```ts
import { tripleEdgeKey } from "@g3-toolkit/core";
const edgeId = tripleEdgeKey(
  "http://example.org/p53",
  "http://example.org/regulates",
  "http://example.org/mdm2",
);
ugm.getEdge(edgeId); // the projected edge, by its triple
```

The biomedical playground shell renders this live: its canvas toggle
shows the raw triple view beside the projected one, and its caption
lists the preset's step names straight from `getSteps()`.

## Scaling: collapse large graphs to clusters

CI-executed in `examples/wiring/src/wiring-examples.test.tsx`. When a
graph exceeds what the renderer handles comfortably (~5k nodes),
collapse it to community supernodes; the full graph stays in your UGM
and the canvas sees dozens of nodes. Drill in with `buildSubgraph`.
The playground's Scale surface runs this live over 8,000 nodes with
the measured timings on screen.

```ts
import { collapseByCluster, buildSubgraph } from "@g3-toolkit/core";

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
`typeBreakdown`, and a label like "Person cluster (847)"; inter-cluster
edges aggregate into weighted `cluster-link` edges. This is Approach 1
of planning/large-graph-design.md; Approach 4 (worker layout with
viewport culling, for drilled sets past ~5k) is designed but not yet
implemented. To grow a drilled-in set one neighborhood at a time
without re-laying out what is already drawn, pass each step as a
superset ugm with `graphUpdate="additive"` ("Grow a drawn graph
without rebuilding it", above).

## Dense graphs: let labels yield to each other

CI-executed in `examples/wiring/src/wiring-examples.test.tsx` (the pure
rule; the prop is covered by the canvas tests). Cytoscape draws every
label at its element and never moves one out of another's way, so a
dense graph (a citation network in layered rows, say) overprints labels
until the user zooms in. `labelCollision` is an overlay pass over the
rendered label boxes: after layout settles, after a zoom ends, after a
node is dropped, and on every selection or hover change, the canvas
measures each visible label, walks them by priority, and hides (or in
`"shorten"` mode first truncates) a label whose box overlaps one already
placed. Priority is selected (an edge counts when either endpoint is) >
hovered (`hoveredNodeId` in the selection store, incident edges
included) > your rank > node before edge > node degree or edge `weight`.
Restyle only: no re-init, no refit, no node moves, and the `label` field
itself is never written (hide is a class, shorten is a `_labelShort`
field read by a scoped rule), so the encoding spec's label channel and
this pass cannot fight.

```tsx
import { CytoscapeCanvas } from "@g3-toolkit/react";

<CytoscapeCanvas
  ugm={ugm}
  labelCollision="shorten" // or "hide"; "none" is the default
  labelMaxLength={14} // characters, ellipsis included
  // Your rank within a tier. Omit it to read the `_labelPriority`
  // element data field instead (0 when absent).
  labelPriority={(ele) =>
    typeof ele.data("citations") === "number" ? ele.data("citations") : 0
  }
/>;
```

Hosts with their own renderer get the same decision rule without the
canvas: measure your label boxes in any one coordinate space, compose
the priority the canvas uses, and apply the decisions yourself.

```ts
import {
  resolveLabelCollisions,
  composeLabelPriority,
  type LabelCandidate,
} from "@g3-toolkit/react";

const labels: LabelCandidate[] = [
  {
    id: "p1",
    kind: "node" as const,
    text: "Deep residual learning",
    box: { x: 0, y: 0, w: 140, h: 12 },
    priority: 0,
  },
  {
    id: "p2",
    kind: "node" as const,
    text: "Attention is all you need",
    box: { x: 120, y: 4, w: 160, h: 12 },
    priority: 0,
  },
].map((l) => ({
  ...l,
  priority: composeLabelPriority({
    kind: l.kind,
    selected: selectedIds.has(l.id),
    explicit: 0,
  }),
}));

const { decisions, shortened } = resolveLabelCollisions(labels, {
  mode: "shorten",
  maxLength: 14,
});
// decisions: Map<id, "show" | "hide" | "shorten">; shortened holds the
// truncated text for every "shorten". Deterministic: equal priorities
// break node before edge, then by id.
```

## When a view fails to render

A render-phase throw unmounts every React ancestor, so without a
boundary somewhere above the canvas the user gets a blank page: no
message, no reload, nothing to act on. There is no hook form of an
error boundary, so the toolkit ships the component.

```tsx
import { ViewErrorBoundary, CytoscapeCanvas } from "@g3-toolkit/react";

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
import type { StructuralGraphInput } from "@g3-toolkit/core";
import { useStructuralLayout } from "@g3-toolkit/react";

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

## Set deployment working-set limits

Working-set limits (canvas 500, table 10,000, tree 1,000, matrix 200,
sankey 100, streaming 500 by default) are a property of the hardware a
deployment runs on, so they are configuration, not code. A platform
administrator writes one versioned document per deployment; the host
resolves it once at setup into a manager and mounts a provider around
the views. Every view that enforces a limit (TreeView, MatrixView, and
`expandNeighbors` through the manager you hand it) reads it from the
nearest provider; an explicit `workingSetManager` prop wins over the
provider, and with neither the module default keeps today's behavior.

```tsx
import { WorkingSetManager, parseWorkingSetConfig } from "@g3-toolkit/core";
import { WorkingSetProvider, TreeView, MatrixView } from "@g3-toolkit/react";

// Resolve ONCE at host setup, outside render: the manager's identity
// is what carries any user override.
const manager = WorkingSetManager.fromConfig(
  parseWorkingSetConfig(deploymentConfigText),
);

function Workbench() {
  return (
    <WorkingSetProvider manager={manager}>
      <TreeView ugm={ugm} />
      <MatrixView ugm={ugm} />
    </WorkingSetProvider>
  );
}
```

The document (every view and every field optional):

```json
{
  "version": 1,
  "limits": {
    "canvas": { "default": 300, "ceiling": 800 },
    "tree": { "ceiling": 2000 },
    "matrix": { "default": 150 }
  }
}
```

Two numbers per view, from spec decision D5: `default` is the soft
limit an analyst may raise with an explicit acknowledgment; `ceiling`
is the hard limit no user action can exceed. Precedence, lowest to
highest: built-in defaults, then the deployment document (whose
ceiling also bounds everything beneath it), then a per-user override.
`parseWorkingSetConfig` throws the same typed `DocumentParseError`
subclasses as the other versioned documents (unknown view names and a
`default` above its own `ceiling` are rejected rather than ignored),
so a broken document fails at setup instead of configuring nothing.

The "explicit user action to exceed" rule goes through the manager,
which answers with a typed result rather than a throw:

```tsx
import {
  useWorkingSetManager,
  workingSetLimitMessage,
} from "@g3-toolkit/react";

function ShowAllNotice({ requested }: { requested: number }) {
  const manager = useWorkingSetManager();
  const notice = workingSetLimitMessage(manager, "canvas", requested);
  if (notice.kind === "within") return null;
  if (notice.kind === "refused") return <p role="status">{notice.message}</p>;
  // "prompt": the request is above the soft default but under the ceiling.
  return (
    <p role="status">
      {notice.message}{" "}
      <button onClick={() => manager.setUserOverride("canvas", requested)}>
        Show all
      </button>
    </p>
  );
}
```

`canRaise(view, n)` is the pure form of the same check; `getCeiling`
reports the administrator bound (undefined when unbounded); and
`setUserOverride` refuses above the ceiling with
`{ ok: false, reason: "above-ceiling" }` and leaves the limit in force.

## Programmatic APIs

Every snippet here runs under CI in
`examples/wiring/src/wiring-examples.test.tsx` ("programmatic APIs"
describe). These are the imperative entry points an integrator calls
from their own handlers rather than mounting as components.

### Path analysis

```ts
import {
  findShortestPath,
  allShortestPaths,
  kShortestPaths,
  type PathGraph,
} from "@g3-toolkit/core";
const path = findShortestPath(ugm, "a", "c");
// path.found, path.nodeIds (["a","b","c"]), path.edgeIds, path.length

// The UNION of every shortest route (a subgraph, not one
// representative), plus a route count capped at 50 so labels on
// dense graphs stay honest ("50+").
const all = allShortestPaths(ugm, "a", "c");
// all.nodeIds, all.edgeIds, all.pathCount

// Options, shared by every search: maxHops bounds the search (a
// farther target is found: false, and the search stops at the
// bound instead of walking the whole graph); directed follows edges
// source to target only; nodeFilter decides which nodes may sit
// BETWEEN the endpoints (the endpoints themselves are exempt, so a
// search between two hubs still finds them); edgeTypes filters edges.
const bounded = findShortestPath(ugm, "a", "c", {
  maxHops: 4,
  directed: true,
  nodeFilter: (id) => !id.startsWith("hub:"),
});

// The individual routes, shortest first (Yen's algorithm on unit-weight
// hops; deterministic for a given graph), for a "path 3 of 12" listing.
// Fewer than k exist: the array is shorter. Disconnected: empty.
const routes = kShortestPaths(ugm, "a", "c", { k: 5, maxHops: 4 });
// routes[i].nodeIds, routes[i].edgeIds

// Every search reads only four methods, so a host with its own index
// can pass a PathGraph instead of building a UGM for a read-only
// search. UGM is a PathGraph by construction.
const view: PathGraph = {
  hasNode: (id) => ugm.hasNode(id),
  getNodeEdges: (id) => ugm.getNodeEdges(id),
  getEdgeEndpoints: (id) => ugm.getEdgeEndpoints(id),
  getEdge: (id) => ugm.getEdge(id),
};
findShortestPath(view, "a", "c");
```

Endpoints follow one rule in all three searches: a node the graph does
not report via `hasNode` is never found, not even as its own zero-hop
path, so a `PathGraph` that indexes only nodes with edges answers the
same way from every search. Source equals target on an existing node
is the one zero-hop path (`nodeIds: [id]`, `edgeIds: []`, `length: 0`;
`pathCount: 1` from `allShortestPaths`; a one-element array from
`kShortestPaths`).

`kShortestPaths` costs up to k × L bounded searches on the full graph
(L is the hop count of the longest listed route), so on a large index
it is the expensive one of the three. When the listing only needs the
routes that TIE for shortest, run it over the edge union
`allShortestPaths` returns, bounded at the shortest length: the union
holds every shortest route and nothing else, and `maxHops` at that
length keeps a walk from doubling back through the union to a longer
one. Each spur search then reads the union instead of the whole graph.

```ts
import {
  allShortestPaths,
  kShortestPaths,
  type PathGraph,
} from "@g3-toolkit/core";
const union = allShortestPaths(ugm, "a", "c");
if (union.found) {
  const nodes = new Set(union.nodeIds);
  const edges = new Set(union.edgeIds);
  const unionView: PathGraph = {
    hasNode: (id) => nodes.has(id),
    getNodeEdges: (id) => ugm.getNodeEdges(id).filter((e) => edges.has(e)),
    getEdgeEndpoints: (id) => ugm.getEdgeEndpoints(id),
    getEdge: (id) => ugm.getEdge(id),
  };
  // Only the routes of length union.length, up to the count cap.
  const shortestRoutes = kShortestPaths(unionView, "a", "c", {
    k: union.pathCount,
    maxHops: union.length,
  });
  // shortestRoutes[i].nodeIds, shortestRoutes[i].edgeIds
}
```

### Subgraph export

```ts
import { exportSubgraphJson, exportSubgraphCsv } from "@g3-toolkit/core";
const json = exportSubgraphJson(ugm); // whole graph
const csv = exportSubgraphCsv(ugm, selection); // or a selection
```

Turtle export (`exportSubgraphTurtle`) is demonstrated in
`examples/decision-dashboards`.

### Derived properties carry their provenance

`DerivedPropertyEngine` writes a computed value as a plain node
property, so every reader keeps working, and stamps it in a SIDECAR
registry on the UGM (never on the node's attributes) with the
definition that produced it, the definition's version, the write time
and the expression. The stamp survives `toJSON`/`fromJSON` (snapshot
version 2; an older snapshot without the field still loads) and the
JSON subgraph export (each node gains `derivations` keyed by property;
CSV is unchanged). `TableView` marks a derived cell with
`data-derived="<definitionId>"` and the `g3t-table-cell-derived`
class, and both inspectors show "derived by <definitionId>" next to
the value. A plain write to the property through
`ugm.updateNodeProperties` clears the stamp, since the value is no
longer derived.

```ts
import { DerivedPropertyEngine, exportSubgraphJson } from "@g3-toolkit/core";

const engine = new DerivedPropertyEngine();
engine.define({ name: "riskScore", expression: "risk * 100", reactive: false });
engine.compute(ugm);

// Where did this value come from?
const stamp = ugm.getDerivation("pump-1", "riskScore");
// stamp?.definitionId === "riskScore", stamp?.version === 1,
// stamp?.expression === "risk * 100", stamp?.computedAt is ISO-8601.
// A source property has no stamp: ugm.getDerivation("pump-1", "risk")
// is undefined. ugm.listDerivations() lists every stamp (or one node's).

// Change the rule: the version bumps and the old values become STALE
// (stamp version older than the definition's current version).
engine.define({
  name: "riskScore",
  expression: "risk * 1000",
  reactive: false,
});
const stale = engine.listStale(ugm); // [{ nodeId, property, stamp }, ...]
engine.recompute(ugm, "riskScore"); // stale is now []

// The JSON export carries it; a consumer can tell computed from measured.
const doc = JSON.parse(exportSubgraphJson(ugm)) as {
  nodes: Array<{ derivations?: Record<string, { definitionId: string }> }>;
};
// doc.nodes[i].derivations?.riskScore?.definitionId === "riskScore"
```

### Applying an encoding spec without the panel

```ts
import { applyEncodingSpec } from "@g3-toolkit/react";
const patch = applyEncodingSpec(spec, ugm);
// patch.nodes / patch.edges: Maps of materialized visual channels
// (_color, _size, _icon, _shape, label) keyed by element id.
```

### Themes, programmatically

```ts
import { createTheme } from "@g3-toolkit/react";
const theme = createTheme({ id: "acme", name: "Acme", accentPrimary: "#0af" });
// Derives from LIGHT_THEME and warns when a chosen color fails WCAG
// contrast against its background.
```

To follow your app's own CSS variables, derive the theme from them and
apply it. `themeFromCssVariables` reads each named variable through
`getComputedStyle` on the element you pass (so `:root` declarations
and `var()` chains resolve) and fills the fields you do not map from
the base preset. The result is a snapshot: re-derive when your app
switches its theme.

```ts
import { themeFromCssVariables, applyTheme } from "@g3-toolkit/react";

const theme = themeFromCssVariables(
  document.body,
  {
    bgPrimary: "--app-surface",
    bgSecondary: "--app-surface-raised",
    textPrimary: "--app-text",
    accentPrimary: "--app-accent",
    border: "--app-border",
  },
  {
    id: "app",
    name: "App",
    colorScheme: orgSettings.darkMode ? "dark" : "light",
  },
);
// Store-free: write it to one element and get a dispose back, for a
// host that applies on mount and removes on unmount without the store.
const dispose = applyTheme(theme, { target: document.body });
dispose(); // every property applyTheme set is removed or restored
// Store-backed instead (ThemeSwitcher, workspace snapshots keep working):
// useThemeStore.getState().setCustomTheme(theme)
```

### Camera control

```ts
import { createCameraController } from "@g3-toolkit/react";
const camera = createCameraController(cy, { padding: 48 });
camera.focusNodes(selectedIds); // zoom-to-subgraph
camera.frameAll(); // fit everything
```

`cy` is the Cytoscape core the canvas hands you through `onReady`.
The same core feeds the `Minimap` and `GraphToolbar` components, both
under the `core` prop: store the core from `onReady` in state and
render `<Minimap core={core} />` (an overview inset whose viewport
rectangle tracks and drives the camera) and
`<GraphToolbar ugm={ugm} core={core} />`; while the core is null the
minimap shows a disabled placeholder and the toolbar's controls
no-op, so both mount safely before the canvas is ready.

## Where the rest lives

- API reference (generated from source): `pnpm run docs:api` →
  `docs-out/api` (every exported type, prop interface, and function).
- Component gallery: `pnpm run storybook`.
- Architecture and boundaries: `ARCHITECTURE.md`, `DEVELOPER.md`.
- Interchange contracts in depth:
  `roadmap/design/algorithm-overlays.md` (algorithm documents with
  networkx / GraphBLAS exports), `roadmap/design/encoding-controls.md`
  (the spec grammar).
