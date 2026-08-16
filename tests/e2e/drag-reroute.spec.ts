/**
 * Drag re-routing acceptance (MR-8, MR-9), SVG renderer.
 *
 * RETARGETED 2026-08-16 (owner ruling). This suite was written against
 * the Cytoscape canvas and its svg-overlay edge layer: cy model-to-
 * rendered coordinate conversion, cy "grab"/"drag" events, cy.$id()
 * positions and cy.zoom(). The MBSE shell defaults to the SVG renderer
 * and marks Cytoscape deprecated, so the invariants are re-pinned on
 * the renderer users actually get, and the Cytoscape coupling is gone
 * rather than re-selected.
 *
 * What is asserted is unchanged in substance:
 *
 *  - MR-8: dragging a block leaves its incident edges anchored on the
 *    drawn border of the moved block, and clear of other blocks. The
 *    live re-router (RTE-011) is what makes this possible in the SVG
 *    view: dragged elements keep ORTHOGONAL routes instead of
 *    collapsing to centre-to-centre lines.
 *  - MR-9: a round-trip drag restores the pre-drag routes EXACTLY.
 *
 * The SVG view's contract, which this file depends on:
 *  - `[data-ssv-scene]` carries the whole view transform as
 *    `translate(tx ty) scale(k)`, so scene coordinates convert to
 *    screen coordinates arithmetically.
 *  - `[data-ssv-node="<id>"] > rect` is the drawn box in SCENE
 *    coordinates, with drag offsets already applied.
 *  - `[data-ssv-edge-path="<id>"]` carries the drawn polyline, which is
 *    ARROW-TRIMMED (shortenPolyline runs per arrow shape), so endpoint
 *    comparisons need the trim tolerance below rather than an exact
 *    border hit.
 *  - `[data-ssv-edge-fallback]` marks an edge the router SKIPPED. A
 *    fallback appearing on a dragged node's edges is the regression
 *    MR-8 exists to catch: it means the live re-route did not run.
 */
import { test, expect, type Page } from "@playwright/test";

const SVG = "[data-testid='mbse-structural-svg']";
/** Border-anchor tolerance, in scene units. Absorbs the arrow trim. */
const TOL = 14;

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

async function openMbse(page: Page): Promise<void> {
  await page.goto("/?e2e=1");
  await page.getByText("MBSE Satellite Workbench", { exact: true }).click();
  // No renderer selection: SVG is the default, which is the point.
  await page.waitForSelector(SVG, { timeout: 15000 });
  await page.waitForFunction(
    () =>
      window.__g3t?.scenes.has("mbse") === true &&
      document.querySelectorAll("[data-ssv-edge-path]").length > 0,
    { timeout: 15000 },
  );
}

/** Every drawn edge polyline, keyed by edge id, in scene coordinates. */
async function drawnRoutes(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    document.querySelectorAll("[data-ssv-edge-path]").forEach((el) => {
      out[el.getAttribute("data-ssv-edge-path")!] = el.getAttribute("d") ?? "";
    });
    return out;
  });
}

/** Drawn boxes of every top-level node, in scene coordinates. */
async function drawnBoxes(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const out: Record<string, Box> = {};
    document.querySelectorAll("[data-ssv-node]").forEach((g) => {
      const id = g.getAttribute("data-ssv-node")!;
      const rect = g.querySelector("rect");
      if (!rect) return;
      const num = (a: string): number => Number(rect.getAttribute(a) ?? "NaN");
      const x = num("x");
      const y = num("y");
      const w = num("width");
      const h = num("height");
      if ([x, y, w, h].some((v) => Number.isNaN(v))) return;
      out[id] = { x1: x, y1: y, x2: x + w, y2: y + h };
    });
    return out;
  });
}

/**
 * Pick a top-level node with at least one incident edge, preferring
 * SmallSat (the owner's original reproduction).
 */
async function pickDragTarget(page: Page): Promise<string> {
  return page.evaluate(() => {
    const scene = window.__g3t!.scenes.get("mbse")!;
    const drawn = new Set(
      [...document.querySelectorAll("[data-ssv-node]")].map(
        (g) => g.getAttribute("data-ssv-node")!,
      ),
    );
    const incident = new Map<string, number>();
    for (const e of scene.input.edges ?? []) {
      for (const end of [e.source, e.target]) {
        if (drawn.has(end)) incident.set(end, (incident.get(end) ?? 0) + 1);
      }
    }
    const withEdges = [...incident.entries()]
      .filter(([, n]) => n > 0)
      .map(([id]) => id);
    return (
      withEdges.find((id) => id.toLowerCase().includes("smallsat")) ??
      withEdges[0]!
    );
  });
}

