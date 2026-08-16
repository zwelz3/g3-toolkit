/**
 * Cross-package name collisions, pinned.
 *
 * Three names meant two different things across `@g3t/core` and
 * `@g3t/react`. None of them was catchable by the existing gates:
 * `check-api-surface.mjs` compares name SETS per entry point, so two
 * entries exporting the same name with different meanings look
 * correct, and `check-type-reachability.mjs` only asks whether a name
 * is reachable, not whether it is the same name.
 *
 * So the invariant is asserted here instead, at the value level where
 * it can be. A type-level collision (`ShaclShape`) cannot be tested at
 * runtime, so the compiler carries that one and this file documents
 * where it is pinned.
 */
import { describe, it, expect } from "vitest";
import { OKABE_ITO, contrastRatio as coreContrastRatio } from "@g3t/core";
import { OKABE_ITO_COLORS } from "./views/canvas/palette";
import { CANVAS_CATEGORICAL } from "./interaction/encoding/palette-bridge";
import { contrastRatioOrNull } from "./theme/ThemeManager";
import { contrastRatio as reactContrastRatio } from "./theme";

describe("contrastRatio means one function", () => {
  it("the name resolves to core's implementation on both packages", () => {
    // `@g3t/react` used to export its OWN contrastRatio under this
    // name, returning `number | null`. Re-exporting core's is the
    // LayoutOptions precedent: the shared name gets one meaning.
    expect(reactContrastRatio).toBe(coreContrastRatio);
    expect(reactContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("the null-returning variant is a DIFFERENT function, named so", () => {
    expect(contrastRatioOrNull).not.toBe(coreContrastRatio);
    // The behavioral difference the two names now carry. `createTheme`
    // depends on this: a theme may hold an rgba() value that must be
    // SKIPPED rather than scored, and core's would score it.
    expect(contrastRatioOrNull("rgba(0,0,0,0.5)", "#fff")).toBeNull();
    expect(contrastRatioOrNull("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
});

describe("the categorical palettes are distinct values with distinct names", () => {
  it("they genuinely differ, so sharing a name hid a value difference", () => {
    // This is why the alias was worth removing rather than tidying:
    // `palette-bridge` re-exported the canvas palette as `OKABE_ITO`,
    // so the name meant grey here and black in core.
    expect(OKABE_ITO_COLORS).not.toEqual(OKABE_ITO);
    expect(OKABE_ITO.at(-1)).toBe("#000000");
    expect(OKABE_ITO_COLORS.at(-1)).toBe("#999999");
  });

  it("they agree on the seven entries that are not the substitution", () => {
    expect(OKABE_ITO_COLORS.slice(0, 7)).toEqual(OKABE_ITO.slice(0, 7));
  });

  it("the bridge exports the canvas palette under a canvas name", () => {
    expect(CANVAS_CATEGORICAL).toBe(OKABE_ITO_COLORS);
  });

  it("no react entry point exports the name OKABE_ITO", async () => {
    // The collision would come back the moment a barrel re-exported
    // the canvas palette under core's name again.
    const barrels = await Promise.all([
      import("./index"),
      import("./views/index"),
      import("./theme/index"),
      import("./interaction/index"),
    ]);
    for (const barrel of barrels) {
      const exported = Object.keys(barrel);
      if (exported.includes("OKABE_ITO")) {
        // If a future round re-exports CORE's palette here that is
        // fine, but it must be core's value, not the canvas one.
        expect(
          (barrel as Record<string, unknown>)["OKABE_ITO"],
          "OKABE_ITO on a react entry must be core's palette, not the canvas substitution",
        ).toEqual(OKABE_ITO);
      }
    }
  });
});
