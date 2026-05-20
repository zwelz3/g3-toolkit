/**
 * UGM tests covering all E0.2 ticket acceptance criteria:
 *
 * T1: add 1,000 nodes; retrieve by id; iterate; remove; verify type labels; verify property-key registry.
 * T2: add edge with full metadata; add parallel edge; retrieve both; verify metadata.
 * T3: add node; verify event fires with correct payload.
 * T4: round-trip create graph, serialize, deserialize, deep-equal.
 */

import { describe, it, expect, vi } from "vitest";
import { UGM } from "./ugm";

// ── T1: Graphology wrapper with typed nodes ─────────────────────────

describe("UGM: typed nodes (M0.E2.T1)", () => {
  it("adds and retrieves a node with types and properties", () => {
    const ugm = new UGM();
    ugm.addNode("alice", {
      types: ["Person", "Customer"],
      properties: { name: "Alice", age: 30 },
    });

    const node = ugm.getNode("alice");
    expect(node).toBeDefined();
    expect(node!.types).toEqual(["Person", "Customer"]);
    expect(node!.properties).toEqual({ name: "Alice", age: 30 });
  });

  it("adds 1,000 nodes and retrieves each by ID", () => {
    const ugm = new UGM();
    for (let i = 0; i < 1000; i++) {
      ugm.addNode(`node-${i}`, {
        types: ["TestNode"],
        properties: { index: i },
      });
    }

    expect(ugm.nodeCount).toBe(1000);

    for (let i = 0; i < 1000; i++) {
      const node = ugm.getNode(`node-${i}`);
      expect(node).toBeDefined();
      expect(node!.properties.index).toBe(i);
    }
  });

  it("iterates all nodes via forEachNode", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["Y"] });
    ugm.addNode("c", { types: ["X"] });

    const visited: string[] = [];
    ugm.forEachNode((id) => visited.push(id));

    expect(visited).toHaveLength(3);
    expect(visited).toContain("a");
    expect(visited).toContain("b");
    expect(visited).toContain("c");
  });

  it("removes a node and confirms it is gone", () => {
    const ugm = new UGM();
    ugm.addNode("temp", { types: ["Ephemeral"] });
    expect(ugm.hasNode("temp")).toBe(true);

    ugm.removeNode("temp");
    expect(ugm.hasNode("temp")).toBe(false);
    expect(ugm.getNode("temp")).toBeUndefined();
    expect(ugm.nodeCount).toBe(0);
  });

  it("returns undefined for a nonexistent node", () => {
    const ugm = new UGM();
    expect(ugm.getNode("nonexistent")).toBeUndefined();
  });

  it("tracks node types in the property-key registry", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["Person"] });
    ugm.addNode("b", { types: ["Organization", "Company"] });

    const registry = ugm.getRegistry();
    expect(registry.nodeTypes.has("Person")).toBe(true);
    expect(registry.nodeTypes.has("Organization")).toBe(true);
    expect(registry.nodeTypes.has("Company")).toBe(true);
  });

  it("tracks node property keys in the registry", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { name: "Alice", age: 30 } });
    ugm.addNode("b", { types: ["Y"], properties: { name: "Bob", score: 0.9 } });

    const registry = ugm.getRegistry();
    expect(registry.nodePropertyKeys.has("name")).toBe(true);
    expect(registry.nodePropertyKeys.has("age")).toBe(true);
    expect(registry.nodePropertyKeys.has("score")).toBe(true);
  });

  it("updates node properties and merges with existing", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { name: "Alice" } });
    ugm.updateNodeProperties("a", { age: 30 });

    const node = ugm.getNode("a");
    expect(node!.properties).toEqual({ name: "Alice", age: 30 });
  });

  it("returns all node IDs via getNodeIds", () => {
    const ugm = new UGM();
    ugm.addNode("x", { types: ["T"] });
    ugm.addNode("y", { types: ["T"] });

    const ids = ugm.getNodeIds();
    expect(ids).toHaveLength(2);
    expect(ids).toContain("x");
    expect(ids).toContain("y");
  });

  it("defaults properties to empty object when omitted", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });

    const node = ugm.getNode("a");
    expect(node!.properties).toEqual({});
  });
});

// ── T2: Qualified Edge model ────────────────────────────────────────

