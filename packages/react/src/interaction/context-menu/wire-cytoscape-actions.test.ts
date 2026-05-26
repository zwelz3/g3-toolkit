/**
 * Test wire-cytoscape-actions: assert that each context-menu event
 * causes the expected cytoscape operation.
 *
 * Uses a hand-rolled minimal mock for the cytoscape Core. We don't
 * want to mock the full library here - we just need to observe what
 * methods get called when an event fires.
 */

import { describe, it, expect, vi } from "vitest";
import { UGM, G3tEventBus } from "@g3t/core";
import type { Core } from "cytoscape";
import { wireCytoscapeContextActions } from "./wire-cytoscape-actions";

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["X"] });
  ugm.addNode("b", { types: ["X"] });
  ugm.addNode("c", { types: ["X"] });
  ugm.addEdge("a", "b", { type: "rel" });
  ugm.addEdge("b", "c", { type: "rel" });
  return ugm;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = any;

interface MockEl {
  lock: AnyFn;
  addClass: AnyFn;
  style: AnyFn;
  connectedEdges: AnyFn;
  nonempty: AnyFn;
  merge: AnyFn;
}

function makeMockCy(knownIds: string[] = ["a", "b", "c"]): Core {
  const elById = new Map<string, MockEl>();
  for (const id of knownIds) {
    elById.set(id, {
      lock: vi.fn(),
      addClass: vi.fn(),
      style: vi.fn(),
      connectedEdges: vi.fn(() => ({ style: vi.fn() })),
      nonempty: vi.fn(() => true),
      merge: vi.fn(),
    });
  }
  const cy = {
    batch: (fn: () => void) => fn(),
    getElementById: vi.fn((id: string) => {
      const e = elById.get(id);
      if (e) return e;
      return {
        nonempty: vi.fn(() => false),
        lock: vi.fn(),
        addClass: vi.fn(),
        style: vi.fn(),
        connectedEdges: vi.fn(() => ({ style: vi.fn() })),
      };
    }),
    collection: vi.fn(() => ({
      nonempty: vi.fn(() => true),
      merge: vi.fn(),
    })),
    fit: vi.fn(),
    __elById: elById,
  };
  return cy as unknown as Core;
}

describe("wireCytoscapeContextActions", () => {
  it("locks + addClass on context:pinNodes", () => {
    const ugm = makeUGM();
    const cy = makeMockCy();
    const bus = new G3tEventBus();
    const unsub = wireCytoscapeContextActions(cy, bus, ugm);

    bus.emit("context:pinNodes", { nodeIds: ["a", "b"] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (cy as any).__elById.get("a") as MockEl;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = (cy as any).__elById.get("b") as MockEl;
    expect(a.lock).toHaveBeenCalledTimes(1);
    expect(b.lock).toHaveBeenCalledTimes(1);
    expect(a.addClass).toHaveBeenCalledWith("g3t-pinned");

    unsub();
  });

  it("sets display:none + addClass on context:hideNodes", () => {
    const ugm = makeUGM();
    const cy = makeMockCy();
    const bus = new G3tEventBus();
    const unsub = wireCytoscapeContextActions(cy, bus, ugm);

    bus.emit("context:hideNodes", { nodeIds: ["c"] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (cy as any).__elById.get("c") as MockEl;
    expect(c.style).toHaveBeenCalledWith("display", "none");
    expect(c.addClass).toHaveBeenCalledWith("g3t-hidden");

    unsub();
  });

  it("fits the canvas to the N-hop neighborhood on context:focusNode", () => {
    const ugm = makeUGM();
    const cy = makeMockCy();
    const bus = new G3tEventBus();
    const unsub = wireCytoscapeContextActions(cy, bus, ugm);

    bus.emit("context:focusNode", { nodeId: "a", hops: 1 });
    // 1-hop neighborhood of 'a' = {a, b}, so getElementById called for both
    expect(cy.getElementById).toHaveBeenCalledWith("a");
    expect(cy.getElementById).toHaveBeenCalledWith("b");
    expect(cy.fit).toHaveBeenCalledTimes(1);

    unsub();
  });

  it("hands a neighborhood UGM to onViewNeighborhood on context:viewNeighbors", () => {
    const ugm = makeUGM();
    const cy = makeMockCy();
    const bus = new G3tEventBus();
    const onViewNeighborhood = vi.fn();
    const unsub = wireCytoscapeContextActions(cy, bus, ugm, {
      onViewNeighborhood,
    });

    bus.emit("context:viewNeighbors", { nodeId: "a", hops: 1 });

    expect(onViewNeighborhood).toHaveBeenCalledTimes(1);
    const callArgs = onViewNeighborhood.mock.calls[0]!;
    const subUGM = callArgs[0] as UGM;
    expect(subUGM.nodeCount).toBe(2); // a and b
    expect(callArgs[1]).toBe("a");
    expect(callArgs[2]).toBe(1);

    unsub();
  });

  it("cleanup unsubscribes all event handlers", () => {
    const ugm = makeUGM();
    const cy = makeMockCy();
    const bus = new G3tEventBus();
    const onViewNeighborhood = vi.fn();
    const unsub = wireCytoscapeContextActions(cy, bus, ugm, {
      onViewNeighborhood,
    });

    unsub();

    bus.emit("context:pinNodes", { nodeIds: ["a"] });
    bus.emit("context:hideNodes", { nodeIds: ["a"] });
    bus.emit("context:viewNeighbors", { nodeId: "a", hops: 1 });

    expect(onViewNeighborhood).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (cy as any).__elById.get("a") as MockEl;
    expect(a.lock).not.toHaveBeenCalled();
  });
});
