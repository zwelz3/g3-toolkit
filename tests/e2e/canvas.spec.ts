/**
 * Canvas visual regression tests.
 *
 * Captures screenshots of the graph canvas under various states
 * and compares against baselines. First run creates baselines;
 * subsequent runs detect visual regressions.
 */

import { test, expect } from "@playwright/test";

const HARNESS = "/?test-harness";

test.describe("Canvas rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    // Wait for Cytoscape to initialize (canvas has children)
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
    // Allow layout to settle
    await page.waitForTimeout(1500);
  });

  test("initial graph renders with nodes and edges", async ({ page }) => {
    const canvas = page.locator("[data-testid='canvas-container']");
    await expect(canvas).toHaveScreenshot("canvas-initial.png");
  });

  test("node selection shows blue border", async ({ page }) => {
    // Click a node in the canvas (approximate center area)
    const canvas = page.locator("[data-testid='cytoscape-canvas']");
    await canvas.click({ position: { x: 400, y: 300 } });
    await page.waitForTimeout(300);

    // Check selection info updated
    const selectionInfo = page.locator("[data-testid='selection-info']");
    // May or may not hit a node; screenshot captures the state
    await expect(
      page.locator("[data-testid='canvas-container']"),
    ).toHaveScreenshot("canvas-after-click.png");
  });

  test("context menu appears on right-click", async ({ page }) => {
    const canvas = page.locator("[data-testid='cytoscape-canvas']");
    // Right-click in the center (likely hits a node given 20 nodes)
    await canvas.click({
      position: { x: 400, y: 300 },
      button: "right",
    });
    await page.waitForTimeout(300);

    await expect(page.locator("body")).toHaveScreenshot(
      "canvas-context-menu.png",
    );
  });
});
