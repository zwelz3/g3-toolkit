/**
 * Stories for the interaction compounds shipped in visual rounds
 * 15-21 (round-22 documentation pass: story coverage for this era
 * was zero). Self-contained fixtures per the storybook boundary
 * convention (no src/demo imports).
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo, useState } from "react";
import type { Core } from "cytoscape";
import { UGM } from "@g3t/core";
import { GraphToolbar } from "../toolbar/GraphToolbar";
import { AlgorithmPanel } from "../algorithms/AlgorithmPanel";
import { CytoscapeCanvas } from "../../views/canvas/CytoscapeCanvas";

function buildUGM(): UGM {
  const ugm = new UGM();
  const teams: Array<[string, string[]]> = [
    ["Helix", ["Aris", "Bea", "Caro"]],
    ["Quanta", ["Edda", "Finn"]],
  ];
  for (const [org, people] of teams) {
    ugm.addNode(org, { types: ["Org"], properties: { name: org } });
    for (const person of people) {
      ugm.addNode(person, { types: ["Person"], properties: { name: person } });
      ugm.addEdge(person, org, { type: "worksAt", properties: {} });
    }
  }
  ugm.addEdge("Helix", "Quanta", { type: "partner", properties: {} });
  return ugm;
}

const meta: Meta = {
  title: "Compounds/Toolbar & Algorithms",
  parameters: { layout: "padded" },
};
export default meta;

export const Toolbar: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          "`GraphToolbar` composes search (camera centers on match), " +
          "layout switching with force controls (popover commits via " +
          "Run layout), Shuffle, Pin all (whole-graph position lock " +
          "through the position-pin store), and zoom, over the cy " +
          "handle from `CytoscapeCanvas onReady`.",
      },
    },
  },
  render: () => {
    const ugm = useMemo(() => buildUGM(), []);
    const [cy, setCy] = useState<Core | null>(null);
    return (
      <div style={{ height: 460 }}>
        <GraphToolbar ugm={ugm} cy={cy} />
        <CytoscapeCanvas ugm={ugm} onReady={setCy} />
      </div>
    );
  },
};

export const Algorithms: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          "`AlgorithmPanel`: reference built-ins (components, degree, " +
          "shortest path), the structural-overlay registry with " +
          "independent toggles, and the ingest surface for external " +
          "result documents (networkx, GraphBLAS) through the " +
          "versioned interchange contract.",
      },
    },
  },
  render: () => {
    const ugm = useMemo(() => buildUGM(), []);
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 12,
          height: 460,
        }}
      >
        <AlgorithmPanel ugm={ugm} />
        <CytoscapeCanvas ugm={ugm} />
      </div>
    );
  },
};
