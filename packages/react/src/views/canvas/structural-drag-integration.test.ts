/**
 * Drag-reroute INTEGRATION oracle (G3L Round 43).
 *
 * Lesson applied twice over: the plain-node pin (round 39) and the
 * stub-harness oracle (round 41) each passed while the browser
 * failed, because neither drove the REAL converter output through
 * the REAL drag handlers. This test does: the satellite BDD through
 * the default (g3t) layout, through structuralToCytoscapeElements,
 * hosted in a minimal cy fake, dragged via the actual grab/drag/free
 * handlers, then validated with the SAME assertions the e2e makes:
 * border-anchored endpoints, axis-aligned segments, no segment
 * through a non-endpoint top-level box.
 */
import { describe, expect, it } from "vitest";
import { layoutStructural } from "@g3t/core";
import { projectDiagram } from "../../../../../src/demo/mbse/diagrams";
import { satelliteModel } from "../../../../../src/demo/mbse/model";
import {
  structuralToCytoscapeElements,
  wireStructuralPortDrag,
} from "./structural-to-cytoscape";

interface Pt {
  x: number;
  y: number;
}
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function parsePts(v: unknown): Pt[] {
  if (typeof v !== "string" || v.trim() === "") return [];
  return v
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x: x ?? NaN, y: y ?? NaN };
    });
}

