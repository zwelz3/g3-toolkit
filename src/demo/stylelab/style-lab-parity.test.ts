/**
 * Style Lab parity oracle (headless).
 *
 * The claim under test: for the shared fixture intent, the legacy
 * Cytoscape-stylesheet path and the engine+bypass path produce the
 * SAME cytoscape-COMPUTED styles on every element for every parity
 * key. Both sides go through cytoscape's own value normalization
 * (colors to rgb, numbers to px strings), so the comparison is apples
 * to apples and independent of how each path spells its inputs.
 *
 * Also pinned: the projection's honesty report (engine-only
 * attributes surface as `unsupported`, pill surfaces as
 * `approximated`) and STY-003 gating on BOTH paths (the three
 * riskLevel-less nodes keep the base fill under each path).
 */
import { describe, expect, it } from "vitest";
import cytoscape, { type Core } from "cytoscape";
import { StyleEngine } from "@g3t/core";
import {
  applyVisualAttributes,
  DEFAULT_STYLESHEET,
  edgeAttributesToCy,
  nodeAttributesToCy,
  themeColorRules,
} from "@g3t/react";
import { useThemeStore } from "@g3t/react";
import {
  MUTED_IDS,
  PARITY_KEYS,
  SELECTED_ID,
  styleElementsFromCy,
  styleLabEngineConfig,
  styleLabLegacyStylesheet,
  styleLabRawCyElements,
} from "./style-lab-fixture";

const rawElements = () =>
  styleLabRawCyElements() as cytoscape.ElementDefinition[];

/** The REAL canvas stylesheet stack beneath each pane (defaults +
 *  theme rules), reproduced headlessly: MR-7's oracle blind spot was
 *  comparing bare-cytoscape paths while the browser runs this stack
 *  underneath both panes. */
function canvasBaseStack(): cytoscape.StylesheetJson {
  const theme = useThemeStore.getState().theme;
  return [
    ...DEFAULT_STYLESHEET,
    ...themeColorRules(theme),
  ] as cytoscape.StylesheetJson;
}

function mountLegacy(): Core {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: rawElements(),
    style: [
      ...(canvasBaseStack() as unknown as object[]),
      ...(styleLabLegacyStylesheet() as unknown as object[]),
    ] as cytoscape.StylesheetJson,
  });
  for (const id of MUTED_IDS) cy.$id(id).addClass("lab-muted");
  cy.$id(SELECTED_ID).select();
  return cy;
}

function mountEngine(): Core {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: rawElements(),
    style: canvasBaseStack(),
  });
  for (const id of MUTED_IDS) cy.$id(id).addClass("lab-muted");
  cy.$id(SELECTED_ID).select();
  const engine = new StyleEngine(styleLabEngineConfig());
  const elements = styleElementsFromCy(cy).map((el) => ({
    ...el,
    classes: cy.$id(el.id).hasClass("lab-muted") ? ["lab-muted"] : [],
    states: el.id === SELECTED_ID ? ["selected"] : [],
  }));
  const resolved = engine.load({ elements });
  applyVisualAttributes(cy, resolved);
  return cy;
}

