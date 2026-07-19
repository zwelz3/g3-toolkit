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
    const a = JSON.stringify(g3tLayoutFlat(FLAT));
    const b = JSON.stringify(g3tLayoutFlat(flatFixture(7101, 40, 70)));
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

  it("D2a: declared ports sit centered on their declared side's border", async () => {
    const g = await layoutStructural(withContainer);
    const box = at2(g.nodes["box"]);
    const out = at2(g.ports["p.out"]);
    expect(out.side).toBe("EAST");
    expect(out.x + out.width / 2).toBeCloseTo(box.x + box.width, 5);
    expect(out.y).toBeGreaterThan(box.y);
    expect(out.y).toBeLessThan(box.y + box.height);
    const inn = at2(g.ports["p.in"]);
    expect(inn.side).toBe("WEST");
    expect(inn.x + inn.width / 2).toBeCloseTo(box.x, 5);
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
      // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
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
