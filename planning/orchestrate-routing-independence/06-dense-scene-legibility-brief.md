---
project: g3_toolkit
part_of: https://forge.tail515200.ts.net/ontology/kb/g3_toolkit/Plan/orchestrate-routing-quality-dense-scene-legibility-dependenc-33ea5324
---

# Brief 06: dense-scene legibility — pseudo-node spreading (challenge problem)

Owner ask (Jake, 2026-08-14): "look at this as a challenge problem —
how to display and render this; it may take pseudo nodes to spread
it." Distinct from 03's LAYOUT-internal dummies: these pseudo nodes
are PROJECTION-level, user-visible spreading devices.

## Adopter evidence (haunt / GExplore, read from the haunt graph)

Decision `kb/haunt/Decision/gexplore-g3-swap-bff-routed-select-ugm-
identity-swap-pattern-499d98ba` records what a real adopter had to
invent: (a) all SPARQL through their BFF, never `SparqlAdapter`
against raw Fuseki (auth + graph scoping) — adapter docs should say
this posture is expected, not a workaround; (b) `UGM.fromJSON` copy to
force a CytoscapeCanvas identity swap for re-layout — the identity
contract works but adopters DISCOVER it; it needs a named, documented
affordance; (c) `properties._color` to override Okabe-Ito — pseudo
nodes below must respect the same encoding-channel precedence.

## Design

1. **Hub-burst transform** (`packages/core/src/projection/transforms.ts`
   gains `hubBurst`): for nodes whose **total degree** (undirected count
   of incident edges, computed from the graph state at the point hubBurst
   runs -- after any type-expansion steps, before collapse transforms)
   exceeds k (default 12), group all incident edges by (edge type,
   direction) and insert one pseudo "satellite" node per group at
   projection time. Satellites carry `pseudo: true`, owner id, and the
   group key. No special weight or LOD attribute is required: `applyLod`
   in `packages/core/src/style/lod.ts` gates on feature flags
   (nodeLabels, edgeLabels, glyphs, halos, donuts, icons, edges) resolved
   from zoom/count context, never on a per-node weight property. The
   satellite connector-dot node body survives all LOD tiers because
   `applyLod` never masks a node's base shape; it only conditionally
   strips labels, glyphs, halos, donuts, and icons. Satellites must
   therefore not rely on those decoration features for their visual
   identity. The hub keeps one edge per satellite; satellites fan out to
   the real neighbors. Same UGM-in/UGM-out shape as
   typeCollapse/listCollapse -- it composes in the existing
   ProjectionPipeline (`packages/core/src/projection/pipeline.ts`), no
   new pipeline concept. **Tie-breaking rule**: an edge whose both
   endpoints have total degree > k is assigned to the satellite group of
   the endpoint with the higher total degree; ties are broken by the
   lexicographically smaller node ID. The degree comparison is performed
   on the pre-hubBurst graph state (both endpoints are evaluated against
   the same snapshot). This makes the invert mapping fully deterministic
   without relying on edge direction and guarantees that each original
   edge appears in exactly one satellite group.
2. **Bus/trunk transform** (`busCollapse`): many-to-one bundles
   (the Fan-In Bus shape) of at least k_bus incident edges (default 3;
   configurable, analogous to hubBurst's k) collapse to one trunk edge
   into a pseudo junction node + short taps. Junction node IDs use the
   scheme `pseudo:bus:{stable-hash-of-edge-group-key}` to prevent
   collision with real node IDs. Junction placement is layout's job (it
   is an ordinary node after projection). The busCollapse step returns a
   `JunctionMap` (`Map<string, {sinkHub: string; edgeGroupKey: string}>`,
   keyed by junction node ID) alongside the UGM, mirroring the
   SatelliteMap contract from hubBurst. The invert map for busCollapse
   is a `Map<string, string[]>` keyed by junction node ID, mapping to
   the original edge IDs that were collapsed into the trunk; it is
   returned alongside the UGM and JunctionMap by the pipeline step and
   stored in the same result object (not in UGM node state).