describe("drag reroute over the real BDD pipeline", () => {
  it("dragging smallsat keeps every incident route border-anchored, orthogonal, and clear", async () => {
    const input = projectDiagram(satelliteModel, "dg.bdd");
    const geometry = await layoutStructural(input, { direction: "DOWN" });
    const els = structuralToCytoscapeElements(input, geometry);

    // ---- Minimal cy fake over the real element definitions ----
    const topIds = new Set(input.nodes.map((n) => n.id));
    const boxes = new Map<string, Box>();
    for (const id of topIds) {
      const g = geometry.nodes[id];
      if (g)
        boxes.set(id, { x: g.x, y: g.y, width: g.width, height: g.height });
    }
    const center = (b: Box): Pt => ({
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
    });
    // HOSTILE fake (the round-42/43 lesson): real cy compounds
    // report PADDED width/height and clip endpoints against the
    // padded bbox. The fake models that skew so this test passes
    // ONLY through the truth path (_geomBox + _routePts), never
    // through cy-derived values.
    const CY_PAD = 24;
    const mkNode = (id: string) => ({
      id: () => id,
      data: (k: string) => {
        const b = boxes.get(id);
        if (k === "_geomBox" && b) {
          return `${b.x} ${b.y} ${b.width} ${b.height}`;
        }
        return undefined;
      },
      position: (p?: Pt) => {
        const b = boxes.get(id);
        if (b === undefined) return { x: 0, y: 0 };
        if (p) {
          b.x = p.x - b.width / 2;
          b.y = p.y - b.height / 2;
        }
        return center(b);
      },
      width: () => (boxes.get(id)?.width ?? 0) + CY_PAD,
      height: () => (boxes.get(id)?.height ?? 0) + CY_PAD,
      isChild: () => false,
      hasClass: () => false,
    });
    const nodesById = new Map([...topIds].map((id) => [id, mkNode(id)]));

    const routedDefs = els.filter(
      (el) =>
        typeof el.classes === "string" &&
        el.classes.includes("g3t-structural-edge-routed"),
    );
    expect(routedDefs.length).toBe(input.edges.length);

    const edges = routedDefs.map((def) => {
      const store: Record<string, string> = {};
      for (const [k, v] of Object.entries(def.data)) {
        if (typeof v === "string") store[k] = v;
      }
      const sId = String(def.data.source);
      const tId = String(def.data.target);
      return {
        id: () => String(def.data.id),
        data: ((k?: string | Record<string, string>) => {
          if (typeof k === "string") return store[k];
          if (k) Object.assign(store, k);
          return undefined;
        }) as never,
        hasClass: (c: string) => String(def.classes).includes(c),
        style: () => undefined,
        source: () => nodesById.get(sId)!,
        target: () => nodesById.get(tId)!,
        // Padded-bbox clips, NOT the writer's anchors: capture must
        // ignore these (the browser divergence, modeled).
        sourceEndpoint: () => {
          const c = center(boxes.get(sId)!);
          return { x: c.x + 11, y: c.y - 13 };
        },
        targetEndpoint: () => {
          const c = center(boxes.get(tId)!);
          return { x: c.x - 9, y: c.y + 17 };
        },
        _store: store,
      };
    });

    const handlers: Record<string, ((evt: unknown) => void) | undefined> = {};
    const cy = {
      on: (evt: string, _sel: string, fn: (e: unknown) => void) => {
        handlers[evt] = fn;
      },
      removeListener: (evt: string) => {
        handlers[evt] = undefined;
      },
      nodes: () => {
        const arr = [...nodesById.values()];
        const native = Array.prototype.filter.bind(arr);
        return Object.assign(arr, {
          filter: (pred: (n: unknown) => boolean) => native((n) => pred(n)),
        });
      },
      $id: (id: string) =>
        Object.assign(nodesById.get(id) ?? { length: 0 }, { length: 1 }),
    };
    const dispose = wireStructuralPortDrag(cy as never);

    const host = nodesById.get("smallsat")!;
    const hostEdges = edges.filter(
      (e) => e.source().id() === "smallsat" || e.target().id() === "smallsat",
    );
    const target = Object.assign(host, {
      connectedEdges: () => hostEdges,
    });

    // ---- The e2e's exact choreography: +170/+90 in 8 steps ----
    // (This drop lands smallsat OVERLAPPING imager's corner: the
    // hard case, and the owner's screenshot.)
    handlers["grab"]!({ target });
    const start = host.position();
    for (let step = 1; step <= 8; step++) {
      host.position({
        x: start.x + (170 * step) / 8,
        y: start.y + (90 * step) / 8,
      });
      handlers["drag"]!({ target });
    }
    handlers["free"]!({ target });

    // ---- The e2e's three assertions, headless ----
    const failures: string[] = [];
    const band = 6;
    const inBorderBand = (p: Pt, b: Box): boolean => {
      const inside =
        p.x >= b.x - band &&
        p.x <= b.x + b.width + band &&
        p.y >= b.y - band &&
        p.y <= b.y + b.height + band;
      const nearEdge =
        Math.abs(p.x - b.x) <= band ||
        Math.abs(p.x - (b.x + b.width)) <= band ||
        Math.abs(p.y - b.y) <= band ||
        Math.abs(p.y - (b.y + b.height)) <= band;
      return inside && nearEdge;
    };
    for (const e of edges) {
      const pts = parsePts(e._store._routePts);
      const sId = e.source().id();
      const tId = e.target().id();
      const sBox = boxes.get(sId)!;
      const tBox = boxes.get(tId)!;
      if (pts.length < 2) {
        failures.push(`${e.id()}: no route`);
        continue;
      }
      if (!inBorderBand(pts[0]!, sBox)) {
        failures.push(`${e.id()}: source end off ${sId}'s border`);
      }
      if (!inBorderBand(pts[pts.length - 1]!, tBox)) {
        failures.push(`${e.id()}: target end off ${tId}'s border`);
      }
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) {
          failures.push(`${e.id()}: segment ${i} not axis-aligned`);
        }
        for (const [nid, bb] of boxes) {
          if (nid === sId || nid === tId) continue;
          const x1 = bb.x + 2;
          const x2 = bb.x + bb.width - 2;
          const y1 = bb.y + 2;
          const y2 = bb.y + bb.height - 2;
          const sx1 = Math.min(a.x, b.x);
          const sx2 = Math.max(a.x, b.x);
          const sy1 = Math.min(a.y, b.y);
          const sy2 = Math.max(a.y, b.y);
          if (sx1 < x2 && sx2 > x1 && sy1 < y2 && sy2 > y1) {
            failures.push(`${e.id()}: segment ${i} crosses ${nid}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
    dispose();
  });
});
