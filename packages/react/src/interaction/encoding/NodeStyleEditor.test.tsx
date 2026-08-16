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
    expect(screen.getByTestId("scope-type")).toHaveTextContent("Any Person"); // LR-43
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

describe("R-8: the shape control is not offered for pie nodes", () => {
  function multiTypeUgm(): UGM {
    const ugm = new UGM();
    ugm.addNode("multi", {
      types: ["Sensor", "Actuator"],
      properties: { name: "Hybrid" },
    });
    ugm.addNode("single", {
      types: ["Sensor"],
      properties: { name: "Plain" },
    });
    return ugm;
  }

  it("suppresses the selector for a multi-type node and explains why", () => {
    const ugm = multiTypeUgm();
    render(<NodeStyleEditor ugm={ugm} nodeId="multi" onClose={() => {}} />);
    expect(screen.queryByTestId("shape-rectangle")).toBeNull();
    expect(screen.getByTestId("shape-suppressed").textContent).toContain("pie");
  });

  it("still offers it for a single-type node", () => {
    const ugm = multiTypeUgm();
    render(<NodeStyleEditor ugm={ugm} nodeId="single" onClose={() => {}} />);
    expect(screen.queryByTestId("shape-rectangle")).not.toBeNull();
    expect(screen.queryByTestId("shape-suppressed")).toBeNull();
  });
});

describe("R-12b/12c (round 21): renderer-neutral target and size ownership", () => {
  it("12b: opens over a descriptor with no UGM at all", () => {
    render(
      <NodeStyleEditor
        target={{ id: "sys.obc", type: "Block", label: "OBC" }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("node-style-editor")).toBeTruthy();
    // The type scope is offered from the descriptor.
    expect(screen.getByTestId("node-style-editor").textContent).toContain(
      "Block",
    );
  });

  it("12c: size is SUPPRESSED on a structural target with no geometry handler", () => {
    render(<NodeStyleEditor target={{ id: "sys.obc" }} onClose={() => {}} />);
    expect(screen.queryByTestId("size-slider")).toBeNull();
    expect(screen.getByTestId("size-suppressed").textContent).toContain(
      "layout",
    );
  });

  it("12c: size is OFFERED when the host can act on it, and is REPORTED not written", () => {
    const onGeometryChange = vi.fn();
    render(
      <NodeStyleEditor
        target={{ id: "sys.obc" }}
        onGeometryChange={onGeometryChange}
        onClose={() => {}}
      />,
    );
    const slider = screen.getByTestId("size-slider");
    fireEvent.change(slider, { target: { value: "55" } });
    fireEvent.click(screen.getByTestId("apply-style"));
    expect(onGeometryChange).toHaveBeenCalledWith("sys.obc", 55);
  });
});

describe("R-16 (register, 2026-08-06): controls gated by renderer capability", () => {
  it("a structural target is offered NO shape and NO icon control", () => {
    render(<NodeStyleEditor target={{ id: "blk" }} onClose={() => {}} />);
    expect(screen.queryByTestId("shape-rectangle")).toBeNull();
    // Not the pie-node explanation either: the channel simply does
    // not exist on this renderer.
    expect(screen.queryByTestId("shape-suppressed")).toBeNull();
    expect(screen.queryByText("Icon")).toBeNull();
    // Colour DOES apply and stays.
    expect(screen.getByTestId("node-style-editor").textContent).toContain(
      "Color",
    );
  });

  it("a canvas target keeps every control", () => {
    const ugm = new UGM();
    ugm.addNode("n", { types: ["T"], properties: {} });
    render(<NodeStyleEditor ugm={ugm} nodeId="n" onClose={() => {}} />);
    expect(screen.queryByTestId("shape-rectangle")).not.toBeNull();
    expect(screen.getByTestId("node-style-editor").textContent).toContain(
      "Icon",
    );
  });

  it("an explicit channel set overrides the default", () => {
    render(
      <NodeStyleEditor
        target={{ id: "blk" }}
        channels={["color", "shape"]}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByTestId("shape-rectangle")).not.toBeNull();
    expect(screen.queryByText("Icon")).toBeNull();
  });
});
