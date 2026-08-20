---
title: Obstacle-correct scene routing with parallel-segment separation
spec_base: https://w3id.org/g3t/spec/routing#
prefix: g3trouting
item_prefix: RT
spec_id: g3t-routing-001
version: 0.1.0
status: prototype
references:
  g3t:
    base: https://w3id.org/g3t/spec/g3t#
    path: g3t/spec.ttl
refines: g3t
---

<!--specl
created: 2026-08-14
-->

# Intent
Define the scene routing capability for g3-toolkit structural diagrams across
the 10 to 200 node operating range: every edge routed clear of every box, and
segments that would otherwise run coincident separated into ordered lanes,
with interaction served by a preview path so correctness at settle does not
cost responsiveness during a drag.

# Purpose
Two measured defects motivate this work. Above 64 obstacles the scene router
does not attempt obstacle-aware routing at all, and 8 to 22 percent of edges
are drawn through boxes. From roughly 32 nodes upward, segments from different
edges run coincident in numbers that grow superlinearly, reaching 272 runs
within 24px in a 64-node scene, which makes a drawing that is geometrically
correct still unreadable.

Both are addressed by a single change of posture: route everything through the
grid router, then order and separate what coincides. The published
ordering-and-nudging algorithm supplies the mechanism, and its precondition is
that every route come from one visibility graph, which the first defect's fix
also delivers.

This specification governs scene routing and nothing else. Layout and node
placement, hit testing, the graph exploration views, data loading, the SysML
and SHACL adapters, and the toolkit's public API surface are all outside it. A
requirement here constrains a routing component or a routing artifact, and any
requirement that appears to constrain something else is either a cross-track
commitment, marked with an owner other than the routing track, or a defect in
this specification.

Three requirements are cross-track and are recorded here because routing
depends on them, not because routing delivers them. RT1.1 asserts an
architectural decision the architecture track owns. RT8.1 through RT8.3 change a
frozen requirements artifact that the product owner owns. Neither is
implementation work for the routing track, and the routing track must not mark
them built.

# Requirements

## R1 Scope
- RT1.1 The capability MUST apply to the standalone SVG structural view, which is the sole structural rendering surface.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#StructuralView
  - acceptance: Given a structural scene, when it is rendered, then routed geometry is consumed only by the SVG structural view and no Cytoscape routed-edge path is exercised.
  - verifiedBy: packages/react/src/views/svg/structural-svg-view.test.tsx
  - owner: g3t:AG3
- RT1.2 The capability MUST apply uniformly to port-attached and body-attached edges.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SceneRouter
  - acceptance: Given an IBD in which every edge is port-attached, when the scene is routed, then every edge receives routed geometry anchored at its declared port.
  - verifiedBy: packages/core/src/layout/g3t-engine/g3t-routing.test.ts
- RT1.3 The capability MUST NOT introduce any representation in which two or more edges share a drawn stroke.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SceneRouter
  - constrains: https://w3id.org/g3t/components#StructuralView
  - acceptance: Given any routed scene, when the drawn paths are counted, then the count equals the number of edges carrying routed geometry.
  - verifiedBy: packages/core/src/metrics/layout-metrics.test.ts

## R2 Obstacle correctness
- RT2.1 The scene router MUST NOT refuse escalation on the basis of an obstacle count threshold.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SceneRouter
  - acceptance: Given a scene of 200 obstacles, when it is routed, then the grid router is invoked for every edge whose cheap route intersects a box.
  - verifiedBy: route-audit A3 configuration comparison
- RT2.2 Scale MUST be handled by the grid router's existing obstacle-pruning path, which verifies its pruned result against the full obstacle set before accepting it.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#OrthogonalRouter
  - acceptance: Given a scene above the pruning threshold, when a pruned result would intersect a box in the full obstacle set, then the unpruned computation is used instead.
  - verifiedBy: packages/core/src/route/orthogonal-router.test.ts
- RT2.3 Scene routing MUST produce zero surrenders across the operating range, where a surrender is an emitted route that intersects a non-endpoint box.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SceneRouter
  - acceptance: Given any scene from 10 to 200 nodes under either generator, when it is routed for initial layout or drag settle, then no emitted route segment intersects a non-endpoint box interior.
  - verifiedBy: packages/core/src/layout/g3t-engine/structural-patterns.test.ts
  - verifiedBy: route-audit surrender counter
