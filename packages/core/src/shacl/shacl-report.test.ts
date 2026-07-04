/**
 * SHACL validation report visualization (slice B1, R1.17).
 *
 * @see roadmap/design/shacl-views.md
 */
import { describe, it, expect } from "vitest";
import type { ShaclValidationResult } from "./shacl-validator";
import {
  parseShaclReport,
  reportFromValidationResults,
  severityOverlays,
  severityOverlayId,
  shaclResultDrivers,
  reportFocusNodes,
  resultsForShape,
  type ShaclReportDocument,
} from "./shacl-report";

function validationFixture(): ShaclValidationResult[] {
  return [
    {
      nodeId: "person-1",
      shapeId: "PersonShape",
      shapeName: "Person",
      targetClass: "Person",
      valid: false,
      violations: [
        { path: "name", message: "missing", severity: "violation" },
        { path: "age", message: "low", severity: "warning" },
      ],
    },
    {
      nodeId: "person-2",
      shapeId: "PersonShape",
      shapeName: "Person",
      targetClass: "Person",
      valid: false,
      violations: [{ path: "email", message: "bad", severity: "violation" }],
    },
  ];
}

describe("reportFromValidationResults", () => {
  it("flattens validation results into a versioned report", () => {
    const report = reportFromValidationResults(validationFixture());
    expect(report.version).toBe(1);
    expect(report.conforms).toBe(false);
    expect(report.source).toBe("g3t in-core");
    expect(report.results).toHaveLength(3);
    expect(report.results[0]).toMatchObject({
      focusNode: "person-1",
      path: "name",
      severity: "violation",
      sourceShape: "PersonShape",
    });
  });

  it("reports conformance for an empty result set", () => {
    const report = reportFromValidationResults([]);
    expect(report.conforms).toBe(true);
    expect(report.results).toEqual([]);
  });
});

describe("parseShaclReport", () => {
  it("accepts a version-1 document", () => {
    const doc: ShaclReportDocument = {
      version: 1,
      conforms: true,
      results: [],
    };
    expect(parseShaclReport(doc)).toBe(doc);
  });
  it("rejects a non-version-1 or malformed value", () => {
    expect(() => parseShaclReport({ version: 2, results: [] })).toThrow();
    expect(() => parseShaclReport({ version: 1 })).toThrow();
    expect(() => parseShaclReport(null)).toThrow();
  });
});

describe("severityOverlays", () => {
  it("derives one overlay per non-empty severity tier over focus nodes", () => {
    const report = reportFromValidationResults(validationFixture());
    const overlays = severityOverlays(report);
    // violation + warning tiers present; no info tier.
    expect(overlays.map((o) => o.id).sort()).toEqual([
      severityOverlayId("violation"),
      severityOverlayId("warning"),
    ]);
    const viol = overlays.find((o) => o.id === severityOverlayId("violation"))!;
    expect(viol.nodeIds.sort()).toEqual(["person-1", "person-2"]);
    expect(viol.label).toBe("Violations");
  });

  it("includes path edges when a resolver is supplied", () => {
    const report = reportFromValidationResults(validationFixture());
    const overlays = severityOverlays(report, (focus, path) =>
      focus === "person-1" && path === "name" ? ["edge-name-1"] : [],
    );
    const viol = overlays.find((o) => o.id === severityOverlayId("violation"))!;
    expect(viol.edgeIds).toContain("edge-name-1");
  });

  it("omits tiers with no results", () => {
    const report: ShaclReportDocument = {
      version: 1,
      conforms: false,
      results: [{ focusNode: "n", severity: "info" }],
    };
    const overlays = severityOverlays(report);
    expect(overlays).toHaveLength(1);
    expect(overlays[0]!.id).toBe(severityOverlayId("info"));
  });
});

describe("shaclResultDrivers", () => {
  it("ingests per-node count and worst severity", () => {
    const report = reportFromValidationResults(validationFixture());
    const drivers = shaclResultDrivers(report);
    expect(drivers.get("person-1")).toEqual({
      _shacl_resultCount: 2,
      _shacl_maxSeverity: "violation",
    });
    expect(drivers.get("person-2")).toEqual({
      _shacl_resultCount: 1,
      _shacl_maxSeverity: "violation",
    });
  });

  it("takes the worst severity when a node has mixed tiers", () => {
    const report: ShaclReportDocument = {
      version: 1,
      conforms: false,
      results: [
        { focusNode: "n", severity: "info" },
        { focusNode: "n", severity: "warning" },
      ],
    };
    expect(shaclResultDrivers(report).get("n")).toEqual({
      _shacl_resultCount: 2,
      _shacl_maxSeverity: "warning",
    });
  });
});

describe("reportFocusNodes / resultsForShape", () => {
  it("collects unique focus nodes", () => {
    const report = reportFromValidationResults(validationFixture());
    expect([...reportFocusNodes(report)].sort()).toEqual([
      "person-1",
      "person-2",
    ]);
  });

  it("filters results by source shape (shape-selection -> report filter)", () => {
    const report = reportFromValidationResults(validationFixture());
    expect(resultsForShape(report, "PersonShape")).toHaveLength(3);
    expect(resultsForShape(report, "OtherShape")).toHaveLength(0);
  });
});
