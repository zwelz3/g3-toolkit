/**
 * RDF Graph model and ProjectionPipeline (M4.E1.T1).
 *
 * The pipeline transforms raw RDF triples into the UGM through an
 * ordered sequence of collapse steps. Each step removes a class of
 * RDF-specific patterns (rdf:type, literals, blank nodes, lists,
 * reification) and folds the information into node/edge properties.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/04-technical-projection.md R4.1
 * @see specs/09-design-decisions.md D2
 */

// @see specs/04-technical-projection.md R4.4: Holonic
// ProjectionPipeline instances are accepted as drop-in replacements
// (compatibility verified in projection.test.ts, M4.E3.T2).
import { UGM } from "../ugm";

// ── RDF Graph Model ─────────────────────────────────────────────────

export type RDFObjectType = "uri" | "literal" | "bnode";

export interface RDFTriple {
  subject: string;
  predicate: string;
  object: string;
  objectType: RDFObjectType;
  datatype?: string;
  language?: string;
}

export interface RDFGraph {
  triples: RDFTriple[];
}

// ── Well-known IRIs ─────────────────────────────────────────────────

export const RDF = {
  type: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
  first: "http://www.w3.org/1999/02/22-rdf-syntax-ns#first",
  rest: "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
  nil: "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil",
  subject: "http://www.w3.org/1999/02/22-rdf-syntax-ns#subject",
  predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate",
  object: "http://www.w3.org/1999/02/22-rdf-syntax-ns#object",
  Statement: "http://www.w3.org/1999/02/22-rdf-syntax-ns#Statement",
} as const;

// ── Pipeline ────────────────────────────────────────────────────────

/**
 * A transform step in the projection pipeline.
 * Takes an RDFGraph and returns a modified RDFGraph.
 */
export type ProjectionStep = (graph: RDFGraph) => RDFGraph;

export interface ProjectionStepConfig {
  /** Human-readable name for the step. */
  name: string;
  /** The transform function. */
  transform: ProjectionStep;
  /** Whether this step is currently enabled. */
  enabled: boolean;
}

/**
 * ProjectionPipeline: ordered sequence of collapse transforms.
 *
 * Usage:
 *   const pipeline = new ProjectionPipeline();
 *   pipeline.addStep({ name: "Type Collapse", transform: typeCollapse, enabled: true });
 *   const ugm = pipeline.project(rdfGraph);
 */
export class ProjectionPipeline {
  private readonly steps: ProjectionStepConfig[] = [];

  /** Add a step to the end of the pipeline. */
  addStep(step: ProjectionStepConfig): void {
    this.steps.push(step);
  }

  /** Get all steps (for UI display / toggling). */
  getSteps(): ReadonlyArray<ProjectionStepConfig> {
    return this.steps;
  }

  /** Enable or disable a step by name. */
  setStepEnabled(name: string, enabled: boolean): void {
    const step = this.steps.find((s) => s.name === name);
    if (step) step.enabled = enabled;
  }

  /**
   * Run all enabled steps in order, then convert the result to UGM.
   * Pre-extracts types and literal properties BEFORE collapses run,
   * so that type/property info is preserved regardless of which
   * collapses are enabled.
   */
  project(input: RDFGraph): UGM {
    // Pre-extract: collect types and properties from the FULL graph
    const preTypes = new Map<string, string[]>();
    const preProps = new Map<string, Record<string, unknown>>();

    for (const t of input.triples) {
      if (t.subject.startsWith("_:")) continue;
      if (!preTypes.has(t.subject)) preTypes.set(t.subject, []);
      if (!preProps.has(t.subject)) preProps.set(t.subject, {});

      if (t.predicate === RDF.type && t.objectType === "uri") {
        preTypes.get(t.subject)?.push(localPart(t.object));
      }
      if (t.objectType === "literal") {
        const props = preProps.get(t.subject);
        if (props)
          props[localPart(t.predicate)] = castLiteral(t.object, t.datatype);
      }
      if (
        t.objectType === "uri" &&
        !t.object.startsWith("_:") &&
        t.predicate !== RDF.type
      ) {
        if (!preTypes.has(t.object)) preTypes.set(t.object, []);
        if (!preProps.has(t.object)) preProps.set(t.object, {});
      }
    }

    // Run collapse steps to filter the triple set
    let graph = { triples: [...input.triples] };
    for (const step of this.steps) {
      if (step.enabled) {
        graph = step.transform(graph);
      }
    }

    // Build UGM from pre-extracted data + remaining triples
    const ugm = new UGM();

    for (const [id, types] of preTypes) {
      const props = preProps.get(id) ?? {};
      ugm.addNode(id, {
        types: types.length > 0 ? types : ["Resource"],
        properties: { ...props },
      });
    }

    // Add edges from remaining URI-to-URI triples
    for (const t of graph.triples) {
      if (t.subject.startsWith("_:") || t.object.startsWith("_:")) continue;
      if (t.objectType !== "uri") continue;
      // Auto-create nodes for URI objects not yet in UGM
      // (handles type class nodes when typeCollapse is off)
      if (!ugm.hasNode(t.subject)) {
        ugm.addNode(t.subject, { types: ["Resource"], properties: {} });
      }
      if (!ugm.hasNode(t.object)) {
        ugm.addNode(t.object, { types: ["Resource"], properties: {} });
      }
      ugm.addEdge(t.subject, t.object, { type: localPart(t.predicate) });
    }

    // Process synthetic literals from collapse steps (e.g. blank-node inlining)
    for (const t of graph.triples) {
      if (t.subject.startsWith("_:")) continue;
      if (t.objectType !== "literal") continue;
      if (ugm.hasNode(t.subject)) {
        const key = localPart(t.predicate);
        const existing = ugm.getNode(t.subject)?.properties;
        if (existing && !(key in existing)) {
          ugm.updateNodeProperties(t.subject, {
            [key]: castLiteral(t.object, t.datatype),
          });
        }
      }
    }

    return ugm;
  }
}

// ── Utilities ───────────────────────────────────────────────────────

/** Extract the local name from an IRI or CURIE (after last #, /, or :). */
export function localPart(iri: string): string {
  const hashIdx = iri.lastIndexOf("#");
  if (hashIdx >= 0) return iri.slice(hashIdx + 1);
  const slashIdx = iri.lastIndexOf("/");
  if (slashIdx >= 0) return iri.slice(slashIdx + 1);
  const colonIdx = iri.lastIndexOf(":");
  if (colonIdx >= 0) return iri.slice(colonIdx + 1);
  return iri;
}

/** Cast an RDF literal string to a JS value based on datatype. */
export function castLiteral(value: string, datatype?: string): unknown {
  if (!datatype) return value;
  if (
    datatype.endsWith("#integer") ||
    datatype.endsWith("#int") ||
    datatype.endsWith("#long")
  ) {
    return parseInt(value, 10);
  }
  if (
    datatype.endsWith("#float") ||
    datatype.endsWith("#double") ||
    datatype.endsWith("#decimal")
  ) {
    return parseFloat(value);
  }
  if (datatype.endsWith("#boolean")) {
    return value === "true";
  }
  return value;
}
