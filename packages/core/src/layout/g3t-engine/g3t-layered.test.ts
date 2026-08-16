/**
 * g3t engine D1 oracles + the QLT-002 two-engine comparison.
 *
 * Per-phase pins: cycle removal yields a DAG; layering respects
 * every (possibly reversed) edge; ordering never increases
 * crossings and respects its budget; placement never overlaps
 * within a layer; emission is deterministic to the byte. The
 * comparison harness runs BOTH engines over identical flat fixtures
 * and reports metrics side by side (bands come at D3; D1 asserts
 * only sanity and reports the numbers).
 */
import { describe, expect, it } from "vitest";
import type { StructuralGraphInput } from "../structural";
import { layoutStructural } from "../structural";
import {
  assignLayers,
  g3tLayoutFlat,
  layersFor,
  orderLayers,
  placeBrandesKoepf,
  placeNodes,
  removeCycles,
} from "./g3t-layered";

function flatFixture(seed: number, n: number, m: number): StructuralGraphInput {
  let a = seed >>> 0;
  const rand = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const nodes = Array.from({ length: n }).map((_, i) => ({
    id: `n${i}`,
    header: { name: `N${i}` },
    width: 60 + Math.floor(rand() * 80),
    height: 30 + Math.floor(rand() * 30),
  }));
  const edges = Array.from({ length: m }).map((_, i) => {
    const s = Math.floor(rand() * n);
    let t = Math.floor(rand() * n);
    if (t === s) t = (t + 1) % n;
    return { id: `e${i}`, source: `n${s}`, target: `n${t}` };
  });
  return { nodes, edges };
}

const FLAT = flatFixture(7101, 40, 70);
const FLAT_NODES = FLAT.nodes.map((n) => ({
  id: n.id,
  width: n.width ?? 100,
  height: n.height ?? 44,
}));
const FLAT_EDGES = FLAT.edges.map((e) => ({
  id: e.id,
  source: e.source,
  target: e.target,
}));

describe("g3t engine phases (D1)", () => {
  it("cycle removal yields an acyclic orientation", () => {
    const reversed = removeCycles(FLAT_NODES, FLAT_EDGES);
    // Kahn over the oriented graph must consume every node.
    const indeg = new Map<string, number>(FLAT_NODES.map((n) => [n.id, 0]));
    const succ = new Map<string, string[]>(
      FLAT_NODES.map((n) => [n.id, []] as const),
    );
    for (const e of FLAT_EDGES) {
      const [s, t] = reversed.has(e.id)
        ? [e.target, e.source]
        : [e.source, e.target];
      succ.get(s)?.push(t);
      indeg.set(t, (indeg.get(t) ?? 0) + 1);
    }
    const q = FLAT_NODES.map((n) => n.id).filter(
      (id) => (indeg.get(id) ?? 0) === 0,
    );
    let seen = 0;
    while (q.length > 0) {
      const id = q.pop();
      if (id === undefined) break;
      seen++;
      for (const t of succ.get(id) ?? []) {
        indeg.set(t, (indeg.get(t) ?? 1) - 1);
        if (indeg.get(t) === 0) q.push(t);
      }
    }
    expect(seen).toBe(FLAT_NODES.length);
  });

  it("layering respects every oriented edge (source strictly above)", () => {
    const reversed = removeCycles(FLAT_NODES, FLAT_EDGES);
    const layer = assignLayers(FLAT_NODES, FLAT_EDGES, reversed);
    for (const e of FLAT_EDGES) {
      const [s, t] = reversed.has(e.id)
        ? [e.target, e.source]
        : [e.source, e.target];
      expect(layer.get(s)!).toBeLessThan(layer.get(t)!);
    }
  });

  it("ordering never worsens crossings and honors its sweep/budget caps", () => {
    const reversed = removeCycles(FLAT_NODES, FLAT_EDGES);
    const layer = assignLayers(FLAT_NODES, FLAT_EDGES, reversed);
    const one = orderLayers(FLAT_NODES, FLAT_EDGES, reversed, layer, {
      maxSweeps: 1,
      orderingBudgetMs: 10_000,
    });
    const many = orderLayers(FLAT_NODES, FLAT_EDGES, reversed, layer, {
      maxSweeps: 8,
      orderingBudgetMs: 10_000,
    });
    expect(many.crossings).toBeLessThanOrEqual(one.crossings);
    // Budget cap: a zero-ms budget returns immediately with a valid
    // (initial) ordering rather than blowing time.
    const t0 = Date.now();
    const capped = orderLayers(FLAT_NODES, FLAT_EDGES, reversed, layer, {
      maxSweeps: 8,
      orderingBudgetMs: 0,
    });
    expect(Date.now() - t0).toBeLessThan(500);
    expect(capped.layers.flat().sort()).toEqual(
      FLAT_NODES.map((n) => n.id).sort(),
    );
  });

  it("placement never overlaps within a layer", () => {
    const reversed = removeCycles(FLAT_NODES, FLAT_EDGES);
    const layer = assignLayers(FLAT_NODES, FLAT_EDGES, reversed);
    const { layers } = orderLayers(FLAT_NODES, FLAT_EDGES, reversed, layer);
    const x = placeNodes(FLAT_NODES, FLAT_EDGES, reversed, layers, 24);
    const width = new Map(FLAT_NODES.map((n) => [n.id, n.width] as const));
    for (const l of layers) {
      for (let i = 0; i + 1 < l.length; i++) {
        const a = l[i]!;
        const b = l[i + 1]!;
        const rightOfA = x.get(a)! + width.get(a)! / 2;
        const leftOfB = x.get(b)! - width.get(b)! / 2;
        expect(leftOfB).toBeGreaterThanOrEqual(rightOfA);
      }
    }
  });

  it("emission is deterministic to the byte", () => {
    // The layout is ANYTIME: crossing-minimization and network
    // simplex both stop on a wall-clock budget, so two runs on a
    // differently-loaded machine can legitimately stop at different
    // sweeps and emit different (equally valid) coordinates. This
    // assertion is about ALGORITHMIC determinism, so the budgets
    // are pinned generously here; without pinning the test flakes
    // under CPU pressure, which is exactly how it surfaced (an
    // unrelated test added to this file shifted the timing).
    const pinned = {
      orderingBudgetMs: 60_000,
      networkSimplexBudgetMs: 60_000,
      maxSweeps: 8,
    };
    const a = JSON.stringify(g3tLayoutFlat(FLAT, pinned));
    const b = JSON.stringify(g3tLayoutFlat(flatFixture(7101, 40, 70), pinned));
    expect(a).toBe(b);
  });
});

