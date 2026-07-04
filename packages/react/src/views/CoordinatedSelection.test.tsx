/**
 * Patterns: coordinated selection (composition linking).
 *
 * Verifies the claim behind the Patterns/Coordinated Selection story
 * WITHOUT a browser: views mounted over one UGM share useSelectionStore,
 * so a selection driven from one view is observed by the others, live
 * and in both directions.
 *
 * Two independent TableView subscribers stand in for the canvas/table/
 * chart trio. The canvas and the chart read and write the same store
 * (covered in CytoscapeCanvas.test.tsx and the charts package's m11
 * suite); they are not mounted here because cytoscape does not lay out
 * under jsdom and the chart pulls the package barrel. What this test
 * pins is the cross-view reflection mechanism that makes the
 * composition coordinate. The visual selected treatment (accent bar,
 * frame budget) still needs live confirmation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { TableView } from "./table";
import { useSelectionStore } from "../state/selection-store";

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("pump-1", { types: ["Asset"], properties: { name: "Pump A" } });
  ugm.addNode("sensor-1", {
    types: ["Sensor"],
    properties: { name: "Flow 1" },
  });
  ugm.addEdge("sensor-1", "pump-1", { type: "monitors" });
  return ugm;
}

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
});

describe("Patterns: coordinated selection over the shared store", () => {
  it("propagates a selection from one view to another through the shared store", () => {
    const ugm = makeUGM();
    render(
      <>
        <div data-testid="view-a">
          <TableView ugm={ugm} pageSize={10} />
        </div>
        <div data-testid="view-b">
          <TableView ugm={ugm} pageSize={10} />
        </div>
      </>,
    );
    const a = within(screen.getByTestId("view-a"));
    const b = within(screen.getByTestId("view-b"));
    expect(
      b.getByTestId("table-row-pump-1").getAttribute("data-selected"),
    ).toBeNull();
    // Select in view A; view B is a separate component instance.
    fireEvent.click(a.getByTestId("table-row-pump-1"));
    // It reflects live, because both subscribe to the one store.
    expect(
      b.getByTestId("table-row-pump-1").getAttribute("data-selected"),
    ).toBe("true");
    // ...and the store the canvas and chart also read holds the pick.
    expect(useSelectionStore.getState().selectedNodeIds.has("pump-1")).toBe(
      true,
    );
  });

  it("reflects an externally-driven store selection in the table (canvas/chart -> table)", () => {
    const ugm = makeUGM();
    render(<TableView ugm={ugm} pageSize={10} />);
    const row = screen.getByTestId("table-row-sensor-1");
    expect(row.getAttribute("data-selected")).toBeNull();
    // A canvas tap or a chart bar click both call selectNodes on the
    // same store; the table follows with no prop threading.
    act(() => {
      useSelectionStore.getState().selectNodes(["sensor-1"]);
    });
    expect(row.getAttribute("data-selected")).toBe("true");
  });
});
