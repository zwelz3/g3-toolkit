// localPart and castLiteral are NOT exported (removed 2026-08-14 audit
// follow-up). Both are generic RDF plumbing: an IRI/CURIE shortener and
// an xsd-datatype literal caster. Every RDF-shaped consumer already has
// equivalents, they differentiate nothing, and castLiteral in particular
// is an open-ended support obligation (each uncovered XSD datatype
// becomes an issue against a symbol that is incidental to this library's
// purpose). They remain exported from ./pipeline for use inside core.
export { ProjectionPipeline, RDF } from "./pipeline";
export type {
  RDFTriple,
  RDFGraph,
  RDFObjectType,
  ProjectionStep,
  ProjectionStepConfig,
} from "./pipeline";

export {
  typeCollapse,
  literalCollapse,
  blankNodeCollapse,
  listCollapse,
  reificationCollapse,
} from "./transforms";

// WITHDRAWN 2026-08-17 (merge review): filterPseudoNodes,
// filterPseudoEdges, PSEUDO_FLAG, PSEUDO_CONNECTOR_TYPE,
// PSEUDO_TRUNK_TYPE. Undocumented and used nowhere outside
// pseudo-nodes.ts; the module and its tests stay in the tree. See
// packages/core/ARCHIVE.md.
export { hubBurst, busCollapse, isPseudoNode } from "./pseudo-nodes";
export type {
  PseudoKind,
  HubBurstOptions,
  HubBurstResult,
  HubBurstEdgeAssignment,
  SatelliteMap,
  BusCollapseOptions,
  BusCollapseResult,
  JunctionMap,
} from "./pseudo-nodes";

export {
  projectTripleTermsAsEdges,
  projectTripleTermsAsHyperarcs,
  tripleLabel,
  termLabel,
  localName,
  STAR_EDGE_TYPE,
  RDF_STATEMENT_FLAG,
} from "./hyperarc";
export type { TripleTermAnnotation } from "./hyperarc";

// WITHDRAWN 2026-08-15: checkRenderPermission. Undocumented and
// unused; the module and its tests stay in the tree. See
// packages/core/ARCHIVE.md.
export { createPresetPipeline } from "./presets";
export type {
  PresetName,
  HolonicProjectionPipeline,
  ViewTarget,
  RenderRequest,
} from "./presets";
