/**
 * ThemeManager bridge tests (G3L:STY-006 interop): the projection is
 * pure, carries the theme's own palette through, and the projected
 * theme drives the engine with the theme's canvas-consistent label
 * colors.
 */
import { describe, expect, it } from "vitest";
import { resolveStyles } from "@g3t/core";
import { DARK_THEME, LIGHT_THEME } from "./ThemeManager";
import {
  styleThemeFromG3tTheme,
  tokensFromG3tTheme,
} from "./style-theme-bridge";

describe("style-theme bridge", () => {
  it("projects light and dark themes into tokens with the theme's own palette", () => {
    for (const theme of [LIGHT_THEME, DARK_THEME]) {
      const tokens = tokensFromG3tTheme(theme);
      expect(tokens.color.canvas).toBe(theme.canvasBg);
      expect(tokens.color.textPrimary).toBe(theme.textPrimary);
      expect(tokens.color.categorical).toBe(theme.typePalette);
    }
  });

  it("the projected StyleTheme drives the engine end to end", () => {
    const theme = DARK_THEME;
    const out = resolveStyles(
      {
        elements: [
          { id: "n", kind: "node", data: {} },
          { id: "e", kind: "edge", data: {} },
        ],
      },
      { theme: styleThemeFromG3tTheme(theme) },
    );
    expect(out.get("n")?.labelColor).toBe(theme.textPrimary);
    expect(out.get("e")?.stroke).toBe(theme.textSecondary);
  });
});
