/**
 * Interaction E2E tests (migrates m1_interaction.robot).
 *
 * Covers: table selection, cross-view sync, sorting, pagination,
 * filter, search, layout switcher.
 */

import { test, expect } from "@playwright/test";

const HARNESS = "/?test-harness";

test.describe("Table interactions (M1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
    await page.waitForTimeout(1500);
  });

  test("clicking a table row selects the node", async ({ page }) => {
    const row = page.locator("[data-testid^='table-row-']").first();
    await row.click();
    await expect(row).toHaveAttribute("data-selected", "true");
  });

  test("clicking a different row replaces the selection", async ({ page }) => {
    const rows = page.locator("[data-testid^='table-row-']");
    // The harness fixture is 20 nodes at pageSize 10, so a count below
    // 2 is a broken fixture and must fail rather than skip the body.
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
    await rows.nth(0).click();
    await rows.nth(1).click();
    await expect(rows.nth(0)).not.toHaveAttribute("data-selected", "true");
    await expect(rows.nth(1)).toHaveAttribute("data-selected", "true");
  });

  test("table columns are sortable", async ({ page }) => {
    // Was: click a header, then assert its text is non-empty, which is
    // true of any header whether or not sorting works.
    //
    // The first rewrite clicked the `th` and failed (2026-08-16): the
    // sort handler is on a div inside the th, and the th also holds the
    // inline filter input, so the click landed on the input. Click the
    // affordance by its own testid. Sort state is on the th as
    // aria-sort; the mechanism is unit-tested in TableView.test.tsx.
    const header = page.locator("th").filter({ hasText: "Types" });
    await expect(header).toHaveAttribute("aria-sort", "none");
    await page.locator("[data-testid='column-sort-types']").click();
    await page.waitForTimeout(300);
    await expect(header).toHaveAttribute("aria-sort", "ascending");
  });
});

test.describe("Filter and search (M1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForSelector("[data-testid='cytoscape-canvas']", {
      timeout: 10000,
    });
    await page.waitForTimeout(1500);
  });

  test("facet filter shows node types with checkboxes", async ({ page }) => {
    const filter = page.locator("[data-testid='facet-filter']");
    await expect(filter).toBeVisible();
    const checkboxes = filter.locator("input[type='checkbox']");
    expect(await checkboxes.count()).toBeGreaterThan(0);
  });

  test("unchecking a type reports it as hidden", async ({ page }) => {
    // The old body unchecked a box and asserted nothing, under a guard,
    // with a comment describing the assertion it never made. The
    // harness renders the hidden-type set as text, which is the
    // observable effect of the filter change.
    const checkbox = page.locator(
      "[data-testid='facet-Location'] input[type='checkbox']",
    );
    await checkbox.uncheck();
    await page.waitForTimeout(200);
    await expect(page.locator("[data-testid='hidden-types']")).toContainText(
      "Location",
    );
  });

  test("search input reports a match count", async ({ page }) => {
    // Was: type "alice" into a fixture that contains no such node, then
    // assert nothing. The harness fixture is "Node N", so a query that
    // matches is the only way to observe the search working.
    const searchInput = page.locator("[data-testid='search-input']");
    await searchInput.fill("Node 1");
    await page.waitForTimeout(300);
    await expect(page.locator("[data-testid='search-info']")).toContainText(
      "matches",
    );
  });
});
