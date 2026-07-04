import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Core } from "cytoscape";
import { UGM } from "@g3t/core";
import { CytoscapeCanvas } from "../../views/canvas/CytoscapeCanvas";
import { Minimap } from "./Minimap";

// A graph comfortably larger than the viewport so panning is meaningful
// and the viewport indicator is a small box rather than the whole frame.
function buildUGM(): UGM {
  const ugm = new UGM();
  const types = ["Person", "Organization", "System", "Location"];
  const N = 32;
  for (let i = 0; i < N; i++) {
    ugm.addNode(`n${i}`, {
      types: [types[i % types.length] as string],
      properties: { name: `Node ${i}` },
    });
  }
  for (let i = 1; i < N; i++) {
    ugm.addEdge(`n${i % 6}`, `n${i}`, {
      type: "linksTo",
      confidence: 0.55 + (i % 4) * 0.12,
    });
  }
  for (let i = 6; i < N; i += 5) {
    ugm.addEdge(`n${i}`, `n${(i + 3) % N}`, { type: "peer", confidence: 0.5 });
  }
  return ugm;
}

const meta: Meta<typeof Minimap> = {
  title: "Molecules/Minimap",
  component: Minimap,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A compact overview of a Cytoscape graph with a draggable " +
          "viewport indicator. Capture the canvas instance from " +
          "`onReady(cy)` into state and pass it as `core`. Click or drag " +
          "inside the minimap to recenter the main view on that point " +
          "(zoom is preserved). The indicator tracks pan/zoom/drag/layout " +
          "in real time.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof Minimap>;

export const OverCanvas: Story = {
  render: () => {
    const [ugm] = useState(buildUGM);
    const [core, setCore] = useState<Core | null>(null);
    return (
      <div
        style={{
          position: "relative",
          width: 640,
          height: 440,
          border: "1px solid var(--g3t-border, #dee2e6)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--g3t-bg-primary, #fff)",
        }}
      >
        <CytoscapeCanvas ugm={ugm} layout="fcose" onReady={setCore} />
        <div style={{ position: "absolute", right: 12, bottom: 12 }}>
          <Minimap core={core} />
        </div>
      </div>
    );
  },
};

export const Compact: Story = {
  render: () => {
    const [ugm] = useState(buildUGM);
    const [core, setCore] = useState<Core | null>(null);
    return (
      <div
        style={{
          position: "relative",
          width: 560,
          height: 380,
          border: "1px solid var(--g3t-border, #dee2e6)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--g3t-bg-primary, #fff)",
        }}
      >
        <CytoscapeCanvas ugm={ugm} layout="fcose" onReady={setCore} />
        <div style={{ position: "absolute", left: 12, top: 12 }}>
          <Minimap core={core} width={140} height={100} nodeRadius={1.5} />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "Sized down via `width`/`height`/`nodeRadius` and pinned to a " +
          "different corner.",
      },
    },
  },
};

export const Disabled: Story = {
  render: () => <Minimap core={null} />,
  parameters: {
    docs: {
      description: {
        story:
          "With no canvas attached (`core={null}`) the minimap renders an " +
          "inert, dimmed placeholder.",
      },
    },
  },
};
