import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useState } from "react";
import { UGM } from "@g3t/core";
import { CytoscapeCanvas } from "../canvas/CytoscapeCanvas";
import { useSelectionStore } from "../../state/selection-store";
import { NodeEditorModal } from "./NodeEditorModal";
import type { PropertyInspectorSpec } from "./property-spec";

/**
 * Composition: select a node in the Cytoscape canvas to open a modal
 * whose tabs are the property viewer (NodePropertyInspector, spec-driven
 * and editable) and the per-node style editor (NodeStyleEditor). The
 * canvas writes taps to the selection store; this story opens the modal
 * for the selected node and closes it (clearing the selection) on the
 * backdrop, Escape, or a panel's close button.
 */
const SPEC: PropertyInspectorSpec = {
  fields: [
    { key: "name", widget: "text" },
    {
      key: "sector",
      widget: "select",
      options: ["Defense", "Commercial", "Research"],
    },
    { key: "founded", widget: "number" },
    { key: "active", widget: "checkbox", label: "Active" },
    { key: "verified", widget: "toggle", label: "Verified" },
    { key: "notes", widget: "textarea" },
  ],
};

function buildUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("acme", {
    types: ["Organization"],
    properties: {
      name: "Acme Corp",
      sector: "Defense",
      founded: 1991,
      active: true,
      verified: false,
      notes: "Primary systems integrator on program X.",
    },
  });
  ugm.addNode("globex", {
    types: ["Organization"],
    properties: { name: "Globex", sector: "Commercial", active: false },
  });
  ugm.addNode("alice", {
    types: ["Person"],
    properties: { name: "Alice", role: "Engineer", active: true },
  });
  ugm.addNode("bob", {
    types: ["Person"],
    properties: { name: "Bob", role: "Analyst" },
  });
  ugm.addNode("hq", {
    types: ["Location"],
    properties: { name: "Cincinnati HQ" },
  });
  ugm.addEdge("alice", "acme", { type: "worksAt", confidence: 0.92 });
  ugm.addEdge("bob", "acme", { type: "worksAt", confidence: 0.7 });
  ugm.addEdge("acme", "hq", { type: "basedIn", confidence: 0.99 });
  ugm.addEdge("acme", "globex", { type: "partnerOf" });
  return ugm;
}

const meta: Meta = {
  title: "Patterns/Node Editor Modal",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Selecting a node opens a tabbed modal (Properties + Style) for " +
          "that node, composed from NodePropertyInspector and " +
          "NodeStyleEditor and driven by the canvas selection store.",
      },
    },
  },
};
export default meta;

type Story = StoryObj;

export const SelectToEdit: Story = {
  name: "Select a node to edit",
  render: () => {
    const ugm = useMemo(() => buildUGM(), []);
    const [, force] = useState(0);
    const selectedNodeIds = useSelectionStore((s) => s.selectedNodeIds);
    const clearSelection = useSelectionStore((s) => s.clearSelection);
    const nodeId = useMemo(
      () => [...selectedNodeIds][0] ?? null,
      [selectedNodeIds],
    );

    // Keep the example self-contained: start and end with no selection.
    useEffect(() => {
      clearSelection();
      return () => clearSelection();
    }, [clearSelection]);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div
          style={{
            padding: "8px 12px",
            fontSize: 12,
            color: "var(--g3t-text-secondary)",
            borderBottom: "1px solid var(--g3t-border)",
          }}
        >
          Click a node to open its editor. The modal tabs between the property
          viewer and the style editor; click the backdrop, press Escape, or use
          a panel's close button to dismiss.
        </div>
        <div style={{ position: "relative", flex: 1, minHeight: 480 }}>
          <CytoscapeCanvas ugm={ugm} />
          <NodeEditorModal
            ugm={ugm}
            nodeId={nodeId}
            mode="edit"
            spec={SPEC}
            onPropertyChange={(key, value) => {
              if (nodeId) {
                ugm.updateNodeProperties(nodeId, { [key]: value });
                force((n) => n + 1);
              }
            }}
            onClose={clearSelection}
          />
        </div>
      </div>
    );
  },
};