describe("engine seam + D2a structural", () => {
  const withContainer: StructuralGraphInput = {
    nodes: [
      {
        id: "box",
        header: { stereotype: "Block", name: "Box" },
        compartments: [
          {
            id: "c0",
            title: "values",
            rows: [
              { id: "r0", text: "mass: kg" },
              { id: "r1", text: "power: W" },
            ],
          },
        ],
        ports: [
          { id: "p.out", side: "EAST" },
          { id: "p.in", side: "WEST" },
        ],
      },
      { id: "a", header: { name: "A" }, width: 80, height: 40 },
      { id: "b", header: { name: "B" }, width: 80, height: 40 },
    ],
    edges: [
      { id: "e0", source: "box", target: "a" },
      { id: "e1", source: "a", target: "b" },
    ],
  };

  it("flat inputs run in-house with routed edges (D3a), no rows", async () => {
    const flat = await layoutStructural(FLAT);
    expect(flat.headerHeight).toBeGreaterThanOrEqual(0);
    expect(Object.values(flat.nodes).some((n) => n.kind === "row")).toBe(false);
    expect(Object.keys(flat.nodes).length).toBe(FLAT.nodes.length);
    // D3a: every simple edge carries a routed polyline of >= 2
    // points with finite coordinates.
    const routed = Object.values(flat.edges ?? {});
    expect(routed.length).toBe(
      FLAT.edges.filter((e) => e.source !== e.target).length,
    );
    for (const r of routed) {
      expect(r.points.length).toBeGreaterThanOrEqual(2);
      for (const p of r.points) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
    // Routing off stays honored.
    const bare = await layoutStructural(FLAT, {
      routeEdges: false,
    });
    expect(Object.keys(bare.edges ?? {}).length).toBe(0);
  });

  it("D2a: containers stack rows below the header with zero gaps at the shared width", async () => {
    const g = await layoutStructural(withContainer);
    const box = g.nodes["box"];
    expect(box?.kind).toBe("container");
    expect(g.headerHeight).toBeGreaterThan(0);
    // Rows: title divider + two rows, all present, stacked with zero
    // gaps starting at the header strip, sharing the container width.
    const rowIds = Object.entries(g.nodes)
      .filter(([, n]) => n.kind === "row" && n.parent === "box")
      .map(([id]) => id);
    expect(rowIds.length).toBe(3);
    const rows = rowIds
      .map((id) => g.nodes[id])
      .filter((r): r is NonNullable<typeof r> => r !== undefined)
      .sort((p, q) => p.y - q.y);
    expect(rows[0]?.y).toBeCloseTo((box?.y ?? 0) + g.headerHeight, 5);
    for (let i = 0; i + 1 < rows.length; i++) {
      const cur = rows[i];
      const nxt = rows[i + 1];
      expect(nxt?.y).toBeCloseTo((cur?.y ?? 0) + (cur?.height ?? 0), 5);
      expect(cur?.width).toBe(box?.width);
    }
    // Container height closes exactly over header + rows.
    const last = rows[rows.length - 1];
    expect((last?.y ?? 0) + (last?.height ?? 0)).toBeCloseTo(
      (box?.y ?? 0) + (box?.height ?? 0),
      5,
    );
  });

  it("D2a/LR-19: declared ports MOUNT on the border and sit fully OUTSIDE", async () => {
    // Contract updated by owner ruling (review 2026-07-22, LR-19):
    // the old centered-on-border placement straddled the container
    // half-in; ports now touch the border and extend outward.
    const g = await layoutStructural(withContainer);
    const box = at2(g.nodes["box"]);
    const out = at2(g.ports["p.out"]);
    expect(out.side).toBe("EAST");
    expect(out.x).toBeCloseTo(box.x + box.width, 5); // touches border
    expect(out.x).toBeGreaterThanOrEqual(box.x + box.width); // fully outside
    expect(out.y).toBeGreaterThan(box.y);
    expect(out.y).toBeLessThan(box.y + box.height);
    const inn = at2(g.ports["p.in"]);
    expect(inn.side).toBe("WEST");
    expect(inn.x + inn.width).toBeCloseTo(box.x, 5); // touches border
  });

  it("D2a: a sketch warm-starts ordering (prior left-to-right order is preserved)", async () => {
    // Three siblings in one layer fed a REVERSED sketch order: the
    // warm start must keep the sketch's order (one refinement sweep
    // has no crossing reason to change an edgeless layer).
    const siblings: StructuralGraphInput = {
      nodes: ["s1", "s2", "s3"].map((id) => ({
        id,
        header: { name: id },
        width: 60,
        height: 30,
      })),
      edges: [],
    };
    // DOWN flow: cross axis is x; sketch x order must survive.
    const down = await layoutStructural(siblings, {
      direction: "DOWN",
      sketch: {
        s1: { x: 900, y: 0 },
        s2: { x: 500, y: 0 },
        s3: { x: 100, y: 0 },
      },
    });
    const xs = ["s1", "s2", "s3"].map((id) => at2(down.nodes[id]).x);
    expect(xs[2]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[0]!);
    // RIGHT flow (default): cross axis is y; sketch y order must
    // survive there instead.
    const right = await layoutStructural(siblings, {
      sketch: {
        s1: { x: 0, y: 900 },
        s2: { x: 0, y: 500 },
        s3: { x: 0, y: 100 },
      },
    });
    const ys = ["s1", "s2", "s3"].map((id) => at2(right.nodes[id]).y);
    expect(ys[2]).toBeLessThan(ys[1]!);
    expect(ys[1]).toBeLessThan(ys[0]!);
  });
});

function at2<T>(v: T | undefined): T {
  if (v === undefined) throw new Error("missing");
  return v;
}

describe("QLT-002 conformance corpus (D3a bands)", () => {
  interface Metrics {
    area: number;
    meanEdgeLen: number;
    crossings: number;
  }
  const segIntersect = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
    d: { x: number; y: number },
  ): boolean => {
    const o = (
      p: { x: number; y: number },
      q: { x: number; y: number },
      r: { x: number; y: number },
    ): number =>
      Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    return (
      o(a, b, c) !== o(a, b, d) &&
      o(c, d, a) !== o(c, d, b) &&
      o(a, b, c) !== 0 &&
      o(c, d, a) !== 0
    );
  };
  const metricsOf = (
    fixture: StructuralGraphInput,
    geo: {
      nodes: Record<
        string,
        { x: number; y: number; width: number; height: number; kind?: string }
      >;
    },
  ): Metrics => {
    let x1 = Infinity;
    let y1 = Infinity;
    let x2 = -Infinity;
    let y2 = -Infinity;
    for (const g of Object.values(geo.nodes)) {
      if (g.kind === "row") continue;
      x1 = Math.min(x1, g.x);
      y1 = Math.min(y1, g.y);
      x2 = Math.max(x2, g.x + g.width);
      y2 = Math.max(y2, g.y + g.height);
    }
    const center = (id: string): { x: number; y: number } => {
      const g = geo.nodes[id];
      return g === undefined
        ? { x: 0, y: 0 }
        : { x: g.x + g.width / 2, y: g.y + g.height / 2 };
    };
    const segs = fixture.edges
      .filter((e) => e.source !== e.target)
      .map((e) => ({ a: center(e.source), b: center(e.target) }));
    let len = 0;
    for (const sgm of segs)
      len += Math.hypot(sgm.b.x - sgm.a.x, sgm.b.y - sgm.a.y);
    let crossings = 0;
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const p = segs[i];
        const q = segs[j];
        if (
          p !== undefined &&
          q !== undefined &&
          segIntersect(p.a, p.b, q.a, q.b)
        ) {
          crossings++;
        }
      }
    }
    return {
      area: (x2 - x1) * (y2 - y1),
      meanEdgeLen: segs.length === 0 ? 0 : len / segs.length,
      crossings,
    };
  };
  const structuralFixture = (): StructuralGraphInput => ({
    nodes: Array.from({ length: 14 }).map((_, i) => ({
      id: `c${i}`,
      header: { stereotype: "Block", name: `Block${i}` },
      compartments: [
        {
          id: `c${i}.v`,
          title: "values",
          rows: [
            { id: `c${i}.r0`, text: `mass${i}: kg` },
            { id: `c${i}.r1`, text: `p${i}: W` },
          ],
        },
      ],
    })),
    edges: Array.from({ length: 20 }).map((_, i) => ({
      id: `se${i}`,
      source: `c${i % 14}`,
      target: `c${(i * 5 + 3) % 14}`,
    })),
  });

  it("g3t stays within bands of the frozen elk baselines (crossings x2+8, area/edges x1.25)", async () => {
    // ELK BASELINES, FROZEN AT ITS REMOVAL (D3b part 1, 2026-07-19).
    // Measured on this corpus by the last two-engine run before
    // elkjs left the tree (elkjs 0.9.x, layered defaults, this
    // machine); the bands below assert against this RECORD, so the
    // quality contract survives the engine it was calibrated
    // against. Re-baselining requires an owner ruling.
    const ELK_BASELINE: Record<
      string,
      { area: number; meanEdgeLen: number; crossings: number }
    > = {
      "flat-30/50": { area: 6292983, meanEdgeLen: 754, crossings: 102 },
      "flat-60/100": { area: 18172024, meanEdgeLen: 1239, crossings: 398 },
      "flat-120/200": { area: 40087122, meanEdgeLen: 1935, crossings: 1417 },
      "structural-14/20": { area: 2924272, meanEdgeLen: 388, crossings: 0 },
    };
    const corpus: { name: string; fx: StructuralGraphInput }[] = [
      { name: "flat-30/50", fx: flatFixture(9101, 30, 50) },
      { name: "flat-60/100", fx: flatFixture(7202, 60, 100) },
      { name: "flat-120/200", fx: flatFixture(9303, 120, 200) },
      { name: "structural-14/20", fx: structuralFixture() },
    ];
    for (const { name, fx } of corpus) {
      const me = ELK_BASELINE[name];
      expect(me, `${name} baseline present`).toBeDefined();
      if (me === undefined) continue;
      const g3t = await layoutStructural(fx);
      const mg = metricsOf(fx, g3t);
      console.log(
        `QLT-002 ${name}: baseline area=${me.area} edge=${me.meanEdgeLen} X=${me.crossings}; g3t area=${Math.round(mg.area)} edge=${mg.meanEdgeLen.toFixed(0)} X=${mg.crossings}`,
      );
      expect(mg.crossings, `${name} crossings band`).toBeLessThanOrEqual(
        me.crossings * 2 + 8,
      );
      expect(mg.area, `${name} area band`).toBeLessThanOrEqual(me.area * 1.25);
      expect(mg.meanEdgeLen, `${name} edge band`).toBeLessThanOrEqual(
        me.meanEdgeLen * 1.25,
      );
      // Structural integrity: every input node placed, rows intact.
      for (const n of fx.nodes) {
        expect(g3t.nodes[n.id], `${name}: ${n.id} placed`).toBeDefined();
      }
    }
  }, 240_000);
});

