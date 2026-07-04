export { ForceLayout } from "./force-layout";
export { HierarchyLayout } from "./hierarchy-layout";
export { DagreLayout } from "./dagre-layout";
export { ElkLayout } from "./elk-layout";
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
  compartmentKey,
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
  ElkEngine,
} from "./structural";
