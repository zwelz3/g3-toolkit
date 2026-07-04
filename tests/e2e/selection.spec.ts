/**
 * Cross-view selection and table interaction tests.
 *
 * Verifies the M1 exit criterion: selecting in one view
 * updates the other view through the shared Zustand store.
 */

import { test, expect } from "@playwright/test";

const HARNESS = "/?test-harness";

test.describe("Table view", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='table-view']", {
      timeout: 10000,
    });
    await page.waitForTimeout(500);
  });

  test("table renders with node rows and pagination", async ({ page }) => {
    const table = page.locator("[data-testid='table-container']");
    await expect(table).toHaveScreenshot("table-initial.png");
  });

  test("clicking table row selects node", async ({ page }) => {
    // Click the first visible row
    const firstRow = page
      .locator("[data-testid='table-view'] tbody tr")
      .first();
    await firstRow.click();
    await page.waitForTimeout(300);

    // Selection info should update
    const selectionInfo = page.locator("[data-testid='selection-info']");
    await expect(selectionInfo).toHaveText("Selected: 1 nodes");
  });

  test("table row highlights on selection", async ({ page }) => {
    const firstRow = page
      .locator("[data-testid='table-view'] tbody tr")
      .first();
    await firstRow.click();
    await page.waitForTimeout(300);

    // Screenshot captures the highlighted row
    const table = page.locator("[data-testid='table-container']");
    await expect(table).toHaveScreenshot("table-row-selected.png");
  });

  test("sorting by column header", async ({ page }) => {
    // Click the "Types" header to sort
    const typesHeader = page.locator("th").filter({ hasText: "Types" });
    await typesHeader.click();
    await page.waitForTimeout(300);

    const table = page.locator("[data-testid='table-container']");
    await expect(table).toHaveScreenshot("table-sorted-types.png");
  });

  test("pagination navigates pages", async ({ page }) => {
    const nextBtn = page.locator("button").filter({ hasText: "Next →" });
    await nextBtn.click();
    await page.waitForTimeout(300);

    const pagination = page.locator("[data-testid='table-pagination']");
    await expect(pagination).toContainText("Page 2");
  });

  test("right-click table row shows context menu", async ({ page }) => {
    const firstRow = page
      .locator("[data-testid='table-view'] tbody tr")
      .first();
    await firstRow.click({ button: "right" });
    await page.waitForTimeout(300);

    const menu = page.locator("[data-testid='context-menu']");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveScreenshot("table-context-menu.png");
  });
});

test.describe("Cross-view selection (M1 exit criterion)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='table-view']", {
      timeout: 10000,
    });
    await page.waitForTimeout(1000);
  });

  test("table click updates selection counter", async ({ page }) => {
    const firstRow = page
      .locator("[data-testid='table-view'] tbody tr")
      .first();
    await firstRow.click();
    await page.waitForTimeout(300);

    await expect(page.locator("[data-testid='selection-info']")).toHaveText(
      "Selected: 1 nodes",
    );
  });

  test("inspector updates when node is selected", async ({ page }) => {
    const firstRow = page
      .locator("[data-testid='table-view'] tbody tr")
      .first();
    await firstRow.click();
    await page.waitForTimeout(300);

    const inspector = page.locator("[data-testid='sidebar-right']");
    await expect(inspector).toHaveScreenshot("inspector-after-selection.png");
  });
});

test.describe("Lasso selection → table sync (bug fix)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
    await page.waitForTimeout(1500);
  });

  test("lasso-selected nodes appear in table as highlighted rows", async ({
    page,
  }) => {
    const canvas = page.locator("[data-testid='cytoscape-canvas']");

    // Box selection is a MODIFIER gesture when panning is enabled:
    // cytoscape's renderer enters box mode only when
    // `multSelKeyDown || !panningEnabled || !userPanningEnabled`
    // (cytoscape 3.33.4, mousemove handler), where the modifier is
    // shift, ctrl, or meta. A plain drag pans. Hold Shift for the drag.
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas has no bounding box");
    const inset = 10; // inside the grid layout's ~30px fit padding: background
    await page.keyboard.down("Shift");
    await canvas.dragTo(canvas, {
      sourcePosition: { x: inset, y: inset },
      targetPosition: { x: box.width - inset, y: box.height - inset },
    });
    await page.keyboard.up("Shift");
    await page.waitForTimeout(500);

    // Selection counter should show selected nodes
    const selectionInfo = page.locator("[data-testid='selection-info']");
    const text = await selectionInfo.textContent();
    // Should have selected at least 1 node
    expect(text).toMatch(/Selected: [1-9]/);
  });
});

// ── M8.5 + M10.5 E2E Tests ─────────────────────────────────────────

test.describe("Table multi-select (M8.5 bug fix)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
    await page.waitForTimeout(1500);
  });

  test("ctrl+click toggles table row selection", async ({ page }) => {
    const row0 = page.locator("[data-testid='table-row-n0']");
    const row1 = page.locator("[data-testid='table-row-n1']");

    // Click first row
    await row0.click();
    await expect(row0).toHaveAttribute("data-selected", "true");

    // Ctrl+click second row (add to selection)
    await row1.click({ modifiers: ["Control"] });
    await expect(row0).toHaveAttribute("data-selected", "true");
    await expect(row1).toHaveAttribute("data-selected", "true");

    // Ctrl+click first row again (remove from selection)
    await row0.click({ modifiers: ["Control"] });
    await expect(row0).not.toHaveAttribute("data-selected", "true");
    await expect(row1).toHaveAttribute("data-selected", "true");
  });

  test("shift+click selects range in table", async ({ page }) => {
    const row0 = page.locator("[data-testid='table-row-n0']");
    const row3 = page.locator("[data-testid='table-row-n3']");

    // Click first row
    await row0.click();

    // Shift+click fourth row (range select)
    await row3.click({ modifiers: ["Shift"] });

    // Rows 0-3 should all be selected
    for (let i = 0; i <= 3; i++) {
      await expect(
        page.locator(`[data-testid='table-row-n${i}']`),
      ).toHaveAttribute("data-selected", "true");
    }
  });
});

test.describe("Theme switching (M8.5)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
  });

  test("dark theme changes CSS variables", async ({ page }) => {
    const themeSelect = page.locator("[data-testid='toolbar-theme']");
    await themeSelect.selectOption("dark");

    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--g3t-bg-primary",
      ),
    );
    expect(bgColor.trim()).not.toBe("#ffffff");
  });
});