describe("QLT-002 two-engine comparison (report; bands at D3)", () => {
  it("both engines lay out the shared flat fixture; metrics reported side by side", async () => {
    const fixture = flatFixture(7202, 60, 100);
    const elk = await layoutStructural(fixture, {});
    const g3t = g3tLayoutFlat(fixture);
    const metrics = (
      geo: Awaited<ReturnType<typeof layoutStructural>>,
    ): { area: number; meanEdgeLen: number } => {
      let x1 = Infinity;
      let y1 = Infinity;
      let x2 = -Infinity;
      let y2 = -Infinity;
      for (const g of Object.values(geo.nodes)) {
        x1 = Math.min(x1, g.x);
        y1 = Math.min(y1, g.y);
        x2 = Math.max(x2, g.x + g.width);
        y2 = Math.max(y2, g.y + g.height);
      }
      let len = 0;
      for (const e of fixture.edges) {
        const s = geo.nodes[e.source]!;
        const t = geo.nodes[e.target]!;
        len += Math.hypot(
          s.x + s.width / 2 - (t.x + t.width / 2),
          s.y + s.height / 2 - (t.y + t.height / 2),
        );
      }
      return {
        area: (x2 - x1) * (y2 - y1),
        meanEdgeLen: len / fixture.edges.length,
      };
    };
    const me = metrics(elk);
    const mg = metrics(g3t);
    console.log(
      `QLT-002 flat(60/100): elk area=${Math.round(me.area)} meanEdge=${me.meanEdgeLen.toFixed(0)}; g3t area=${Math.round(mg.area)} meanEdge=${mg.meanEdgeLen.toFixed(0)}`,
    );
    // D1 sanity only: both produced full geometry of positive extent.
    expect(Object.keys(g3t.nodes).length).toBe(fixture.nodes.length);
    expect(mg.area).toBeGreaterThan(0);
    expect(me.area).toBeGreaterThan(0);
  }, 60_000);
});