describe("UGM: Qualified Edge (M0.E2.T2)", () => {
  it("adds an edge with full Qualified Edge metadata", () => {
    const ugm = new UGM();
    ugm.addNode("alice", { types: ["Person"] });
    ugm.addNode("bob", { types: ["Person"] });

    const edgeId = ugm.addEdge("alice", "bob", {
      type: "knows",
      properties: { since: 2020 },
      confidence: 0.95,
      provenance_iri: "urn:source:humint-report-42",
      temporal_start: "2020-01-01",
      temporal_end: "2025-12-31",
      asserted: true,
    });

    const edge = ugm.getEdge(edgeId);
    expect(edge).toBeDefined();
    expect(edge!.type).toBe("knows");
    expect(edge!.properties).toEqual({ since: 2020 });
    expect(edge!.meta.confidence).toBe(0.95);
    expect(edge!.meta.provenance_iri).toBe("urn:source:humint-report-42");
    expect(edge!.meta.temporal_start).toBe("2020-01-01");
    expect(edge!.meta.temporal_end).toBe("2025-12-31");
    expect(edge!.meta.asserted).toBe(true);
  });

  it("supports parallel edges between the same node pair", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });

    const e1 = ugm.addEdge("a", "b", { type: "knows", confidence: 0.8 });
    const e2 = ugm.addEdge("a", "b", { type: "worksFor", confidence: 0.99 });

    expect(e1).not.toBe(e2);
    expect(ugm.edgeCount).toBe(2);

    const edge1 = ugm.getEdge(e1);
    const edge2 = ugm.getEdge(e2);
    expect(edge1!.type).toBe("knows");
    expect(edge2!.type).toBe("worksFor");

    const between = ugm.getEdgesBetween("a", "b");
    expect(between).toHaveLength(2);
    expect(between).toContain(e1);
    expect(between).toContain(e2);
  });

  it("retrieves edge endpoints", () => {
    const ugm = new UGM();
    ugm.addNode("src", { types: ["X"] });
    ugm.addNode("tgt", { types: ["Y"] });

    const edgeId = ugm.addEdge("src", "tgt", { type: "link" });
    const endpoints = ugm.getEdgeEndpoints(edgeId);

    expect(endpoints).toEqual({ source: "src", target: "tgt" });
  });

  it("removes an edge", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    const edgeId = ugm.addEdge("a", "b", { type: "link" });

    ugm.removeEdge(edgeId);
    expect(ugm.hasEdge(edgeId)).toBe(false);
    expect(ugm.edgeCount).toBe(0);
  });

  it("tracks edge types in the property-key registry", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    ugm.addEdge("a", "b", { type: "knows" });
    ugm.addEdge("a", "b", { type: "worksFor" });

    const registry = ugm.getRegistry();
    expect(registry.edgeTypes.has("knows")).toBe(true);
    expect(registry.edgeTypes.has("worksFor")).toBe(true);
  });

  it("updates edge properties", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    const edgeId = ugm.addEdge("a", "b", {
      type: "link",
      properties: { weight: 1 },
    });

    ugm.updateEdgeProperties(edgeId, { weight: 5, label: "strong" });

    const edge = ugm.getEdge(edgeId);
    expect(edge!.properties).toEqual({ weight: 5, label: "strong" });
  });

  it("updates Qualified Edge metadata", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    const edgeId = ugm.addEdge("a", "b", {
      type: "link",
      confidence: 0.5,
    });

    ugm.updateEdgeMeta(edgeId, { confidence: 0.9, asserted: false });

    const edge = ugm.getEdge(edgeId);
    expect(edge!.meta.confidence).toBe(0.9);
    expect(edge!.meta.asserted).toBe(false);
  });

  it("omits undefined metadata fields", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    const edgeId = ugm.addEdge("a", "b", { type: "link" });

    const edge = ugm.getEdge(edgeId);
    expect(edge!.meta).toEqual({});
  });

  it("gets neighbor nodes", () => {
    const ugm = new UGM();
    ugm.addNode("center", { types: ["X"] });
    ugm.addNode("n1", { types: ["X"] });
    ugm.addNode("n2", { types: ["X"] });
    ugm.addNode("isolated", { types: ["X"] });
    ugm.addEdge("center", "n1", { type: "link" });
    ugm.addEdge("center", "n2", { type: "link" });

    const neighbors = ugm.getNeighbors("center");
    expect(neighbors).toHaveLength(2);
    expect(neighbors).toContain("n1");
    expect(neighbors).toContain("n2");
  });
});

