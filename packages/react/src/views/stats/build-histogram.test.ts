/**
 * buildHistogram (review item 3.5): the fixed-20-bin construction
 * made integer domains (degree distributions) render as mostly-empty
 * fractional bins with "1.00-1.35"-style labels, which read as broken
 * x bounds. Pins: integer domains bin per integer, degenerate domains
 * get one bin, continuous domains keep the requested bin count, and
 * every value lands in exactly one bin.
 */
import { describe, it, expect } from "vitest";
import { UGM } from "@g3t/core";
import { buildHistogram } from "./StatsPanel";

function ugmWithValues(values: number[]): UGM {
  const g = new UGM();
  values.forEach((v, i) => {
    g.addNode(`n${i}`, { types: ["T"], properties: { x: v } });
  });
  return g;
}

describe("buildHistogram", () => {
  it("bins integer domains one per integer with integer labels", () => {
    const bins = buildHistogram(ugmWithValues([1, 1, 2, 3, 3, 3, 8]), "x", 20);
    expect(bins.length).toBe(8); // 1..8
    expect(bins.map((b) => b.label)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);
    expect(bins[0]?.count).toBe(2);
    expect(bins[2]?.count).toBe(3);
    expect(bins[7]?.count).toBe(1);
  });

  it("degenerate single-value domain yields one bin, not one plus empties", () => {
    const bins = buildHistogram(ugmWithValues([5, 5, 5]), "x", 20);
    expect(bins.length).toBe(1);
    expect(bins[0]?.label).toBe("5");
    expect(bins[0]?.count).toBe(3);
  });

  it("continuous domains keep the requested bin count with compact labels", () => {
    const values = Array.from({ length: 200 }, (_, i) => i * 0.137);
    const bins = buildHistogram(ugmWithValues(values), "x", 20);
    expect(bins.length).toBe(20);
    expect(bins[0]?.label.includes(".00-")).toBe(false);
    const total = bins.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(200);
  });

  it("wide integer domains fall back to range bins but still partition fully", () => {
    const values = Array.from({ length: 100 }, (_, i) => i); // 0..99, span 100 > 20
    const bins = buildHistogram(ugmWithValues(values), "x", 20);
    expect(bins.length).toBe(20);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(100);
  });

  it("returns empty for non-numeric properties", () => {
    const g = new UGM();
    g.addNode("a", { types: ["T"], properties: { x: "nope" } });
    expect(buildHistogram(g, "x", 20)).toEqual([]);
  });
});
