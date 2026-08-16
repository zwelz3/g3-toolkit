/**
 * Graph toolbar INTERACTION spec (G3L Round 49).
 *
 * The owner reports the toolbar "still broken" in production
 * preview while the mount-level smoke stays green: whatever is
 * broken is behavioral. This spec drives every toolbar control on
 * the Scale surface against the production bundle and asserts a
 * console-clean run after each step, so the owner's next e2e run
 * converts "broken" into a failing step with a named error.
 */
import { expect, test, type Page } from "@playwright/test";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

test("toolbar interactions run console-clean on Scale (production)", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/?e2e=1");
  await page.getByText("Scale", { exact: true }).first().click();
  const toolbar = page.getByTestId("g3t-graph-toolbar");
  await expect(toolbar).toBeVisible({ timeout: 15_000 });

  // 0. STYLESHEET WITNESS (round 50): g3t-base.css was tree-shaken
  //    out of production builds once (the owner's "almost seems
  //    like a css thing" toolbar break): an unstyled toolbar still
  //    mounts and stays console-clean, so mount smokes miss it.
  //    The base rule sets display:flex; an unstyled div computes
  //    "block". Assert the stylesheet actually APPLIED.
  const display = await toolbar.evaluate((el) => getComputedStyle(el).display);
  expect(display, "g3t-base.css must ship and apply in production").toBe(
    "flex",
  );

  // 1. Search: type, expect the input to hold the text and the run
  //    to stay clean.
  const search = page.locator(".g3t-graph-toolbar-search input").first();
  await search.fill("c1");
  await expect(search).toHaveValue("c1");
  await page.waitForTimeout(400);

  // 2. Layout switch: every option in the select, Run after each.
  const select = toolbar.locator("select.g3t-select").first();
  const optionValues = await select
    .locator("option")
    .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(optionValues.length).toBeGreaterThan(2);
  for (const value of optionValues) {
    await select.selectOption(value);
    await page.waitForTimeout(600);
    expect(errors, `layout "${value}" should apply without errors`).toEqual([]);
  }

  // 3. Options popover + explicit Run.
  const optionsToggle = toolbar.locator("button", { hasText: /options/i });
  if ((await optionsToggle.count()) > 0) {
    await optionsToggle.first().click();
    await expect(page.getByTestId("toolbar-layout-options")).toBeVisible();
    await page.getByTestId("toolbar-run-layout").click();
    await page.waitForTimeout(600);
  }

  // 4. Re-run + shuffle. Shuffle is DISABLED outside force layouts
  //    by design (owner run 2026-07-22 caught this spec clicking it
  //    while a non-force layout was active): select the first
  //    layout (force) before exercising it, and guard on
  //    enabledness rather than existence.
  const firstLayout = optionValues[0];
  if (firstLayout === undefined) throw new Error("no layout options");
  await select.selectOption(firstLayout);
  await page.waitForTimeout(600);
  for (const id of ["toolbar-rerun", "toolbar-shuffle"]) {
    const btn = page.getByTestId(id);
    if ((await btn.count()) > 0 && (await btn.isEnabled())) {
      await btn.click();
      await page.waitForTimeout(600);
      expect(errors, `${id} should run without errors`).toEqual([]);
    }
  }

  expect(errors, "the full toolbar pass should be console-clean").toEqual([]);
});