- RT2.4 The geometry document MUST expose the surrender count for the scene.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#StructuralLayoutEngine
  - acceptance: Given a routed scene, when the geometry document is inspected, then it carries a surrender count, and that count is zero for any scene inside the operating range.
  - verifiedBy: packages/core/src/layout/structural.test.ts
- RT2.5 The detour fallback and the surrender fallback SHOULD be retained as guards but MUST NOT be reachable inside the operating range.
  - priority: SHOULD
  - constrains: https://w3id.org/g3t/components#SceneRouter
  - acceptance: Given any scene inside the operating range, when it is routed, then detourAround is not invoked.
  - verifiedBy: route-audit provenance counter

## R3 Interactive path split
- RT3.1 Initial layout and drag settle MUST be budgeted for correctness under RT2.3.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#StructuralView
  - constrains: https://w3id.org/g3t/components#SceneRouter
  - acceptance: Given a drag that ends, when the scene settles, then the settled routes satisfy RT2.3.
  - verifiedBy: packages/react/src/views/svg/structural-svg-view.test.tsx
- RT3.2 The in-drag frame MUST be bounded so that frame cost does not scale with clean-route cost; it is permitted to route degraded in order to meet that bound.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#StructuralView
  - acceptance: Given a 200-node scene under active drag, when offsets change, then the preview frame completes within the interactive frame budget even though a clean route of the same scene exceeds one second.
  - verifiedBy: tests/perf/prf.perf.test.ts
- RT3.3 The transition from preview to settled geometry MUST be a single visible correction at drag end rather than a progressive convergence.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#StructuralView
  - acceptance: Given a drag, when it ends, then routed geometry is recomputed once and the rendered result is stable thereafter.
  - verifiedBy: packages/react/src/views/svg/structural-svg-view.test.tsx
- RT3.4 The preview path MUST NOT write degraded geometry into any persisted or exported document.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#StructuralView
  - constrains: https://w3id.org/g3t/components#StructuralLayoutEngine
  - acceptance: Given a drag in progress, when the geometry document is read by a consumer other than the drawing surface, then it carries settled geometry rather than preview geometry.
  - verifiedBy: packages/core/src/layout/structural.test.ts

## R4 Route occupancy
- RT4.1 The grid router MUST return, alongside the point list, the set of visibility-graph edges each route traversed.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#OrthogonalRouter
  - acceptance: Given a routed connector, when its result is inspected, then the traversed grid edges are enumerable and their concatenation reproduces the emitted polyline.
  - verifiedBy: packages/core/src/route/orthogonal-router.test.ts
- RT4.2 Coincidence MUST be determined structurally, by shared visibility-graph edge, rather than by a pixel proximity threshold.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#OrthogonalRouter
  - acceptance: Given two routes traversing a common grid edge, when coincidence is computed, then that edge is reported as shared regardless of the distance between the drawn segments.
  - verifiedBy: packages/core/src/route/separation.test.ts
- RT4.3 A coincidence metric SHOULD be added to the existing layout metrics module alongside the crossing metric.
  - priority: SHOULD
  - constrains: https://w3id.org/g3t/components#LayoutMetrics
  - acceptance: Given a routed scene, when metricsFromStructural is called, then it reports the count of shared segments in addition to crossings and bends.
  - verifiedBy: packages/core/src/metrics/layout-metrics.test.ts

## R5 Shared-edge ordering
- RT5.1 The shared-edge graph MUST be constructed from visibility-graph edges carrying two or more routes, and each connected component processed as an independent subproblem.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given a scene with two disjoint groups of coincident routes, when ordering runs, then the two groups are ordered independently and neither influences the other.
  - verifiedBy: packages/core/src/route/separation.test.ts
- RT5.2 A route entering and leaving one component more than once MUST have each sub-route treated separately.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given a route that rejoins a shared component after leaving it, when ordering runs, then each sub-route receives its own position in the order.
  - verifiedBy: packages/core/src/route/separation.test.ts
- RT5.3 Each sub-route MUST receive a pseudo-direction, propagated across shared edges, with split points marked where propagation conflicts.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given a component whose pseudo-direction assignment conflicts, when propagation reaches the conflict, then a split point is recorded and propagation continues with the reversed direction.
  - verifiedBy: packages/core/src/route/separation.test.ts
- RT5.4 Ordering MUST introduce no crossing inside a shared segment; crossings MUST occur only at the exit of the last shared edge in pseudo-direction.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given a path-consistent component, when the ordering is applied, then no two routes exchange relative position within any shared edge.
  - verifiedBy: packages/core/src/route/separation.test.ts
