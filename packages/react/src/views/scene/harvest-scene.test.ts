/**
 * harvestSceneFromCy oracles (G3L Round 46): computed styles from a
 * live-shaped instance land in the adapters' channel vocabulary.
 */
import { describe, expect, it } from "vitest";
import { harvestSceneFromCy } from "./harvest-scene";

function fakeNode(
  id: string,
  pos: { x: number; y: number },
  styles: Record<string, string>,
  data: Record<string, string> = {},
) {
  return {
    id: () => id,
    position: () => pos,
    width: () => 40,
    height: () => 30,
    style: (k: string) => styles[k],
    data: (k: string) => data[k],
  };
}
function fakeEdge(
  id: string,
  source: string,
  target: string,
  styles: Record<string, string>,
) {
  return {
    id: () => id,
    source: () => ({ id: () => source }),
    target: () => ({ id: () => target }),
    style: (k: string) => styles[k],
  };
}
function fakeCy(nodes: unknown[], edges: unknown[]) {
  return {
    nodes: () => ({
      forEach: (fn: (n: unknown) => void) => nodes.forEach(fn),
    }),
    edges: () => ({
      forEach: (fn: (e: unknown) => void) => edges.forEach(fn),
    }),
  };
}

describe("harvestSceneFromCy", () => {
  it("lifts positions, sizes, fills, labels, and edge channels", () => {
    const cy = fakeCy(
      [
        fakeNode(
          "a",
          { x: 10, y: 20 },
          {
            "background-color": "#123456",
            "border-color": "#654321",
            "border-width": "2",
            label: "Alpha",
            color: "#eeeeee",
          },
        ),
        fakeNode("b", { x: 90, y: 20 }, {}, { label: "Beta" }),
      ],
      [
        fakeEdge("e", "a", "b", {
          "line-color": "#abcdef",
          width: "3",
          "line-style": "dashed",
        }),
      ],
    );
    const scene = harvestSceneFromCy(cy as never);
    expect(scene.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(scene.nodes[0]).toMatchObject({ x: 10, y: 20, width: 40 });
    const a = scene.resolved.get("a")!;
    expect(a.fill).toBe("#123456");
    expect(a.stroke).toBe("#654321");
    expect(a.strokeWidth).toBe(2);
    expect(a.labelText).toBe("Alpha");
    expect(a.labelColor).toBe("#eeeeee");
    expect(a.labelHalo).toBeDefined(); // the MR-11 dark-shell default
    const b = scene.resolved.get("b")!;
    expect(b.labelText).toBe("Beta"); // data fallback when no style label
    const e = scene.resolved.get("e")!;
    expect(e.stroke).toBe("#abcdef");
    expect(e.strokeWidth).toBe(3);
    expect(e.strokeDash).toEqual([8, 4]);
  });

  it("skips display:none elements and edges to hidden endpoints", () => {
    const cy = fakeCy(
      [
        fakeNode("a", { x: 0, y: 0 }, {}),
        fakeNode("h", { x: 5, y: 5 }, { display: "none" }),
      ],
      [fakeEdge("e", "a", "h", {})],
    );
    const scene = harvestSceneFromCy(cy as never);
    expect(scene.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(scene.edges).toEqual([]);
  });
});
