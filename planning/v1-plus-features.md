# v1.0 Feature Plan (F1-F8)

Date: 2026-05-25
Status: Implemented

## Planned Features

### F1: Animated Layout Transitions

**Priority:** High
**Complexity:** Low (~30 lines delta)

When switching layouts (force → hierarchy → dagre), nodes
animate smoothly from old positions to new positions instead
of snapping. Cytoscape supports `cy.layout({ animate: true,
animationDuration: 500 })` natively; this is a configuration
exposure, not a new capability.

**Implementation:**
- Add `animate?: boolean` and `animationDuration?: number`
  props to CytoscapeCanvas
- LayoutSwitcher passes these through on layout change
- Default: `animate: true, animationDuration: 400`

**Integration points:** CytoscapeCanvas, LayoutSwitcher.

### F2: Adaptive/Incremental Layouts

**Priority:** High
**Complexity:** Medium (~250 lines)

When a node is added, removed, or expanded, existing nodes
move only as much as necessary to accommodate the change.
Currently g3t recomputes the full layout on every UGM change,
which causes the entire graph to rearrange.

**Implementation:**
- On UGM change, diff the previous and current element sets
- If only additions: run layout on new nodes only, with
  existing nodes locked (`node.lock()`)
- If only removals: animate remaining nodes to fill gaps
  (short-duration force simulation with locked distant nodes)
- If structural change (different types, new edges between
  existing nodes): full relayout with animation

**Design decision:** This requires tracking "which nodes
existed before the change," which means the layout engine needs
a reference to the previous positions. Store as a `Map<string,
{x, y}>` in the CytoscapeCanvas component state.

**Integration points:** CytoscapeCanvas (diff logic),
all 4 layout engines (lock support).

### F3: Node Group Collapsing (Combos)

**Priority:** High
**Complexity:** Medium (~300 lines)

User-driven manual grouping: select 3+ nodes, right-click
"Group as combo." The nodes collapse into a single combo node.
Click to expand (shows members inside a boundary box). Combos
can nest (combo inside combo).

This differs from CollapseByCluster (F1 in large-graph-design)
which is algorithmic. Combos are user-driven; the user decides
what to group based on analytical judgment.

**Implementation:**
- D6: `ComboManager` tracks group membership as a Map<comboId,
  Set<nodeId>>. Serializable for workspace persistence.
- D13: Context menu action "Group selected" creates a combo.
  "Ungroup" dissolves it. "Expand/Collapse" toggles visibility.
- Cytoscape supports compound nodes natively (`parent` field
  on node data). Combos map to Cytoscape parent nodes.
- Visual: combo boundary rendered as a rounded rectangle
  with a label showing the combo name and member count.

**Open question:** Should combos persist across sessions?
The ComboManager state could be included in saveWorkspace/
loadWorkspace. For cross-session persistence without a backend,
use the same pattern as F4 (browser cache + callback).

**Integration points:** ContextMenuManager, CytoscapeCanvas
(compound node support), WorkspaceShell (persistence).

### F4: Annotations Framework

**Priority:** Medium
**Complexity:** Medium (~150 lines)

Users can attach text notes to nodes or edges. Annotations
are visible on hover (tooltip) or in the inspector sidebar.

**Storage model:** Browser cache (IndexedDB or localStorage)
keyed by `{graphId}:{elementId}`. Callback support for
adopters who want server-side persistence:

```typescript
interface AnnotationStore {
  get(elementId: string): Promise<Annotation | null>;
  set(elementId: string, annotation: Annotation): Promise<void>;
  delete(elementId: string): Promise<void>;
  list(): Promise<Annotation[]>;
}

// Default: browser-local IndexedDB store
const defaultStore = createLocalAnnotationStore("g3t-annotations");

// Adopter provides their own backend store
const customStore: AnnotationStore = {
  get: (id) => fetch(`/api/annotations/${id}`).then(r => r.json()),
  set: (id, a) => fetch(`/api/annotations/${id}`, { method: "PUT", body: JSON.stringify(a) }),
  // ...
};

<AnnotationPanel store={customStore} ugm={ugm} selectedId={selectedId} />
```

**Integration points:** DetailInspector (show annotations),
HoverTooltip (show annotation preview), ContextMenu ("Add note").

### F5: Node/Edge Property Edit

**Priority:** Medium
**Complexity:** Medium (~200 lines)

