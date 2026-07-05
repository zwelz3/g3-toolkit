/**
 * OntologyStore: indexed access over an asserted RDFGraph plus a
 * flagged set of inferred triples (from the demo reasoner). Every
 * read method answers from asserted+inferred; axiom and typing
 * results carry `inferred` flags so the UI can chip them and the
 * Asserted|Inferred toggle can filter.
 */
import type { RDFGraph, RDFTriple } from "@g3t/core";
import {
  NS,
  RDF_TYPE,
  RDFS_SUBCLASS,
  RDFS_SUBPROP,
  RDFS_DOMAIN,
  RDFS_RANGE,
  RDFS_LABEL,
  RDFS_COMMENT,
  OWL_CLASS,
  OWL_OBJECT_PROP,
  OWL_DATA_PROP,
  OWL_ANN_PROP,
  OWL_INVERSE,
  OWL_SYMMETRIC,
  OWL_TRANSITIVE,
  OWL_EQUIVALENT,
  OWL_DISJOINT,
  OWL_ONTOLOGY,
  shorten,
} from "./model";

export type EntityKind =
  | "Class"
  | "ObjectProperty"
  | "DatatypeProperty"
  | "AnnotationProperty"
  | "Individual"
  | "Ontology";

export interface Axiom {
  text: string;
  inferred: boolean;
}

export interface EntitySummary {
  iri: string;
  label: string;
  kind: EntityKind;
  inferredKind: boolean;
}

export interface OntologyStats {
  triples: number;
  inferredTriples: number;
  classes: number;
  objectProperties: number;
  datatypeProperties: number;
  annotationProperties: number;
  individuals: number;
  instancesPerClass: Array<{ iri: string; label: string; count: number }>;
}

const tKey = (t: RDFTriple): string =>
  `${t.subject}\u0000${t.predicate}\u0000${t.object}\u0000${t.objectType}`;

export class OntologyStore {
  readonly asserted: RDFTriple[];
  readonly inferred: RDFTriple[];
  private readonly inferredKeys: Set<string>;
  private readonly bySubject = new Map<string, RDFTriple[]>();
  private readonly byPredicate = new Map<string, RDFTriple[]>();
  private readonly byObject = new Map<string, RDFTriple[]>();

  constructor(graph: RDFGraph, inferred: RDFTriple[]) {
    this.asserted = graph.triples;
    this.inferred = inferred;
    this.inferredKeys = new Set(inferred.map(tKey));
    for (const t of [...graph.triples, ...inferred]) {
      pushMap(this.bySubject, t.subject, t);
      pushMap(this.byPredicate, t.predicate, t);
      if (t.objectType === "uri") pushMap(this.byObject, t.object, t);
    }
  }

  isInferred(t: RDFTriple): boolean {
    return this.inferredKeys.has(tKey(t));
  }

  /** Combined graph, optionally without inferences. */
  graph(includeInferred: boolean): RDFGraph {
    return {
      triples: includeInferred
        ? [...this.asserted, ...this.inferred]
        : this.asserted,
    };
  }

  about(iri: string): RDFTriple[] {
    return this.bySubject.get(iri) ?? [];
  }

  labelOf(iri: string): string {
    const l = this.about(iri).find(
      (t) => t.predicate === RDFS_LABEL && t.objectType === "literal",
    );
    return l?.object ?? shorten(iri);
  }

  kindOf(iri: string): { kind: EntityKind; inferred: boolean } | null {
    let best: { kind: EntityKind; inferred: boolean } | null = null;
    for (const t of this.about(iri)) {
      if (t.predicate !== RDF_TYPE) continue;
      const map: Record<string, EntityKind> = {
        [OWL_CLASS]: "Class",
        [OWL_OBJECT_PROP]: "ObjectProperty",
        [OWL_DATA_PROP]: "DatatypeProperty",
        [OWL_ANN_PROP]: "AnnotationProperty",
        [OWL_ONTOLOGY]: "Ontology",
      };
      const k = map[t.object];
      if (k) return { kind: k, inferred: this.isInferred(t) };
      if (t.object !== OWL_SYMMETRIC && t.object !== OWL_TRANSITIVE) {
        best = { kind: "Individual", inferred: this.isInferred(t) };
      }
    }
    return best;
  }

