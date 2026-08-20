# yFiles gap analysis (2026-08-14)

Owner ask (Jake, A29): "look at yFiles and see what is missing in G3."
Scope: feature-surface comparison against yFiles for HTML 3.x, honest
about doctrine differences (some yFiles features are deliberately
out-of-scope here, not gaps). Grounded against the live tree at commit
470003e; where a claim says "none in source" it was grepped this
session.

## Doctrine differences first (not gaps)

- **Graph analysis** (centralities, flows, cycles, substructures):
  yFiles ships ~40 algorithms in-library. G3's architecture doctrine
  keeps heavy algorithms EXTERNAL (networkx/GraphBLAS) and ingests
  result documents (`algorithm-adapter/`). Only `connectedComponents`
  and `degreeCentrality` are built in for small-case convenience. Do
  not "fix" this.
- **Commercial license + support**: not a feature.
- **Layout morphing animations**: yFiles animates layout transitions.
  G3 runs `animate={false}` by perf doctrine (2026-06-17 diagnosis);
  camera/position stability (D15) is the G3 answer instead.

## Comparison table

| Capability | yFiles | G3 today | Verdict |
| --- | --- | --- | --- |
| Layered/hierarchic layout | Hierarchic (incremental) | dagre, g3t-layered, ELK via structural pipeline | Covered |
| Force/organic | Organic (smart) | force-layout (fcose) | Covered |
| Orthogonal layout | Orthogonal | structural view (ELK) | Covered for block view; no generic orthogonal node layout |
| Tree layout | Tree, balloon | hierarchy-layout | Partial (no balloon/compact variants) |
| Radial / circular | Radial, circular, compact-disk | none in source | **GAP** |
| Swimlanes / table layout | Tabular, partition grid | none | **GAP** (matrix view is a different thing) |
| Isometric projection | Yes | none | Gap, low value |
| Edge routing (orthogonal, obstacle-aware) | Polyline/channel router | g3t-routing + orthogonal-router; briefs 01-05,10 land nudging, corridors, channel router | Covered once brief set ships |
| Parallel-edge separation | Yes | brief 01 (nudging) — dispatched, in flight | In flight |
| Bus routing | Yes | busCollapse projection transform (brief 06) — visual, not router-level | Partial by design |
| Edge bundling | Yes | none; hubBurst (brief 06) attacks the same legibility problem differently | Partial by design |
| Bridges/crossing glyphs | Yes | none | **GAP** (cheap legibility win once channel router lands: crossings become known) |
| Label placement engine (collision-free node+edge labels) | Generic labeling | none — Cytoscape defaults | **GAP — biggest single legibility gap** |
| Group nodes / folding with state | Groups, folding, collapse/expand persistence | ComboManager (F1-F8), grouping-manager; interactive expand/collapse surface REMOVED by upstream ruling 2026-07-10 | Partial — see brief 11 (auto-collapse counts) |
| Auto-aggregation at scale | Aggregation wizard | collapseByCluster (Louvain, threshold 2000, memberCount, weighted links) | Covered core; counts badge + auto-wiring = brief 11 |
| Port constraints / candidates | Yes | Structural view: declared ports + port-based attachment. UGM/force view: none | Partial (structural only) |
| Snapping / orthogonal edge editing | Yes | none (drag is freeform) | Gap, medium value |
| Overview component | Yes | Minimap (Molecules/Minimap) | Covered |
| Level-of-detail | Yes | style/lod.ts | Covered |
| Large-graph rendering (WebGL, virtualization) | WebGL2 renderer | Cytoscape canvas; canvas2d display-list adapter (brief 08 stage 1); no canvas-level virtualization (audited honestly in planning/rdf-lpg-virtualization-audit.md) | **GAP** — brief 08 is the vehicle |
| Undo/redo | Yes | undo-redo/ | Covered |
| Export (SVG/PNG/PDF/print) | Yes | subgraph export (Turtle/JSON/CSV), SVG view adapter; no PDF/print | Partial |
| Incremental layout ("layout from sketch") | Yes | incremental-layout + change-driven-layout + structural sketch | Covered |

## Ranked recommendations

1. **Label placement** — nothing in the current brief set touches it,
   and it is the single most visible difference from a yFiles render.
   Candidate: greedy collision-free placement over the post-layout
   scene (positions + routes are all known after briefs 01-05), as a
   pure post-pass in core. Deserves its own brief after the routing
   set ships.
2. **Folding/auto-collapse counts** — brief 11 (this round).
3. **Radial + circular layouts** — cheap to add as LayoutEngine
   implementations (graphology or hand-rolled); good for the ontology
   and bio shells.
4. **Bridge glyphs at crossings** — small, do inside the channel
   router (brief 05) where crossings are computed anyway.
5. **Swimlanes** — real analyst value (matrix view is not a
   substitute) but a large layout feature; defer until structural
   engine is stable post-briefs.
6. Snapping/ortho edge editing, isometric, PDF export — backlog.
