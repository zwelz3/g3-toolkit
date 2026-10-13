/**
 * CytoscapeCanvas `graphUpdate="additive"` (issue #26).
 *
 * Growing a drawn graph one neighborhood at a time re-created the
 * instance on every ugm identity change, so every expansion scrambled
 * positions and reset the camera. In additive mode a ugm whose node set
 * is a superset of the live instance's grows it in place: only the new
 * elements are added, only the new nodes are laid out (one fcose pass
 * with every existing node held by fixedNodeConstraint, no fit), and
 * the instance survives. Isolated mock with element stores seeded from
 * the constructor and kept current by add/remove, in the shape of
 * CytoscapeCanvas.encoding.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import type { EncodingSpec } from "../../interaction/encoding/encoding-spec";

type Data = Record<string, unknown>;
type Pos = { x: number; y: number };
type Def = { group: "nodes" | "edges"; data: Data; position?: Pos };
const nodeStore = new Map<string, { data: Data; position: Pos }>();
const edgeStore = new Map<string, Data>();
const classCalls = new Map<string, string[]>();
const pushClass = (id: string, c: string) => {
  if (!classCalls.has(id)) classCalls.set(id, []);
  classCalls.get(id)!.push(c);
};
function dataAccessor(bag: () => Data) {
  // A function expression, not an arrow: the two-argument setter form
  // is detected through `arguments.length`.
  return function (k?: string | Data, v?: unknown) {
    const d = bag();
    if (k === undefined) return d;
    if (typeof k === "object") {
      Object.assign(d, k);
      return undefined;
    }
    if (arguments.length > 1) {
      d[k] = v;
      return undefined;
    }
    return d[k];
  };
}
function fakeNode(id: string) {
  const rec = nodeStore.get(id)!;
  return {
    id: () => id,
    length: 1,
    empty: () => false,
    nonempty: () => true,
    position: () => ({ ...rec.position }),
    isParent: () => false,
    style: () => "element",
    data: dataAccessor(() => rec.data),
    removeData: (k: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete rec.data[k];
    },
    hasClass: () => false,
    addClass: (c: string) => pushClass(id, "+" + c),
    removeClass: (c: string) => pushClass(id, "-" + c),
    remove: () => {
      nodeStore.delete(id);
    },
    lock: vi.fn(),
    unlock: vi.fn(),
    removeStyle: vi.fn(),
    json: vi.fn(),
  };
}
function fakeEdge(id: string) {
  return {
    id: () => id,
    length: 1,
    empty: () => false,
    nonempty: () => true,
    data: dataAccessor(() => edgeStore.get(id)!),
    removeData: (k: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete edgeStore.get(id)![k];
    },
    hasClass: () => false,
    addClass: (c: string) => pushClass(id, "+" + c),
    removeClass: (c: string) => pushClass(id, "-" + c),
    remove: () => {
      edgeStore.delete(id);
    },
    json: vi.fn(),
  };
}
const collection = <T,>(eles: T[]) => ({
  length: eles.length,
  forEach: (f: (e: T) => void) => eles.forEach(f),
  filter: (f: (e: T) => boolean) => ({
    forEach: (g: (e: T) => void) => eles.filter(f).forEach(g),
  }),
});
const absent = { empty: () => true, nonempty: () => false, length: 0 };
const seed = (defs: Def[]) => {
  for (const el of defs) {
    if (el.group === "nodes") {
      nodeStore.set(el.data.id as string, {
        data: { ...el.data },
        position: el.position ? { ...el.position } : { x: 0, y: 0 },
      });
    } else {
      edgeStore.set(el.data.id as string, { ...el.data });
    }
  }
};
const layoutRun = vi.fn();
const cy = {
  on: vi.fn(),
  one: vi.fn(),
  removeListener: vi.fn(),
  destroy: vi.fn(),
  nodes: vi.fn(() => collection([...nodeStore.keys()].map(fakeNode))),
  edges: vi.fn(() => collection([...edgeStore.keys()].map(fakeEdge))),
  elements: vi.fn(() => ({
    removeClass: vi.fn(),
    addClass: vi.fn(),
    forEach: vi.fn(),
  })),
  batch: vi.fn((fn: () => void) => fn()),
  style: vi.fn(() => ({ fromJson: vi.fn(() => ({ update: vi.fn() })) })),
  getElementById: vi.fn((id: string) =>
    nodeStore.has(id)
      ? fakeNode(id)
      : edgeStore.has(id)
        ? fakeEdge(id)
        : absent,
  ),
  $id: vi.fn((id: string) =>
    nodeStore.has(id)
      ? fakeNode(id)
      : edgeStore.has(id)
        ? fakeEdge(id)
        : absent,
  ),
  add: vi.fn((defs: Def[]) => seed(defs)),
  remove: vi.fn(),
  collection: vi.fn(() => ({})),
  layout: vi.fn((_opts: unknown) => ({ run: layoutRun })),
  fit: vi.fn(),
  pan: vi.fn(() => ({ x: 0, y: 0 })),
  zoom: vi.fn(() => 1),
  viewport: vi.fn(),
};
const cytoscapeFn = vi.fn((opts: { elements: Def[] }) => {
  nodeStore.clear();
  edgeStore.clear();
  seed(opts.elements);
  return cy;
});
vi.mock("cytoscape", () => ({ default: cytoscapeFn, __esModule: true }));
vi.mock("cytoscape-fcose", () => ({ default: vi.fn(), __esModule: true }));

const { CytoscapeCanvas, planAdditiveUpdate, seedAdditivePositions } =
  await import("./CytoscapeCanvas");

/** a -> b, edge id "ab" (keyed, so growth steps keep it). */
function base(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["T"], properties: { name: "Alpha" } });
  ugm.addNode("b", { types: ["T"], properties: {} });
  ugm.addEdge("a", "b", { type: "knows", key: "ab" });
  return ugm;
}
/** The host recipe: a NEW ugm holding everything the previous one had
 *  (fromJSON keeps edge ids) plus whatever `add` puts in. */
