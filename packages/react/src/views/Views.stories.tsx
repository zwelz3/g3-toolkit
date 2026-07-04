import type { Meta, StoryObj } from "@storybook/react-vite";
import { UGM } from "@g3t/core";
import { TableView } from "./table";
import { DetailInspector } from "./inspector";
import { SchemaView } from "./schema";
import { DiffRenderer } from "./schema";
import { MapView } from "./map";
import { TreeView } from "./tree";
import { QueryEditor } from "./query";
import { MatrixView } from "./matrix";
import type { ShaclShape } from "./schema";
import type { DiffResult } from "@g3t/core";

function makeUGM() {
  const ugm = new UGM();
  const types = ["Person", "Organization", "Location"];
  for (let i = 0; i < 15; i++) {
    ugm.addNode(`n${i}`, {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      types: [types[i % 3]!],
      properties: {
        name: `Entity ${i}`,
        score: +Math.random().toFixed(2),
        lat: 30 + Math.random() * 20,
        lon: -100 + Math.random() * 50,
      },
    });
  }
  for (let i = 0; i < 12; i++) {
    ugm.addEdge(`n${i}`, `n${(i + 3) % 15}`, {
      type: i % 2 === 0 ? "knows" : "worksAt",
      confidence: 0.5 + Math.random() * 0.5,
    });
  }
  return ugm;
}

function makeTreeUGM() {
  const ugm = new UGM();
  ugm.addNode("root", { types: ["Root"], properties: { name: "Root" } });
  for (let i = 0; i < 5; i++) {
    ugm.addNode(`b${i}`, {
      types: ["Branch"],
      properties: { name: `Branch ${i}` },
    });
    ugm.addEdge("root", `b${i}`, { type: "child" });
    for (let j = 0; j < 3; j++) {
      const leaf = `l${i}_${j}`;
      ugm.addNode(leaf, {
        types: ["Leaf"],
        properties: { name: `Leaf ${i}.${j}` },
      });
      ugm.addEdge(`b${i}`, leaf, { type: "child" });
    }
  }
  return ugm;
}

const meta: Meta = { title: "Views", tags: ["autodocs"] };
export default meta;

// ── Table ───────────────────────────────────────────────────────────

export const Table: StoryObj = {
  render: () => (
    <div style={{ height: 400 }}>
      <TableView ugm={makeUGM()} pageSize={10} />
    </div>
  ),
};

// ── Inspector ───────────────────────────────────────────────────────

export const Inspector: StoryObj = {
  render: () => {
    const ugm = makeUGM();
    return (
      <div style={{ width: 300 }}>
        <DetailInspector ugm={ugm} selection={{ type: "node", id: "n0" }} />
      </div>
    );
  },
};

export const InspectorEmpty: StoryObj = {
  name: "Inspector (no selection)",
  render: () => (
    <div style={{ width: 300 }}>
      <DetailInspector ugm={makeUGM()} selection={null} />
    </div>
  ),
};

// ── Schema ──────────────────────────────────────────────────────────

export const Schema: StoryObj = {
  render: () => {
    const shapes: ShaclShape[] = [
      {
        id: "s1",
        targetClass: "Person",
        constraints: [
          { path: "name", minCount: 1 },
          { path: "score", datatype: "xsd:decimal" },
        ],
      },
    ];
    return (
      <SchemaView
        schema={{
          nodeTypes: ["Person", "Organization", "Location"],
          edgeTypes: ["knows", "worksAt"],
          nodeProperties: {
            Person: ["name", "score", "lat", "lon"],
            Organization: ["name", "score"],
            Location: ["name", "lat", "lon"],
          },
          edgeProperties: {},
        }}
        shapes={shapes}
      />
    );
  },
};

// ── Diff ────────────────────────────────────────────────────────────

