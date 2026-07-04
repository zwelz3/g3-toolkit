import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Core } from "cytoscape";
import {
  UGM,
  eventBus,
  layoutStructural,
  compartmentKey,
  type StructuralGraphInput,
  type StructuralGeometry,
} from "@g3t/core";
import { CytoscapeCanvas } from "./CytoscapeCanvas";
import {
  ContextMenuManager,
  registerToolkitActions,
  registerCompartmentCollapseActions,
  wireCytoscapeContextActions,
} from "../../interaction/context-menu";
import {
  useCompartmentCollapseStore,
  collapsedCompartmentSet,
} from "../../state/compartment-collapse-store";
import {
  EncodingSpecPanel,
  SpecLegend,
  fromLegacyConfig,
  DEFAULT_ENCODING,
  type EncodingSpec,
} from "../../interaction/encoding";

// Small graph used by Default / LayoutSwitching / Theming. The fixture
// stays inline so the story is self-contained — pulling from
// src/demo/fixtures would cross the @g3t/react boundary (D13).
function buildBasicUGM(): UGM {
  const ugm = new UGM();
  const types = ["Person", "Organization", "Location"];
  const names = [
    "Alice",
    "Acme Corp",
    "London",
    "Bob",
    "Globex",
    "Paris",
    "Carol",
    "Initech",
  ];
  for (let i = 0; i < names.length; i++) {
    ugm.addNode(`n${i}`, {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      types: [types[i % 3]!],
      properties: { name: names[i] },
    });
  }
  // Mix of intra-type and inter-type edges so layout has structure.
  const edges: Array<[string, string, string]> = [
    ["n0", "n1", "worksAt"],
    ["n0", "n2", "livesIn"],
    ["n3", "n1", "worksAt"],
    ["n3", "n5", "livesIn"],
    ["n6", "n4", "worksAt"],
    ["n6", "n2", "livesIn"],
    ["n7", "n4", "knows"],
    ["n0", "n3", "knows"],
    ["n3", "n6", "knows"],
  ];
  for (const [s, t, type] of edges) {
    ugm.addEdge(s, t, { type, confidence: 0.85 });
  }
  return ugm;
}

// Graph for VisualEncoding: every node carries numeric `pagerank` and
// `degree` so size encoding actually maps to something visible.
function buildEncodingUGM(): UGM {
  const ugm = new UGM();
  const seed = [
    { id: "a", type: "Hub", pagerank: 0.32 },
    { id: "b", type: "Hub", pagerank: 0.28 },
    { id: "c", type: "Leaf", pagerank: 0.06 },
    { id: "d", type: "Leaf", pagerank: 0.05 },
    { id: "e", type: "Leaf", pagerank: 0.04 },
    { id: "f", type: "Leaf", pagerank: 0.04 },
    { id: "g", type: "Bridge", pagerank: 0.15 },
    { id: "h", type: "Bridge", pagerank: 0.12 },
  ];
  for (const { id, type, pagerank } of seed) {
    ugm.addNode(id, {
      types: [type],
      properties: { name: id.toUpperCase(), pagerank },
    });
  }
  const edges: Array<[string, string]> = [
    ["a", "b"],
    ["a", "g"],
    ["b", "h"],
    ["g", "c"],
    ["g", "d"],
    ["h", "e"],
    ["h", "f"],
    ["a", "c"],
    ["b", "d"],
  ];
  for (const [s, t] of edges) {
    ugm.addEdge(s, t, { type: "links", confidence: 0.9 });
  }
  // Annotate degree as a second numeric property so the panel has a
  // meaningful choice for "Node size".
  ugm.forEachNode((id, attrs) => {
    attrs.properties.degree = ugm.getNeighbors(id).length;
  });
  return ugm;
}

// Layout options shared by stories that expose a layout control.
const LAYOUT_OPTIONS = [
  "fcose",
  "cose",
  "grid",
  "circle",
  "breadthfirst",
  "concentric",
] as const;
type LayoutName = (typeof LAYOUT_OPTIONS)[number];

