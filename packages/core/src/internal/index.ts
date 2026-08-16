/**
 * @g3t/core/internal: shipped, importable, and explicitly OUTSIDE the
 * semver contract.
 *
 * Everything on this subpath may change shape or disappear in any
 * release, including a patch. There is no deprecation period and no
 * migration note. If you import from here, pin an exact version and
 * expect to revisit it.
 *
 * WHY THIS EXISTS
 *
 * The 2026-08 audit flagged nine helpers reachable from @g3t/core
 * subpaths that read as internals. Four of them are the label
 * formatters behind the SHACL shape browser: they turn one
 * sh:PropertyShape into the row text a reader sees. A host building
 * its own SHACL view has a real reason to want them, because matching
 * ShaclShapeBrowser's typography by hand means reimplementing
 * cardinality notation and constraint-chip counting and getting both
 * subtly wrong.
 *
 * But they encode a RENDERING OPINION, not a computation. `[0..*]` for
 * an absent sh:maxCount is a choice; so is showing a chip count rather
 * than the constraints themselves. Freezing those under 1.0 semver
 * would make "change how a cardinality suffix looks" a breaking change,
 * which is the wrong trade for a visualization library that expects its
 * presentation layer to keep moving.
 *
 * This subpath is the middle position: the helpers stay reachable for
 * the hosts that want them, and the 1.0 promise does not cover them.
 * (Owner ruling, 2026-08-14. The alternative options considered were
 * keeping them fully public and deleting them outright.)
 *
 * If something here earns a stable contract, PROMOTE it to a real
 * subpath with a deliberate commit. Do not let this file become the
 * place symbols go to avoid that conversation. It is not an
 * open-ended dumping ground: additions should be rare and argued.
 *
 * Note that `api-surface.json` snapshots this entry like any other, so
 * changes here are still visible in a diff. The gate tracks the
 * surface; it does not confer stability on it.
 */

// SHACL row-label formatters. Stable in behavior, unstable by policy.
// Their own doc comments in shacl-to-structural.ts and shacl-report.ts
// describe what each returns.
export {
  propertyRowText,
  cardinalitySuffix,
  valueConstraintCount,
} from "../shacl/shacl-to-structural";
export { severityOverlayId } from "../shacl/shacl-report";

// The input types, re-exported so a consumer of the four functions
// above can NAME what they accept without also depending on the
// stable @g3t/core/shacl entry for a type they only need here.
export type { ShaclPropertyConstraint } from "../shacl/shacl-validator";
export type { ShaclSeverity } from "../shacl/shacl-report";
