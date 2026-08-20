/**
 * Routing Lab scenarios: adversarial structural graphs built to stress
 * the g3t layered engine's edge routing (gap router + grid escalation)
 * where it is known to be weakest. Each scenario is a pure, deterministic
 * generator (no randomness) so the same size always produces the same
 * graph, the layout cache holds, and tests can pin exact counts.
 *
 * The stress axes map to the documented engine gaps:
 * - long-span edges (no dummy chains yet: LAY-005) crossing many layers,
 * - many-to-one fan-in / fan-out (coincident Z-routes, lane separation),
 * - dense bipartite wiring (channel congestion between two layers),
 * - skip edges over obstacle grids (route-around, escalation ladder),
 * - declared-port edges including wrong-way attachments,
 * - interlocking cycles (cycle removal + back-edge routing).
 */
import type {
  StructuralGraphInput,
  StructuralNode,
  StructuralEdge,
} from "@g3t/core";

export type ScenarioSize = "S" | "M" | "L";

export interface RoutingScenario {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  /** What this scenario deliberately stresses, one phrase per bullet. */
  stresses: string[];
  /** Preferred flow direction for the layout. */
  direction: "RIGHT" | "DOWN";
  build(size: ScenarioSize): StructuralGraphInput;
}

function plain(id: string, label: string, w = 96, h = 44): StructuralNode {
  return { id, header: { name: label }, width: w, height: h };
}

function edge(
  id: string,
  source: string,
  target: string,
  extra?: Partial<StructuralEdge>,
): StructuralEdge {
  return { id, source, target, ...extra };
}

function sizeN(size: ScenarioSize, s: number, m: number, l: number): number {
  return size === "S" ? s : size === "M" ? m : l;
}

/** 1. Long-span gauntlet: a chain plus edges spanning many layers. */
const spanGauntlet: RoutingScenario = {
  id: "span-gauntlet",
  title: "Span Gauntlet",
  subtitle: "Edges spanning many layers over a populated rail",
  description:
    "Two parallel chains fix a deep layering, then long-span edges jump " +
    "from the first layers to the last. Without dummy chains (LAY-005) a " +
    "long edge is one straight run through every intermediate layer, so " +
    "the router must carry it around each populated layer's boxes.",
  stresses: [
    "long-span edges with no dummy chains",
    "detours around every intermediate layer",
    "escalation when the direct corridor is occupied",
  ],
  direction: "RIGHT",
  build(size) {
    const n = sizeN(size, 6, 10, 14);
    const nodes: StructuralNode[] = [];
    const edges: StructuralEdge[] = [];
    for (const rail of ["a", "b"]) {
      for (let i = 1; i <= n; i++) {
        nodes.push(plain(`${rail}${i}`, `${rail.toUpperCase()}-${i}`));
        if (i > 1) {
          edges.push(
            edge(`${rail}.chain${i}`, `${rail}${i - 1}`, `${rail}${i}`),
          );
        }
      }
    }
    // Long spans: first->last, first->middle, second->second-to-last,
    // and a cross-rail span. All jump >=2 layers.
    const mid = Math.ceil(n / 2);
    edges.push(edge("span.full", "a1", `a${n}`));
    edges.push(edge("span.half", "a1", `a${mid}`));
    edges.push(edge("span.late", "a2", `a${n - 1}`));
    edges.push(edge("span.cross1", "a1", `b${n}`));
    edges.push(edge("span.cross2", "b1", `a${n - 1}`));
    edges.push(edge("span.cross3", "b2", `b${n}`));
    return { nodes, edges };
  },
};

