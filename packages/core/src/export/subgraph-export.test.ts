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
