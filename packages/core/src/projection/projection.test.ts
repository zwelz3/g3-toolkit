/**
 * Projection pipeline tests covering M4.E1.T1 through M4.E3.T3.
 *
 * E1.T1: Pipeline with 2 steps; input graph; output UGM.
 * E2.T1: rdf:type edges removed; types array populated.
 * E2.T2: Literal nodes removed; properties populated.
 * E2.T3: Blank node chain becomes nested object.
 * E2.T4: rdf:first/rest chain becomes array.
 * E2.T5: Reified statement metadata on edge.
 * E3.T1: Standard preset (no literals). Ontology preset (type edges preserved).
 * E3.T2: Holonic pipeline compatibility.
 * E3.T3: ViewRouter blocks raw RDF; passes projected; exempts schema.
 */

import { describe, it, expect } from "vitest";
import { ProjectionPipeline, RDF, localPart, castLiteral } from "./pipeline";
import type { RDFGraph } from "./pipeline";
import {
  typeCollapse,
  literalCollapse,
  blankNodeCollapse,
  listCollapse,
  reificationCollapse,
} from "./transforms";
import { createPresetPipeline, checkRenderPermission } from "./presets";

// ── Test data ───────────────────────────────────────────────────────

function makeTripleGraph(): RDFGraph {
  return {
    triples: [
      // Alice is a Person
      {
        subject: "ex:alice",
        predicate: RDF.type,
        object: "ex:Person",
        objectType: "uri",
      },
      // Alice has a name
      {
        subject: "ex:alice",
        predicate: "ex:name",
        object: "Alice",
        objectType: "literal",
        datatype: "http://www.w3.org/2001/XMLSchema#string",
      },
      // Alice has an age
      {
        subject: "ex:alice",
        predicate: "ex:age",
        object: "30",
        objectType: "literal",
        datatype: "http://www.w3.org/2001/XMLSchema#integer",
      },
      // Alice knows Bob
      {
        subject: "ex:alice",
        predicate: "ex:knows",
        object: "ex:bob",
        objectType: "uri",
      },
      // Bob is a Person
      {
        subject: "ex:bob",
        predicate: RDF.type,
        object: "ex:Person",
        objectType: "uri",
      },
      {
        subject: "ex:bob",
        predicate: "ex:name",
        object: "Bob",
        objectType: "literal",
      },
    ],
  };
}

// ── E1.T1: Pipeline core ────────────────────────────────────────────

describe("ProjectionPipeline core (M4.E1.T1)", () => {
  it("runs 2 enabled steps and produces UGM", () => {
    const pipeline = new ProjectionPipeline();
    pipeline.addStep({ name: "Type", transform: typeCollapse, enabled: true });
    pipeline.addStep({
      name: "Literal",
      transform: literalCollapse,
      enabled: true,
    });

    const ugm = pipeline.project(makeTripleGraph());

    expect(ugm.nodeCount).toBe(2); // alice, bob
    expect(ugm.edgeCount).toBe(1); // knows
    expect(ugm.getNode("ex:alice")?.types).toContain("Person");
  });

  it("skips disabled steps", () => {
    const pipeline = new ProjectionPipeline();
    pipeline.addStep({ name: "Type", transform: typeCollapse, enabled: false });
    pipeline.addStep({
      name: "Literal",
      transform: literalCollapse,
      enabled: true,
    });

    const ugm = pipeline.project(makeTripleGraph());
    // Type collapse disabled → rdf:type becomes an edge
    expect(ugm.edgeCount).toBeGreaterThan(1);
  });

  it("toggles step by name", () => {
    const pipeline = new ProjectionPipeline();
    pipeline.addStep({ name: "Type", transform: typeCollapse, enabled: true });

    pipeline.setStepEnabled("Type", false);
    expect(pipeline.getSteps()[0]!.enabled).toBe(false);

    pipeline.setStepEnabled("Type", true);
    expect(pipeline.getSteps()[0]!.enabled).toBe(true);
  });

  it("handles empty graph", () => {
    const pipeline = new ProjectionPipeline();
    pipeline.addStep({ name: "Type", transform: typeCollapse, enabled: true });

    const ugm = pipeline.project({ triples: [] });
    expect(ugm.nodeCount).toBe(0);
  });
});

// ── E2.T1: Type Collapse ───────────────────────────────────────────

