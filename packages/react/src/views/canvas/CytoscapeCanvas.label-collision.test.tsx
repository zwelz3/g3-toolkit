/**
 * CytoscapeCanvas `labelCollision` tests (issue #40).
 *
 * The pass is an overlay restyle: it measures rendered label boxes,
 * runs the pure resolver, and applies a class (hide) or a data field
 * (shorten). Isolated mock with a label-box API so the pass has
 * something to measure; the shared canvas mock stays untouched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import { useSelectionStore } from "../../state/selection-store";

type Box = { x1: number; y1: number; w: number; h: number };
type FakeEle = {
  id: () => string;
  isNode: () => boolean;
  data: (k: string, v?: unknown) => unknown;
  removeData: (k: string) => void;
  hasClass: (c: string) => boolean;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  visible: () => boolean;
  degree: () => number;
  renderedBoundingBox: (opts: unknown) => Box;
  empty: () => boolean;
  nonempty: () => boolean;
  classes: Set<string>;
  store: Record<string, unknown>;
};
let eles: FakeEle[] = [];
const bboxCalls: unknown[] = [];
function fakeEle(
  id: string,
  kind: "node" | "edge",
  box: Box,
  data: Record<string, unknown>,
): FakeEle {
  const store: Record<string, unknown> = { id, label: id, ...data };
  const classes = new Set<string>();
  return {
    id: () => id,
    isNode: () => kind === "node",
    data: (k: string, v?: unknown) => {
      if (v === undefined) return store[k];
      store[k] = v;
      return undefined;
    },
    removeData: (k: string) => {
      Reflect.deleteProperty(store, k);
    },
    hasClass: (c: string) => classes.has(c),
    addClass: (c: string) => {
      classes.add(c);
    },
    removeClass: (c: string) => {
      classes.delete(c);
    },
    visible: () => true,
    degree: () => 0,
    renderedBoundingBox: (opts: unknown) => {
      bboxCalls.push(opts);
      return box;
    },
    empty: () => false,
    nonempty: () => true,
    classes,
    store,
  };
}
const handlers = new Map<string, Array<(...a: unknown[]) => void>>();
const cy = {
  on: vi.fn((evt: string, a: unknown, b?: unknown) => {
    const fn = (typeof a === "function" ? a : b) as (...x: unknown[]) => void;
    if (!handlers.has(evt)) handlers.set(evt, []);
    handlers.get(evt)!.push(fn);
  }),
  one: vi.fn(),
  removeListener: vi.fn(),
  destroyed: () => false,
  destroy: vi.fn(),
  nodes: vi.fn(() => {
    const ns = eles.filter((e) => e.isNode());
    return {
      length: ns.length,
      forEach: (f: (n: FakeEle) => void) => ns.forEach(f),
    };
  }),
  edges: vi.fn(() => {
    const es = eles.filter((e) => !e.isNode());
    return {
      length: es.length,
      forEach: (f: (n: FakeEle) => void) => es.forEach(f),
    };
  }),
  elements: vi.fn(() => ({
    removeClass: vi.fn(),
    forEach: (f: (n: FakeEle) => void) => eles.forEach(f),
  })),
  batch: vi.fn((fn: () => void) => fn()),
  style: vi.fn(() => ({ fromJson: vi.fn(() => ({ update: vi.fn() })) })),
  getElementById: vi.fn(
    (id: string): Pick<FakeEle, "empty" | "nonempty"> =>
      eles.find((e) => e.id() === id) ?? {
        empty: (): boolean => true,
        nonempty: (): boolean => false,
      },
  ),
  pan: vi.fn(() => ({ x: 0, y: 0 })),
  zoom: vi.fn(() => 1),
  fit: vi.fn(),
  viewport: vi.fn(),
};
const cytoscapeFn = vi.fn((_opts?: unknown) => cy);
vi.mock("cytoscape", () => ({ default: cytoscapeFn, __esModule: true }));
vi.mock("cytoscape-fcose", () => ({ default: vi.fn(), __esModule: true }));

const { CytoscapeCanvas } = await import("./CytoscapeCanvas");

const fireLayoutStop = () => {
  act(() => {
    for (const h of handlers.get("layoutstop") ?? []) h();
  });
};

function threeNodeGraph(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["T"] });
  ugm.addNode("b", { types: ["T"] });
  ugm.addNode("c", { types: ["T"] });
  return ugm;
}

// a and b overprint; c is clear of both. a outranks b by _labelPriority.
function overprintingElements(): FakeEle[] {
  return [
    fakeEle("a", "node", { x1: 0, y1: 0, w: 40, h: 12 }, { _labelPriority: 2 }),
    fakeEle(
      "b",
      "node",
      { x1: 20, y1: 4, w: 40, h: 12 },
      { _labelPriority: 1 },
    ),
    fakeEle("c", "node", { x1: 200, y1: 0, w: 40, h: 12 }, {}),
  ];
}

describe("CytoscapeCanvas labelCollision (issue #40)", () => {
  beforeEach(() => {
    cytoscapeFn.mockClear();
    cy.on.mockClear();
    handlers.clear();
    bboxCalls.length = 0;
    useSelectionStore.setState({
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      hoveredNodeId: null,
    });
  });

  it("composes the hidden-class rule and the [_labelShort]-scoped label mappings", () => {
    eles = overprintingElements();
    render(<CytoscapeCanvas ugm={threeNodeGraph()} />);
    const style = (
      cytoscapeFn.mock.calls.at(-1)![0] as {
        style: Array<{ selector: string; style: Record<string, unknown> }>;
      }
    ).style;
    const hiddenRule = style.find(
      (r) => r.selector === "node.g3t-label-hidden, edge.g3t-label-hidden",
    );
    expect(hiddenRule?.style.label).toBe("");
    expect(
      style.find((r) => r.selector === "node[_labelShort]")?.style.label,
    ).toBe("data(_labelShort)");
    expect(
      style.find((r) => r.selector === "edge[_labelShort]")?.style.label,
    ).toBe("data(_labelShort)");
    // Never on a bare node/edge rule (per-frame mapping warnings).
    for (const sel of ["node", "edge"]) {
      expect(
        style.find((r) => r.selector === sel)?.style.label,
      ).toBeUndefined();
    }
    // The outcomes sit after the user stylesheet and before the hidden
    // filter, so a host `label` mapping cannot override them.
    const idx = (sel: string) => style.findIndex((r) => r.selector === sel);
    expect(idx("node[_labelShort]")).toBeLessThan(idx(".g3t-hidden"));
    expect(idx("node.g3t-label-hidden, edge.g3t-label-hidden")).toBeLessThan(
      idx(".g3t-hidden"),
    );
  });

  it('"none" (default): no listener, no measurement, nothing touched', () => {
    eles = overprintingElements();
    render(<CytoscapeCanvas ugm={threeNodeGraph()} />);
    expect(handlers.has("layoutstop")).toBe(false);
    expect(handlers.has("zoom")).toBe(false);
    expect(bboxCalls.length).toBe(0);
    for (const e of eles) {
      expect(e.classes.has("g3t-label-hidden")).toBe(false);
      expect(e.store._labelShort).toBeUndefined();
    }
  });

  it('"hide": runs on layoutstop and hides the lower-priority overlapping label', () => {
    eles = overprintingElements();
    render(<CytoscapeCanvas ugm={threeNodeGraph()} labelCollision="hide" />);
    // fcose is asynchronous: nothing measured until the layout settles.
    expect(bboxCalls.length).toBe(0);
    expect(handlers.get("layoutstop")?.length).toBe(1);
    fireLayoutStop();
    const byId = (id: string) => eles.find((e) => e.id() === id)!;
    expect(byId("a").classes.has("g3t-label-hidden")).toBe(false);
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(true);
    expect(byId("c").classes.has("g3t-label-hidden")).toBe(false);
    // Labels only: no body, overlay, or endpoint-label contribution.
    expect(bboxCalls[0]).toMatchObject({
      includeNodes: false,
      includeEdges: false,
      includeLabels: true,
      includeMainLabels: true,
      includeOverlays: false,
    });
    // Restyle only: no layout, fit, or viewport call from the pass.
    expect(cy.fit).not.toHaveBeenCalled();
    expect(cy.viewport).not.toHaveBeenCalled();
    expect(cytoscapeFn.mock.calls.length).toBe(1);
    // `label` itself is never written (the spec/converter own it).
    expect(byId("b").store.label).toBe("b");
  });

  it("re-runs on a selection change: the selected element outranks the field", () => {
    eles = overprintingElements();
    render(<CytoscapeCanvas ugm={threeNodeGraph()} labelCollision="hide" />);
    fireLayoutStop();
    const byId = (id: string) => eles.find((e) => e.id() === id)!;
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(true);
    act(() => {
      useSelectionStore.getState().selectNodes(["b"]);
    });
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(false);
    expect(byId("a").classes.has("g3t-label-hidden")).toBe(true);
    // Hover is the next tier: hovering a clears it again (selection
    // still wins), so a re-runs on hover too.
    act(() => {
      useSelectionStore.getState().setHover("a");
    });
    expect(byId("a").classes.has("g3t-label-hidden")).toBe(true);
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(false);
  });

  it('"shorten": writes _labelShort for a loser whose truncated box fits, no class', () => {
    // b's label is 40 chars over 160px; a sits over its right end.
    eles = [
      fakeEle(
        "a",
        "node",
        { x1: 120, y1: 0, w: 40, h: 12 },
        { _labelPriority: 2 },
      ),
      fakeEle(
        "b",
        "node",
        { x1: 0, y1: 0, w: 160, h: 12 },
        { label: "b".repeat(40) },
      ),
    ];
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"] });
    ugm.addNode("b", { types: ["T"] });
    render(
      <CytoscapeCanvas
        ugm={ugm}
        labelCollision="shorten"
        labelMaxLength={10}
      />,
    );
    fireLayoutStop();
    const b = eles[1]!;
    expect(b.classes.has("g3t-label-hidden")).toBe(false);
    expect(b.store._labelShort).toBe("b".repeat(9) + "…");
    expect(b.store.label).toBe("b".repeat(40));
  });

  it("uses the labelPriority accessor over the data field", () => {
    eles = overprintingElements();
    render(
      <CytoscapeCanvas
        ugm={threeNodeGraph()}
        labelCollision="hide"
        labelPriority={(ele) => (ele.id() === "b" ? 10 : 0)}
      />,
    );
    fireLayoutStop();
    const byId = (id: string) => eles.find((e) => e.id() === id)!;
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(false);
    expect(byId("a").classes.has("g3t-label-hidden")).toBe(true);
  });

  it('switching back to "none" restores every label without a re-init', () => {
    eles = overprintingElements();
    const ugm = threeNodeGraph();
    const { rerender } = render(
      <CytoscapeCanvas ugm={ugm} labelCollision="hide" />,
    );
    fireLayoutStop();
    const b = eles.find((e) => e.id() === "b")!;
    expect(b.classes.has("g3t-label-hidden")).toBe(true);
    act(() => {
      rerender(<CytoscapeCanvas ugm={ugm} labelCollision="none" />);
    });
    expect(b.classes.has("g3t-label-hidden")).toBe(false);
    expect(cytoscapeFn.mock.calls.length).toBe(1);
  });

  it("is a no-op when the instance cannot measure labels (jsdom / minimal mock)", () => {
    eles = overprintingElements().map(
      (e) => ({ ...e, renderedBoundingBox: undefined }) as unknown as FakeEle,
    );
    render(<CytoscapeCanvas ugm={threeNodeGraph()} labelCollision="hide" />);
    expect(() => fireLayoutStop()).not.toThrow();
    for (const e of eles) expect(e.classes.has("g3t-label-hidden")).toBe(false);
  });
});
