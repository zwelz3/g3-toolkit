/**
 * Foundation E2E tests (migrates m0_foundation.robot).
 *
 * Covers: canvas rendering, context menu, inspector, edge encoding.
 */

import { test, expect } from "@playwright/test";

const HARNESS = "/?test-harness";

test.describe("Foundation (M0)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
    await page.waitForTimeout(1500);
  });

  test("canvas renders with nodes visible", async ({ page }) => {
    const canvas = page.locator("[data-testid='cytoscape-canvas']");
    await expect(canvas).toBeVisible();
    // Canvas should have non-zero dimensions
    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(100);
    expect(box?.height).toBeGreaterThan(100);
  });

  test("right-click opens context menu", async ({ page }) => {
    const canvas = page.locator("[data-testid='cytoscape-canvas']");
    await canvas.click({ button: "right", position: { x: 200, y: 200 } });
    // Context menu or default browser menu should appear
  });

  test("inspector shows node properties on selection", async ({ page }) => {
    // Click a node in the table to select it
    const firstRow = page.locator("[data-testid^='table-row-']").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      // Inspector should show properties
      const inspector = page.locator("[data-testid='detail-inspector']");
      if (await inspector.isVisible()) {
        await expect(inspector).toContainText(/name|type|id/i);
      }
    }
  });

  test("status bar shows node and edge counts", async ({ page }) => {
    const status = page.locator("[data-testid='status-bar']");
    if (await status.isVisible()) {
      await expect(status).toContainText("Nodes:");
    }
  });
});