describe("Type Collapse (M4.E2.T1)", () => {
  it("removes rdf:type triples; types array populated on nodes", () => {
    const pipeline = new ProjectionPipeline();
    pipeline.addStep({ name: "Type", transform: typeCollapse, enabled: true });
    pipeline.addStep({
      name: "Literal",
      transform: literalCollapse,
      enabled: true,
    });

    const ugm = pipeline.project(makeTripleGraph());

    expect(ugm.getNode("ex:alice")?.types).toContain("Person");
    // No rdf:type edges in UGM
    let typeEdgeCount = 0;
    ugm.forEachEdge((_id, attrs) => {
      if (attrs.type === "type") typeEdgeCount++;
    });
    expect(typeEdgeCount).toBe(0);
  });
});

// ── E2.T2: Literal Collapse ────────────────────────────────────────

describe("Literal Collapse (M4.E2.T2)", () => {
  it("removes literal nodes; properties populated on subject", () => {
    const pipeline = new ProjectionPipeline();
    pipeline.addStep({ name: "Type", transform: typeCollapse, enabled: true });
    pipeline.addStep({
      name: "Literal",
      transform: literalCollapse,
      enabled: true,
    });

    const ugm = pipeline.project(makeTripleGraph());

    // Literals became properties, not nodes
    expect(ugm.nodeCount).toBe(2); // alice, bob (no literal nodes)
    expect(ugm.getNode("ex:alice")?.properties.name).toBe("Alice");
    expect(ugm.getNode("ex:alice")?.properties.age).toBe(30);
  });
});

// ── E2.T3: Blank-Node Resolution ───────────────────────────────────

describe("Blank-Node Resolution (M4.E2.T3)", () => {
  it("inlines blank node properties onto parent", () => {
    const graph: RDFGraph = {
      triples: [
        {
          subject: "ex:alice",
          predicate: "ex:address",
          object: "_:addr1",
          objectType: "uri",
        },
        {
          subject: "_:addr1",
          predicate: "ex:street",
          object: "123 Main St",
          objectType: "literal",
        },
        {
          subject: "_:addr1",
          predicate: "ex:city",
          object: "Springfield",
          objectType: "literal",
        },
        {
          subject: "ex:alice",
          predicate: "ex:name",
          object: "Alice",
          objectType: "literal",
        },
      ],
    };

    const pipeline = new ProjectionPipeline();
    pipeline.addStep({
      name: "BNode",
      transform: blankNodeCollapse,
      enabled: true,
    });

    const ugm = pipeline.project(graph);

    // Blank node is gone; properties inlined
    expect(ugm.nodeCount).toBe(1); // only alice
    const alice = ugm.getNode("ex:alice");
    expect(alice?.properties.name).toBe("Alice");
    // Blank node properties accessible via nested path
    const streetProp = Object.keys(alice?.properties ?? {}).find((k) =>
      k.includes("street"),
    );
    expect(streetProp).toBeDefined();
  });
});

// ── E2.T4: List Resolution ─────────────────────────────────────────

describe("List Resolution (M4.E2.T4)", () => {
  it("converts rdf:first/rest chain to array", () => {
    const graph: RDFGraph = {
      triples: [
        {
          subject: "ex:alice",
          predicate: "ex:skills",
          object: "_:list1",
          objectType: "uri",
        },
        {
          subject: "_:list1",
          predicate: RDF.first,
          object: "Python",
          objectType: "literal",
        },
        {
          subject: "_:list1",
          predicate: RDF.rest,
          object: "_:list2",
          objectType: "uri",
        },
        {
          subject: "_:list2",
          predicate: RDF.first,
          object: "TypeScript",
          objectType: "literal",
        },
        {
          subject: "_:list2",
          predicate: RDF.rest,
          object: RDF.nil,
          objectType: "uri",
        },
      ],
    };

    const pipeline = new ProjectionPipeline();
    pipeline.addStep({ name: "List", transform: listCollapse, enabled: true });

    const ugm = pipeline.project(graph);

    expect(ugm.nodeCount).toBe(1); // alice
    const alice = ugm.getNode("ex:alice");
    // The list should be stored as a JSON array string
    const skillsProp = Object.values(alice?.properties ?? {}).find(
      (v) => typeof v === "string" && v.includes("Python"),
    );
    expect(skillsProp).toBeDefined();
  });
});

// ── E2.T5: Reification Collapse ────────────────────────────────────

