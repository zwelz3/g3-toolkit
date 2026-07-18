/**
 * Multi-type split-ring stamping (review 5.21). Pins: equal-share
 * slices from the categorical map for 2+ type nodes; single-type
 * nodes untouched; slice cap at MAX_SLICES; unknown-color types skip
 * the node (a ring with a wrong or missing color would lie against
 * the legend); per-slice stylesheet rules are attribute-guarded.
 */
import { describe, it, expect } from "vitest";
import { UGM } from "@g3t/core";
import {
  stampMultiTypePies,
  MULTI_TYPE_PIE_RULES,
  MAX_SLICES,
} from "./multi-type";

const COLORS = new Map([
  ["A", "#111111"],
  ["B", "#222222"],
  ["C", "#333333"],
  ["D", "#444444"],
  ["E", "#555555"],
]);

describe("stampMultiTypePies", () => {
  it("stamps equal-share slices for a two-type node and skips single-type", () => {
    const g = new UGM();
    g.addNode("multi", { types: ["A", "B"], properties: {} });
    g.addNode("single", { types: ["A"], properties: {} });
    stampMultiTypePies(g, COLORS);
    const m = g.getNode("multi")?.properties;
    expect(m?._pieSize).toBe("100%");
    expect(m?._pie1Color).toBe("#111111");
    expect(m?._pie2Color).toBe("#222222");
    expect(m?._pie1Size).toBe(50);
    expect(m?._pie2Size).toBe(50);
    expect(m?._pie3Color).toBeUndefined();
    expect(g.getNode("single")?.properties._pieSize).toBeUndefined();
  });

  it("caps at MAX_SLICES memberships", () => {
    const g = new UGM();
    g.addNode("n", { types: ["A", "B", "C", "D", "E"], properties: {} });
    stampMultiTypePies(g, COLORS);
    const p = g.getNode("n")?.properties;
    expect(p?.[`_pie${MAX_SLICES}Color`]).toBe("#444444");
    expect(p?.[`_pie${MAX_SLICES + 1}Color`]).toBeUndefined();
  });

  it("skips nodes whose types lack a color: a ring must never lie against the legend", () => {
    const g = new UGM();
    g.addNode("n", { types: ["A", "Unknown"], properties: {} });
    stampMultiTypePies(g, COLORS);
    expect(g.getNode("n")?.properties._pie1Color).toBeUndefined();
  });
});

describe("MULTI_TYPE_PIE_RULES", () => {
  it("is one attribute-guarded rule per slice (mapping-warning discipline)", () => {
    expect(MULTI_TYPE_PIE_RULES).toHaveLength(MAX_SLICES);
    MULTI_TYPE_PIE_RULES.forEach((rule, i) => {
      expect(rule.selector).toBe(`node[_pie${i + 1}Color]`);
      expect(rule.style[`pie-${i + 1}-background-color`]).toBe(
        `data(_pie${i + 1}Color)`,
      );
    });
  });
});
