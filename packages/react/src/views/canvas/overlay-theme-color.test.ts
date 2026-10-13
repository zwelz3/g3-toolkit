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
  type CyStylesheet,
} from "./CytoscapeCanvas";

/** Hex to cytoscape's normalized "rgb(r,g,b)" rendering. */
function rgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}

function mount(
  theme: G3tTheme,
  opts?: Parameters<typeof composeCanvasStylesheet>[1],
) {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: [
      { group: "nodes", data: { id: "a", strong: 1 } },
      { group: "nodes", data: { id: "b" } },
      { group: "edges", data: { id: "ab", source: "a", target: "b" } },
    ],
    style: composeCanvasStylesheet(theme, opts) as never,
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

/**
 * Overlay rules outrank the host's `stylesheet` prop (issue #63).
 *
 * Cytoscape has no CSS specificity: whatever the selector shape, the
 * LATER rule takes the property, so with the host sheet pushed last an
 * ordinary `node { border-width: 1 }` or `edge { width: 1.5 }` stripped
 * the overlay geometry from every member, and a host attribute or
 * focus-class color beat the overlay color (so #32's theme color
 * reached a member only where the host set nothing). The ruling: the
 * host sheet lands BEFORE the overlay block, matching the canvas
 * precedence (overlays = g3t-ov-* classes beat theme, spec and host
 * chrome); a host restyles an overlay through the theme or a bypass,
 * since specificity would not help it. Computed styles through the
 * real merge, as above.
 */
describe("overlay rules outrank the host stylesheet (issue #63)", () => {
  const hostSheet: CyStylesheet[] = [
    {
      selector: "node",
      style: { "border-width": 1, "border-color": "#111111" },
    },
    { selector: "edge", style: { width: 1.5, "line-color": "#222222" } },
    { selector: "node[strong=1]", style: { "border-color": "#333333" } },
    { selector: "node.focus", style: { "border-color": "#444444" } },
  ];

  it("the host sheet sits after theme/encoding and before every overlay rule", () => {
    const sheet = composeCanvasStylesheet(DARK_THEME, {
      userStylesheet: hostSheet,
      structuralEdgeLayer: "svg-overlay",
    });
    const selectors = sheet.map((r) => r.selector);
    const idx = (sel: string) => selectors.indexOf(sel);
    const lastIdx = (sel: string) => selectors.lastIndexOf(sel);
    const hostLast = Math.max(
      idx("node[strong=1]"),
      idx("node.focus"),
      lastIdx("edge"),
    );
    expect(idx("node[strong=1]")).toBeGreaterThan(-1);
    // Host chrome still beats the theme and the encoding on ties.
    expect(idx("edge[_ecolor]")).toBeLessThan(idx("node[strong=1]"));
    // Every overlay rule, static and theme-derived, follows the host.
    for (const sel of [
      "node.g3t-ov-member",
      "edge.g3t-ov-member",
      ".g3t-ov-dim",
      "node.g3t-ov-danger",
    ]) {
      expect(idx(sel)).toBeGreaterThan(hostLast);
      expect(lastIdx(sel)).toBeGreaterThan(hostLast);
    }
    // The svg-overlay transparency rule stays after the overlay block
    // (the structural chrome carries an earlier rule for the same
    // selector, hence lastIndexOf).
    expect(lastIdx("edge.g3t-structural-edge-routed")).toBeGreaterThan(
      lastIdx("node.g3t-ov-member"),
    );
  });

  it("a host `node { border-width: 1 }` / `edge { width: 1.5 }` loses to the member geometry", () => {
    const cy = mount(DARK_THEME, { userStylesheet: hostSheet });
    expect(cy.$id("b").style("border-width")).toBe("3px");
    expect(cy.$id("ab").style("width")).toBe("3.5px");
    cy.destroy();
  });

  it("a host attribute or focus-class color loses to the theme's overlay color", () => {
    const theme = createTheme(
      { id: "host", name: "Host", overlayColor: "#ff00aa", error: "#123456" },
      DARK_THEME,
    );
    const cy = mount(theme, { userStylesheet: hostSheet });
    cy.$id("a").addClass("focus");
    // "a" matches node, node[strong=1] and node.focus in the host sheet.
    expect(cy.$id("a").style("border-color")).toBe(rgb("#ff00aa"));
    expect(cy.$id("ab").style("line-color")).toBe(rgb("#ff00aa"));
    cy.$id("a").addClass("g3t-ov-danger");
    expect(cy.$id("a").style("border-color")).toBe(rgb("#123456"));
    cy.destroy();
  });

  it("off the overlay the host sheet still wins its chrome", () => {
    const cy = mount(DARK_THEME, { userStylesheet: hostSheet });
    cy.elements().removeClass("g3t-ov-member");
    expect(cy.$id("b").style("border-width")).toBe("1px");
    expect(cy.$id("b").style("border-color")).toBe(rgb("#111111"));
    expect(cy.$id("a").style("border-color")).toBe(rgb("#333333"));
    expect(cy.$id("ab").style("width")).toBe("1.5px");
    // Deactivation strips the class and the host chrome returns by
    // construction (no restyle needed).
    cy.$id("b").addClass("g3t-ov-member");
    expect(cy.$id("b").style("border-width")).toBe("3px");
    cy.$id("b").removeClass("g3t-ov-member");
    expect(cy.$id("b").style("border-width")).toBe("1px");
    cy.destroy();
  });
});