/** Drag a node by a scene-space delta, using the live view transform. */
async function dragNode(page: Page, id: string, dx: number, dy: number) {
  const svgBox = (await page.locator(SVG).boundingBox())!;
  const start = await page.evaluate((nodeId) => {
    const scene = document.querySelector("[data-ssv-scene]")!;
    const t = scene.getAttribute("transform") ?? "";
    const nums = t.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [0, 0, 1];
    const [tx, ty, k] = [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 1];
    const rect = document
      .querySelector(`[data-ssv-node="${nodeId}"]`)!
      .querySelector("rect")!;
    const num = (a: string): number => Number(rect.getAttribute(a) ?? "0");
    // Grab the header band rather than the centre: the centre of a
    // container is empty space that belongs to its children.
    const cx = num("x") + num("width") / 2;
    const cy = num("y") + 8;
    return { sx: cx * k + tx, sy: cy * k + ty, k };
  }, id);

  const from = { x: svgBox.x + start.sx, y: svgBox.y + start.sy };
  const to = { x: from.x + dx * start.k, y: from.y + dy * start.k };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Several steps: a single jump can be read as a click, and the live
  // re-router only runs on move.
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

test("dragging a block keeps its edges border-anchored and clear of other blocks (MR-8)", async ({
  page,
}) => {
  await openMbse(page);
  const target = await pickDragTarget(page);
  const before = await drawnBoxes(page);
  expect(before[target]).toBeDefined();

  await dragNode(page, target, 90, 70);

  const after = await drawnBoxes(page);
  // The drag must actually have moved the block; if it did not, every
  // assertion below would pass vacuously.
  expect(after[target]!.x1).not.toBeCloseTo(before[target]!.x1, 0);

  const report = await page.evaluate(
    ({ nodeId, tol }) => {
      const scene = window.__g3t!.scenes.get("mbse")!;
      const boxes: Record<string, Box> = {};
      interface Box {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }
      document.querySelectorAll("[data-ssv-node]").forEach((g) => {
        const id = g.getAttribute("data-ssv-node")!;
        const r = g.querySelector("rect");
        if (!r) return;
        const n = (a: string): number => Number(r.getAttribute(a) ?? "0");
        boxes[id] = {
          x1: n("x"),
          y1: n("y"),
          x2: n("x") + n("width"),
          y2: n("y") + n("height"),
        };
      });
      const points = (d: string): { x: number; y: number }[] => {
        const ns = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        const out: { x: number; y: number }[] = [];
        for (let i = 0; i + 1 < ns.length; i += 2) {
          out.push({ x: ns[i]!, y: ns[i + 1]! });
        }
        return out;
      };
      const incident = (scene.input.edges ?? []).filter(
        (e) => e.source === nodeId || e.target === nodeId,
      );
      const floating: string[] = [];
      const crossing: string[] = [];
      const fallbacks: string[] = [];
      for (const e of incident) {
        const el = document.querySelector(`[data-ssv-edge-path="${e.id}"]`);
        if (!el) continue;
        if (el.hasAttribute("data-ssv-edge-fallback")) fallbacks.push(e.id);
        const pts = points(el.getAttribute("d") ?? "");
        if (pts.length < 2) continue;
        // Anchored: the end that belongs to the moved node sits within
        // tol of that node's drawn border band.
        const box = boxes[nodeId];
        if (box) {
          const end = e.source === nodeId ? pts[0]! : pts[pts.length - 1]!;
          const inside =
            end.x >= box.x1 - tol &&
            end.x <= box.x2 + tol &&
            end.y >= box.y1 - tol &&
            end.y <= box.y2 + tol;
          const border = Math.min(
            Math.abs(end.x - box.x1),
            Math.abs(end.x - box.x2),
            Math.abs(end.y - box.y1),
            Math.abs(end.y - box.y2),
          );
          if (!inside || border > tol * 2) {
            floating.push(`${e.id}: end floats off ${nodeId}`);
          }
        }
        // Clear: no vertex of the route sits well inside a DIFFERENT
        // top-level block. Endpoints legitimately touch their own
        // endpoints' borders, so both ends are excluded.
        for (const [id, b] of Object.entries(boxes)) {
          if (id === e.source || id === e.target) continue;
          const deep = pts
            .slice(1, -1)
            .some(
              (p) =>
                p.x > b.x1 + tol &&
                p.x < b.x2 - tol &&
                p.y > b.y1 + tol &&
                p.y < b.y2 - tol,
            );
          if (deep) crossing.push(`${e.id} passes through ${id}`);
        }
      }
      return { floating, crossing, fallbacks, count: incident.length };
    },
    { nodeId: target, tol: TOL },
  );

  expect(report.count).toBeGreaterThan(0);
  // A fallback here means the live re-router did not run for a dragged
  // node's edge, which is the MR-8 regression in its purest form.
  expect(report.fallbacks).toEqual([]);
  expect(report.floating).toEqual([]);
  expect(report.crossing).toEqual([]);
});

test("round-trip drag restores the pre-drag routes exactly (MR-9)", async ({
  page,
}) => {
  await openMbse(page);
  const target = await pickDragTarget(page);

  const before = await drawnRoutes(page);
  const boxBefore = (await drawnBoxes(page))[target]!;
  expect(Object.keys(before).length).toBeGreaterThan(0);

  await dragNode(page, target, 120, 90);
  const moved = await drawnRoutes(page);
  const boxMoved = (await drawnBoxes(page))[target]!;
  // The outbound leg must genuinely change something, or the return
  // leg proves nothing.
  expect(boxMoved.x1).not.toBeCloseTo(boxBefore.x1, 0);
  expect(moved).not.toEqual(before);

  await dragNode(page, target, -120, -90);
  const after = await drawnRoutes(page);
  const boxAfter = (await drawnBoxes(page))[target]!;

  // EXACTLY: the offset map returns to its starting value, the router
  // is pure, so every `d` string must be byte-identical. An
  // accumulating rounding error would show here first.
  expect(boxAfter.x1).toBeCloseTo(boxBefore.x1, 1);
  expect(boxAfter.y1).toBeCloseTo(boxBefore.y1, 1);
  expect(after).toEqual(before);
});