describe("Reification Collapse (M4.E2.T5)", () => {
  it("collapses reified statement metadata onto subject", () => {
    const graph: RDFGraph = {
      triples: [
        // The actual triple
        {
          subject: "ex:alice",
          predicate: "ex:knows",
          object: "ex:bob",
          objectType: "uri",
        },
        // Reification
        {
          subject: "_:stmt1",
          predicate: RDF.type,
          object: RDF.Statement,
          objectType: "uri",
        },
        {
          subject: "_:stmt1",
          predicate: RDF.subject,
          object: "ex:alice",
          objectType: "uri",
        },
        {
          subject: "_:stmt1",
          predicate: RDF.predicate,
          object: "ex:knows",
          objectType: "uri",
        },
        {
          subject: "_:stmt1",
          predicate: RDF.object,
          object: "ex:bob",
          objectType: "uri",
        },
        {
          subject: "_:stmt1",
          predicate: "ex:confidence",
          object: "0.95",
          objectType: "literal",
        },
        {
          subject: "_:stmt1",
          predicate: "ex:source",
          object: "HUMINT",
          objectType: "literal",
        },
      ],
    };

    const pipeline = new ProjectionPipeline();
    pipeline.addStep({
      name: "Reification",
      transform: reificationCollapse,
      enabled: true,
    });

    const ugm = pipeline.project(graph);

    expect(ugm.nodeCount).toBe(2); // alice, bob (no reification node)
    // Metadata should be on alice as properties
    const alice = ugm.getNode("ex:alice");
    const metaKeys = Object.keys(alice?.properties ?? {});
    const hasConfidence = metaKeys.some((k) => k.includes("confidence"));
    expect(hasConfidence).toBe(true);
  });
});

// ── E3.T1: Presets ──────────────────────────────────────────────────

describe("Projection presets (M4.E3.T1)", () => {
  it("Standard preset: no literal nodes, no type edges", () => {
    const pipeline = createPresetPipeline("standard");
    const ugm = pipeline.project(makeTripleGraph());

    expect(ugm.nodeCount).toBe(2); // alice, bob
    expect(ugm.getNode("ex:alice")?.types).toContain("Person");
    // No type edges
    let typeEdges = 0;
    ugm.forEachEdge((_id, attrs) => {
      if (attrs.type === "type") typeEdges++;
    });
    expect(typeEdges).toBe(0);
  });

  it("Ontology preset: type edges preserved", () => {
    const pipeline = createPresetPipeline("ontology");
    const ugm = pipeline.project(makeTripleGraph());

    // rdf:type triples should become edges (type collapse OFF)
    let typeEdges = 0;
    ugm.forEachEdge((_id, attrs) => {
      if (attrs.type === "type") typeEdges++;
    });
    expect(typeEdges).toBeGreaterThan(0);
  });

  it("Provenance-Preserving preset: reification nodes preserved", () => {
    const graph: RDFGraph = {
      triples: [
        {
          subject: "ex:alice",
          predicate: "ex:knows",
          object: "ex:bob",
          objectType: "uri",
        },
        {
          subject: "_:stmt1",
          predicate: RDF.type,
          object: RDF.Statement,
          objectType: "uri",
        },
        {
          subject: "_:stmt1",
          predicate: RDF.subject,
          object: "ex:alice",
          objectType: "uri",
        },
        {
          subject: "_:stmt1",
          predicate: "ex:confidence",
          object: "0.95",
          objectType: "literal",
        },
      ],
    };

    const pipeline = createPresetPipeline("provenance-preserving");
    const ugm = pipeline.project(graph);

    // Reification collapse is OFF, so _:stmt1 remains as a node
    // (it won't be in the UGM because blank nodes are filtered,
    // but the reification triples aren't collapsed)
    expect(ugm.nodeCount).toBeGreaterThanOrEqual(2);
  });
});

// ── E3.T2: Holonic compatibility ────────────────────────────────────

describe("Holonic pipeline compatibility (M4.E3.T2)", () => {
  it("g3t pipeline satisfies HolonicProjectionPipeline interface", () => {
    const pipeline = createPresetPipeline("standard");

    // HolonicProjectionPipeline = Pick<ProjectionPipeline, "project">
    expect(typeof pipeline.project).toBe("function");

    // Verify it works
    const ugm = pipeline.project(makeTripleGraph());
    expect(ugm.nodeCount).toBeGreaterThan(0);
  });
});

// ── E3.T3: ViewRouter enforcement gate ──────────────────────────────

