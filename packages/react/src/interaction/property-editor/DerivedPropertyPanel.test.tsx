/**
 * Tests for DerivedPropertyPanel (M13.E3.T2).
 *
 * Extracted from interaction/remaining-tickets.test.tsx during P3.5.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UGM, DerivedPropertyEngine } from "@g3t/core";
import { DerivedPropertyPanel } from "./DerivedPropertyPanel";

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

describe("DerivedPropertyPanel", () => {
  it("renders name and expression inputs", () => {
    const ugm = makeUGM();
    const engine = new DerivedPropertyEngine();
    render(
      <DerivedPropertyPanel ugm={ugm} engine={engine} onCompute={vi.fn()} />,
    );
    expect(screen.getByTestId("derived-property-panel")).toBeInTheDocument();
    expect(screen.getByTestId("derived-name-input")).toBeInTheDocument();
    expect(screen.getByTestId("derived-expression-input")).toBeInTheDocument();
    expect(screen.getByTestId("derived-compute")).toBeInTheDocument();
  });

  it("shows existing definitions", () => {
    const ugm = makeUGM();
    const engine = new DerivedPropertyEngine();
    engine.define({ name: "combo", expression: "risk * 100", reactive: false });
    engine.compute(ugm);

    render(
      <DerivedPropertyPanel ugm={ugm} engine={engine} onCompute={vi.fn()} />,
    );
    expect(screen.getByTestId("derived-combo")).toBeInTheDocument();
    expect(screen.getByTestId("derived-combo")).toHaveTextContent("risk * 100");
  });
});
