import { describe, it, expect } from "vitest";
import { validateShacl } from "@g3t/core";
import { buildDigitalThread } from "./model";
import { supplyShapes, SHAPE_CERT } from "./shapes";
import {
  soleSourceParts,
  singlePointsOfFailure,
  clusterBy,
  tracePaths,
  analyzeGaps,
} from "./analytics";

function propOf(
  ugm: ReturnType<typeof buildDigitalThread>,
  id: string,
  key: string,
): unknown {
  let value: unknown;
  ugm.forEachNode((nodeId, attrs) => {
    if (nodeId === id) value = attrs.properties[key];
  });
  return value;
}

describe("supply-chain digital thread", () => {
  it("materializes derived certification status across sources", () => {
    const ugm = buildDigitalThread();
    // imu is sole-sourced to a supplier with no ITAR grant -> missing
    expect(propOf(ugm, "part.imu", "certificationStatus")).toBe("missing");
    // spar's sole supplier holds NADCAP -> covered
    expect(propOf(ugm, "part.spar", "certificationStatus")).toBe("covered");
    // supplierCount is materialized
    expect(propOf(ugm, "part.skin", "supplierCount")).toBe(2);
    expect(propOf(ugm, "part.spar", "supplierCount")).toBe(1);
    // provenance tag survives consolidation
    expect(propOf(ugm, "sup.alpha", "source")).toBe("SupplierDB");
  });

  it("identifies sole-source parts and single-point-of-failure suppliers", () => {
    const ugm = buildDigitalThread();
    expect(soleSourceParts(ugm).sort()).toEqual([
      "part.fcc",
      "part.harness",
      "part.imu",
      "part.spar",
    ]);
    expect(singlePointsOfFailure(ugm).sort()).toEqual([
      "sup.alpha",
      "sup.delta",
      "sup.epsilon",
      "sup.zeta",
    ]);
  });

  it("clusters by region, tier, and connected component", () => {
    const ugm = buildDigitalThread();
    const region = clusterBy(ugm, "region");
    expect(region.get("sup.alpha")).toBe("US-West");
    expect(region.has("sup.epsilon")).toBe(false); // no region -> not clustered
    const tier = clusterBy(ugm, "tier");
    expect(tier.get("sup.alpha")).toBe("Tier 1");
    expect(tier.get("sup.zeta")).toBe("Tier 3");
    const comp = clusterBy(ugm, "component");
    expect(comp.get("part.spar")).toMatch(/^Component /);
  });

  it("traces downstream paths from a supplier to assemblies", () => {
    const ugm = buildDigitalThread();
    const paths = tracePaths(ugm, "sup.alpha", "Assembly");
    // alpha supplies spar and skin, both in the airframe assembly
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths.every((p) => p[0] === "sup.alpha")).toBe(true);
    expect(paths.some((p) => p[p.length - 1] === "asm.airframe")).toBe(true);
  });

  it("SHACL flags the missing-cert part and the incomplete supplier record", () => {
    const ugm = buildDigitalThread();
    const results = validateShacl(ugm, supplyShapes);
    const imu = results.find(
      (r) => r.nodeId === "part.imu" && r.shapeId === SHAPE_CERT,
    );
    expect(imu?.valid).toBe(false);
    const spar = results.find(
      (r) => r.nodeId === "part.spar" && r.shapeId === SHAPE_CERT,
    );
    expect(spar?.valid).toBe(true);
    // epsilon has no region -> provenance warning
    const eps = results.find((r) => r.nodeId === "sup.epsilon" && !r.valid);
    expect(eps).toBeTruthy();
  });

  it("merges structural and SHACL findings into one gap report", () => {
    const ugm = buildDigitalThread();
    const gaps = analyzeGaps(ugm, supplyShapes);
    const imuKinds = gaps
      .filter((g) => g.nodeId === "part.imu")
      .map((g) => g.kind)
      .sort();
    expect(imuKinds).toEqual(["missing-certification", "sole-source"]);
    // a critical sole-sourced part escalates to violation
    const imuSole = gaps.find(
      (g) => g.nodeId === "part.imu" && g.kind === "sole-source",
    );
    expect(imuSole?.severity).toBe("violation");
    // epsilon carries both SPOF and provenance findings
    const epsKinds = gaps
      .filter((g) => g.nodeId === "sup.epsilon")
      .map((g) => g.kind)
      .sort();
    expect(epsKinds).toEqual([
      "incomplete-provenance",
      "single-point-of-failure",
    ]);
  });
});
