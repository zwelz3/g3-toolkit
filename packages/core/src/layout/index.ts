export { ForceLayout } from "./force-layout";
export { HierarchyLayout } from "./hierarchy-layout";
export { DagreLayout } from "./dagre-layout";
export { G3tLayeredLayout } from "./g3t-ugm-layout";
// RTE-011 (LR-15): the pure edge router, exported so views can
// re-route live during drags against an offset geometry.
export { routeStructuralEdges } from "./g3t-engine/g3t-routing";
// PRF-003 brief 05a (owner Jake, 2026-08-14): channel router
// additive slice. Pure module + fallback classifier; the
// `useChannelRouter` flag on `routeStructuralEdges` is off by default,
// so shipped routing is unchanged. 05b flips the flag and deletes the
// escalation ladder.
//
// WITHDRAWN 2026-08-17 (merge review): assignTracks, emitChannelRoute,
// routeChannelOverflow and classifyFallback. All four are internals of
// a router behind an off-by-default flag, named in no adopter document
// and called by nothing outside their own modules, which is the class
// the 2026-08-15 subpath withdrawal covered. Per the standing
// archive-don't-delete ruling the modules and their tests stay in the
// tree and keep running, importing relatively rather than through the
// public entry. The TYPES stay exported: they describe the geometry
// `routeStructuralEdges` returns, which is public.
export type {
  Channel,
  ChannelPlan,
  ChannelEdge,
  TrackAssignment,
} from "./g3t-engine/g3t-channel-router";
export type {
  FallbackNodeInfo,
  FallbackEdge,
  FallbackReason,
  FallbackClassification,
} from "./g3t-engine/g3t-fallback-classifier";
export type {
  LayoutEngine,
  LayoutResult,
  Position,
  LayoutOptions,
} from "./types";

// F2: Incremental layout
export {
  computeIncrementalUpdate,
  applyIncrementalLayout,
  capturePositions,
  IncrementalLayout,
} from "./incremental-layout";
export type { IncrementalLayoutOptions } from "./incremental-layout";

// Group A: structural rendering geometry (round 31)
export {
  buildStructuralElkGraph,
  layoutStructural,
  estimateTextSize,
  isChainEdgeId,
} from "./structural";
export type {
  StructuralGraphInput,
  StructuralNode,
  StructuralCompartment,
  StructuralRow,
  StructuralPort,
  StructuralEdge,
  StructuralGeometry,
  StructuralNodeGeometry,
  StructuralPortGeometry,
  StructuralLayoutOptions,
  TextMeasure,
  PortSide,
} from "./structural";
