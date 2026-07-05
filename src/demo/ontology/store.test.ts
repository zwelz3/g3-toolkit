/**
 * OntologyStore tests over the seeded graph + reasoner output:
 * entity kind classification, asserted-only hierarchy, inferred
 * flags on axioms and typings, annotations, search, and stats.
 */
import { describe, it, expect } from "vitest";
import { buildOntologyGraph, NS } from "./model";
import { materializeInferences } from "./reasoner";
import { OntologyStore } from "./store";

const ex = (l: string) => `${NS.ex}${l}`;
const graph = buildOntologyGraph();
const store = new OntologyStore(graph, materializeInferences(graph));

describe("OntologyStore", () => {
  it("classifies entity kinds", () => {
    expect(store.kindOf(ex("Satellite"))?.kind).toBe("Class");
    expect(store.kindOf(ex("hasSubsystem"))?.kind).toBe("ObjectProperty");
    expect(store.kindOf(ex("mass"))?.kind).toBe("DatatypeProperty");
    expect(store.kindOf(ex("reviewStatus"))?.kind).toBe("AnnotationProperty");
    expect(store.kindOf(ex("aquila1"))?.kind).toBe("Individual");
    expect(store.kindOf(NS.ex)?.kind).toBe("Ontology");
  });

  it("kinds an entity typed only by inference, flagged", () => {
    const k = store.kindOf(ex("gsAlpha"));
    expect(k?.kind).toBe("Individual");
    expect(k?.inferred).toBe(true);
  });

  it("builds the class hierarchy from asserted subClassOf only", () => {
    const roots = store.childrenOf(null).map((c) => c.iri);
    expect(roots).toContain(ex("Artifact"));
    expect(roots).toContain(ex("Mission"));
    // Inferred transitive subclass edges must not flatten the tree:
    // Satellite is a child of Spacecraft, not of Artifact.
    expect(store.childrenOf(ex("Artifact")).map((c) => c.iri)).not.toContain(
      ex("Satellite"),
    );
    expect(store.childrenOf(ex("Spacecraft")).map((c) => c.iri)).toContain(
      ex("Satellite"),
    );
  });

  it("flags inferred typings distinctly from asserted ones", () => {
    const types = store.typesOf(ex("aquila2"));
    const satellite = types.find((t) => t.iri === ex("Satellite"));
    const spacecraft = types.find((t) => t.iri === ex("Spacecraft"));
    expect(satellite?.inferred).toBe(false);
    expect(spacecraft?.inferred).toBe(true);
  });

  it("carries inferred flags on axioms", () => {
    const axioms = store.axiomsOf(ex("aquila2"));
    const inferredTexts = axioms.filter((a) => a.inferred).map((a) => a.text);
    expect(inferredTexts).toContain("a ex:Spacecraft");
    const assertedTexts = axioms.filter((a) => !a.inferred).map((a) => a.text);
    expect(assertedTexts).toContain("a ex:Satellite");
  });

  it("lists instances of a class including inferred membership", () => {
    const spacecraft = store.instancesOf(ex("Spacecraft"));
    const aquila2 = spacecraft.find((i) => i.iri === ex("aquila2"));
    expect(aquila2?.inferred).toBe(true);
  });

  it("returns annotations (label, comment, dc, custom)", () => {
    const anns = store.annotationsOf(NS.ex);
    const preds = anns.map((a) => a.predicate);
    expect(preds).toContain("rdfs:label");
    expect(preds).toContain("dc:creator");
    expect(preds).toContain("owl:versionInfo");
  });

  it("searches labels and IRIs, capped", () => {
    const hits = store.search("aquila");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.every((h) => h.label.toLowerCase().includes("aquila"))).toBe(
      true,
    );
    expect(store.search("").length).toBe(0);
  });

  it("computes stats with instances-per-class sorted descending", () => {
    const s = store.stats();
    expect(s.classes).toBeGreaterThanOrEqual(22);
    expect(s.objectProperties).toBeGreaterThanOrEqual(10);
    expect(s.datatypeProperties).toBe(4);
    expect(s.individuals).toBeGreaterThanOrEqual(20);
    expect(s.inferredTriples).toBeGreaterThan(0);
    for (let i = 1; i < s.instancesPerClass.length; i++) {
      const prev = s.instancesPerClass[i - 1];
      const cur = s.instancesPerClass[i];
      if (prev && cur) expect(prev.count).toBeGreaterThanOrEqual(cur.count);
    }
  });
});
