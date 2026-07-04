/**
 * Seeded generator for the scale surface: a planted-partition graph
 * of 8,000 nodes in 40 communities of 200, with a small typed
 * vocabulary so the eventual drill-in view still color-codes
 * meaningfully. Deterministic (mulberry32 over SCALE_SEED): every
 * visitor, test run, and screenshot sees the same graph.
 */
import { UGM } from "@g3t/core";

export const SCALE_SEED = 20260704;
export const COMMUNITIES = 40;
export const COMMUNITY_SIZE = 200;

const TYPES = ["Asset", "Service", "Team", "Document", "System"] as const;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateScaleGraph(): UGM {
  const rng = mulberry32(SCALE_SEED);
  const ugm = new UGM();
  for (let c = 0; c < COMMUNITIES; c++) {
    for (let i = 0; i < COMMUNITY_SIZE; i++) {
      const type = TYPES[(c + i) % TYPES.length] ?? "Asset";
      ugm.addNode(`s${c}-${i}`, {
        types: [type],
        properties: { name: `${type} ${c}-${i}` },
      });
    }
  }
  for (let c = 0; c < COMMUNITIES; c++) {
    for (let i = 0; i < COMMUNITY_SIZE; i++) {
      // Dense inside the community: ~3 edges per node.
      for (let e = 0; e < 3; e++) {
        const j = Math.floor(rng() * COMMUNITY_SIZE);
        if (j !== i) {
          ugm.addEdge(`s${c}-${i}`, `s${c}-${j}`, { type: "relates" });
        }
      }
      // Sparse across communities: ~5% of nodes bridge out.
      if (rng() < 0.05) {
        const c2 = Math.floor(rng() * COMMUNITIES);
        if (c2 !== c) {
          ugm.addEdge(`s${c}-${i}`, `s${c2}-0`, { type: "bridges" });
        }
      }
    }
  }
  return ugm;
}
