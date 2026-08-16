export {
  validateShacl,
  summarizeValidation,
  ShaclValidator,
} from "./shacl-validator";
export type {
  ShaclShape,
  ShaclPropertyConstraint,
  ShaclViolation,
  ShaclValidationResult,
} from "./shacl-validator";
// propertyRowText, cardinalitySuffix and valueConstraintCount moved to
// @g3t/core/internal (2026-08-14). They format row
// LABELS, so keeping them here would put a rendering opinion under the
// 1.0 semver contract. See packages/core/src/internal/index.ts.
export {
  shaclShapesToStructural,
  closedShapeIds,
  shaclRowSeverities,
  shaclRowId,
} from "./shacl-to-structural";
export type { ShaclToStructuralOptions } from "./shacl-to-structural";
// severityOverlayId moved to @g3t/core/internal with the three row-text
// formatters above; it mints an overlay id string, which is the same
// class of rendering detail. severityOverlays (plural) stays: it returns
// the overlay DOCUMENTS, which are a versioned integration channel.
// WITHDRAWN 2026-08-15: resultsForShape (and resultTargets,
// resultsForFocusNode below). No adopter document named them and
// nothing here used them. The report channel stays usable: the parser,
// the adapter from validation results, and the focus-node and driver
// accessors all remain. Modules and tests stay in the tree; see
// packages/core/ARCHIVE.md.
export {
  parseShaclReport,
  reportFromValidationResults,
  severityOverlays,
  shaclResultDrivers,
  reportFocusNodes,
} from "./shacl-report";
export type {
  ShaclReportDocument,
  ShaclReportResult,
  ShaclSeverity,
} from "./shacl-report";
export { resultSelectionIds, resultDetail } from "./shacl-links";
export type { ShaclResultTargets, ShaclResultDetail } from "./shacl-links";
