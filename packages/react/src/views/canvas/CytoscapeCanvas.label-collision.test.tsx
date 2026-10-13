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
  remove: () => void;
  position: () => { x: number; y: number };
  removeClass: (c: string) => void;
  visible: () => boolean;
  degree: () => number;
  renderedBoundingBox: (opts: unknown) => Box;
  /** Parsed-style read, as cytoscape's `pstyle("label").strValue` and
   *  `pstyle("text-opacity").pfValue`; absent on the minimal (headless)
   *  variant. */
  pstyle?: (
    name: string,
  ) => { strValue?: string; pfValue?: number; value?: number } | undefined;
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
  // What `pstyle("text-opacity")` reports; cytoscape's renderer reads
  // `pfValue`, and a 0 keeps the full label box while drawing nothing
  // (issue #68). Default: fully opaque.
  textOpacity: { pfValue?: number; value?: number } = { pfValue: 1, value: 1 },
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
    // The additive path (#64) reads survivor positions and removes a
    // departing element in place.
    position: () => ({ x: box.x1, y: box.y1 }),
    remove: () => {
      eles = eles.filter((e) => e.id() !== id);
    },
    renderedBoundingBox: (opts: unknown) => {
      bboxCalls.push(opts);
      return box;
    },
    // The hidden class blanks the label like the real rule does, and
    // the `[_labelShort]` rule maps it to the short form, so a pass
    // that measured before clearing would read "" or the truncation.
    pstyle: (name: string) => {
      if (name === "text-opacity") return textOpacity;
      if (name !== "label") return undefined;
      if (classes.has("g3t-label-hidden")) return { strValue: "" };
      if (store._labelShort !== undefined)
        return { strValue: String(store._labelShort) };
      return { strValue: renderedLabel ?? String(store.label) };
    },
    empty: () => false,
    nonempty: () => true,
    classes,
    store,
  };
}
const handlers = new Map<string, Array<(...a: unknown[]) => void>>();
const onceHandlers = new Map<string, Array<(...a: unknown[]) => void>>();
const cy = {
  on: vi.fn((evt: string, a: unknown, b?: unknown) => {
    const fn = (typeof a === "function" ? a : b) as (...x: unknown[]) => void;
    if (!handlers.has(evt)) handlers.set(evt, []);
    handlers.get(evt)!.push(fn);
  }),
  // `one` carries the layout-settlement flag the canvas sets on the
  // first layoutstop; it gates the pass an effect re-run makes (#64).
  one: vi.fn((evt: string, fn: (...a: unknown[]) => void) => {
    if (!onceHandlers.has(evt)) onceHandlers.set(evt, []);
    onceHandlers.get(evt)!.push(fn);
  }),
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
  $id: (id: string) => cy.getElementById(id),
};
const cytoscapeFn = vi.fn((_opts?: unknown) => cy);
vi.mock("cytoscape", () => ({ default: cytoscapeFn, __esModule: true }));
vi.mock("cytoscape-fcose", () => ({ default: vi.fn(), __esModule: true }));

const { CytoscapeCanvas } = await import("./CytoscapeCanvas");

