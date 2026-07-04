import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import { UGM } from "@g3t/core";
import { TemporalRangeFilter } from "./TemporalRangeFilter";

/**
 * Molecules-layer story (provisional "Molecules/" title pending the nav
 * reshape). TemporalRangeFilter scans a numeric time property off a UGM,
 * derives the domain, and renders a dual-handle range slider that emits the
 * selected {min, max}. Shown in isolation with a live readout.
 */
function buildDatedUGM(): UGM {
  const ugm = new UGM();
  const add = (id: string, name: string, year: number) =>
    ugm.addNode(id, { types: ["Event"], properties: { name, year } });
  add("e1", "Kickoff", 2018);
  add("e2", "Beta", 2020);
  add("e3", "Launch", 2022);
  add("e4", "Expansion", 2024);
  return ugm;
}

function buildTimestampUGM(): UGM {
  const ugm = new UGM();
  const add = (id: string, name: string, iso: string) =>
    ugm.addNode(id, {
      types: ["Event"],
      properties: { name, date: new Date(iso).getTime() },
    });
  add("e1", "Kickoff", "2023-01-10");
  add("e2", "Beta", "2023-06-15");
  add("e3", "Launch", "2024-02-20");
  add("e4", "Expansion", "2024-09-05");
  return ugm;
}

const meta: Meta<typeof TemporalRangeFilter> = {
  title: "Molecules/TemporalRangeFilter",
  component: TemporalRangeFilter,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Dual-handle range slider over a numeric time property scanned " +
          "from a UGM, emitting the selected {min, max}. A molecule: it " +
          "derives the domain from the data and composes the two handles.",
      },
    },
  },
  argTypes: {
    ugm: { table: { disable: true } },
    onChange: { table: { disable: true } },
    timeProperty: { table: { disable: true } },
    className: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<typeof TemporalRangeFilter>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Four events on a numeric `year` property spanning 2018 to 2024. " +
          "Drag the handles; the readout shows the emitted range.",
      },
    },
  },
  render: () => {
    const ugm = useMemo(() => buildDatedUGM(), []);
    const [range, setRange] = useState<{ min: number; max: number } | null>(
      null,
    );
    return (
      <div style={{ width: 320 }}>
        <TemporalRangeFilter
          ugm={ugm}
          timeProperty="year"
          onChange={setRange}
        />
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--g3t-text-secondary)",
          }}
        >
          {range ? `range: ${range.min} to ${range.max}` : "(drag a handle)"}
        </div>
      </div>
    );
  },
};

export const DatePicker: Story = {
  name: "Date picker mode",
  parameters: {
    docs: {
      description: {
        story:
          'Start/end date fields (mode="datepicker") over a date property. ' +
          "Both modes emit the same {min, max} range.",
      },
    },
  },
  render: () => {
    const ugm = useMemo(() => buildTimestampUGM(), []);
    const [range, setRange] = useState<{ min: number; max: number } | null>(
      null,
    );
    return (
      <div style={{ width: 320 }}>
        <TemporalRangeFilter
          ugm={ugm}
          timeProperty="date"
          mode="datepicker"
          onChange={setRange}
        />
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--g3t-text-secondary)",
          }}
        >
          {range
            ? `range: ${new Date(range.min).toLocaleDateString()} to ${new Date(
                range.max,
              ).toLocaleDateString()}`
            : "(pick a date)"}
        </div>
      </div>
    );
  },
};
