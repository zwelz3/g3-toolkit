/**
 * LAY-005: dummy-chain tests (owner Jake, 2026-08-14). Cover the
 * pure module (split/harvest/chooseDummyParent), the collapse
 * round-trip through the structural engine (no dummy leaks into
 * geometry), and the router's bend-hint consumption path.
 */
import { describe, expect, it } from "vitest";
import {
  DUMMY_NODE_SIZE,
  chooseDummyParent,
  harvestBendHints,
  isDummyId,
  splitLongSpanEdges,
} from "./g3t-dummy-chain";
import { g3tLayoutStructural } from "./g3t-structural";
import { routeStructuralEdges } from "./g3t-routing";
import type { StructuralGraphInput } from "../structural";

describe("splitLongSpanEdges (LAY-005)", () => {
  it("a k-span edge yields k-1 dummies at each intermediate layer", () => {
    const nodes = ["a", "b"].map((id) => ({ id, width: 40, height: 40 }));
    const edges = [{ id: "long", source: "a", target: "b" }];
    // Layer(a)=0, layer(b)=5 -> span=5, 4 dummies expected.
    const layerOf = new Map<string, number>([
      ["a", 0],
      ["b", 5],
    ]);
    const reversed = new Set<string>();
    const { augmentedNodes, augmentedEdges, augmentedLayerOf, dummyIdsByEdge } =
      splitLongSpanEdges(nodes, edges, layerOf, reversed);
    const dummies = dummyIdsByEdge.get("long") ?? [];
    expect(dummies.length).toBe(4);
    // Layers 1..4.
    const dLayers = dummies.map((id) => augmentedLayerOf.get(id));
    expect(dLayers).toEqual([1, 2, 3, 4]);
    // Chain: source -> d1, d1 -> d2, ..., d4 -> target.
    const chainCount = augmentedEdges.filter((e) => e.id !== "long").length;
    expect(chainCount).toBe(5);
    // Original edge removed.
    expect(augmentedEdges.find((e) => e.id === "long")).toBeUndefined();
    // All dummies present in augmentedNodes with the flag and the
    // shared constant size.
    for (const d of dummies) {
      const node = augmentedNodes.find((n) => n.id === d);
      expect(node).toBeDefined();
      expect(node?.dummy).toBe(true);
      expect(node?.width).toBe(DUMMY_NODE_SIZE);
      expect(node?.height).toBe(DUMMY_NODE_SIZE);
      expect(isDummyId(d)).toBe(true);
    }
  });

  it("|span|=1 edges pass through untouched (no dummies)", () => {
    const nodes = [
      { id: "a", width: 40, height: 40 },
      { id: "b", width: 40, height: 40 },
    ];
    const edges = [{ id: "short", source: "a", target: "b" }];
    const layerOf = new Map<string, number>([
      ["a", 0],
      ["b", 1],
    ]);
    const { augmentedNodes, augmentedEdges, dummyIdsByEdge } =
      splitLongSpanEdges(nodes, edges, layerOf, new Set());
    expect(augmentedNodes.length).toBe(2);
    expect(augmentedEdges.length).toBe(1);
    expect(dummyIdsByEdge.size).toBe(0);
  });

  it("a reversed edge's dummies collapse in ORIGINAL source-to-target order", () => {
    // The oriented (post-cycle-removal) edge points t->s at layers 0->3.
    // splitLongSpanEdges builds ascending-layer dummies (t-side first),
    // then reverses the stored list so hint harvest reads them from
    // the ORIGINAL source side.
    const nodes = [
      { id: "s", width: 40, height: 40 },
      { id: "t", width: 40, height: 40 },
    ];
    const edges = [{ id: "back", source: "s", target: "t" }];
    // Reversed edge: oriented low is t (layer 0), oriented high is s (layer 3).
    const layerOf = new Map<string, number>([
      ["s", 3],
      ["t", 0],
    ]);
    const reversed = new Set(["back"]);
    const { augmentedEdges, dummyIdsByEdge, augmentedLayerOf } =
      splitLongSpanEdges(nodes, edges, layerOf, reversed);
    const dummies = dummyIdsByEdge.get("back")!;
    // Source (s) is at layer 3, so source-to-target hint order visits
    // dummies at layers 2, then 1 (descending toward target at 0).
    const dLayers = dummies.map((d) => augmentedLayerOf.get(d));
    expect(dLayers).toEqual([2, 1]);
    // Chain edges: ascending from oriented source (t) to oriented target (s).
    const chain = augmentedEdges.filter((e) => e.id !== "back");
    expect(chain.length).toBe(3); // t -> d@1, d@1 -> d@2, d@2 -> s
    expect(chain[0]?.source).toBe("t");
    expect(chain[chain.length - 1]?.target).toBe("s");
  });
});

