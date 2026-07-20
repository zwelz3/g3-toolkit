/**
 * Hit-test oracles (G3L:RND-006): shape-aware bodies, glyph zones
 * outranking bodies, topmost-by-paint-order, edge segments with
 * width-aware tolerance; structural header/body/border bands, rows,
 * ports, routed segments.
 */
import { describe, expect, it } from "vitest";
import type { VisualAttributes } from "@g3t/core";
import { hitTestScene, hitTestStructural } from "./hit-test";
import type {
  StructuralGeometry,
  StructuralGraphInput,
} from "../layout/structural";

describe("hitTestScene", () => {
  const nodes = [
    { id: "under", x: 100, y: 100, width: 60, height: 60 },
    { id: "over", x: 120, y: 100, width: 60, height: 60 },
    { id: "dia", x: 300, y: 100, width: 40, height: 40 },
  ];
  const edges = [{ id: "e", source: "under", target: "dia" }];
  const resolved = new Map<string, VisualAttributes>([
    [
      "over",
      { shape: "rectangle", glyphs: [{ slot: "top-right", text: "3" }] },
    ],
    ["dia", { shape: "diamond" }],
    ["e", { strokeWidth: 2 }],
  ]);
  const scene = { nodes, edges, resolved };

  it("topmost wins where nodes overlap (later scene order paints above)", () => {
    // x=115 lies inside both; "over" is later.
    expect(hitTestScene(scene, { x: 115, y: 100 })?.elementId).toBe("over");
  });

  it("glyph zone outranks body and names the slot", () => {
    // over's top-right glyph: x = 120 + 0.7*30 = 141, y = 100 - 21 = 79.
    const hit = hitTestScene(scene, { x: 141, y: 79 });
    expect(hit).toEqual({
      elementId: "over",
      kind: "node",
      zone: "glyph",
      glyphSlot: "top-right",
    });
  });

  it("shape-aware: a diamond's corner square is a miss, its center a hit", () => {
    // Corner of the bounding box, outside the diamond.
    expect(hitTestScene(scene, { x: 318, y: 82 })).toBeNull();
    expect(hitTestScene(scene, { x: 300, y: 100 })?.elementId).toBe("dia");
  });

  it("edge segments hit within width-aware tolerance, and only there", () => {
    // Midpoint of under(100,100)->dia(300,100) is (200,100); the
    // segment is horizontal.
    expect(hitTestScene(scene, { x: 200, y: 103 })).toEqual({
      elementId: "e",
      kind: "edge",
      zone: "segment",
    });
    expect(hitTestScene(scene, { x: 200, y: 112 })).toBeNull();
  });
});

describe("hitTestStructural", () => {
  const input: StructuralGraphInput = {
    nodes: [
      {
        id: "box",
        header: { stereotype: "Block", name: "Box" },
        compartments: [{ id: "box.c0", rows: [{ id: "r1", text: "x" }] }],
      },
      { id: "plain", header: { name: "P" }, width: 100, height: 40 },
    ],
    edges: [{ id: "e1", source: "box", target: "plain" }],
  };
  const geometry: StructuralGeometry = {
    version: 1,
    headerHeight: 24,
    nodes: {
      box: { x: 0, y: 0, width: 200, height: 120, kind: "container" },
      r1: {
        x: 8,
        y: 40,
        width: 184,
        height: 16,
        kind: "row",
        parent: "box",
        text: "x",
      },
      plain: { x: 300, y: 20, width: 100, height: 40, kind: "node" },
    },
    ports: {
      p1: { node: "box", side: "EAST", x: 196, y: 60, width: 8, height: 8 },
    },
    edges: {
      e1: {
        points: [
          { x: 204, y: 64 },
          { x: 300, y: 64 },
        ],
      },
    },
  };

  it("resolves header vs body vs border on a container", () => {
    expect(hitTestStructural(input, geometry, { x: 100, y: 12 })?.zone).toBe(
      "header",
    );
    expect(hitTestStructural(input, geometry, { x: 100, y: 100 })?.zone).toBe(
      "body",
    );
    expect(hitTestStructural(input, geometry, { x: 2, y: 60 })).toEqual({
      elementId: "box",
      kind: "node",
      zone: "border",
    });
  });

  it("rows outrank the container body they sit in", () => {
    expect(hitTestStructural(input, geometry, { x: 100, y: 48 })).toEqual({
      elementId: "r1",
      kind: "row",
      zone: "row",
    });
  });

  it("ports outrank everything; routed edge segments hit on the polyline", () => {
    expect(hitTestStructural(input, geometry, { x: 200, y: 64 })?.kind).toBe(
      "port",
    );
    expect(hitTestStructural(input, geometry, { x: 250, y: 66 })).toEqual({
      elementId: "e1",
      kind: "edge",
      zone: "segment",
    });
  });

  it("misses are null, not nearest-element guesses", () => {
    expect(hitTestStructural(input, geometry, { x: 260, y: 200 })).toBeNull();
  });
});
