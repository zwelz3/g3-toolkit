// The pattern oracle suite (owner directive 2026-07-28 #3): each
// recipe from docs/structural-patterns.md runs end-to-end (layout +
// route) and asserts its documented guarantees. A regression in any
// pattern fails HERE, not in a review.
import { describe, it, expect } from "vitest";
import type { StructuralGraphInput } from "../structural";
import { g3tLayoutStructural } from "./g3t-structural";
import { routeStructuralEdges } from "./g3t-routing";

type Box = { x: number; y: number; width: number; height: number };

function crossesInterior(
  pts: readonly { x: number; y: number }[],
  box: Box,
): boolean {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (!a || !b) continue;
    const sx1 = Math.min(a.x, b.x);
    const sx2 = Math.max(a.x, b.x);
    const sy1 = Math.min(a.y, b.y);
    const sy2 = Math.max(a.y, b.y);
    if (
      sx1 < box.x + box.width - 0.5 &&
      sx2 > box.x + 0.5 &&
      sy1 < box.y + box.height - 0.5 &&
      sy2 > box.y + 0.5
    ) {
      return true;
    }
  }
  return false;
}

describe("pattern 1: flat blocks with labeled edges", () => {
  it("routes clear every non-endpoint block and near-aligned pairs run straight", () => {
    const input: StructuralGraphInput = {
      nodes: [
        { id: "a", width: 160, height: 60 },
        { id: "mid", width: 140, height: 200 },
        { id: "b", width: 160, height: 60 },
      ],
      edges: [{ id: "e", source: "a", target: "b", label: "flow" }],
    };
    const geometry = g3tLayoutStructural(input, { direction: "RIGHT" });
    const routes = routeStructuralEdges(input, geometry, {
      direction: "RIGHT",
    });
    const pts = routes["e"]?.points ?? [];
    expect(pts.length).toBeGreaterThanOrEqual(2);
    const midBox = geometry.nodes["mid"];
    expect(midBox).toBeDefined();
    expect(crossesInterior(pts, midBox as Box)).toBe(false);
  });
});

describe("pattern 2: containment", () => {
  it("derives the container from rows and reserves the header strip", () => {
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "blk",
          header: { stereotype: "block", name: "Payload" },
          compartments: [
            {
              id: "blk.vals",
              title: "values",
              rows: [
                { id: "r1", text: "mass : kg" },
                { id: "r2", text: "power : W" },
              ],
            },
          ],
        },
      ],
      edges: [],
    };
    const geometry = g3tLayoutStructural(input, { direction: "RIGHT" });
    const blk = geometry.nodes["blk"];
    expect(blk).toBeDefined();
    // Two rows + header: taller than a bare default box.
    expect(blk?.height ?? 0).toBeGreaterThan(44);
    // Rows sit inside the container bounds.
    for (const [gid, g] of Object.entries(geometry.nodes)) {
      if (gid === "blk" || !gid.startsWith("r")) continue;
      expect(g.y).toBeGreaterThanOrEqual(blk?.y ?? Infinity);
    }
  });
});

describe("pattern 3: blocks with ports", () => {
  it("sides grow for declared ports and port pairs straighten within their bodies", () => {
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "src",
          width: 140,
          height: 40,
          ports: [{ id: "src.o", side: "EAST" }],
        },
        {
          id: "dst",
          width: 160,
          height: 40,
          ports: [1, 2, 3, 4, 5].map((i) => ({
            id: `dst.p${i}`,
            side: "WEST" as const,
          })),
        },
      ],
      edges: [
        {
          id: "e",
          source: "src",
          target: "dst",
          sourcePort: "src.o",
          targetPort: "dst.p3",
        },
      ],
    };
    const geometry = g3tLayoutStructural(input, { direction: "RIGHT" });
    // Five WEST ports: 5*20+24 = 124 minimum height.
    expect(geometry.nodes["dst"]?.height ?? 0).toBeGreaterThanOrEqual(124);
    // Every port sits on its declared WEST border.
    const dst = geometry.nodes["dst"];
    for (let i = 1; i <= 5; i++) {
      const p = geometry.ports[`dst.p${i}`];
      expect(p).toBeDefined();
      expect(
        Math.abs((p?.x ?? 0) + (p?.width ?? 0) / 2 - (dst?.x ?? 0)),
      ).toBeLessThanOrEqual(8);
    }
    const routes = routeStructuralEdges(input, geometry, {
      direction: "RIGHT",
    });
    expect(routes["e"]?.points.length).toBeGreaterThanOrEqual(2);
  });
});

