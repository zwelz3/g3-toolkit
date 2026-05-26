/**
 * Stories for F1-F8 features.
 */

import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { UGM } from "@g3t/core";
import { ComboManager } from "@g3t/core";
import {
  AnnotationPanel,
  createLocalAnnotationStore,
} from "../interaction/annotations";
import { PropertyEditor } from "../interaction/property-editor";
import { TemporalSlider } from "../interaction/temporal";
import { LayoutManager } from "../interaction/layout-manager/LayoutManager";

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", {
    types: ["Person"],
    properties: { name: "Alice", age: 30, team: "Engineering" },
  });
  ugm.addNode("b", {
    types: ["Person"],
    properties: { name: "Bob", age: 25, team: "Design" },
  });
  ugm.addNode("c", {
    types: ["Org"],
    properties: { name: "Acme Corp", industry: "Tech" },
  });
  ugm.addEdge("a", "c", { type: "worksAt" });
  ugm.addEdge("b", "c", { type: "worksAt" });
  ugm.addEdge("a", "b", { type: "knows" });
  return ugm;
}

function makeTemporalUGM(): UGM {
  const ugm = new UGM();
  for (let i = 0; i < 10; i++) {
    const month = String(i + 1).padStart(2, "0");
    ugm.addNode(`event-${i}`, {
      types: ["Event"],
      properties: {
        name: `Event ${i + 1}`,
        timestamp: `2025-${month}-15T12:00:00Z`,
      },
    });
  }
  return ugm;
}

const meta: Meta = {
  title: "Features/F1-F8",
};

export default meta;
type Story = StoryObj;

// ── F3: ComboManager ────────────────────────────────────────────

export const ComboGrouping: Story = {
  name: "F3: Combo Manager",
  render: () => {
    const ugm = makeUGM();
    const [mgr] = useState(() => {
      const m = new ComboManager();
      m.createCombo(["a", "b"], "Team Members");
      return m;
    });
    const [collapsed, setCollapsed] = useState(false);

    const combo = mgr.getAll()[0]!;
    const displayUGM = mgr.applyToUGM(ugm);

    return (
      <div style={{ padding: 16, fontFamily: "system-ui", fontSize: 13 }}>
        <h3 style={{ margin: "0 0 8px" }}>Combo: {combo.label}</h3>
        <p>Members: {[...combo.memberIds].join(", ")}</p>
        <p>Collapsed: {String(combo.collapsed)}</p>
        <button
          onClick={() => {
            mgr.toggleCollapse(combo.id);
            setCollapsed(!collapsed);
          }}
          style={{ padding: "4px 12px", cursor: "pointer" }}
        >
          {combo.collapsed ? "Expand" : "Collapse"}
        </button>
        <div
          style={{
            marginTop: 12,
            padding: 8,
            background: "#f5f5f5",
            borderRadius: 4,
          }}
        >
          <strong>Resulting UGM:</strong> {displayUGM.nodeCount} nodes,{" "}
          {displayUGM.edgeCount} edges
        </div>
      </div>
    );
  },
};

// ── F4: Annotation Panel ────────────────────────────────────────

export const Annotations: Story = {
  name: "F4: Annotation Panel",
  render: () => {
    const store = createLocalAnnotationStore("storybook-annotations");
    return (
      <div style={{ width: 300, fontFamily: "system-ui" }}>
        <AnnotationPanel elementId="demo-node-1" store={store} />
      </div>
    );
  },
};

export const AnnotationsEmpty: Story = {
  name: "F4: Annotations (no selection)",
  render: () => (
    <div style={{ width: 300, fontFamily: "system-ui" }}>
      <AnnotationPanel elementId={null} />
    </div>
  ),
};

// ── F5: Property Editor ─────────────────────────────────────────

export const PropertyEdit: Story = {
  name: "F5: Property Editor",
  render: () => {
    const ugm = makeUGM();
    return (
      <div style={{ width: 300, fontFamily: "system-ui" }}>
        <PropertyEditor
          ugm={ugm}
          elementType="node"
          elementId="a"
          onEdit={{
            onPropertyChange: async (_type, _id, key, _old, newVal) => {
              console.log(`Property "${key}" changed to:`, newVal);
              return true;
            },
          }}
        />
      </div>
    );
  },
};

// ── F6c: Temporal Slider ────────────────────────────────────────

export const TemporalControls: Story = {
  name: "F6c: Temporal Slider",
  render: () => {
    const ugm = makeTemporalUGM();
    return (
      <div style={{ width: 300, fontFamily: "system-ui" }}>
        <TemporalSlider
          ugm={ugm}
          timeProperty="timestamp"
          onRangeChange={(start, end) =>
            console.log(
              "Range:",
              start.toLocaleDateString(),
              "to",
              end.toLocaleDateString(),
            )
          }
        />
      </div>
    );
  },
};

// ── F9: Layout Manager ──────────────────────────────────────────

export const LayoutControls: Story = {
  name: "F9: Layout Manager",
  render: () => (
    <div style={{ width: 280, fontFamily: "system-ui" }}>
      <LayoutManager
        onLayoutChange={(name, options) =>
          console.log("Layout:", name, options)
        }
        onResetLayout={() => console.log("Reset layout")}
        onFreezeLayout={(frozen) => console.log("Freeze:", frozen)}
      />
    </div>
  ),
};