describe("style-lab parity oracle: legacy stylesheet vs engine bypass", () => {
  it("computes IDENTICAL styles for every element on every parity key", () => {
    const legacy = mountLegacy();
    const engine = mountEngine();
    const mismatches: string[] = [];
    legacy.elements().forEach((ele) => {
      const keys = ele.isNode() ? PARITY_KEYS.node : PARITY_KEYS.edge;
      const other = engine.$id(ele.id());
      for (const key of keys) {
        const a = String(ele.style(key));
        const b = String(other.style(key));
        if (a !== b) mismatches.push(`${ele.id()}.${key}: ${a} != ${b}`);
      }
    });
    expect(mismatches).toEqual([]);
    legacy.destroy();
    engine.destroy();
  });

  it("STY-003 gating holds on both paths: riskLevel-less nodes keep base fill", () => {
    const legacy = mountLegacy();
    const engine = mountEngine();
    for (const id of ["n5", "n6", "n8"]) {
      const a = String(legacy.$id(id).style("background-color"));
      const b = String(engine.$id(id).style("background-color"));
      expect(a).toBe(b);
      // And neither equals the risk colors.
      const hi = String(legacy.$id("n1").style("background-color"));
      expect(a).not.toBe(hi);
    }
    legacy.destroy();
    engine.destroy();
  });

  it("the engine-only zone surfaces through the honesty report, not silently", () => {
    const cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: rawElements(),
    });
    const engine = new StyleEngine(styleLabEngineConfig());
    const resolved = engine.load({ elements: styleElementsFromCy(cy) });
    const report = applyVisualAttributes(cy, resolved);
    // n1 is a flagged high-risk hub: halo + glyphs unsupported.
    expect(report.get("n1")?.unsupported).toEqual(
      expect.arrayContaining(["halo", "glyphs"]),
    );
    // Critical edges carry taper: unsupported on the bypass.
    expect(report.get("e1")?.unsupported).toContain("taper");
    // Nodes with nothing engine-only produce no report entry.
    expect(report.has("n2")).toBe(false);
    cy.destroy();
  });
});

describe("oracle self-test (MR-7 counterfactual, kept as a guard)", () => {
  it("detects a deliberately broken engine config (halo stripped)", () => {
    // Before the label channels joined PARITY_KEYS and the canvas
    // base stack joined the mounts, an engine pane missing the label
    // halo read as "missing labels" in the browser while the oracle
    // showed 0 mismatches. This breaks the config the same way and
    // demands the oracle SEE it; if key widening or the stack ever
    // regresses, this fails first.
    const cy = cytoscape({
      headless: true,
      styleEnabled: true,
      elements: rawElements(),
      style: canvasBaseStack(),
    });
    const config = styleLabEngineConfig();
    const broken = {
      ...config,
      rules: (config.rules ?? []).map((r) =>
        r.id === "base-node" && typeof r.attributes !== "function"
          ? { ...r, attributes: { ...r.attributes, labelHalo: undefined } }
          : r,
      ),
    };
    const engine = new StyleEngine(broken);
    applyVisualAttributes(
      cy,
      engine.load({ elements: styleElementsFromCy(cy) }),
    );
    const legacy = mountLegacy();
    let mismatches = 0;
    legacy.nodes().forEach((ele) => {
      for (const key of PARITY_KEYS.node) {
        if (String(ele.style(key)) !== String(cy.$id(ele.id()).style(key))) {
          mismatches++;
        }
      }
    });
    expect(mismatches).toBeGreaterThan(0);
    legacy.destroy();
    cy.destroy();
  });
});

describe("projection unit behavior", () => {
  it("maps node attributes to cytoscape properties", () => {
    const p = nodeAttributesToCy({
      fill: "#111111",
      stroke: "#222222",
      strokeWidth: 2,
      opacity: 0.5,
      shape: "hexagon",
      labelText: "X",
      labelVisible: false,
    });
    expect(p.style).toMatchObject({
      "background-color": "#111111",
      "border-color": "#222222",
      "border-width": 2,
      opacity: 0.5,
      shape: "hexagon",
      label: "X",
      "text-opacity": 0,
    });
    expect(p.unsupported).toEqual([]);
    expect(p.approximated).toEqual([]);
  });

  it("pill is an approximation, reported as such", () => {
    const p = nodeAttributesToCy({ shape: "pill" });
    expect(p.style["shape"]).toBe("round-rectangle");
    expect(p.approximated).toEqual(["shape"]);
  });

  it("maps edge dash, arrows (hollow fills), and colors arrows with the stroke", () => {
    const p = edgeAttributesToCy({
      stroke: "#333333",
      strokeWidth: 3,
      strokeDash: [6, 3],
      arrowTarget: "triangle-hollow",
      arrowSource: "diamond",
    });
    expect(p.style).toMatchObject({
      "line-color": "#333333",
      "target-arrow-color": "#333333",
      width: 3,
      "line-style": "dashed",
      "line-dash-pattern": "6 3",
      "target-arrow-shape": "triangle",
      "target-arrow-fill": "hollow",
      "source-arrow-shape": "diamond",
      "source-arrow-fill": "filled",
    });
  });
});
