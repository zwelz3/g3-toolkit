/**
 * SHACL validator and browser tests (DE.1, DE.2).
 */

import { describe, it, expect } from "vitest";
import { UGM } from "../ugm";
import { validateShacl, summarizeValidation, type ShaclShape } from "../shacl";
function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("d1", {
    types: ["Disease"],
    properties: { name: "Hypertension", icd10: "I10", severity: "high" },
  });
  ugm.addNode("d2", {
    types: ["Disease"],
    properties: { name: "Diabetes", icd10: "E11" },
  });
  ugm.addNode("d3", {
    types: ["Disease"],
    properties: { name: "" }, // missing icd10 (violation)
  });
  ugm.addNode("p1", {
    types: ["Drug"],
    properties: { name: "Metformin", phase: 4 },
  });
  ugm.addNode("p2", {
    types: ["Drug"],
    properties: { phase: 3 }, // missing name (violation)
  });
  return ugm;
}

const SHAPES: ShaclShape[] = [
  {
    id: "disease-shape",
    name: "Disease Shape",
    targetClass: "Disease",
    properties: [
      { path: "name", name: "Name", datatype: "string", minCount: 1 },
      {
        path: "icd10",
        name: "ICD-10 Code",
        datatype: "string",
        minCount: 1,
        pattern: "^[A-Z]\\d",
      },
    ],
  },
  {
    id: "drug-shape",
    name: "Drug Shape",
    targetClass: "Drug",
    properties: [
      { path: "name", name: "Name", datatype: "string", minCount: 1 },
      {
        path: "phase",
        name: "Trial Phase",
        datatype: "number",
        minInclusive: 1,
        maxInclusive: 4,
      },
    ],
  },
];

// ── ShaclValidator (DE.1) ───────────────────────────────────────────

describe("validateShacl", () => {
  it("validates passing nodes", () => {
    const ugm = makeUGM();
    const results = validateShacl(ugm, SHAPES);
    const d1 = results.find((r) => r.nodeId === "d1");
    expect(d1?.valid).toBe(true);
    expect(d1?.violations).toHaveLength(0);
  });

  it("detects missing required property", () => {
    const ugm = makeUGM();
    const results = validateShacl(ugm, SHAPES);
    const d3 = results.find(
      (r) => r.nodeId === "d3" && r.shapeId === "disease-shape",
    );
    expect(d3?.valid).toBe(false);
    // d3 has empty name (counts as missing) and missing icd10
    expect(d3?.violations.length).toBeGreaterThanOrEqual(1);
  });

  it("detects pattern violation", () => {
    const ugm = new UGM();
    ugm.addNode("bad", {
      types: ["Disease"],
      properties: { name: "Test", icd10: "invalid-code" },
    });
    const results = validateShacl(ugm, SHAPES);
    const bad = results.find((r) => r.nodeId === "bad");
    expect(bad?.valid).toBe(false);
    expect(bad?.violations.some((v) => v.path === "icd10")).toBe(true);
  });

  it("validates numeric range constraints", () => {
    const ugm = new UGM();
    ugm.addNode("d1", {
      types: ["Drug"],
      properties: { name: "BadDrug", phase: 5 }, // exceeds maxInclusive
    });
    const results = validateShacl(ugm, SHAPES);
    const d1 = results.find((r) => r.nodeId === "d1");
    expect(d1?.valid).toBe(false);
    expect(d1?.violations.some((v) => v.message.includes("exceeds"))).toBe(
      true,
    );
  });

  it("only validates nodes matching targetClass", () => {
    const ugm = new UGM();
    ugm.addNode("x", { types: ["Unknown"], properties: {} });
    const results = validateShacl(ugm, SHAPES);
    expect(results).toHaveLength(0); // no matching shapes
  });
});

