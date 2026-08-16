// VR-2 (owner verification 2026-07-26): browser-level falsifier for
// color-by-confidence. The unit oracle (confidence-color.test.ts)
// proves the data path; this proves the PRESENTATION against the
// production bundle: selecting Color must actually paint edges.
import { test, expect } from "@playwright/test";

test.describe("supply: color by confidence (VR-2)", () => {
  test("selecting Color paints merged supplies edges amber", async ({
    page,
  }) => {
    await page.goto("/?e2e=1");
    await page.getByText("Supply Chain Digital Thread").click();
    const select = page.getByTestId("sc-dim-confidence");
    await expect(select).toBeVisible();
    await select.selectOption("color");
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const cy = (
              window as unknown as {
                __g3t?: { canvases: Map<string, unknown> };
              }
            ).__g3t?.canvases.get("supply") as
              | {
                  edges: (sel: string) => {
                    length: number;
                    first: () => { style: (p: string) => string };
                  };
                }
              | undefined;
            if (!cy) return "no-core";
            const merged = cy.edges("[type = 'supplies']");
            if (merged.length === 0) return "no-edges";
            return merged.first().style("line-color");
          }),
        { timeout: 8000 },
      )
      .toBe("rgb(234,179,8)"); // #eab308 amber
    // And authoritative links are green.
    const green = await page.evaluate(() => {
      const cy = (
        window as unknown as { __g3t?: { canvases: Map<string, unknown> } }
      ).__g3t?.canvases.get("supply") as
        | {
            edges: (sel: string) => {
              length: number;
              first: () => { style: (p: string) => string };
            };
          }
        | undefined;
      const own = cy?.edges("[type = 'partOf']");
      return own && own.length > 0 ? own.first().style("line-color") : "none";
    });
    expect(green).toBe("rgb(34,197,94)"); // #22c55e
  });
});
