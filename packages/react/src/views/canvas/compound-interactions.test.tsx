// Upstream round-6 P2 (2026-07-28): the compound-mode verification
// matrix. Containment support becomes VERIFIED behavior rather than
// incidental: element structure, context-menu targeting on children
// vs parents, and selection propagation, all against real headless
// cytoscape. (Child drag across parent bounds is renderer-driven
// and stays with the e2e layer.)
import { describe, it, expect } from "vitest";
import cytoscape from "cytoscape";
import { UGM } from "@g3t/core";
import { ugmToCytoscapeElements } from "./ugm-to-cytoscape";

function compoundUgm(): UGM {
  const ugm = new UGM();
  ugm.addNode("sys", { types: ["System"], properties: { name: "System" } });
  ugm.addNode("obc", { types: ["Part"], properties: { name: "OBC" } });
  ugm.addNode("adcs", { types: ["Part"], properties: { name: "ADCS" } });
  ugm.addEdge("sys", "obc", { type: "contains", properties: {} });
  ugm.addEdge("sys", "adcs", { type: "contains", properties: {} });
  ugm.addEdge("obc", "adcs", { type: "link", properties: {} });
  return ugm;
}

const CONTAINMENT = {
  edgeType: "contains",
  direction: "parentToChild" as const,
};

describe("compound interaction matrix", () => {
  it("children carry their parent in element data and cytoscape nests them", () => {
    const elements = ugmToCytoscapeElements(compoundUgm(), {
      containment: CONTAINMENT,
    });
    const cy = cytoscape({ headless: true, elements });
    const obc = cy.getElementById("obc");
    expect(obc.parent().first().id()).toBe("sys");
    expect(cy.getElementById("sys").children().length).toBe(2);
  });

  it("tap events on a child target the CHILD, not the compound parent", () => {
    const elements = ugmToCytoscapeElements(compoundUgm(), {
      containment: CONTAINMENT,
    });
    const cy = cytoscape({ headless: true, elements });
    const seen: string[] = [];
    cy.on("cxttap", "node", (evt) => {
      seen.push(evt.target.id());
    });
    cy.getElementById("obc").emit("cxttap");
    expect(seen).toEqual(["obc"]);
  });

  it("selecting a child does not select the parent, and selection events fire per element", () => {
    const elements = ugmToCytoscapeElements(compoundUgm(), {
      containment: CONTAINMENT,
    });
    const cy = cytoscape({ headless: true, elements });
    const selected: string[] = [];
    cy.on("select", "node", (evt) => selected.push(evt.target.id()));
    cy.getElementById("adcs").select();
    expect(selected).toEqual(["adcs"]);
    expect(cy.getElementById("sys").selected()).toBe(false);
  });

  it("an edge between siblings survives compound conversion intact", () => {
    const elements = ugmToCytoscapeElements(compoundUgm(), {
      containment: CONTAINMENT,
    });
    const cy = cytoscape({ headless: true, elements });
    const edges = cy.edges();
    expect(edges.length).toBe(1);
    expect(edges.first().source().id()).toBe("obc");
    expect(edges.first().target().id()).toBe("adcs");
  });
});