const meta: Meta<typeof CytoscapeCanvas> = {
  title: "Views/CytoscapeCanvas",
  component: CytoscapeCanvas,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The toolkit's primary graph view. Wraps Cytoscape.js, " +
          "renders a UGM via `ugmToCytoscapeElements`, and surfaces " +
          "toolkit customizations (layout, encoding, theming, context " +
          "menu) through props. Rendering relies on a real Canvas 2D " +
          "context, so stories only render meaningfully in the dev/" +
          "deployed Storybook (real browser).",
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof CytoscapeCanvas>;

// ── Default ─────────────────────────────────────────────────────────

export const Default: Story = {
  argTypes: {
    layout: {
      control: { type: "select" },
      options: LAYOUT_OPTIONS,
      description: "Force/geometric layout algorithm.",
    },
    animate: {
      control: "boolean",
      description:
        "Animate layout transitions (defaults to the OS reduced-motion preference).",
    },
    animationDuration: {
      control: { type: "number", min: 0, max: 2000, step: 50 },
      description: "Layout transition duration in milliseconds.",
    },
  },
  args: {
    layout: "fcose",
    animate: true,
    animationDuration: 400,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Baseline render. Use the Controls panel to switch layout and " +
          "tune animation. Node color comes from the colorblind-safe " +
          "Okabe-Ito palette (indexed by node type); edges fade by " +
          "confidence and inferred edges (`_asserted=0`) render dashed.",
      },
    },
  },
  render: (args) => {
    // ugm must be referentially stable (a new identity re-inits layout),
    // so memoize it; the Controls drive only the props spread below.
    const ugm = useMemo(() => buildBasicUGM(), []);
    return (
      <div style={{ width: "100%", height: 500 }}>
        <CytoscapeCanvas {...args} ugm={ugm} />
      </div>
    );
  },
};

// ── Layout switching ────────────────────────────────────────────────

export const LayoutSwitching: Story = {
  argTypes: {
    layout: {
      control: { type: "select" },
      options: LAYOUT_OPTIONS,
      description:
        "Cytoscape layout name. `dagre`/`elk`/`hierarchy` are " +
        "intentionally omitted — those map to `breadthfirst` in the " +
        "demo (the extensions aren't registered here). The in-canvas " +
        "dropdown below mirrors this arg so the switch is visible " +
        "without opening the Controls panel.",
    },
  },
  args: { layout: "fcose" },
  parameters: {
    docs: {
      description: {
        story:
          "Pick a layout from the dropdown (or the `layout` arg in " +
          "the Controls panel) to re-lay out the same graph with a " +
          "different engine. Cytoscape rebuilds positions on layout " +
          "change; the UGM stays the same.",
      },
    },
  },
  render: (args) => {
    const ugm = useMemo(() => buildBasicUGM(), []);
    const [layout, setLayout] = useState<LayoutName>(
      (args.layout as LayoutName) ?? "fcose",
    );
    // Track arg changes from the Storybook Controls panel so both
    // surfaces stay in sync.
    useEffect(() => {
      if (args.layout && args.layout !== layout) {
        setLayout(args.layout as LayoutName);
      }
    }, [args.layout, layout]);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: 500,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            fontSize: 12,
            background: "var(--g3t-bg-secondary, #f8f9fa)",
            color: "var(--g3t-text-primary)",
            borderBottom: "1px solid var(--g3t-border, #dee2e6)",
          }}
        >
          <label htmlFor="layout-select">Layout:</label>
          <select
            id="layout-select"
            value={layout}
            onChange={(e) => setLayout(e.target.value as LayoutName)}
          >
            {LAYOUT_OPTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <CytoscapeCanvas ugm={ugm} layout={layout} />
        </div>
      </div>
    );
  },
};

// ── Visual encoding ─────────────────────────────────────────────────

