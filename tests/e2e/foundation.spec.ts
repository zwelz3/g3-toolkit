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

  // DELETED 2026-08-15: "right-click opens context menu". Its body was
  // a right-click and a comment; it asserted nothing, so it could not
  // fail. Writing the assertion it implies needs a decision this file
  // cannot make: a background right-click only opens a menu when the
  // manager resolves items for a "background" target, and the harness
  // registers none, so the honest assertion is that NO menu appears,
  // which is not what the title claims. Canvas context menus are
  // asserted where they are actually wired: selection.spec's table-row
  // right-click.

  test("inspector shows node properties on selection", async ({ page }) => {
    // Both guards removed: the harness renders the table and mounts
    // DetailInspector into sidebar-right unconditionally, so an
    // if-visible check here only converted a real regression into a
    // silent pass.
    const firstRow = page.locator("[data-testid^='table-row-']").first();
    await firstRow.click();
    const inspector = page.locator("[data-testid='detail-inspector']");
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText(/name|type|id/i);
  });

  // DELETED 2026-08-15: "status bar shows node and edge counts". The
  // status bar lives in UxSurface, which the test harness does not
  // mount, so the guard was permanently false and the test was a
  // no-op. Converting it to a real assertion would land a
  // guaranteed-red gate, which planning/audit-remediation.md already
  // rules against. Restore it against a fixture that renders
  // UxSurface, or drop the intent.
});