describe("D2b strategies", () => {
  it("network-simplex never exceeds tight-tree's total edge span (its defining property)", () => {
    const reversed = removeCycles(FLAT_NODES, FLAT_EDGES);
    const span = (layer: Map<string, number>): number => {
      let t = 0;
      for (const e of FLAT_EDGES) {
        const [s, tt] = reversed.has(e.id)
          ? [e.target, e.source]
          : [e.source, e.target];
        t += (layer.get(tt) ?? 0) - (layer.get(s) ?? 0);
      }
      return t;
    };
    const tight = layersFor(FLAT_NODES, FLAT_EDGES, reversed, {
      layering: "tight-tree",
    });
    const ns = layersFor(FLAT_NODES, FLAT_EDGES, reversed, {
      layering: "network-simplex",
    });
    // Validity first: every edge still descends.
    for (const e of FLAT_EDGES) {
      const [s, t] = reversed.has(e.id)
        ? [e.target, e.source]
        : [e.source, e.target];
      expect(ns.get(s)!).toBeLessThan(ns.get(t)!);
    }
    expect(span(ns)).toBeLessThanOrEqual(span(tight));
  });

  it("coffman-graham bounds every layer to the width and stays valid", () => {
    const reversed = removeCycles(FLAT_NODES, FLAT_EDGES);
    const cg = layersFor(FLAT_NODES, FLAT_EDGES, reversed, {
      layering: "coffman-graham",
      layerWidth: 5,
    });
    const perLayer = new Map<number, number>();
    for (const [, l] of cg) perLayer.set(l, (perLayer.get(l) ?? 0) + 1);
    for (const count of perLayer.values()) {
      expect(count).toBeLessThanOrEqual(5);
    }
    for (const e of FLAT_EDGES) {
      const [s, t] = reversed.has(e.id)
        ? [e.target, e.source]
        : [e.source, e.target];
      expect(cg.get(s)!).toBeLessThan(cg.get(t)!);
    }
  });

  it("brandes-koepf straightens a chain exactly and never overlaps", () => {
    // A pure path with one side branch: the chain must come out
    // pixel-straight under BK (median alignment forms one block).
    const chainNodes = ["a", "b", "c", "d"].map((id) => ({
      id,
      width: 80,
      height: 40,
    }));
    const branch = { id: "z", width: 80, height: 40 };
    const ns = [...chainNodes, branch];
    const es = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "c" },
      { id: "e3", source: "c", target: "d" },
      { id: "e4", source: "b", target: "z" },
    ];
    const reversed = removeCycles(ns, es);
    const layerOf = layersFor(ns, es, reversed, {});
    const { layers } = orderLayers(ns, es, reversed, layerOf);
    const x = placeBrandesKoepf(ns, es, reversed, layers, 24);
    // BK's actual guarantee: segments where all four alignments
    // agree balance to EXACT equality. b has even out-degree (c and
    // z), so the right-biased candidates legitimately pick z as its
    // median and the b-to-c link may average off-axis; a-b and c-d
    // agree across all four candidates and must be exact.
    expect(x.get("a")).toBeCloseTo(x.get("b")!, 5);
    expect(x.get("c")).toBeCloseTo(x.get("d")!, 5);
    // Overlap check on the shared layer (c and z).
    const cx = x.get("c")!;
    const zx = x.get("z")!;
    expect(Math.abs(cx - zx)).toBeGreaterThanOrEqual(80 + 24);

    // A PURE path (every degree odd) has one median everywhere: the
    // whole chain balances pixel-straight. The exactness pin.
    const pn = ["p1", "p2", "p3", "p4"].map((id) => ({
      id,
      width: 80,
      height: 40,
    }));
    const pe = [
      { id: "q1", source: "p1", target: "p2" },
      { id: "q2", source: "p2", target: "p3" },
      { id: "q3", source: "p3", target: "p4" },
    ];
    const prev = removeCycles(pn, pe);
    const pl = layersFor(pn, pe, prev, {});
    const { layers: pls } = orderLayers(pn, pe, prev, pl);
    const px = placeBrandesKoepf(pn, pe, prev, pls, 24);
    expect(px.get("p1")).toBeCloseTo(px.get("p2")!, 5);
    expect(px.get("p2")).toBeCloseTo(px.get("p3")!, 5);
    expect(px.get("p3")).toBeCloseTo(px.get("p4")!, 5);
  });
});