/** 2. Fan bus: wide fan-out into wide fan-in through one relay bank. */
const fanBus: RoutingScenario = {
  id: "fan-bus",
  title: "Fan-In Bus",
  subtitle: "One distributor, a relay bank, one collector",
  description:
    "A single distributor fans out to a bank of relays that all converge " +
    "on one collector, plus a direct bypass edge. Many edges share the " +
    "same two endpoints' neighborhoods, so their vertical runs want the " +
    "same corridor: the classic coincident-Z-route overlap.",
  stresses: [
    "many-to-one arrival spreading",
    "coincident parallel runs (lane separation)",
    "bypass edge across a crowded gap",
  ],
  direction: "RIGHT",
  build(size) {
    const k = sizeN(size, 8, 12, 16);
    const nodes: StructuralNode[] = [plain("dist", "Distributor", 120, 52)];
    const edges: StructuralEdge[] = [];
    for (let i = 1; i <= k; i++) {
      nodes.push(plain(`relay${i}`, `Relay ${i}`, 88, 36));
      edges.push(edge(`out${i}`, "dist", `relay${i}`));
      edges.push(edge(`in${i}`, `relay${i}`, "sink"));
    }
    nodes.push(plain("sink", "Collector", 120, 52));
    edges.push(edge("bypass", "dist", "sink"));
    // A few relay->relay shortcuts so the relay layer is not purely
    // parallel (forces intra-layer-adjacent routing).
    for (let i = 1; i + 2 <= k; i += 3) {
      edges.push(edge(`skip${i}`, `relay${i}`, `relay${i + 2}`));
    }
    return { nodes, edges };
  },
};

/** 3. Crossing storm: complete bipartite wiring between two layers. */
const crossingStorm: RoutingScenario = {
  id: "crossing-storm",
  title: "Crossing Storm",
  subtitle: "Complete bipartite K(n,n) between two layers",
  description:
    "Every source connects to every target: n² edges through one " +
    "layer gap. Crossings are unavoidable (K(3,3) upward), so the test " +
    "is how the router shares the channel: distinct tracks per run, " +
    "bends kept low, and no edge shoved through a box.",
  stresses: [
    "channel congestion in a single layer gap",
    "unavoidable crossing minimization",
    "track assignment for n² vertical runs",
  ],
  direction: "RIGHT",
  build(size) {
    const n = sizeN(size, 5, 6, 7);
    const nodes: StructuralNode[] = [];
    const edges: StructuralEdge[] = [];
    for (let i = 1; i <= n; i++) {
      nodes.push(plain(`src${i}`, `Source ${i}`, 96, 38));
      nodes.push(plain(`tgt${i}`, `Target ${i}`, 96, 38));
    }
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= n; j++) {
        edges.push(edge(`w${i}_${j}`, `src${i}`, `tgt${j}`));
      }
    }
    return { nodes, edges };
  },
};

/** 4. Obstacle maze: a block grid with skip edges over it. */
const obstacleMaze: RoutingScenario = {
  id: "obstacle-maze",
  title: "Obstacle Maze",
  subtitle: "Skip edges over a dense block grid",
  description:
    "A grid of chained blocks fills the plane, then skip edges cross " +
    "from the west face to the east face on different rows. Every " +
    "direct line is blocked by boxes, so each skip edge must thread the " +
    "gaps; a route through a box interior is a hard violation the " +
    "metrics panel counts.",
  stresses: [
    "obstacle avoidance across the whole scene",
    "corridor supply between grid rows",
    "violation detection (route through a box)",
  ],
  direction: "RIGHT",
  build(size) {
    const cols = sizeN(size, 5, 7, 9);
    const rows = 4;
    const nodes: StructuralNode[] = [];
    const edges: StructuralEdge[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nodes.push(plain(`g${r}_${c}`, `G${r}${c}`, 84, 40));
        if (c > 0) {
          edges.push(edge(`row${r}_${c}`, `g${r}_${c - 1}`, `g${r}_${c}`));
        }
      }
    }
    // Skip edges: west edge of one row to east edge of another row.
    edges.push(edge("skip.0", `g0_0`, `g3_${cols - 1}`));
    edges.push(edge("skip.1", `g3_0`, `g0_${cols - 1}`));
    edges.push(edge("skip.2", `g1_0`, `g2_${cols - 1}`));
    edges.push(edge("skip.3", `g2_1`, `g1_${cols - 2}`));
    // Vertical cross-row couplings mid-grid.
    const midC = Math.floor(cols / 2);
    edges.push(edge("tie.a", `g0_${midC}`, `g2_${midC}`));
    edges.push(edge("tie.b", `g1_${midC}`, `g3_${midC}`));
    return { nodes, edges };
  },
};

