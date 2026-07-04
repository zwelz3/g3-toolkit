import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { UGM } from "@g3t/core";
import { SearchBar, type SearchResult } from "./SearchBar";

/**
 * Molecules-layer story (provisional "Molecules/" title pending the nav
 * reshape). SearchBar composes a text input with fuzzy matching (fuse.js)
 * and the selection store, emitting matching/non-matching ids per keystroke
 * so a host can filter or highlight. Unlike the composite demos, this shows
 * it in isolation with a live readout.
 */
function buildPeopleUGM(): UGM {
  const ugm = new UGM();
  const people: Array<[string, string, string]> = [
    ["alice", "Alice Johnson", "Analyst"],
    ["bob", "Bob Martinez", "Engineer"],
    ["carol", "Carol Nguyen", "Designer"],
    ["dave", "Dave Okonkwo", "Engineer"],
  ];
  for (const [id, name, role] of people) {
    ugm.addNode(id, { types: ["Person"], properties: { name, role } });
  }
  ugm.addNode("acme", {
    types: ["Org"],
    properties: { name: "Acme Corp", industry: "Tech" },
  });
  return ugm;
}

const meta: Meta<typeof SearchBar> = {
  title: "Molecules/SearchBar",
  component: SearchBar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Fuzzy node search over a UGM. A molecule: it composes an input " +
          "with the selection store and emits a SearchResult (matching and " +
          "non-matching ids plus the query) on every keystroke.",
      },
    },
  },
  argTypes: {
    placeholder: { control: "text", description: "Input placeholder text." },
    selectOnEnter: {
      control: "boolean",
      description: "Select the first match on Enter (default true).",
    },
    ugm: { table: { disable: true } },
    onSearchChange: { table: { disable: true } },
    className: { table: { disable: true } },
  },
  args: { placeholder: "Search nodes...", selectOnEnter: true },
};
export default meta;

type Story = StoryObj<typeof SearchBar>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Search over five nodes (four people, one org). The line below " +
          'reflects the emitted SearchResult; try "eng" or "acme".',
      },
    },
  },
  render: (args) => {
    const ugm = useMemo(() => buildPeopleUGM(), []);
    const [result, setResult] = useState<SearchResult | null>(null);
    return (
      <div style={{ width: 320 }}>
        <SearchBar {...args} ugm={ugm} onSearchChange={setResult} />
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--g3t-text-secondary)",
          }}
        >
          {result && result.query
            ? `query "${result.query}": ${result.matchingIds.length} match(es)`
            : "(type to search)"}
        </div>
      </div>
    );
  },
};
