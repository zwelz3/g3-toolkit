/**
 * Render-settle probe (successor to the VA-26 runaway-growth probe,
 * retired with the visual-acceptance surface 2026-07-04; review
 * finding, round 24). The guarded class is real and surface-agnostic:
 * a React-state feedback loop around a canvas + panels composition
 * explodes the render count. The probe now targets living code with
 * the same composition shape: the AnalyticsDashboard (canvas, stats,
 * algorithm and derived-property panels sharing state).
 *
 * The canvas is stubbed at the component level (the dashboard's own
 * render-test pattern; its chart path rasterizes on a 2D context
 * jsdom lacks); a flat count here means any explosion seen live is
 * canvas/browser-driven rather than a state loop in the composition.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useEffect } from "react";

// Stub the painting leaves (cytoscape canvas, echarts-bearing stats
// and charts): the probe measures the composition's REACT render
// count, and echarts wakes during the settle window then disposes
// against jsdom's null 2D context. Their internals are covered by
// their own suites; the state wiring between panels stays real.
vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: () => <div data-testid="canvas-stub" />,
    StatsPanel: () => <div data-testid="stats-stub" />,
  };
});
vi.mock("@g3t/charts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/charts")>();
  return {
    ...actual,
    LinkedChart: () => <div data-testid="chart-stub" />,
  };
});

import { AnalyticsDashboard } from "../../examples/decision-dashboards/src";

const counter = { renders: 0 };
function CountRenders({ children }: { children: React.ReactNode }) {
  // Count COMMITS, not render invocations: a dep-array-less effect
  // fires after every committed render, which is a legal place for
  // the mutation (react-hooks/immutability correctly rejects mutating
  // module state during render) and is StrictMode-stable. A state
  // feedback loop still produces unbounded commits, so the guarded
  // class is unchanged.
  useEffect(() => {
    counter.renders += 1;
  });
  return <>{children}</>;
}

afterEach(() => {
  counter.renders = 0;
  cleanup();
});

describe("render-settle probe", () => {
  it("AnalyticsDashboard settles: render count stays flat after mount", async () => {
    render(
      <CountRenders>
        <AnalyticsDashboard />
      </CountRenders>,
    );
    const after = counter.renders;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(counter.renders).toBe(after);
    expect(counter.renders).toBeLessThan(6);
  });
});
