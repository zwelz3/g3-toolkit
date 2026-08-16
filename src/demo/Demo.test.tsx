/**
 * Landing-to-surface routing integration (P1.4): clicking a capability
 * surface card mounts the dashboard behind a back bar, and back
 * returns to the landing. Canvas stubbed per the shell-test precedent.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { UGM } from "@g3t/core";

// echarts never worked in jsdom (no 2D canvas context); with STATIC
// shell imports its init errors passed as console noise, but LAZY
// shells (round 49) turn the rejection into a stuck Suspense. The
// consumers (StatsPanel/SankeyView/LinkedChart) touch init/dispose/
// setOption/resize/on: an inert instance satisfies all of them.
vi.mock("echarts", () => {
  const instance = {
    setOption: () => undefined,
    dispose: () => undefined,
    resize: () => undefined,
    on: () => undefined,
    off: () => undefined,
    clear: () => undefined,
    getDom: () => null,
  };
  const api = { init: () => instance, use: () => undefined };
  return { ...api, default: api };
});

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (_props: { ugm: UGM }) => (
      <div data-testid="canvas-stub" />
    ),
    // echarts-backed views: inert in jsdom (no 2D context; see the
    // echarts mock note above). Stubbing the CONSUMERS beats mocking
    // the lib: these resolve through package builds the file-level
    // echarts mock does not reliably intercept.
    StatsPanel: () => <div data-testid="stats-stub" />,
    SankeyView: () => <div data-testid="sankey-stub">Type flows (sankey)</div>,
  };
});

vi.mock("@g3t/charts", () => ({
  LinkedChart: () => <div data-testid="linked-chart-stub" />,
}));

import { Demo } from "./Demo";

afterEach(cleanup);

describe("Demo routing to capability surfaces", () => {
  // Shells are lazy (round 49): navigation assertions await the
  // chunk's resolution via findBy*.
  it("routes landing -> Analytics Dashboard -> back to landing", async () => {
    const { container } = render(<Demo />);
    fireEvent.click(screen.getByText("Analytics Dashboard"));
    await screen.findByText(/Origin coverage by tier/, undefined, {
      timeout: 15_000,
    });
    fireEvent.click(screen.getByText(/Scenarios/));
    expect(container.textContent).toContain("Analytics Dashboard"); // landing card (LR-1 removed the section header)
  });

  it("the retired Schema Dashboard's views live on the Analytics surface (ruling 8.4)", async () => {
    const { container } = render(<Demo />);
    fireEvent.click(screen.getByText("Analytics Dashboard"));
    await screen.findByText(/Adjacency matrix/, undefined, {
      timeout: 15_000,
    });
    expect(container.textContent).toContain("Type flows (sankey)");
  });

  it("routes landing -> Ontology Workbench", async () => {
    render(<Demo />);
    fireEvent.click(screen.getByText("Ontology Workbench"));
    await screen.findByText(/Ontology statistics/, undefined, {
      timeout: 15_000,
    });
    expect(await screen.findByTestId("ow-class-tree")).toBeTruthy();
  });
});
