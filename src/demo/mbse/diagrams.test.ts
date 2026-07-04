import { describe, it, expect } from "vitest";
import { layoutStructural } from "@g3t/core";
import { satelliteModel } from "./model";
import { projectDiagram } from "./diagrams";

describe("SysML diagram projections", () => {
  it("bdd: blocks with compartments and composition relationships", () => {
    const g = projectDiagram(satelliteModel, "dg.bdd");
    expect(g.nodes.map((n) => n.id)).toContain("smallsat");
    const eps = g.nodes.find((n) => n.id === "eps");
    expect(eps?.header?.name).toBe("PowerSubsystem");
    // value compartment carries "name: type" rows
    const vals = eps?.compartments?.find((c) => c.id === "eps.values");
    expect(vals?.rows.some((r) => r.text === "solarArrayPower: W")).toBe(true);
    // every composition edge is present and correctly kinded
    const comp = g.edges.filter((e) => e.kind === "composition");
    expect(comp.length).toBe(5);
    expect(comp.every((e) => e.source === "smallsat")).toBe(true);
  });

  it("bdd: drops relationships whose endpoints are not on the diagram", () => {
    const model = {
      ...satelliteModel,
      diagrams: {
        ...satelliteModel.diagrams,
        probe: {
          id: "probe",
          name: "P",
          type: "bdd" as const,
          context: "smallsat",
          blocks: ["smallsat", "eps"],
          relationships: ["c.power", "c.adcs"],
        },
      },
    };
    const g = projectDiagram(model, "probe");
    // c.adcs targets adcs, which is not on this diagram -> dropped
    expect(g.edges.map((e) => e.id)).toEqual(["c.power"]);
  });

  it("ibd: parts carry ports and connectors attach to them", () => {
    const g = projectDiagram(satelliteModel, "dg.ibd");
    const power = g.nodes.find((n) => n.id === "p.power");
    expect(power?.header?.name).toBe("power : PowerSubsystem");
    expect(power?.ports?.map((p) => p.id)).toContain("p.power.pout");
    const pwrEdge = g.edges.find((e) => e.id === "n.pwr.adcs");
    expect(pwrEdge?.sourcePort).toBe("p.power.pout");
    expect(pwrEdge?.targetPort).toBe("p.adcs.pin");
    expect(pwrEdge?.kind).toBe("association");
  });

  it("par: constraint block exposes a port per parameter and bindings attach", () => {
    const g = projectDiagram(satelliteModel, "dg.par");
    const cb = g.nodes.find((n) => n.id === "powerBudget");
    expect(cb?.header?.stereotype).toBe("constraint");
    expect(cb?.ports?.map((p) => p.id).sort()).toEqual([
      "powerBudget.consumed",
      "powerBudget.generated",
      "powerBudget.margin",
    ]);
    // the equation rides a constraints compartment
    const eq = cb?.compartments?.find((c) => c.id === "powerBudget.eq");
    expect(eq?.rows[0]?.text).toBe("{margin = generated - consumed}");
    // bindings render as value boxes wired into the matching parameter port
    const bind = g.edges.find((e) => e.id === "bind.b.gen");
    expect(bind?.target).toBe("powerBudget");
    expect(bind?.targetPort).toBe("powerBudget.generated");
    expect(g.nodes.some((n) => n.id === "val.b.gen")).toBe(true);
  });

  it("req: requirement tree with containment and satisfy links", () => {
    const g = projectDiagram(satelliteModel, "dg.req");
    // root + 4 leaves = 5 requirement nodes, plus the 4 satisfying blocks
    const reqNodes = g.nodes.filter(
      (n) => n.header?.stereotype === "requirement",
    );
    expect(reqNodes.length).toBe(5);
    const mission = g.nodes.find((n) => n.id === "mission");
    expect(
      mission?.compartments?.find((c) => c.id === "mission.id")?.rows[0]?.text,
    ).toBe("R1");
    // containment: 4 composition edges root -> leaf
    const containment = g.edges.filter((e) => e.kind === "composition");
    expect(containment.length).toBe(4);
    expect(containment.every((e) => e.source === "mission")).toBe(true);
    // satisfy: 4 dependency edges from blocks, and those blocks are present
    const satisfy = g.edges.filter((e) => e.kind === "dependency");
    expect(satisfy.length).toBe(4);
    expect(satisfy.every((e) => e.label === "\u00ABsatisfy\u00BB")).toBe(true);
    expect(
      g.nodes.some((n) => n.id === "eps" && n.header?.stereotype === "block"),
    ).toBe(true);
  });

  it("projectDiagram returns empty for an unknown diagram id", () => {
    expect(projectDiagram(satelliteModel, "nope")).toEqual({
      nodes: [],
      edges: [],
    });
  });

  // Integration: every projected diagram must be a valid layout input.
  for (const id of ["dg.bdd", "dg.ibd", "dg.par", "dg.req"]) {
    it(`layout smoke: ${id} lays out without error and places every node`, async () => {
      const g = projectDiagram(satelliteModel, id);
      const geometry = await layoutStructural(g, {
        direction: id === "dg.req" ? "DOWN" : "RIGHT",
      });
      for (const n of g.nodes) {
        expect(
          geometry.nodes[n.id],
          `missing geometry for ${n.id}`,
        ).toBeTruthy();
      }
    });
  }
});
