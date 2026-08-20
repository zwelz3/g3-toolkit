/**
 * RDF 1.2 constellation fixture for the demo shell.
 *
 * A small spacecraft-constellation dataset expressed as RDF 1.2
 * annotation rows: each row is a quoted triple `<< s p o >>`
 * (the base fact) plus one annotation asserted about it
 * (`statedBy` / `confidence` / `recordedAt`). The last row is a
 * NESTED quoted triple — a review of another statement, whose
 * subject is itself a triple — exercising the SparqlAdapter's
 * `TripleTerm` recursion end-to-end through
 * `tripleTermToValue`.
 *
 * The two rendering projections (`projectTripleTermsAsEdges`,
 * `projectTripleTermsAsHyperarcs`) live in `@g3t/core`; this file
 * only shapes the fixture and re-exports the label helpers the
 * shell's left rail uses.
 */
import { type TripleTermAnnotation, type RdfTerm } from "@g3t/core";

export { termLabel, tripleLabel, localName } from "@g3t/core";

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

// Base facts asserted as quoted triples so they can be annotated.
const massFact = quote(uri("aquila1"), uri("hasMass"), lit("950", "decimal"));
const orbitFact = quote(uri("aquila1"), uri("orbits"), uri("earth"));
const bandFact = quote(uri("commsBus"), uri("band"), uri("kaBand"));
const portalFact = quote(uri("aquila1"), uri("relaysTo"), uri("groundOps"));

/**
 * The annotation rows. Each `<< s p o >>` picks up `statedBy` and
 * `confidence`; the mass fact also carries `recordedAt`. The last
 * row is a NESTED quoted triple — a QA review OF the mass fact's
 * confidence assertion — which exercises `TripleTerm` recursion.
 */
export const RDF12_ROWS: TripleTermAnnotation[] = [
  { stmt: massFact, ann: uri("statedBy"), val: uri("engineering") },
  { stmt: massFact, ann: uri("confidence"), val: lit("0.9", "decimal") },
  { stmt: massFact, ann: uri("recordedAt"), val: lit("2026-02-01", "date") },
  { stmt: orbitFact, ann: uri("statedBy"), val: uri("flightDynamics") },
  { stmt: orbitFact, ann: uri("confidence"), val: lit("1.0", "decimal") },
  { stmt: bandFact, ann: uri("statedBy"), val: uri("rfTeam") },
  { stmt: bandFact, ann: uri("confidence"), val: lit("0.8", "decimal") },
  { stmt: portalFact, ann: uri("statedBy"), val: uri("missionOps") },
  { stmt: portalFact, ann: uri("confidence"), val: lit("0.7", "decimal") },
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