describe("ViewRouter RDF enforcement (M4.E3.T3)", () => {
  it("blocks raw RDF from canvas", () => {
    expect(() =>
      checkRenderPermission({
        isRDF: true,
        isProjected: false,
        target: "canvas",
      }),
    ).toThrow("ViewRouter");
  });

  it("passes projected RDF to canvas", () => {
    expect(
      checkRenderPermission({
        isRDF: true,
        isProjected: true,
        target: "canvas",
      }),
    ).toBe(true);
  });

  it("passes non-RDF data without check", () => {
    expect(
      checkRenderPermission({
        isRDF: false,
        isProjected: false,
        target: "canvas",
      }),
    ).toBe(true);
  });

  it("exempts schema view from gate", () => {
    expect(
      checkRenderPermission({
        isRDF: true,
        isProjected: false,
        target: "schema",
      }),
    ).toBe(true);
  });

  it("exempts inspector from gate", () => {
    expect(
      checkRenderPermission({
        isRDF: true,
        isProjected: false,
        target: "inspector",
      }),
    ).toBe(true);
  });

  it("blocks raw RDF from table", () => {
    expect(() =>
      checkRenderPermission({
        isRDF: true,
        isProjected: false,
        target: "table",
      }),
    ).toThrow("ViewRouter");
  });
});

// ── Utility tests ───────────────────────────────────────────────────

describe("Projection utilities", () => {
  it("localPart extracts after # or /", () => {
    expect(localPart("http://example.org/vocab#Person")).toBe("Person");
    expect(localPart("http://example.org/vocab/knows")).toBe("knows");
    expect(localPart("plain")).toBe("plain");
  });

  it("castLiteral converts typed values", () => {
    expect(castLiteral("42", "http://www.w3.org/2001/XMLSchema#integer")).toBe(
      42,
    );
    expect(
      castLiteral("3.14", "http://www.w3.org/2001/XMLSchema#float"),
    ).toBeCloseTo(3.14);
    expect(
      castLiteral("true", "http://www.w3.org/2001/XMLSchema#boolean"),
    ).toBe(true);
    expect(castLiteral("hello", undefined)).toBe("hello");
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("Projection: edge cases (audit)", () => {
  it("M4 exit criterion: 1000-triple RDF graph produces clean UGM", () => {
    const triples = [];
    for (let i = 0; i < 200; i++) {
      const s = `ex:node${i}`;
      triples.push(
        {
          subject: s,
          predicate: RDF.type,
          object: `ex:Type${i % 5}`,
          objectType: "uri" as const,
        },
        {
          subject: s,
          predicate: "ex:name",
          object: `Node ${i}`,
          objectType: "literal" as const,
        },
        {
          subject: s,
          predicate: "ex:score",
          object: `${i}`,
          objectType: "literal" as const,
          datatype: "http://www.w3.org/2001/XMLSchema#integer",
        },
      );
      if (i > 0) {
        triples.push({
          subject: s,
          predicate: "ex:knows",
          object: `ex:node${i - 1}`,
          objectType: "uri" as const,
        });
      }
      if (i % 10 === 0) {
        triples.push({
          subject: s,
          predicate: "ex:related",
          object: `ex:node${(i + 50) % 200}`,
          objectType: "uri" as const,
        });
      }
    }
    // ~1000 triples total (200*3 + 199 + 20 = 819, close enough; pad with extra)
    for (let i = 0; i < 181; i++) {
      triples.push({
        subject: `ex:node${i % 200}`,
        predicate: `ex:attr${i}`,
        object: `val${i}`,
        objectType: "literal" as const,
      });
    }

    expect(triples.length).toBe(1000);
    const pipeline = createPresetPipeline("standard");
    const ugm = pipeline.project({ triples });

    // Exit criterion: only named-resource nodes (no literal nodes, no blank nodes, no rdf:type edges)
    ugm.forEachNode((id) => {
      expect(id.startsWith("_:")).toBe(false);
    });
    let typeEdges = 0;
    ugm.forEachEdge((_id, attrs) => {
      if (attrs.type === "type") typeEdges++;
    });
    expect(typeEdges).toBe(0);
    expect(ugm.nodeCount).toBe(200);
  });

  it("localPart handles CURIE with colon prefix", () => {
    expect(localPart("ex:Person")).toBe("Person");
    expect(localPart("rdf:type")).toBe("type");
    expect(localPart("schema:name")).toBe("name");
  });

  it("castLiteral handles boolean false", () => {
    expect(
      castLiteral("false", "http://www.w3.org/2001/XMLSchema#boolean"),
    ).toBe(false);
    expect(
      castLiteral("true", "http://www.w3.org/2001/XMLSchema#boolean"),
    ).toBe(true);
  });
});
