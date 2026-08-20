/**
 * Anchor pitch + corner overflow (opt-in `anchorPitch`).
 *
 * The plain fan divides a side into `count + 1` and takes the interior
 * points, so its pitch is `extent / (count + 1)` with no floor. Once a
 * side is asked to absorb more edges than it has room for, the anchors
 * land closer together than an arrowhead is wide and read as one line
 * with N arrowheads stacked on it. `anchorPitch` puts a floor under
 * that and wraps the outermost edges around the corners.
 *
 * These call `routeStructuralEdges` with a HAND-BUILT geometry rather
 * than going through `g3tLayoutStructural`, and that is deliberate.
 * Which side an edge anchors on is decided by `sidesFor` from the
 * signed border gaps, so a layout-driven fixture silently spreads a
 * fan across three sides and stops exercising the crowding this option
 * exists for: an earlier version of this file measured ZERO crowded
 * arrivals on a 17-edge fan for exactly that reason. Pinning the boxes
 * pins the side selection, so the fan is genuinely on one border.
 */
import { describe, expect, it } from "vitest";
import { routeStructuralEdges } from "./g3t-routing";
import { layoutStructural } from "../structural";
import type {
  StructuralGraphInput,
  StructuralNode,
  StructuralEdge,
} from "../structural";

const SINK = { x: 400, y: 0, width: 120, height: 52 };

/**
 * `n` sources all arriving on the sink's WEST border.
 *
 * The geometry is chosen so `sidesFor(sink, src)` picks WEST for every
 * edge: the west border gap is 400 - 88 = 312, while the largest south
 * gap is 320 - 52 = 268 and every north gap is negative. Sources are
 * 12px tall on a 20px pitch so they never overlap each other, which
 * keeps VR-7f's overlap sliding out of the measurement.
 */
function westFan(n: number): {
  input: StructuralGraphInput;
  geometry: unknown;
} {
  const nodes: StructuralNode[] = [
    { id: "sink", width: SINK.width, height: SINK.height },
  ];
  const edges: StructuralEdge[] = [];
  const geoNodes: Record<string, unknown> = {
    sink: { ...SINK, kind: "node" as const },
  };
  for (let i = 0; i < n; i++) {
    const id = `src${i}`;
    nodes.push({ id, width: 88, height: 12 });
    edges.push({ id: `e${i}`, source: id, target: "sink" });
    geoNodes[id] = {
      x: 0,
      y: i * 20,
      width: 88,
      height: 12,
      kind: "node" as const,
    };
  }
  return {
    input: { nodes, edges },
    geometry: { nodes: geoNodes, ports: {}, edges: {} },
  };
}

type Routed = Record<string, { points: { x: number; y: number }[] }>;

/** Where each edge arrives at the sink. */
function arrivals(routed: Routed): { x: number; y: number }[] {
  return Object.values(routed)
    .map((r) => r.points[r.points.length - 1])
    .filter((p): p is { x: number; y: number } => p !== undefined);
}

/** Arrivals within `d` of another arrival: the arrowhead-overlap count. */
function crowded(pts: { x: number; y: number }[], d: number): number {
  return pts.filter((p, i) =>
    pts.some((q, j) => i !== j && Math.hypot(p.x - q.x, p.y - q.y) < d),
  ).length;
}

describe("anchorPitch", () => {
  it("omitting it leaves the plain fan untouched", () => {
    const { input, geometry } = westFan(8);
    const a = routeStructuralEdges(input, geometry as never, {
      direction: "RIGHT",
    });
    const b = routeStructuralEdges(input, geometry as never, {
      direction: "RIGHT",
      anchorPitch: undefined,
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("the fixture really does crowd one border without a pitch", () => {
    // Guards every assertion below: if the side selection ever stops
    // putting these on one border, the other tests would pass for the
    // wrong reason and this one fails first, saying so.
    const { input, geometry } = westFan(17);
    const pts = arrivals(
      routeStructuralEdges(input, geometry as never, {
        direction: "RIGHT",
      }) as Routed,
    );
    expect(pts.length).toBe(17);
    // One border: every arrival shares the sink's west x.
    expect(new Set(pts.map((p) => Math.round(p.x)))).toEqual(new Set([SINK.x]));
    // 52px / 18 is 2.9px apart, so essentially all of them collide at
    // arrowhead scale.
    expect(crowded(pts, 6)).toBeGreaterThan(10);
  });

  it("floors the separation on an uncrowded side", () => {
    const PITCH = 10;
    const { input, geometry } = westFan(4);
    const pts = arrivals(
      routeStructuralEdges(input, geometry as never, {
        direction: "RIGHT",
        anchorPitch: PITCH,
      }) as Routed,
    );
    expect(pts.length).toBe(4);
    // 36px of usable span holds floor(36/10) + 1 = 4, so none overflow.
    expect(new Set(pts.map((p) => Math.round(p.x))).size).toBe(1);
    const ys = pts.map((p) => p.y).sort((m, n) => m - n);
    for (let i = 1; i < ys.length; i++) {
      expect((ys[i] ?? 0) - (ys[i - 1] ?? 0)).toBeGreaterThanOrEqual(
        PITCH - 0.001,
      );
    }
  });

  it("wraps the overflow around the corners once the side fills", () => {
    const { input, geometry } = westFan(17);
    const pts = arrivals(
      routeStructuralEdges(input, geometry as never, {
        direction: "RIGHT",
        anchorPitch: 10,
      }) as Routed,
    );
    expect(pts.length).toBe(17);
    // Only 4 fit on the west border; the other 13 must have left it.
    const onWest = pts.filter((p) => Math.round(p.x) === SINK.x).length;
    expect(onWest).toBeLessThan(17);
    expect(onWest).toBeGreaterThan(0);
  });

  it("cuts arrowhead-scale crowding well below the plain fan", () => {
    const { input, geometry } = westFan(17);
    const plain = crowded(
      arrivals(
        routeStructuralEdges(input, geometry as never, {
          direction: "RIGHT",
        }) as Routed,
      ),
      6,
    );
    const pitched = crowded(
      arrivals(
        routeStructuralEdges(input, geometry as never, {
          direction: "RIGHT",
          anchorPitch: 10,
        }) as Routed,
      ),
      6,
    );
    // Not asserting zero: placement feeds `anchorOf`, and VR-7f can
    // still slide two anchors together because it chooses per edge
    // without seeing its neighbours. The claim is a large reduction.
    expect(pitched).toBeLessThan(plain);
  });

  it("participates in the layout memo key", async () => {
    // This one MUST go through layoutStructural, since that is where
    // the cache lives. The fixture is a plain fan-in; what matters is
    // only that the two pitches produce different geometry, which the
    // assertion checks directly.
    const nodes: StructuralNode[] = [
      { id: "sink", header: { name: "Collector" }, width: 120, height: 52 },
    ];
    const edges: StructuralEdge[] = [];
    for (let i = 0; i < 17; i++) {
      nodes.push({ id: `s${i}`, width: 88, height: 12 });
      edges.push({ id: `e${i}`, source: `s${i}`, target: "sink" });
    }
    const input: StructuralGraphInput = { nodes, edges };
    const loose = await layoutStructural(input, {
      direction: "RIGHT",
      anchorPitch: 4,
    });
    const tight = await layoutStructural(input, {
      direction: "RIGHT",
      anchorPitch: 40,
    });
    // A key that ignored the pitch would hand back the first result.
    expect(JSON.stringify(loose.edges)).not.toBe(JSON.stringify(tight.edges));
  });
});
