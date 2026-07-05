/**
 * Workbench projections from the OntologyStore into UGMs the toolkit
 * views consume.
 *
 * - classHierarchyUgm: classes + subClassOf edges; equivalence- and
 *   transitivity-derived subclass edges carry meta.asserted=false, so
 *   the canvas renders them dashed (the toolkit's D9 convention).
 * - instancesUgm: individuals + their object-property assertions;
 *   node types are the FULL class IRIs (types[0] = primary class), so
 *   the default palette colors by class and SHACL targetClass
 *   matching works on the same UGM. Literal assertions land in
 *   properties keyed BOTH by full predicate IRI (validator paths) and
 *   by short local name (table readability).
 * - neighborhoodUgm: k-hop BFS subgraph around a focus node.
 */
import { UGM } from "@g3t/core";
import type { RDFTriple } from "@g3t/core";
import { NS, RDF_TYPE, RDFS_SUBCLASS, shorten } from "./model";
import type { OntologyStore } from "./store";

const local = (iri: string): string => shorten(iri).replace(/^ex:/, "");

export function classHierarchyUgm(
  store: OntologyStore,
  includeInferred: boolean,
): UGM {
  const ugm = new UGM();
  const classes = store.entities("Class");
  for (const c of classes) {
    ugm.addNode(c.iri, {
      types: ["Class"],
      properties: { name: c.label, kind: "Class", iri: c.iri },
    });
  }
  const have = new Set(classes.map((c) => c.iri));
  const seen = new Set<string>();
  for (const t of store.graph(includeInferred).triples) {
    if (t.predicate !== RDFS_SUBCLASS) continue;
    if (!have.has(t.subject) || !have.has(t.object)) continue;
    const k = `${t.subject}>${t.object}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const inferred = store.isInferred(t);
    if (inferred && !includeInferred) continue;
    ugm.addEdge(t.subject, t.object, {
      type: "subClassOf",
      asserted: !inferred,
    });
  }
  return ugm;
}

export function instancesUgm(
  store: OntologyStore,
  includeInferred: boolean,
  scopeClass: string | null,
): UGM {
  const ugm = new UGM();
  let individuals = store.entities("Individual");
  if (scopeClass !== null) {
    const inScope = new Set(store.instancesOf(scopeClass).map((i) => i.iri));
    individuals = individuals.filter((i) => inScope.has(i.iri));
  }
  const included = new Set(individuals.map((i) => i.iri));

  for (const i of individuals) {
    const types = store
      .typesOf(i.iri)
      .filter((t) => includeInferred || !t.inferred)
      .map((t) => t.iri);
    const properties: Record<string, unknown> = {
      name: i.label,
      kind: "Individual",
      iri: i.iri,
    };
    // Literal assertions: full-IRI key for the SHACL validator, local
    // key for the table. Multi-valued object properties are collected
    // below as arrays under their full IRI.
    const objectValues = new Map<string, string[]>();
    for (const t of store.about(i.iri)) {
      if (!t.predicate.startsWith(NS.ex)) continue;
      if (!includeInferred && store.isInferred(t)) continue;
      if (t.objectType === "literal") {
        const num = Number(t.object);
        const value =
          t.datatype?.endsWith("decimal") === true && Number.isFinite(num)
            ? num
            : t.object;
        properties[t.predicate] = value;
        properties[local(t.predicate)] = value;
      } else if (t.objectType === "uri") {
        const arr = objectValues.get(t.predicate) ?? [];
        arr.push(t.object);
        objectValues.set(t.predicate, arr);
      }
    }
    for (const [p, vals] of objectValues) {
      properties[p] = vals.length === 1 ? vals[0] : vals;
    }
    ugm.addNode(i.iri, {
      types: types.length > 0 ? types : ["untyped"],
      properties,
    });
  }

  for (const t of store.graph(includeInferred).triples) {
    if (t.objectType !== "uri") continue;
    if (!t.predicate.startsWith(NS.ex)) continue;
    if (t.predicate === RDF_TYPE) continue;
    if (!included.has(t.subject) || !included.has(t.object)) continue;
    ugm.addEdge(t.subject, t.object, {
      type: local(t.predicate),
      asserted: !store.isInferred(t),
    });
  }
  return ugm;
}

/** k-hop BFS subgraph of `base` around `focusId`. */
export function neighborhoodUgm(base: UGM, focusId: string, hops: number): UGM {
  const out = new UGM();
  if (!base.hasNode(focusId)) return out;
  const keep = new Set<string>([focusId]);
  let frontier = [focusId];
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of base.getNeighbors(id)) {
        if (!keep.has(n)) {
          keep.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  base.forEachNode((id, attrs) => {
    if (keep.has(id))
      out.addNode(id, { types: attrs.types, properties: attrs.properties });
  });
  base.forEachEdge((_eid, attrs, source, target) => {
    if (keep.has(source) && keep.has(target)) {
      out.addEdge(source, target, {
        type: attrs.type,
        asserted: attrs.meta.asserted ?? true,
        properties: attrs.properties,
      });
    }
  });
  return out;
}

/** Distinct literal/short property keys usable as a color-by driver. */
export function colorByCandidates(ugm: UGM): string[] {
  const keys = new Set<string>();
  ugm.forEachNode((_id, attrs) => {
    for (const [k, v] of Object.entries(attrs.properties)) {
      if (k.startsWith("http")) continue;
      if (k === "name" || k === "iri" || k === "kind") continue;
      if (typeof v === "string" || typeof v === "number") keys.add(k);
    }
  });
  return [...keys].sort();
}

/** Rough triple-count sanity value used by the header chips. */
export function tripleCount(triples: RDFTriple[]): number {
  return triples.length;
}
