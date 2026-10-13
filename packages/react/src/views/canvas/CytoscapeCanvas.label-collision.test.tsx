/**
 * CytoscapeCanvas `labelCollision` tests (issue #40).
 *
 * The pass is an overlay restyle: it measures rendered label boxes,
 * runs the pure resolver, and applies a class (hide) or a data field
 * (shorten). Isolated mock with a label-box API so the pass has
 * something to measure; the shared canvas mock stays untouched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  /** Parsed-style read, as cytoscape's `pstyle("label").strValue`;
   *  absent on the minimal (headless) variant. */
  pstyle?: (name: string) => { strValue: string } | undefined;
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
  // What the stylesheet renders for `label`; defaults to the data
  // field, as the converter's mapping does. "" models a host rule that
  // blanks the label (issue #60), which the data field cannot show.
  renderedLabel?: string,
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
    // The hidden class blanks the label like the real rule does, so a
    // pass that measured before clearing would read "" here.
    pstyle: (name: string) =>
      name === "label"
        ? {
            strValue: classes.has("g3t-label-hidden")
              ? ""
              : (renderedLabel ?? String(store.label)),
          }
        : undefined,
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
  afterEach(() => {
    vi.useRealTimers();
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
    // Hover is the next tier: hovering a does not clear it (selection
    // still wins), but the pass re-runs for it, on the debounce.
    vi.useFakeTimers();
    const measured = bboxCalls.length;
    act(() => {
      useSelectionStore.getState().setHover("a");
    });
    expect(bboxCalls.length).toBe(measured);
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(bboxCalls.length).toBe(measured + 3);
    expect(byId("a").classes.has("g3t-label-hidden")).toBe(true);
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(false);
  });

  it("hover changes run one debounced pass; store writes that change nothing the pass reads run none (issue #60)", () => {
    eles = overprintingElements();
    render(<CytoscapeCanvas ugm={threeNodeGraph()} labelCollision="hide" />);
    fireLayoutStop();
    const byId = (id: string) => eles.find((e) => e.id() === id)!;
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(true);
    vi.useFakeTimers();
    const measured = bboxCalls.length;
    // Writes that leave all three fields as they were: a bare setState,
    // a repeated hover, a clear() of an already empty selection (fresh
    // Set instances, same content). None runs the pass, now or later.
    act(() => {
      useSelectionStore.setState({});
      useSelectionStore.getState().setHover(null);
      useSelectionStore.getState().clear();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(bboxCalls.length).toBe(measured);
    // A mouseover and mouseout pair within the debounce window: no
    // synchronous pass, one pass after it settles, for the final state.
    act(() => {
      useSelectionStore.getState().setHover("b");
      useSelectionStore.getState().setHover(null);
      useSelectionStore.getState().setHover("b");
    });
    expect(bboxCalls.length).toBe(measured);
    act(() => {
      vi.advanceTimersByTime(119);
    });
    expect(bboxCalls.length).toBe(measured);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(bboxCalls.length).toBe(measured + 3);
    // The hover tier outranks a's explicit priority: b shows, a hides.
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(false);
    expect(byId("a").classes.has("g3t-label-hidden")).toBe(true);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(bboxCalls.length).toBe(measured + 3);
  });

  it("a label the stylesheet blanks is neither measured nor hidden, and hides nothing at the pan point (issue #60)", () => {
    // n's real label covers the pan point. e1 and e2 carry data labels
    // that a host rule renders as "" (edge labels on hover only), so
    // cytoscape reports a zero box at the pan point for each. Before
    // the fix e1 (outranking n) hid n's label and e2 (outranked) took
    // the hide class, which then blanked e2 once a hover rule showed it.
    eles = [
      fakeEle(
        "n",
        "node",
        { x1: 0, y1: 0, w: 40, h: 12 },
        { _labelPriority: 5 },
      ),
      fakeEle(
        "e1",
        "edge",
        { x1: 10, y1: 5, w: 0, h: 0 },
        { source: "a", target: "b", _labelPriority: 10 },
        "",
      ),
      fakeEle(
        "e2",
        "edge",
        { x1: 10, y1: 5, w: 0, h: 0 },
        { source: "b", target: "c", _labelPriority: 1 },
        "",
      ),
    ];
    render(<CytoscapeCanvas ugm={threeNodeGraph()} labelCollision="hide" />);
    fireLayoutStop();
    // Only n was measured: a blanked label is not a candidate at all.
    expect(bboxCalls.length).toBe(1);
    for (const e of eles) expect(e.classes.has("g3t-label-hidden")).toBe(false);
    for (const e of eles) expect(e.store.label).toBe(e.id());
  });

  it("a zero-size label box is not a candidate when the instance cannot report its parsed style", () => {
    // The belt for a headless-ish instance: no pstyle, but a measurable
    // box of zero width (or height) still means nothing is rendered.
    // The resolver already files such a box as "show" (it never
    // occupies space); this pins the same gate at the pass boundary,
    // where it keeps the element out of ranking altogether.
    eles = [
      fakeEle(
        "n",
        "node",
        { x1: 0, y1: 0, w: 40, h: 12 },
        { _labelPriority: 5 },
      ),
      fakeEle(
        "e1",
        "edge",
        { x1: 10, y1: 5, w: 0, h: 0 },
        { source: "a", target: "b", _labelPriority: 10 },
      ),
      fakeEle(
        "e2",
        "edge",
        { x1: 10, y1: 5, w: 20, h: 0 },
        { source: "b", target: "c", _labelPriority: 1 },
      ),
    ].map((e) => ({ ...e, pstyle: undefined }) as unknown as FakeEle);
    render(<CytoscapeCanvas ugm={threeNodeGraph()} labelCollision="hide" />);
    fireLayoutStop();
    for (const e of eles) expect(e.classes.has("g3t-label-hidden")).toBe(false);
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
