/**
 * Module boundary test (M3.E4.T1).
 *
 * Verifies that core modules (UGM, adapters, layout, working-set)
 * export the expected symbols and that their interfaces don't
 * require React types.
 *
 * The source-level "no React import" check is enforced by ESLint
 * and code review. This test verifies the module graph resolves
 * and exports are functional.
 *
 * @see specs/09-design-decisions.md D6, D11, D13
 */

import { describe, it, expect } from "vitest";

describe("D6 module boundary: core imports (M3.E4.T1)", () => {
  it("UGM module exports without React dependency", async () => {
    const mod = await import("./ugm");
    expect(mod.UGM).toBeDefined();
    // UGM constructor takes no React-typed args
    const ugm = new mod.UGM();
    expect(ugm.nodeCount).toBe(0);
  });

  it("Layout engines export without React dependency", async () => {
    const mod = await import("./layout");
    expect(mod.ForceLayout).toBeDefined();
    expect(mod.HierarchyLayout).toBeDefined();
    expect(mod.DagreLayout).toBeDefined();
    expect(mod.G3tLayeredLayout).toBeDefined();

    // Engine interface doesn't require React types
    const engine = new mod.ForceLayout();
    expect(engine.name).toBe("Force-Directed");
    expect(engine.id).toBe("force");
  });

  it("WorkingSetManager exports without React dependency", async () => {
    const mod = await import("./working-set-manager");
    expect(mod.WorkingSetManager).toBeDefined();
    const wsm = new mod.WorkingSetManager();
    expect(wsm.getLimit("canvas")).toBe(500);
  });

  it("Adapter module exports without React dependency", async () => {
    const mod = await import("./adapter");
    expect(mod.SparqlAdapter).toBeDefined();
    expect(mod.CypherAdapter).toBeDefined();
    expect(mod.HolonicAdapter).toBeDefined();
  });

  it("AlgorithmAdapter exports without React dependency", async () => {
    const mod = await import("./algorithm-adapter");
    expect(mod.ingestAlgorithmResults).toBeDefined();
    expect(typeof mod.ingestAlgorithmResults).toBe("function");
  });

  it("RelationalVirtualizer exports without React dependency", async () => {
    const mod = await import("./relational-virtualizer");
    expect(mod.virtualizeRelationalData).toBeDefined();
    expect(mod.parseCSV).toBeDefined();
  });
});