/** 5. Port storm: declared ports on all sides, wrong-way attachments. */
const portStorm: RoutingScenario = {
  id: "port-storm",
  title: "Port Storm",
  subtitle: "Declared ports on every side, some pointing the wrong way",
  description:
    "Compartmented containers declare ports on all four sides, and the " +
    "edges attach to them explicitly. Several attachments point AGAINST " +
    "the flow (an east port wired to a node further west), which forces " +
    "wrap-around routes the port's fixed side cannot help.",
  stresses: [
    "declared-port attachment (fixed sides)",
    "wrong-way ports forcing wrap-around routes",
    "compartmented containers as obstacles",
  ],
  direction: "RIGHT",
  build(size) {
    const banks = sizeN(size, 3, 4, 5);
    const nodes: StructuralNode[] = [];
    const edges: StructuralEdge[] = [];
    for (let i = 1; i <= banks; i++) {
      nodes.push({
        id: `unit${i}`,
        header: { stereotype: "unit", name: `Processing Unit ${i}` },
        compartments: [
          {
            id: `unit${i}.io`,
            title: "io",
            rows: [
              { id: `unit${i}.r1`, text: "ingest : Stream" },
              { id: `unit${i}.r2`, text: "emit : Stream" },
            ],
          },
        ],
        ports: [
          { id: `unit${i}.w`, side: "WEST" },
          { id: `unit${i}.e`, side: "EAST" },
          { id: `unit${i}.n`, side: "NORTH" },
          { id: `unit${i}.s`, side: "SOUTH" },
        ],
      });
    }
    nodes.push(plain("src", "Feed", 90, 40));
    nodes.push(plain("dst", "Drain", 90, 40));
    edges.push(edge("feed.1", "src", "unit1", { targetPort: "unit1.w" }));
    for (let i = 1; i < banks; i++) {
      edges.push(
        edge(`fwd${i}`, `unit${i}`, `unit${i + 1}`, {
          sourcePort: `unit${i}.e`,
          targetPort: `unit${i + 1}.w`,
        }),
      );
      // North/south lattice between neighbors.
      edges.push(
        edge(`lat${i}`, `unit${i}`, `unit${i + 1}`, {
          sourcePort: `unit${i}.n`,
          targetPort: `unit${i + 1}.n`,
        }),
      );
    }
    edges.push(
      edge("drain.1", `unit${banks}`, "dst", { sourcePort: `unit${banks}.e` }),
    );
    // Wrong-way: last unit's EAST port wired back to the first unit's
    // SOUTH port -- the route must leave east then wrap all the way back.
    edges.push(
      edge("wrap.back", `unit${banks}`, "unit1", {
        sourcePort: `unit${banks}.e`,
        targetPort: "unit1.s",
      }),
    );
    return { nodes, edges };
  },
};