3. **Rendering contract**: pseudo nodes render as small connector
   dots (a reserved style class, themeable, LOD-aware via the
   existing lod machinery -- `resolveLod`/`applyLod` in
   `packages/core/src/style/lod.ts`). Hit-testing maps a pseudo
   element back to its owner hub/edge-group for selection and
   context-menu purposes. The hit-test layer consumes two reverse-maps
   returned alongside the UGM by the pipeline step:
   - `SatelliteMap` (`Map<string, {hub: string; groupKey: string}>`,
     keyed by satellite node ID) for hubBurst: selecting a satellite
     selects the corresponding edge group on the hub.
   - `JunctionMap` (`Map<string, {sinkHub: string; edgeGroupKey: string}>`,
     keyed by junction node ID) for busCollapse: selecting a junction
     selects the edge group that collapsed into that junction, and the
     context-menu for a junction exposes the same "expand group" action
     as a satellite. Both maps are populated by their respective pipeline
     steps and consumed by the hit-test layer; neither map is stored in
     UGM node state.
   **Encoding channels vs. direct properties**: encoding channels
   (the attribute-mapping system in `applySpec` in
   `packages/react/src/interaction/encoding/encoding-spec.ts`)
   never bind to pseudo nodes. The mechanism is a `pseudo: true` skip
   guard added to the per-node iteration loop inside `applySpec`: nodes
   where `attrs.pseudo === true` are skipped before attribute-mapping
   runs. This is distinct from `RESERVED_CHANNELS`/`ReservedChannelError`
   (which guards channel names from collision, not node identity) --
   RESERVED_CHANNELS is unchanged by this work. Direct node property
   rendering (e.g., `properties._color` set on the satellite node at
   projection time) does pass through, because satellites are ordinary
   UGM nodes with their own VisualAttributes bag and the skip guard
   applies only to the attribute-mapper, not to the VisualAttributes
   merge. The adopter evidence in §1 ("pseudo nodes below must respect
   the same encoding-channel precedence") refers to this direct-property
   rendering path, not to the EncodingSpec attribute-mapper. These two
   mechanisms are orthogonal: one is a query-time mapping from UGM
   attributes to visual channels; the other is a value already in the
   node's properties bag.
4. **Pipeline ordering and composition safety**: hubBurst and
   busCollapse must be added to the ProjectionPipeline **after** any
   type-expansion steps and **before** collapse transforms (typeCollapse,
   listCollapse). Downstream collapse transforms in
   `packages/core/src/projection/transforms.ts` that key on node
   attributes must skip nodes where `pseudo === true`; this guard is
   implemented inside each transform step (typeCollapse and listCollapse),
   not as a pipeline-level concern. `packages/core/src/projection/transforms.ts`
   is an explicit touched file: typeCollapse and listCollapse each gain
   a one-line `if (node.pseudo) continue;` (or equivalent filter) guard.
   The complete rollback path is: remove hubBurst and busCollapse from
   the pipeline; revert the pseudo-skip guard edits in transforms.ts;
   revert the pseudo-skip guard in `applySpec` in encoding-spec.ts;
   revert the `pseudo: true` filter in subgraph-export.ts and
   algorithm-adapter.ts. Omitting hubBurst/busCollapse from the pipeline
   alone does not constitute a complete rollback because the guard
   modifications in those four files persist. hubBurst and busCollapse
   are opt-in pipeline steps -- an adopter adds them explicitly.
   No feature flag is added to the library.
5. **Export and algorithm-adapter isolation**: `exportSubgraphJson`,
   `exportSubgraphTurtle`, and `exportSubgraphCsv` in
   `packages/core/src/export/subgraph-export.ts`, and
   `ingestAlgorithmResults` in
   `packages/core/src/algorithm-adapter/algorithm-adapter.ts`,
   filter out `pseudo: true` nodes and any edges incident on them
   before processing. These are the designated filter call-sites.
   To reduce divergence risk across future export or adapter additions,
   a shared `filterPseudoNodes(nodes)` / `filterPseudoEdges(edges)`
   helper is introduced in `packages/core/src/projection/pipeline.ts`
   (or a new `pseudo-filter.ts` in the same directory); all five
   designated call-sites import and use this helper rather than
   inlining the check. New export functions or adapter methods added
   in the future must explicitly import and call this helper if they
   process UGM nodes or edges.
6. **Reversibility**: transforms are pure projection; the raw graph
   is untouched. Toggling the transform re-projects -- and per the
   haunt lesson, the demo wiring documents the UGM identity swap as
   THE way to trigger re-layout, promoted into the wiring guide as a
   named doc snippet ("re-layout via identity swap") instead of
   adopter folklore. This is a documentation deliverable (a snippet in
   the wiring guide), not a new exported function.
7. **Demo**: Routing Lab gains a "spread" knob on Port Storm and
   Fan-In Bus; one general shell (Supply Chain, which has real
   fan-ins) enables hubBurst to show it beyond the lab.

## Verification

- Oracle: add a local-density metric (max edges incident within a
  radius r of any point, sampled on **post-layout** geometry --
  Cytoscape canvas coordinates after the layout engine has run, not
  projection output coordinates). Baseline values for Port Storm and
  Fan-In Bus are captured once by running the metric against the
  current (pre-spread) fixture and committing them as named constants
  in the test file; the test fails if the baseline constants are absent
  or stale (verified via a git-controlled snapshot). Assert spread
  values drop by a stated factor relative to those committed baselines.
  The crossing gate is a **per-region crossing count relative to the
  pre-spread baseline** (not an absolute non-increase, because
  pseudo-node injection expands the node and edge set and may increase
  crossings in absolute terms for dense scenes such as Port Storm). Box
  violations do not increase.
- Unit (hubBurst): transform round-trip -- project then apply invert
  mapping; assert the invert mapping covers every original edge
  exactly once, including edges where both endpoints have degree > k
  (must land in the higher-degree endpoint's satellite group per the
  tie-breaking rule, ties broken by smaller node ID). LOD survival:
  pass the hubBurst output through `applyLod` at tier 1 and assert
  that all satellite nodes remain present (opacity not zeroed, node
  body not suppressed). Pseudo flag isolation: no pseudo id leaks into
  export/subgraph or algorithm-adapter ingestion (via filterPseudoNodes
  helper). Encoding-channel skip: call `applySpec` on a UGM containing
  a satellite node and assert that the satellite's visual channel is not
  set by the attribute-mapper (the per-node skip guard fires; no
  ReservedChannelError -- that error guards channel names, not pseudo
  nodes). Direct property pass-through: `properties._color` set on a
  satellite at projection time reaches VisualAttributes unchanged.
  Pseudo-skip guard regression: run typeCollapse and listCollapse on a
  graph containing pseudo nodes and assert no pseudo node is
  removed or transformed.
- Unit (busCollapse): transform round-trip -- project then apply
  invert mapping (Map<junctionId, string[]>); assert every original
  edge ID is recoverable from exactly one junction's list and
  junction IDs do not collide with real node IDs. Pseudo flag
  isolation: no junction id leaks into export or algorithm-adapter
  ingestion. Junction ID uniqueness: generate two independent
  busCollapse projections on graphs with overlapping edge-group keys
  and assert no ID collision. JunctionMap contract: assert that
  selecting a junction via the hit-test layer returns the correct
  edge group (sinkHub + edgeGroupKey) from the JunctionMap.
  Composed behavior: apply hubBurst then busCollapse on a graph
  containing nodes that qualify as both hubs (degree > k) and fan-in
  bus participants; assert both SatelliteMap and JunctionMap are
  populated and no original edge is lost from either invert map.
- Wiring guide snippet + executable twin (adoption-channel rule);
  visual acceptance by Zach on the Pages playground (checklist:
  Port Storm fan visible as satellite ring, Fan-In Bus shows junction
  node, Supply Chain shell hub count readable, no satellite visible in
  exported subgraph).
