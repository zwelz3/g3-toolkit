/**
 * RDF Collapse Transforms (M4.E2.T1-T5).
 *
 * Each transform removes a class of RDF-specific triple patterns
 * and folds the information into simpler structures that the
 * pipeline's rdfToUGM converter handles.
 *
 * @see specs/04-technical-projection.md R4.2
 */

import type { RDFGraph, RDFTriple, ProjectionStep } from "./pipeline";
import { RDF } from "./pipeline";

/**
 * T1: Type Collapse.
 * Removes rdf:type triples. The pipeline's rdfToUGM step reads
 * remaining rdf:type triples to build the types array, so this
 * transform is a no-op filter (types are handled natively).
 * However, it removes rdf:type from being rendered as an edge.
 *
 * When DISABLED, rdf:type triples become visible edges in the canvas.
 */
export const typeCollapse: ProjectionStep = (graph: RDFGraph): RDFGraph => {
  // Remove rdf:type triples; they'll be handled by rdfToUGM
  // as the types array on each node.
  return {
    triples: graph.triples.filter((t) => t.predicate !== RDF.type),
  };
};

/**
 * T2: Literal Collapse.
 * Removes triples where the object is a literal. These become
 * properties on the subject node (handled by rdfToUGM).
 *
 * When DISABLED, literals remain as separate nodes connected
 * by their predicate edge.
 */
export const literalCollapse: ProjectionStep = (graph: RDFGraph): RDFGraph => {
  // Remove literal-object triples on named resources only.
  // Preserve blank-node-subject literals so structural collapses
  // (BNode, List, Reification) can still read them.
  return {
    triples: graph.triples.filter(
      (t) => t.objectType !== "literal" || t.subject.startsWith("_:"),
    ),
  };
};

/**
 * T3: Blank-Node Resolution.
 * Inlines blank nodes as nested property objects on the nearest
 * named resource. Blank node triples are removed; their properties
 * are attached to the parent as nested objects.
 */
