/**
 * Demo reasoner for the Ontology Workbench: an RDFS-plus SUBSET,
 * materialized to fixpoint. Covers, and only covers:
 *
 * - rdfs:subClassOf transitivity, plus owl:equivalentClass treated as
 *   bidirectional subclass
 * - type inheritance (x a C, C subClassOf* D => x a D)
 * - rdfs:subPropertyOf propagation
 * - rdfs:domain / rdfs:range entailment
 * - owl:inverseOf, owl:SymmetricProperty, owl:TransitiveProperty
 *   materialization
 *
 * This is NOT a DL reasoner (no restrictions, no disjointness
 * checking, no consistency); the workbench labels it as a demo
 * subset. Returns ONLY the new triples, deduplicated against the
 * asserted graph and each other, so callers can flag them as
 * inferred.
 */
import type { RDFGraph, RDFTriple } from "@g3t/core";
import {
  RDF_TYPE,
  RDFS_SUBCLASS,
  RDFS_SUBPROP,
  RDFS_DOMAIN,
  RDFS_RANGE,
  OWL_INVERSE,
  OWL_SYMMETRIC,
  OWL_TRANSITIVE,
  OWL_EQUIVALENT,
} from "./model";

const key = (t: RDFTriple): string =>
  `${t.subject}\u0000${t.predicate}\u0000${t.object}\u0000${t.objectType}`;

const uri = (s: string, p: string, o: string): RDFTriple => ({
  subject: s,
  predicate: p,
  object: o,
  objectType: "uri",
});

export function materializeInferences(graph: RDFGraph): RDFTriple[] {
  const seen = new Set(graph.triples.map(key));
  const all: RDFTriple[] = [...graph.triples];
  const inferred: RDFTriple[] = [];
  const add = (t: RDFTriple): boolean => {
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    all.push(t);
    inferred.push(t);
    return true;
  };

  for (let pass = 0; pass < 10; pass++) {
    let changed = false;

    // Schema index rebuilt per pass (subclass links can grow via
    // equivalentClass).
    const subClassOf = new Map<string, Set<string>>();
    const subPropOf = new Map<string, Set<string>>();
    const domains = new Map<string, string[]>();
    const ranges = new Map<string, string[]>();
    const inverses = new Map<string, string[]>();
    const symmetric = new Set<string>();
    const transitive = new Set<string>();
    const push = (m: Map<string, string[]>, k2: string, v: string) => {
      const arr = m.get(k2) ?? [];
      if (!arr.includes(v)) arr.push(v);
      m.set(k2, arr);
    };
    for (const t of all) {
      if (t.predicate === RDFS_SUBCLASS) {
        const s = subClassOf.get(t.subject) ?? new Set<string>();
        s.add(t.object);
        subClassOf.set(t.subject, s);
      } else if (t.predicate === OWL_EQUIVALENT) {
        changed = add(uri(t.subject, RDFS_SUBCLASS, t.object)) || changed;
        changed = add(uri(t.object, RDFS_SUBCLASS, t.subject)) || changed;
      } else if (t.predicate === RDFS_SUBPROP) {
        const s = subPropOf.get(t.subject) ?? new Set<string>();
        s.add(t.object);
        subPropOf.set(t.subject, s);
      } else if (t.predicate === RDFS_DOMAIN) {
        push(domains, t.subject, t.object);
      } else if (t.predicate === RDFS_RANGE) {
        push(ranges, t.subject, t.object);
      } else if (t.predicate === OWL_INVERSE) {
        push(inverses, t.subject, t.object);
        push(inverses, t.object, t.subject);
      } else if (t.predicate === RDF_TYPE && t.object === OWL_SYMMETRIC) {
        symmetric.add(t.subject);
      } else if (t.predicate === RDF_TYPE && t.object === OWL_TRANSITIVE) {
        transitive.add(t.subject);
      }
    }

    // subClassOf transitivity (one hop per pass; fixpoint closes it).
    for (const [c, parents] of subClassOf) {
      for (const p of parents) {
        for (const gp of subClassOf.get(p) ?? []) {
          if (gp !== c) changed = add(uri(c, RDFS_SUBCLASS, gp)) || changed;
        }
      }
    }

    // Instance-level rules over a snapshot of the current triple list.
    const snapshot = [...all];
    for (const t of snapshot) {
      if (t.predicate === RDF_TYPE && t.objectType === "uri") {
        for (const sup of subClassOf.get(t.object) ?? []) {
          changed = add(uri(t.subject, RDF_TYPE, sup)) || changed;
        }
        continue;
      }
      // Only entity-to-entity assertions drive the property rules.
      const isSchema =
        t.predicate.startsWith("http://www.w3.org/") ||
        t.predicate.startsWith("http://purl.org/dc/");
      if (isSchema) continue;

      for (const superProp of subPropOf.get(t.predicate) ?? []) {
        changed = add({ ...t, predicate: superProp }) || changed;
      }
      for (const d of domains.get(t.predicate) ?? []) {
        changed = add(uri(t.subject, RDF_TYPE, d)) || changed;
      }
      if (t.objectType === "uri") {
        for (const r of ranges.get(t.predicate) ?? []) {
          changed = add(uri(t.object, RDF_TYPE, r)) || changed;
        }
        for (const inv of inverses.get(t.predicate) ?? []) {
          changed = add(uri(t.object, inv, t.subject)) || changed;
        }
        if (symmetric.has(t.predicate)) {
          changed = add(uri(t.object, t.predicate, t.subject)) || changed;
        }
        if (transitive.has(t.predicate)) {
          for (const t2 of snapshot) {
            if (
              t2.predicate === t.predicate &&
              t2.subject === t.object &&
              t2.objectType === "uri" &&
              t2.object !== t.subject
            ) {
              changed = add(uri(t.subject, t.predicate, t2.object)) || changed;
            }
          }
        }
      }
    }

    if (!changed) break;
  }

  return inferred;
}