export const Diff: StoryObj = {
  render: () => {
    const diff: DiffResult = {
      addedNodes: [
        { id: "new-entity", status: "added" },
        { id: "new-link-target", status: "added" },
      ],
      removedNodes: [{ id: "old-entity", status: "removed" }],
      changedNodes: [
        {
          id: "updated-entity",
          status: "changed",
          propertyChanges: [
            { key: "score", oldValue: 0.3, newValue: 0.9 },
            { key: "status", oldValue: "active", newValue: "flagged" },
          ],
        },
      ],
      addedEdges: [
        {
          id: "e1",
          source: "new-entity",
          target: "n0",
          type: "knows",
          status: "added",
        },
      ],
      removedEdges: [],
      changedEdges: [],
    };
    return <DiffRenderer diff={diff} />;
  },
};

export const DiffEmpty: StoryObj = {
  name: "Diff (no changes)",
  render: () => (
    <DiffRenderer
      diff={{
        addedNodes: [],
        removedNodes: [],
        changedNodes: [],
        addedEdges: [],
        removedEdges: [],
        changedEdges: [],
      }}
    />
  ),
};

// ── Map ─────────────────────────────────────────────────────────────

export const Map: StoryObj = {
  render: () => (
    <div style={{ height: 400 }}>
      <MapView ugm={makeUGM()} />
    </div>
  ),
};

// ── Tree ────────────────────────────────────────────────────────────

export const Tree: StoryObj = {
  render: () => (
    <div style={{ height: 400, overflow: "auto" }}>
      <TreeView ugm={makeTreeUGM()} rootId="root" />
    </div>
  ),
};

// ── Matrix ──────────────────────────────────────────────────────────

export const Matrix: StoryObj = {
  render: () => <MatrixView ugm={makeUGM()} />,
};

// ── Query Editor ────────────────────────────────────────────────────

export const Query: StoryObj = {
  name: "QueryEditor",
  render: () => (
    <div style={{ width: 500 }}>
      <QueryEditor />
    </div>
  ),
};

// ── Missing View Stories ────────────────────────────────────────────

import { SankeyView } from "./sankey";
import { TimelineView } from "./timeline";
import { StatsPanel } from "./stats";

export const Sankey: StoryObj = {
  name: "SankeyView",
  render: () => {
    // Flows aggregate edges between node types, and ECharts sankey
    // requires a DAG, so this fixture wires a consistent direction:
    // Person -> Organization -> Location. The shared makeUGM() connects
    // every edge within a single type, which produces no flows.
    const ugm = new UGM();
    const people = ["p0", "p1", "p2", "p3"];
    const orgs = ["o0", "o1", "o2"];
    const locations = ["l0", "l1"];
    people.forEach((id, i) =>
      ugm.addNode(id, {
        types: ["Person"],
        properties: { name: `Person ${i}` },
      }),
    );
    orgs.forEach((id, i) =>
      ugm.addNode(id, {
        types: ["Organization"],
        properties: { name: `Org ${i}` },
      }),
    );
    locations.forEach((id, i) =>
      ugm.addNode(id, {
        types: ["Location"],
        properties: { name: `Location ${i}` },
      }),
    );
    people.forEach((p, i) => {
      const o = orgs[i % orgs.length];
      if (o) ugm.addEdge(p, o, { type: "worksAt" });
    });
    orgs.forEach((o, i) => {
      const l = locations[i % locations.length];
      if (l) ugm.addEdge(o, l, { type: "basedIn" });
    });
    return (
      <div style={{ height: 300 }}>
        <SankeyView ugm={ugm} />
      </div>
    );
  },
};

export const Timeline: StoryObj = {
  name: "TimelineView",
  render: () => {
    const ugm = new UGM();
    ugm.addNode("e1", {
      types: ["Event"],
      properties: { name: "Start", date: "2025-01-15" },
    });
    ugm.addNode("e2", {
      types: ["Event"],
      properties: { name: "Middle", date: "2025-06-01" },
    });
    ugm.addNode("e3", {
      types: ["Event"],
      properties: { name: "End", date: "2025-12-01" },
    });
    return (
      <div style={{ height: 200 }}>
        <TimelineView ugm={ugm} />
      </div>
    );
  },
};

export const Stats: StoryObj = {
  name: "StatsPanel",
  render: () => {
    const ugm = makeUGM();
    // score is numeric; the histogram needs a numeric property (name is
    // a string and would render the empty state).
    return <StatsPanel ugm={ugm} propertyKey="score" />;
  },
};