export const blankNodeCollapse: ProjectionStep = (
  graph: RDFGraph,
): RDFGraph => {
  // Identify blank nodes (subjects starting with _:)
  const blankNodes = new Set<string>();
  for (const t of graph.triples) {
    if (t.subject.startsWith("_:")) blankNodes.add(t.subject);
    if (t.object.startsWith("_:") && t.objectType !== "literal")
      blankNodes.add(t.object);
  }

  if (blankNodes.size === 0) return graph;

  // Collect properties of blank nodes
  const bnodeProps = new Map<string, Record<string, unknown>>();
  for (const t of graph.triples) {
    if (blankNodes.has(t.subject)) {
      if (!bnodeProps.has(t.subject)) bnodeProps.set(t.subject, {});
      const props = bnodeProps.get(t.subject)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      const key = t.predicate.split(/[#/]/).pop() ?? t.predicate;
      props[key] = t.objectType === "literal" ? t.object : t.object;
    }
  }

  // Find parent references (named resource → blank node)
  const parentRefs = new Map<string, { parent: string; predicate: string }>();
  for (const t of graph.triples) {
    if (
      !t.subject.startsWith("_:") &&
      blankNodes.has(t.object) &&
      t.objectType !== "literal"
    ) {
      parentRefs.set(t.object, { parent: t.subject, predicate: t.predicate });
    }
  }

  // Create synthetic literal triples for blank node properties on parent
  const syntheticTriples: RDFTriple[] = [];
  for (const [bnodeId, ref] of parentRefs) {
    const props = bnodeProps.get(bnodeId);
    if (props) {
      syntheticTriples.push({
        subject: ref.parent,
        predicate: ref.predicate,
        object: JSON.stringify(props),
        objectType: "literal",
        datatype: "http://www.w3.org/2001/XMLSchema#string",
      });
      // Also add individual properties under a namespace
      for (const [key, value] of Object.entries(props)) {
        syntheticTriples.push({
          subject: ref.parent,
          predicate: `${ref.predicate}/${key}`,
          object: String(value),
          objectType: "literal",
        });
      }
    }
  }

  // Remove all triples involving blank nodes; add synthetics
  const filtered = graph.triples.filter(
    (t) => !blankNodes.has(t.subject) && !blankNodes.has(t.object),
  );

  return { triples: [...filtered, ...syntheticTriples] };
};

/**
 * T4: List Resolution.
 * rdf:first/rdf:rest chains become ordered arrays on the parent.
 */
export const listCollapse: ProjectionStep = (graph: RDFGraph): RDFGraph => {
  // Find list head nodes (objects of triples whose object type is bnode/uri
  // and which have rdf:first)
  const hasFirst = new Set<string>();
  const firstValues = new Map<string, string>();
  const restPointers = new Map<string, string>();

  for (const t of graph.triples) {
    if (t.predicate === RDF.first) {
      hasFirst.add(t.subject);
      firstValues.set(t.subject, t.object);
    }
    if (t.predicate === RDF.rest) {
      restPointers.set(t.subject, t.object);
    }
  }

  if (hasFirst.size === 0) return graph;

  // Find list heads (linked to by a non-rdf predicate)
  const listRoots = new Map<
    string,
    { parent: string; predicate: string; headNode: string }
  >();
  for (const t of graph.triples) {
    if (
      t.predicate !== RDF.first &&
      t.predicate !== RDF.rest &&
      hasFirst.has(t.object)
    ) {
      listRoots.set(t.object, {
        parent: t.subject,
        predicate: t.predicate,
        headNode: t.object,
      });
    }
  }

  // Traverse each list to build arrays
  const listNodes = new Set<string>();
  const syntheticTriples: RDFTriple[] = [];

  for (const [headNode, info] of listRoots) {
    const items: string[] = [];
    let current: string | undefined = headNode;

    while (current && current !== RDF.nil) {
      listNodes.add(current);
      const val = firstValues.get(current);
      if (val !== undefined) items.push(val);
      current = restPointers.get(current);
    }

    // Create synthetic literal with the array
    syntheticTriples.push({
      subject: info.parent,
      predicate: info.predicate,
      object: JSON.stringify(items),
      objectType: "literal",
      datatype: "http://www.w3.org/2001/XMLSchema#string",
    });
  }

  // Remove list-related triples
  const filtered = graph.triples.filter(
    (t) =>
      !listNodes.has(t.subject) &&
      !listNodes.has(t.object) &&
      t.predicate !== RDF.first &&
      t.predicate !== RDF.rest,
  );

  return { triples: [...filtered, ...syntheticTriples] };
};

/**
 * T5: Reification / RDF* Collapse.
 * Reified statements (rdf:Statement with rdf:subject/predicate/object)
 * and any associated metadata (confidence, provenance) are collapsed
 * into edge metadata on the original triple.
 *
 * The transform removes the reification triples and annotates the
 * original triple (if found) with metadata properties.
 */
export const reificationCollapse: ProjectionStep = (
  graph: RDFGraph,
): RDFGraph => {
  // Find reified statements
  const stmtSubjects = new Map<string, string>();
  const stmtPredicates = new Map<string, string>();
  const stmtObjects = new Map<string, string>();
  const stmtMeta = new Map<string, Record<string, string>>();
  const reificationNodes = new Set<string>();

  for (const t of graph.triples) {
    if (t.predicate === RDF.type && t.object === RDF.Statement) {
      reificationNodes.add(t.subject);
      if (!stmtMeta.has(t.subject)) stmtMeta.set(t.subject, {});
    }
  }

  for (const t of graph.triples) {
    if (!reificationNodes.has(t.subject)) continue;

    if (t.predicate === RDF.subject) {
      stmtSubjects.set(t.subject, t.object);
    } else if (t.predicate === RDF.predicate) {
      stmtPredicates.set(t.subject, t.object);
    } else if (t.predicate === RDF.object) {
      stmtObjects.set(t.subject, t.object);
    } else if (t.predicate !== RDF.type) {
      // Any other predicate on the statement node is metadata
      const meta = stmtMeta.get(t.subject) ?? {};
      const key = t.predicate.split(/[#/]/).pop() ?? t.predicate;
      meta[key] = t.object;
      stmtMeta.set(t.subject, meta);
    }
  }

  // Build synthetic triples with metadata annotations
  const syntheticTriples: RDFTriple[] = [];
  for (const [stmtNode, meta] of stmtMeta) {
    const s = stmtSubjects.get(stmtNode);
    const p = stmtPredicates.get(stmtNode);
    const o = stmtObjects.get(stmtNode);

    if (s && p && o) {
      // Add metadata as literal triples on the subject
      for (const [key, value] of Object.entries(meta)) {
        syntheticTriples.push({
          subject: s,
          predicate: `urn:g3t:edge-meta:${p.split(/[#/]/).pop() ?? p}:${key}`,
          object: value,
          objectType: "literal",
        });
      }
    }
  }

  // Remove all reification triples
  const filtered = graph.triples.filter(
    (t) => !reificationNodes.has(t.subject) && !reificationNodes.has(t.object),
  );

  return { triples: [...filtered, ...syntheticTriples] };
};
