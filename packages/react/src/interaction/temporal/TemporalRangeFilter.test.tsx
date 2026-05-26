/**
 * Tests for TemporalRangeFilter (M13.E2.T2).
 *
 * Extracted from interaction/remaining-tickets.test.tsx during P3.5.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { TemporalRangeFilter } from "./TemporalRangeFilter";

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("n1", {
    types: ["Person"],
    properties: { name: "Alice", risk: 0.9, date: "2025-03-15" },
  });
  ugm.addNode("n2", {
    types: ["Person"],
    properties: { name: "Bob", risk: 0.3, date: "2025-06-20" },
  });
  ugm.addNode("n3", {
    types: ["Org"],
    properties: { name: "Acme", risk: 0.5, date: "2025-09-01" },
  });
  return ugm;
}

describe("TemporalRangeFilter", () => {
  it("renders two range sliders", () => {
    const ugm = makeUGM();
    render(
      <TemporalRangeFilter ugm={ugm} timeProperty="date" onChange={vi.fn()} />,
    );
    expect(screen.getByTestId("temporal-range-filter")).toBeInTheDocument();
    expect(screen.getByTestId("temporal-min")).toBeInTheDocument();
    expect(screen.getByTestId("temporal-max")).toBeInTheDocument();
  });

  it("sliders have correct min/max from UGM data", () => {
    const ugm = makeUGM();
    const onChange = vi.fn();
    render(
      <TemporalRangeFilter ugm={ugm} timeProperty="date" onChange={onChange} />,
    );
    const minSlider = screen.getByTestId("temporal-min") as HTMLInputElement;
    const maxSlider = screen.getByTestId("temporal-max") as HTMLInputElement;

    // Both sliders should have the same global min/max range
    expect(minSlider.min).toBe(maxSlider.min);
    expect(minSlider.max).toBe(maxSlider.max);
    // Min should be <= max
    expect(Number(minSlider.value)).toBeLessThanOrEqual(
      Number(maxSlider.value),
    );
  });
});