describe("D2b property sweep (multi-seed; guards nondeterminism and order-dependence)", () => {
  const seeds = [11, 23, 37, 41, 53, 67, 79, 83, 97, 101];
  it("NS validity + span dominance, CG width + validity, BK no-overlap hold across seeds", () => {
    for (const seed of seeds) {
      const fx = flatFixture(seed, 30, 55);
      const ns0 = fx.nodes.map((n) => ({
        id: n.id,
        width: n.width ?? 100,
        height: n.height ?? 44,
      }));
      const es0 = fx.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }));
      const reversed = removeCycles(ns0, es0);
      const span = (layer: Map<string, number>): number => {
        let t = 0;
        for (const e of es0) {
          const [s, tt] = reversed.has(e.id)
            ? [e.target, e.source]
            : [e.source, e.target];
          t += (layer.get(tt) ?? 0) - (layer.get(s) ?? 0);
        }
        return t;
      };
      const tight = layersFor(ns0, es0, reversed, { layering: "tight-tree" });
      const ns = layersFor(ns0, es0, reversed, {
        layering: "network-simplex",
      });
      const cg = layersFor(ns0, es0, reversed, {
        layering: "coffman-graham",
        layerWidth: 4,
      });
      for (const e of es0) {
        const [s, t] = reversed.has(e.id)
          ? [e.target, e.source]
          : [e.source, e.target];
        expect(ns.get(s)!, `seed ${seed} NS validity`).toBeLessThan(ns.get(t)!);
        expect(cg.get(s)!, `seed ${seed} CG validity`).toBeLessThan(cg.get(t)!);
      }
      expect(span(ns), `seed ${seed} NS span`).toBeLessThanOrEqual(span(tight));
      const perLayer = new Map<number, number>();
      for (const [, l] of cg) perLayer.set(l, (perLayer.get(l) ?? 0) + 1);
      for (const c of perLayer.values()) {
        expect(c, `seed ${seed} CG width`).toBeLessThanOrEqual(4);
      }
      const { layers } = orderLayers(ns0, es0, reversed, ns);
      const x = placeBrandesKoepf(ns0, es0, reversed, layers, 24);
      const widthOf = new Map(ns0.map((n) => [n.id, n.width] as const));
      for (const l of layers) {
        const sorted = [...l].sort((a, b) => (x.get(a) ?? 0) - (x.get(b) ?? 0));
        for (let i = 0; i + 1 < sorted.length; i++) {
          const a = sorted[i]!;
          const b = sorted[i + 1]!;
          const gap =
            (x.get(b) ?? 0) -
            (widthOf.get(b) ?? 0) / 2 -
            ((x.get(a) ?? 0) + (widthOf.get(a) ?? 0) / 2);
          expect(gap, `seed ${seed} BK overlap`).toBeGreaterThanOrEqual(
            24 - 1e-6,
          );
        }
      }
      // Determinism: identical inputs, identical bytes, per strategy.
      expect(
        JSON.stringify([...ns.entries()].sort()),
        `seed ${seed} NS determinism`,
      ).toBe(
        JSON.stringify(
          [
            ...layersFor(ns0, es0, reversed, {
              layering: "network-simplex",
            }).entries(),
          ].sort(),
        ),
      );
    }
  }, 60_000);
});

describe("LR-21: near-aligned pairs route STRAIGHT (snap pass)", () => {
  it("a 6px center offset collapses to a direct 2-point line; a large offset keeps its jog", async () => {
    const { routeStructuralEdges } = await import("./g3t-routing");
    const mk = (): StructuralGraphInput => ({
      nodes: [
        { id: "a", width: 120, height: 40 },
        { id: "b", width: 108, height: 40 },
      ],
      edges: [{ id: "e", source: "a", target: "b" }],
    });
    const geom = (dx: number) => ({
      nodes: {
        a: { x: 0, y: 0, width: 120, height: 40, kind: "node" as const },
        b: { x: dx, y: 120, width: 108, height: 40, kind: "node" as const },
      },
      ports: {},
      edges: {},
    });
    // Left-aligned stack: centers differ by (120-108)/2 = 6px.
    const near = routeStructuralEdges(mk(), geom(0) as never, {
      direction: "DOWN",
    });
    expect(near["e"]?.points).toHaveLength(2);
    // 80px offset: a legitimate jog stays.
    const far = routeStructuralEdges(mk(), geom(80) as never, {
      direction: "DOWN",
    });
    expect(far["e"]?.points.length ?? 0).toBeGreaterThan(2);
  });
});

describe("LR-16/17/20: port routing contracts (round B)", () => {
  it("routes approach ports along the port axis, terminate at the outer face, and clear their own box", async () => {
    const { routeStructuralEdges } = await import("./g3t-routing");
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "host",
          width: 120,
          height: 60,
          ports: [{ id: "host.south", side: "SOUTH" }],
        },
        { id: "peer", width: 80, height: 40 },
      ],
      edges: [
        { id: "e", source: "peer", target: "host", targetPort: "host.south" },
      ],
    };
    const geometry = {
      nodes: {
        host: { x: 200, y: 0, width: 120, height: 60, kind: "node" as const },
        peer: { x: 0, y: 10, width: 80, height: 40, kind: "node" as const },
      },
      // LR-19 placement: fully outside, mounted on the south border.
      ports: {
        "host.south": {
          node: "host",
          side: "SOUTH" as const,
          x: 254,
          y: 60,
          width: 12,
          height: 12,
        },
      },
      edges: {},
    };
    const routed = routeStructuralEdges(input, geometry as never, {
      direction: "RIGHT",
    });
    const pts = routed["e"]?.points ?? [];
    expect(pts.length).toBeGreaterThanOrEqual(3);
    const last = pts[pts.length - 1]!;
    const prev = pts[pts.length - 2]!;
    // LR-20: terminates at the port's OUTER face center (y = 72).
    expect(last.x).toBeCloseTo(260, 5);
    expect(last.y).toBeCloseTo(72, 5);
    // LR-17: the final approach runs along the port axis (vertical
    // into a SOUTH port, from below).
    expect(prev.x).toBeCloseTo(last.x, 5);
    expect(prev.y).toBeGreaterThan(last.y);
    // LR-16: no point of the route sits INSIDE the host box.
    for (const p of pts) {
      const inside = p.x > 200 && p.x < 320 && p.y > 0 && p.y < 60;
      expect(inside, `point ${p.x},${p.y} inside host`).toBe(false);
    }
  });
});

