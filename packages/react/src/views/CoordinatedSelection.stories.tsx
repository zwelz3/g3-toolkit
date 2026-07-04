/**
 * Patterns: coordinated selection across views.
 *
 * The toolkit's value is coordination, not any single widget: a node
 * picked in one view lights up in all the others, in the same moment.
 * This story mounts a CytoscapeCanvas, a TableView, and a LinkedChart
 * over the shared selection store (useSelectionStore) with NO demo
 * shell, so the live linking is the only thing on display.
 *
 * It supersedes the hardcoded selection in "Layouts/Composition
 * Patterns" (which passes selection={{ type: "node", id: "p1" }} and so
 * shows layout, not linking). Here the selection is live and
 * bidirectional: select in the canvas and the table row plus the chart
 * category follow; click a bar and every node of that type is selected
 * across all three.
 *
 * GESTURES on the canvas: click selects; SHIFT+DRAG (or ctrl/cmd+drag)
 * on the background box-selects multiple nodes (a plain drag pans, per
 * cytoscape's gesture rules when panning and box selection are both
 * enabled); the box-selection sync pushes the picked set into the
 * store like any other selection (box-selection-sync.ts).
 *
 * Wiring: each view reads and writes useSelectionStore internally, so
 * composing them over ONE shared (referentially stable) UGM is all the
 * linking requires; there is no selection prop to thread. This is
 * design-system.md's C1 selection signature shown as the simultaneous
 * moment rather than per-component treatment. DS1 will surface this
 * exact composition's integration snippet in the Docs tab.
 */

import { useEffect, useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { UGM, createCountByType } from "@g3t/core";
import { LinkedChart } from "@g3t/charts";
import { CytoscapeCanvas } from "./canvas/CytoscapeCanvas";
import { TableView } from "./table";
import { useSelectionStore } from "../state/selection-store";

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("pump-1", {
    types: ["Asset"],
    properties: { name: "Pump A", site: "North" },
  });
  ugm.addNode("pump-2", {
    types: ["Asset"],
    properties: { name: "Pump B", site: "South" },
  });
  ugm.addNode("valve-1", {
    types: ["Asset"],
    properties: { name: "Valve A", site: "North" },
  });
  ugm.addNode("sensor-1", {
    types: ["Sensor"],
    properties: { name: "Flow 1", site: "North" },
  });
  ugm.addNode("sensor-2", {
    types: ["Sensor"],
    properties: { name: "Pressure 1", site: "South" },
  });
  ugm.addNode("site-north", {
    types: ["Site"],
    properties: { name: "North Plant" },
  });
  ugm.addNode("site-south", {
    types: ["Site"],
    properties: { name: "South Plant" },
  });
  ugm.addEdge("pump-1", "site-north", { type: "locatedAt" });
  ugm.addEdge("valve-1", "site-north", { type: "locatedAt" });
  ugm.addEdge("pump-2", "site-south", { type: "locatedAt" });
  ugm.addEdge("sensor-1", "pump-1", { type: "monitors" });
  ugm.addEdge("sensor-2", "pump-2", { type: "monitors" });
  return ugm;
}

const panel: React.CSSProperties = {
  border: "1px solid var(--g3t-border, #ddd)",
  borderRadius: 6,
  overflow: "hidden",
};

function CoordinatedSelectionDemo() {
  // Both must be referentially stable: a new UGM identity re-inits the
  // canvas (and re-runs layout); the pipeline is a query dependency.
  const ugm = useMemo(() => makeUGM(), []);
  const pipeline = useMemo(() => createCountByType(), []);

  // The selection store is a module singleton shared across stories;
  // start this one with nothing selected so the linking is observed,
  // not inherited.
  useEffect(() => {
    useSelectionStore.getState().clearSelection();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        fontFamily: "var(--g3t-font, system-ui)",
      }}
    >
      <p
        style={{ margin: 0, fontSize: 13, color: "var(--g3t-fg-muted, #555)" }}
      >
        Select a node in any panel. The canvas, the table, and the chart share
        one selection store, so the choice lights up in all three at once. Click
        a chart bar to select every node of that type. On the canvas, shift+drag
        (or ctrl/cmd+drag) the background to box-select several nodes at once; a
        plain drag pans.
      </p>
      <div style={{ ...panel, height: 420 }}>
        <CytoscapeCanvas ugm={ugm} />
      </div>
      <div style={{ display: "flex", gap: 12, height: 340 }}>
        <div style={{ ...panel, flex: 1, minWidth: 0, overflow: "auto" }}>
          <TableView ugm={ugm} pageSize={10} density="compact" />
        </div>
        <div style={{ ...panel, flex: 1, minWidth: 0, padding: 8 }}>
          <LinkedChart ugm={ugm} pipeline={pipeline} type="bar" height={320} />
        </div>
      </div>
    </div>
  );
}

const meta: Meta = {
  title: "Patterns/Coordinated Selection",
};
export default meta;
type Story = StoryObj;

export const CoordinatedSelection: Story = {
  name: "Coordinated Selection (live linking)",
  render: () => <CoordinatedSelectionDemo />,
};
