/**
 * Decision-dashboard reference logic tests. These cover the DATA layer
 * (graph construction at realistic scale) and the DERIVED-SIGNAL layer
 * (SHACL conformance, centrality, the impact walk) that run headlessly;
 * the React canvas mounts only in a browser, so the dashboard
 * components are not rendered here.
 */
import { describe, it, expect } from "vitest";
import {
  validateShacl,
  reportFromValidationResults,
  reportFocusNodes,
  degreeCentrality,
} from "@g3t/core";
import {
  buildSatelliteModel,
  designRules,
  fetchComponentRows,
} from "./satellite-data";
import {
  buildSupplyNetwork,
  fetchSupplyNodes,
  downstreamImpact,
  originCoverageByTier,
} from "./supply-data";
// downstreamImpact now lives with the supply data

describe("satellite data layer", () => {
  it("builds a realistically-scaled model (30+ components, multiple subsystems)", () => {
    const g = buildSatelliteModel();
    expect(g.getNodeIds().length).toBeGreaterThanOrEqual(30);
    const subsystems = new Set(fetchComponentRows().map((r) => r.subsystem));
    // Six subsystems give the graph real cluster structure.
    expect(subsystems.size).toBe(6);
  });

  it("preserves the deliberate data-quality defects", () => {
    const g = buildSatelliteModel();
    // PDU and the radiator are missing part numbers on purpose.
    expect(g.getNode("eps.pdu")!.properties.partNumber).toBeUndefined();
    expect(g.getNode("therm.rad")!.properties.partNumber).toBeUndefined();
  });
});

describe("conformance (derived signal)", () => {
  it("flags the missing part numbers and the over-mass component", () => {
    const g = buildSatelliteModel();
    const report = reportFromValidationResults(validateShacl(g, designRules()));
    expect(report.conforms).toBe(false);
    const failing = reportFocusNodes(report);
    expect(failing.has("eps.pdu")).toBe(true);
    expect(failing.has("therm.rad")).toBe(true);
    expect(failing.has("obc.fc")).toBe(true); // mass 240 > 100
    // A compliant component does not appear.
    expect(failing.has("adcs.star")).toBe(false);
  });

  it("assigns severities: missing id = violation, over-mass = warning", () => {
    const g = buildSatelliteModel();
    const report = reportFromValidationResults(validateShacl(g, designRules()));
    const pdu = report.results.find(
      (r) => r.focusNode === "eps.pdu" && r.path === "partNumber",
    );
    expect(pdu?.severity).toBe("violation");
    const fc = report.results.find(
      (r) => r.focusNode === "obc.fc" && r.path === "massKg",
    );
    expect(fc?.severity).toBe("warning");
  });

  it("emits info results for missing power budgets (third tier)", () => {
    const g = buildSatelliteModel();
    const report = reportFromValidationResults(validateShacl(g, designRules()));
    // Several components leave powerW unset -> info severity.
    expect(report.results.some((r) => r.severity === "info")).toBe(true);
  });
});

describe("supply data layer + impact", () => {
  it("builds a realistically-scaled network across four tiers", () => {
    const g = buildSupplyNetwork();
    expect(g.getNodeIds().length).toBeGreaterThanOrEqual(25);
    const tiers = new Set(fetchSupplyNodes().map((n) => n.tier));
    expect([...tiers].sort()).toEqual([
      "Assembly",
      "Part",
      "Product",
      "Supplier",
    ]);
  });

  it("centrality surfaces a single-source supplier as a choke point", () => {
    const g = buildSupplyNetwork();
    const c = degreeCentrality(g);
    // Acme single-sources four parts; out-ranks a niche supplier.
    expect(c.get("acme")!).toBeGreaterThan(c.get("umbrella")!);
  });

  it("traces the downstream blast radius of a supplier", () => {
    const g = buildSupplyNetwork();
    const impact = downstreamImpact(g, "acme");
    // Acme -> parts -> assemblies -> products: a broad radius.
    expect(impact).toEqual(
      expect.arrayContaining(["bearing", "gearbox", "actuator"]),
    );
    expect(impact).not.toContain("acme");
  });

  it("reports an empty blast radius for an end product (leaf)", () => {
    const g = buildSupplyNetwork();
    expect(downstreamImpact(g, "actuator")).toEqual([]);
  });
});

describe("origin coverage (CoverageMeter fold)", () => {
  it("is a real partial-coverage signal: at least one tier under 100%", () => {
    const rows = originCoverageByTier(buildSupplyNetwork());
    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows) {
      expect(r.substantiated).toBeGreaterThanOrEqual(0);
      expect(r.substantiated).toBeLessThanOrEqual(1);
      expect(r.total).toBeGreaterThan(0);
    }
    expect(rows.some((r) => r.substantiated < 1)).toBe(true);
  });
});
