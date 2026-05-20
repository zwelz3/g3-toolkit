/**
 * g3-toolkit public API.
 *
 * Core modules (D6: framework-agnostic):
 */
export { UGM } from "./core/ugm";
export type {
  NodeAttributes,
  EdgeAttributes,
  NodeInput,
  EdgeInput,
  QualifiedEdgeMeta,
  PropertyKeyRegistry,
  UGMEventType,
  NodeEventPayload,
  EdgeEventPayload,
  AttributeUpdatePayload,
  SerializedUGM,
  PropertyMap,
} from "./core/ugm";

export {
  ContextMenuManager,
  createDefaultMenuManager,
} from "./interaction/context-menu";
export type {
  MenuItem,
  MenuTarget,
  MenuTargetType,
} from "./interaction/context-menu";

/**
 * View components (D13: React):
 */
export { CytoscapeCanvas } from "./views/canvas";
export type { CytoscapeCanvasProps } from "./views/canvas";
export { ugmToCytoscapeElements } from "./views/canvas";
export {
  OKABE_ITO_COLORS,
  NODE_SHAPES,
  buildTypeVisualMap,
} from "./views/canvas";

export { DetailInspector } from "./views/inspector";
export type { DetailInspectorProps } from "./views/inspector";
