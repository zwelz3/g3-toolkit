/**
 * CytoscapeCanvas re-applies the decoration layers to a rebuilt
 * instance (issue #44, the #13 defect for overrides, pins and
 * overlays).
 *
 * The init effect re-creates the instance on layout/edgeStyle (and
 * layoutOptions/interactionOptions/containment/animate) changes. The
 * style-override, pin and overlay effects key only on their own
 * store data, so with referentially stable inputs nothing re-ran them
 * and the new instance carried no bypass, no lock, no badge and no
 * `g3t-ov-*` class until the store next changed. Isolated mock in the
 * shape of CytoscapeCanvas.encoding.test.tsx, extended with per-element
 * bypass, lock and class records that are reset per constructor call
 * (a rebuilt instance starts bare, exactly like real Cytoscape), so
 * the "present on the NEW instance" and "applied once" assertions can
 * be made against what the component actually did.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import type { EncodingSpec } from "../../interaction/encoding/encoding-spec";

type Data = Record<string, unknown>;
type FakeEle = {
  id: () => string;
  length: number;
  empty: () => boolean;
  nonempty: () => boolean;
  forEach: (f: (e: FakeEle) => void) => void;
  data: (k?: string | Data, v?: unknown) => unknown;
  removeData: (k: string) => void;
  hasClass: (c: string) => boolean;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  style: (props?: Record<string, unknown>) => undefined;
  removeStyle: (props?: string) => void;
  lock: () => void;
  unlock: () => void;
  position: () => { x: number; y: number };
};
const nodeStore = new Map<string, Data>();
const edgeStore = new Map<string, Data>();
/** Per-element records for the CURRENT instance. */
const classes = new Map<string, Set<string>>();
const bypass = new Map<string, Record<string, unknown>>();
const locked = new Map<string, boolean>();
/** Call counters, for the "once" assertions: `${id}:${class}` for
 *  every single class added, `${id}` per style(obj) and per lock(). */
