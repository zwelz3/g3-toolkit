/**
 * NodeStyleEditor UI tests (M12.E2.T1).
 *
 * Moved from packages/core/src/style-override/m12.test.tsx during
 * Phase 4: NodeStyleEditor is a React component in @g3t/react, so
 * its tests belong here, not in @g3t/core's test suite.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { NodeStyleEditor } from "./NodeStyleEditor";
import { useStyleOverrideStore } from "../../state/style-override-store";

beforeEach(() => {
  useStyleOverrideStore.setState({ overrides: [] });
});

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", { types: ["Person"], properties: { name: "Alice" } });
  ugm.addNode("o1", { types: ["Organization"], properties: { name: "Acme" } });
  return ugm;
}

describe("NodeStyleEditor", () => {
  it("renders with scope toggle", () => {
    render(<NodeStyleEditor ugm={makeUGM()} nodeId="p1" onClose={vi.fn()} />);
    expect(screen.getByTestId("node-style-editor")).toBeInTheDocument();
    expect(screen.getByTestId("scope-node")).toBeInTheDocument();
    expect(screen.getByTestId("scope-type")).toBeInTheDocument();
    expect(screen.getByTestId("scope-type")).toHaveTextContent("All Person");
  });

  it("scope toggle switches between node and type", () => {
    render(<NodeStyleEditor ugm={makeUGM()} nodeId="p1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("scope-type"));
    expect(screen.getByTestId("scope-type").className).toContain("active");
  });

  it("apply creates an override in the store", () => {
    render(<NodeStyleEditor ugm={makeUGM()} nodeId="p1" onClose={vi.fn()} />);

    // Select a color
    fireEvent.click(screen.getByTestId("color-#ef4444"));
    // Click apply
    fireEvent.click(screen.getByTestId("apply-style"));

    const overrides = useStyleOverrideStore.getState().overrides;
    expect(overrides).toHaveLength(1);
    expect(overrides[0]?.color).toBe("#ef4444");
  });

  it("renders color presets and shape buttons", () => {
    render(<NodeStyleEditor ugm={makeUGM()} nodeId="p1" onClose={vi.fn()} />);
    expect(screen.getByTestId("color-#E69F00")).toBeInTheDocument();
    expect(screen.getByTestId("shape-diamond")).toBeInTheDocument();
    expect(screen.getByTestId("size-slider")).toBeInTheDocument();
    expect(screen.getByTestId("icon-none")).toBeInTheDocument();
  });
});
