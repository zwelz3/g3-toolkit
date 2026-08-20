/**
 * RDF 1.2 triple-term hyperarc projections (Brief 14).
 *
 * A "hyperarc" here is a fact ABOUT a fact: an RDF 1.2 quoted triple
 * `<< s p o >>` carrying annotation edges (who stated it, how
 * confident, when recorded). RDF 1.2 has no single graph rendering for
 * a quoted triple, so this module offers TWO pure UGM projections,
 * both taking the same annotation-row input:
 *
 * - `projectTripleTermsAsEdges` (haunt g-xplore style): each annotation
 *   becomes one dashed `star` edge from the base subject to the base
 *   object, with `asserted:false` and the annotation predicate/value
 *   in edge properties. Low visual clutter; the natural default when
 *   subject and object are both real nodes.
 * - `projectTripleTermsAsHyperarcs` (holon-shaped pseudo-node):
 *   each unique `<< s p o >>` reifies to a diamond `_Statement`
 *   pseudo-node linked to its subject/object terms with rdf:subject
 *   and rdf:object; annotations fan out as typed edges from the
 *   statement. This is the only render that survives NESTING
 *   (`<< << s p o >> p2 o2 >>` — a triple whose subject is itself a
 *   triple), since a UGM edge cannot have an edge as an endpoint.
 *
 * Both preserve a numeric `confidence` annotation as `_confidence` on
 * the projected artifact (star edge or statement node) so the field
 * can drive `[_confidence]`-scoped opacity in a consuming stylesheet.
 *
 * Nesting recursion: a subject or object that IS a triple term
 * recurses through the same projector, so a nested annotation lands
 * as a statement-to-statement rdf:subject edge in the hyperarc
 * render; the edge render, which cannot express that shape, falls
 * back to a self-edge on a synthetic label node — the visible cost
 * that makes the pedagogical tradeoff between the two renders
 * concrete.
 */

import { UGM } from "../ugm";
import {
  tripleTermToValue,
  type RdfTerm,
  type TripleTerm,
} from "../adapter/sparql-adapter";

/** Property key marking a reified RDF 1.2 statement pseudo-node. */
export const RDF_STATEMENT_FLAG = "_rdfStatement";

/** Edge type stamped on the haunt-style annotation edge. */
export const STAR_EDGE_TYPE = "star";

/**
 * One row of triple-term data: a quoted triple `<< s p o >>` plus one
 * annotation asserted about it. Multiple annotations on the same base
 * triple appear as multiple rows sharing `stmt`.
 */
export interface TripleTermAnnotation {
  /** The base triple being annotated. */
  stmt: RdfTerm & { type: "triple" };
  /** The annotation predicate; a URI term. */
  ann: RdfTerm & { type: "uri" };
  /** The annotation value; any term. */
  val: RdfTerm;
}

