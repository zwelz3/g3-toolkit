import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { UGM } from "@g3t/core";
import { EncodingPanel, CanvasLegend, DEFAULT_ENCODING } from "./index";
import type { EncodingConfig } from "./index";

function makeUGM() {
  const ugm = new UGM();
  const types = ["Person", "Organization", "Location", "Event"];
  for (let i = 0; i < 20; i++) {
    ugm.addNode(`n${i}`, {
      types: [types[i % 4]!],
      properties: {
        name: `Node ${i}`,
        score: +(i * 0.05).toFixed(2),
        degree: i % 7,
      },
    });
  }
  return ugm;
}

const meta: Meta = { title: "UX Surface/Visual Encoding", tags: ["autodocs"] };
export default meta;

export const Panel: StoryObj = {
  name: "EncodingPanel",
  render: () => {
    const [encoding, setEncoding] = useState<EncodingConfig>(DEFAULT_ENCODING);
    return (
      <div style={{ width: 240 }}>
        <EncodingPanel
          ugm={makeUGM()}
          encoding={encoding}
          onChange={setEncoding}
        />
        <pre
          style={{
            fontSize: 10,
            marginTop: 12,
            color: "var(--g3t-text-muted)",
          }}
        >
          {JSON.stringify(encoding, null, 2)}
        </pre>
      </div>
    );
  },
};

export const Legend: StoryObj = {
  name: "CanvasLegend",
  render: () => (
    <div style={{ width: 200 }}>
      <CanvasLegend ugm={makeUGM()} encoding={DEFAULT_ENCODING} />
    </div>
  ),
};

export const LegendWithSize: StoryObj = {
  name: "CanvasLegend (with size mapping)",
  render: () => (
    <div style={{ width: 200 }}>
      <CanvasLegend
        ugm={makeUGM()}
        encoding={{ ...DEFAULT_ENCODING, nodeSizeProperty: "score" }}
      />
    </div>
  ),
};
