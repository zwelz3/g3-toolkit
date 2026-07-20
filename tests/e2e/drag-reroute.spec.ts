/**
 * Drag-reroute browser acceptance (MR-8; G3L:RTE-011, workstream
 * B4/B5). The owner's two symptoms, verbatim, as assertions:
 *
 *  (a) moving a block must NOT make its edge render toward the block
 *      CENTER: every incident overlay endpoint stays in the border
 *      band of its endpoint box after the drag;
 *  (b) edges must NOT route OVER other blocks: no overlay path
 *      segment intersects any non-endpoint top-level box.
 *
 * AUTHORED HEADLESSLY (established suite doctrine): first execution
 * is CI or a maintainer's local `pnpm run test:e2e`.
 */
import { test, expect, type Page } from "@playwright/test";

const CANVAS = "[data-testid='cytoscape-canvas']";
const OVERLAY = "[data-testid='structural-edge-overlay']";
const TOL = 8;

async function openMbse(page: Page): Promise<void> {
  await page.goto("/?e2e=1");
  await page.getByText("MBSE Satellite Workbench", { exact: true }).click();
  await page.waitForSelector(OVERLAY, { timeout: 15000 });
  await page.waitForFunction(
    () =>
      window.__g3t?.scenes.has("mbse") === true &&
      window.__g3t?.canvases.has("mbse") === true,
    { timeout: 15000 },
  );
}

/** Pick a top-level node that has at least one routed incident edge,
 *  preferring the SmallSat block (the owner's reproduction). */
async function pickDragTarget(page: Page): Promise<string> {
  return page.evaluate(() => {
    const scene = window.__g3t!.scenes.get("mbse")!;
    const incident = new Map<string, number>();
    for (const e of scene.input.edges ?? []) {
      incident.set(e.source, (incident.get(e.source) ?? 0) + 1);
      incident.set(e.target, (incident.get(e.target) ?? 0) + 1);
    }
    const named = scene.input.nodes.find(
      (n) =>
        /smallsat/i.test(n.header?.name ?? "") && (incident.get(n.id) ?? 0) > 0,
    );
    if (named) return named.id;
    const any = scene.input.nodes.find((n) => (incident.get(n.id) ?? 0) > 0);
    return any ? any.id : "";
  });
}

test("dragging a block keeps its edges border-anchored and clear of other blocks (MR-8)", async ({
  page,
}) => {
  await openMbse(page);
  const dragId = await pickDragTarget(page);
  expect(dragId).not.toBe("");

  // Page-space grab point: the block's header strip (top of the
  // rendered box), via the canvas element offset.
  const canvasBox = (await page.locator(CANVAS).boundingBox())!;
  const grab = await page.evaluate((id) => {
    const cy = window.__g3t!.canvases.get("mbse")!;
    const bb = (
      cy.$id(id) as unknown as {
        renderedBoundingBox: (o: object) => {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
        };
      }
    ).renderedBoundingBox({ includeLabels: false, includeOverlays: false });
    return { x: (bb.x1 + bb.x2) / 2, y: bb.y1 + 12 };
  }, dragId);

  await page.mouse.move(canvasBox.x + grab.x, canvasBox.y + grab.y);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + grab.x + 170, canvasBox.y + grab.y + 90, {
    steps: 8,
  });
  await page.mouse.up();
  await page.waitForTimeout(400);

  const failures = await page.evaluate(
    ({ id, tol }) => {
      const g = window.__g3t!;
      const cy = g.canvases.get("mbse")!;
      const scene = g.scenes.get("mbse")!;
      const out: string[] = [];

      const boxOf = (nodeId: string) => {
        const ele = cy.$id(nodeId);
        if (ele.length === 0) return null;
        const bb = ele.boundingBox({
          includeLabels: false,
          includeOverlays: false,
        });
        return bb as { x1: number; y1: number; x2: number; y2: number };
      };
      const inBorderBand = (
        p: { x: number; y: number },
        bb: { x1: number; y1: number; x2: number; y2: number },
      ): boolean => {
        const inside =
          p.x >= bb.x1 - tol &&
          p.x <= bb.x2 + tol &&
          p.y >= bb.y1 - tol &&
          p.y <= bb.y2 + tol;
        if (!inside) return false;
        const d = Math.min(
          Math.abs(p.x - bb.x1),
          Math.abs(p.x - bb.x2),
          Math.abs(p.y - bb.y1),
          Math.abs(p.y - bb.y2),
        );
        return d <= tol * 2;
      };

      const ends = new Map<string, { source: string; target: string }>();
      for (const e of scene.input.edges ?? []) {
        ends.set(e.id, { source: e.source, target: e.target });
      }
      const topLevel = scene.input.nodes.map((n) => n.id);
      const incident = new Set<string>();
      for (const [eid, st] of ends) {
        if (st.source === id || st.target === id) incident.add(eid);
      }

      document.querySelectorAll("[data-overlay-edge]").forEach((el) => {
        const eid = el.getAttribute("data-overlay-edge")!;
        const st = ends.get(eid);
        if (!st) return;
        const d = el.getAttribute("d") ?? "";
        const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        if (nums.length < 4) return;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i + 1 < nums.length; i += 2) {
          pts.push({ x: nums[i]!, y: nums[i + 1]! });
        }

        // (a) Border anchoring for the DRAGGED node's edges, read
        // from the TRUE anchor attributes: the drawn d is the
        // ARROW-TRIMMED shaft (the first CI run failed on that).
        if (incident.has(eid)) {
          const parsePt = (v: string | null) => {
            const ns = v?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
            return ns.length === 2 ? { x: ns[0]!, y: ns[1]! } : null;
          };
          const start = parsePt(el.getAttribute("data-route-start"));
          const end = parsePt(el.getAttribute("data-route-end"));
          const sBox = boxOf(st.source);
          const tBox = boxOf(st.target);
          if (start && sBox && !inBorderBand(start, sBox)) {
            out.push(`${eid}: source end off ${st.source}'s border`);
          }
          if (end && tBox && !inBorderBand(end, tBox)) {
            out.push(`${eid}: target end off ${st.target}'s border`);
          }
        }

        // (b) No segment through a NON-endpoint top-level box
        // (shrunk 2px: border touches are legal).
        for (const nid of topLevel) {
          if (nid === st.source || nid === st.target) continue;
          const bb = boxOf(nid);
          if (!bb) continue;
          const x1 = bb.x1 + 2;
          const x2 = bb.x2 - 2;
          const y1 = bb.y1 + 2;
          const y2 = bb.y2 - 2;
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1]!;
            const b = pts[i]!;
            const sx1 = Math.min(a.x, b.x);
            const sx2 = Math.max(a.x, b.x);
            const sy1 = Math.min(a.y, b.y);
            const sy2 = Math.max(a.y, b.y);
            if (sx1 < x2 && sx2 > x1 && sy1 < y2 && sy2 > y1) {
              out.push(`${eid}: segment ${i} crosses ${nid}`);
              break;
            }
          }
        }
      });
      return out;
    },
    { id: dragId, tol: TOL },
  );
  expect(failures).toEqual([]);
});

