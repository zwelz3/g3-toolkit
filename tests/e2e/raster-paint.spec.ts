/**
 * Rasterization coverage for the two library paint paths that jsdom
 * cannot execute (issue #9): CanvasAdapter's `paint()` and Minimap's
 * frame painter. The unit suite now drives both against a recording
 * 2D context (canvas-adapter.test.tsx, Minimap.test.tsx) and pins the
 * call sequence; this spec is the other half, the pixels a real
 * Chromium raster produces from those calls, read back through
 * getImageData on the live canvas.
 *
 * Scene facts the assertions rest on (read from source, not assumed):
 *  - Supply Chain's SizedAdapter paints background #0b1120 and the
 *    harvested scene (harvest-scene.ts): node fills are whatever
 *    cytoscape computed, so the expected fill is READ from the
 *    published core under ?e2e=1 instead of copied from a palette.
 *    The harvester's label halo is the background color on purpose
 *    (a dark-shell readability halo), so it is not pixel-separable.
 *  - Halo and gradient ops exist only in the Style Lab F2 pane:
 *    hub n1 carries `hub-risk-halo` (LIGHT_TOKENS danger #D55E00 at
 *    globalAlpha 0.35) and the critical edges carry a warning->danger
 *    gradient on a taper polygon (style-lab-fixture.ts). Style Lab is
 *    DEV-only on the landing but ?e2e=1 exposes it in every build.
 *  - The Supply Chain Minimap paints the dark theme (Demo.tsx sets it):
 *    bgSecondary #25262b wash, nodeStroke #adb5bd dots, accentPrimary
 *    #4c8bf5 viewport indicator (ThemeManager.ts dark theme).
 */
import { test, expect, type Page } from "@playwright/test";

const CY_CANVAS = "[data-testid='cytoscape-canvas']";

interface ColorTarget {
  name: string;
  rgb: [number, number, number];
  /** Per-channel tolerance; 0 means exact. */
  tol?: number;
  /** Inclusive alpha range; default fully opaque. */
  alpha?: [number, number];
}

interface Probe {
  targets: ColorTarget[];
  /** Count the INTERIOR steps of a rasterized linear gradient: distinct
   *  opaque colors on the straight line between two colors, at least
   *  10% away from either endpoint, each covering at least `minCount`
   *  pixels. Measured (Style Lab, dpr 2): a real gradient taper yields
   *  a dozen interior colors of 100+ pixels each; with the gradient
   *  flattened, the only on-line colors are anti-aliasing slivers of
   *  warning over danger shapes (23 pixels at most), so the per-color
   *  minimum is what separates the two. */
  segment?: {
    from: [number, number, number];
    to: [number, number, number];
    tol: number;
    minCount: number;
  };
}

interface CanvasReport {
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  dpr: number;
  total: number;
  opaque: number;
  /** Distinct opaque colors (capped at 4096). */
  distinct: number;
  counts: Record<string, number>;
  segmentSteps: number;
  /** Bitmap-pixel extent of everything non-transparent (-1 when none). */
  maxX: number;
  maxY: number;
}

