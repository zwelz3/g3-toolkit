/**
 * Palette tests (M0.E3.T4 partial): verify Okabe-Ito palette and shape mapping.
 */

import { describe, it, expect } from "vitest";
import {
  OKABE_ITO_COLORS,
  NODE_SHAPES,
  colorForIndex,
  shapeForIndex,
  buildTypeVisualMap,
} from "./palette";

describe("Okabe-Ito palette", () => {
  it("has 8 colors", () => {
    expect(OKABE_ITO_COLORS).toHaveLength(8);
  });

  it("has 8 shapes", () => {
    expect(NODE_SHAPES).toHaveLength(8);
  });

  it("wraps colors on overflow", () => {
    expect(colorForIndex(0)).toBe(colorForIndex(8));
    expect(colorForIndex(1)).toBe(colorForIndex(9));
  });

  it("wraps shapes on overflow", () => {
    expect(shapeForIndex(0)).toBe(shapeForIndex(8));
    expect(shapeForIndex(1)).toBe(shapeForIndex(9));
  });

  it("maps each color to a distinct shape", () => {
    // Ensure shape provides a redundant channel (R7.8)
    const shapes = new Set(NODE_SHAPES);
    expect(shapes.size).toBe(8);
  });
});

describe("buildTypeVisualMap", () => {
  it("maps types to distinct color/shape pairs", () => {
    const types = new Set(["Person", "Organization", "Location"]);
    const map = buildTypeVisualMap(types);

    expect(map.size).toBe(3);
    const colors = new Set([...map.values()].map((v) => v.color));
    const shapes = new Set([...map.values()].map((v) => v.shape));
    expect(colors.size).toBe(3);
    expect(shapes.size).toBe(3);
  });

  it("produces stable ordering (alphabetical)", () => {
    const types = new Set(["Zebra", "Apple", "Mango"]);
    const map = buildTypeVisualMap(types);

    // Apple < Mango < Zebra alphabetically
    const entries = [...map.entries()];
    expect(entries[0]![0]).toBe("Apple");
    expect(entries[1]![0]).toBe("Mango");
    expect(entries[2]![0]).toBe("Zebra");
  });

  it("handles empty type set", () => {
    const map = buildTypeVisualMap(new Set());
    expect(map.size).toBe(0);
  });
});
