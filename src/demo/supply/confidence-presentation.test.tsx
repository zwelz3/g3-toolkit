// VR-2 (owner verification 2026-07-28): the PRESENTATION oracle.
// The browser run received the dark theme's edgeColor (#555b63)
// because themeColorRules pushed AFTER the encoding rules and its
// plain `edge { line-color }` clobbered `edge[_ecolor]` (cytoscape:
// later rules win). This asserts the COMPUTED color through the
// canvas's REAL stylesheet merge, headless: the exact failure mode
// a DEFAULT+ENCODING-only compose could not catch.
import { describe, it, expect } from "vitest";
import cytoscape from "cytoscape";
import { composeCanvasStylesheet } from "../../../packages/react/src/views/canvas/CytoscapeCanvas";
import { DARK_THEME } from "../../../packages/react/src/theme/ThemeManager";
import { ugmToCytoscapeElements, applyEncodingSpec } from "@g3t/react";
import type { EncodingSpec } from "@g3t/react";
import { buildDigitalThread } from "./model";

describe("VR-2: color-by-confidence PRESENTATION (real merge, computed styles)", () => {
  it("supplies edges compute amber; ownership computes green", () => {
    const ugm = buildDigitalThread();
    const spec: EncodingSpec = {
      version: 1,
      node: {},
      edge: {
        color: {
          driver: "confBand",
          scale: {
            kind: "categorical",
            overrides: {
              authoritative: "#22c55e",
              merged: "#eab308",
              low: "#ef4444",
            },
          },
        },
      },
    };
    const cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: ugmToCytoscapeElements(ugm, {}),
      style: composeCanvasStylesheet(
        DARK_THEME,
      ) as unknown as cytoscape.StylesheetJson,
    });
    const patch = applyEncodingSpec(spec, ugm);
    cy.batch(() => {
      patch.edges.forEach((data, id) => {
        const ele = cy.getElementById(id);
        if (ele.nonempty()) ele.data(data);
      });
    });
    const supplies = cy.edges("[type = 'supplies']");
    expect(supplies.length).toBeGreaterThan(0);
    expect(supplies.first().style("line-color")).toBe("rgb(234,179,8)");
    const own = cy.edges("[type = 'partOf']");
    expect(own.length).toBeGreaterThan(0);
    expect(own.first().style("line-color")).toBe("rgb(34,197,94)");

    // VR-2 follow-up (owner verification 2026-07-28): LEAVING color
    // mode must revert. A channel dropped from the spec clears its
    // stale data, or edge[_ecolor] matches forever.
    const offSpec: EncodingSpec = { version: 1, node: {}, edge: {} };
    const offPatch = applyEncodingSpec(offSpec, ugm);
    cy.batch(() => {
      cy.edges().forEach((ele) => {
        const data = offPatch.edges.get(ele.id());
        for (const k of ["_ecolor", "_ewidth"]) {
          if (
            (data === undefined || !(k in data)) &&
            ele.data(k) !== undefined
          ) {
            ele.removeData(k);
          }
        }
      });
      offPatch.edges.forEach((data, id) => {
        const ele = cy.getElementById(id);
        if (ele.nonempty()) ele.data(data);
      });
    });
    expect(supplies.first().data("_ecolor")).toBeUndefined();
    // Headless style computation needs an explicit nudge after
    // removeData (the live renderer restyles on the data event).
    cy.style().update();
    // Back to the theme's edge color (dark: #555b63).
    expect(supplies.first().style("line-color")).toBe("rgb(85,91,99)");
  });
});
