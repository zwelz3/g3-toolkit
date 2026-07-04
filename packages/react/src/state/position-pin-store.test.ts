import { describe, it, expect, beforeEach } from "vitest";
import { usePositionPinStore, computeLockedIds } from "./position-pin-store";

beforeEach(() => {
  usePositionPinStore.setState({ pinnedIds: [], allPinned: false });
});

describe("position pin store", () => {
  it("pin/unpin/toggle maintain the per-node set without duplicates", () => {
    const s = usePositionPinStore.getState();
    s.pin("a");
    s.pin("a");
    usePositionPinStore.getState().toggle("b");
    expect(usePositionPinStore.getState().pinnedIds).toEqual(["a", "b"]);
    usePositionPinStore.getState().toggle("a");
    expect(usePositionPinStore.getState().pinnedIds).toEqual(["b"]);
    usePositionPinStore.getState().unpin("b");
    expect(usePositionPinStore.getState().pinnedIds).toEqual([]);
  });

  it("clear releases both per-node pins and pin-all", () => {
    const s = usePositionPinStore.getState();
    s.pin("a");
    s.setAllPinned(true);
    usePositionPinStore.getState().clear();
    const after = usePositionPinStore.getState();
    expect(after.pinnedIds).toEqual([]);
    expect(after.allPinned).toBe(false);
  });
});

describe("computeLockedIds (composition rule)", () => {
  const all = ["a", "b", "c"];

  it("pin-all is the union: every node locked", () => {
    expect(computeLockedIds(true, ["a"], all)).toEqual(
      new Set(["a", "b", "c"]),
    );
  });

  it("releasing pin-all returns to the per-node pin set", () => {
    // The same per-node set, allPinned flipped off: exactly the
    // designed semantics (release never clears hand-pins).
    expect(computeLockedIds(false, ["a", "c"], all)).toEqual(
      new Set(["a", "c"]),
    );
  });

  it("filters pins for nodes not in the graph (stale ids)", () => {
    expect(computeLockedIds(false, ["a", "ghost"], all)).toEqual(
      new Set(["a"]),
    );
  });
});

// Overlay membership rule lives beside the pin rule: same pure style.
import { useOverlayStore, computeOverlayMembership } from "./overlay-store";

describe("overlay membership (round 21)", () => {
  beforeEach(() => useOverlayStore.getState().clear());

  it("union semantics across active overlays; inactive contribute nothing", () => {
    const a = { id: "a", label: "A", nodeIds: ["n1"], edgeIds: ["e1"] };
    const b = { id: "b", label: "B", nodeIds: ["n2"], edgeIds: [] };
    const m = computeOverlayMembership([a, b], ["a"]);
    expect(m.anyActive).toBe(true);
    expect([...m.memberNodes]).toEqual(["n1"]);
    const both = computeOverlayMembership([a, b], ["a", "b"]);
    expect([...both.memberNodes].sort()).toEqual(["n1", "n2"]);
    expect(computeOverlayMembership([a, b], []).anyActive).toBe(false);
  });

  it("register replaces by id and activates; toggle flips independently", () => {
    const s = useOverlayStore.getState();
    s.register({ id: "x", label: "X", nodeIds: ["n"], edgeIds: [] });
    s.register({ id: "y", label: "Y", nodeIds: [], edgeIds: ["e"] });
    expect(useOverlayStore.getState().activeIds).toEqual(["x", "y"]);
    useOverlayStore.getState().toggle("x");
    expect(useOverlayStore.getState().activeIds).toEqual(["y"]);
    useOverlayStore.getState().register({
      id: "x",
      label: "X2",
      nodeIds: ["n9"],
      edgeIds: [],
    });
    const after = useOverlayStore.getState();
    expect(after.overlays.find((o) => o.id === "x")?.label).toBe("X2");
    expect(after.overlays).toHaveLength(2);
  });
});
