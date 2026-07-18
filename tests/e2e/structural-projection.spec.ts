/**
 * Structural projection acceptance (postmortem gates 2 + 3;
 * planning/expand-collapse-postmortem.md).
 *
 * The four-layer collapse defect chain ended at a divergence no
 * headless test covered: the renderer's DRAWN state vs the geometry
 * document. These specs pin that boundary through the REAL renderer,
 * per flow direction (gate 2: BDD is DOWN, IBD is RIGHT; the flagship
 * default is fixture one), for the features that shipped:
 *
 *  - drawn compound bounds == geometry box (the ::extent pin's job)
 *  - overlay edge routes TERMINATE on the drawn boxes they connect
 *
 * AUTHORED HEADLESSLY (established suite doctrine): this environment
 * cannot download Playwright browsers; first execution is CI
 * (.github/workflows/ci.yml e2e job) or a maintainer's local
 * `pnpm run test:e2e`.
 */
import { test, expect, type Page } from "@playwright/test";

const CANVAS = "[data-testid='cytoscape-canvas']";
/** Drawn-vs-geometry tolerance: border widths + the 1px extent pin
 *  + antialias slack. A REAL divergence (the collapse-era defect was
 *  a full row-stack of drift) is an order of magnitude larger. */
const TOL = 8;

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

async function openMbse(page: Page): Promise<void> {
  await page.goto("/?e2e=1");
  await page.getByText("MBSE Satellite Workbench", { exact: true }).click();
  await page.waitForSelector(CANVAS, { timeout: 15000 });
  await page.waitForFunction(
    () => {
      const g = window.__g3t;
      return (
        g !== undefined &&
        g.canvases.has("mbse") &&
        g.scenes.has("mbse") &&
        g.canvases.get("mbse")!.nodes().length > 0
      );
    },
    { timeout: 15000 },
  );
}

/** Drawn bounding boxes of container nodes + the geometry boxes they
 *  must match, computed inside the page against the live handles. */