describe("VR-7d/e/f: route simplicity, vertical lock, overlap escape (owner re-verify 2026-07-28)", () => {
  const route = async (
    geometry: Record<
      string,
      { x: number; y: number; width: number; height: number }
    >,
    direction: "DOWN" | "RIGHT" = "DOWN",
  ) => {
    const { routeStructuralEdges } = await import("./g3t-routing");
    const nodes = Object.entries(geometry).map(([id, g]) => ({
      id,
      width: g.width,
      height: g.height,
    }));
    const geo = {
      nodes: Object.fromEntries(
        Object.entries(geometry).map(([id, g]) => [
          id,
          { ...g, kind: "node" as const },
        ]),
      ),
      ports: {},
      edges: {},
    };
    const input: StructuralGraphInput = {
      nodes,
      edges: [{ id: "e", source: "a", target: "b" }],
    };
    return routeStructuralEdges(input, geo as never, { direction })["e"]
      ?.points;
  };

  it("VR-7d+e: a near-aligned adjacent E/W pair collapses to a STRAIGHT line (not four bends)", async () => {
    // Face centers differ by 10px: within the snap; the old
    // flow-axis template gave this exact shape FOUR bends.
    const pts = await route({
      a: { x: 60, y: 40, width: 280, height: 150 },
      b: { x: 720, y: 50, width: 220, height: 150 },
    });
    expect(pts).toBeDefined();
    expect(pts?.length).toBe(2);
    expect(pts?.[0]?.y).toBeCloseTo(pts?.[1]?.y ?? NaN, 5);
  });

  it("VR-7e: a near-aligned stacked N/S pair locks to a straight vertical line", async () => {
    const pts = await route({
      a: { x: 100, y: 40, width: 200, height: 100 },
      b: { x: 108, y: 320, width: 200, height: 100 },
    });
    expect(pts).toBeDefined();
    expect(pts?.length).toBe(2);
    expect(pts?.[0]?.x).toBeCloseTo(pts?.[1]?.x ?? NaN, 5);
  });

  it("VR-7d: a clearly offset E/W pair takes the two-bend Z, nothing heavier", async () => {
    const pts = await route({
      a: { x: 60, y: 40, width: 280, height: 150 },
      b: { x: 720, y: 260, width: 220, height: 150 },
    });
    expect(pts).toBeDefined();
    // Straight-line count 2, one corner 3, a Z is 4 points; the
    // owner's four-bend shape was 6.
    expect(pts?.length ?? 99).toBeLessThanOrEqual(4);
  });

  it("VR-7f: a box dropped OVER the host's edge routes AWAY from the host", async () => {
    // b overlaps a's right edge (the OBC-over-SmallSat drop): the
    // largest border gap is EAST, so the route must leave a
    // eastward and never enter a's interior.
    const pts = await route({
      a: { x: 100, y: 100, width: 300, height: 160 },
      b: { x: 360, y: 140, width: 200, height: 100 },
    });
    expect(pts).toBeDefined();
    const first = pts?.[0];
    expect(first?.x).toBeCloseTo(400, 5); // a's EAST border
    for (const pt of pts ?? []) {
      const insideA = pt.x > 100 && pt.x < 400 && pt.y > 100 && pt.y < 260;
      expect(insideA, `${pt.x},${pt.y} inside the host`).toBe(false);
    }
  });
});

describe("VR-9: dense corridors detour instead of drawing through containers", () => {
  it("detourAround clears a full-height wall between the tips", async () => {
    const { detourAround } = await import("./g3t-routing");
    const near = [
      { id: "wall", x: 160, y: 0, width: 120, height: 300 },
      { id: "src", x: 0, y: 100, width: 120, height: 60 },
      { id: "tgt", x: 320, y: 100, width: 120, height: 60 },
    ];
    const pts = detourAround(
      { x: 120, y: 130 },
      { x: 134, y: 130 },
      { x: 320, y: 130 },
      { x: 306, y: 130 },
      near,
    );
    expect(pts).not.toBeNull();
    // The detour crosses OUTSIDE the wall's vertical span.
    const crossY = pts?.[2]?.y ?? NaN;
    expect(crossY < 0 - 15 || crossY > 300 + 15).toBe(true);
  });

  it("a five-box port chain (the IBD screenshot shape) never routes through intermediates", async () => {
    const { routeStructuralEdges } = await import("./g3t-routing");
    const boxes = {
      power: { x: 0, y: 120, width: 180, height: 70 },
      payload: { x: 240, y: 120, width: 160, height: 70 },
      obc: { x: 460, y: 120, width: 140, height: 70 },
      comms: { x: 660, y: 120, width: 170, height: 70 },
    };
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "power",
          width: 180,
          height: 70,
          ports: [{ id: "power.pout", side: "EAST" }],
        },
        { id: "payload", width: 160, height: 70 },
        { id: "obc", width: 140, height: 70 },
        {
          id: "comms",
          width: 170,
          height: 70,
          ports: [{ id: "comms.din", side: "WEST" }],
        },
      ],
      edges: [
        {
          id: "pw",
          source: "power",
          target: "comms",
          sourcePort: "power.pout",
          targetPort: "comms.din",
        },
      ],
    };
    const geometry = {
      nodes: Object.fromEntries(
        Object.entries(boxes).map(([id, g]) => [
          id,
          { ...g, kind: "node" as const },
        ]),
      ),
      ports: {
        "power.pout": { x: 174, y: 149, width: 12, height: 12, side: "EAST" },
        "comms.din": { x: 654, y: 149, width: 12, height: 12, side: "WEST" },
      },
      edges: {},
    };
    const pts = routeStructuralEdges(input, geometry as never, {
      direction: "RIGHT",
    })["pw"]?.points;
    expect(pts).toBeDefined();
    // No SEGMENT passes strictly through payload or obc.
    for (let i = 1; i < (pts ?? []).length; i++) {
      const a = pts?.[i - 1];
      const b = pts?.[i];
      if (!a || !b) continue;
      for (const [nid, box] of Object.entries(boxes)) {
        if (nid === "power" || nid === "comms") continue;
        const sx1 = Math.min(a.x, b.x);
        const sx2 = Math.max(a.x, b.x);
        const sy1 = Math.min(a.y, b.y);
        const sy2 = Math.max(a.y, b.y);
        const crosses =
          sx1 < box.x + box.width - 0.5 &&
          sx2 > box.x + 0.5 &&
          sy1 < box.y + box.height - 0.5 &&
          sy2 > box.y + 0.5;
        expect(crosses, `segment ${i} through ${nid}`).toBe(false);
      }
    }
  });
});