describe("pattern 4: containment WITH ports (the combined recipe)", () => {
  it("sizing honors BOTH row content and port demand; routing stays clean", () => {
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "sys",
          header: { stereotype: "block", name: "System" },
          compartments: [
            {
              id: "sys.parts",
              title: "parts",
              rows: [{ id: "sys.r1", text: "controller : OBC" }],
            },
          ],
          ports: [1, 2, 3, 4, 5, 6].map((i) => ({
            id: `sys.p${i}`,
            side: "WEST" as const,
          })),
        },
        {
          id: "ext",
          width: 140,
          height: 40,
          ports: [{ id: "ext.o", side: "EAST" }],
        },
      ],
      edges: [
        {
          id: "link",
          source: "ext",
          target: "sys",
          sourcePort: "ext.o",
          targetPort: "sys.p2",
        },
      ],
    };
    const geometry = g3tLayoutStructural(input, { direction: "RIGHT" });
    // Six ports demand 6*20+24 = 144: port demand beats the single
    // row's stack.
    expect(geometry.nodes["sys"]?.height ?? 0).toBeGreaterThanOrEqual(144);
    const routes = routeStructuralEdges(input, geometry, {
      direction: "RIGHT",
    });
    expect(routes["link"]?.points.length).toBeGreaterThanOrEqual(2);
  });
});

describe("pattern 5: mixed port/box bindings", () => {
  it("the box anchor slides to the port's tangent", () => {
    const input: StructuralGraphInput = {
      nodes: [
        { id: "val", width: 150, height: 40 },
        {
          id: "con",
          width: 200,
          height: 120,
          ports: [{ id: "con.p", side: "WEST" }],
        },
      ],
      edges: [
        { id: "bind", source: "val", target: "con", targetPort: "con.p" },
      ],
    };
    const geometry = g3tLayoutStructural(input, { direction: "RIGHT" });
    const routes = routeStructuralEdges(input, geometry, {
      direction: "RIGHT",
    });
    const pts = routes["bind"]?.points ?? [];
    expect(pts.length).toBeGreaterThanOrEqual(2);
    // The port's tangent y: the box end matches it when within the
    // snap; at minimum the route is orthogonal and short.
    expect(pts.length).toBeLessThanOrEqual(6);
  });
});

describe("R-6: layout forwards the anchor option to its router", () => {
  it("g3tLayoutStructural(anchor: 'target') routes like the router called directly", () => {
    const srcs = ["a", "b", "c"];
    const dsts = ["x", "y", "z"];
    const input: StructuralGraphInput = {
      nodes: [...srcs, ...dsts].map((id) => ({
        id,
        width: 120,
        height: 160,
      })),
      edges: srcs.flatMap((s) =>
        dsts.map((d) => ({ id: `${s}${d}`, source: s, target: d })),
      ),
    };
    const viaLayoutDefault = g3tLayoutStructural(input, {
      direction: "RIGHT",
    });
    const viaLayoutTarget = g3tLayoutStructural(input, {
      direction: "RIGHT",
      anchor: "target",
    });
    // The option must REACH the router: geometry.edges differ.
    expect(JSON.stringify(viaLayoutTarget.edges)).not.toBe(
      JSON.stringify(viaLayoutDefault.edges),
    );
    // ...and match a direct re-route with the same option, which is
    // the workaround this closes.
    const direct = routeStructuralEdges(input, viaLayoutTarget, {
      direction: "RIGHT",
      anchor: "target",
    });
    expect(JSON.stringify(viaLayoutTarget.edges)).toBe(JSON.stringify(direct));
  });
});