async function readCanvas(
  page: Page,
  selector: string,
  probe: Probe,
): Promise<CanvasReport> {
  return page.evaluate(
    ({ selector, probe }) => {
      const canvas = document.querySelector(selector);
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error(`no canvas at ${selector}`);
      }
      // Same context object the component painted through.
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2D context");
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      const counts: Record<string, number> = {};
      for (const t of probe.targets) counts[t.name] = 0;
      const distinct = new Set<number>();
      const seg = new Map<number, { t: number; count: number }>();
      let opaque = 0;
      let maxX = -1;
      let maxY = -1;
      const s = probe.segment;
      const span = s
        ? [s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]]
        : [0, 0, 0];
      let axis = 0;
      for (let k = 1; k < 3; k++) {
        if (Math.abs(span[k]!) > Math.abs(span[axis]!)) axis = k;
      }
      for (let i = 0; i < data.length; i += 4) {
        const c = [data[i]!, data[i + 1]!, data[i + 2]!];
        const a = data[i + 3]!;
        const packed = (c[0]! << 16) | (c[1]! << 8) | c[2]!;
        if (a === 255) {
          opaque++;
          if (distinct.size < 4096) distinct.add(packed);
        }
        if (a > 0) {
          const px = (i / 4) % width;
          const py = Math.floor(i / 4 / width);
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
        }
        for (const t of probe.targets) {
          const tol = t.tol ?? 0;
          const [aMin, aMax] = t.alpha ?? [255, 255];
          if (
            a >= aMin &&
            a <= aMax &&
            Math.abs(c[0]! - t.rgb[0]) <= tol &&
            Math.abs(c[1]! - t.rgb[1]) <= tol &&
            Math.abs(c[2]! - t.rgb[2]) <= tol
          ) {
            counts[t.name] = (counts[t.name] ?? 0) + 1;
          }
        }
        if (s && a === 255 && span[axis] !== 0) {
          const t = (c[axis]! - s.from[axis]!) / span[axis]!;
          if (t >= 0 && t <= 1) {
            let on = true;
            for (let k = 0; k < 3; k++) {
              if (Math.abs(c[k]! - (s.from[k]! + t * span[k]!)) > s.tol)
                on = false;
            }
            if (on) {
              const prev = seg.get(packed);
              if (prev) prev.count++;
              else seg.set(packed, { t, count: 1 });
            }
          }
        }
      }
      return {
        width,
        height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        dpr: window.devicePixelRatio,
        total: width * height,
        opaque,
        distinct: distinct.size,
        counts,
        segmentSteps: s
          ? [...seg.values()].filter(
              (v) => v.t >= 0.1 && v.t <= 0.9 && v.count >= s.minCount,
            ).length
          : 0,
        maxX,
        maxY,
      };
    },
    { selector, probe },
  );
}

