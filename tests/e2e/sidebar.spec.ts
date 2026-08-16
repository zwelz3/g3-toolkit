/**
 * Sidebar interaction tests: filter, search, layout switcher.
 */

import { test, expect } from "@playwright/test";

const HARNESS = "/?test-harness";

test.describe("Faceted filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='facet-filter']", {
      timeout: 10000,
    });
  });

  test("filter panel shows all node types with counts", async ({ page }) => {
    const filter = page.locator("[data-testid='facet-filter']");
    await expect(filter).toContainText("Person");
    await expect(filter).toContainText("Organization");
    await expect(filter).toContainText("Location");
  });

  test("unchecking a type updates hidden types display", async ({ page }) => {
    const locationCheckbox = page.locator(
      "[data-testid='facet-Location'] input[type='checkbox']",
    );
    await locationCheckbox.uncheck();
    await page.waitForTimeout(200);

    const hiddenDisplay = page.locator("[data-testid='hidden-types']");
    await expect(hiddenDisplay).toContainText("Location");
  });
});

test.describe("Search bar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='search-input']", {
      timeout: 10000,
    });
  });

  test("typing in search shows match count", async ({ page }) => {
    const searchInput = page.locator("[data-testid='search-input']");
    await searchInput.fill("Node 1");
    await page.waitForTimeout(200);

    const searchInfo = page.locator("[data-testid='search-info']");
    await expect(searchInfo).toBeVisible();
    // "Node 1" matches Node 1, Node 10-19 = 11 matches
    await expect(searchInfo).toContainText("matches");
  });

  test("clearing search removes match info", async ({ page }) => {
    const searchInput = page.locator("[data-testid='search-input']");
    await searchInput.fill("Node 1");
    await page.waitForTimeout(200);
    await searchInput.fill("");
    await page.waitForTimeout(200);

    const searchInfo = page.locator("[data-testid='search-info']");
    await expect(searchInfo).not.toBeVisible();
  });
});

test.describe("Layout switcher", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='layout-switcher']", {
      timeout: 10000,
    });
  });

  test("layout switcher shows all engine buttons", async ({ page }) => {
    const switcher = page.locator("[data-testid='layout-switcher']");
    await expect(switcher).toContainText("Force-Directed");
    await expect(switcher).toContainText("Hierarchical Tree");
    await expect(switcher).toContainText("DAG (Dagre)");
    await expect(switcher).toContainText("Layered (g3t)");
  });

  test("clicking layout button changes active highlight", async ({ page }) => {
    const dagreBtn = page.locator("[data-testid='layout-btn-dagre']");
    await expect(dagreBtn).toHaveAttribute("aria-pressed", "false");
    await dagreBtn.click();
    await page.waitForTimeout(300);

    // The active engine is carried on the button as aria-pressed. The
    // screenshot this replaces compared against no baseline, so the
    // test passed whether or not the click did anything.
    await expect(dagreBtn).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Harness composition", () => {
  // Was "Full harness screenshot", a single page-level toHaveScreenshot
  // against no baseline. What it was really guarding is that every
  // region of the harness mounts, which is assertable without a
  // baseline and fails loudly if a panel stops rendering.
  test("every harness region mounts", async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='test-harness']", {
      timeout: 10000,
    });
    await page.waitForTimeout(2000); // layout settle

    for (const id of [
      "sidebar-left",
      "canvas-container",
      "table-container",
      "sidebar-right",
      "layout-switcher",
      "facet-filter",
      "search-input",
      "selection-info",
    ]) {
      await expect(page.locator(`[data-testid='${id}']`)).toBeVisible();
    }
  });
});
