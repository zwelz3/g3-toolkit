/**
 * Pure derivations the biomedical shell renders from: turning a SPARQL result
 * into chart data (label plus numeric value, keyed by the row's URI so a bar
 * click can select that graph node), and summarizing the ontology (classes
 * with subclass links and instance counts, object properties, data
 * properties) for the explorer. Both are pure so they can be tested without a
 * browser.
 */
import type { RDFGraph } from "@g3t/core";
import { RDF_TYPE, RDFS_LABEL, RDFS_SUBCLASS, shorten, localName } from "./rdf";
import { termText, termNumber, type SparqlResult } from "./sparql";
import type { NamedQuery } from "./queries";

const RDFS_CLASS = "http://www.w3.org/2000/01/rdf-schema#Class";

export interface ChartDatum {
  /** URI of the labeled entity, used to select the matching graph node. */
  id: string;
  label: string;
  value: number;
}

/** Rows of a numeric SELECT become chart data; non-numeric rows are dropped. */
export function resultToChartData(
  result: SparqlResult,
  chart: NamedQuery["chart"],
): ChartDatum[] {
  if (!result.ok || !chart) return [];
  const out: ChartDatum[] = [];
  for (const row of result.rows) {
    const labelTerm = row[chart.labelVar];
    const valueTerm = row[chart.valueVar];
    if (!labelTerm || !valueTerm) continue;
    const value = termNumber(valueTerm);
    if (value === undefined) continue;
    const id = termText(labelTerm);
    out.push({ id, label: localName(id), value });
  }
  return out;
}

export interface OntologyClass {
  iri: string;
  label: string;
  subClassOf?: string;
  instances: number;
}
export interface OntologyProperty {
  iri: string;
  label: string;
  /** Classes seen as subjects / objects of this predicate in the data. */
  domain: string[];
  range: string[];
}
export interface OntologySummary {
  classes: OntologyClass[];
  objectProperties: OntologyProperty[];
  dataProperties: OntologyProperty[];
}

/** Summarize TBox + predicate usage for the ontology explorer. */
export function ontologySummary(graph: RDFGraph): OntologySummary {
  const classIris = new Set<string>();
  const subClassOf = new Map<string, string>();
  const labels = new Map<string, string>();
  const typeOf = new Map<string, string>(); // instance -> class
  const instanceCount = new Map<string, number>();

  for (const t of graph.triples) {
    if (t.predicate === RDF_TYPE && t.object === RDFS_CLASS)
      classIris.add(t.subject);
    else if (t.predicate === RDFS_SUBCLASS) subClassOf.set(t.subject, t.object);
    else if (t.predicate === RDFS_LABEL) labels.set(t.subject, t.object);
  }
  for (const t of graph.triples) {
    if (t.predicate === RDF_TYPE && classIris.has(t.object)) {
      typeOf.set(t.subject, t.object);
      instanceCount.set(t.object, (instanceCount.get(t.object) ?? 0) + 1);
    }
  }

  const classes: OntologyClass[] = [...classIris]
    .filter((iri) => iri !== "http://www.w3.org/2000/01/rdf-schema#Class")
    .map((iri) => ({
      iri,
      label: labels.get(iri) ?? localName(iri),
      subClassOf: subClassOf.get(iri),
      instances: instanceCount.get(iri) ?? 0,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Predicate usage over instance data (skip TBox and label predicates).
  const objByPred = new Map<
    string,
    { domain: Set<string>; range: Set<string> }
  >();
  const dataByPred = new Map<string, { domain: Set<string> }>();
  const skip = new Set([RDF_TYPE, RDFS_LABEL, RDFS_SUBCLASS]);

  for (const t of graph.triples) {
    if (skip.has(t.predicate)) continue;
    const subjClass = typeOf.get(t.subject);
    if (t.objectType === "uri") {
      const objClass = typeOf.get(t.object);
      if (!subjClass || !objClass) continue;
      const entry = objByPred.get(t.predicate) ?? {
        domain: new Set(),
        range: new Set(),
      };
      entry.domain.add(subjClass);
      entry.range.add(objClass);
      objByPred.set(t.predicate, entry);
    } else {
      if (!subjClass) continue;
      const entry = dataByPred.get(t.predicate) ?? { domain: new Set() };
      entry.domain.add(subjClass);
      dataByPred.set(t.predicate, entry);
    }
  }

  const shortClasses = (s: Set<string>) =>
    [...s].map((c) => localName(c)).sort();
  const objectProperties: OntologyProperty[] = [...objByPred.entries()]
    .map(([iri, u]) => ({
      iri,
      label: localName(iri),
      domain: shortClasses(u.domain),
      range: shortClasses(u.range),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const dataProperties: OntologyProperty[] = [...dataByPred.entries()]
    .map(([iri, u]) => ({
      iri,
      label: localName(iri),
      domain: shortClasses(u.domain),
      range: [],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return { classes, objectProperties, dataProperties };
}

export { shorten };
