/**
 * Landing-to-surface routing integration (P1.4): clicking a capability
 * surface card mounts the dashboard behind a back bar, and back
 * returns to the landing. Canvas stubbed per the shell-test precedent.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { UGM } from "@g3t/core";

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (_props: { ugm: UGM }) => (
      <div data-testid="canvas-stub" />
    ),
  };
});

import { Demo } from "./Demo";

afterEach(cleanup);

describe("Demo routing to capability surfaces", () => {
  it("routes landing -> Analytics Dashboard -> back to landing", () => {
    const { container } = render(<Demo />);
    fireEvent.click(screen.getByText("Analytics Dashboard"));
    expect(container.textContent).toContain("Origin coverage by tier");
    fireEvent.click(screen.getByText(/Scenarios/));
    expect(container.textContent).toContain("Capability surfaces");
  });

  it("the retired Schema Dashboard's views live on the Analytics surface (ruling 8.4)", () => {
    const { container } = render(<Demo />);
    fireEvent.click(screen.getByText("Analytics Dashboard"));
    expect(container.textContent).toContain("Adjacency matrix");
    expect(container.textContent).toContain("Type flows (sankey)");
  });

  it("routes landing -> Ontology Workbench", () => {
    const { container } = render(<Demo />);
    fireEvent.click(screen.getByText("Ontology Workbench"));
    expect(container.textContent).toContain("Ontology statistics");
    expect(screen.getByTestId("ow-class-tree")).toBeTruthy();
  });
});