const addClassCalls: string[] = [];
const styleCalls: string[] = [];
const lockCalls: string[] = [];
const resetRecords = () => {
  classes.clear();
  bypass.clear();
  locked.clear();
  addClassCalls.length = 0;
  styleCalls.length = 0;
  lockCalls.length = 0;
};
const classSet = (id: string) => {
  if (!classes.has(id)) classes.set(id, new Set());
  return classes.get(id)!;
};
function fakeEle(id: string, store: Map<string, Data>): FakeEle {
  const self: FakeEle = {
    id: () => id,
    length: 1,
    empty: () => false,
    nonempty: () => true,
    // getElementById returns a one-element collection in Cytoscape;
    // the override pass iterates it.
    forEach: (f: (e: FakeEle) => void) => f(self),
    // A function expression, not an arrow: the two-argument setter form
    // is detected through `arguments.length`.
    data: function (k?: string | Data, v?: unknown) {
      const d = store.get(id)!;
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
    },
    removeData: (k: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete store.get(id)![k];
    },
    hasClass: (c: string) => classSet(id).has(c),
    addClass: (c: string) => {
      for (const one of c.split(/\s+/).filter(Boolean)) {
        classSet(id).add(one);
        addClassCalls.push(`${id}:${one}`);
      }
    },
    removeClass: (c: string) => {
      for (const one of c.split(/\s+/).filter(Boolean))
        classSet(id).delete(one);
    },
    // style(obj) is a bypass write (the pin stack and the override
    // pass); style() with no args is a read nothing here needs.
    style: (props?: Record<string, unknown>) => {
      if (props === undefined) return undefined;
      styleCalls.push(id);
      bypass.set(id, { ...(bypass.get(id) ?? {}), ...props });
      return undefined;
    },
    removeStyle: (props?: string) => {
      if (props === undefined) {
        bypass.delete(id);
        return;
      }
      const cur = bypass.get(id);
      if (!cur) return;
      for (const p of props.split(/\s+/).filter(Boolean)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete cur[p];
      }
    },
    lock: () => {
      lockCalls.push(id);
      locked.set(id, true);
    },
    unlock: () => {
      locked.set(id, false);
    },
    position: () => ({ x: 0, y: 0 }),
  };
  return self;
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
const absent = { empty: () => true, nonempty: () => false, length: 0 };
const cy = {
  on: vi.fn(),
  one: vi.fn(),
  removeListener: vi.fn(),
  destroy: vi.fn(),
  nodes: vi.fn(() => collection(nodeStore)),
  edges: vi.fn(() => collection(edgeStore)),
  batch: vi.fn((fn: () => void) => fn()),
  style: vi.fn(() => ({ fromJson: vi.fn(() => ({ update: vi.fn() })) })),
  getElementById: vi.fn((id: string) =>
    nodeStore.has(id)
      ? fakeEle(id, nodeStore)
      : edgeStore.has(id)
        ? fakeEle(id, edgeStore)
        : absent,
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
  layout: vi.fn(() => ({ run: vi.fn() })),
};
const cytoscapeFn = vi.fn(
  (opts: { elements: Array<{ group: "nodes" | "edges"; data: Data }> }) => {
    nodeStore.clear();
    edgeStore.clear();
    resetRecords();
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
const { useStyleOverrideStore } =
  await import("../../state/style-override-store");
const { usePositionPinStore } = await import("../../state/position-pin-store");
const { useOverlayStore } = await import("../../state/overlay-store");

/** a -> b, edge id "ab". */
function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["T"], properties: { name: "Alpha" } });
  ugm.addNode("b", { types: ["T"], properties: {} });
  ugm.addEdge("a", "b", { type: "knows", key: "ab" });
  return ugm;
}
const ICON = "data:image/svg+xml;utf8,<svg/>";
const SPEC: EncodingSpec = {
  version: 1,
  node: { icon: { scale: { kind: "fixed", value: ICON } } },
  edge: {},
};
const count = (calls: string[], key: string) =>
  calls.filter((c) => c === key).length;
const has = (id: string, c: string) => classSet(id).has(c);

/** Mount with the given store state, then rebuild through a prop. */
function mountThenRebuild(
  rebuild: "layout" | "edgeStyle",
  extra: { encodingSpec?: EncodingSpec } = {},
) {
  const ugm = graph();
  const { rerender } = render(<CytoscapeCanvas ugm={ugm} {...extra} />);
  expect(cytoscapeFn).toHaveBeenCalledTimes(1);
  const doRebuild = () => {
    act(() => {
      rerender(
        rebuild === "layout" ? (
          <CytoscapeCanvas ugm={ugm} {...extra} layout="preset" />
        ) : (
          <CytoscapeCanvas ugm={ugm} {...extra} edgeStyle="taxi" />
        ),
      );
    });
    expect(cytoscapeFn).toHaveBeenCalledTimes(2);
  };
  return { ugm, rerender, doRebuild };
}

describe("CytoscapeCanvas re-applies decorations to a rebuilt instance (#44)", () => {
  beforeEach(() => {
    cytoscapeFn.mockClear();
    cy.fit.mockClear();
    cy.layout.mockClear();
    useStyleOverrideStore.getState().clear();
    usePositionPinStore.getState().clear();
    useOverlayStore.getState().clear();
  });

  describe("style overrides (bypasses)", () => {
    it("applies the bypass on mount exactly once", () => {
      useStyleOverrideStore.getState().add({
        scope: { nodeId: "a" },
        color: "#ff0000",
      });
      render(<CytoscapeCanvas ugm={graph()} />);
      expect(bypass.get("a")?.["background-color"]).toBe("#ff0000");
      expect(count(styleCalls, "a")).toBe(1);
      expect(bypass.has("b")).toBe(false);
    });

    it.each(["layout", "edgeStyle"] as const)(
      "the bypass is present on the NEW instance after a %s change, applied once",
      (rebuild) => {
        useStyleOverrideStore.getState().add({
          scope: { nodeId: "a" },
          color: "#ff0000",
        });
        const { doRebuild } = mountThenRebuild(rebuild);
        doRebuild();
        // The constructor reset the records: anything here was written
        // to the rebuilt instance.
        expect(bypass.get("a")?.["background-color"]).toBe("#ff0000");
        expect(count(styleCalls, "a")).toBe(1);
        expect(bypass.has("b")).toBe(false);
      },
    );

    it("a type-scoped override reaches the rebuilt instance too", () => {
      useStyleOverrideStore.getState().add({
        scope: { type: "T" },
        borderColor: "#00ff00",
      });
      const { doRebuild } = mountThenRebuild("layout");
      doRebuild();
      expect(bypass.get("a")?.["border-color"]).toBe("#00ff00");
      expect(bypass.get("b")?.["border-color"]).toBe("#00ff00");
    });

    it("a store change over a live instance still applies without a rebuild", () => {
      const ugm = graph();
      render(<CytoscapeCanvas ugm={ugm} />);
      act(() => {
        useStyleOverrideStore.getState().add({
          scope: { nodeId: "b" },
          color: "#0000ff",
        });
      });
      expect(cytoscapeFn).toHaveBeenCalledTimes(1);
      expect(bypass.get("b")?.["background-color"]).toBe("#0000ff");
      act(() => {
        useStyleOverrideStore.getState().clear();
      });
      expect(bypass.has("b")).toBe(false);
    });
  });

  describe("position pins (lock plus badge)", () => {
    it("locks and badges on mount exactly once", () => {
      usePositionPinStore.getState().pin("a");
      render(<CytoscapeCanvas ugm={graph()} />);
      expect(locked.get("a")).toBe(true);
      expect(has("a", "g3t-pinned")).toBe(true);
      expect(bypass.get("a")?.["background-image"]).toEqual([
        expect.stringContaining("data:image/svg+xml"),
      ]);
      expect(count(lockCalls, "a")).toBe(1);
      expect(count(addClassCalls, "a:g3t-pinned")).toBe(1);
      expect(count(styleCalls, "a")).toBe(1);
      expect(locked.get("b")).toBe(false);
      expect(has("b", "g3t-pinned")).toBe(false);
    });

    it.each(["layout", "edgeStyle"] as const)(
      "the lock and badge are present on the NEW instance after a %s change, applied once",
      (rebuild) => {
        usePositionPinStore.getState().pin("a");
        const { doRebuild } = mountThenRebuild(rebuild);
        doRebuild();
        expect(locked.get("a")).toBe(true);
        expect(has("a", "g3t-pinned")).toBe(true);
        expect(bypass.get("a")?.["background-image"]).toEqual([
          expect.stringContaining("data:image/svg+xml"),
        ]);
        expect(count(lockCalls, "a")).toBe(1);
        expect(count(addClassCalls, "a:g3t-pinned")).toBe(1);
        expect(count(styleCalls, "a")).toBe(1);
        expect(has("b", "g3t-pinned")).toBe(false);
      },
    );

    it("the rebuilt pin stack composes over the spec icon (overrides, then pins)", () => {
      usePositionPinStore.getState().pin("a");
      const { doRebuild } = mountThenRebuild("layout", { encodingSpec: SPEC });
      doRebuild();
      expect(nodeStore.get("a")!._icon).toBe(ICON);
      expect(bypass.get("a")?.["background-image"]).toEqual([
        ICON,
        expect.stringContaining("data:image/svg+xml"),
      ]);
    });

    it("an unpin over a live instance still unlocks without a rebuild", () => {
      usePositionPinStore.getState().pin("a");
      const ugm = graph();
      render(<CytoscapeCanvas ugm={ugm} />);
      act(() => {
        usePositionPinStore.getState().unpin("a");
      });
      expect(cytoscapeFn).toHaveBeenCalledTimes(1);
      expect(locked.get("a")).toBe(false);
      expect(has("a", "g3t-pinned")).toBe(false);
      expect(bypass.get("a")?.["background-image"]).toBeUndefined();
    });
  });

  describe("algorithm overlays (member, tone and dim classes)", () => {
    const register = () =>
      useOverlayStore.getState().register({
        id: "o",
        label: "o",
        nodeIds: ["a"],
        edgeIds: ["ab"],
        tone: "danger",
      });

    it("classes the members, tones and dims on mount exactly once", () => {
      register();
      render(<CytoscapeCanvas ugm={graph()} />);
      expect(has("a", "g3t-ov-member")).toBe(true);
      expect(has("a", "g3t-ov-danger")).toBe(true);
      expect(has("b", "g3t-ov-dim")).toBe(true);
      expect(has("ab", "g3t-ov-member")).toBe(true);
      expect(has("ab", "g3t-ov-danger")).toBe(true);
      expect(count(addClassCalls, "a:g3t-ov-member")).toBe(1);
      expect(count(addClassCalls, "a:g3t-ov-danger")).toBe(1);
      expect(count(addClassCalls, "b:g3t-ov-dim")).toBe(1);
    });

    it.each(["layout", "edgeStyle"] as const)(
      "the member and tone classes are present on the NEW instance after a %s change, applied once",
      (rebuild) => {
        register();
        const { doRebuild } = mountThenRebuild(rebuild);
        doRebuild();
        expect(has("a", "g3t-ov-member")).toBe(true);
        expect(has("a", "g3t-ov-danger")).toBe(true);
        expect(has("b", "g3t-ov-dim")).toBe(true);
        expect(has("ab", "g3t-ov-member")).toBe(true);
        expect(has("ab", "g3t-ov-danger")).toBe(true);
        expect(count(addClassCalls, "a:g3t-ov-member")).toBe(1);
        expect(count(addClassCalls, "a:g3t-ov-danger")).toBe(1);
        expect(count(addClassCalls, "b:g3t-ov-dim")).toBe(1);
      },
    );

    it("a toggle over a live instance still strips the classes without a rebuild", () => {
      register();
      const ugm = graph();
      render(<CytoscapeCanvas ugm={ugm} />);
      act(() => {
        useOverlayStore.getState().toggle("o");
      });
      expect(cytoscapeFn).toHaveBeenCalledTimes(1);
      expect(has("a", "g3t-ov-member")).toBe(false);
      expect(has("a", "g3t-ov-danger")).toBe(false);
      expect(has("b", "g3t-ov-dim")).toBe(false);
    });
  });

  it("all three together survive a rebuild, and the rebuild is restyle-only (no fit, no extra layout)", () => {
    useStyleOverrideStore.getState().add({
      scope: { nodeId: "b" },
      color: "#ff0000",
    });
    usePositionPinStore.getState().pin("a");
    useOverlayStore.getState().register({
      id: "o",
      label: "o",
      nodeIds: ["a"],
      edgeIds: [],
    });
    const { doRebuild } = mountThenRebuild("layout");
    doRebuild();
    expect(bypass.get("b")?.["background-color"]).toBe("#ff0000");
    expect(locked.get("a")).toBe(true);
    expect(has("a", "g3t-pinned")).toBe(true);
    expect(has("a", "g3t-ov-member")).toBe(true);
    expect(has("b", "g3t-ov-dim")).toBe(true);
    // The decoration re-application never touches the camera or runs
    // a layout of its own (the constructor's layout option is the
    // only layout a rebuild gets).
    expect(cy.fit).not.toHaveBeenCalled();
    expect(cy.layout).not.toHaveBeenCalled();
  });
});
