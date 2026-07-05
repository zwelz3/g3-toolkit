/**
 * Demo reasoner tests: each of the seeded ontology's DELIBERATE
 * inference gaps must be closed by materialization, and nothing
 * asserted may be re-emitted.
 */
import { describe, it, expect } from "vitest";
import { buildOntologyGraph, NS, RDF_TYPE, RDFS_SUBCLASS } from "./model";
import { materializeInferences } from "./reasoner";

const ex = (l: string) => `${NS.ex}${l}`;
const graph = buildOntologyGraph();
const inferred = materializeInferences(graph);
const has = (s: string, p: string, o: string): boolean =>
  inferred.some((t) => t.subject === s && t.predicate === p && t.object === o);

describe("materializeInferences", () => {
  it("types aquila2 up the subclass chain (Satellite -> Spacecraft -> System -> Artifact)", () => {
    expect(has(ex("aquila2"), RDF_TYPE, ex("Spacecraft"))).toBe(true);
    expect(has(ex("aquila2"), RDF_TYPE, ex("System"))).toBe(true);
    expect(has(ex("aquila2"), RDF_TYPE, ex("Artifact"))).toBe(true);
  });

  it("closes subClassOf transitively (Satellite subClassOf Artifact)", () => {
    expect(has(ex("Satellite"), RDFS_SUBCLASS, ex("Artifact"))).toBe(true);
  });

  it("types the never-typed gsAlpha via range entailment", () => {
    expect(has(ex("gsAlpha"), RDF_TYPE, ex("GroundStation"))).toBe(true);
  });

  it("materializes the symmetric reverse of communicatesWith", () => {
    expect(has(ex("gsAlpha"), ex("communicatesWith"), ex("aquila1"))).toBe(
      true,
    );
  });

  it("materializes the transitive partOf chain (thr1 partOf aquila1)", () => {
    expect(has(ex("thr1"), ex("partOf"), ex("aquila1"))).toBe(true);
  });

  it("materializes the inverse hasSubsystem from subsystemOf", () => {
    expect(has(ex("aquila2"), ex("hasSubsystem"), ex("pwr2"))).toBe(true);
  });

  it("propagates subPropertyOf (hasPrimaryAntenna implies hasComponent)", () => {
    expect(has(ex("comm1"), ex("hasComponent"), ex("ant1"))).toBe(true);
  });

  it("treats equivalentClass bidirectionally (comm1 typed CommSubsystem)", () => {
    expect(has(ex("comm1"), RDF_TYPE, ex("CommSubsystem"))).toBe(true);
  });

  it("never re-emits an asserted triple and never duplicates itself", () => {
    const key = (t: (typeof inferred)[number]) =>
      `${t.subject}|${t.predicate}|${t.object}|${t.objectType}`;
    const assertedKeys = new Set(graph.triples.map(key));
    const seen = new Set<string>();
    for (const t of inferred) {
      const k = key(t);
      expect(assertedKeys.has(k)).toBe(false);
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});
