/**
 * PRF reference fixtures (spec section 14): seeded and
 * deterministic, per QLT-001's determinism doctrine.
 *
 *   R1 = 500 nodes / 800 edges / container structure (MBSE-scale)
 *   R2 = 5,000 nodes / 10,000 edges / flat
 *
 * R3 (50k/100k) is defined by the spec for the WebGL tier and is not
 * generated here until PRF-007 work begins.
 */
import type {
  RouteBox,
  StructuralGraphInput,
  StyleElement,
  StyleGraph,
} from "@g3t/core";

/** mulberry32: tiny seeded PRNG, deterministic across platforms. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** R1: 500 nodes (120 containers with header/compartments/rows, 380
 *  plain sized nodes), 800 edges. */
export function mkR1(): StructuralGraphInput {
  const rand = rng(4101);
  const nodes: StructuralGraphInput["nodes"] = [];
  for (let i = 0; i < 500; i++) {
    if (i < 120) {
      nodes.push({
        id: `n${i}`,
        header: { stereotype: "Block", name: `Block ${i}` },
        compartments: [
          {
            id: `n${i}.c0`,
            title: "values",
            rows: Array.from({ length: 2 + Math.floor(rand() * 3) }).map(
              (_, r) => ({ id: `n${i}.c0.r${r}`, text: `attr${r}: Real` }),
            ),
          },
          {
            id: `n${i}.c1`,
            title: "parts",
            rows: Array.from({ length: 1 + Math.floor(rand() * 2) }).map(
              (_, r) => ({ id: `n${i}.c1.r${r}`, text: `part${r}` }),
            ),
          },
        ],
      });
    } else {
      nodes.push({
        id: `n${i}`,
        header: { name: `Node ${i}` },
        width: 80 + Math.floor(rand() * 60),
        height: 36 + Math.floor(rand() * 24),
      });
    }
  }
  const edges: StructuralGraphInput["edges"] = [];
  for (let e = 0; e < 800; e++) {
    const s = Math.floor(rand() * 500);
    let t = Math.floor(rand() * 500);
    if (t === s) t = (t + 1) % 500;
    edges.push({ id: `e${e}`, source: `n${s}`, target: `n${t}` });
  }
  return { nodes, edges };
}

/** R2 style graph: 5,000 node elements + 10,000 edge elements with
 *  category/risk/weight data fields the rule set reads. */
export function mkR2Style(): StyleGraph {
  const rand = rng(4202);
  const elements: StyleElement[] = [];
  for (let i = 0; i < 5000; i++) {
    elements.push({
      id: `n${i}`,
      kind: "node",
      data: {
        category: ["hub", "leaf", "gateway"][Math.floor(rand() * 3)],
        riskLevel: rand() < 0.2 ? "high" : "low",
        degree: Math.floor(rand() * 40),
      },
    });
  }
  for (let e = 0; e < 10000; e++) {
    elements.push({
      id: `e${e}`,
      kind: "edge",
      data: {
        kind: rand() < 0.1 ? "critical" : "normal",
        weight: Math.floor(rand() * 100),
      },
    });
  }
  return { elements };
}

/** Boxes for the routing benchmark: a deterministic scatter of R1's
 *  top-level footprint (used when the full layout is not the thing
 *  being measured). */
export function mkR1Boxes(): { id: string; box: RouteBox }[] {
  const rand = rng(4303);
  const out: { id: string; box: RouteBox }[] = [];
  for (let i = 0; i < 500; i++) {
    out.push({
      id: `n${i}`,
      box: {
        x: rand() * 12000,
        y: rand() * 8000,
        width: 90 + rand() * 120,
        height: 40 + rand() * 120,
      },
    });
  }
  return out;
}
