import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { UGM } from "@g3t/core";
import { FilterBuilder } from "./FilterBuilder";

/**
 * Molecules-layer story (provisional "Molecules/" title pending the nav
 * reshape). FilterBuilder composes property predicate rows (key, operator,
 * value) over a UGM and emits the matching node ids. Shown in isolation
 * with a live match-count readout.
 */
function buildPropsUGM(): UGM {
  const ugm = new UGM();
  const add = (id: string, name: string, age: number, role: string) =>
    ugm.addNode(id, { types: ["Person"], properties: { name, age, role } });
  add("alice", "Alice", 34, "Analyst");
  add("bob", "Bob", 41, "Engineer");
  add("carol", "Carol", 29, "Designer");
  add("dave", "Dave", 52, "Engineer");
  return ugm;
}

const meta: Meta<typeof FilterBuilder> = {
  title: "Molecules/FilterBuilder",
  component: FilterBuilder,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Builds property predicates (key, operator, value) over a UGM and " +
          "emits the matching node ids. A molecule: filter rows with " +
          "operator selects, applied through the UGM.",
      },
    },
  },
  argTypes: {
    ugm: { table: { disable: true } },
    onApply: { table: { disable: true } },
    className: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<typeof FilterBuilder>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Four people with name, age, and role. Build a row like age >= 40 " +
          "and apply; the readout shows how many nodes matched.",
      },
    },
  },
  render: () => {
    const ugm = useMemo(() => buildPropsUGM(), []);
    const [count, setCount] = useState<number | null>(null);
    return (
      <div style={{ width: 320 }}>
        <FilterBuilder ugm={ugm} onApply={(ids) => setCount(ids.size)} />
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--g3t-text-secondary)",
          }}
        >
          {count === null
            ? "(build a filter and apply)"
            : `${count} node(s) matched`}
        </div>
      </div>
    );
  },
};
