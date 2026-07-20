/**
 * C3/C4 tests: tokens with WCAG-checked defaults (G3L:STY-006,
 * ACC-001 computational check), LOD schedule semantics
 * (G3L:STY-010/011), and the versioned JSON envelope round-trip with
 * honest rejection of non-serializable rules (G3L:STY-007).
 */
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  DARK_TOKENS,
  LIGHT_TOKENS,
  OKABE_ITO,
  themeFromTokens,
} from "./tokens";
import {
  applyLod,
  DEFAULT_LOD_SCHEDULE,
  resolveLod,
  type LodSchedule,
} from "./lod";
import {
  parseStyleConfig,
  serializeStyleConfig,
  STYLE_CONFIG_SCHEMA,
} from "./style-config-json";
import { resolveStyles, type StyleRule } from "./style-engine";

describe("design tokens (G3L:STY-006)", () => {
  it("light and dark label/canvas pairs meet WCAG AA (4.5:1) computationally", () => {
    expect(
      contrastRatio(LIGHT_TOKENS.color.textPrimary, LIGHT_TOKENS.color.canvas),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(DARK_TOKENS.color.textPrimary, DARK_TOKENS.color.canvas),
    ).toBeGreaterThanOrEqual(4.5);
    // Secondary text still meets AA on both canvases (edge labels).
    expect(
      contrastRatio(
        LIGHT_TOKENS.color.textSecondary,
        LIGHT_TOKENS.color.canvas,
      ),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(DARK_TOKENS.color.textSecondary, DARK_TOKENS.color.canvas),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("dark categorical palette swaps black for white, keeps the other seven", () => {
    expect(DARK_TOKENS.color.categorical.slice(0, 7)).toEqual(
      OKABE_ITO.slice(0, 7),
    );
    expect(DARK_TOKENS.color.categorical[7]).toBe("#ffffff");
  });

  it("themeFromTokens feeds the engine's theme layer end to end", () => {
    const theme = themeFromTokens(DARK_TOKENS);
    const out = resolveStyles(
      { elements: [{ id: "n", kind: "node", data: {} }] },
      { theme },
    );
    expect(out.get("n")?.fill).toBe(DARK_TOKENS.color.surface);
    expect(out.get("n")?.labelColor).toBe(DARK_TOKENS.color.textPrimary);
  });

  it("contrastRatio is symmetric and spans the WCAG range", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });
});

describe("LOD schedule (G3L:STY-010/011)", () => {
  it("no matching tier = full detail, tier 0", () => {
    const r = resolveLod(DEFAULT_LOD_SCHEDULE, {
      zoom: 1,
      visibleElements: 50,
    });
    expect(r.tier).toBe(0);
    expect(r.features.nodeLabels).toBe(true);
    expect(r.features.edges).toBe(true);
  });

  it("either signal coarsens: zoom OR count (the two documented schemes unified)", () => {
    const byZoom = resolveLod(DEFAULT_LOD_SCHEDULE, {
      zoom: 0.3,
      visibleElements: 50,
    });
    const byCount = resolveLod(DEFAULT_LOD_SCHEDULE, {
      zoom: 1,
      visibleElements: 1500,
    });
    expect(byZoom.tier).toBe(2);
    expect(byCount.tier).toBe(2);
    expect(byZoom.features.nodeLabels).toBe(false);
    expect(byCount.features.icons).toBe(false);
  });

  it("coarse-first ordering: the hairball tier wins over milder ones", () => {
    const r = resolveLod(DEFAULT_LOD_SCHEDULE, {
      zoom: 0.1,
      visibleElements: 9000,
    });
    expect(r.tier).toBe(3);
    expect(r.features.edges).toBe(false);
  });

  it("applyLod: tier 0 returns the SAME object (hot path allocates nothing)", () => {
    const attrs = { fill: "red", labelVisible: true };
    const lod = resolveLod(DEFAULT_LOD_SCHEDULE, {
      zoom: 1,
      visibleElements: 10,
    });
    expect(applyLod(attrs, lod, "node")).toBe(attrs);
  });

  it("applyLod strips node decorations and hides edge labels per flags", () => {
    const lod = resolveLod(DEFAULT_LOD_SCHEDULE, {
      zoom: 0.3,
      visibleElements: 0,
    });
    const nodeOut = applyLod(
      {
        labelVisible: true,
        glyphs: [{ slot: "top-right", text: "3" }],
        halo: { color: "gold", width: 3 },
        icon: "server",
      },
      lod,
      "node",
    );
    expect(nodeOut.labelVisible).toBe(false);
    expect(nodeOut.glyphs).toBeUndefined();
    expect(nodeOut.halo).toBeUndefined();
    expect(nodeOut.icon).toBeUndefined();
    expect(nodeOut.lodTier).toBe(2);
    const edgeOut = applyLod({ labelVisible: true, opacity: 1 }, lod, "edge");
    expect(edgeOut.labelVisible).toBe(false);
    expect(edgeOut.opacity).toBe(1); // edges still drawn at tier 2
  });

  it("a custom schedule is plain data (serializable per STY-007)", () => {
    const schedule: LodSchedule = {
      tiers: [{ tier: 1, when: { maxZoom: 0.5 }, hide: ["glyphs"] }],
    };
    const r = resolveLod(schedule, { zoom: 0.4, visibleElements: 0 });
    expect(r.tier).toBe(1);
    expect(r.features.glyphs).toBe(false);
    expect(r.features.nodeLabels).toBe(true);
  });
});

describe("style-config JSON (G3L:STY-007)", () => {
  const declarativeRules: StyleRule[] = [
    {
      id: "hubs",
      selector: { kind: "node", dataEquals: { category: "hub" } },
      attributes: { halo: { color: "gold", width: 3 } },
    },
    {
      id: "risky",
      selector: { dataHas: ["risk"] },
      attributes: { stroke: "#D55E00" },
    },
  ];

  it("round-trips the serializable subset exactly", () => {
    const { json, errors } = serializeStyleConfig({
      tokens: LIGHT_TOKENS,
      rules: declarativeRules,
      classDefs: { muted: { opacity: 0.4 } },
      lod: DEFAULT_LOD_SCHEDULE,
    });
    expect(errors).toEqual([]);
    expect(json).not.toBeNull();
    if (!json) return;
    const parsed = parseStyleConfig(json);
    expect(parsed.ok).toBe(true);
    expect(parsed.document?.version).toBe(1);
    expect(parsed.document?.rules).toHaveLength(2);
    expect(parsed.document?.tokens).toEqual(LIGHT_TOKENS);
    expect(parsed.document?.lod).toEqual(DEFAULT_LOD_SCHEDULE);
    expect(parsed.document?.classDefs).toEqual({ muted: { opacity: 0.4 } });
  });

  it("rejects function rules with a coded error instead of dropping them", () => {
    const { json, errors } = serializeStyleConfig({
      rules: [{ id: "fn", attributes: () => ({ fill: "x" }) }],
    });
    expect(json).toBeNull();
    expect(errors[0]?.code).toBe("CFG_RULE_NOT_SERIALIZABLE");
    expect(errors[0]?.path).toBe("/rules/0/attributes");
  });

  it("parse rejects bad versions, malformed rules, and malformed LOD with paths", () => {
    const bad = parseStyleConfig(
      JSON.stringify({
        version: 2,
        rules: [{ attributes: {} }],
        lod: { tiers: [{ tier: "x" }] },
      }),
    );
    expect(bad.ok).toBe(false);
    const codes = bad.errors.map((e) => e.code).sort();
    expect(codes).toEqual([
      "CFG_BAD_VERSION",
      "CFG_LOD_SHAPE",
      "CFG_RULE_SHAPE",
    ]);
    expect(bad.errors.find((e) => e.code === "CFG_RULE_SHAPE")?.path).toBe(
      "/rules/0",
    );
  });

  it("parsed rules drive the engine identically to the originals", () => {
    const { json } = serializeStyleConfig({ rules: declarativeRules });
    if (!json) throw new Error("serialize failed");
    const parsed = parseStyleConfig(json);
    const graph = {
      elements: [
        { id: "h", kind: "node" as const, data: { category: "hub" } },
        { id: "r", kind: "node" as const, data: { risk: 7 } },
      ],
    };
    const fromParsed = resolveStyles(graph, {
      rules: parsed.document?.rules as unknown as StyleRule[],
    });
    const fromOriginal = resolveStyles(graph, { rules: declarativeRules });
    expect(fromParsed.get("h")).toEqual(fromOriginal.get("h"));
    expect(fromParsed.get("r")).toEqual(fromOriginal.get("r"));
  });

  it("the published schema names every envelope key the validator accepts", () => {
    const props = Object.keys(STYLE_CONFIG_SCHEMA.properties);
    expect(props.sort()).toEqual(
      ["classDefs", "lod", "rules", "stateDefs", "tokens", "version"].sort(),
    );
  });
});