describe("summarizeValidation", () => {
  it("aggregates pass/fail counts per shape", () => {
    const ugm = makeUGM();
    const results = validateShacl(ugm, SHAPES);
    const summary = summarizeValidation(results);

    const diseaseSummary = summary.find((s) => s.shapeId === "disease-shape");
    expect(diseaseSummary?.totalNodes).toBe(3);
    expect(diseaseSummary?.passing).toBe(2); // d1, d2 pass
    expect(diseaseSummary?.failing).toBe(1); // d3 fails

    const drugSummary = summary.find((s) => s.shapeId === "drug-shape");
    expect(drugSummary?.totalNodes).toBe(2);
    expect(drugSummary?.failing).toBe(1); // p2 missing name
  });
});

// ── sh:closed (closed-world) enforcement, 2026-06-11 ────────────────

describe("sh:closed enforcement", () => {
  const closedShape: ShaclShape = {
    id: "ClosedPerson",
    targetClass: "Person",
    closed: true,
    ignoredProperties: ["label"],
    properties: [{ path: "name", minCount: 1 }],
  };

  function personWith(props: Record<string, unknown>): UGM {
    const ugm = new UGM();
    ugm.addNode("p", { types: ["Person"], properties: props });
    return ugm;
  }

  it("flags undeclared properties on closed shapes", () => {
    const results = validateShacl(
      personWith({ name: "Aris", label: "Aris", nickname: "Q" }),
      [closedShape],
    );
    const r = results[0]!;
    expect(r.valid).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]!.path).toBe("nickname");
    expect(r.violations[0]!.message).toContain("sh:closed");
  });

  it("exempts sh:ignoredProperties and declared paths", () => {
    const results = validateShacl(personWith({ name: "Aris", label: "Aris" }), [
      closedShape,
    ]);
    expect(results[0]!.valid).toBe(true);
  });

  it("leaves open shapes open-world (default)", () => {
    const open: ShaclShape = { ...closedShape, closed: false };
    const results = validateShacl(
      personWith({ name: "Aris", anything: "goes" }),
      [open],
    );
    expect(results[0]!.valid).toBe(true);
  });
});

// ── Issue #67: focus nodes from `targets`, `targetClass` optional ───