/** 6. Cycle tangle: interlocking directed cycles. */
const cycleTangle: RoutingScenario = {
  id: "cycle-tangle",
  title: "Cycle Tangle",
  subtitle: "Interlocking directed cycles sharing nodes",
  description:
    "Rings that share nodes: cycle removal must reverse a subset of " +
    "edges to layer the graph at all, and every reversed edge renders " +
    "as a back edge flowing against the layout direction. Back edges " +
    "are the routes most likely to hug or pierce boxes.",
  stresses: [
    "cycle removal (edge reversal) under shared nodes",
    "back-edge routing against the flow",
    "feedback arcs across multiple layers",
  ],
  direction: "RIGHT",
  build(size) {
    const rings = sizeN(size, 3, 4, 5);
    const ringLen = 4;
    const nodes: StructuralNode[] = [];
    const edges: StructuralEdge[] = [];
    // Ring r has nodes n{r}_0..n{r}_3; consecutive rings share a node
    // (ring r's node 2 IS ring r+1's node 0) to interlock them.
    const nodeId = (r: number, i: number): string =>
      i === 0 && r > 0 ? `n${r - 1}_2` : `n${r}_${i}`;
    for (let r = 0; r < rings; r++) {
      for (let i = 0; i < ringLen; i++) {
        const id = nodeId(r, i);
        if (!nodes.some((nd) => nd.id === id)) {
          nodes.push(plain(id, id.toUpperCase(), 84, 40));
        }
      }
      for (let i = 0; i < ringLen; i++) {
        edges.push(
          edge(`c${r}_${i}`, nodeId(r, i), nodeId(r, (i + 1) % ringLen)),
        );
      }
    }
    // One long feedback arc from the last ring back to the first node.
    edges.push(edge("feedback", nodeId(rings - 1, 2), "n0_0"));
    return { nodes, edges };
  },
};

/** 7. Prune wall: an obstacle field past the router's 64-box prune
 *  threshold at EVERY size. */
const pruneWall: RoutingScenario = {
  id: "prune-wall",
  title: "Prune Wall",
  subtitle: "Skip edges over 72-120 obstacles (past the 64-box prune)",
  description:
    "A six-row block field with 72+ boxes at every size: past 64 " +
    "obstacles the grid router prunes to the terminal region and " +
    "verifies against the full set, so this is the regime where the " +
    "escalation ladder is most likely to fall back honestly. Skip " +
    "edges cross the whole field on interleaved rows, plus mid-field " +
    "vertical ties.",
  stresses: [
    "router obstacle count past the prune threshold",
    "corridor supply across a wide dense field",
    "escalation-ladder fallback behavior at scale",
  ],
  direction: "RIGHT",
  build(size) {
    const cols = sizeN(size, 12, 16, 20);
    const rows = 6;
    const nodes: StructuralNode[] = [];
    const edges: StructuralEdge[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nodes.push(plain(`p${r}_${c}`, `P${r}.${c}`, 78, 36));
        if (c > 0) {
          edges.push(edge(`prow${r}_${c}`, `p${r}_${c - 1}`, `p${r}_${c}`));
        }
      }
    }
    // Full-field skips on interleaved rows, both slants.
    edges.push(edge("pskip.0", "p0_0", `p5_${cols - 1}`));
    edges.push(edge("pskip.1", "p5_0", `p0_${cols - 1}`));
    edges.push(edge("pskip.2", "p1_0", `p4_${cols - 1}`));
    edges.push(edge("pskip.3", "p4_0", `p1_${cols - 1}`));
    edges.push(edge("pskip.4", "p2_0", `p3_${cols - 1}`));
    // Mid-field vertical ties at the third points.
    const t1 = Math.floor(cols / 3);
    const t2 = Math.floor((2 * cols) / 3);
    edges.push(edge("ptie.a", `p0_${t1}`, `p3_${t1}`));
    edges.push(edge("ptie.b", `p2_${t1}`, `p5_${t1}`));
    edges.push(edge("ptie.c", `p1_${t2}`, `p4_${t2}`));
    edges.push(edge("ptie.d", `p3_${t2}`, `p0_${t2}`));
    return { nodes, edges };
  },
};

/** 8. Counterflow ladder: one rail flows WITH the layout, the other
 *  entirely AGAINST it. */