describe("harvestBendHints", () => {
  it("returns hints in source-to-target order (matches dummyIdsByEdge)", () => {
    const dummyIdsByEdge = new Map<string, string[]>([
      ["e1", ["d1", "d2", "d3"]],
    ]);
    const positions = new Map<string, { x: number; y: number }>([
      ["d1", { x: 10, y: 20 }],
      ["d2", { x: 30, y: 40 }],
      ["d3", { x: 50, y: 60 }],
    ]);
    const hints = harvestBendHints(dummyIdsByEdge, positions);
    expect(hints.get("e1")).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);
  });

  it("skips edges whose dummies never got a position (defensive)", () => {
    const dummyIdsByEdge = new Map<string, string[]>([["e1", ["d1"]]]);
    const hints = harvestBendHints(dummyIdsByEdge, new Map());
    expect(hints.has("e1")).toBe(false);
  });
});

describe("chooseDummyParent (LAY-005 nested-case helper)", () => {
  // Ancestor graph:
  //   root
  //   ├── A (compound)
  //   │   ├── A1 (compound)
  //   │   └── A2
  //   ├── B (compound)
  //   │   └── B1
  //
  // ancestorsOf returns innermost -> outermost, ending in null (root).
  const ancestorsOf = (id: string): (string | null)[] => {
    switch (id) {
      case "A1":
      case "A2":
        return ["A", null];
      case "A":
        return [null];
      case "B1":
        return ["B", null];
      case "B":
        return [null];
      default:
        return [null];
    }
  };

  it("case (a): shared innermost compound ancestor", () => {
    // Two endpoints inside A1: their shared innermost is A1.
    expect(chooseDummyParent("A1", "A1", ancestorsOf)).toBe("A1");
    // One inside A1, one inside A2: shared innermost is A.
    expect(chooseDummyParent("A1", "A2", ancestorsOf)).toBe("A");
  });

  it("case (b): a single root-scope endpoint returns the other's container", () => {
    expect(chooseDummyParent(null, "A", ancestorsOf)).toBe("A");
    expect(chooseDummyParent("B1", null, ancestorsOf)).toBe("B1");
  });

  it("case (b/c): both at root returns root (null)", () => {
    expect(chooseDummyParent(null, null, ancestorsOf)).toBeNull();
  });

  it("case (c): cross-sibling compounds fall to the nearest common ancestor (root)", () => {
    // A1 lives under A; B1 lives under B: their nearest common is root.
    expect(chooseDummyParent("A1", "B1", ancestorsOf)).toBeNull();
  });
});

describe("DUMMY_NODE_SIZE non-zero contract", () => {
  it("MUST be positive: a zero size would let neighbors compact onto the chain", () => {
    // The constant carries a load-bearing invariant: it appears in
    // placement's size-aware separation. A zero value would let a
    // dummy occupy no width, letting BK collapse the intra-layer
    // gap and leaving no lane for the collapsed edge. This assertion
    // is the contract test the brief calls for: change DUMMY_NODE_SIZE
    // to 0 and it fails.
    expect(DUMMY_NODE_SIZE).toBeGreaterThan(0);
  });
});

describe("collapse round-trip: no dummies leak into emitted geometry", () => {
  const spanning = (): StructuralGraphInput => {
    // A chain of 6 nodes plus a long-span edge from n0 to n5 (span 5).
    const nodes = ["n0", "n1", "n2", "n3", "n4", "n5"].map((id) => ({
      id,
      width: 60,
      height: 40,
    }));
    const edges = [
      { id: "c1", source: "n0", target: "n1" },
      { id: "c2", source: "n1", target: "n2" },
      { id: "c3", source: "n2", target: "n3" },
      { id: "c4", source: "n3", target: "n4" },
      { id: "c5", source: "n4", target: "n5" },
      { id: "long", source: "n0", target: "n5" },
    ];
    return { nodes, edges };
  };

  it("no dummy id appears in geometry.nodes or geometry.edges", () => {
    const g = g3tLayoutStructural(spanning(), { direction: "RIGHT" });
    for (const id of Object.keys(g.nodes)) {
      expect(isDummyId(id), `node id ${id} leaked`).toBe(false);
    }
    const edges = g.edges ?? {};
    for (const id of Object.keys(edges)) {
      expect(isDummyId(id), `edge id ${id} leaked`).toBe(false);
    }
  });

  it("determinism: same input yields byte-identical geometry", () => {
    const a = JSON.stringify(
      g3tLayoutStructural(spanning(), { direction: "RIGHT" }),
    );
    const b = JSON.stringify(
      g3tLayoutStructural(spanning(), { direction: "RIGHT" }),
    );
    expect(a).toBe(b);
  });

  it("intermediate bend hints span source-to-target with one hint per crossed layer", () => {
    // The k-span long edge produces k-1 interpolated hints. In the
    // current placement path (dummies excluded from BK to keep the
    // field geometry stable), hint POSITIONS come from layer-index
    // interpolation across the placed real endpoints; the count is
    // what the split guaranteed, and each hint sits at a distinct
    // flow-axis coordinate (one per crossed layer).
    const g = g3tLayoutStructural(spanning(), { direction: "RIGHT" });
    const longEdge = (g.edges ?? {})["long"];
    expect(longEdge).toBeDefined();
    const inter = longEdge!.intermediate ?? [];
    expect(inter.length).toBe(4);
    const xs = inter.map((p) => Math.round(p.x));
    expect(new Set(xs).size).toBe(xs.length);
  });
});

