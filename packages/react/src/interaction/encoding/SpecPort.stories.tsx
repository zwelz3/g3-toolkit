import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SpecPort } from "./SpecPort";
import { DEFAULT_SPEC } from "./encoding-spec";
import type { EncodingSpec } from "./encoding-spec";

/**
 * Atoms-layer story (provisional "Atoms/" title pending the nav reshape).
 * SpecPort is the encoding spec's import/export port: it serializes the
 * incoming EncodingSpec to JSON, lets you edit and Apply (parse + validate),
 * and follows external spec changes until you start editing.
 */
const meta: Meta<typeof SpecPort> = {
  title: "Atoms/SpecPort",
  component: SpecPort,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Round-trip JSON editor for an EncodingSpec. Serializes the spec, " +
          "accepts edits on Apply (rejecting invalid JSON inline), and " +
          "tracks external spec changes until the user edits the text.",
      },
    },
  },
  argTypes: {
    spec: { table: { disable: true } },
    onApply: { table: { disable: true } },
    className: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<typeof SpecPort>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Seeded with DEFAULT_SPEC. Edit the JSON and Apply; invalid JSON " +
          "is rejected inline without calling onApply. The readout counts " +
          "successful applies.",
      },
    },
  },
  render: () => {
    const [spec, setSpec] = useState<EncodingSpec>(DEFAULT_SPEC);
    const [applied, setApplied] = useState(0);
    return (
      <div style={{ width: 360 }}>
        <SpecPort
          spec={spec}
          onApply={(s) => {
            setSpec(s);
            setApplied((n) => n + 1);
          }}
        />
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--g3t-text-secondary)",
          }}
        >
          {applied === 0
            ? "(edit the JSON and Apply)"
            : `applied ${applied} time(s)`}
        </div>
      </div>
    );
  },
};
