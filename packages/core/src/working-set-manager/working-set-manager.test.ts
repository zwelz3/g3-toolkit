/**
 * WorkingSetManager tests (M1.E4.T1):
 * canvas default 500 (400 allowed, 600 not). Tree default 1,000
 * (1,200 not). Matrix default 200 (250 not). Sankey default 100
 * (150 not). Streaming default 500 (600 not). Admin override to
 * 300 (400 not).
 */

import { describe, it, expect } from "vitest";
import {
  WorkingSetManager,
  DEFAULT_LIMIT_STRATEGIES,
} from "./working-set-manager";

describe("WorkingSetManager (M1.E4.T1)", () => {
  it("canvas: allows 400, rejects 600 (default 500)", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.checkLimit("canvas", 400)).toMatchObject({
      allowed: true,
      limit: 500,
      requested: 400,
    });
    expect(mgr.checkLimit("canvas", 600)).toMatchObject({
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
    expect(mgr.checkLimit("canvas", 400)).toMatchObject({
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

describe("WorkingSetManager.checkLimit strategy (issue #6)", () => {
  it("within the limit the strategy is allow and the page size is the limit", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.checkLimit("matrix", 150)).toEqual({
      allowed: true,
      limit: 200,
      requested: 150,
      strategy: "allow",
      pageSize: 200,
    });
  });

  it("over the limit the view type's default strategy applies", () => {
    const mgr = new WorkingSetManager();
    expect(mgr.checkLimit("matrix", 350)).toEqual({
      allowed: false,
      limit: 200,
      requested: 350,
      strategy: "page",
      pageSize: 200,
    });
    expect(mgr.checkLimit("table", 25_000).strategy).toBe("page");
    expect(mgr.checkLimit("canvas", 600).strategy).toBe("refuse");
    expect(mgr.checkLimit("tree", 1200).strategy).toBe("refuse");
    expect(mgr.checkLimit("streaming", 600).strategy).toBe("refuse");
    expect(mgr.checkLimit("sankey", 150).strategy).toBe("truncate");
  });

  it("the default table is exported and a caller can override a row per call", () => {
    const mgr = new WorkingSetManager();
    expect(DEFAULT_LIMIT_STRATEGIES.matrix).toBe("page");
    expect(mgr.checkLimit("matrix", 350, "truncate").strategy).toBe("truncate");
    expect(mgr.checkLimit("canvas", 600, "page").strategy).toBe("page");
    // An override never turns an allowed count into something else.
    expect(mgr.checkLimit("canvas", 100, "refuse").strategy).toBe("allow");
  });

  it("an overridden limit is the page size", () => {
    const mgr = new WorkingSetManager({ matrix: 50 });
    const check = mgr.checkLimit("matrix", 350);
    expect(check.strategy).toBe("page");
    expect(check.pageSize).toBe(50);
    expect(check.limit).toBe(50);
  });
});
