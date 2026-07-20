/**
 * Engine-agnostic layout-cache oracles (WS-D D3a).
 *
 * The elk-pinned cache tests in structural.test.ts verify ELK
 * pipeline mechanics and leave with it at D3b. These pin the cache
 * CONTRACT for whatever engine is default: sequential identity,
 * engineKind in the key, sketch honesty, routeEdges honesty.
 */
import { describe, expect, it } from "vitest";
import type { StructuralGraphInput } from "./structural";
import { layoutStructural } from "./structural";

const fixture = (): StructuralGraphInput => ({
  nodes: [
    {
      id: "box",
      header: { stereotype: "Block", name: "Box" },
      compartments: [{ id: "c0", rows: [{ id: "r0", text: "x" }] }],
    },
    { id: "a", header: { name: "A" }, width: 80, height: 40 },
  ],
  edges: [{ id: "e0", source: "box", target: "a" }],
});

describe("layout cache, engine-agnostic (default engine)", () => {
  it("a sequential re-layout of the same input+options is the SAME object (memo hit)", async () => {
    const input = fixture();
    const first = await layoutStructural(input, {});
    const second = await layoutStructural(input, {});
    expect(second).toBe(first);
  });

  it("strategy options are part of the key: layering choices never alias", async () => {
    // (Replaced the elk/g3t key oracle at the seam's removal, D3b
    // part 1: same contract, a REAL remaining key dimension.)
    const input = fixture();
    const ns = await layoutStructural(input, {});
    const cg = await layoutStructural(input, { layering: "coffman-graham" });
    expect(cg).not.toBe(ns);
    // And each repeat still memo-hits its own entry.
    expect(await layoutStructural(input, { layering: "coffman-graham" })).toBe(
      cg,
    );
    expect(await layoutStructural(input, {})).toBe(ns);
  }, 60_000);

  it("a sketched run is not served from the unsketched memo (default engine)", async () => {
    const input = fixture();
    const plain = await layoutStructural(input, {});
    const sketched = await layoutStructural(input, {
      sketch: { box: { x: 10, y: 10 }, a: { x: 400, y: 10 } },
    });
    expect(sketched).not.toBe(plain);
  });

  it("routeEdges is part of the key and the contract: absent means absent", async () => {
    const input = fixture();
    const routed = await layoutStructural(input, {});
    const bare = await layoutStructural(input, { routeEdges: false });
    expect(bare).not.toBe(routed);
    expect(routed.edges).toBeDefined();
    expect(bare.edges).toBeUndefined();
  });
});
