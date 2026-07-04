import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { UGM } from "@g3t/core";
import { FacetFilter } from "./FacetFilter";

/**
 * Molecules-layer story (provisional "Molecules/" title pending the nav
 * reshape). FacetFilter reads the node-type registry off a UGM and renders
 * a swatch + toggle per type, emitting the set of hidden types so a host
 * can filter the graph. Shown in isolation with a live readout.
 */
function buildTypedUGM(): UGM {
  const ugm = new UGM();
  const add = (id: string, type: string, name: string) =>
    ugm.addNode(id, { types: [type], properties: { name } });
  add("alice", "Person", "Alice");
  add("bob", "Person", "Bob");
  add("acme", "Org", "Acme Corp");
  add("globex", "Org", "Globex");
  add("doc1", "Document", "Spec v1");
  add("evt1", "Event", "Kickoff");
  return ugm;
}

const meta: Meta<typeof FacetFilter> = {
  title: "Molecules/FacetFilter",
  component: FacetFilter,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Type-facet visibility toggles derived from a UGM's type registry. " +
          "A molecule: a swatch + toggle row per node type, emitting the set " +
          "of hidden types for a host to filter on.",
      },
    },
  },
  argTypes: {
    ugm: { table: { disable: true } },
    onFilterChange: { table: { disable: true } },
    colorForType: { table: { disable: true } },
    className: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<typeof FacetFilter>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Four types (Person, Org, Document, Event). Toggle a type off and " +
          "the readout shows the emitted hidden-type set.",
      },
    },
  },
  render: () => {
    const ugm = useMemo(() => buildTypedUGM(), []);
    const [hidden, setHidden] = useState<Set<string>>(new Set());
    return (
      <div style={{ width: 260 }}>
        <FacetFilter ugm={ugm} onFilterChange={setHidden} />
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--g3t-text-secondary)",
          }}
        >
          {hidden.size
            ? `hidden: ${[...hidden].sort().join(", ")}`
            : "all types visible"}
        </div>
      </div>
    );
  },
};