function grow(from: UGM, add: (g: UGM) => void): UGM {
  const g = UGM.fromJSON(from.toJSON());
  add(g);
  return g;
}
/** c joined to both a and b. */
const addC = (g: UGM) => {
  g.addNode("c", { types: ["U"], properties: {} });
  g.addEdge("b", "c", { type: "knows", key: "bc" });
  g.addEdge("a", "c", { type: "knows", key: "ac" });
};
const place = (id: string, x: number, y: number) => {
  nodeStore.get(id)!.position = { x, y };
};
const addedIds = () =>
  (cy.add.mock.calls[0]![0] as Def[]).map((d) => d.data.id as string);
const layoutOpts = () => cy.layout.mock.calls[0]![0] as Record<string, unknown>;

describe('CytoscapeCanvas graphUpdate="additive" (#26)', () => {
  beforeEach(() => {
    cytoscapeFn.mockClear();
    cy.add.mockClear();
    cy.layout.mockClear();
    cy.fit.mockClear();
    cy.destroy.mockClear();
    layoutRun.mockClear();
    classCalls.clear();
  });

  it("grows a superset ugm in place: no new instance, only the new elements, old nodes held, no fit", () => {
    const g0 = base();
    const { rerender } = render(
      <CytoscapeCanvas
        ugm={g0}
        graphUpdate="additive"
        animate={false}
        animationDuration={123}
      />,
    );
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
    // Where the user left them (the init scatter is random).
    place("a", 100, 0);
    place("b", 300, 0);
    const g1 = grow(g0, addC);
    act(() => {
      rerender(
        <CytoscapeCanvas
          ugm={g1}
          graphUpdate="additive"
          animate={false}
          animationDuration={123}
        />,
      );
    });
    // The instance survived ...
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
    expect(cy.destroy).not.toHaveBeenCalled();
    // ... exactly the new elements joined it ...
    expect(cy.add).toHaveBeenCalledTimes(1);
    expect(addedIds().sort()).toEqual(["ac", "bc", "c"]);
    expect(nodeStore.has("c")).toBe(true);
    expect(edgeStore.has("ab")).toBe(true);
    // ... c was seeded next to its placed neighbors (centroid (200, 0),
    // offset by the seed radius), not at the origin ...
    const c = nodeStore.get("c")!.position;
    expect(Math.hypot(c.x - 200, c.y)).toBeLessThanOrEqual(40 + 1e-9);
    expect(c).not.toEqual({ x: 100, y: 0 });
    expect(c).not.toEqual({ x: 300, y: 0 });
    // ... and ONE fcose pass ran from the current positions with every
    // old node held, honoring animate/animationDuration, never fitting.
    expect(cy.layout).toHaveBeenCalledTimes(1);
    expect(layoutRun).toHaveBeenCalledTimes(1);
    const opts = layoutOpts();
    expect(opts.name).toBe("fcose");
    expect(opts.fit).toBe(false);
    expect(opts.randomize).toBe(false);
    expect(opts.animate).toBe(false);
    expect(opts.animationDuration).toBe(123);
    expect(opts.fixedNodeConstraint).toEqual([
      { nodeId: "a", position: { x: 100, y: 0 } },
      { nodeId: "b", position: { x: 300, y: 0 } },
    ]);
    expect(cy.fit).not.toHaveBeenCalled();
  });

  it("falls back to a rebuild when the new ugm drops a node", () => {
    const g0 = base();
    const { rerender } = render(
      <CytoscapeCanvas ugm={g0} graphUpdate="additive" />,
    );
    const g1 = new UGM();
    g1.addNode("a", { types: ["T"], properties: {} });
    g1.addNode("c", { types: ["U"], properties: {} });
    act(() => {
      rerender(<CytoscapeCanvas ugm={g1} graphUpdate="additive" />);
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(2);
    expect(cy.add).not.toHaveBeenCalled();
    expect(cy.layout).not.toHaveBeenCalled();
    const built = cytoscapeFn.mock.calls[1]![0].elements.map((d) => d.data.id);
    expect(built.sort()).toEqual(["a", "c"]);
  });

  it("the default mode is unchanged: a superset ugm rebuilds", () => {
    const g0 = base();
    const { rerender } = render(<CytoscapeCanvas ugm={g0} />);
    act(() => {
      rerender(<CytoscapeCanvas ugm={grow(g0, addC)} />);
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(2);
    expect(cy.add).not.toHaveBeenCalled();
    expect(cy.layout).not.toHaveBeenCalled();
  });

  it("the encoding spec patch reaches the added elements", () => {
    const SPEC: EncodingSpec = {
      version: 1,
      node: { color: { scale: { kind: "fixed", value: "#123456" } } },
      edge: { color: { scale: { kind: "fixed", value: "#654321" } } },
    };
    const g0 = base();
    const { rerender } = render(
      <CytoscapeCanvas ugm={g0} graphUpdate="additive" encodingSpec={SPEC} />,
    );
    expect(nodeStore.get("a")!.data._color).toBe("#123456");
    act(() => {
      rerender(
        <CytoscapeCanvas
          ugm={grow(g0, addC)}
          graphUpdate="additive"
          encodingSpec={SPEC}
        />,
      );
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
    expect(nodeStore.get("c")!.data._color).toBe("#123456");
    expect(edgeStore.get("bc")!._ecolor).toBe("#654321");
    expect(edgeStore.get("ac")!._ecolor).toBe("#654321");
  });

  it("the hidden set reaches the added nodes", () => {
    const hidden = new Set(["c"]);
    const g0 = base();
    const { rerender } = render(
      <CytoscapeCanvas ugm={g0} graphUpdate="additive" hidden={hidden} />,
    );
    act(() => {
      rerender(
        <CytoscapeCanvas
          ugm={grow(g0, addC)}
          graphUpdate="additive"
          hidden={hidden}
        />,
      );
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
    expect(classCalls.get("c") ?? []).toContain("+g3t-hidden");
  });

  it("removes edges the new ugm no longer has and runs no layout when no node arrived", () => {
    const g0 = base();
    const { rerender } = render(
      <CytoscapeCanvas ugm={g0} graphUpdate="additive" />,
    );
    const g1 = grow(g0, (g) => {
      g.removeEdge("ab");
      g.addEdge("b", "a", { type: "knows", key: "ba" });
    });
    act(() => {
      rerender(<CytoscapeCanvas ugm={g1} graphUpdate="additive" />);
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
    expect(edgeStore.has("ab")).toBe(false);
    expect(edgeStore.has("ba")).toBe(true);
    expect(cy.layout).not.toHaveBeenCalled();
  });

  it("existing elements take the new ugm's data (a reverse edge flips the old edge to bezier)", () => {
    const g0 = base();
    const { rerender } = render(
      <CytoscapeCanvas ugm={g0} graphUpdate="additive" />,
    );
    expect(edgeStore.get("ab")!._curveStyle).toBe("straight");
    act(() => {
      rerender(
        <CytoscapeCanvas
          ugm={grow(g0, (g) =>
            g.addEdge("b", "a", { type: "knows", key: "ba" }),
          )}
          graphUpdate="additive"
        />,
      );
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
    expect(edgeStore.get("ab")!._curveStyle).toBe("bezier");
    expect(edgeStore.get("ba")!._curveStyle).toBe("bezier");
  });

  it("a later rebuild for another reason builds the grown graph", () => {
    const g0 = base();
    const { rerender } = render(
      <CytoscapeCanvas ugm={g0} graphUpdate="additive" />,
    );
    const g1 = grow(g0, addC);
    act(() => {
      rerender(<CytoscapeCanvas ugm={g1} graphUpdate="additive" />);
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(1);
    act(() => {
      rerender(
        <CytoscapeCanvas ugm={g1} graphUpdate="additive" edgeStyle="taxi" />,
      );
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(2);
    const built = cytoscapeFn.mock.calls[1]![0].elements.map((d) => d.data.id);
    expect(built).toContain("c");
    expect(built).toContain("bc");
  });

  it("pins and overlays reach the grown instance exactly once (issue #44: growth is not a rebuild)", async () => {
    const { usePositionPinStore } =
      await import("../../state/position-pin-store");
    const { useOverlayStore } = await import("../../state/overlay-store");
    usePositionPinStore.getState().pin("a");
    // c is not drawn yet; a is, so this canvas is a participant.
    useOverlayStore.getState().register({
      id: "o",
      label: "o",
      nodeIds: ["a", "c"],
      edgeIds: [],
      tone: "warning",
    });
    try {
      const g0 = base();
      const { rerender } = render(
        <CytoscapeCanvas ugm={g0} graphUpdate="additive" />,
      );
      // Mount: the init path applied each layer once; the ugm-keyed
      // effects skipped what it just did.
      const once = (id: string, c: string) =>
        (classCalls.get(id) ?? []).filter((x) => x === c).length;
      expect(once("a", "+g3t-pinned")).toBe(1);
      expect(once("a", "+g3t-ov-member")).toBe(1);
      expect(once("a", "+g3t-ov-warning")).toBe(1);
      expect(once("b", "+g3t-ov-dim")).toBe(1);
      classCalls.clear();
      act(() => {
        rerender(
          <CytoscapeCanvas ugm={grow(g0, addC)} graphUpdate="additive" />,
        );
      });
      // Growth kept the instance; the ugm-keyed effects re-dressed it
      // ONCE (the init path did not run, so nothing applied twice).
      expect(cytoscapeFn).toHaveBeenCalledTimes(1);
      expect(once("a", "+g3t-pinned")).toBe(1);
      expect(once("c", "+g3t-pinned")).toBe(0);
      expect(once("a", "+g3t-ov-member")).toBe(1);
      expect(once("c", "+g3t-ov-member")).toBe(1);
      expect(once("c", "+g3t-ov-warning")).toBe(1);
      expect(once("b", "+g3t-ov-dim")).toBe(1);
    } finally {
      usePositionPinStore.getState().clear();
      useOverlayStore.getState().clear();
    }
  });

  it("a containment change that re-parents an existing node falls back to a rebuild", () => {
    const containment = {
      edgeType: "contains",
      direction: "parentToChild",
    } as const;
    const g0 = base();
    const { rerender } = render(
      <CytoscapeCanvas
        ugm={g0}
        graphUpdate="additive"
        containment={containment}
      />,
    );
    const g1 = grow(g0, (g) => {
      g.addNode("p", { types: ["Group"], properties: {} });
      g.addEdge("p", "a", { type: "contains", key: "pa" });
    });
    act(() => {
      rerender(
        <CytoscapeCanvas
          ugm={g1}
          graphUpdate="additive"
          containment={containment}
        />,
      );
    });
    // Cytoscape's `parent` is immutable through data(); the rebuild
    // path renders a's new container.
    expect(cytoscapeFn).toHaveBeenCalledTimes(2);
    const a = cytoscapeFn.mock.calls[1]![0].elements.find(
      (d) => d.data.id === "a",
    );
    expect(a?.data.parent).toBe("p");
  });
});

describe("planAdditiveUpdate (pure)", () => {
  const defs = [
    { group: "nodes", data: { id: "a" } },
    { group: "nodes", data: { id: "b" } },
    { group: "nodes", data: { id: "c" } },
    { group: "edges", data: { id: "ab", source: "a", target: "b" } },
    { group: "edges", data: { id: "bc", source: "b", target: "c" } },
  ] as const;

  it("partitions adds, updates and stale edges; nodes are never removed", () => {
    const plan = planAdditiveUpdate(
      new Set(["a", "b"]),
      new Set(["ab", "old"]),
      defs,
    );
    expect(plan.superset).toBe(true);
    expect(plan.addNodeIdx).toEqual([2]);
    expect(plan.addEdgeIdx).toEqual([4]);
    expect(plan.updateIdx).toEqual([0, 1, 3]);
    expect(plan.removeEdgeIds).toEqual(["old"]);
  });

  it("flags a live node the next graph lacks", () => {
    const plan = planAdditiveUpdate(new Set(["a", "z"]), new Set(), defs);
    expect(plan.superset).toBe(false);
  });
});

describe("seedAdditivePositions (pure)", () => {
  const placed = new Map([
    ["a", { x: 0, y: 0 }],
    ["b", { x: 200, y: 0 }],
  ]);

  it("seeds at the centroid of placed neighbors, offset by the radius", () => {
    const seeds = seedAdditivePositions(
      ["c"],
      placed,
      [
        { source: "a", target: "c" },
        { source: "c", target: "b" },
      ],
      10,
    );
    const c = seeds.get("c")!;
    expect(Math.hypot(c.x - 100, c.y)).toBeCloseTo(10, 6);
  });

  it("chains through nodes seeded earlier in the same pass", () => {
    const seeds = seedAdditivePositions(
      ["c", "d"],
      placed,
      [
        { source: "b", target: "c" },
        { source: "c", target: "d" },
      ],
      10,
    );
    const c = seeds.get("c")!;
    const d = seeds.get("d")!;
    expect(Math.hypot(c.x - 200, c.y)).toBeCloseTo(10, 6);
    expect(Math.hypot(d.x - c.x, d.y - c.y)).toBeCloseTo(10, 6);
  });

  it("a node with no placed neighbor sits at the graph centroid; seeds never coincide", () => {
    const seeds = seedAdditivePositions(["x", "y"], placed, [], 10);
    const x = seeds.get("x")!;
    const y = seeds.get("y")!;
    expect(Math.hypot(x.x - 100, x.y)).toBeCloseTo(10, 6);
    expect(Math.hypot(y.x - 100, y.y)).toBeCloseTo(10, 6);
    expect(Math.hypot(x.x - y.x, x.y - y.y)).toBeGreaterThan(1);
  });

  it("an empty instance seeds around the origin", () => {
    const seeds = seedAdditivePositions(["x"], new Map(), [], 10);
    expect(Math.hypot(seeds.get("x")!.x, seeds.get("x")!.y)).toBeCloseTo(10, 6);
  });
});