async function containerBoxes(
  page: Page,
): Promise<{ id: string; drawn: Box; geo: Box }[]> {
  return page.evaluate(() => {
    const g = window.__g3t!;
    const cy = g.canvases.get("mbse")!;
    const scene = g.scenes.get("mbse")!;
    const out: { id: string; drawn: Box; geo: Box }[] = [];
    interface Box {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
    // Top-level structural nodes: containers AND plain nodes (IBD
    // parts carry ports but no compartments, so their kind is
    // "node"; the first CI run failed on a container-only premise).
    // Rows and synthetic children are identified by id convention.
    const topLevel = new Set(scene.input.nodes.map((n) => n.id));
    for (const [id, node] of Object.entries(scene.geometry.nodes)) {
      const n = node as {
        kind?: string;
        x: number;
        y: number;
        width: number;
        height: number;
      };
      if (!topLevel.has(id)) continue;
      const ele = cy.$id(id);
      if (ele.length === 0) continue;
      const bb = ele.boundingBox({
        includeLabels: false,
        includeOverlays: false,
      });
      out.push({
        id,
        drawn: { x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 },
        geo: { x1: n.x, y1: n.y, x2: n.x + n.width, y2: n.y + n.height },
      });
    }
    return out;
  });
}

function assertBoxesMatch(boxes: { id: string; drawn: Box; geo: Box }[]): void {
  expect(boxes.length).toBeGreaterThan(0);
  const bad = boxes
    .map((b) => ({
      id: b.id,
      d: Math.max(
        Math.abs(b.drawn.x1 - b.geo.x1),
        Math.abs(b.drawn.y1 - b.geo.y1),
        Math.abs(b.drawn.x2 - b.geo.x2),
        Math.abs(b.drawn.y2 - b.geo.y2),
      ),
    }))
    .filter((b) => b.d > TOL);
  expect(
    bad,
    `drawn bounds diverge from geometry: ${JSON.stringify(bad)}`,
  ).toEqual([]);
}

test.describe("structural projection: drawn bounds == geometry box", () => {
  test("BDD (direction DOWN, the flagship default fixture)", async ({
    page,
  }) => {
    await openMbse(page);
    assertBoxesMatch(await containerBoxes(page));
  });

  test("IBD (direction RIGHT: the second flow direction, gate 2)", async ({
    page,
  }) => {
    await openMbse(page);
    const bddKey = await page.evaluate(() =>
      window
        .__g3t!.scenes.get("mbse")!
        .input.nodes.map((n) => n.id)
        .sort()
        .join("|"),
    );
    await page.getByText("SmallSat Internal").click();
    // Wait for the SCENE to actually swap (different node-id set),
    // not for a shape predicate the new scene might never satisfy.
    await page.waitForFunction(
      (prev) => {
        const s = window.__g3t?.scenes.get("mbse");
        if (!s) return false;
        const key = s.input.nodes
          .map((n) => n.id)
          .sort()
          .join("|");
        return key !== prev;
      },
      bddKey,
      { timeout: 15000 },
    );
    // Let the canvas patch/mount settle before measuring.
    await page.waitForTimeout(500);
    assertBoxesMatch(await containerBoxes(page));
  });
});

test.describe("structural projection: overlay routes terminate on drawn boxes", () => {
  test("every overlay edge's endpoints touch its endpoint containers' drawn borders", async ({
    page,
  }) => {
    await openMbse(page);
    await page.waitForSelector("[data-testid='structural-edge-overlay']", {
      timeout: 15000,
    });
    const failures = await page.evaluate((tol) => {
      const g = window.__g3t!;
      const cy = g.canvases.get("mbse")!;
      const scene = g.scenes.get("mbse")!;
      const bySourceTarget = new Map<
        string,
        { source: string; target: string }
      >();
      for (const e of scene.input.edges ?? []) {
        bySourceTarget.set(e.id, { source: e.source, target: e.target });
      }
      const near = (p: { x: number; y: number }, id: string): boolean => {
        const ele = cy.$id(id);
        if (ele.length === 0) return true; // ports/rows resolved elsewhere
        const bb = ele.boundingBox({
          includeLabels: false,
          includeOverlays: false,
        });
        // Within the box inflated by tol AND not deep inside beyond
        // tol of a border: "touches the border band".
        const inside =
          p.x >= bb.x1 - tol &&
          p.x <= bb.x2 + tol &&
          p.y >= bb.y1 - tol &&
          p.y <= bb.y2 + tol;
        if (!inside) return false;
        const borderDist = Math.min(
          Math.abs(p.x - bb.x1),
          Math.abs(p.x - bb.x2),
          Math.abs(p.y - bb.y1),
          Math.abs(p.y - bb.y2),
        );
        return borderDist <= tol * 2;
      };
      const out: string[] = [];
      document.querySelectorAll("[data-overlay-edge]").forEach((pathEl) => {
        const id = pathEl.getAttribute("data-overlay-edge")!;
        // TRUE route anchors from the overlay's data attributes: the
        // drawn d is the ARROW-TRIMMED shaft, so its terminal
        // coordinates sit an arrow-length short of the border (the
        // first CI run failed on exactly that gap).
        const parsePt = (v: string | null) => {
          const ns = v?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
          return ns.length === 2 ? { x: ns[0]!, y: ns[1]! } : null;
        };
        const first = parsePt(pathEl.getAttribute("data-route-start"));
        const last = parsePt(pathEl.getAttribute("data-route-end"));
        if (!first || !last) return;
        const st = bySourceTarget.get(id);
        if (!st) return; // synthetic/chain edges judged elsewhere
        if (!near(first, st.source)) {
          out.push(`${id}: source end floats off ${st.source}`);
        }
        if (!near(last, st.target)) {
          out.push(`${id}: target end floats off ${st.target}`);
        }
      });
      return out;
    }, TOL);
    expect(failures).toEqual([]);
  });
});