describe("focus-node selection from targets (#67)", () => {
  /** A small assembly graph: parts decompose into parts, suppliers
   *  supply parts, one orphan node with no edges at all. */
  function assembly(): UGM {
    const ugm = new UGM();
    ugm.addNode("whole", { types: ["Part"], properties: { pn: "W-1" } });
    ugm.addNode("half", { types: ["Part"], properties: { pn: "H-1" } });
    ugm.addNode("bolt", { types: ["Part"], properties: {} }); // no pn
    ugm.addNode("acme", { types: ["Supplier"], properties: { name: "Acme" } });
    ugm.addNode("orphan", { types: ["Note"], properties: {} });
    ugm.addEdge("whole", "half", { type: "decomposes" });
    ugm.addEdge("half", "bolt", { type: "decomposes" });
    ugm.addEdge("acme", "bolt", { type: "supplies" });
    return ugm;
  }
  const pn = { path: "pn", minCount: 1 };
  const ids = (results: ReturnType<typeof validateShacl>) =>
    results.map((r) => r.nodeId).sort();

  it("a class-only shape selects instances of the class, as before", () => {
    const results = validateShacl(assembly(), [
      { id: "PartShape", targetClass: "Part", properties: [pn] },
    ]);
    expect(ids(results)).toEqual(["bolt", "half", "whole"]);
    expect(results.find((r) => r.nodeId === "bolt")?.valid).toBe(false);
    // The class echo is unchanged for a class-only shape.
    expect(results[0]!.targetClass).toBe("Part");
  });

  it("a subjectsOf-only shape (no targetClass) selects edge sources", () => {
    const results = validateShacl(assembly(), [
      {
        id: "DecomposerShape",
        targets: [{ kind: "subjectsOf", value: "decomposes" }],
        properties: [pn],
      },
    ]);
    // whole and half are sources of a decomposes edge; bolt is only a
    // target of one, acme is the source of a different edge type.
    expect(ids(results)).toEqual(["half", "whole"]);
    expect(results.every((r) => r.valid)).toBe(true);
    // No class to echo: the key is absent, not `undefined`.
    expect("targetClass" in results[0]!).toBe(false);
  });

  it("an objectsOf shape selects edge targets", () => {
    const results = validateShacl(assembly(), [
      {
        id: "SuppliedShape",
        targets: [{ kind: "objectsOf", value: "supplies" }],
        properties: [pn],
      },
    ]);
    expect(ids(results)).toEqual(["bolt"]);
    expect(results[0]!.valid).toBe(false);
    expect(results[0]!.violations[0]!.path).toBe("pn");
  });

  it("a node target selects that node, and a missing id selects nothing", () => {
    const results = validateShacl(assembly(), [
      {
        id: "OrphanShape",
        targets: [
          { kind: "node", value: "orphan" },
          { kind: "node", value: "not-in-graph" },
        ],
        properties: [{ path: "name", minCount: 1 }],
      },
    ]);
    expect(ids(results)).toEqual(["orphan"]);
    expect(results[0]!.valid).toBe(false);
  });

  it("a sparql target selects nothing", () => {
    const results = validateShacl(assembly(), [
      {
        id: "SparqlShape",
        targets: [
          { kind: "sparql", value: "SELECT ?this WHERE { ?this a ex:Part }" },
        ],
        properties: [pn],
      },
    ]);
    expect(results).toHaveLength(0);
    expect(summarizeValidation(results)).toEqual([]);
  });

  it("dedupes a node reached by targetClass and again through targets", () => {
    const results = validateShacl(assembly(), [
      {
        id: "PartShape",
        targetClass: "Part",
        targets: [
          { kind: "class", value: "Part" },
          { kind: "subjectsOf", value: "decomposes" },
          { kind: "objectsOf", value: "supplies" },
        ],
        properties: [pn],
      },
    ]);
    // Every Part is reached two or three ways; one result each.
    expect(ids(results)).toEqual(["bolt", "half", "whole"]);
    expect(summarizeValidation(results)[0]).toMatchObject({
      shapeId: "PartShape",
      totalNodes: 3,
      passing: 2,
      failing: 1,
    });
  });

  it("the union of several target kinds is one result per node", () => {
    const results = validateShacl(assembly(), [
      {
        id: "Mixed",
        targets: [
          { kind: "class", value: "Supplier" },
          { kind: "objectsOf", value: "decomposes" },
          { kind: "node", value: "orphan" },
        ],
        properties: [],
      },
    ]);
    expect(ids(results)).toEqual(["acme", "bolt", "half", "orphan"]);
  });

  it("a shape with no target at all selects nothing", () => {
    for (const shape of [
      { id: "None", properties: [pn] },
      { id: "Empty", targets: [], properties: [pn] },
      // The pre-#67 placeholder for "no class target" keeps meaning
      // that: "" is not a class and matches no node.
      { id: "Placeholder", targetClass: "", properties: [pn] },
    ] satisfies ShaclShape[]) {
      expect(validateShacl(assembly(), [shape])).toHaveLength(0);
    }
  });

  it("an empty targetClass alongside targets selects only through targets", () => {
    const ugm = assembly();
    ugm.addNode("blank", { types: [""], properties: {} });
    const results = validateShacl(ugm, [
      {
        id: "S",
        targetClass: "",
        targets: [{ kind: "node", value: "orphan" }],
        properties: [],
      },
    ]);
    expect(ids(results)).toEqual(["orphan"]);
    // The host passed "", so the echo is "" as it was before.
    expect(results[0]!.targetClass).toBe("");
  });

  it("keeps node-major result order for class-only shapes", () => {
    const results = validateShacl(makeUGM(), SHAPES);
    expect(results.map((r) => `${r.nodeId}/${r.shapeId}`)).toEqual([
      "d1/disease-shape",
      "d2/disease-shape",
      "d3/disease-shape",
      "p1/drug-shape",
      "p2/drug-shape",
    ]);
  });
});
