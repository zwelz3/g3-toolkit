# Design Decision: Large Graph Visualization

Date: 2026-05-24
Status: Approved (post-v1.0)

## Context

Cytoscape.js (g3t's renderer) handles ~5,000 nodes before
interaction becomes sluggish and ~10,000 before it becomes
unusable. This is a Canvas 2D limitation combined with per-node
event handling overhead.

Real-world graph datasets often exceed these limits: a
department's org chart (5K), a vulnerability dependency graph
(20K), a citation network (50K), a social graph (1M+). g3t needs
a strategy for these scales that preserves its architectural
properties.

## Decision

Adopt two complementary approaches in sequence. Reject three
alternatives that would compromise the toolkit's composability.

### Adopted: Approach 1 (Smart Aggregation via CollapseByCluster)

**What it does:** When a UGM exceeds a threshold (default 2,000
nodes), the ProjectionPipeline applies a CollapseByCluster
transform. Louvain community detection groups nodes into clusters.
Each cluster becomes a single supernode in the rendered graph,
labeled with its type distribution and size (e.g., "Person
cluster (847)").

The user drills into a cluster by clicking or right-clicking it
("Expand cluster"). This replaces the supernode with its contents,
capped by WorkingSetManager. Drilling out collapses the cluster
back to a supernode.

**Why this approach:** It works entirely within the existing
architecture. The renderer (Cytoscape) sees a small graph (200
supernodes). The UGM holds the full graph. The ViewFilter and
ProjectionPipeline already support this pattern. No new renderer,
no new interaction model, no new component API.

**What it costs:** ~200 lines of D6 code (CollapseByCluster
transform + drill-in/drill-out logic). The user sees a lossy
summary at the top level; an outlier node hiding inside a large
cluster is invisible until the cluster is expanded.

**Maximum effective scale:** ~50,000 nodes in the UGM (rendered
as ~200 supernodes). Beyond this, community detection itself
becomes slow on the client; it should run server-side.

**Implementation sketch:**

```typescript
// D6: new projection transform
function collapseByCluster(
  ugm: UGM,
  options?: {
    threshold?: number;      // default 2000
    maxSupernodes?: number;  // default 200
    clusterProperty?: string; // default: auto-detect via Louvain
  }
): UGM {
  if (ugm.nodeCount <= (options?.threshold ?? 2000)) return ugm;

  // Run Louvain community detection (or read pre-computed property)
  const communities = detectCommunities(ugm);

  // Build collapsed UGM
  const collapsed = new UGM();
  for (const [communityId, memberIds] of communities) {
    const types = countTypes(ugm, memberIds);
    collapsed.addNode(`cluster:${communityId}`, {
      types: ["Cluster"],
      properties: {
        memberCount: memberIds.length,
        typeBreakdown: types,
        label: formatClusterLabel(types, memberIds.length),
        _memberIds: memberIds, // stored for drill-in
      },
    });
  }
  // Add inter-cluster edges (aggregated)
  addInterClusterEdges(ugm, collapsed, communities);
  return collapsed;
}

// D13: drill-in action (context menu)
function drillIntoCluster(
  fullUGM: UGM,
  clusterId: string,
  workingSetLimit: number,
): UGM {
  const memberIds = fullUGM.getNode(clusterId)?.properties._memberIds;
  // Return a sub-UGM with only the cluster members
  return buildSubgraph(fullUGM, memberIds, workingSetLimit);
}
```

**Integration points:**
- `ProjectionPipeline.addTransform(collapseByCluster)`
- Context menu: "Expand Cluster" / "Collapse to Cluster"
- CanvasLegend: show cluster size indicators
- StatusBar: show "5 of 47,000 nodes visible (clustered)"

### Adopted: Approach 4 (Worker Layout + Viewport Culling)

**What it does:** Compute layout coordinates for the full graph
(up to 50K nodes) in a Web Worker. Only add nodes within the
current Cytoscape viewport (plus a buffer zone) to the renderer.
As the user pans or zooms, add entering nodes and remove exiting
ones using preset layout (frozen positions, no relayout).

**Why this approach:** It extends Cytoscape's practical limit from
~5K to ~20K visible nodes without changing the renderer. The key
insight is that layout (the expensive part) happens once in a
Worker, and rendering (the per-frame part) only handles visible
nodes. ElkJS already supports Worker mode.

**What it costs:** ~400 lines (Worker wrapper, R-tree spatial
index, viewport change listener, element add/remove throttling).
The user may see nodes "popping" in at viewport edges during fast
panning, mitigated by a buffer zone (render 120% of viewport).

**Prerequisites:** Approach 1 should be implemented first. Smart
aggregation handles the common case (reduce 50K to 200 supernodes);
Worker culling handles the drill-in case (show 20K members of an
expanded cluster without overwhelming the renderer).

**Implementation sketch:**

```typescript
// D6: layout computation in Worker
// layout-worker.ts (runs in Web Worker)
import { forceSimulation, forceManyBody, forceLink } from "d3-force";

self.onmessage = ({ data: { nodes, edges } }) => {
  const simulation = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-30))
    .force("link", forceLink(edges).id(d => d.id))
    .stop();

  // Run 300 ticks synchronously
  for (let i = 0; i < 300; i++) simulation.tick();

  // Return positions
  const positions = new Map();
  for (const node of nodes) {
    positions.set(node.id, { x: node.x, y: node.y });
  }
  self.postMessage({ positions });
};

// D6: spatial index for viewport queries
class SpatialIndex {
  private tree: RBush; // or quadtree

  insert(id: string, x: number, y: number): void { ... }
  queryViewport(bounds: BBox): string[] { ... }
}

// D13: viewport-aware canvas wrapper
function ViewportCulledCanvas({ ugm, positions }: Props) {
  const [visibleIds, setVisibleIds] = useState<Set<string>>();
  const spatialIndex = useMemo(
    () => buildSpatialIndex(positions),
    [positions]
  );

  const handleViewportChange = useCallback(
    (bounds: BBox) => {
      const buffered = expandBounds(bounds, 1.2); // 20% buffer
      setVisibleIds(new Set(spatialIndex.queryViewport(buffered)));
    },
    [spatialIndex]
  );

  const culledUGM = useMemo(
    () => filterUGM(ugm, visibleIds),
    [ugm, visibleIds]
  );

  return (
    <CytoscapeCanvas
      ugm={culledUGM}
      layout="preset" // use pre-computed positions
      onViewportChange={handleViewportChange}
    />
  );
}
```

**Integration points:**
- `CytoscapeCanvas` needs an `onViewportChange` callback (new prop)
- Layout engines need a `computeAsync` variant returning a Promise
- The `layout="preset"` mode must accept a positions Map
- StatusBar: show "viewing 3,200 of 47,000 nodes"

## Rejected Alternatives

### Rejected: WebGL Renderer (Sigma.js)

Sigma.js handles 100K+ nodes at 60fps via WebGL point/line
rendering. However, adding a second renderer would:

1. **Double the interaction surface.** Selection, context menus,
   theming, encoding, labels, edge styles, compound nodes; every
   feature needs two implementations.
2. **Break composability.** Adopters would need to choose a
   renderer, and their choice would constrain which features are
   available (compound nodes are Cytoscape-only; GPU coloring is
   Sigma-only).
3. **Fragment the test matrix.** Every test needs a Cytoscape
   variant and a Sigma variant. Visual regression baselines double.
4. **Add bundle weight.** Sigma.js adds ~200KB; adopters who don't
   need 100K-node support still pay the cost.

The abstraction layer required to normalize Cytoscape and Sigma
events, styles, and capabilities would inevitably leak. Features
natural in one renderer have no equivalent in the other.

**When to reconsider:** If a direct competitor offers a drop-in
React graph component handling 100K+ nodes with comparable
interaction quality, revisit. Until then, the aggregation +
culling approach covers 95% of real workloads.

### Rejected: Server-Side Tile Rendering

For 1M+ node graphs, render layout and tiles on the server
(Graphistry-style) and serve zoomable image tiles. This converts
g3t from a component library into a visualization platform with
a backend service dependency. It breaks the "npm install and use"
model and introduces operational overhead (server provisioning,
GPU requirements, tile caching).

**When to reconsider:** If g3t is adopted by a team with dedicated
infrastructure and 1M+ node analytical requirements. At that
point, this would be a separate `@g3t/server` package, not a
change to the core toolkit.

### Rejected: Virtual Canvas (OffscreenCanvas)

Use OffscreenCanvas in a Web Worker to render the graph, then
transfer the bitmap to the main thread. This moves rendering work
off the main thread but doesn't reduce the number of elements
rendered. Cytoscape doesn't support OffscreenCanvas, and the
interaction model (click events, hover, selection) would require
a custom hit-testing layer.

Not worth the complexity for the performance gain, which is
modest (rendering is ~30% of the bottleneck; layout and event
handling are the other 70%).

## Sequence

```
v1.0.0     Current (Cytoscape, ~5K nodes practical)
v1.1.0     Approach 1: CollapseByCluster (~200 lines)
           Practical limit: 50K nodes (200 supernodes rendered)
v1.2.0     Approach 4: Worker layout + culling (~400 lines)
           Practical limit: 50K nodes (20K visible at once)
```

Both approaches compose: a 50K-node graph is first collapsed to
200 supernodes (Approach 1), then drill-in shows up to 20K
cluster members with viewport culling (Approach 4). Together they
provide a smooth experience from 10 nodes to 50K without changing
the renderer.