/** Local name after the last `#` or `/`, else the whole value. */
export function localName(iri: string): string {
  const m = /[#/]([^#/]+)$/.exec(iri);
  return m && m[1] ? m[1] : iri;
}

/** Human label for a term: local name (URI), quoted `« s p o »`
 *  (triple), or the literal/bnode value. */
export function termLabel(term: RdfTerm): string {
  if (term.type === "uri") return localName(term.value);
  if (term.type === "triple") return tripleLabel(term.value);
  return term.value;
}

/** Render a triple term as `« s p o »` for compact display. */
export function tripleLabel(tt: TripleTerm): string {
  return `« ${termLabel(tt.subject)} ${termLabel(tt.predicate)} ${termLabel(
    tt.object,
  )} »`;
}

/** Stable structural key for a triple term via the library's own
 *  JSON projection (recurses through nested triples). */
function tripleKey(tt: TripleTerm): string {
  return JSON.stringify(tripleTermToValue(tt));
}

/** Parse a literal's value as a number, or NaN if it isn't numeric. */
function tryNumber(term: RdfTerm): number {
  if (term.type !== "literal") return Number.NaN;
  const n = Number(term.value);
  return Number.isFinite(n) ? n : Number.NaN;
}

// ── Edge render (haunt-style dashed annotation edges) ─────────────────

/**
 * Project each annotation row to a dashed `star` edge running from the
 * base triple's subject to its object. Assertion of the base triple
 * itself is added once per unique `<< s p o >>` as an ordinary
 * `asserted:true` edge; annotations layer on top as parallel `star`
 * edges labeled by the annotation predicate.
 *
 * When the base predicate is itself a triple term, or the base
 * subject/object is a literal, the row falls back to a synthetic
 * label node so the row is not silently dropped — the visible tell
 * that this render cannot express those shapes (use the hyperarc
 * projection when it matters).
 */
export function projectTripleTermsAsEdges(rows: TripleTermAnnotation[]): UGM {
  const ugm = new UGM();
  const assertedKeys = new Set<string>();

  const ensureUriNode = (iri: string): string => {
    const id = localName(iri);
    if (!ugm.hasNode(id)) {
      ugm.addNode(id, { types: ["Resource"], properties: { name: id } });
    }
    return id;
  };

  const ensureLiteralNode = (term: RdfTerm & { type: "literal" }): string => {
    const id = `lit:${term.value}`;
    if (!ugm.hasNode(id)) {
      ugm.addNode(id, {
        types: ["_Literal"],
        properties: {
          name: term.value,
          _literal: true,
          ...(term.datatype ? { datatype: localName(term.datatype) } : {}),
        },
      });
    }
    return id;
  };

  const ensureTermEndpoint = (term: RdfTerm): string => {
    if (term.type === "uri") return ensureUriNode(term.value);
    if (term.type === "literal") return ensureLiteralNode(term);
    if (term.type === "bnode") {
      const id = `_:${term.value}`;
      if (!ugm.hasNode(id)) {
        ugm.addNode(id, {
          types: ["_Bnode"],
          properties: { name: term.value },
        });
      }
      return id;
    }
    // Triple-typed endpoint: fall back to a synthetic label node so
    // the row surfaces the shape this render cannot express.
    const id = `qt:${tripleKey(term.value)}`;
    if (!ugm.hasNode(id)) {
      ugm.addNode(id, {
        types: ["_QuotedTriple"],
        properties: { name: tripleLabel(term.value), _quotedTriple: true },
      });
    }
    return id;
  };

  for (const row of rows) {
    const tt = row.stmt.value;
    const sId = ensureTermEndpoint(tt.subject);
    const oId = ensureTermEndpoint(tt.object);
    const predLabel =
      tt.predicate.type === "uri"
        ? localName(tt.predicate.value)
        : termLabel(tt.predicate);

    // Assert the base triple once per unique statement key.
    const key = tripleKey(tt);
    if (!assertedKeys.has(key)) {
      ugm.addEdge(sId, oId, {
        type: predLabel,
        properties: { asserted: true },
      });
      assertedKeys.add(key);
    }

    const annP = localName(row.ann.value);
    const annV = termLabel(row.val);
    const props: Record<string, unknown> = {
      asserted: false,
      annP,
      annV,
    };
    const n = tryNumber(row.val);
    if (annP === "confidence" && Number.isFinite(n)) props._confidence = n;

    ugm.addEdge(sId, oId, {
      type: STAR_EDGE_TYPE,
      properties: props,
    });
  }

  return ugm;
}

// ── Hyperarc render (statement pseudo-node, holon-shaped) ─────────────

/**
 * Project each unique quoted triple to a diamond `_Statement`
 * pseudo-node carrying `_rdfStatement:true`, rdf:subject and
 * rdf:object edges to its endpoints (recursing into nested triples),
 * and one typed annotation edge per row. A `confidence` annotation
 * with a numeric value is folded onto the statement node as
 * `_confidence`, so a `[_confidence]`-scoped stylesheet rule can
 * drive opacity uniformly with the edge render.
 *
 * Nested `<< << s p o >> p2 o2 >>` recurses: the outer statement's
 * rdf:subject edge lands on the INNER statement node, so a nested
 * annotation reads as statement-to-statement — the shape the edge
 * render cannot express.
 */
export function projectTripleTermsAsHyperarcs(
  rows: TripleTermAnnotation[],
): UGM {
  const ugm = new UGM();
  const stmtIds = new Map<string, string>();
  let stmtSeq = 0;

  const ensureTermNode = (term: RdfTerm): string => {
    if (term.type === "triple") return ensureStatement(term.value);
    if (term.type === "literal") {
      const id = `lit:${term.value}`;
      if (!ugm.hasNode(id)) {
        ugm.addNode(id, {
          types: ["_Literal"],
          properties: {
            name: term.value,
            _literal: true,
            ...(term.datatype ? { datatype: localName(term.datatype) } : {}),
          },
        });
      }
      return id;
    }
    // uri or bnode: local name for URIs, `_:<label>` for blanks.
    const id =
      term.type === "bnode" ? `_:${term.value}` : localName(term.value);
    if (!ugm.hasNode(id)) {
      ugm.addNode(id, {
        types: [term.type === "bnode" ? "_Bnode" : "Resource"],
        properties: { name: id },
      });
    }
    return id;
  };

  function ensureStatement(tt: TripleTerm): string {
    const key = tripleKey(tt);
    const existing = stmtIds.get(key);
    if (existing) return existing;

    const id = `stmt:${stmtSeq++}`;
    stmtIds.set(key, id);
    ugm.addNode(id, {
      types: ["_Statement"],
      properties: {
        name: tripleLabel(tt),
        [RDF_STATEMENT_FLAG]: true,
        subject: termLabel(tt.subject),
        predicate: termLabel(tt.predicate),
        object: termLabel(tt.object),
      },
    });

    ugm.addEdge(id, ensureTermNode(tt.subject), {
      type: "rdf:subject",
      properties: {},
    });
    ugm.addEdge(id, ensureTermNode(tt.object), {
      type: "rdf:object",
      properties: { predicate: termLabel(tt.predicate) },
    });
    return id;
  }

  for (const row of rows) {
    const stmtId = ensureStatement(row.stmt.value);
    const valueId = ensureTermNode(row.val);
    const annP = localName(row.ann.value);
    ugm.addEdge(stmtId, valueId, {
      type: annP,
      properties: { _annotation: true, annP, annV: termLabel(row.val) },
    });
    const n = tryNumber(row.val);
    if (annP === "confidence" && Number.isFinite(n)) {
      ugm.updateNodeProperties(stmtId, { _confidence: n });
    }
  }

  return ugm;
}
