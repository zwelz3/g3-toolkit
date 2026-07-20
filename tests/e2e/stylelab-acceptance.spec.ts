/**
 * Style Lab browser acceptance: every finding from the MR-7 review
 * cycle, machine-checked so it can never silently regress:
 *
 *  - the LIVE parity table computes 0 mismatches (the browser-side
 *    confirmation of the headless oracle)
 *  - the LOD dropdown DRIVES the engine pane, and the DOWN-tier
 *    restore works (the stale-bypass class resetFirst fixed)
 *  - the back affordance navigates to the landing
 *  - the page does NOT grow vertically over time (the
 *    resize-observer feedback-loop class)
 *
 * AUTHORED HEADLESSLY (established suite doctrine): first execution
 * is CI or a maintainer's local `pnpm run test:e2e`.
 */
import { test, expect, type Page } from "@playwright/test";

async function openStyleLab(page: Page): Promise<void> {
  await page.goto("/?e2e=1");
  await page.getByText("Style Lab", { exact: true }).click();
  await page.waitForSelector("[data-testid='style-lab-parity-summary']", {
    timeout: 15000,
  });
  await page.waitForFunction(
    () => {
      const g = window.__g3t;
      return (
        g !== undefined &&
        g.canvases.has("style-lab-legacy") &&
        g.canvases.has("style-lab-engine")
      );
    },
    { timeout: 15000 },
  );
}

test.describe("Style Lab acceptance", () => {
  test("live parity summary reports 0 mismatches", async ({ page }) => {
    await openStyleLab(page);
    await expect(page.getByTestId("style-lab-parity-summary")).toContainText(
      /0 mismatches/,
    );
  });

  test("LOD dropdown drives the engine pane, and DOWN-tier restores (resetFirst class)", async ({
    page,
  }) => {
    await openStyleLab(page);
    const labelOpacity = () =>
      page.evaluate(() =>
        String(
          window
            .__g3t!.canvases.get("style-lab-engine")!
            .$id("n1")
            .style("text-opacity"),
        ),
      );
    expect(await labelOpacity()).not.toBe("0");
    // Hairball context: node labels off in the engine pane.
    await page.getByTestId("style-lab-lod-select").selectOption("3");
    await expect.poll(labelOpacity, { timeout: 5000 }).toBe("0");
    // Back to close-up: labels MUST come back (the defect class the
    // shell test caught headlessly, now pinned through the browser).
    await page.getByTestId("style-lab-lod-select").selectOption("0");
    // F2: switch the third pane to the Canvas adapter; the display
    // list must be non-empty (ops exposed on the element).
    await page.getByTestId("style-lab-f1-renderer").selectOption("canvas");
    const canvas = page.getByTestId("style-lab-f2-canvas");
    await expect(canvas).toBeVisible();
    const opsCount = await canvas.getAttribute("data-g3t-ops");
    expect(Number(opsCount)).toBeGreaterThan(0);
    await page.getByTestId("style-lab-f1-renderer").selectOption("svg");
    await expect.poll(labelOpacity, { timeout: 5000 }).not.toBe("0");
  });

  test("back affordance returns to the landing", async ({ page }) => {
    await openStyleLab(page);
    await page.getByTestId("style-lab-back").click();
    await expect(page.getByText("Style Lab", { exact: true })).toBeVisible();
    await expect(
      page.locator("[data-testid='style-lab-parity-summary']"),
    ).toHaveCount(0);
  });

  test("the page does not grow vertically over time (growth-loop class)", async ({
    page,
  }) => {
    await openStyleLab(page);
    // Let one full layout/resize settle, then measure twice across a
    // window long enough for a feedback loop to add many frames of
    // growth (the original bug grew every frame).
    await page.waitForTimeout(750);
    const h1 = await page.evaluate(() => document.body.scrollHeight);
    await page.waitForTimeout(1500);
    const h2 = await page.evaluate(() => document.body.scrollHeight);
    expect(Math.abs(h2 - h1)).toBeLessThanOrEqual(2);
  });
});

test.describe("F1: SVG adapter pane", () => {
  test("renders the engine-only decorations natively and follows LOD", async ({
    page,
  }) => {
    await openStyleLab(page);
    const svg = page.locator("[data-testid='style-lab-f1-svg']");
    await expect(svg).toBeVisible();
    // The fixture's engine-only zone becomes pixels: a halo ring on
    // the high-risk hub, a donut ring on hubs, a taper polygon
    // painted by a shared gradient def.
    await expect(svg.locator("[data-svg-halo]").first()).toBeAttached();
    await expect(svg.locator("[data-svg-donut]").first()).toBeAttached();
    const taper = svg.locator("[data-svg-taper]").first();
    await expect(taper).toBeAttached();
    const fill = await taper.getAttribute("fill");
    expect(fill?.startsWith("url(#g3t-grad-")).toBe(true);
    const defId = fill!.slice(5, -1);
    await expect(svg.locator(`linearGradient[id='${defId}']`)).toBeAttached();
    // The LOD dropdown drives this pane too (same select idiom as
    // the engine-pane test): the far tier hides SVG labels.
    const labelCount = await svg.locator("[data-svg-label]").count();
    expect(labelCount).toBeGreaterThan(0);
    await page.getByTestId("style-lab-lod-select").selectOption("3");
    await expect
      .poll(async () => svg.locator("[data-svg-label]").count())
      .toBeLessThan(labelCount);
    // And restores on the way back down-tier.
    await page.getByTestId("style-lab-lod-select").selectOption("0");
    await expect
      .poll(async () => svg.locator("[data-svg-label]").count())
      .toBe(labelCount);
  });
});
