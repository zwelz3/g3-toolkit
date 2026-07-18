/**
 * CytoscapeCanvas React component test (M0.E3.T1).
 *
 * Cytoscape requires a real Canvas 2D context which jsdom doesn't
 * provide (canvas npm package needs native deps). We mock cytoscape
 * to verify the React wrapper logic; full visual tests go in
 * Playwright (tests/e2e/).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";

// Mock cytoscape before importing the component
const mockCy = {
  on: vi.fn(),
  removeListener: vi.fn(),
  destroy: vi.fn(),
  nodes: vi.fn(() => ({ length: 2, forEach: vi.fn() })),
  // forEach: the routed-segment bypass iterates the routed-edge
  // selection at mount (review 3.4); real collections provide it.
  edges: vi.fn(() => ({ length: 1, forEach: vi.fn() })),
  batch: vi.fn((fn: () => void) => fn()),
  style: vi.fn(() => ({
    fromJson: vi.fn(() => ({ update: vi.fn() })),
  })),
  getElementById: vi.fn(() => ({ nonempty: () => false })),
  // Viewport API used by the structural camera policy (fit on first mount,
  // capture + restore pan/zoom across a collapse rebuild). Real cytoscape
  // instances always provide these.
  fit: vi.fn(),
  pan: vi.fn(() => ({ x: 0, y: 0 })),
  zoom: vi.fn(() => 1),
  viewport: vi.fn(),
  // Selection-highlight subscription path (exercised once a test
  // actually changes the selection store while a canvas is mounted).
  // The same collection now also serves the in-place scene patch
  // (MR-1 flash fix): the patch snapshots ids via elements().forEach.
  elements: vi.fn(() => ({ removeClass: vi.fn(), forEach: vi.fn() })),
  // In-place patch surface (planScenePatch application): with the
  // id snapshot empty (forEach above yields nothing), every element
  // lands in `add`, which is fine for these lifecycle pins.
  $id: vi.fn(() => ({ empty: () => true, json: vi.fn() })),
  remove: vi.fn(),
  collection: vi.fn(() => ({})),
  add: vi.fn(),
};

vi.mock("cytoscape", () => ({
  default: vi.fn(() => mockCy),
  __esModule: true,
}));

vi.mock("cytoscape-fcose", () => ({
  default: vi.fn(),
  __esModule: true,
}));

// Import component AFTER mocks are set up
const { CytoscapeCanvas } = await import("./CytoscapeCanvas");

describe("CytoscapeCanvas component (M0.E3.T1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the container div with data-testid", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });

    render(<CytoscapeCanvas ugm={ugm} />);

    const container = screen.getByTestId("cytoscape-canvas");
    expect(container).toBeInTheDocument();
    expect(container.style.width).toBe("100%");
    expect(container.style.height).toBe("100%");
  });

  it("merges layoutOptions into the layout object after built-in tuning (5.11)", async () => {
    const cytoscape = (await import("cytoscape")).default as unknown as {
      mock: { calls: Array<[{ layout: Record<string, unknown> }]> };
    };
    const ugm = new UGM();
    render(
      <CytoscapeCanvas
        ugm={ugm}
        layoutOptions={{ idealEdgeLength: 140, padding: 60 }}
      />,
    );
    const layout = cytoscape.mock.calls.at(-1)?.[0].layout;
    expect(layout?.idealEdgeLength).toBe(140);
    expect(layout?.padding).toBe(60);
    // Built-in tuning keys the caller did not touch survive.
    expect(layout?.nodeRepulsion).toBeDefined();
  });

  it("calls onReady with the Cytoscape instance", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["Person"], properties: { name: "Alice" } });
    ugm.addNode("b", { types: ["Person"], properties: { name: "Bob" } });
    ugm.addEdge("a", "b", { type: "knows" });

    const onReady = vi.fn();
    render(<CytoscapeCanvas ugm={ugm} onReady={onReady} />);

    expect(onReady).toHaveBeenCalledOnce();
    expect(onReady).toHaveBeenCalledWith(mockCy);
  });

  it("cleans up Cytoscape on unmount", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });

    const { unmount } = render(<CytoscapeCanvas ugm={ugm} />);
    unmount();

    expect(mockCy.destroy).toHaveBeenCalled();
  });

  // Bugfix 8 regression test: prevent the OS-level browser context menu
  // from showing alongside our custom one.
  it("suppresses the native contextmenu on the canvas container", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    render(<CytoscapeCanvas ugm={ugm} />);

    const container = screen.getByTestId("cytoscape-canvas");
    const evt = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
  });

  // Bugfix 8 regression test: the contextmenu listener must be removed
  // when the component unmounts, so it doesn't outlive the container.
  it("removes the contextmenu listener on unmount", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    const { unmount, container } = render(<CytoscapeCanvas ugm={ugm} />);

    // Find the canvas container BEFORE unmount; after unmount it's gone
    const canvasContainer = container.querySelector(
      '[data-testid="cytoscape-canvas"]',
    ) as HTMLElement;
    expect(canvasContainer).toBeTruthy();

    // Spy on removeEventListener so we can detect the cleanup
    const removeSpy = vi.spyOn(canvasContainer, "removeEventListener");
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("contextmenu", expect.any(Function));
  });
});

describe("encoding spec node glyph rule", () => {
  it("targets only patched nodes via attribute presence", async () => {
    const { ENCODING_NODE_RULES } = await import("./CytoscapeCanvas");
    expect(ENCODING_NODE_RULES.map((r) => r.selector)).toContain("node[_icon]");
    const style = (
      ENCODING_NODE_RULES[0] as unknown as {
        style: Record<string, string>;
      }
    ).style;
    expect(style["background-image"]).toBe("data(_icon)");
  });
});

describe("theme -> canvas wiring (round 20)", () => {
  it("themeColorRules speaks the theme's canvas vocabulary with generic selectors", async () => {
    const { themeColorRules } = await import("./CytoscapeCanvas");
    const { THEME_PRESETS } = await import("../../theme/ThemeManager");
    const dark = THEME_PRESETS["dark"]!;
    const rules = themeColorRules(dark);
    const bySelector = new Map(
      rules.map((r) => [
        r.selector,
        (r as unknown as { style: Record<string, unknown> }).style,
      ]),
    );
    expect(bySelector.get("node.g3t-selected")?.["outline-color"]).toBe(
      dark.selectionHighlight,
    );
    expect(bySelector.get("edge")?.["line-color"]).toBe(dark.edgeColor);
    expect(bySelector.get(":parent")?.["background-color"]).toBe(
      dark.bgSecondary,
    );
    // Generic selectors only: nothing targets the spec's attribute
    // mappers, so theming can never fight the encoding.
    expect(rules.every((r) => !r.selector.includes("["))).toBe(true);
  });

  it("a theme switch restyles in place without re-initializing", async () => {
    const { useThemeStore } = await import("../../theme/ThemeManager");
    const cytoscape = (await import("cytoscape")).default as unknown as {
      mock: { calls: unknown[][] };
    };
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"], properties: {} });
    render(<CytoscapeCanvas ugm={ugm} />);
    const initCalls = cytoscape.mock.calls.length;
    act(() => {
      useThemeStore.getState().setTheme("dark");
    });
    expect(mockCy.style).toHaveBeenCalled();
    expect(cytoscape.mock.calls.length).toBe(initCalls);
    act(() => {
      useThemeStore.getState().setTheme("light");
    });
  });
});

describe("compound container rule (slice 1, round 17)", () => {
  it("styles :parent as a UML-labeled container", async () => {
    const { COMPOUND_CONTAINER_RULE } = await import("./CytoscapeCanvas");
    expect(COMPOUND_CONTAINER_RULE.selector).toBe(":parent");
    const style = (
      COMPOUND_CONTAINER_RULE as unknown as { style: Record<string, unknown> }
    ).style;
    expect(style["label"]).toBe("data(_compoundLabel)");
    expect(style["text-valign"]).toBe("top");
  });
});

describe("position pin indicator rule (round 17)", () => {
  it("the pinned class rule maps nothing; the visual is a bypass (12.1)", async () => {
    const { PIN_INDICATOR_RULE } = await import("./CytoscapeCanvas");
    expect(PIN_INDICATOR_RULE.selector).toBe("node.g3t-pinned");
    // Two browser passes rejected data()-mapped array values for the
    // multi-image background channel; composePinStack writes literal
    // per-element bypasses instead (see compose-pin-stack.test.ts).
    expect(
      Object.keys(
        (PIN_INDICATOR_RULE as unknown as { style: Record<string, unknown> })
          .style,
      ),
    ).toHaveLength(0);
  });
});

describe("encoding spec edge rules", () => {
  it("merges attribute-presence rules so unpatched edges keep legacy style", async () => {
    const { ENCODING_EDGE_RULES } = await import("./CytoscapeCanvas");
    const selectors = ENCODING_EDGE_RULES.map((r) => r.selector);
    expect(selectors).toContain("edge[_ewidth]");
    expect(selectors).toContain("edge[_ecolor]");
    const colorRule = ENCODING_EDGE_RULES.find(
      (r) => r.selector === "edge[_ecolor]",
    );
    const styleOf = (rule: unknown): Record<string, string> =>
      (rule as { style?: Record<string, string>; css?: Record<string, string> })
        .style ??
      (rule as { css?: Record<string, string> }).css ??
      {};
    expect(styleOf(colorRule)["target-arrow-color"]).toBe("data(_ecolor)");
  });
});

describe("structural scene rendering (slice A2, round 32)", () => {
  // @see specs/01-functional-views.md R1.18
  async function renderStructural() {
    const { layoutStructural } = await import("@g3t/core");
    const input = {
      nodes: [
        {
          id: "sensor",
          header: { stereotype: "Block", name: "Sensor" },
          compartments: [
            {
              id: "attributes",
              rows: [{ id: "sensor.cal", text: "calibrationDate" }],
            },
          ],
        },
      ],
      edges: [],
    };
    const geometry = await layoutStructural(input);
    const ugm = new UGM();
    ugm.addNode("sensor.cal", { types: ["PropertyShape"] });
    render(<CytoscapeCanvas ugm={ugm} structural={{ input, geometry }} />);
    const cytoscape = (await import("cytoscape")).default as unknown as {
      mock: { calls: Array<[Record<string, unknown>]> };
    };
    return cytoscape.mock.calls.at(-1)![0] as {
      elements: Array<{ data: { id?: string }; classes?: string }>;
      layout: { name: string };
    };
  }

  it("renders structural elements with the preset layout instead of the UGM projection", async () => {
    const opts = await renderStructural();
    expect(opts.layout.name).toBe("preset");
    const ids = opts.elements.map((e) => e.data.id);
    expect(ids).toContain("sensor");
    expect(ids).toContain("sensor::header");
    expect(ids).toContain("sensor.cal");
  });

  it("tap on a compartment row selects exactly that row", async () => {
    const { useSelectionStore } = await import("../../state/selection-store");
    useSelectionStore.getState().clearSelection();
    await renderStructural();
    // Find the registered tap handler for nodes and fire it for the row.
    const tapCall = (
      mockCy.on as unknown as {
        mock: { calls: Array<[string, ...unknown[]]> };
      }
    ).mock.calls.find((c) => c[0] === "tap" && c[1] === "node")!;
    const handler = tapCall[2] as (evt: {
      target: { id: () => string; hasClass: (c: string) => boolean };
      originalEvent: Record<string, unknown>;
    }) => void;
    handler({
      target: { id: () => "sensor.cal", hasClass: () => false },
      originalEvent: {},
    });
    expect([...useSelectionStore.getState().selectedNodeIds]).toEqual([
      "sensor.cal",
    ]);
  });

  it("merges the structural stylesheet rules into the composed stylesheet", async () => {
    const opts = (await renderStructural()) as unknown as {
      style: Array<{ selector: string }>;
    };
    const selectors = opts.style.map((r) => r.selector);
    expect(selectors).toContain("node.g3t-structural-container");
    expect(selectors).toContain("node.g3t-structural-row");
  });
});

describe("structural camera preservation across rebuilds (round 56)", () => {
  // A compartment collapse re-runs layoutStructural (often asynchronously),
  // so a single collapse can land as two renders: decorations first, then the
  // new geometry. Both keep the SAME input graph, so both must preserve the
  // camera rather than refit. These guard against the refit regression.
  const sensorInput = () => ({
    nodes: [
      {
        id: "sensor",
        header: { stereotype: "Block", name: "Sensor" },
        compartments: [
          {
            id: "attributes",
            rows: [{ id: "sensor.cal", text: "calibrationDate" }],
          },
        ],
      },
    ],
    edges: [],
  });

  it("restores pan/zoom on a same-graph rebuild instead of refitting", async () => {
    const { layoutStructural } = await import("@g3t/core");
    const input = sensorInput();
    const ugm = new UGM();
    ugm.addNode("sensor.cal", { types: ["PropertyShape"] });
    const geometry0 = await layoutStructural(input);
    // The post-collapse geometry: a NEW geometry object for the SAME input.
    const geometry1 = await layoutStructural(input, { direction: "DOWN" });

    mockCy.fit.mockClear();
    mockCy.viewport.mockClear();

    const { rerender } = render(
      <CytoscapeCanvas
        ugm={ugm}
        structural={{ input, geometry: geometry0 }}
        structuralDecorations={{ closedContainers: new Set() }}
      />,
    );
    // First structural mount fits.
    expect(mockCy.fit).toHaveBeenCalledTimes(1);
    expect(mockCy.viewport).not.toHaveBeenCalled();

    mockCy.fit.mockClear();
    mockCy.viewport.mockClear();
    mockCy.destroy.mockClear();
    mockCy.batch.mockClear();

    // Same input, fresh geometry + decorations objects (a same-graph rebuild,
    // and the async geometry-update render that follows it).
    await act(async () => {
      rerender(
        <CytoscapeCanvas
          ugm={ugm}
          structural={{ input, geometry: geometry1 }}
          structuralDecorations={{ closedContainers: new Set(["sensor"]) }}
        />,
      );
    });
    // Round-56 pin, evolved with the MR-1 flash fix: a same-graph
    // rebuild no longer destroys/recreates the instance, so there is
    // no camera to restore and nothing to refit: the camera is
    // untouched BY CONSTRUCTION (D15 becomes a non-event on this
    // path). The scene lands as an in-place batched patch instead.
    expect(mockCy.viewport).not.toHaveBeenCalled();
    expect(mockCy.fit).not.toHaveBeenCalled();
    expect(mockCy.destroy).not.toHaveBeenCalled();
    expect(mockCy.batch).toHaveBeenCalled();
  });

  it("fits when a genuinely different graph loads", async () => {
    const { layoutStructural } = await import("@g3t/core");
    const inputA = sensorInput();
    const inputB = {
      nodes: [
        {
          id: "actuator",
          header: { stereotype: "Block", name: "Actuator" },
          compartments: [
            { id: "ops", rows: [{ id: "actuator.move", text: "move()" }] },
          ],
        },
      ],
      edges: [],
    };
    const ugm = new UGM();
    const geomA = await layoutStructural(inputA);
    const geomB = await layoutStructural(inputB);

    const { rerender } = render(
      <CytoscapeCanvas
        ugm={ugm}
        structural={{ input: inputA, geometry: geomA }}
      />,
    );
    mockCy.fit.mockClear();
    mockCy.viewport.mockClear();

    await act(async () => {
      rerender(
        <CytoscapeCanvas
          ugm={ugm}
          structural={{ input: inputB, geometry: geomB }}
        />,
      );
    });
    // Different node ids => not the same graph => fit, do not preserve.
    expect(mockCy.fit).toHaveBeenCalledTimes(1);
    expect(mockCy.viewport).not.toHaveBeenCalled();
  });
});

describe("structural decoration churn does not recreate the instance (round 57)", () => {
  // structuralDecorations is typically a fresh object literal each render
  // (e.g. {{ closedContainers }}). A re-render that does not change its
  // CONTENT (a selection or hover) must not tear down and recreate the
  // instance, which would reset the camera and any manual node positions.
  const sensorScene = async () => {
    const { layoutStructural } = await import("@g3t/core");
    const input = {
      nodes: [
        {
          id: "sensor",
          header: { stereotype: "Block", name: "Sensor" },
          compartments: [
            {
              id: "attributes",
              rows: [{ id: "sensor.cal", text: "calibrationDate" }],
            },
          ],
        },
      ],
      edges: [],
    };
    const geometry = await layoutStructural(input);
    // A STABLE scene object: a selection re-render keeps the same scene.
    return { input, geometry } as {
      input: typeof input;
      geometry: typeof geometry;
    };
  };

  it("a fresh decorations object with unchanged content does not re-init", async () => {
    const cytoscape = (await import("cytoscape")).default as unknown as {
      mock: { calls: unknown[] };
    };
    const scene = await sensorScene();
    const ugm = new UGM();
    const { rerender } = render(
      <CytoscapeCanvas
        ugm={ugm}
        structural={scene}
        structuralDecorations={{ closedContainers: new Set() }}
      />,
    );
    const initial = cytoscape.mock.calls.length;
    // Same scene reference, a NEW decorations object with identical content.
    await act(async () => {
      rerender(
        <CytoscapeCanvas
          ugm={ugm}
          structural={scene}
          structuralDecorations={{ closedContainers: new Set() }}
        />,
      );
    });
    expect(cytoscape.mock.calls.length).toBe(initial);
  });

  it("a real decoration content change does re-init", async () => {
    const cytoscape = (await import("cytoscape")).default as unknown as {
      mock: { calls: unknown[] };
    };
    const scene = await sensorScene();
    const ugm = new UGM();
    const { rerender } = render(
      <CytoscapeCanvas
        ugm={ugm}
        structural={scene}
        structuralDecorations={{ closedContainers: new Set() }}
      />,
    );
    const initial = cytoscape.mock.calls.length;
    await act(async () => {
      rerender(
        <CytoscapeCanvas
          ugm={ugm}
          structural={scene}
          structuralDecorations={{ closedContainers: new Set(["sensor"]) }}
        />,
      );
    });
    // Round-57 pin, evolved with the MR-1 flash fix: a decoration
    // content change over the SAME graph patches the live instance
    // (classes/data via the batched scene patch) instead of
    // re-initializing; construction count is UNCHANGED.
    expect(cytoscape.mock.calls.length).toBe(initial);
    expect(mockCy.batch).toHaveBeenCalled();
  });
});

describe("multi-select drag (review 4.8)", () => {
  // The toolkit never calls cy.select(), so cytoscape's native
  // drag-selected-together is lost; the canvas reconstructs it with
  // grab/drag/free handlers. Simulated here against live node fakes.
  function liveNodes() {
    const pos: Record<string, { x: number; y: number }> = {
      a: { x: 0, y: 0 },
      b: { x: 100, y: 50 },
      c: { x: 200, y: 200 },
    };
    const lockedIds = new Set(["c"]); // c is pinned
    const nodeFake = (id: string) => ({
      id: () => id,
      nonempty: () => true,
      locked: () => lockedIds.has(id),
      position: (p?: { x: number; y: number }) => {
        if (p) pos[id] = p;
        return pos[id]!;
      },
    });
    return { pos, nodeFake };
  }

  function handlersByEvent() {
    const map = new Map<string, (evt: unknown) => void>();
    for (const call of mockCy.on.mock.calls) {
      if (call.length === 3 && call[1] === "node") {
        map.set(call[0] as string, call[2] as (evt: unknown) => void);
      }
    }
    return map;
  }

  it("drags every selected unlocked node by the anchor delta; pinned stays; free ends the group", async () => {
    const { pos, nodeFake } = liveNodes();
    mockCy.getElementById.mockImplementation(((id: string) =>
      nodeFake(id)) as never);

    const ugm = new UGM();
    for (const id of ["a", "b", "c"]) ugm.addNode(id, { types: ["T"] });
    render(<CytoscapeCanvas ugm={ugm} />);
    await act(async () => {
      useSelectionStore.getState().selectNodes(["a", "b", "c"]);
    });

    const handlers = handlersByEvent();
    expect(handlers.has("grab")).toBe(true);
    expect(handlers.has("drag")).toBe(true);
    expect(handlers.has("free")).toBe(true);
    const grab = handlers.get("grab")!;
    const drag = handlers.get("drag")!;
    const free = handlers.get("free")!;

    const anchor = nodeFake("a");
    act(() => {
      grab({ target: anchor });
    });
    // The user drags the anchor; cytoscape moves it natively.
    pos.a = { x: 30, y: 10 };
    act(() => {
      drag({ target: anchor });
    });
    // b follows by the same delta; pinned c never moves.
    expect(pos.b).toEqual({ x: 130, y: 60 });
    expect(pos.c).toEqual({ x: 200, y: 200 });

    act(() => {
      free({ target: anchor });
    });
    pos.a = { x: 60, y: 20 };
    act(() => {
      drag({ target: anchor });
    });
    expect(pos.b).toEqual({ x: 130, y: 60 }); // group ended

    mockCy.getElementById.mockImplementation((() => ({
      nonempty: () => false,
    })) as never);
  });

  it("a grab outside the selection (or single selection) starts no group", async () => {
    const { pos, nodeFake } = liveNodes();
    mockCy.getElementById.mockImplementation(((id: string) =>
      nodeFake(id)) as never);
    const ugm = new UGM();
    for (const id of ["a", "b", "c"]) ugm.addNode(id, { types: ["T"] });
    render(<CytoscapeCanvas ugm={ugm} />);
    await act(async () => {
      useSelectionStore.getState().selectNodes(["b"]);
    });
    const handlers = handlersByEvent();
    const anchor = nodeFake("a");
    act(() => {
      handlers.get("grab")!({ target: anchor });
    });
    pos.a = { x: 5, y: 5 };
    act(() => {
      handlers.get("drag")!({ target: anchor });
    });
    expect(pos.b).toEqual({ x: 100, y: 50 });
    mockCy.getElementById.mockImplementation((() => ({
      nonempty: () => false,
    })) as never);
  });
});