/** Parse cytoscape's computed "rgb(r,g,b)" into a target triple. */
function parseRgb(s: string): [number, number, number] | null {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

async function enterSupplyChain(page: Page): Promise<void> {
  await page.goto("/?e2e=1");
  await page.getByText("Supply Chain Digital Thread", { exact: true }).click();
  await page.waitForSelector(CY_CANVAS, { timeout: 15000 });
  await page.waitForFunction(
    () => window.__g3t?.canvases.has("supply") === true,
    { timeout: 15000 },
  );
}

test.describe("CanvasAdapter rasterization", () => {
  test("Supply Chain: the harvested scene paints a non-blank, dpr-sized bitmap with the live node fills", async ({
    page,
  }) => {
    await enterSupplyChain(page);
    await page.getByTestId("thread-renderer-select").selectOption("canvas");
    const sel = "[data-testid='thread-adapter-canvas'] canvas";
    const canvas = page.locator(sel);
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-g3t-ops")))
      .toBeGreaterThan(0);

    // The expected fills are what cytoscape computed for the visible
    // nodes (hidden suppliers excluded, as the harvester excludes them).
    const fills = await page.evaluate(() => {
      const cy = window.__g3t!.canvases.get("supply")!;
      const out = new Set<string>();
      cy.nodes().forEach((n) => {
        if (n.style("display") !== "none") out.add(n.style("background-color"));
      });
      return [...out];
    });
    const fillTargets: ColorTarget[] = fills
      .map((f) => parseRgb(f))
      .filter((c): c is [number, number, number] => c !== null)
      .map((rgb, i) => ({ name: `fill${i}`, rgb }));
    expect(fillTargets.length).toBeGreaterThan(0);
    const probe: Probe = {
      targets: [{ name: "background", rgb: [11, 17, 32] }, ...fillTargets],
    };
    // The paint effect runs after commit and again after the host box
    // is measured; poll until the bitmap carries scene content.
    await expect
      .poll(async () => (await readCanvas(page, sel, probe)).distinct, {
        timeout: 10000,
      })
      .toBeGreaterThanOrEqual(3);
    const r = await readCanvas(page, sel, probe);

    // Bitmap = CSS box * devicePixelRatio (the setTransform(dpr) path).
    expect(r.width).toBe(Math.round(r.clientWidth * r.dpr));
    expect(r.height).toBe(Math.round(r.clientHeight * r.dpr));
    expect(r.width).toBeGreaterThan(0);
    // Not blank: the background wash is present but does not cover
    // everything, and more than background + one color was painted.
    expect(r.counts.background).toBeGreaterThan(0);
    expect(r.counts.background).toBeLessThan(r.total);
    expect(r.distinct).toBeGreaterThanOrEqual(3);
    // At least one node fill from the live scene landed on the bitmap.
    const fillHits = fillTargets.filter((t) => (r.counts[t.name] ?? 0) > 0);
    expect(fillHits.length).toBeGreaterThan(0);
  });

  test.describe("Style Lab F2 at devicePixelRatio 2", () => {
    test.use({ deviceScaleFactor: 2 });

    test("halo and gradient ops rasterize at the scaled resolution", async ({
      page,
    }) => {
      await page.goto("/?e2e=1");
      await page.getByText("Style Lab", { exact: true }).click();
      await page.waitForFunction(
        () => window.__g3t?.canvases.has("style-lab-engine") === true,
        { timeout: 15000 },
      );
      await page.getByTestId("style-lab-f1-renderer").selectOption("canvas");
      const sel = "[data-testid='style-lab-f2-canvas']";
      const canvas = page.locator(sel);
      await expect(canvas).toBeVisible();
      await expect
        .poll(async () => Number(await canvas.getAttribute("data-g3t-ops")))
        .toBeGreaterThan(0);

      const DANGER: [number, number, number] = [213, 94, 0]; // #D55E00
      const WARNING: [number, number, number] = [230, 159, 0]; // #E69F00
      const probe: Probe = {
        targets: [
          // The halo fills at globalAlpha 0.35 over a transparent pane,
          // so its ring interior stores alpha round(0.35 * 255) = 89
          // exactly (un-premultiplying shifts rgb by a few units, hence
          // the rgb tolerance). The alpha window is deliberately tight:
          // anti-aliased boundaries of OPAQUE danger shapes spread their
          // alphas evenly over 1..254, so a 3-wide window admits only a
          // handful of those (measured: 1 pixel without the alpha,
          // 1021 with it).
          { name: "halo", rgb: DANGER, tol: 6, alpha: [88, 90] },
          { name: "danger", rgb: DANGER },
          { name: "warning", rgb: WARNING },
        ],
        segment: { from: WARNING, to: DANGER, tol: 4, minCount: 40 },
      };
      await expect
        .poll(async () => (await readCanvas(page, sel, probe)).opaque, {
          timeout: 10000,
        })
        .toBeGreaterThan(0);
      const r = await readCanvas(page, sel, probe);

      // The pane is a fixed 640x420 CSS box; at dpr 2 the bitmap is
      // 1280x840 and the content still fills the CSS box (the transform
      // scales the scene, it does not shrink it into one quadrant).
      expect(r.dpr).toBe(2);
      expect(r.clientWidth).toBe(640);
      expect(r.width).toBe(1280);
      expect(r.height).toBe(840);
      // Without the transform the scene (laid out within the 640x420
      // CSS box) would occupy only the top-left quadrant of the bitmap;
      // with it, painted pixels reach past the half-way lines.
      expect(r.maxX).toBeGreaterThan(640);
      expect(r.maxY).toBeGreaterThan(420);
      // Halo: the translucent ring around the high-risk hub, outside
      // its opaque body, is hundreds of alpha-89 pixels at dpr 2.
      expect(r.counts.halo).toBeGreaterThanOrEqual(200);
      // Gradient: the critical tapers carry many interior steps on the
      // warning->danger line; flat fills (the high-risk node body is
      // danger, the donut arcs are the two endpoints) contribute none
      // that clear the per-color minimum.
      expect(r.segmentSteps).toBeGreaterThanOrEqual(4);
    });
  });
});

test("Supply Chain: the Minimap paints the overview", async ({ page }) => {
  await enterSupplyChain(page);
  const minimap = page.getByTestId("minimap");
  await expect(minimap).not.toHaveAttribute("data-disabled");
  const sel = "[data-testid='minimap'] canvas";
  const probe: Probe = {
    targets: [
      // Dark theme: the wash and the node dots. Both may sit under the
      // 15%-alpha viewport fill, hence tolerances rather than exact.
      { name: "wash", rgb: [37, 38, 43], tol: 12 },
      { name: "dot", rgb: [173, 181, 189], tol: 40 },
    ],
  };
  // The first frame is scheduled off requestAnimationFrame after the
  // core arrives; poll until marks are on the bitmap.
  await expect
    .poll(async () => (await readCanvas(page, sel, probe)).counts.dot, {
      timeout: 10000,
    })
    .toBeGreaterThan(0);
  const r = await readCanvas(page, sel, probe);
  expect(r.width).toBe(Math.round(180 * r.dpr));
  expect(r.height).toBe(Math.round(120 * r.dpr));
  expect(r.counts.wash).toBeGreaterThan(0);
  expect(r.counts.wash).toBeLessThan(r.total);
  expect(r.distinct).toBeGreaterThanOrEqual(3);
});
