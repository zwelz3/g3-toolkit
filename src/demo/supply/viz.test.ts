import { describe, it, expect } from "vitest";
import { buildDigitalThread } from "./model";
import { supplyShapes } from "./shapes";
import { analyzeGaps, clusterBy, tracePaths } from "./analytics";
import {
  gapOverlays,
  sourceCounts,
  clusterMembers,
  tracePathOverlay,
} from "./viz";

describe("supply-chain viz adapters", () => {
  it("splits gaps into violation and warning overlays with worst-tier wins", () => {
    const ugm = buildDigitalThread();
    const [violations, warnings] = gapOverlays(analyzeGaps(ugm, supplyShapes));
    expect(new Set(violations?.nodeIds)).toEqual(
      new Set(["part.spar", "part.fcc", "part.imu"]),
    );
    // imu is a violation, so it must NOT also appear in warnings
    expect(warnings?.nodeIds).not.toContain("part.imu");
    expect(new Set(warnings?.nodeIds)).toEqual(
      new Set([
        "part.harness",
        "sup.alpha",
        "sup.delta",
        "sup.epsilon",
        "sup.zeta",
      ]),
    );
  });

  it("summarizes provenance by source system", () => {
    const counts = sourceCounts(buildDigitalThread());
    const map = new Map(counts.map((c) => [c.source, c.count]));
    expect(map.get("ERP")).toBe(8); // 6 parts + 2 assemblies
    expect(map.get("SupplierDB")).toBe(7);
    expect(map.get("Logistics")).toBe(4);
    // sorted descending
    expect(counts[0]?.source).toBe("ERP");
  });

  it("inverts clusters into members sorted by size", () => {
    const members = clusterMembers(clusterBy(buildDigitalThread(), "region"));
    expect(members[0]?.label).toBe("EU-Central");
    expect(members[0]?.members.length).toBe(3);
  });

  it("builds a connected path overlay with nodes and edges", () => {
    const ugm = buildDigitalThread();
    const overlay = tracePathOverlay(
      ugm,
      tracePaths(ugm, "sup.alpha", "Assembly"),
    );
    expect(overlay.nodeIds).toContain("sup.alpha");
    expect(overlay.nodeIds).toContain("asm.airframe");
    expect(overlay.edgeIds.length).toBeGreaterThanOrEqual(2);
  });
});