test("round-trip drag restores the pre-drag routes exactly (MR-9)", async ({
  page,
}) => {
  await openMbse(page);
  const dragId = await pickDragTarget(page);
  expect(dragId).not.toBe("");

  // Capture the incident edges' seg data BEFORE the drag.
  const before = await page.evaluate((id) => {
    const g = window.__g3t!;
    const cy = g.canvases.get("mbse")!;
    const scene = g.scenes.get("mbse")!;
    const out: Record<string, { dist: string; weight: string }> = {};
    for (const e of scene.input.edges ?? []) {
      if (e.source !== id && e.target !== id) continue;
      const ele = cy.$id(e.id);
      if (ele.length === 0) continue;
      out[e.id] = {
        dist: String(ele.data("_segDist") ?? ""),
        weight: String(ele.data("_segWeight") ?? ""),
      };
    }
    return out;
  }, dragId);
  expect(Object.keys(before).length).toBeGreaterThan(0);

  const canvasBox = (await page.locator(CANVAS).boundingBox())!;
  const grab = await page.evaluate((id) => {
    const cy = window.__g3t!.canvases.get("mbse")!;
    const bb = (
      cy.$id(id) as unknown as {
        renderedBoundingBox: (o: object) => {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
        };
      }
    ).renderedBoundingBox({ includeLabels: false, includeOverlays: false });
    return { x: (bb.x1 + bb.x2) / 2, y: bb.y1 + 12 };
  }, dragId);

  // Record the node's model position so the pin can verify its own
  // premise after the gesture (a failure must self-diagnose: "node
  // did not return" is a different defect than "restore is wrong").
  const posBefore = await page.evaluate(
    (id) => ({ ...window.__g3t!.canvases.get("mbse")!.$id(id).position() }),
    dragId,
  );
  // DIAGNOSTIC TRACE (premise failed at 50.5px on 2026-07-11 with a
  // net-zero gesture): capture WHO gets grabbed and the node position
  // at each checkpoint, so one run answers where symmetry broke.
  await page.evaluate(() => {
    const cy = window.__g3t!.canvases.get("mbse")!;
    (window as unknown as { __g3tGrabbed: string[] }).__g3tGrabbed = [];
    (window as unknown as { __g3tDrags: number }).__g3tDrags = 0;
    cy.on("grab", (e: { target: { id: () => string } }) => {
      (window as unknown as { __g3tGrabbed: string[] }).__g3tGrabbed.push(
        e.target.id(),
      );
    });
    cy.on("drag", () => {
      (window as unknown as { __g3tDrags: number }).__g3tDrags += 1;
    });
  });
  const sample = (label: string) =>
    page.evaluate(
      ({ id, label: l }) => {
        const cy = window.__g3t!.canvases.get("mbse")!;
        const p = cy.$id(id).position();
        return { label: l, x: p.x, y: p.y, zoom: cy.zoom() };
      },
      { id: dragId, label },
    );

  // One gesture: out 170px and back to the start.
  const sx = canvasBox.x + grab.x;
  const sy = canvasBox.y + grab.y;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 170, sy + 60, { steps: 6 });
  const atOut = await sample("after-outbound");
  await page.mouse.move(sx, sy, { steps: 6 });
  await page.waitForTimeout(100);
  // CLOSED-LOOP RETURN. Two falsified theories stand as data: the
  // symmetric gesture deterministically lands the node at exactly
  // 5/6 of the return distance (steps: 6), and a 100ms settle does
  // NOT recover the missing sixth (so it is not a pending sample).
  // The anomaly is recorded (drag-event telemetry below); the pin's
  // JOB is the restore contract, not gesture forensics, so the
  // return now closes the loop on the node's MEASURED position:
  // compute the residual in model space, convert to page space via
  // the zoom, nudge, and re-measure, until inside the restore band.
  let cursor = { x: sx, y: sy };
  for (let i = 0; i < 4; i++) {
    const now = await sample(`correction-${i}`);
    const residual = { x: posBefore.x - now.x, y: posBefore.y - now.y };
    if (Math.hypot(residual.x, residual.y) < 4) break;
    cursor = {
      x: cursor.x + residual.x * now.zoom,
      y: cursor.y + residual.y * now.zoom,
    };
    await page.mouse.move(cursor.x, cursor.y, { steps: 2 });
    await page.waitForTimeout(60);
  }
  const atBack = await sample("after-return-before-release");
  await page.mouse.up();
  await page.waitForTimeout(300);
  const atFree = await sample("after-release");
  const grabbed = await page.evaluate(
    () => (window as unknown as { __g3tGrabbed?: string[] }).__g3tGrabbed,
  );
  const dragEvents = await page.evaluate(
    () => (window as unknown as { __g3tDrags?: number }).__g3tDrags,
  );

  // PREMISE CHECK: the node must be back within the restore band
  // (8px model units) of where it started, or the rest of this test
  // is measuring the canonicalization path, not the restore.
  const posAfter = await page.evaluate(
    (id) => ({ ...window.__g3t!.canvases.get("mbse")!.$id(id).position() }),
    dragId,
  );
  const returnDist = Math.hypot(
    posAfter.x - posBefore.x,
    posAfter.y - posBefore.y,
  );
  expect(
    returnDist,
    `premise: node did not return to its grab position (moved ${returnDist.toFixed(1)}px); ` +
      `restore band 8px. TRACE: start=(${posBefore.x.toFixed(1)},${posBefore.y.toFixed(1)}) ` +
      `${atOut.label}=(${atOut.x.toFixed(1)},${atOut.y.toFixed(1)}) ` +
      `${atBack.label}=(${atBack.x.toFixed(1)},${atBack.y.toFixed(1)}) ` +
      `${atFree.label}=(${atFree.x.toFixed(1)},${atFree.y.toFixed(1)}) ` +
      `zoom=${atFree.zoom.toFixed(3)} grabbed=${JSON.stringify(grabbed)} ` +
      `dragEvents=${String(dragEvents)} dragId=${dragId}`,
  ).toBeLessThan(8);

  const after = await page.evaluate((ids) => {
    const cy = window.__g3t!.canvases.get("mbse")!;
    const out: Record<string, { dist: string; weight: string }> = {};
    for (const id of ids) {
      const ele = cy.$id(id);
      out[id] = {
        dist: String(ele.data("_segDist") ?? ""),
        weight: String(ele.data("_segWeight") ?? ""),
      };
    }
    return out;
  }, Object.keys(before));

  // Numeric comparison (float printing may differ between writers).
  const parse = (v: string) => v.split(" ").filter(Boolean).map(Number);
  for (const [eid, b] of Object.entries(before)) {
    const a = after[eid]!;
    const bd = parse(b.dist);
    const ad = parse(a.dist);
    expect(ad.length, `${eid} dist arity`).toBe(bd.length);
    ad.forEach((v, i) => expect(Math.abs(v - bd[i]!)).toBeLessThan(0.5));
    const bw = parse(b.weight);
    const aw = parse(a.weight);
    expect(aw.length, `${eid} weight arity`).toBe(bw.length);
    aw.forEach((v, i) => expect(Math.abs(v - bw[i]!)).toBeLessThan(0.01));
  }
});
