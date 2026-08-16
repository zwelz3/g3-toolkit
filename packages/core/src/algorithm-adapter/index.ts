export { ingestAlgorithmResults } from "./algorithm-adapter";
export type { AlgorithmIngestReport } from "./algorithm-adapter";
// WITHDRAWN 2026-08-15: overlayFromDocument and
// ingestEdgeAlgorithmResults. No adopter document named them and
// nothing here used them. parseAlgorithmResult plus applyAlgorithmResult
// remain, so the result-document channel is still complete: parse a
// document, apply it to a UGM. Modules and tests stay in the tree; see
// packages/core/ARCHIVE.md.
export {
  parseAlgorithmResult,
  overlayFromPath,
  applyAlgorithmResult,
  connectedComponents,
  degreeCentrality,
} from "./algorithm-results";
export type {
  AlgorithmResultDocument,
  StructuralOverlay,
} from "./algorithm-results";
