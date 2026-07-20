/**
 * Projection acceptance tests from the review remediation plan
 * (items 3.1, 3.2, 3.7; premise 0.2 pinned in code).
 *
 * The display and validation projections are separate models: the
 * review found that mixing them made the closed-shape check flag
 * synthetic display keys (`name`, `kind`, `iri`, local-name
 * duplicates) on gsBravo and polluted table columns with IRIs.
 */
import { describe, it, expect } from "vitest";
import { validateShacl } from "@g3t/core";
import { buildOntologyGraph, buildShapes, NS } from "./model";
import { materializeInferences } from "./reasoner";
import { OntologyStore } from "./store";
import { classHierarchyUgm, instancesUgm, validationUgm } from "./project";

const ex = (l: string) => `${NS.ex}${l}`;
const graph = buildOntologyGraph();
const store = new OntologyStore(graph, materializeInferences(graph));
const shapes = buildShapes();

describe("display vs validation projection split (3.1)", () => {
  it("display UGM carries only pithy keys, no IRIs, no synthetic kind/iri", () => {
    const ugm = instancesUgm(store, true, null);
    ugm.forEachNode((_id, attrs) => {
      for (const key of Object.keys(attrs.properties)) {
        expect(key.startsWith("http")).toBe(false);
        expect(key).not.toBe("kind");
        expect(key).not.toBe("iri");
      }
    });
    const aquila1 = ugm.getNode(ex("aquila1"));
    expect(aquila1?.properties.mass).toBe(412.5);
    expect(aquila1?.properties.name).toBe("Aquila-1");
  });

  it("validation UGM keys are full predicate IRIs only", () => {
    const ugm = validationUgm(store, false);
    ugm.forEachNode((_id, attrs) => {
      for (const key of Object.keys(attrs.properties)) {
        expect(key.startsWith("http")).toBe(true);
      }
    });
  });
});

describe("closed-shape validation story (3.1 acceptance, 3.2)", () => {
  it("gsBravo conforms to the closed GroundStationShape on asserted data", () => {
    const results = validateShacl(validationUgm(store, false), shapes);
    const gsBravo = results.filter(
      (r) => r.nodeId === ex("gsBravo") && r.violations.length > 0,
    );
    expect(gsBravo).toEqual([]);
  });

  it("with inference, gsAlpha's ONLY violation is the missing callSign", () => {
    const results = validateShacl(validationUgm(store, true), shapes);
    const gsAlpha = results.filter((r) => r.nodeId === ex("gsAlpha"));
    // Range entailment brings gsAlpha into the target class at all.
    expect(gsAlpha.length).toBeGreaterThan(0);
    const violations = gsAlpha.flatMap((r) => r.violations);
    expect(violations.length).toBe(1);
    expect(violations[0]?.path).toBe(ex("callSign"));
  });

  it("asserted-only, gsAlpha is not validated (no asserted typing)", () => {
    const results = validateShacl(validationUgm(store, false), shapes);
    expect(results.filter((r) => r.nodeId === ex("gsAlpha"))).toEqual([]);
  });
});

describe("validation deltas under inference (premise 0.2 pinned)", () => {
  it("aquila2's hasSubsystem violation exists asserted and clears under inference", () => {
    const asserted = validateShacl(validationUgm(store, false), shapes)
      .filter((r) => r.nodeId === ex("aquila2"))
      .flatMap((r) => r.violations)
      .map((v) => v.path);
    expect(asserted).toContain(ex("hasSubsystem"));

    const inferred = validateShacl(validationUgm(store, true), shapes)
      .filter((r) => r.nodeId === ex("aquila2"))
      .flatMap((r) => r.violations)
      .map((v) => v.path);
    expect(inferred).not.toContain(ex("hasSubsystem"));
  });
});

describe("equivalence rendering in the hierarchy (3.7)", () => {
  const pair = [ex("CommsSubsystem"), ex("CommSubsystem")];

  const edgesBetween = (includeInferred: boolean) => {
    const ugm = classHierarchyUgm(store, includeInferred);
    const found: Array<{ type: string }> = [];
    ugm.forEachEdge((_eid, attrs, source, target) => {
      if (pair.includes(source) && pair.includes(target)) {
        found.push({ type: attrs.type });
      }
    });
    return found;
  };

  it("renders exactly one equivalentClass edge, asserted view", () => {
    const edges = edgesBetween(false);
    expect(edges.length).toBe(1);
    expect(edges[0]?.type).toBe("equivalentClass");
  });

  it("stays one equivalentClass edge with inference on (no mutual subClassOf noise)", () => {
    const edges = edgesBetween(true);
    expect(edges.length).toBe(1);
    expect(edges[0]?.type).toBe("equivalentClass");
  });
});
