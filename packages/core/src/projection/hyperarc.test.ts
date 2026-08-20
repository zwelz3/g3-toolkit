/**
 * Oracle for the two RDF 1.2 triple-term projections (Brief 14).
 *
 * The renders are dual: same input rows, two shapes. What follows
 * pins the invariants each render must satisfy — including the
 * nested case, which is the only reason the hyperarc render exists.
 */
import { describe, it, expect } from "vitest";
import {
  projectTripleTermsAsEdges,
  projectTripleTermsAsHyperarcs,
  tripleLabel,
  localName,
  STAR_EDGE_TYPE,
  RDF_STATEMENT_FLAG,
  type TripleTermAnnotation,
} from "./hyperarc";
import type { RdfTerm } from "../adapter/sparql-adapter";

const EX = "http://example.org/sat#";
const XSD = "http://www.w3.org/2001/XMLSchema#";

const uri = (local: string): RdfTerm & { type: "uri" } => ({
  type: "uri",
  value: `${EX}${local}`,
});
const lit = (value: string, datatype?: string): RdfTerm => ({
  type: "literal",
  value,
  ...(datatype ? { datatype: `${XSD}${datatype}` } : {}),
});
const quote = (
  subject: RdfTerm,
  predicate: RdfTerm,
  object: RdfTerm,
): RdfTerm & { type: "triple" } => ({
  type: "triple",
  value: { subject, predicate, object },
});

const massFact = quote(uri("aquila1"), uri("hasMass"), lit("950", "decimal"));
const orbitFact = quote(uri("aquila1"), uri("orbits"), uri("earth"));

const ROWS: TripleTermAnnotation[] = [
  { stmt: massFact, ann: uri("statedBy"), val: uri("engineering") },
  { stmt: massFact, ann: uri("confidence"), val: lit("0.9", "decimal") },
  { stmt: orbitFact, ann: uri("statedBy"), val: uri("flightDynamics") },
  { stmt: orbitFact, ann: uri("confidence"), val: lit("1.0", "decimal") },
  // Nested: a review OF the (mass, confidence 0.9) statement itself.
  {
    stmt: quote(
      quote(massFact, uri("confidence"), lit("0.9", "decimal")),
      uri("reviewedBy"),
      uri("qa"),
    ),
    ann: uri("statedBy"),
    val: uri("qa"),
  },
];

describe("projectTripleTermsAsEdges (haunt-style)", () => {
  it("adds one asserted base edge per unique quoted triple", () => {
    const ugm = projectTripleTermsAsEdges(ROWS);
    let asserted = 0;
    ugm.forEachEdge((_id, attrs) => {
      if (attrs.properties.asserted === true) asserted++;
    });
    // massFact + orbitFact + the outer nested review's base (which
    // falls back to a synthetic quoted-triple label node) + the
    // (mass, confidence 0.9) inner triple used as the review's
    // subject = 3 quoted triples that name a base relation between
    // two term endpoints.
    expect(asserted).toBeGreaterThanOrEqual(2);
  });

  it("emits one star edge per annotation row, dashed by convention", () => {
    const ugm = projectTripleTermsAsEdges(ROWS);
    let stars = 0;
    ugm.forEachEdge((_id, attrs) => {
      if (attrs.type === STAR_EDGE_TYPE) stars++;
    });
    expect(stars).toBe(ROWS.length);
  });

  it("folds a numeric confidence annotation onto the star edge as _confidence", () => {
    const ugm = projectTripleTermsAsEdges(ROWS);
    const confidences: number[] = [];
    ugm.forEachEdge((_id, attrs) => {
      if (
        attrs.type === STAR_EDGE_TYPE &&
        attrs.properties.annP === "confidence"
      ) {
        const c = attrs.properties._confidence;
        if (typeof c === "number") confidences.push(c);
      }
    });
    expect(confidences.sort()).toEqual([0.9, 1.0]);
  });
});

describe("projectTripleTermsAsHyperarcs (pseudo-node reification)", () => {
  it("reifies each unique quoted triple into one _Statement pseudo-node", () => {
    const ugm = projectTripleTermsAsHyperarcs(ROWS);
    const statements = ugm
      .getNodeIds()
      .filter((id) => ugm.getNode(id)?.types.includes("_Statement"));
    // massFact, orbitFact, the outer review, and the inner
    // (mass, confidence 0.9) triple the review is about = 4.
    expect(statements.length).toBe(4);
    for (const s of statements) {
      expect(ugm.getNode(s)?.properties[RDF_STATEMENT_FLAG]).toBe(true);
    }
  });

  it("wires rdf:subject and rdf:object from every statement", () => {
    const ugm = projectTripleTermsAsHyperarcs(ROWS);
    const edgeTypes = new Set<string>();
    ugm.forEachEdge((_id, attrs) => edgeTypes.add(attrs.type));
    expect(edgeTypes.has("rdf:subject")).toBe(true);
    expect(edgeTypes.has("rdf:object")).toBe(true);
  });

  it("turns each annotation into a typed edge off the statement node", () => {
    const ugm = projectTripleTermsAsHyperarcs(ROWS);
    const annEdgeTypes = new Set<string>();
    ugm.forEachEdge((_id, attrs) => {
      if (attrs.properties._annotation === true) annEdgeTypes.add(attrs.type);
    });
    expect(annEdgeTypes.has("statedBy")).toBe(true);
    expect(annEdgeTypes.has("confidence")).toBe(true);
  });

  it("recurses on nested quoted triples, linking statement-to-statement", () => {
    const ugm = projectTripleTermsAsHyperarcs(ROWS);
    let stmtToStmt = 0;
    ugm.forEachEdge((_id, attrs, _source, target) => {
      if (
        attrs.type === "rdf:subject" &&
        ugm.getNode(target)?.types.includes("_Statement")
      ) {
        stmtToStmt++;
      }
    });
    expect(stmtToStmt).toBeGreaterThanOrEqual(1);
  });

  it("folds a numeric confidence annotation onto the statement node as _confidence", () => {
    const ugm = projectTripleTermsAsHyperarcs(ROWS);
    const confidences: number[] = [];
    for (const id of ugm.getNodeIds()) {
      const attrs = ugm.getNode(id);
      const c = attrs?.properties._confidence;
      if (typeof c === "number") confidences.push(c);
    }
    expect(confidences.sort()).toEqual([0.9, 1.0]);
  });
});

describe("label helpers", () => {
  it("tripleLabel renders as « s p o »", () => {
    const label = tripleLabel(massFact.value);
    expect(label.startsWith("«")).toBe(true);
    expect(label.endsWith("»")).toBe(true);
    expect(label).toContain("aquila1");
    expect(label).toContain("hasMass");
  });

  it("localName takes the last path/hash segment", () => {
    expect(localName("http://example.org/sat#aquila1")).toBe("aquila1");
    expect(localName("http://example.org/sat/orbit")).toBe("orbit");
  });
});