const fireLayoutStop = () => {
  act(() => {
    const once = onceHandlers.get("layoutstop") ?? [];
    onceHandlers.delete("layoutstop");
    for (const h of once) h();
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
    onceHandlers.clear();
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

  it("a label at rendered text-opacity 0 is neither measured, ranked, hidden nor shortened (issue #68)", () => {
    // n's real label; e1 (outranking) and e2 (outranked) carry real
    // label boxes over it that the stylesheet draws at opacity 0 (how
    // `labelVisible: false` blanks a label). Without the opacity read
    // e1 would win the spot and n would be shortened or hidden, and e2
    // would take _labelShort or the hide class for a label nobody sees.
    // e1 reports the parsed number as cytoscape does (pfValue); e2
    // reports only the raw `value`, the fallback read.
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
        { x1: 0, y1: 0, w: 160, h: 12 },
        { source: "a", target: "b", _labelPriority: 10, label: "e".repeat(40) },
        undefined,
        { pfValue: 0, value: 0 },
      ),
      fakeEle(
        "e2",
        "edge",
        { x1: 0, y1: 0, w: 160, h: 12 },
        { source: "b", target: "c", _labelPriority: 1, label: "e".repeat(40) },
        undefined,
        { value: 0 },
      ),
    ];
    render(
      <CytoscapeCanvas
        ugm={threeNodeGraph()}
        labelCollision="shorten"
        labelMaxLength={10}
      />,
    );
    fireLayoutStop();
    expect(bboxCalls.length).toBe(1);
    for (const e of eles) {
      expect(e.classes.has("g3t-label-hidden")).toBe(false);
      expect(e.store._labelShort).toBeUndefined();
    }
  });

  it("a whitespace-only rendered label is neither measured, ranked, hidden nor shortened (issue #68)", () => {
    // Same shape as the text-opacity case, with a host rule that
    // renders whitespace instead of "". The data label stays intact.
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
        { x1: 0, y1: 0, w: 160, h: 12 },
        { source: "a", target: "b", _labelPriority: 10, label: "e".repeat(40) },
        " \t\n",
      ),
      fakeEle(
        "e2",
        "edge",
        { x1: 0, y1: 0, w: 160, h: 12 },
        { source: "b", target: "c", _labelPriority: 1, label: "e".repeat(40) },
        "   ",
      ),
    ];
    render(
      <CytoscapeCanvas
        ugm={threeNodeGraph()}
        labelCollision="shorten"
        labelMaxLength={10}
      />,
    );
    fireLayoutStop();
    expect(bboxCalls.length).toBe(1);
    for (const e of eles) {
      expect(e.classes.has("g3t-label-hidden")).toBe(false);
      expect(e.store._labelShort).toBeUndefined();
      expect(e.store.label).not.toBe("");
    }
  });

  it("falls back to the data label for candidacy and shortening when the instance cannot report its parsed style", () => {
    // No pstyle: neither the text-opacity nor the rendered-label read
    // can veto a candidate, so the data label decides, as before #60.
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
      fakeEle("c", "node", { x1: 130, y1: 2, w: 20, h: 8 }, {}),
    ].map((e) => ({ ...e, pstyle: undefined }) as unknown as FakeEle);
    const ugm = threeNodeGraph();
    render(
      <CytoscapeCanvas
        ugm={ugm}
        labelCollision="shorten"
        labelMaxLength={10}
      />,
    );
    fireLayoutStop();
    const byId = (id: string) => eles.find((e) => e.id() === id)!;
    expect(bboxCalls.length).toBe(3);
    expect(byId("b").store._labelShort).toBe("b".repeat(9) + "…");
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(false);
    // c sits inside a's box and cannot shorten (3 chars): hidden.
    expect(byId("c").classes.has("g3t-label-hidden")).toBe(true);
    expect(byId("a").classes.has("g3t-label-hidden")).toBe(false);
  });

  it('"shorten" truncates the RENDERED label, so a host `label: data(name)` rule is shortened from `name` (issue #68)', () => {
    // b's data label is the short converter default ("b"); the host
    // stylesheet renders `name`, 40 chars over 160px. Before the fix
    // the pass truncated "b" (already within maxLength), so the loser
    // could not shorten and was hidden instead.
    const name = "x".repeat(40);
    eles = [
      fakeEle(
        "a",
        "node",
        { x1: 120, y1: 0, w: 40, h: 12 },
        { _labelPriority: 2 },
      ),
      fakeEle("b", "node", { x1: 0, y1: 0, w: 160, h: 12 }, { name }, name),
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
    expect(b.store._labelShort).toBe("x".repeat(9) + "…");
    // Neither `label` nor `name` is written.
    expect(b.store.label).toBe("b");
    expect(b.store.name).toBe(name);
  });

  it("two consecutive passes measure the original rendered label, never the previous truncation (issue #68)", () => {
    // Once _labelShort is written the `[_labelShort]` rule makes the
    // RENDERED label the short form (the mock models that). A second
    // pass that read it would find a 10-char label that cannot shorten
    // further and would hide b; the strip before measure keeps the
    // outcome stable.
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
    const short = "b".repeat(9) + "…";
    expect(b.store._labelShort).toBe(short);
    // The mock renders the short form now, as the scoped rule would.
    expect(b.pstyle!("label")?.strValue).toBe(short);
    fireLayoutStop();
    expect(b.store._labelShort).toBe(short);
    expect(b.classes.has("g3t-label-hidden")).toBe(false);
    act(() => {
      useSelectionStore.getState().selectNodes(["c"]);
    });
    expect(b.store._labelShort).toBe(short);
    expect(b.classes.has("g3t-label-hidden")).toBe(false);
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

  it("re-runs after an additive removal, so a label hidden under a departed label returns (#64)", () => {
    eles = overprintingElements();
    const g0 = threeNodeGraph();
    const { rerender } = render(
      <CytoscapeCanvas ugm={g0} graphUpdate="additive" labelCollision="hide" />,
    );
    fireLayoutStop();
    const byId = (id: string) => eles.find((e) => e.id() === id)!;
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(true);
    // A collapse drops a, the label that was covering b's.
    const g1 = UGM.fromJSON(g0.toJSON());
    g1.removeNode("a");
    act(() => {
      rerender(
        <CytoscapeCanvas
          ugm={g1}
          graphUpdate="additive"
          labelCollision="hide"
        />,
      );
    });
    // In place (no re-init, no layout to fire layoutstop) ...
    expect(cytoscapeFn.mock.calls.length).toBe(1);
    expect(eles.map((e) => e.id())).toEqual(["b", "c"]);
    // ... and the pass re-ran on the ugm change: nothing covers b now.
    expect(byId("b").classes.has("g3t-label-hidden")).toBe(false);
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
