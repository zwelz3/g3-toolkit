/**
 * AnalyticsDashboard render contract (canvas stubbed, everything else
 * real). Exists separately from dashboards.test.tsx, whose charter is
 * pure functions only. Pins the CoverageMeter fold: one meter per tier,
 * width equal to the computed origin coverage.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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

import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { buildSupplyNetwork, originCoverageByTier } from "./supply-data";

afterEach(cleanup);

describe("AnalyticsDashboard coverage section", () => {
  it("renders one CoverageMeter per tier at the computed width", () => {
    const rows = originCoverageByTier(buildSupplyNetwork());
    render(<AnalyticsDashboard />);
    for (const r of rows) {
      const meter = screen.getByTestId(`origin-coverage-${r.tier}`);
      const solid = meter.querySelector(
        "[data-testid='g3t-coverage-solid']",
      ) as HTMLElement;
      expect(solid.style.width).toBe(`${Math.round(r.substantiated * 100)}%`);
    }
    expect(screen.getByText("Origin coverage by tier")).toBeDefined();
  });
});