- RT5.5 Ordering MUST be stable across interaction, so lanes do not exchange position between successive settled states of a drag.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given a drag that returns a node to its starting position, when the scene settles, then the lane order is identical to the pre-drag order.
  - verifiedBy: packages/react/src/views/svg/structural-svg-view.test.tsx

## R6 Segment placement
- RT6.1 Collinear segments MUST be collapsed into maximal horizontal and vertical segments before placement, and horizontal and vertical positions computed in separate passes.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given a route with three collinear sub-segments, when placement runs, then they are treated as one segment.
  - verifiedBy: packages/core/src/route/separation.test.ts
- RT6.2 Desired position for a middle segment of an S or Z bend MUST be the centre of the free space it occupies; for a segment bending around a corner it MUST be the position of the object vertex.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given an S bend in an otherwise empty corridor, when placement runs, then the middle segment is centred in the corridor.
  - verifiedBy: packages/core/src/route/separation.test.ts
- RT6.3 Separation constraints MUST simultaneously impose the R5 ordering, preserve relative order against other segments and against objects, enforce non-overlap, and prevent segments passing through each other.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given a scene where separating two segments would push one into a box, when placement runs, then the constraint set prevents the intrusion rather than requiring a separate obstacle guard.
  - verifiedBy: packages/core/src/route/separation.test.ts
- RT6.4 Placement MUST NOT introduce a box intersection, so RT2.3 holds after separation as well as before.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given any scene, when separation has run, then the surrender count remains zero.
  - verifiedBy: packages/core/src/layout/g3t-engine/structural-patterns.test.ts
- RT6.5 Centring routes in free space SHOULD be implementable and testable independently of lane separation.
  - priority: SHOULD
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given centring enabled and separation disabled, when a scene is routed, then routes are centred and no lane offsets are applied.
  - verifiedBy: packages/core/src/route/separation.test.ts
- RT6.6 The separation distance MUST be a configured parameter whose value is derived from measurement against the g3t corpus rather than adopted from another implementation.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SeparationSolver
  - acceptance: Given the parameter, when its provenance is checked, then it traces to a measurement record in this knowledge base.
  - verifiedBy: route-audit separation parameter sweep

## R7 Determinism
- RT7.1 Scene routing output MUST be a function of scene input alone on the paths governed by RT3.1.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SceneRouter
  - acceptance: Given an identical scene routed four times, when the results are compared, then they are byte-identical.
  - verifiedBy: packages/core/src/layout/g3t-engine/g3t-routing.test.ts
- RT7.2 Any remaining work budget MUST be expressed as a deterministic counter rather than wall-clock time.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#SceneRouter
  - constrains: https://w3id.org/g3t/components#OrthogonalRouter
  - acceptance: Given a budget that binds, when the same scene is routed on machines of differing speed, then the same edges are curtailed.
  - verifiedBy: packages/core/src/route/orthogonal-router.test.ts
- RT7.3 The preview path budget MUST use the same deterministic counter.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#StructuralView
  - acceptance: Given a preview frame under load, when the budget binds, then the curtailed set is reproducible.
  - verifiedBy: packages/react/src/views/svg/structural-svg-view.test.tsx

## R8 Measurement and budgets
- RT8.1 A scene-routing performance budget MUST assert at 100 nodes, measuring routing time rather than total layout time.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#PerformanceBudgets
  - acceptance: Given the budget file, when the routing keys are read, then a 100-node scene routing key asserts unconditionally.
  - verifiedBy: tests/perf/prf.perf.test.ts
  - owner: g3t:AG2
- RT8.2 A scene-routing performance budget MUST assert at 200 nodes, set for correctness rather than interactivity.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#PerformanceBudgets
  - acceptance: Given a 200-node clustered scene, when it is routed cleanly, then the measured time is within the asserted budget.
  - verifiedBy: tests/perf/prf.perf.test.ts
  - owner: g3t:AG2
- RT8.3 Performance budgets MUST assert against the clustered generator; uniform random figures MUST be recorded as informational only.
  - priority: MUST

  - acceptance: Given the perf suite, when a budget assertion runs, then its fixture is clustered, and any uniform measurement is reported without asserting.
  - verifiedBy: tests/perf/prf.perf.test.ts
  - owner: g3t:AG2
- RT8.4 Budget targets MUST be revisited when real structural scenes in the 50 to 200 node range become available.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#PerformanceBudgets
  - acceptance: Given a real scene corpus, when it is measured, then the budget targets are re-derived or explicitly reaffirmed in the same change.
  - verifiedBy: route-audit real-scene run

