/**
 * Tests for F6a (MapView edges), F6c (TemporalSlider),
 * F8 (edge style), and LayoutManager.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UGM } from "@core/ugm";
import { MapView } from "@views/map";
import { TemporalSlider } from "@interaction/temporal";
import { LayoutManager } from "@interaction/layout-manager/LayoutManager";

function makeGeoUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("nyc", {
    types: ["City"],
    properties: { name: "New York", latitude: 40.71, longitude: -74.0 },
  });
  ugm.addNode("london", {
    types: ["City"],
    properties: { name: "London", latitude: 51.51, longitude: -0.13 },
  });
  ugm.addNode("tokyo", {
    types: ["City"],
    properties: { name: "Tokyo", latitude: 35.68, longitude: 139.69 },
  });
  ugm.addEdge("nyc", "london", { type: "flightRoute" });
  ugm.addEdge("london", "tokyo", { type: "flightRoute" });
  return ugm;
}

function makeTemporalUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("e1", {
    types: ["Event"],
    properties: { name: "Start", date: "2025-01-15" },
  });
  ugm.addNode("e2", {
    types: ["Event"],
    properties: { name: "End", date: "2025-12-15" },
  });
  return ugm;
}

// ── F6a: MapView with edges ─────────────────────────────────────

describe("MapView with edges (F6a)", () => {
  it("renders edge lines between geo nodes", () => {
    render(<MapView ugm={makeGeoUGM()} />);
    const edge = screen.getByTestId("map-edge-nyc-london");
    expect(edge).toBeInTheDocument();
    expect(edge.tagName.toLowerCase()).toBe("line");
  });

  it("renders all geo nodes as markers", () => {
    render(<MapView ugm={makeGeoUGM()} />);
    expect(screen.getByTestId("map-marker-nyc")).toBeInTheDocument();
    expect(screen.getByTestId("map-marker-london")).toBeInTheDocument();
    expect(screen.getByTestId("map-marker-tokyo")).toBeInTheDocument();
  });

  it("hides edges when showEdges is false", () => {
    render(<MapView ugm={makeGeoUGM()} showEdges={false} />);
    expect(screen.queryByTestId("map-edge-nyc-london")).toBeNull();
  });
});

// ── F6c: TemporalSlider ─────────────────────────────────────────

describe("TemporalSlider (F6c)", () => {
  it("renders slider and controls", () => {
    render(
      <TemporalSlider
        ugm={makeTemporalUGM()}
        timeProperty="date"
        onRangeChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("temporal-slider")).toBeInTheDocument();
    expect(screen.getByTestId("temporal-slider-input")).toBeInTheDocument();
    expect(screen.getByTestId("temporal-play-pause")).toBeInTheDocument();
    expect(screen.getByTestId("temporal-speed")).toBeInTheDocument();
  });

  it("calls onRangeChange when slider moves", async () => {
    const onChange = vi.fn();
    render(
      <TemporalSlider
        ugm={makeTemporalUGM()}
        timeProperty="date"
        onRangeChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId("temporal-slider-input"), {
      target: { value: "500" },
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      const args = onChange.mock.calls[onChange.mock.calls.length - 1] ?? [];
      const start = args[0];
      const end = args[1];
      expect(start instanceof Date).toBe(true);
      expect(end instanceof Date).toBe(true);
    });
  });

  it("cycles speed on speed button click", () => {
    render(
      <TemporalSlider
        ugm={makeTemporalUGM()}
        timeProperty="date"
        onRangeChange={vi.fn()}
      />,
    );
    const speedBtn = screen.getByTestId("temporal-speed");
    expect(speedBtn.textContent).toBe("1x");
    fireEvent.click(speedBtn);
    expect(speedBtn.textContent).toBe("2x");
    fireEvent.click(speedBtn);
    expect(speedBtn.textContent).toBe("5x");
  });
});

// ── LayoutManager ───────────────────────────────────────────────

describe("LayoutManager", () => {
  it("renders layout selector and controls", () => {
    render(<LayoutManager onLayoutChange={vi.fn()} onResetLayout={vi.fn()} />);
    expect(screen.getByTestId("layout-manager")).toBeInTheDocument();
    expect(screen.getByTestId("layout-select")).toBeInTheDocument();
    expect(screen.getByTestId("layout-reset")).toBeInTheDocument();
    expect(screen.getByTestId("layout-freeze")).toBeInTheDocument();
  });

  it("calls onLayoutChange when layout is selected", () => {
    const onChange = vi.fn();
    render(<LayoutManager onLayoutChange={onChange} onResetLayout={vi.fn()} />);
    fireEvent.change(screen.getByTestId("layout-select"), {
      target: { value: "hierarchy" },
    });
    expect(onChange).toHaveBeenCalledWith("hierarchy", expect.any(Object));
  });

  it("calls onResetLayout when reset is clicked", () => {
    const onReset = vi.fn();
    render(<LayoutManager onLayoutChange={vi.fn()} onResetLayout={onReset} />);
    fireEvent.click(screen.getByTestId("layout-reset"));
    expect(onReset).toHaveBeenCalled();
  });

  it("toggles freeze state", () => {
    const onFreeze = vi.fn();
    render(
      <LayoutManager
        onLayoutChange={vi.fn()}
        onResetLayout={vi.fn()}
        onFreezeLayout={onFreeze}
      />,
    );
    fireEvent.click(screen.getByTestId("layout-freeze"));
    expect(onFreeze).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId("layout-freeze"));
    expect(onFreeze).toHaveBeenCalledWith(false);
  });

  it("shows edge style selector", () => {
    render(<LayoutManager onLayoutChange={vi.fn()} onResetLayout={vi.fn()} />);
    const edgeSelect = screen.getByTestId("edge-style-select");
    expect(edgeSelect).toBeInTheDocument();
    fireEvent.change(edgeSelect, { target: { value: "taxi" } });
  });
});