const counterflowLadder: RoutingScenario = {
  id: "counterflow-ladder",
  title: "Counterflow Ladder",
  subtitle: "A whole rail of back edges, rungs across the flow",
  description:
    "Two rails joined by rungs, but rail B's chain edges all point " +
    "BACKWARD: cycle removal must reverse a whole rail's worth of " +
    "edges (or layer against them), and every reversed edge renders " +
    "as a back edge hugging the boxes it flows against. Diagonal " +
    "rungs in both slants keep the gap between the rails congested.",
  stresses: [
    "bulk edge reversal (a whole rail against the flow)",
    "back-edge routing pressed against the node rail",
    "rung congestion between two long rails",
  ],
  direction: "RIGHT",
  build(size) {
    const n = sizeN(size, 8, 12, 16);
    const nodes: StructuralNode[] = [];
    const edges: StructuralEdge[] = [];
    for (let i = 1; i <= n; i++) {
      nodes.push(plain(`fa${i}`, `FA-${i}`, 84, 38));
      nodes.push(plain(`fb${i}`, `FB-${i}`, 84, 38));
      if (i > 1) {
        // Rail A forward; rail B REVERSED (fb{i} -> fb{i-1}).
        edges.push(edge(`fa.chain${i}`, `fa${i - 1}`, `fa${i}`));
        edges.push(edge(`fb.chain${i}`, `fb${i}`, `fb${i - 1}`));
      }
      // Straight rung at every step.
      edges.push(edge(`rung${i}`, `fa${i}`, `fb${i}`));
    }
    // Diagonal rungs, both slants, staggered.
    for (let i = 1; i + 2 <= n; i += 2) {
      edges.push(edge(`slant.f${i}`, `fa${i}`, `fb${i + 2}`));
      edges.push(edge(`slant.b${i}`, `fb${i}`, `fa${i + 2}`));
    }
    return { nodes, edges };
  },
};

/** 9. Storm sandwich: two complete bipartite gaps back to back, plus
 *  long spans through both. */
const stormSandwich: RoutingScenario = {
  id: "storm-sandwich",
  title: "Storm Sandwich",
  subtitle: "K(n,n) twice in a row, spans through both storms",
  description:
    "Three banks wired A-to-B and B-to-C completely: two congested " +
    "layer gaps back to back. Then anti-diagonal A-to-C spans must " +
    "cross BOTH storms and the populated middle bank: a long-span " +
    "edge with nowhere quiet to travel. This is the combined problem " +
    "the single-gap storm and the span gauntlet each pose alone.",
  stresses: [
    "two congested channels in sequence",
    "long spans threaded through occupied gaps",
    "the middle bank as an obstacle wall",
  ],
  direction: "RIGHT",
  build(size) {
    const n = sizeN(size, 4, 5, 6);
    const nodes: StructuralNode[] = [];
    const edges: StructuralEdge[] = [];
    for (let i = 1; i <= n; i++) {
      nodes.push(plain(`sa${i}`, `A-${i}`, 88, 38));
      nodes.push(plain(`sb${i}`, `B-${i}`, 88, 38));
      nodes.push(plain(`sc${i}`, `C-${i}`, 88, 38));
    }
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= n; j++) {
        edges.push(edge(`ab${i}_${j}`, `sa${i}`, `sb${j}`));
        edges.push(edge(`bc${i}_${j}`, `sb${i}`, `sc${j}`));
      }
    }
    // Anti-diagonal long spans through both storms.
    for (let i = 1; i <= n; i++) {
      edges.push(edge(`span${i}`, `sa${i}`, `sc${n + 1 - i}`));
    }
    return { nodes, edges };
  },
};

/** The shell's initial selection (index access would type as possibly
 *  undefined; the named constant keeps the consumer assertion-free). */
export const DEFAULT_ROUTING_SCENARIO: RoutingScenario = spanGauntlet;

export const ROUTING_SCENARIOS: RoutingScenario[] = [
  spanGauntlet,
  fanBus,
  crossingStorm,
  obstacleMaze,
  portStorm,
  cycleTangle,
  pruneWall,
  counterflowLadder,
  stormSandwich,
];
