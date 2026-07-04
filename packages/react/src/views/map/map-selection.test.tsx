/**
 * C1 selection signature on MapView (design-system roadmap): selection
 * adds the accent halo and never recolors the marker. Guards against
 * regression to the fill-swap behavior removed 2026-06-11.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { MapView } from "./MapView";
import { useSelectionStore } from "../../state/selection-store";

function geoGraph(): UGM {
  const ugm = new UGM();
  ugm.addNode("g1", {
    types: ["Site"],
    properties: { label: "Alpha", lat: 39.1, lon: -84.5, name: "Alpha" },
  });
  ugm.addNode("g2", {
    types: ["Site"],
    properties: { label: "Bravo", lat: 40.7, lon: -74.0, name: "Bravo" },
  });
  return ugm;
}

describe("MapView selection signature (C1)", () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
  });

  it("adds an accent halo to selected markers without recoloring them", () => {
    useSelectionStore.getState().selectNodes(["g1"]);
    render(<MapView ugm={geoGraph()} />);
    const halo = screen.getByTestId("map-halo-g1");
    expect(halo.getAttribute("stroke")).toContain("--g3t-accent-primary");
    expect(halo.getAttribute("fill")).toBe("none");
    // The marker itself keeps its categorical fill on selection.
    const marker = screen
      .getByTestId("map-marker-g1")
      .querySelectorAll("circle")[1];
    expect(marker?.getAttribute("fill")).toContain("--g3t-type-1");
  });

  it("renders no halo for unselected markers", () => {
    render(<MapView ugm={geoGraph()} />);
    expect(screen.queryByTestId("map-halo-g2")).toBeNull();
  });
});