describe("R-4: target-first anchoring (upstream round 17)", () => {
  const manyToOne = (): {
    input: StructuralGraphInput;
    geometry: unknown;
  } => {
    // Four sources at spread heights converging on one sink; the
    // sources are ordered so that center-based sorting and
    // arrival-based sorting disagree.
    const srcIds = ["s1", "s2", "s3", "s4"];
    const input: StructuralGraphInput = {
      nodes: [
        ...srcIds.map((id) => ({ id, width: 120, height: 40 })),
        { id: "sink", width: 160, height: 220 },
      ],
      edges: srcIds.map((id) => ({
        id: `e.${id}`,
        source: id,
        target: "sink",
      })),
    };
    const ys = [40, 300, 120, 200];
    const geometry = {
      nodes: {
        ...Object.fromEntries(
          srcIds.map((id, i) => [
            id,
            {
              x: 40,
              y: ys[i] ?? 0,
              width: 120,
              height: 40,
              kind: "node" as const,
            },
          ]),
        ),
        sink: {
          x: 520,
          y: 100,
          width: 160,
          height: 220,
          kind: "node" as const,
        },
      },
      ports: {},
      edges: {},
    };
    return { input, geometry };
  };

  it("distributes arrivals across the sink's side (no stacking) under both modes", async () => {
    const { routeStructuralEdges } = await import("./g3t-routing");
    const { input, geometry } = manyToOne();
    for (const anchor of ["source", "target"] as const) {
      const routes = routeStructuralEdges(input, geometry as never, {
        direction: "RIGHT",
        anchor,
      });
      const arrivals = Object.values(routes)
        .map((r) => r.points[r.points.length - 1]?.y ?? 0)
        .sort((a, b) => a - b);
      const unique = new Set(arrivals.map((y) => Math.round(y)));
      expect(unique.size, `${anchor}: arrivals must not stack`).toBe(4);
    }
  });

  it("DISCRIMINATES: target-first differs from source-first and cuts bends (dense cross-connection)", async () => {
    // The v1.0.0 oracle for this option did NOT discriminate: it
    // passed under both modes, and a consumer measured 0 of 34
    // real views differing. Root cause: the second pass only
    // SORTED by the far end's assigned coordinate, and in a layered
    // scene the far boxes never overlap on the cross axis, so that
    // sort always reproduces the plain center order. This fixture
    // is complete-bipartite on purpose (every node degree 3, cross
    // axis interleaved) and asserts a real behavioral difference,
    // so the option cannot silently become a no-op again.
    const { routeStructuralEdges } = await import("./g3t-routing");
    const srcs = ["a", "b", "c"];
    const dsts = ["x", "y", "z"];
    const edges = srcs.flatMap((sid) =>
      dsts.map((d) => ({ id: `${sid}${d}`, source: sid, target: d })),
    );
    const ys: Record<string, number> = {
      a: 20,
      b: 400,
      c: 200,
      x: 300,
      y: 40,
      z: 160,
    };
    const input: StructuralGraphInput = {
      nodes: [...srcs, ...dsts].map((id) => ({
        id,
        width: 120,
        height: 160,
      })),
      edges,
    };
    const geometry = {
      nodes: Object.fromEntries(
        [...srcs, ...dsts].map((id) => [
          id,
          {
            x: srcs.includes(id) ? 40 : 700,
            y: ys[id] ?? 0,
            width: 120,
            height: 160,
            kind: "node" as const,
          },
        ]),
      ),
      ports: {},
      edges: {},
    };
    const run = (anchor: "source" | "target") =>
      routeStructuralEdges(input, geometry as never, {
        direction: "RIGHT",
        anchor,
      });
    const bySource = run("source");
    const byTarget = run("target");
    const differing = edges.filter(
      (e) =>
        JSON.stringify(bySource[e.id]?.points) !==
        JSON.stringify(byTarget[e.id]?.points),
    ).length;
    expect(differing, "the option must change routes").toBeGreaterThan(0);
    const bends = (r: Record<string, { points: unknown[] }>) =>
      edges.reduce(
        (n, e) => n + Math.max(0, (r[e.id]?.points.length ?? 2) - 2),
        0,
      );
    expect(bends(byTarget)).toBeLessThan(bends(bySource));
    // And departures never collide after the alignment spread.
    for (const node of srcs) {
      const ysOut = edges
        .filter((e) => e.source === node)
        .map((e) => Math.round(byTarget[e.id]?.points[0]?.y ?? 0));
      expect(new Set(ysOut).size, `${node}: departures must be distinct`).toBe(
        ysOut.length,
      );
    }
  });

  it("target-first orders arrivals MONOTONICALLY with the sources' own order", async () => {
    const { routeStructuralEdges } = await import("./g3t-routing");
    const { input, geometry } = manyToOne();
    const routes = routeStructuralEdges(input, geometry as never, {
      direction: "RIGHT",
      anchor: "target",
    });
    // Sources sorted by their own y; their arrival ys must be in
    // the same order (no crossing at the sink).
    const byY = ["s1", "s3", "s4", "s2"]; // ys 40,120,200,300
    const arrivals = byY.map(
      (id) =>
        routes[`e.${id}`]?.points[(routes[`e.${id}`]?.points.length ?? 1) - 1]
          ?.y ?? 0,
    );
    for (let i = 1; i < arrivals.length; i++) {
      expect(
        arrivals[i] ?? 0,
        `arrival ${i} must not cross its predecessor`,
      ).toBeGreaterThanOrEqual(arrivals[i - 1] ?? 0);
    }
  });
});