export const VisualEncoding: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "`EncodingSpecPanel` edits an `EncodingSpec` (the channel/" +
          "driver/scale grammar); `CytoscapeCanvas` applies it through " +
          "the `encodingSpec` prop (restyle-only: spec edits never " +
          "re-run layout), and `SpecLegend` mirrors it through the " +
          "same resolvers, so legend and canvas cannot disagree.",
      },
    },
  },
  render: () => {
    const ugm = useMemo(() => buildEncodingUGM(), []);
    const [spec, setSpec] = useState<EncodingSpec>(() =>
      fromLegacyConfig({
        ...DEFAULT_ENCODING,
        nodeSizeProperty: "pagerank",
        nodeSizeRange: [20, 80],
      }),
    );
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 200px",
          gap: 12,
          width: "100%",
          height: 500,
        }}
      >
        <EncodingSpecPanel ugm={ugm} spec={spec} onChange={setSpec} />
        <CytoscapeCanvas ugm={ugm} encodingSpec={spec} />
        <SpecLegend ugm={ugm} spec={spec} />
      </div>
    );
  },
};

// ── Theming ─────────────────────────────────────────────────────────

export const Theming: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Switch the Storybook theme toolbar (top of the canvas) " +
          "to light / dark / high-contrast. The surrounding chrome " +
          "follows CSS custom properties (`--g3t-*`). Node colors " +
          "stay constant on purpose — the palette is the Okabe-Ito " +
          "colorblind-safe set and is theme-independent (R7.8).",
      },
    },
  },
  render: () => (
    <div style={{ width: "100%", height: 500 }}>
      <CytoscapeCanvas ugm={buildBasicUGM()} />
    </div>
  ),
};

// ── With context menu ───────────────────────────────────────────────

export const WithContextMenu: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Right-click a node to open the toolkit's full action set: " +
          "Inspect, View Neighbors, Expand Neighbors, Focus, Pin, " +
          "Hide, Edit Appearance. Actions emit events on the shared " +
          "`eventBus`; `wireCytoscapeContextActions` translates those " +
          "events into cytoscape operations (lock/hide/fit).",
      },
    },
  },
  render: () => {
    const ugm = useMemo(() => buildBasicUGM(), []);
    const [lastAction, setLastAction] = useState<string>("(none yet)");

    const manager = useMemo(() => {
      const m = new ContextMenuManager();
      registerToolkitActions(m, {
        ugm,
        eventBus,
        defaultHops: 1,
        onViewNeighbors: (id, hops) =>
          setLastAction(`View Neighbors → ${id} (${hops}-hop)`),
        onEditAppearance: (id) => setLastAction(`Edit Appearance → ${id}`),
      });
      return m;
    }, [ugm]);

    const cyRef = useRef<Core | null>(null);
    useEffect(() => {
      const cy = cyRef.current;
      if (!cy) return;
      const unsub = wireCytoscapeContextActions(cy, eventBus, ugm, {
        onViewNeighborhood: (_sub, centerId, hops) =>
          setLastAction(`Neighborhood ready: ${centerId} (${hops}-hop)`),
      });
      return unsub;
    }, [ugm]);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: 500,
        }}
      >
        <div
          style={{
            padding: "6px 10px",
            fontSize: 12,
            background: "var(--g3t-bg-secondary, #f8f9fa)",
            color: "var(--g3t-text-primary)",
            borderBottom: "1px solid var(--g3t-border, #dee2e6)",
          }}
        >
          Last action: <strong>{lastAction}</strong>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <CytoscapeCanvas
            ugm={ugm}
            menuManager={manager}
            onReady={(cy) => {
              cyRef.current = cy;
            }}
          />
        </div>
      </div>
    );
  },
};

