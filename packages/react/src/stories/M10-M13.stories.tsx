/**
 * Storybook stories for M10-M13 components.
 *
 * Covers: LinkedChart, FilterBuilder, ShaclShapeBrowser,
 * NodeStyleEditor, SearchBar, TemporalRangeFilter, DerivedPropertyPanel.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { UGM } from "@g3t/core";
import { LinkedChart } from "@g3t/charts";
import { FilterBuilder } from "../interaction/filter/FilterBuilder";
import { SearchBar } from "../interaction/search/SearchBar";
import { NodeStyleEditor } from "../interaction/encoding/NodeStyleEditor";
import { TemporalRangeFilter, DerivedPropertyPanel } from "@g3t/react";
import { ShaclShapeBrowser } from "../views/schema/ShaclShapeBrowser";
import { createCountByType, createPropertyCorrelation } from "@g3t/core";
import { validateShacl, type ShaclShape } from "@g3t/core";
import { DerivedPropertyEngine } from "@g3t/core";

// ── Shared fixture ──────────────────────────────────────────────────

function makeUGM(): UGM {
  const ugm = new UGM();
  const types = ["Person", "Organization", "Location"];
  for (let i = 0; i < 20; i++) {
    ugm.addNode(`n${i}`, {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      types: [types[i % 3]!],
      properties: {
        name: `Node ${i}`,
        risk: Math.random(),
        score: Math.floor(Math.random() * 100),
        date: `2025-${String((i % 12) + 1).padStart(2, "0")}-15`,
      },
    });
  }
  for (let i = 1; i < 20; i++) {
    ugm.addEdge(`n${Math.floor(i / 3)}`, `n${i}`, { type: "connected" });
  }
  return ugm;
}

const ugm = makeUGM();

// ── LinkedChart ─────────────────────────────────────────────────────

const chartMeta: Meta<typeof LinkedChart> = {
  title: "Reference/Charts",
  component: LinkedChart,
  parameters: { layout: "padded" },
};
export default chartMeta;

type ChartStory = StoryObj<typeof LinkedChart>;

export const BarChart: ChartStory = {
  args: {
    ugm,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipeline: createCountByType() as any,
    type: "bar",
    height: 250,
  },
};

export const ScatterWithTrend: ChartStory = {
  args: {
    ugm,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipeline: createPropertyCorrelation("risk", "score") as any,
    type: "scatter",
    height: 250,
  },
};

export const PieChart: ChartStory = {
  args: {
    ugm,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipeline: createCountByType() as any,
    type: "pie",
    height: 250,
  },
};

// ── FilterBuilder ───────────────────────────────────────────────────

export const FilterBuilderStory: StoryObj = {
  render: () => (
    <div style={{ width: 300 }}>
      <FilterBuilder
        ugm={ugm}
        onApply={(ids) => console.log(`${ids.size} nodes match`)}
      />
    </div>
  ),
  name: "FilterBuilder",
};

// ── SearchBar ───────────────────────────────────────────────────────

export const SearchBarStory: StoryObj = {
  render: () => (
    <div style={{ width: 280 }}>
      <SearchBar
        ugm={ugm}
        onSearchChange={(r) => console.log(`${r.matchingIds.length} results`)}
      />
    </div>
  ),
  name: "SearchBar (Fuse.js)",
};

// ── NodeStyleEditor ─────────────────────────────────────────────────

export const NodeStyleEditorStory: StoryObj = {
  render: () => (
    <NodeStyleEditor
      ugm={ugm}
      nodeId="n0"
      onClose={() => console.log("closed")}
    />
  ),
  name: "NodeStyleEditor",
};

// ── ShaclShapeBrowser ───────────────────────────────────────────────

const shapes: ShaclShape[] = [
  {
    id: "shape:person",
    name: "Person Shape",
    targetClass: "Person",
    properties: [
      { path: "name", name: "Name", datatype: "string", minCount: 1 },
      {
        path: "risk",
        name: "Risk Score",
        datatype: "number",
        minInclusive: 0,
        maxInclusive: 1,
      },
    ],
  },
  {
    id: "shape:org",
    name: "Organization Shape",
    targetClass: "Organization",
    properties: [
      { path: "name", name: "Name", datatype: "string", minCount: 1 },
      { path: "score", name: "Score", datatype: "number" },
    ],
  },
];

export const ShaclBrowserStory: StoryObj = {
  render: () => {
    const results = validateShacl(ugm, shapes);
    return (
      <div style={{ width: 300 }}>
        <ShaclShapeBrowser shapes={shapes} validationResults={results} />
      </div>
    );
  },
  name: "ShaclShapeBrowser",
};

// ── TemporalRangeFilter ─────────────────────────────────────────────

export const TemporalFilterStory: StoryObj = {
  render: () => (
    <div style={{ width: 280 }}>
      <TemporalRangeFilter
        ugm={ugm}
        timeProperty="date"
        onChange={(r) => console.log(r)}
      />
    </div>
  ),
  name: "TemporalRangeFilter",
};

// ── DerivedPropertyPanel ────────────────────────────────────────────

export const DerivedPropertyStory: StoryObj = {
  render: () => {
    const engine = new DerivedPropertyEngine();
    return (
      <div style={{ width: 300 }}>
        <DerivedPropertyPanel
          ugm={ugm}
          engine={engine}
          onCompute={() => console.log("computed")}
        />
      </div>
    );
  },
  name: "DerivedPropertyPanel",
};
