/**
 * d3-force layout engine (M2.E2.T2).
 *
 * Uses d3-force simulation for force-directed placement.
 * Pinned nodes use fx/fy to lock position.
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { UGM } from "@core/ugm";
import type {
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  Position,
} from "./types";

interface ForceNode extends SimulationNodeDatum {
  id: string;
}

export class ForceLayout implements LayoutEngine {
  readonly name = "Force-Directed";
  readonly id = "force";

  private readonly ticks: number;

  constructor(ticks: number = 300) {
    this.ticks = ticks;
  }

  async compute(ugm: UGM, options?: LayoutOptions): Promise<LayoutResult> {
    const pinned = options?.pinned ?? new Map<string, Position>();

    // Build node list
    const nodes: ForceNode[] = [];
    ugm.forEachNode((id) => {
      const pin = pinned.get(id);
      if (pin) {
        nodes.push({ id, x: pin.x, y: pin.y, fx: pin.x, fy: pin.y });
      } else {
        nodes.push({ id });
      }
    });

    // Build link list
    const links: SimulationLinkDatum<ForceNode>[] = [];
    ugm.forEachEdge((_edgeId, _attrs, source, target) => {
      links.push({ source, target });
    });

    // Run simulation synchronously for N ticks
    const sim = forceSimulation(nodes)
      .force(
        "link",
        forceLink<ForceNode, SimulationLinkDatum<ForceNode>>(links).id(
          (d) => d.id,
        ),
      )
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide(20))
      .stop();

    for (let i = 0; i < this.ticks; i++) {
      sim.tick();
    }

    // Build result map
    const result: LayoutResult = new Map();
    for (const node of nodes) {
      result.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
    }

    return result;
  }
}