// ── T3: Event emission ──────────────────────────────────────────────

describe("UGM: events (M0.E2.T3)", () => {
  it("emits nodeAdded with correct payload", () => {
    const ugm = new UGM();
    const handler = vi.fn();
    ugm.on("nodeAdded", handler);

    ugm.addNode("alice", {
      types: ["Person"],
      properties: { name: "Alice" },
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      nodeId: "alice",
      attributes: {
        types: ["Person"],
        properties: { name: "Alice" },
      },
    });
  });

  it("emits nodeRemoved with correct payload", () => {
    const ugm = new UGM();
    ugm.addNode("temp", { types: ["X"] });

    const handler = vi.fn();
    ugm.on("nodeRemoved", handler);

    ugm.removeNode("temp");
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: "temp" }),
    );
  });

  it("emits edgeAdded with correct payload", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });

    const handler = vi.fn();
    ugm.on("edgeAdded", handler);

    const edgeId = ugm.addEdge("a", "b", {
      type: "knows",
      confidence: 0.9,
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        edgeId,
        source: "a",
        target: "b",
      }),
    );
    // Verify nested metadata
    const payload = handler.mock.calls[0]?.[0] as Record<string, unknown>;
    const attrs = payload.attributes as Record<string, unknown>;
    expect(attrs.type).toBe("knows");
    const meta = attrs.meta as Record<string, unknown>;
    expect(meta.confidence).toBe(0.9);
  });

  it("emits edgeRemoved with correct payload", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    const edgeId = ugm.addEdge("a", "b", { type: "link" });

    const handler = vi.fn();
    ugm.on("edgeRemoved", handler);

    ugm.removeEdge(edgeId);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ edgeId }));
  });

  it("emits nodeAttributesUpdated on property update", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { x: 1 } });

    const handler = vi.fn();
    ugm.on("nodeAttributesUpdated", handler);

    ugm.updateNodeProperties("a", { y: 2 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      elementId: "a",
      elementType: "node",
      updatedKeys: ["y"],
    });
  });

  it("emits edgeAttributesUpdated on meta update", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    const edgeId = ugm.addEdge("a", "b", { type: "link" });

    const handler = vi.fn();
    ugm.on("edgeAttributesUpdated", handler);

    ugm.updateEdgeMeta(edgeId, { confidence: 0.7 });

    expect(handler).toHaveBeenCalledOnce();
    const payload = handler.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.elementId).toBe(edgeId);
    expect(payload.updatedKeys).toEqual(["confidence"]);
  });

  it("emits cleared event", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });

    const handler = vi.fn();
    ugm.on("cleared", handler);

    ugm.clear();
    expect(handler).toHaveBeenCalledOnce();
  });

  it("supports unsubscribe via returned function", () => {
    const ugm = new UGM();
    const handler = vi.fn();
    const unsub = ugm.on("nodeAdded", handler);

    ugm.addNode("a", { types: ["X"] });
    expect(handler).toHaveBeenCalledOnce();

    unsub();
    ugm.addNode("b", { types: ["X"] });
    expect(handler).toHaveBeenCalledOnce(); // still 1, not 2
  });
});

// ── T4: Serialization ───────────────────────────────────────────────

