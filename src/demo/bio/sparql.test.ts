import { describe, it, expect } from "vitest";
import { bioGraph, rdfToUgm, EX } from "./rdf";
import { executeSparql, termText, termNumber } from "./sparql";
import { defaultQueries } from "./queries";

function run(q: string) {
  const r = executeSparql(bioGraph, q);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe("in-browser SPARQL executor", () => {
  it("matches a single pattern with the `a` keyword", () => {
    const r = run(`PREFIX ex: <${EX}> SELECT ?g WHERE { ?g a ex:Gene }`);
    expect(r.rows.length).toBe(4);
    expect(r.rows.every((row) => row.g?.kind === "uri")).toBe(true);
  });

  it("joins across patterns sharing a variable", () => {
    const r = run(
      `PREFIX ex: <${EX}> SELECT ?drug ?protein WHERE { ?drug ex:targets ?protein }`,
    );
    expect(r.rows.length).toBe(2);
  });

  it("expands ; abbreviations into multiple patterns", () => {
    const r = run(defaultQueries[1]?.sparql ?? "");
    // Olaparib and Erlotinib both target a protein AND treat a disease; Donepezil targets nothing
    expect(r.head).toEqual(["drug", "protein", "disease"]);
    expect(r.rows.length).toBe(2);
  });

  it("orders by a numeric literal descending", () => {
    const r = run(defaultQueries[2]?.sparql ?? "");
    expect(r.rows.length).toBe(4);
    expect(termText(r.rows[0]?.protein ?? { kind: "uri", value: "" })).toBe(
      EX + "BRCA1p",
    );
    expect(termNumber(r.rows[0]?.mw ?? { kind: "uri", value: "" })).toBe(207.7);
  });

  it("applies a numeric FILTER", () => {
    const r = run(
      `PREFIX ex: <${EX}> SELECT ?drug ?year WHERE { ?drug a ex:Drug ; ex:approvalYear ?year . FILTER(?year > 2010) }`,
    );
    expect(r.rows.length).toBe(1);
    expect(termText(r.rows[0]?.drug ?? { kind: "uri", value: "" })).toBe(
      EX + "Olaparib",
    );
  });

  it("honors LIMIT and SELECT *", () => {
    const r = run(
      `PREFIX ex: <${EX}> SELECT * WHERE { ?s a ex:Disease } LIMIT 2`,
    );
    expect(r.rows.length).toBe(2);
    expect(r.head).toContain("s");
  });

  it("supports DISTINCT", () => {
    // every disease that some gene is associated with; DISTINCT collapses dups
    const r = run(
      `PREFIX ex: <${EX}> SELECT DISTINCT ?disease WHERE { ?gene ex:associatedWith ?disease }`,
    );
    expect(r.rows.length).toBe(3); // BreastCancer, LungCancer, Alzheimer
  });

  it("returns a structured error for malformed queries", () => {
    const r = executeSparql(bioGraph, "SELECT ?x WHERE { ?x ex:foo");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(typeof r.error).toBe("string");
  });

  it("runs every default query without error", () => {
    for (const q of defaultQueries) {
      const r = executeSparql(bioGraph, q.sparql);
      expect(r.ok, `${q.id}: ${r.ok ? "" : r.error}`).toBe(true);
    }
  });
});

describe("RDF to UGM projection", () => {
  it("projects typed instances into nodes with numeric properties", () => {
    const ugm = rdfToUgm(bioGraph);
    const nodes: Array<{
      id: string;
      types: string[];
      props: Record<string, unknown>;
    }> = [];
    ugm.forEachNode((id, attrs) =>
      nodes.push({ id, types: attrs.types, props: attrs.properties }),
    );
    // 4 genes + 4 proteins + 3 diseases + 3 drugs + 2 pathways = 16 instances
    expect(nodes.length).toBe(16);
    const brca1p = nodes.find((n) => n.id === EX + "BRCA1p");
    expect(brca1p?.types).toContain("Protein");
    expect(brca1p?.props.molecularWeight).toBe(207.7); // numeric, not string
  });

  it("creates edges only between typed instances", () => {
    const ugm = rdfToUgm(bioGraph);
    const edges: Array<{ type: unknown; s: string; t: string }> = [];
    ugm.forEachEdge((_e, attrs, s, t) =>
      edges.push({ type: attrs.type, s, t }),
    );
    expect(
      edges.some(
        (e) =>
          e.type === "encodes" && e.s === EX + "BRCA1" && e.t === EX + "BRCA1p",
      ),
    ).toBe(true);
    expect(edges.some((e) => e.type === "targets")).toBe(true);
    // rdf:type and subClassOf never become edges
    expect(
      edges.some((e) => e.type === "type" || e.type === "subClassOf"),
    ).toBe(false);
  });
});
