/**
 * Projection presets and ViewRouter gate (M4.E3.T1-T3).
 *
 * @see specs/04-technical-projection.md R4.3, R4.5, R4.6
 */

import { ProjectionPipeline } from "./pipeline";
import {
  typeCollapse,
  literalCollapse,
  blankNodeCollapse,
  listCollapse,
  reificationCollapse,
} from "./transforms";

// ── Presets (M4.E3.T1) ─────────────────────────────────────────────

export type PresetName = "standard" | "ontology" | "provenance-preserving";

/**
 * Create a pipeline with one of the named presets.
 *
 * - "standard": All collapses enabled. Produces the cleanest LPG view.
 * - "ontology": Type collapse OFF so rdf:type edges remain visible.
 *   Useful for ontology exploration.
 * - "provenance-preserving": Reification collapse OFF so statement
 *   metadata (confidence, provenance) remains as separate nodes.
 */
export function createPresetPipeline(preset: PresetName): ProjectionPipeline {
  const pipeline = new ProjectionPipeline();

  // Literal and Type collapses run first (filter original triples).
  // Structural collapses (BNode, List, Reification) run after,
  // so their synthetic literals are not removed by literalCollapse.

  pipeline.addStep({
    name: "Literal Collapse",
    transform: literalCollapse,
    enabled: true,
  });

  pipeline.addStep({
    name: "Type Collapse",
    transform: typeCollapse,
    enabled: preset !== "ontology",
  });

  pipeline.addStep({
    name: "Blank-Node Resolution",
    transform: blankNodeCollapse,
    enabled: true,
  });

  pipeline.addStep({
    name: "List Resolution",
    transform: listCollapse,
    enabled: true,
  });

  pipeline.addStep({
    name: "Reification Collapse",
    transform: reificationCollapse,
    enabled: preset !== "provenance-preserving",
  });

  return pipeline;
}

// ── Holonic Compatibility (M4.E3.T2) ───────────────────────────────

/**
 * A Holonic ProjectionPipeline is any object with a `project()` method
 * that accepts an RDFGraph and returns a UGM. The g3t pipeline
 * satisfies this interface natively.
 *
 * This type alias makes the compatibility explicit.
 */
export type HolonicProjectionPipeline = Pick<ProjectionPipeline, "project">;

// ── ViewRouter RDF Enforcement Gate (M4.E3.T3) ─────────────────────

export type ViewTarget =
  | "canvas"
  | "table"
  | "timeline"
  | "map"
  | "stats"
  | "schema"
  | "inspector";

/** Metadata about a data load request. */
export interface RenderRequest {
  /** Is the source data RDF? */
  isRDF: boolean;
  /** Has the data passed through a ProjectionPipeline? */
  isProjected: boolean;
  /** Target view. */
  target: ViewTarget;
}

/**
 * ViewRouter gate: blocks raw RDF from reaching renderers.
 *
 * Returns true if the request is allowed; throws if blocked.
 * Schema view and raw-triples inspector toggle are exempt (R4.6).
 */
export function checkRenderPermission(request: RenderRequest): boolean {
  // Non-RDF data always passes
  if (!request.isRDF) return true;

  // Schema view is exempt (it shows the ontology, not projected data)
  if (request.target === "schema") return true;

  // Inspector is exempt (raw triples toggle)
  if (request.target === "inspector") return true;

  // RDF data that has been projected passes
  if (request.isProjected) return true;

  // Raw RDF to a renderer is blocked
  throw new Error(
    `ViewRouter: raw RDF data cannot be rendered in "${request.target}" view. ` +
      `Pass the data through a ProjectionPipeline first (R4.6).`,
  );
}