describe("UGM: serialization (M0.E2.T4)", () => {
  it("round-trips a graph through toJSON and fromJSON", () => {
    const ugm = new UGM();
    ugm.addNode("alice", {
      types: ["Person"],
      properties: { name: "Alice", age: 30 },
    });
    ugm.addNode("bob", {
      types: ["Person", "Employee"],
      properties: { name: "Bob" },
    });
    ugm.addEdge("alice", "bob", {
      type: "knows",
      properties: { since: 2020 },
      confidence: 0.95,
      provenance_iri: "urn:source:42",
      asserted: true,
    });

    const json = ugm.toJSON();
    const restored = UGM.fromJSON(json);

    // Verify nodes
    expect(restored.nodeCount).toBe(2);
    expect(restored.getNode("alice")).toEqual(ugm.getNode("alice"));
    expect(restored.getNode("bob")).toEqual(ugm.getNode("bob"));

    // Verify edges
    expect(restored.edgeCount).toBe(1);

    // Find the edge in the restored graph
    let restoredEdgeAttrs;
    restored.forEachEdge((_id, attrs) => {
      restoredEdgeAttrs = attrs;
    });
    expect(restoredEdgeAttrs).toBeDefined();
    expect(restoredEdgeAttrs!.type).toBe("knows");
    expect(restoredEdgeAttrs!.properties).toEqual({ since: 2020 });
    expect(restoredEdgeAttrs!.meta.confidence).toBe(0.95);
    expect(restoredEdgeAttrs!.meta.provenance_iri).toBe("urn:source:42");
    expect(restoredEdgeAttrs!.meta.asserted).toBe(true);
  });

  it("round-trips a graph with multi-edges", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    ugm.addEdge("a", "b", { type: "knows" });
    ugm.addEdge("a", "b", { type: "worksFor" });

    const json = ugm.toJSON();
    const restored = UGM.fromJSON(json);

    expect(restored.edgeCount).toBe(2);

    const edgeTypes: string[] = [];
    restored.forEachEdge((_id, attrs) => edgeTypes.push(attrs.type));
    expect(edgeTypes.sort()).toEqual(["knows", "worksFor"]);
  });

  it("round-trips an empty graph", () => {
    const ugm = new UGM();
    const json = ugm.toJSON();
    const restored = UGM.fromJSON(json);

    expect(restored.nodeCount).toBe(0);
    expect(restored.edgeCount).toBe(0);
  });

  it("restores the property-key registry", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["Person"], properties: { name: "A" } });
    ugm.addNode("b", { types: ["Org"] });
    ugm.addEdge("a", "b", { type: "memberOf" });

    const json = ugm.toJSON();
    const restored = UGM.fromJSON(json);

    const registry = restored.getRegistry();
    expect(registry.nodeTypes.has("Person")).toBe(true);
    expect(registry.nodeTypes.has("Org")).toBe(true);
    expect(registry.edgeTypes.has("memberOf")).toBe(true);
    expect(registry.nodePropertyKeys.has("name")).toBe(true);
  });

  it("produces JSON that is actually serializable", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: { nested: { deep: true } } });
    ugm.addNode("b", { types: ["Y"] });
    ugm.addEdge("a", "b", { type: "link", confidence: 0.5 });

    const json = ugm.toJSON();
    const str = JSON.stringify(json);
    const parsed = JSON.parse(str);
    const restored = UGM.fromJSON(parsed);

    expect(restored.nodeCount).toBe(2);
    expect(restored.getNode("a")!.properties.nested).toEqual({ deep: true });
  });
});

// ── Audit coverage additions ────────────────────────────────────────

describe("UGM: edge cases (audit)", () => {
  it("throws on duplicate node ID", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    expect(() => ugm.addNode("a", { types: ["Y"] })).toThrow();
  });

  it("throws on addEdge with nonexistent source", () => {
    const ugm = new UGM();
    ugm.addNode("b", { types: ["X"] });
    expect(() => ugm.addEdge("missing", "b", { type: "link" })).toThrow();
  });

  it("throws on addEdge with nonexistent target", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    expect(() => ugm.addEdge("a", "missing", { type: "link" })).toThrow();
  });

  it("getNodeEdges returns all incident edges", () => {
    const ugm = new UGM();
    ugm.addNode("center", { types: ["X"] });
    ugm.addNode("n1", { types: ["X"] });
    ugm.addNode("n2", { types: ["X"] });
    const e1 = ugm.addEdge("center", "n1", { type: "a" });
    const e2 = ugm.addEdge("n2", "center", { type: "b" });

    const edges = ugm.getNodeEdges("center");
    expect(edges).toHaveLength(2);
    expect(edges).toContain(e1);
    expect(edges).toContain(e2);
  });

  it("getEdgeEndpoints returns undefined for nonexistent edge", () => {
    const ugm = new UGM();
    expect(ugm.getEdgeEndpoints("nonexistent")).toBeUndefined();
  });

  it("getEdge returns undefined for nonexistent edge", () => {
    const ugm = new UGM();
    expect(ugm.getEdge("nonexistent")).toBeUndefined();
  });

  it("clear removes all nodes and edges", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    ugm.addNode("b", { types: ["X"] });
    ugm.addEdge("a", "b", { type: "link" });

    ugm.clear();
    expect(ugm.nodeCount).toBe(0);
    expect(ugm.edgeCount).toBe(0);
  });
});