describe("congestion sizing (owner directive 2026-07-28 #2)", () => {
  it("a hub with six one-side attachments grows tall enough for the fan", async () => {
    const { g3tLayoutStructural } = await import("./g3t-structural");
    const spokes = ["s1", "s2", "s3", "s4", "s5", "s6"];
    const input: StructuralGraphInput = {
      nodes: [
        { id: "hub", width: 140, height: 44 },
        ...spokes.map((id) => ({ id, width: 120, height: 40 })),
      ],
      edges: spokes.map((id) => ({ id: `e.${id}`, source: id, target: "hub" })),
    };
    const geometry = g3tLayoutStructural(input, { direction: "RIGHT" });
    const hub = geometry.nodes["hub"];
    expect(hub).toBeDefined();
    // Six spokes: fan floor ceil(6/2)=3 -> >= 3*20+24 = 84 > the
    // declared 44. In practice all six land on the WEST side and
    // the tangent spread needs the height; assert the floor.
    expect(hub?.height ?? 0).toBeGreaterThanOrEqual(84);
  });

  it("declared E/W ports stretch the height exactly (five WEST ports)", async () => {
    const { g3tLayoutStructural } = await import("./g3t-structural");
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "blk",
          width: 160,
          height: 40,
          ports: [1, 2, 3, 4, 5].map((i) => ({
            id: `blk.p${i}`,
            side: "WEST" as const,
          })),
        },
      ],
      edges: [],
    };
    const geometry = g3tLayoutStructural(input, { direction: "RIGHT" });
    const blk = geometry.nodes["blk"];
    // 5 ports * 20 + 24 = 124.
    expect(blk?.height ?? 0).toBeGreaterThanOrEqual(124);
  });
});

describe("port pairs straighten within their own bodies (owner 2026-07-28)", () => {
  it("an E/W port pair with anchors 8px apart draws a straight line", async () => {
    const { routeStructuralEdges } = await import("./g3t-routing");
    const input: StructuralGraphInput = {
      nodes: [
        {
          id: "a",
          width: 150,
          height: 40,
          ports: [{ id: "a.out", side: "EAST" }],
        },
        {
          id: "b",
          width: 200,
          height: 120,
          ports: [{ id: "b.in", side: "WEST" }],
        },
      ],
      edges: [
        {
          id: "e",
          source: "a",
          target: "b",
          sourcePort: "a.out",
          targetPort: "b.in",
        },
      ],
    };
    const geometry = {
      nodes: {
        a: { x: 40, y: 120, width: 150, height: 40, kind: "node" as const },
        b: { x: 460, y: 90, width: 200, height: 120, kind: "node" as const },
      },
      ports: {
        // Anchor centers y=140 and y=148: 8px apart; the midpoint
        // 144 sits inside BOTH 12px port bodies.
        "a.out": { x: 184, y: 134, width: 12, height: 12, side: "EAST" },
        "b.in": { x: 454, y: 142, width: 12, height: 12, side: "WEST" },
      },
      edges: {},
    };
    const pts = routeStructuralEdges(input, geometry as never, {
      direction: "RIGHT",
    })["e"]?.points;
    expect(pts).toBeDefined();
    expect(pts?.length).toBe(2);
    expect(pts?.[0]?.y).toBeCloseTo(pts?.[1]?.y ?? NaN, 5);
  });
});

describe("VR-8: mixed pairs (box + port) straighten too", () => {
  it("the box anchor slides to the port's tangent (parametric bindings)", async () => {
    const { routeStructuralEdges } = await import("./g3t-routing");
    const input: StructuralGraphInput = {
      nodes: [
        { id: "a", width: 200, height: 120 },
        {
          id: "b",
          width: 180,
          height: 100,
          ports: [{ id: "b.p", side: "WEST" }],
        },
      ],
      edges: [{ id: "e", source: "a", target: "b", targetPort: "b.p" }],
    };
    // Port at b's WEST border, mid-height y=150; a's face center
    // y=144: delta 6, within the snap and inside a's span.
    const geometry = {
      nodes: {
        a: { x: 40, y: 84, width: 200, height: 120, kind: "node" as const },
        b: { x: 520, y: 100, width: 180, height: 100, kind: "node" as const },
      },
      ports: {
        "b.p": { x: 514, y: 144, width: 12, height: 12, side: "WEST" },
      },
      edges: {},
    };
    const pts = routeStructuralEdges(input, geometry as never, {
      direction: "RIGHT",
    })["e"]?.points;
    expect(pts).toBeDefined();
    // Straight: every point shares the port's y.
    const ys = new Set((pts ?? []).map((p) => Math.round(p.y)));
    expect(ys.size).toBe(1);
  });
});

describe("VR-7: adjacent boxes under DOWN flow (the BDD screenshots)", () => {
  it("takes the facing E/W sides and never crosses either endpoint block", async () => {
    const { routeStructuralEdges } = await import("./g3t-routing");
    const input: StructuralGraphInput = {
      nodes: [
        { id: "smallsat", width: 280, height: 150 },
        { id: "obc", width: 220, height: 110 },
      ],
      edges: [{ id: "comp", source: "smallsat", target: "obc" }],
    };
    // Horizontally adjacent, small vertical offset: image 1's shape.
    const geometry = {
      nodes: {
        smallsat: {
          x: 60,
          y: 40,
          width: 280,
          height: 150,
          kind: "node" as const,
        },
        obc: { x: 720, y: 70, width: 220, height: 110, kind: "node" as const },
      },
      ports: {},
      edges: {},
    };
    const routed = routeStructuralEdges(input, geometry as never, {
      direction: "DOWN",
    });
    const pts = routed["comp"]?.points ?? [];
    expect(pts.length).toBeGreaterThanOrEqual(2);
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    // VR-7b: facing sides: source anchors on its EAST border,
    // target on its WEST border (not top/bottom).
    expect(first.x).toBeCloseTo(60 + 280, 5);
    expect(last.x).toBeCloseTo(720, 5);
    // VR-7a: no interior point of the route sits INSIDE either block.
    const inside = (
      p: { x: number; y: number },
      b: { x: number; y: number; w: number; h: number },
    ) => p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h;
    for (const p of pts) {
      expect(
        inside(p, { x: 60, y: 40, w: 280, h: 150 }),
        `${p.x},${p.y} inside smallsat`,
      ).toBe(false);
      expect(
        inside(p, { x: 720, y: 70, w: 220, h: 110 }),
        `${p.x},${p.y} inside obc`,
      ).toBe(false);
    }
  });
});