## R9 Out of scope guards
- RT9.1 The capability MUST NOT add a trunk representation, a membership concept on input edges, or junction markers.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#EdgeModel
  - constrains: https://w3id.org/g3t/components#StructuralLayoutEngine
  - acceptance: Given the input edge type, when it is inspected, then it carries no grouping or bus identifier.
  - verifiedBy: packages/core/src/layout/structural.test.ts
- RT9.2 Any future merging capability MUST preserve determinability of connector count from the drawing.
  - priority: MUST
  - constrains: https://w3id.org/g3t/components#StructuralLayoutEngine
  - acceptance: Given a merged drawing, when a reader counts connectors, then the count is recoverable from junction markers, distinct anchors, or an explicit multiplicity report.
  - verifiedBy: deferred with the merging capability

# User Stories

- RTUS1 As a systems engineer reviewing an IBD, I read a 70-block diagram and no connector passes through a block, so I do not have to ask whether a line that crosses a box is a routing artifact or a real relationship.
  - role: g3t:PER2
  - benefit: I can trust what the diagram asserts
  - acceptance: Given a 70-block structural scene, when it is rendered, then no connector intersects a block.
- RTUS2 As a reviewer counting interfaces, I can count connectors at a glance because separated lanes are visibly distinct rather than superimposed.
  - role: g3t:PER9
  - benefit: the drawing does not under-report the model
  - acceptance: Given four connectors that would otherwise run coincident, when the scene is rendered, then four distinct strokes are visible.
- RTUS3 As an engineer arranging a diagram, I drag a block in a 200-block scene and the drawing keeps up, then settles into a clean routing when I let go.
  - role: g3t:PER10
  - benefit: correctness at the top of the range does not cost interactivity
  - acceptance: Given a 200-node scene, when a block is dragged, then frames remain responsive and the settled scene satisfies the zero-surrender invariant.
- RTUS4 As a reviewer comparing two versions of a diagram, identical inputs produce identical drawings, so a visual difference always means a model difference.
  - role: g3t:PER9
  - benefit: diagram diffs are meaningful
  - acceptance: Given one scene routed on two machines, when the outputs are compared, then they are identical.
- RTUS5 As a maintainer, I can tell from the geometry document whether a scene received degraded routing rather than inferring it from the picture.
  - role: g3t:PER11
  - benefit: a limit is distinguishable from a defect
  - acceptance: Given any routed scene, when the geometry document is read, then it reports its surrender count.

# Decisions

- RTD1 The Cytoscape canvas is retired as a rendering target for structural diagrams; the SVG structural view is the sole structural surface.
  - title: Cytoscape retired as a structural rendering target
  - decisionStatus: accepted
  - rationale: Neither routed-edge consumer was Cytoscape, the two surfaces had diverged on entry point, transport, fallback and hit testing, and the coordinate-string transport could not carry richer routing output.
  - affects: RT1.1
- RTD2 Coincidence is treated by separation rather than by merging; merging is deferred.
  - title: Coincidence treated by separation rather than merging
  - decisionStatus: accepted
  - rationale: Grouping serves clutter reduction with no semantic claim attached, connector count must remain determinable from the drawing, and separation satisfies both without a trunk representation, membership concept, junction markers or a merged labelling policy.
  - affects: RT1.3, RT9.1, RT9.2
- RTD3 Scene routing is budgeted for correctness; a 200-node scene may exceed one second.
  - title: Scene routing budgeted for correctness
  - decisionStatus: accepted
  - rationale: Measured, a clean 200-node clustered scene costs roughly 1241ms, and the alternative is a silent correctness cliff inside the intended operating range.
  - affects: RT2.3, RT8.2
- RTD4 The interactive frame is split out as a preview path, with a clean re-route on settle.
  - title: Interactive frame split out as a preview path
  - decisionStatus: accepted
  - rationale: Whole-scene re-routing at correctness cost makes dragging unusable at the top of the range; the split keeps the settled state correct and the transient state fast, and mirrors the pattern the retired surface already used.
  - affects: RT3.1, RT3.2, RT3.3
- RTD5 The escalation threshold is removed rather than re-derived, and scale is handled by the grid router's existing pruning path.
  - title: Escalation threshold removed in favour of the pruning path
  - decisionStatus: accepted
  - rationale: The scene router's threshold and the router's own pruning threshold are the same number with the gate firing first, so the mechanism built for scale is unreachable; pruning already verifies against the full obstacle set and is accepted on 54 to 75 percent of calls.
  - affects: RT2.1, RT2.2

