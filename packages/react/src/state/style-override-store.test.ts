/**
 * NodeStyleOverride store tests (M12.E1.T1).
 *
 * Moved from packages/core/src/style-override/m12.test.tsx during
 * Phase 4: useStyleOverrideStore is a Zustand store that lives in
 * @g3t/react/state/, so its tests belong here, not in @g3t/core's
 * test suite.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { NodeStyleOverride } from "@g3t/core";
import { useStyleOverrideStore } from "./style-override-store";

beforeEach(() => {
  useStyleOverrideStore.setState({ overrides: [] });
});

describe("NodeStyleOverride store", () => {
  it("adds an override", () => {
    const override: NodeStyleOverride = {
      scope: { nodeId: "p1" },
      color: "#ff0000",
    };
    useStyleOverrideStore.getState().add(override);
    expect(useStyleOverrideStore.getState().overrides).toHaveLength(1);
    expect(useStyleOverrideStore.getState().overrides[0]?.color).toBe(
      "#ff0000",
    );
  });

  it("replaces override with same scope", () => {
    useStyleOverrideStore
      .getState()
      .add({ scope: { nodeId: "p1" }, color: "#ff0000" });
    useStyleOverrideStore
      .getState()
      .add({ scope: { nodeId: "p1" }, color: "#00ff00" });
    expect(useStyleOverrideStore.getState().overrides).toHaveLength(1);
    expect(useStyleOverrideStore.getState().overrides[0]?.color).toBe(
      "#00ff00",
    );
  });

  it("removes by scope", () => {
    useStyleOverrideStore
      .getState()
      .add({ scope: { nodeId: "p1" }, color: "#ff0000" });
    useStyleOverrideStore
      .getState()
      .add({ scope: { type: "Person" }, color: "#0000ff" });
    useStyleOverrideStore.getState().remove({ nodeId: "p1" });
    expect(useStyleOverrideStore.getState().overrides).toHaveLength(1);
  });

  it("clears all overrides", () => {
    useStyleOverrideStore
      .getState()
      .add({ scope: { nodeId: "p1" }, color: "#ff0000" });
    useStyleOverrideStore
      .getState()
      .add({ scope: { type: "Person" }, color: "#0000ff" });
    useStyleOverrideStore.getState().clear();
    expect(useStyleOverrideStore.getState().overrides).toHaveLength(0);
  });
});