Inline editing of node and edge properties in the inspector.
Click a property value to edit it. Changes are written to the
UGM in memory.

**Storage model:** Same browser-cache-with-callback pattern
as annotations. The UGM is the in-memory source of truth;
the callback notifies the adopter's backend of changes:

```typescript
interface PropertyEditCallback {
  onPropertyChange(
    elementType: "node" | "edge",
    elementId: string,
    key: string,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<boolean>; // return false to reject the edit
}
```

If no callback is provided, edits are local only (lost on
page refresh). With a callback, the adopter can persist to
their database and return false to reject invalid edits.

**Implementation:**
- D6: `UGM.updateNodeProperties(id, { key: value })` already
  exists.
- D13: DetailInspector renders property values as editable
  inputs (text, number, boolean toggle, date picker based on
  inferred type). Debounced save (300ms).
- UndoRedoStack integration: property edits are undoable.

**Integration points:** DetailInspector, UndoRedoStack,
event bus (emit `property:changed` event).

### F6: Enhanced Map View + Temporal Controls

**Priority:** Medium
**Complexity:** Medium-High (~400 lines)

Three improvements to the current MapView:

**F6a: Edges on map.** Currently MapView shows nodes as
markers on a Leaflet map, but edges are not drawn. Add edge
rendering as lines (great-circle arcs or straight) between
geo-positioned nodes. Nodes without lat/lon are excluded.

**F6b: Map tile provider selection.** Support multiple tile
providers (OpenStreetMap, Stamen, Mapbox). Adopter passes a
tile URL template.

**F6c: Temporal projection for the graph model.** A
TemporalProjection transform for the ProjectionPipeline that
filters the UGM by a time range. Combined with a temporal
slider control, this creates the "pattern-of-life" view: the
user scrubs a time range and the graph/map updates to show
only entities active during that period.

```typescript
// Temporal projection (D6)
function temporalProjection(
  ugm: UGM,
  timeProperty: string,
  range: { start: Date; end: Date },
): UGM { ... }

// Temporal slider (D13)
<TemporalSlider
  ugm={ugm}
  timeProperty="timestamp"
  onRangeChange={(start, end) => setTimeRange({ start, end })}
/>
```

The temporal slider already partially exists as
TemporalRangeFilter. This ticket extends it with:
- Play/pause animation (step through time windows)
- Speed control (1x, 2x, 5x, 10x)
- Window size control (1 hour, 1 day, 1 week)

**Out-of-scope (documented):** Full Mapbox GL integration,
3D globe rendering, satellite imagery, custom map styles.
Adopters needing these should use Leaflet or Mapbox GL
directly and coordinate with g3t via the UGM and event bus.

