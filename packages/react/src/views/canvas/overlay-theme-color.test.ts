/**
 * Overlay member colors follow the theme (issue #32).
 *
 * Headless cytoscape with styleEnabled so the assertion is on the
 * COMPUTED style through the real composeCanvasStylesheet order, not on
 * which rule objects exist: the defect was precisely an ordering one
 * (the static OVERLAY_RULES literals landed after the theme block and
 * took the property), which a rule-presence test cannot see.
 */
import { describe, expect, it } from "vitest";
import cytoscape from "cytoscape";
import {
  createTheme,
  DARK_THEME,
  LIGHT_THEME,
  THEME_PRESETS,
  type G3tTheme,
} from "../../theme/ThemeManager";
import {
  composeCanvasStylesheet,
  DEFAULT_OVERLAY_COLOR,
  OVERLAY_RULES,
  overlayThemeRules,
} from "./CytoscapeCanvas";

/** Hex to cytoscape's normalized "rgb(r,g,b)" rendering. */
function rgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}

function mount(theme: G3tTheme) {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: [
      { group: "nodes", data: { id: "a" } },
      { group: "nodes", data: { id: "b" } },
      { group: "edges", data: { id: "ab", source: "a", target: "b" } },
    ],
    style: composeCanvasStylesheet(theme) as never,
  });
  cy.elements().addClass("g3t-ov-member");
  return cy;
}

describe("overlay member colors follow the theme (issue #32)", () => {
  it("a custom theme's overlayColor reaches node borders and edge lines", () => {
    const theme = createTheme(
      { id: "host", name: "Host", overlayColor: "#ff00aa" },
      DARK_THEME,
    );
    const cy = mount(theme);
    expect(cy.$id("a").style("border-color")).toBe(rgb("#ff00aa"));
    expect(cy.$id("ab").style("line-color")).toBe(rgb("#ff00aa"));
    expect(cy.$id("ab").style("target-arrow-color")).toBe(rgb("#ff00aa"));
    // Geometry still comes from the static block.
    expect(cy.$id("a").style("border-width")).toBe("3px");
    cy.destroy();
  });

  it("tones take the theme's semantic colors, not the static literals", () => {
    const theme = createTheme(
      { id: "host", name: "Host", error: "#123456", overlayColor: "#ff00aa" },
      DARK_THEME,
    );
    const cy = mount(theme);
    cy.$id("a").addClass("g3t-ov-danger");
    cy.$id("ab").addClass("g3t-ov-danger");
    expect(cy.$id("a").style("border-color")).toBe(rgb("#123456"));
    expect(cy.$id("ab").style("line-color")).toBe(rgb("#123456"));
    cy.destroy();
  });

  it("the default stays the historical green, with or without the field", () => {
    const bare: G3tTheme = { ...LIGHT_THEME };
    delete bare.overlayColor;
    for (const theme of [LIGHT_THEME, bare]) {
      const cy = mount(theme);
      expect(cy.$id("a").style("border-color")).toBe(
        rgb(DEFAULT_OVERLAY_COLOR),
      );
      expect(cy.$id("ab").style("line-color")).toBe(rgb(DEFAULT_OVERLAY_COLOR));
      cy.destroy();
    }
    expect(DEFAULT_OVERLAY_COLOR).toBe("#2f9e44");
  });

  it("the static and theme-derived stylesheets agree on the default", () => {
    const colorOf = (
      rules: ReturnType<typeof overlayThemeRules>,
      sel: string,
    ) =>
      (
        rules.find((r) => r.selector === sel) as unknown as {
          style: Record<string, unknown>;
        }
      ).style;
    expect(colorOf(OVERLAY_RULES, "node.g3t-ov-member")["border-color"]).toBe(
      DEFAULT_OVERLAY_COLOR,
    );
    expect(colorOf(OVERLAY_RULES, "edge.g3t-ov-member")["line-color"]).toBe(
      DEFAULT_OVERLAY_COLOR,
    );
    for (const theme of Object.values(THEME_PRESETS)) {
      expect(theme.overlayColor).toBe(DEFAULT_OVERLAY_COLOR);
      const rules = overlayThemeRules(theme);
      expect(colorOf(rules, "node.g3t-ov-member")["border-color"]).toBe(
        DEFAULT_OVERLAY_COLOR,
      );
      expect(colorOf(rules, "edge.g3t-ov-member")["target-arrow-color"]).toBe(
        DEFAULT_OVERLAY_COLOR,
      );
    }
  });

  it("composes the theme overlay colors AFTER the static overlay block", () => {
    const sheet = composeCanvasStylesheet(DARK_THEME);
    const idx = sheet
      .map((r, i) => [r.selector, i] as const)
      .filter(([s]) => s === "node.g3t-ov-member")
      .map(([, i]) => i);
    // Two member rules: static geometry first, theme color last.
    expect(idx.length).toBe(2);
    const last = sheet[idx[1]!] as unknown as {
      style: Record<string, unknown>;
    };
    expect(last.style["border-color"]).toBe(DARK_THEME.overlayColor);
  });
});
