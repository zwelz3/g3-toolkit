/**
 * Workspace shell tests (M6.E1.T2, M6.E1.T3).
 *
 * Extracted from packages/react/src/views/schema/schema.test.tsx during
 * Phase 3.3 when WorkspaceShell moved out of @g3t/react into examples/.
 */

import { describe, it, expect } from "vitest";
import { Model } from "flexlayout-react";
import {
  saveWorkspace,
  loadWorkspace,
  getDefaultLayoutForRole,
} from "./index";

describe("Workspace save/load (M6.E1.T2)", () => {
  it("round-trips workspace state through JSON", () => {
    const layout = getDefaultLayoutForRole("analyst");
    const model = Model.fromJson(layout);

    const saved = saveWorkspace("test-workspace", model, "abc123");
    expect(saved.name).toBe("test-workspace");
    expect(saved.schemaHash).toBe("abc123");
    expect(saved.savedAt).toBeTruthy();

    const restored = loadWorkspace(saved);
    expect(restored).toBeDefined();
    expect(restored.toJson()).toBeDefined();
  });
});

describe("Role-based workspace defaults (M6.E1.T3)", () => {
  it("analyst role loads analyst layout", () => {
    const layout = getDefaultLayoutForRole("analyst");
    const model = Model.fromJson(layout);
    const json = model.toJson();
    const str = JSON.stringify(json);
    expect(str).toContain("Timeline");
    expect(str).toContain("Canvas");
  });

  it("engineer role loads engineer layout", () => {
    const layout = getDefaultLayoutForRole("engineer");
    const model = Model.fromJson(layout);
    const json = model.toJson();
    const str = JSON.stringify(json);
    expect(str).toContain("Schema");
    expect(str).toContain("Tree");
  });

  it("unknown role falls back to default layout", () => {
    const layout = getDefaultLayoutForRole("unknown");
    const model = Model.fromJson(layout);
    expect(model.toJson()).toBeDefined();
  });
});

describe("Workspace role defaults: content verification (audit)", () => {
  it("analyst layout contains Timeline and Stats", () => {
    const layout = getDefaultLayoutForRole("analyst");
    const str = JSON.stringify(layout);
    expect(str).toContain("Timeline");
    expect(str).toContain("Stats");
    expect(str).toContain("Canvas");
    expect(str).toContain("Table");
  });

  it("engineer layout contains Schema and Tree", () => {
    const layout = getDefaultLayoutForRole("engineer");
    const str = JSON.stringify(layout);
    expect(str).toContain("Schema");
    expect(str).toContain("Tree");
    expect(str).toContain("Canvas");
  });
});
