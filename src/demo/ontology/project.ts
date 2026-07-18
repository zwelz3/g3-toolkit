/**
 * Workbench projections from the OntologyStore into UGMs.
 *
 * Display and validation are SEPARATE models (review finding: mixing
 * them made the closed-shape check flag synthetic display keys like
 * `name`/`kind`/`iri` and duplicate local-name properties, and it
 * polluted TableView columns with full IRIs):
 *
 * - instancesUgm (display): node types are full class IRIs (stable
 *   palette + SHACL target matching for decorations), but properties
 *   are pithy display keys only (name, type, local-name literals).
 *   Never fed to the validator.
 * - validationUgm: properties keyed ONLY by full predicate IRIs,
 *   values shaped for the core validator (numbers parsed, object
 *   properties as IRI or IRI[]). Never rendered.
 * - classHierarchyUgm: classes + subClassOf edges; inferred edges are
 *   dashed (meta.asserted=false). An owl:equivalentClass pair renders
 *   as ONE `equivalentClass` edge; the reasoner's mutual subClassOf
 *   encoding of equivalence is suppressed here because it reads as
 *   taxonomy noise (review finding).
 * - neighborhoodUgm: k-hop BFS subgraph around a focus node.
 */
import { UGM } from "@g3t/core";
import {
  NS,
  RDF_TYPE,
  RDFS_SUBCLASS,
  RDFS_LABEL,
  OWL_EQUIVALENT,
  shorten,
} from "./model";
import type { OntologyStore } from "./store";

/** Local name for display (exported for the 5.18 dock's id
 *  formatter; one definition, one truncation policy). */
export const local = (iri: string): string => shorten(iri).replace(/^ex:/, "");

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

  // Asserted equivalence pairs: rendered once as their own edge type;
  // subclass edges between the pair (the reasoner's encoding of
  // equivalence) are suppressed in this view.
  const equivalentPairs = new Set<string>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const t of store.asserted) {
    if (t.predicate !== OWL_EQUIVALENT) continue;
    if (!have.has(t.subject) || !have.has(t.object)) continue;
    if (equivalentPairs.has(pairKey(t.subject, t.object))) continue;
    equivalentPairs.add(pairKey(t.subject, t.object));
    ugm.addEdge(t.subject, t.object, {
      type: "equivalentClass",
      asserted: true,
    });
  }

  const seen = new Set<string>();
  for (const t of store.graph(includeInferred).triples) {
    if (t.predicate !== RDFS_SUBCLASS) continue;
    if (!have.has(t.subject) || !have.has(t.object)) continue;
    if (equivalentPairs.has(pairKey(t.subject, t.object))) continue;
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

function scopedIndividuals(
  store: OntologyStore,
  scopeClass: string | null,
): Array<{ iri: string; label: string }> {
  let individuals = store.entities("Individual");
  if (scopeClass !== null) {
    const inScope = new Set(store.instancesOf(scopeClass).map((i) => i.iri));
    individuals = individuals.filter((i) => inScope.has(i.iri));
  }
  return individuals;
}

function typesFor(
  store: OntologyStore,
  iri: string,
  includeInferred: boolean,
): string[] {
  const types = store
    .typesOf(iri)
    .filter((t) => includeInferred || !t.inferred)
    .map((t) => t.iri);
  return types.length > 0 ? types : ["untyped"];
}

/** Display projection: pithy properties, never validated. */
export function instancesUgm(
  store: OntologyStore,
  includeInferred: boolean,
  scopeClass: string | null,
): UGM {
  const ugm = new UGM();
  const individuals = scopedIndividuals(store, scopeClass);
  const included = new Set(individuals.map((i) => i.iri));

  for (const i of individuals) {
    const types = typesFor(store, i.iri, includeInferred);
    const primaryType = types[0];
    const properties: Record<string, unknown> = {
      name: i.label,
      type: primaryType !== undefined ? local(primaryType) : "untyped",
    };
    for (const t of store.about(i.iri)) {
      if (!t.predicate.startsWith(NS.ex)) continue;
      if (!includeInferred && store.isInferred(t)) continue;
      if (t.objectType !== "literal") continue;
      const num = Number(t.object);
      properties[local(t.predicate)] =
        t.datatype?.endsWith("decimal") === true && Number.isFinite(num)
          ? num
          : t.object;
    }
    ugm.addNode(i.iri, { types, properties });
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

/** Validation projection: full-IRI keys only, never rendered. */
export function validationUgm(
  store: OntologyStore,
  includeInferred: boolean,
): UGM {
  const ugm = new UGM();
  for (const i of scopedIndividuals(store, null)) {
    const properties: Record<string, unknown> = {};
    const objectValues = new Map<string, string[]>();
    for (const t of store.about(i.iri)) {
      if (t.predicate === RDF_TYPE) continue;
      if (!includeInferred && store.isInferred(t)) continue;
      const relevant =
        t.predicate.startsWith(NS.ex) || t.predicate === RDFS_LABEL;
      if (!relevant) continue;
      if (t.objectType === "literal") {
        const num = Number(t.object);
        properties[t.predicate] =
          t.datatype?.endsWith("decimal") === true && Number.isFinite(num)
            ? num
            : t.object;
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
      types: typesFor(store, i.iri, includeInferred),
      properties,
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
