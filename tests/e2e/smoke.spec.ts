import { test, expect } from "@playwright/test";

test("app renders hello world", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("h1")).toHaveText("g3-toolkit");
  await expect(page.locator("p")).toContainText("Graph visualization toolkit");

  await expect(page).toHaveScreenshot("hello-world.png");
});
