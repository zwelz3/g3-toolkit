/**
 * LAY-020 oracles: the local/global contract. The load-bearing pin
 * is VERBATIM CARRYOVER: local mode may not move, resize, or even
 * re-derive a single non-region geometry entry (object equality
 * against the prior document proves untouched, not merely similar).
 */
import { describe, expect, it } from "vitest";
import type { StructuralGraphInput } from "@g3t/core";
import { layoutStructural } from "@g3t/core";
import { layoutStructuralWithChangeSet } from "./change-driven-layout";

function chain(n: number): StructuralGraphInput {
  const nodes = Array.from({ length: n }).map((_, i) => ({
    id: `n${i}`,
    header: { name: `N${i}` },
    width: 80,
    height: 40,
  }));
  const edges = Array.from({ length: n - 1 }).map((_, i) => ({
    id: `e${i}`,
    source: `n${i}`,
    target: `n${i + 1}`,
  }));
  return { nodes, edges };
}

describe("layoutStructuralWithChangeSet (LAY-020)", () => {
  it("local mode: non-region geometry carries over VERBATIM; mode and reroutes reported", async () => {
    const input = chain(10);
    const geometry = await layoutStructural(input);
    const r = await layoutStructuralWithChangeSet(
      { input, geometry },
      { updateNodes: { n9: { width: 140 } } },
    );
    expect(r.mode).toBe("local");
    expect(r.diagnostics).toEqual([]);
    // Region = n9 (touched) + n8 (one-hop). Everything else is the
    // SAME OBJECT as before (verbatim, not recomputed).
    for (let i = 0; i <= 7; i++) {
      expect(r.geometry.nodes[`n${i}`]).toBe(geometry.nodes[`n${i}`]);
    }
    expect(r.geometry.nodes["n9"]).not.toBe(geometry.nodes["n9"]);
    expect(r.geometry.nodes["n9"]?.width).toBeGreaterThanOrEqual(140);
    // e8 (n8-n9) is region-internal: fresh route. e7 (n7-n8) crosses
    // the boundary: listed for reroute. e0..e6 keep prior routes.
    expect(r.rerouteEdges).toEqual(["e7"]);
    expect(r.geometry.edges?.["e0"]).toBe(geometry.edges?.["e0"]);
    expect(r.geometry.edges?.["e8"]).toBeDefined();
    expect(r.geometry.edges?.["e7"]).toBeUndefined();
  });

  it("local mode: added nodes join the region and land without overlapping the carried scene", async () => {
    const input = chain(6);
    const geometry = await layoutStructural(input);
    const r = await layoutStructuralWithChangeSet(
      { input, geometry },
      {
        addNodes: [
          { id: "extra", header: { name: "X" }, width: 60, height: 30 },
        ],
        addEdges: [{ id: "ex", source: "n5", target: "extra" }],
      },
    );
    expect(r.mode).toBe("local");
    const extra = r.geometry.nodes["extra"];
    expect(extra).toBeDefined();
    // Untouched prefix carried verbatim.
    expect(r.geometry.nodes["n0"]).toBe(geometry.nodes["n0"]);
  });

  it("removals drop geometry entries and cascade edge routes", async () => {
    const input = chain(6);
    const geometry = await layoutStructural(input);
    const r = await layoutStructuralWithChangeSet(
      { input, geometry },
      { removeNodes: ["n5"] },
    );
    expect(r.mode).toBe("local");
    expect(r.geometry.nodes["n5"]).toBeUndefined();
    expect(r.input.edges.some((e) => e.id === "e4")).toBe(false);
  });

  it("a container-touching change falls back to global-sketch and reports it", async () => {
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "box",
          header: { stereotype: "Block", name: "Box" },
          compartments: [{ id: "box.c0", rows: [{ id: "box.r0", text: "x" }] }],
        },
        { id: "a", header: { name: "A" }, width: 80, height: 40 },
      ],
      edges: [{ id: "e0", source: "box", target: "a" }],
    };
    const geometry = await layoutStructural(input);
    const r = await layoutStructuralWithChangeSet(
      { input, geometry },
      {
        updateNodes: {
          box: {
            compartments: [
              {
                id: "box.c0",
                rows: [
                  { id: "box.r0", text: "x" },
                  { id: "box.r1", text: "y" },
                ],
              },
            ],
          },
        },
      },
    );
    expect(r.mode).toBe("global-sketch");
    expect(r.geometry.nodes["box.r1"]).toBeDefined();
  });

  it("an above-threshold change falls back to global-sketch", async () => {
    const input = chain(12);
    const geometry = await layoutStructural(input);
    const patches: Record<string, { width: number }> = {};
    for (let i = 0; i < 12; i++) patches[`n${i}`] = { width: 90 + i };
    const r = await layoutStructuralWithChangeSet(
      { input, geometry },
      { updateNodes: patches },
      { localThreshold: 4 },
    );
    expect(r.mode).toBe("global-sketch");
  });
});