// Inline structural fixture (kept local so the story is self-contained,
// like buildBasicUGM): two compartmented containers with a typed edge.
function buildStructuralFixture(): StructuralGraphInput {
  return {
    nodes: [
      {
        id: "Sensor",
        header: { stereotype: "Block", name: "Sensor" },
        compartments: [
          {
            id: "attributes",
            title: "attributes",
            rows: [
              { id: "Sensor.accuracy", text: "accuracy : xsd:double [0..1]" },
              {
                id: "Sensor.calibrationDate",
                text: "calibrationDate : xsd:date",
              },
            ],
          },
          {
            id: "operations",
            title: "operations",
            rows: [{ id: "Sensor.calibrate", text: "calibrate() : void" }],
          },
        ],
        ports: [{ id: "Sensor.out", side: "EAST" }],
      },
      {
        id: "Lens",
        header: { stereotype: "Block", name: "Lens" },
        compartments: [
          {
            id: "attributes",
            title: "attributes",
            rows: [
              { id: "Lens.focalLength", text: "focalLength : xsd:double" },
              { id: "Lens.coating", text: "coating : xsd:string" },
            ],
          },
        ],
        ports: [{ id: "Lens.in", side: "WEST" }],
      },
    ],
    edges: [
      {
        id: "Sensor->Lens",
        source: "Sensor",
        target: "Lens",
        sourcePort: "Sensor.out",
        targetPort: "Lens.in",
        kind: "association",
      },
    ],
  };
}

export const StructuralCollapse: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Structural (ELK) view with an on-container collapse button. Each " +
          "container draws a chip in its header: tap \u2212 to collapse all " +
          "of that container's compartments, + to expand. The same " +
          "action lives on the container's right-click menu. Collapse is a " +
          "layout-time input, so the container physically shrinks " +
          "(layoutStructural re-runs with the collapsed set), rather than a " +
          "style hide.",
      },
    },
  },
  render: () => {
    const ugm = useMemo(() => new UGM(), []);
    const input = useMemo<StructuralGraphInput>(
      () => buildStructuralFixture(),
      [],
    );

    // Mirror the toolkit store into local state; clear on mount so the
    // story starts expanded regardless of prior interaction.
    const [collapsedKeys, setCollapsedKeys] = useState<string[]>([]);
    useEffect(() => {
      useCompartmentCollapseStore.getState().clear();
      return useCompartmentCollapseStore.subscribe((s) =>
        setCollapsedKeys(s.collapsedKeys),
      );
    }, []);

    const [scene, setScene] = useState<{
      input: StructuralGraphInput;
      geometry: StructuralGeometry;
    } | null>(null);
    useEffect(() => {
      let cancelled = false;
      void layoutStructural(input, {
        direction: "DOWN",
        collapsedCompartments: collapsedCompartmentSet(collapsedKeys),
      }).then((geometry) => {
        if (!cancelled) setScene({ input, geometry });
      });
      return () => {
        cancelled = true;
      };
    }, [input, collapsedKeys]);

    // A container shows + only when ALL its compartments are collapsed.
    const collapsedContainers = useMemo(() => {
      const set = new Set<string>();
      for (const n of input.nodes) {
        const comps = n.compartments ?? [];
        if (
          comps.length > 0 &&
          comps.every((c) => collapsedKeys.includes(compartmentKey(n.id, c.id)))
        ) {
          set.add(n.id);
        }
      }
      return set;
    }, [input, collapsedKeys]);

    const menu = useMemo(() => {
      const m = new ContextMenuManager();
      registerCompartmentCollapseActions(m);
      return m;
    }, []);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: 520,
        }}
      >
        <div
          style={{
            padding: "6px 10px",
            fontSize: 12,
            background: "var(--g3t-bg-secondary, #f8f9fa)",
            color: "var(--g3t-text-primary)",
            borderBottom: "1px solid var(--g3t-border, #dee2e6)",
          }}
        >
          Tap a container's header chip to collapse (<strong>{"\u2212"}</strong>
          ) or expand (<strong>+</strong>); right-click also works. Collapsed
          containers: <strong>{collapsedContainers.size}</strong>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {scene ? (
            <CytoscapeCanvas
              ugm={ugm}
              structural={scene}
              structuralDecorations={{ collapsedContainers }}
              menuManager={menu}
              onCompartmentToggle={(id, cids) =>
                useCompartmentCollapseStore
                  .getState()
                  .toggleAll(cids.map((c) => compartmentKey(id, c)))
              }
            />
          ) : null}
        </div>
      </div>
    );
  },
};
