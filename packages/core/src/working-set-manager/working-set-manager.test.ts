/**
 * WorkingSetManager tests (M1.E4.T1):
 * canvas default 500 (400 allowed, 600 not). Tree default 1,000
 * (1,200 not). Matrix default 200 (250 not). Sankey default 100
 * (150 not). Streaming default 500 (600 not). Admin override to
 * 300 (400 not).
 */

import { describe, it, expect } from "vitest";
import { WorkingSetManager } from "./working-set-manager";

describe("WorkingSetManager (M1.E4.T1)", () => {
  it("canvas: allows 400, rejects 600 (default 500)", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.checkLimit("canvas", 400)).toEqual({
      allowed: true,
      limit: 500,
      requested: 400,
    });
    expect(mgr.checkLimit("canvas", 600)).toEqual({
      allowed: false,
      limit: 500,
      requested: 600,
    });
  });

  it("canvas: allows exactly 500 (boundary)", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.checkLimit("canvas", 500).allowed).toBe(true);
    expect(mgr.checkLimit("canvas", 501).allowed).toBe(false);
  });

  it("table: allows 9999, rejects 10001 (default 10,000)", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.checkLimit("table", 9999).allowed).toBe(true);
    expect(mgr.checkLimit("table", 10001).allowed).toBe(false);
  });

  it("tree: allows 999, rejects 1200 (default 1,000)", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.checkLimit("tree", 999).allowed).toBe(true);
    expect(mgr.checkLimit("tree", 1200).allowed).toBe(false);
  });

  it("matrix: allows 199, rejects 250 (default 200)", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.checkLimit("matrix", 199).allowed).toBe(true);
    expect(mgr.checkLimit("matrix", 250).allowed).toBe(false);
  });

  it("sankey: allows 99, rejects 150 (default 100)", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.checkLimit("sankey", 99).allowed).toBe(true);
    expect(mgr.checkLimit("sankey", 150).allowed).toBe(false);
  });

  it("streaming: allows 499, rejects 600 (default 500)", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.checkLimit("streaming", 499).allowed).toBe(true);
    expect(mgr.checkLimit("streaming", 600).allowed).toBe(false);
  });

  it("admin override: canvas to 300, then 400 is rejected", () => {
    const mgr = new WorkingSetManager();
    mgr.setLimit("canvas", 300);
    expect(mgr.checkLimit("canvas", 400)).toEqual({
      allowed: false,
      limit: 300,
      requested: 400,
    });
    expect(mgr.checkLimit("canvas", 250).allowed).toBe(true);
  });

  it("constructor accepts initial overrides", () => {
    const mgr = new WorkingSetManager({ canvas: 100, tree: 50 });
    expect(mgr.getLimit("canvas")).toBe(100);
    expect(mgr.getLimit("tree")).toBe(50);
    expect(mgr.getLimit("table")).toBe(10_000); // unchanged
  });

  it("getLimit returns current limit", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.getLimit("canvas")).toBe(500);
    mgr.setLimit("canvas", 999);
    expect(mgr.getLimit("canvas")).toBe(999);
  });
});

// ── Issue #5: deployment config, ceilings, and user overrides ────────