describe("routing consumer: bendHints seed the polyline", () => {
  it("intermediate points appear in order and drive extra bends", () => {
    // A single edge with two explicit hints, no obstacles: the seeded
    // polyline must pass through both hints in order and store them as
    // `intermediate`.
    const input: StructuralGraphInput = {
      nodes: [
        { id: "a", width: 60, height: 40 },
        { id: "b", width: 60, height: 40 },
      ],
      edges: [{ id: "e", source: "a", target: "b" }],
    };
    const geometry = {
      version: 1 as const,
      nodes: {
        a: { x: 0, y: 100, width: 60, height: 40, kind: "node" as const },
        b: { x: 600, y: 100, width: 60, height: 40, kind: "node" as const },
      },
      ports: {},
      edges: {},
      headerHeight: 0,
    };
    const hints = new Map([
      [
        "e",
        [
          { x: 200, y: 40 },
          { x: 400, y: 180 },
        ],
      ],
    ]);
    const routed = routeStructuralEdges(input, geometry, {
      direction: "RIGHT",
      bendHints: hints,
    });
    const r = routed["e"]!;
    expect(r.intermediate).toEqual([
      { x: 200, y: 40 },
      { x: 400, y: 180 },
    ]);
    // Route visits both hint x-columns in order.
    const xs = r.points.map((p) => p.x);
    const at200 = xs.indexOf(200);
    const at400 = xs.indexOf(400);
    expect(at200).toBeGreaterThanOrEqual(0);
    expect(at400).toBeGreaterThan(at200);
  });
});

describe("perimeter policy vs bend-hint seeding", () => {
  const wideField = (): {
    input: StructuralGraphInput;
    geometry: {
      version: 1;
      nodes: Record<
        string,
        { x: number; y: number; width: number; height: number; kind: "node" }
      >;
      ports: Record<string, never>;
      edges: Record<string, never>;
      headerHeight: number;
    };
  } => {
    // 20 boxes wedged between the endpoints -> near.length is large.
    // Endpoints on the far left/right of a horizontal band.
    const boxes: Record<
      string,
      { x: number; y: number; width: number; height: number; kind: "node" }
    > = {
      a: { x: 0, y: 100, width: 60, height: 40, kind: "node" },
      b: { x: 1200, y: 100, width: 60, height: 40, kind: "node" },
    };
    for (let i = 0; i < 20; i++) {
      boxes[`w${i}`] = {
        x: 100 + i * 50,
        y: 110,
        width: 30,
        height: 20,
        kind: "node",
      };
    }
    const input: StructuralGraphInput = {
      nodes: Object.keys(boxes).map((id) => ({ id, width: 60, height: 40 })),
      edges: [{ id: "e", source: "a", target: "b" }],
    };
    const geometry = {
      version: 1 as const,
      nodes: boxes,
      ports: {},
      edges: {},
      headerHeight: 0,
    };
    return { input, geometry };
  };

  // Hints sit ABOVE the row band (y=40, band spans 110..130) so a
  // seeded polyline can clear the obstacles when the perimeter guard
  // is disabled or absent; the two "seeding wins" cases assert on the
  // stored `intermediate`, not the exact points chosen by the router.
  const hints = new Map([
    [
      "e",
      [
        { x: 400, y: 40 },
        { x: 700, y: 40 },
      ],
    ],
  ]);

  it("absent longEdgeNear (undefined) treats guard as Infinity; hints seed", () => {
    const { input, geometry } = wideField();
    const routed = routeStructuralEdges(input, geometry, {
      direction: "RIGHT",
      bendHints: hints,
      // longEdgeNear intentionally OMITTED.
    });
    expect(routed["e"]?.intermediate).toEqual([
      { x: 400, y: 40 },
      { x: 700, y: 40 },
    ]);
  });

  it("longEdgeNear: Infinity keeps seeding on even in a dense field", () => {
    const { input, geometry } = wideField();
    const routed = routeStructuralEdges(input, geometry, {
      direction: "RIGHT",
      bendHints: hints,
      longEdgeNear: Infinity,
    });
    expect(routed["e"]?.intermediate).toBeDefined();
  });

  it("explicit low threshold in a dense field skips seeding (perimeter wins)", () => {
    const { input, geometry } = wideField();
    const routed = routeStructuralEdges(input, geometry, {
      direction: "RIGHT",
      bendHints: hints,
      longEdgeNear: 5,
    });
    // Perimeter routed, so no intermediate seed on the emitted edge.
    expect(routed["e"]?.intermediate).toBeUndefined();
  });
});
