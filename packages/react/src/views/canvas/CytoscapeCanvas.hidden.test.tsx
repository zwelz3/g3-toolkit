/**
 * CytoscapeCanvas `hidden` visibility-filter tests.
 *
 * The filter is a batched class toggle (g3t-hidden -> display:none), NOT
 * a re-init: toggling it must not re-create the Cytoscape instance or
 * re-run layout. Isolated mock so the shared canvas-test mock is
 * untouched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { UGM } from "@g3t/core";

type FakeNode = {
  id: () => string;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
};
const classCalls = new Map<string, string[]>();
function fakeNode(id: string): FakeNode {
  if (!classCalls.has(id)) classCalls.set(id, []);
  return {
    id: () => id,
    addClass: (c: string) => classCalls.get(id)!.push("+" + c),
    removeClass: (c: string) => classCalls.get(id)!.push("-" + c),
  };
}
let nodeList: FakeNode[] = [];
const cy = {
  on: vi.fn(),
  removeListener: vi.fn(),
  destroy: vi.fn(),
  nodes: vi.fn(() => ({
    length: nodeList.length,
    forEach: (f: (n: FakeNode) => void) => nodeList.forEach(f),
  })),
  edges: vi.fn(() => ({ length: 0, forEach: vi.fn() })),
  batch: vi.fn((fn: () => void) => fn()),
  style: vi.fn(() => ({ fromJson: vi.fn(() => ({ update: vi.fn() })) })),
  getElementById: vi.fn(() => ({ nonempty: () => false })),
  elements: vi.fn(() => ({ removeClass: vi.fn() })),
  // Viewport API: the cleanup captures pan/zoom on teardown; the structural
  // path fits/restores. Real cytoscape instances always provide these.
  pan: vi.fn(() => ({ x: 0, y: 0 })),
  zoom: vi.fn(() => 1),
  fit: vi.fn(),
  viewport: vi.fn(),
};
const cytoscapeFn = vi.fn((_opts?: unknown) => cy);
vi.mock("cytoscape", () => ({ default: cytoscapeFn, __esModule: true }));
vi.mock("cytoscape-fcose", () => ({ default: vi.fn(), __esModule: true }));

const { CytoscapeCanvas } = await import("./CytoscapeCanvas");

describe("CytoscapeCanvas hidden (visibility filter)", () => {
  beforeEach(() => {
    cytoscapeFn.mockClear();
    classCalls.clear();
  });

  it("emits a .g3t-hidden display:none rule in the composed stylesheet", () => {
    nodeList = [fakeNode("a"), fakeNode("b")];
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"] });
    ugm.addNode("b", { types: ["U"] });
    render(<CytoscapeCanvas ugm={ugm} />);
    const opts = cytoscapeFn.mock.calls.at(-1)![0] as {
      style: Array<{ selector: string; style: Record<string, unknown> }>;
    };
    const rule = opts.style.find((r) => r.selector === ".g3t-hidden");
    expect(rule).toBeTruthy();
    expect(rule!.style.display).toBe("none");
  });

  it("toggles g3t-hidden on nodes in the hidden set at init", () => {
    nodeList = [fakeNode("a"), fakeNode("b"), fakeNode("c")];
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"] });
    ugm.addNode("b", { types: ["U"] });
    ugm.addNode("c", { types: ["T"] });
    render(<CytoscapeCanvas ugm={ugm} hidden={new Set(["a", "c"])} />);
    expect(classCalls.get("a") ?? []).toContain("+g3t-hidden");
    expect(classCalls.get("c") ?? []).toContain("+g3t-hidden");
    // nodes NOT in the set are explicitly un-hidden (idempotent restyle)
    expect(classCalls.get("b") ?? []).toContain("-g3t-hidden");
  });

  it("re-applies on hidden change WITHOUT re-creating the instance", () => {
    nodeList = [fakeNode("a"), fakeNode("b")];
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"] });
    ugm.addNode("b", { types: ["U"] });
    const { rerender } = render(
      <CytoscapeCanvas ugm={ugm} hidden={new Set<string>()} />,
    );
    const initCount = cytoscapeFn.mock.calls.length;
    act(() => {
      rerender(<CytoscapeCanvas ugm={ugm} hidden={new Set(["a"])} />);
    });
    // No new construction: the toggle is a restyle, not a re-init.
    expect(cytoscapeFn.mock.calls.length).toBe(initCount);
    // init applied "-g3t-hidden"; the rerender added "+g3t-hidden".
    expect(classCalls.get("a") ?? []).toContain("+g3t-hidden");
  });

  it("scopes the data(_size) size mapping to node[_size]", () => {
    // Regression: the base `node` rule must not map width/height to
    // data(_size). Nodes without _size (structural block containers,
    // which size via _w/_h) otherwise trigger a Cytoscape mapping warning
    // per node per render frame, flooding the console and stalling the
    // block view.
    nodeList = [fakeNode("a")];
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"] });
    render(<CytoscapeCanvas ugm={ugm} />);
    const style = (
      cytoscapeFn.mock.calls.at(-1)![0] as {
        style: Array<{ selector: string; style: Record<string, unknown> }>;
      }
    ).style;
    const base = style.find((r) => r.selector === "node");
    const scoped = style.find((r) => r.selector === "node[_size]");
    expect(base!.style.width).toBeUndefined();
    expect(base!.style.height).toBeUndefined();
    expect(scoped).toBeTruthy();
    expect(scoped!.style.width).toBe("data(_size)");
    expect(scoped!.style.height).toBe("data(_size)");
  });

  it("scopes the data(_confidence) opacity mapping to edge[_confidence]", () => {
    // Regression: the base `edge` rule must not map opacity to
    // data(_confidence). Structural connectors carry no _confidence and
    // would otherwise warn per edge per render frame.
    nodeList = [fakeNode("a")];
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"] });
    render(<CytoscapeCanvas ugm={ugm} />);
    const style = (
      cytoscapeFn.mock.calls.at(-1)![0] as {
        style: Array<{ selector: string; style: Record<string, unknown> }>;
      }
    ).style;
    const baseEdge = style.find((r) => r.selector === "edge");
    const scoped = style.find((r) => r.selector === "edge[_confidence]");
    expect(baseEdge!.style.opacity).toBeUndefined();
    expect(scoped).toBeTruthy();
    expect(scoped!.style.opacity).toBe("data(_confidence)");
  });

  it("scopes data(label)/data(_color)/data(_shape) off the base node rule", () => {
    // Regression: the base `node` rule must not map label/background-color/
    // shape via data(). Structural block sub-elements (container, header,
    // toggle, rows, ports) carry _label/_w/_h and are colored by their class
    // rules, so an unguarded base mapping warns for each on every render
    // frame; in the block view that flood (hundreds of sub-nodes) stalls the
    // main thread. Each mapping must live on its own [field]-scoped rule.
    nodeList = [fakeNode("a")];
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"] });
    render(<CytoscapeCanvas ugm={ugm} />);
    const style = (
      cytoscapeFn.mock.calls.at(-1)![0] as {
        style: Array<{ selector: string; style: Record<string, unknown> }>;
      }
    ).style;
    const base = style.find((r) => r.selector === "node");
    expect(base!.style.label).toBeUndefined();
    expect(base!.style["background-color"]).toBeUndefined();
    expect(base!.style.shape).toBeUndefined();
    const byField = (sel: string, prop: string, val: string) => {
      const r = style.find((x) => x.selector === sel);
      expect(r, `missing rule ${sel}`).toBeTruthy();
      expect(r!.style[prop]).toBe(val);
    };
    byField("node[label]", "label", "data(label)");
    byField("node[_color]", "background-color", "data(_color)");
    byField("node[_shape]", "shape", "data(_shape)");
    // The base edge rule must not carry the label mapping either.
    const baseEdge = style.find((r) => r.selector === "edge");
    expect(baseEdge!.style.label).toBeUndefined();
    byField("edge[label]", "label", "data(label)");
  });
});