describe("WorkingSetManager precedence (issue #5, D5)", () => {
  it("built-in defaults apply when nothing is configured", () => {
    const mgr = WorkingSetManager.fromConfig({ version: 1 });
    expect(mgr.getLimit("canvas")).toBe(500);
    expect(mgr.getCeiling("canvas")).toBeUndefined();
  });

  it("R7.7 acceptance: a deployment default of 300 for the canvas applies", () => {
    const mgr = WorkingSetManager.fromConfig({
      version: 1,
      limits: { canvas: { default: 300 } },
    });
    expect(mgr.getLimit("canvas")).toBe(300);
    expect(mgr.checkLimit("canvas", 301).allowed).toBe(false);
    expect(mgr.checkLimit("canvas", 300).allowed).toBe(true);
    // Other views keep their built-in defaults.
    expect(mgr.getLimit("tree")).toBe(1_000);
  });

  it("a user override may raise the default up to the ceiling", () => {
    const mgr = WorkingSetManager.fromConfig({
      version: 1,
      limits: { canvas: { default: 300, ceiling: 800 } },
    });
    expect(mgr.canRaise("canvas", 800).ok).toBe(true);
    const result = mgr.setUserOverride("canvas", 800);
    expect(result).toEqual({
      ok: true,
      viewType: "canvas",
      requested: 800,
      limit: 800,
      ceiling: 800,
    });
    expect(mgr.getLimit("canvas")).toBe(800);
    expect(mgr.checkLimit("canvas", 700).allowed).toBe(true);
  });

  it("ceiling case: an override above the ceiling is refused, not thrown, and changes nothing", () => {
    const mgr = WorkingSetManager.fromConfig({
      version: 1,
      limits: { canvas: { default: 300, ceiling: 800 } },
    });
    const refusal = mgr.setUserOverride("canvas", 801);
    expect(refusal).toEqual({
      ok: false,
      reason: "above-ceiling",
      viewType: "canvas",
      requested: 801,
      limit: 300,
      ceiling: 800,
    });
    expect(mgr.getLimit("canvas")).toBe(300);
    // canRaise is the pure form of the same answer.
    expect(mgr.canRaise("canvas", 801).ok).toBe(false);
  });

  it("no ceiling means a user override is unbounded", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.setUserOverride("canvas", 50_000).ok).toBe(true);
    expect(mgr.getLimit("canvas")).toBe(50_000);
  });

  it("a user override may also lower the limit, and clearing it restores the default", () => {
    const mgr = new WorkingSetManager({ tree: 400 });
    expect(mgr.setUserOverride("tree", 100).ok).toBe(true);
    expect(mgr.getLimit("tree")).toBe(100);
    mgr.clearUserOverride("tree");
    expect(mgr.getLimit("tree")).toBe(400);
  });

  it("a non-integer or non-positive override is refused as invalid", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.setUserOverride("canvas", 0)).toMatchObject({
      ok: false,
      reason: "invalid",
      limit: 500,
    });
    expect(mgr.setUserOverride("canvas", 12.5).ok).toBe(false);
    expect(mgr.getLimit("canvas")).toBe(500);
  });

  it("a ceiling below the built-in default clamps the effective limit", () => {
    const mgr = WorkingSetManager.fromConfig({
      version: 1,
      limits: { canvas: { ceiling: 200 } },
    });
    expect(mgr.getLimit("canvas")).toBe(200);
    expect(mgr.getCeiling("canvas")).toBe(200);
  });

  it("setLimit (admin) moves the deployment default but stays under the ceiling and under a user override", () => {
    const mgr = WorkingSetManager.fromConfig({
      version: 1,
      limits: { matrix: { default: 100, ceiling: 150 } },
    });
    mgr.setLimit("matrix", 900);
    expect(mgr.getLimit("matrix")).toBe(150);
    mgr.setLimit("matrix", 120);
    expect(mgr.getLimit("matrix")).toBe(120);
    mgr.setUserOverride("matrix", 140);
    mgr.setLimit("matrix", 110);
    expect(mgr.getLimit("matrix")).toBe(140);
    mgr.clearUserOverride("matrix");
    expect(mgr.getLimit("matrix")).toBe(110);
  });

  it("the constructor takes ceilings as a second argument", () => {
    const mgr = new WorkingSetManager({ canvas: 300 }, { canvas: 400 });
    expect(mgr.getLimit("canvas")).toBe(300);
    expect(mgr.getCeiling("canvas")).toBe(400);
    expect(mgr.canRaise("canvas", 401).ok).toBe(false);
  });

  it("fromConfig validates: a malformed document throws rather than configuring nothing", () => {
    expect(() =>
      WorkingSetManager.fromConfig({
        version: 1,
        limits: { canvass: { default: 300 } },
      }),
    ).toThrow(/unknown view type "canvass"/);
  });
});
