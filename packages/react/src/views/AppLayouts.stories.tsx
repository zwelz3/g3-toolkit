/**
 * Layout composition patterns.
 *
 * Shows how toolkit components compose into common application
 * layouts. These are NOT full demos (see src/demo/ for those);
 * they illustrate the composition patterns adopters will use.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { UGM } from "@g3t/core";
import { TableView } from "./table";
import { DetailInspector } from "./inspector";
import { TreeView } from "./tree";
import { FacetFilter } from "../interaction/filter";
import { SearchBar } from "../interaction/search";
import { StatusBar, ZoomControls } from "../interaction/toolbar";
import { CanvasLegend, DEFAULT_ENCODING } from "../interaction/encoding";

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", {
    types: ["Person"],
    properties: { name: "Alice", role: "Engineer" },
  });
  ugm.addNode("p2", {
    types: ["Person"],
    properties: { name: "Bob", role: "Designer" },
  });
  ugm.addNode("o1", {
    types: ["Org"],
    properties: { name: "Acme", industry: "Tech" },
  });
  ugm.addEdge("p1", "o1", { type: "worksAt" });
  ugm.addEdge("p2", "o1", { type: "worksAt" });
  ugm.addEdge("p1", "p2", { type: "knows" });
  return ugm;
}

const meta: Meta = {
  title: "Layouts/Composition Patterns",
};

export default meta;
type Story = StoryObj;

export const SidebarAndTable: Story = {
  name: "Sidebar + Table",
  render: () => {
    const ugm = makeUGM();
    return (
      <div
        style={{
          display: "flex",
          height: 400,
          fontFamily: "var(--g3t-font, system-ui)",
        }}
      >
        <div style={{ width: 200, borderRight: "1px solid #ddd", padding: 8 }}>
          <SearchBar ugm={ugm} onSearchChange={() => {}} />
          <FacetFilter ugm={ugm} onFilterChange={() => {}} />
        </div>
        <div style={{ flex: 1 }}>
          <TableView ugm={ugm} pageSize={5} />
        </div>
      </div>
    );
  },
};

export const TreeAndInspector: Story = {
  name: "Tree + Inspector",
  render: () => {
    const ugm = makeUGM();
    return (
      <div
        style={{
          display: "flex",
          height: 400,
          fontFamily: "var(--g3t-font, system-ui)",
        }}
      >
        <div style={{ width: 250, borderRight: "1px solid #ddd", padding: 8 }}>
          <TreeView ugm={ugm} initialDepth={2} />
        </div>
        <div style={{ flex: 1, padding: 12 }}>
          <DetailInspector ugm={ugm} selection={{ type: "node", id: "p1" }} />
        </div>
      </div>
    );
  },
};

export const CanvasOverlays: Story = {
  name: "Canvas Overlays (Legend + Zoom)",
  render: () => {
    const ugm = makeUGM();
    return (
      <div
        style={{
          position: "relative",
          height: 300,
          background: "#f8f9fa",
          border: "1px solid #ddd",
          fontFamily: "var(--g3t-font, system-ui)",
        }}
      >
        <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
          (CytoscapeCanvas would render here)
        </div>
        <div style={{ position: "absolute", top: 8, left: 8 }}>
          <CanvasLegend ugm={ugm} encoding={DEFAULT_ENCODING} />
        </div>
        <div style={{ position: "absolute", bottom: 8, right: 8 }}>
          <ZoomControls
            onZoomIn={() => {}}
            onZoomOut={() => {}}
            onFit={() => {}}
          />
        </div>
      </div>
    );
  },
};

export const StatusBarVariants: Story = {
  name: "Status Bar",
  render: () => {
    const ugm = makeUGM();
    return (
      <div style={{ fontFamily: "var(--g3t-font, system-ui)" }}>
        <StatusBar ugm={ugm} zoomLevel={1.0} />
        <div style={{ height: 8 }} />
        <StatusBar ugm={new UGM()} zoomLevel={0.5} />
      </div>
    );
  },
};