# Acceptance Queries

- RTQ1 No emitted route segment intersects a non-endpoint box interior, in any scene inside the operating range.
  - gates: RT2.3, RT2.5, RT6.4
- RTQ2 The number of drawn strokes equals the number of edges carrying routed geometry.
  - gates: RT1.3, RT9.1
- RTQ3 An identical scene routed repeatedly, on machines of differing speed, produces identical geometry.
  - gates: RT7.1, RT7.2, RT7.3
- RTQ4 Scene routing time is within an asserted budget measured against a clustered fixture at both 100 and 200 nodes.
  - gates: RT8.1, RT8.2, RT8.3
- RTQ5 Every parameter governing separation traces to a measurement record rather than to another implementation.
  - gates: RT6.6

# Design Considerations

- RTDN1 The ordering and placement mechanism follows the published three-stage approach to orthogonal connector routing, in which computing the visual representation is a distinct stage after search rather than a post-process. The stage is not cheap: on the authors' own measurements final placement cost roughly as much as the search itself at 100 nodes and dominated by 300. Absolute figures are from 2009 hardware; the ratio is the planning input.
- RTDN2 The implementation is independent work from the published papers. No code is taken from any existing router, and parameter values are not adopted from another implementation's source. This preserves the independence posture already asserted in the router.
- RTDN3 Placement needs a separation-constraint projection solver, which does not exist in the codebase. It is the largest single new component and is independently implementable from the literature.
- RTDN4 RT2.1 is a precondition for R5 rather than merely preceding it. The ordering algorithm assumes every route came from one visibility graph, and the cheap gap-template route never touches the grid, so template-routed edges cannot participate in shared-edge ordering at all.
- RTDN5 Coincidence attribution showed the phenomenon is not concentrated at anchors. Most terminal-stub coincidence at 64 nodes is between stubs of different nodes, aligned because layered placement aligns their host boxes, and search-produced coincidence overtakes stubs by 200 nodes. Anchor-side fan distribution solves the minority case and is not the model for R5.
- RTDN6 Quality gates should build on the existing metrics module, which already exports segment crossing, crossing count, bend count and polyline length.
- RTDN7 Existing render-side constraints survive unchanged: arrow shapes carry a trim length and the shaft is walked back from the tip, so terminal segments must retain a minimum length, and edge labels anchor at the target end in the quadrant opposite port labels.

# Open Questions

- RTOQ1 The separation distance and any grouping radius are unmeasured. Adopting a value from another implementation would be both weaker evidence and an unnecessary contact with a source the project keeps at arm's length.
  - owner: g3t:AG1
  - recommendation: Sweep the parameter with the audit harness against both generators and pick from the crossing and coincidence metrics, then record the result as a measurement.
  - resolutionStatus: open
- RTOQ2 Whether the visible correction at drag end is acceptable, or whether interaction must converge without a jump.
  - owner: g3t:AG2
  - recommendation: Ship the preview split and evaluate on real scenes. Wiring the existing invalidation seam is the path to removing the correction, and it should be justified by observed annoyance rather than assumed.
  - resolutionStatus: open
- RTOQ3 Whether centring should ship ahead of separation as an independent improvement.
  - owner: g3t:AG1
  - recommendation: Yes. It is described in the literature as negligible in cost and as making routes more predictable, and RT6.5 already requires the two to be separable.
  - resolutionStatus: open
- RTOQ4 Whether the preview path should reuse the current cheap gap-template route or a bounded grid route.
  - owner: g3t:AG1
  - recommendation: Prefer a bounded grid route, so preview and settled geometry come from the same producer and the correction at settle is a refinement rather than a change of kind.
  - resolutionStatus: open
- RTOQ5 Budget targets rest on synthetic scenes. Neither generator models hub nodes, depth, or non-uniform box sizes.
  - owner: g3t:AG2
  - recommendation: Treat RT8.2's target as provisional and re-derive when a real corpus exists, per RT8.4.
  - resolutionStatus: open
- RTOQ6 Whether a crossing term should be added to the search cost model, and when.
  - owner: g3t:AG1
  - recommendation: After R5. The literature notes that shared-path ordering makes crossings cheap to identify, which suggests the ordering stage should precede the cost-model work rather than follow it.
  - resolutionStatus: deferred
