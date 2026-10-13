/**
 * CytoscapeCanvas encoding-spec and stylesheet restyle regressions
 * (issues #13, #14, #28).
 *
 * The shared canvas-test mock has no element data store, so it cannot
 * observe what the spec patch WRITES. This isolated mock seeds a data
 * store from the elements each constructor call receives (so a rebuilt
 * instance starts from converter defaults, exactly like real Cytoscape)
 * and lets nodes and edges read, write and remove data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import type { EncodingSpec } from "../../interaction/encoding/encoding-spec";

type Data = Record<string, unknown>;
type FakeEle = {
  id: () => string;
  nonempty: () => boolean;
  data: (k?: string | Data, v?: unknown) => unknown;
  removeData: (k: string) => void;
  hasClass: () => boolean;
  addClass: () => void;
  removeClass: () => void;
  position: () => { x: number; y: number };
};
const nodeStore = new Map<string, Data>();
const edgeStore = new Map<string, Data>();
// Object-form data() writes are the spec patch's signature; counting
// them per mount is how the "applied once" assertions work.
let patchWrites = 0;
function fakeEle(id: string, store: Map<string, Data>): FakeEle {
  return {
    id: () => id,
    nonempty: () => true,
    // A function expression, not an arrow: the two-argument setter form
    // is detected through `arguments.length`.
    data: function (k?: string | Data, v?: unknown) {
      const d = store.get(id)!;
      if (k === undefined) return d;
      if (typeof k === "object") {
        patchWrites++;
        Object.assign(d, k);
        return undefined;
      }
      if (arguments.length > 1) {
        d[k] = v;
        return undefined;
      }
      return d[k];
    },
    removeData: (k: string) => {
      // The fake's data bag is a plain object by design (it mirrors
      // ele.data()); the dynamic delete IS the operation under test.
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store.get(id)![k];
    },
    hasClass: () => false,
    addClass: () => {},
    removeClass: () => {},
    position: () => ({ x: 0, y: 0 }),
  };
}
const collection = (store: Map<string, Data>) => {
  const eles = [...store.keys()].map((id) => fakeEle(id, store));
  return {
    length: eles.length,
    forEach: (f: (e: FakeEle) => void) => eles.forEach(f),
    filter: (f: (e: FakeEle) => boolean) => ({
      forEach: (g: (e: FakeEle) => void) => eles.filter(f).forEach(g),
    }),
  };
};
const fromJson = vi.fn((_sheet: unknown) => ({ update: vi.fn() }));
const cy = {
  on: vi.fn(),
  one: vi.fn(),
  removeListener: vi.fn(),
  destroy: vi.fn(),
  nodes: vi.fn(() => collection(nodeStore)),
  edges: vi.fn(() => collection(edgeStore)),
  batch: vi.fn((fn: () => void) => fn()),
  style: vi.fn(() => ({ fromJson })),
  getElementById: vi.fn((id: string): FakeEle | { nonempty: () => boolean } =>
    nodeStore.has(id)
      ? fakeEle(id, nodeStore)
      : edgeStore.has(id)
        ? fakeEle(id, edgeStore)
        : { nonempty: () => false },
  ),
  elements: vi.fn(() => ({ removeClass: vi.fn(), forEach: vi.fn() })),
  pan: vi.fn(() => ({ x: 0, y: 0 })),
  zoom: vi.fn(() => 1),
  fit: vi.fn(),
  viewport: vi.fn(),
  $id: vi.fn(() => ({ empty: () => true, json: vi.fn() })),
  remove: vi.fn(),
  collection: vi.fn(() => ({})),
  add: vi.fn(),
};
const cytoscapeFn = vi.fn(
  (opts: {
    elements: Array<{ group: "nodes" | "edges"; data: Data }>;
    style: Array<{ selector: string; style: Data }>;
  }) => {
    nodeStore.clear();
    edgeStore.clear();
    for (const el of opts.elements) {
      (el.group === "nodes" ? nodeStore : edgeStore).set(el.data.id as string, {
        ...el.data,
      });
    }
    return cy;
  },
);
vi.mock("cytoscape", () => ({ default: cytoscapeFn, __esModule: true }));
vi.mock("cytoscape-fcose", () => ({ default: vi.fn(), __esModule: true }));

const { CytoscapeCanvas } = await import("./CytoscapeCanvas");

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["T"], properties: { name: "Alpha", code: "A1" } });
  ugm.addNode("b", { types: ["T"], properties: { code: "B2" } });
  ugm.addEdge("a", "b", { type: "knows", properties: { weight: 0.5 } });
  return ugm;
}
const ICON = "data:image/svg+xml;utf8,<svg/>";
const SPEC: EncodingSpec = {
  version: 1,
  node: {
    color: { scale: { kind: "fixed", value: "#123456" } },
    icon: { scale: { kind: "fixed", value: ICON } },
  },
  edge: { color: { scale: { kind: "fixed", value: "#654321" } } },
};
const node = (id: string) => nodeStore.get(id)!;
const edge = () => [...edgeStore.values()][0]!;

describe("CytoscapeCanvas re-applies the encoding spec to a rebuilt instance (#13)", () => {
  beforeEach(() => {
    cytoscapeFn.mockClear();
    fromJson.mockClear();
    patchWrites = 0;
  });

  it("applies the spec on mount exactly once per element", () => {
    render(<CytoscapeCanvas ugm={graph()} encodingSpec={SPEC} />);
    expect(node("a")._icon).toBe(ICON);
    expect(node("a")._color).toBe("#123456");
    expect(edge()._ecolor).toBe("#654321");
    // Init applied it; the spec effect must not apply it a second time.
    expect(patchWrites).toBe(3);
  });

  it("patches the new instance after a layout change with a stable spec and ugm", () => {
    const ugm = graph();
    const { rerender } = render(
      <CytoscapeCanvas ugm={ugm} encodingSpec={SPEC} />,
    );
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
    act(() => {
      rerender(
        <CytoscapeCanvas ugm={ugm} encodingSpec={SPEC} layout="preset" />,
      );
    });
    // The layout change rebuilt the instance (a fresh data store seeded
    // from converter defaults) ...
    expect(cytoscapeFn).toHaveBeenCalledTimes(2);
    // ... and the rebuilt instance carries the spec, not the defaults.
    expect(node("a")._icon).toBe(ICON);
    expect(node("b")._icon).toBe(ICON);
    expect(node("a")._color).toBe("#123456");
    expect(edge()._ecolor).toBe("#654321");
  });

  it("patches the new instance after an edgeStyle change too", () => {
    const ugm = graph();
    const { rerender } = render(
      <CytoscapeCanvas ugm={ugm} encodingSpec={SPEC} />,
    );
    act(() => {
      rerender(
        <CytoscapeCanvas ugm={ugm} encodingSpec={SPEC} edgeStyle="taxi" />,
      );
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(2);
    expect(node("a")._icon).toBe(ICON);
  });

  it("a spec change over a live instance restyles without a rebuild", () => {
    const ugm = graph();
    const { rerender } = render(
      <CytoscapeCanvas ugm={ugm} encodingSpec={SPEC} />,
    );
    const next: EncodingSpec = {
      ...SPEC,
      node: { color: { scale: { kind: "fixed", value: "#abcdef" } } },
    };
    act(() => {
      rerender(<CytoscapeCanvas ugm={ugm} encodingSpec={next} />);
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
    expect(node("a")._color).toBe("#abcdef");
    expect(node("a")._icon).toBeUndefined();
  });
});

describe("dropping a channel cleans up what the spec wrote (#14)", () => {
  beforeEach(() => {
    cytoscapeFn.mockClear();
    patchWrites = 0;
  });

  it("(a) dropping node.shape clears _shape", () => {
    const ugm = graph();
    const withShape: EncodingSpec = {
      version: 1,
      node: { shape: { scale: { kind: "fixed", value: "diamond" } } },
      edge: {},
    };
    const { rerender } = render(
      <CytoscapeCanvas ugm={ugm} encodingSpec={withShape} />,
    );
    expect(node("a")._shape).toBe("diamond");
    act(() => {
      rerender(
        <CytoscapeCanvas
          ugm={ugm}
          encodingSpec={{ version: 1, node: {}, edge: {} }}
        />,
      );
    });
    expect(node("a")._shape).toBeUndefined();
    expect(node("b")._shape).toBeUndefined();
  });

  it("(b) a spec with no label channel renders the converter's labels", () => {
    const ugm = graph();
    // Baseline: no spec at all.
    render(<CytoscapeCanvas ugm={ugm} />);
    const baseline = {
      a: node("a").label,
      b: node("b").label,
      e: edge().label,
    };
    expect(baseline).toEqual({ a: "Alpha", b: "b", e: "knows" });
    cytoscapeFn.mockClear();
    render(<CytoscapeCanvas ugm={ugm} encodingSpec={SPEC} />);
    expect({ a: node("a").label, b: node("b").label, e: edge().label }).toEqual(
      baseline,
    );
  });

  it("(b) the relations toggle works in BOTH directions: edge.label on, then off", () => {
    const ugm = graph();
    const WITHOUT: EncodingSpec = SPEC;
    const WITH: EncodingSpec = {
      ...SPEC,
      edge: { ...SPEC.edge, label: { driver: "weight" } },
    };
    const { rerender } = render(
      <CytoscapeCanvas ugm={ugm} encodingSpec={WITHOUT} />,
    );
    expect(edge().label).toBe("knows");
    act(() => {
      rerender(<CytoscapeCanvas ugm={ugm} encodingSpec={WITH} />);
    });
    expect(edge().label).toBe("0.5");
    act(() => {
      rerender(<CytoscapeCanvas ugm={ugm} encodingSpec={WITHOUT} />);
    });
    // Restored to the converter default, not deleted and not stuck.
    expect(edge().label).toBe("knows");
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
  });

  it("(b) node.label round-trips to the converter default (name, else id)", () => {
    const ugm = graph();
    const WITH: EncodingSpec = {
      ...SPEC,
      node: { ...SPEC.node, label: { driver: "code" } },
    };
    const { rerender } = render(
      <CytoscapeCanvas ugm={ugm} encodingSpec={WITH} />,
    );
    expect(node("a").label).toBe("A1");
    expect(node("b").label).toBe("B2");
    act(() => {
      rerender(<CytoscapeCanvas ugm={ugm} encodingSpec={SPEC} />);
    });
    expect(node("a").label).toBe("Alpha");
    expect(node("b").label).toBe("b");
  });
});

describe("a changed stylesheet prop restyles in place (#28)", () => {
  beforeEach(() => {
    cytoscapeFn.mockClear();
    fromJson.mockClear();
  });
  const RED = [{ selector: "node", style: { "background-color": "red" } }];
  const BLUE = [{ selector: "node", style: { "background-color": "blue" } }];
  const nodeRule = (sheet: Array<{ selector: string; style: Data }>) =>
    sheet.filter((r) => r.selector === "node").at(-1)!.style;

  it("applies the new rule through style().fromJson without re-creating the instance", () => {
    const ugm = graph();
    const { rerender } = render(<CytoscapeCanvas ugm={ugm} stylesheet={RED} />);
    // Init composed the stylesheet into the constructor; nothing restyles
    // again on mount.
    expect(
      nodeRule(cytoscapeFn.mock.calls[0]![0].style)["background-color"],
    ).toBe("red");
    expect(fromJson).not.toHaveBeenCalled();
    act(() => {
      rerender(<CytoscapeCanvas ugm={ugm} stylesheet={BLUE} />);
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
    expect(fromJson).toHaveBeenCalledTimes(1);
    const applied = fromJson.mock.calls[0]![0] as unknown as Array<{
      selector: string;
      style: Data;
    }>;
    expect(nodeRule(applied)["background-color"]).toBe("blue");
    expect(cy.fit).not.toHaveBeenCalled();
  });

  it("keys on content: a fresh literal with the same rules does not restyle", () => {
    const ugm = graph();
    const { rerender } = render(<CytoscapeCanvas ugm={ugm} stylesheet={RED} />);
    act(() => {
      rerender(
        <CytoscapeCanvas
          ugm={ugm}
          stylesheet={[
            { selector: "node", style: { "background-color": "red" } },
          ]}
        />,
      );
    });
    expect(fromJson).not.toHaveBeenCalled();
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
  });

  it("does not fight the theme restyle: theme and stylesheet changing together compose once", async () => {
    const { useThemeStore } = await import("../../theme/ThemeManager");
    const ugm = graph();
    const { rerender } = render(<CytoscapeCanvas ugm={ugm} stylesheet={RED} />);
    act(() => {
      useThemeStore.getState().setTheme("dark");
      rerender(<CytoscapeCanvas ugm={ugm} stylesheet={BLUE} />);
    });
    expect(fromJson).toHaveBeenCalledTimes(1);
    const applied = fromJson.mock.calls[0]![0] as unknown as Array<{
      selector: string;
      style: Data;
    }>;
    expect(nodeRule(applied)["background-color"]).toBe("blue");
    act(() => {
      useThemeStore.getState().setTheme("light");
    });
    // The theme switch back restyles once more, still over the blue rule.
    expect(fromJson).toHaveBeenCalledTimes(2);
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
  });
});
