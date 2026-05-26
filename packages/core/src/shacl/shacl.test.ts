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
