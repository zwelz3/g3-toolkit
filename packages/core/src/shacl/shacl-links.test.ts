/**
 * SHACL linked shape-and-data views (slice B4).
 *
 * @see roadmap/design/shacl-views.md
 */
import { describe, it, expect } from "vitest";
import type { ShaclReportResult } from "./shacl-report";
import { shaclRowId } from "./shacl-to-structural";
import {
  resultTargets,
  resultSelectionIds,
  resultDetail,
  resultsForFocusNode,
} from "./shacl-links";

const propertyResult: ShaclReportResult = {
  focusNode: "person-1",
  path: "name",
  severity: "violation",
  sourceShape: "PersonShape",
  message: "missing required name",
  value: undefined,
};

const nodeLevelResult: ShaclReportResult = {
  focusNode: "person-2",
  severity: "warning",
  sourceShape: "PersonShape",
};

const sourcelessResult: ShaclReportResult = {
  focusNode: "person-3",
  severity: "info",
};

describe("resultTargets", () => {
  it("resolves data node, shape container, and property row for a property result", () => {
    const t = resultTargets(propertyResult);
    expect(t.dataNodeId).toBe("person-1");
    expect(t.shapeContainerId).toBe("PersonShape");
    expect(t.shapeRowId).toBe(shaclRowId("PersonShape", "name"));
  });

  it("omits the row for a node-level result (container is the finest target)", () => {
    const t = resultTargets(nodeLevelResult);
    expect(t.dataNodeId).toBe("person-2");
    expect(t.shapeContainerId).toBe("PersonShape");
    expect(t.shapeRowId).toBeUndefined();
  });

  it("omits shape targets entirely when there is no source shape", () => {
    const t = resultTargets(sourcelessResult);
    expect(t.dataNodeId).toBe("person-3");
    expect(t.shapeContainerId).toBeUndefined();
    expect(t.shapeRowId).toBeUndefined();
  });
});

describe("resultSelectionIds", () => {
  it("lists data node, container, and row in stable order", () => {
    expect(resultSelectionIds(propertyResult)).toEqual([
      "person-1",
      "PersonShape",
      shaclRowId("PersonShape", "name"),
    ]);
  });

  it("lists only the present targets", () => {
    expect(resultSelectionIds(nodeLevelResult)).toEqual([
      "person-2",
      "PersonShape",
    ]);
    expect(resultSelectionIds(sourcelessResult)).toEqual(["person-3"]);
  });
});

describe("resultDetail", () => {
  it("shapes a result for inspector display", () => {
    expect(resultDetail(propertyResult)).toEqual({
      focusNode: "person-1",
      sourceShape: "PersonShape",
      path: "name",
      severity: "violation",
      message: "missing required name",
      value: undefined,
    });
  });
});

describe("resultsForFocusNode", () => {
  it("collects results for a selected data node", () => {
    const results = [propertyResult, nodeLevelResult, sourcelessResult];
    expect(resultsForFocusNode(results, "person-1")).toEqual([propertyResult]);
    expect(resultsForFocusNode(results, "absent")).toEqual([]);
  });
});