**FOSS integration notes:** For advanced geospatial, adopters
can use:
- Leaflet (already g3t's map dependency)
- deck.gl (WebGL map layers; import alongside g3t)
- Turf.js (geospatial analysis; compute distances, buffers)
- Maplibre GL (Mapbox GL fork; FOSS tile rendering)

g3t should document these integration patterns in
ARCHITECTURE.md rather than bundling them.

### F7: Link Label Styling

**Priority:** Low
**Complexity:** Low (~50 lines)

Edge labels can have background colors, borders, border radius,
and padding. Critical for readability when edges overlap.

**Implementation:** Cytoscape supports edge label styling
via the stylesheet:

```typescript
{
  "text-background-color": "#fff",
  "text-background-opacity": 1,
  "text-background-padding": "4px",
  "text-border-color": "#ccc",
  "text-border-width": 1,
  "text-border-opacity": 1,
}
```

Expose these as optional props on the encoding configuration
or as part of the theme tokens (`--g3t-edge-label-bg`,
`--g3t-edge-label-border`).

**Integration points:** Theme tokens, EncodingPanel (optional
edge label section), deriveCytoscapeStyle.

### F8: Orthogonal Edge Routing (Nice-to-Have)

**Priority:** Low
**Complexity:** Medium (~300 lines)

Edges route in right-angle segments (horizontal + vertical
only). Important for engineering diagrams (SysML, circuit,
network topology).

**Feasibility with Cytoscape:** Cytoscape does not natively
support orthogonal routing. Options:
- Use `taxi` edge style (Cytoscape's right-angle edge), which
  supports horizontal-first or vertical-first routing
- Use `segments` edge style with computed waypoints
- Pre-compute orthogonal routes and pass as segment control
  points

The `taxi` style is the closest match and requires no external
library. It routes edges in L-shaped or Z-shaped paths. The
tradeoff: taxi routing doesn't handle edge crossings or
optimize for minimal crossings.

**Not worth replacing Cytoscape for.** yFiles and Tom Sawyer
have sophisticated orthogonal routers that minimize crossings,
but they're proprietary and would replace the entire rendering
layer. The `taxi` style covers 80% of the use case.

**Implementation:**
- Add `edgeStyle: "bezier" | "straight" | "taxi"` to the
  encoding configuration
- Map to Cytoscape `curve-style` property
- Expose `taxi-direction` and `taxi-turn` as optional params

## Known Gaps (Not Planned)

The following enterprise features are documented as known gaps.
g3t does not plan to implement them; they are either backend
concerns, require proprietary technology, or are outside the
toolkit's scope as a composable component library.

### Visual query builder (no-code)

Linkurious 4.2 offers a drag-and-drop query builder for
non-technical users. This is an application-level feature,
not a component. Implementing it well requires deep knowledge
of the target database's schema, query language, and
optimization characteristics. Adopters building query tools
should use g3t's SchemaView to display the schema and
QueryEditor for the query input, with their own query builder
logic on top.

### Schema discovery from remote databases

Tom Sawyer's Designer automatically extracts schema from a
connected database. This is adapter-specific (Neo4j schema
discovery differs from SPARQL DESCRIBE differs from Gremlin
schema). Each adapter would need a `discoverSchema()` method.
Potentially valuable but requires per-backend implementation.
Document as an adapter extension point.

### Custom HTML/SVG node rendering

KeyLines and yFiles support fully custom per-node rendering
(sparklines, progress bars, embedded HTML). Cytoscape supports
custom node rendering via `CanvasRenderer.registerNodeShapeExtension`
but it's limited compared to full HTML-in-node. g3t's SVG icon
system (20 icons) provides basic shape customization.

### Custom node shapes with ports/connectors

Tom Sawyer and yFiles support nodes with multiple connection
points (ports) on specific edges. Critical for SysML block
diagrams and circuit design. Cytoscape has no port concept;
edges connect to the nearest point on the node boundary.
Implementing ports would require either replacing Cytoscape
or building a custom edge routing layer on top of it.

### Entity resolution

Linkurious integrates Senzing for automatic entity dedup.
Entity resolution is a backend/ML concern, not a visualization
concern. g3t should visualize the results of entity resolution
(e.g., show merged entities with a "merged from" indicator),
not perform the resolution itself.

### Streaming data adapter (Kafka/WebSocket)

Tom Sawyer Data Streams subscribes to Kafka topics. g3t's
event bus could receive streaming updates, but implementing
a production Kafka client in the browser is impractical.
The pattern: a server-side service consumes Kafka and pushes
graph deltas to the browser via WebSocket. g3t would consume
these deltas via a StreamAdapter (M9, future).

### Pattern-of-life analysis

KeyLines combines temporal and geospatial views for behavior
analysis. F6c (temporal projection + slider) provides the
temporal component. Full pattern-of-life (trajectory rendering,
dwell-time heatmaps, behavioral clustering) is a specialized
analytical application, not a toolkit component.

### RBAC enforcement

Linkurious and Tom Sawyer enforce role-based access at the
visualization layer. g3t delegates authorization to the backend.
The middleware pattern (bearerAuth, apiKeyHeader) handles
authentication; the backend is responsible for returning only
the data the user is authorized to see.

### SOC 2 / Audit logging

Linkurious is SOC 2 Type II compliant with full audit trails.
g3t's event bus emits interaction events that could feed an
audit log, but the audit storage, retention, and compliance
reporting is an application concern. Document the event bus
events that an adopter could subscribe to for audit purposes.

### Investigation templates

Linkurious provides pre-built investigation workflows. These
are domain-specific application logic (fraud investigation,
supply chain analysis). g3t provides the components; the
adopter composes them into workflows. The demo scenarios
serve as example templates.

### Saved investigations and collaboration

Multi-user investigation sharing requires server-side state,
user accounts, and real-time sync. g3t's saveWorkspace /
loadWorkspace handles single-user local persistence. Multi-user
collaboration is an application architecture concern.