  entities(kind: EntityKind): EntitySummary[] {
    const out: EntitySummary[] = [];
    for (const iri of this.bySubject.keys()) {
      const k = this.kindOf(iri);
      if (k?.kind === kind) {
        out.push({
          iri,
          label: this.labelOf(iri),
          kind: k.kind,
          inferredKind: k.inferred,
        });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }

  /** Direct subclasses (asserted only, so the tree stays a hierarchy). */
  childrenOf(classIri: string | null): EntitySummary[] {
    const classes = this.entities("Class");
    const parentOf = (iri: string): string[] =>
      this.about(iri)
        .filter((t) => t.predicate === RDFS_SUBCLASS && !this.isInferred(t))
        .map((t) => t.object);
    return classes.filter((c) => {
      const parents = parentOf(c.iri).filter((p) =>
        classes.some((k) => k.iri === p),
      );
      return classIri === null
        ? parents.length === 0
        : parents.includes(classIri);
    });
  }

  /** Types of an entity, with subclass-inferred ones flagged. */
  typesOf(
    iri: string,
  ): Array<{ iri: string; label: string; inferred: boolean }> {
    return this.about(iri)
      .filter((t) => t.predicate === RDF_TYPE && t.object.startsWith(NS.ex))
      .map((t) => ({
        iri: t.object,
        label: this.labelOf(t.object),
        inferred: this.isInferred(t),
      }));
  }

  /** Instances of a class (inferred typing included and flagged). */
  instancesOf(
    classIri: string,
  ): Array<{ iri: string; label: string; inferred: boolean }> {
    return (this.byObject.get(classIri) ?? [])
      .filter((t) => t.predicate === RDF_TYPE)
      .map((t) => ({
        iri: t.subject,
        label: this.labelOf(t.subject),
        inferred: this.isInferred(t),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /** Human-readable axioms for an entity, inferred flags carried. */
  axiomsOf(iri: string): Axiom[] {
    const out: Axiom[] = [];
    const name = (x: string) => shorten(x);
    const AXIOM_PREDICATES: Record<string, string> = {
      [RDFS_SUBCLASS]: "subClassOf",
      [RDFS_SUBPROP]: "subPropertyOf",
      [RDFS_DOMAIN]: "domain",
      [RDFS_RANGE]: "range",
      [OWL_INVERSE]: "inverseOf",
      [OWL_EQUIVALENT]: "equivalentClass",
      [OWL_DISJOINT]: "disjointWith",
    };
    for (const t of this.about(iri)) {
      const rel = AXIOM_PREDICATES[t.predicate];
      if (rel) {
        out.push({
          text: `${rel} ${name(t.object)}`,
          inferred: this.isInferred(t),
        });
      } else if (t.predicate === RDF_TYPE) {
        if (t.object === OWL_SYMMETRIC)
          out.push({ text: "SymmetricProperty", inferred: this.isInferred(t) });
        else if (t.object === OWL_TRANSITIVE)
          out.push({
            text: "TransitiveProperty",
            inferred: this.isInferred(t),
          });
        else if (t.object.startsWith(NS.ex))
          out.push({
            text: `a ${name(t.object)}`,
            inferred: this.isInferred(t),
          });
      } else if (!isAnnotationPredicate(t.predicate)) {
        out.push({
          text: `${name(t.predicate)} ${
            t.objectType === "literal"
              ? JSON.stringify(t.object)
              : name(t.object)
          }`,
          inferred: this.isInferred(t),
        });
      }
    }
    return out;
  }

  /** Annotation values (label, comment, dc:*, versionInfo, custom). */
  annotationsOf(iri: string): Array<{ predicate: string; value: string }> {
    return this.about(iri)
      .filter(
        (t) => t.objectType === "literal" && isAnnotationPredicate(t.predicate),
      )
      .map((t) => ({ predicate: shorten(t.predicate), value: t.object }));
  }

  search(query: string): EntitySummary[] {
    const q = query.trim().toLowerCase();
    if (q === "") return [];
    const out: EntitySummary[] = [];
    for (const iri of this.bySubject.keys()) {
      const k = this.kindOf(iri);
      if (!k || k.kind === "Ontology") continue;
      const label = this.labelOf(iri);
      if (label.toLowerCase().includes(q) || iri.toLowerCase().includes(q)) {
        out.push({ iri, label, kind: k.kind, inferredKind: k.inferred });
      }
    }
    return out.slice(0, 25);
  }

  stats(): OntologyStats {
    const classes = this.entities("Class");
    const perClass = classes
      .map((c) => ({
        iri: c.iri,
        label: c.label,
        count: this.instancesOf(c.iri).length,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
    return {
      triples: this.asserted.length,
      inferredTriples: this.inferred.length,
      classes: classes.length,
      objectProperties: this.entities("ObjectProperty").length,
      datatypeProperties: this.entities("DatatypeProperty").length,
      annotationProperties: this.entities("AnnotationProperty").length,
      individuals: this.entities("Individual").length,
      instancesPerClass: perClass,
    };
  }
}

function isAnnotationPredicate(p: string): boolean {
  return (
    p === RDFS_LABEL ||
    p === RDFS_COMMENT ||
    p.startsWith("http://purl.org/dc/") ||
    p === `${NS.owl}versionInfo` ||
    p === `${NS.ex}reviewStatus`
  );
}

function pushMap(m: Map<string, RDFTriple[]>, k: string, t: RDFTriple): void {
  const arr = m.get(k);
  if (arr) arr.push(t);
  else m.set(k, [t]);
}
