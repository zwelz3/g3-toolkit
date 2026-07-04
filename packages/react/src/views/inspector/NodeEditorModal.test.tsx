import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { NodeEditorModal } from "./NodeEditorModal";

function ugmFixture(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", {
    types: ["Person"],
    properties: { name: "Alice", active: true },
  });
  ugm.addNode("b", { types: ["Organization"], properties: { name: "Acme" } });
  ugm.addEdge("a", "b", { type: "worksAt" });
  return ugm;
}

describe("NodeEditorModal", () => {
  it("renders nothing when nodeId is null", () => {
    const { container } = render(
      <NodeEditorModal ugm={ugmFixture()} nodeId={null} onClose={() => {}} />,
    );
    expect(screen.queryByTestId("node-editor-modal")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("opens on the Properties tab and shows the property inspector", () => {
    render(
      <NodeEditorModal ugm={ugmFixture()} nodeId="a" onClose={() => {}} />,
    );
    expect(screen.getByTestId("node-editor-modal")).toBeInTheDocument();
    expect(screen.getByTestId("tab-properties")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("node-property-inspector")).toBeInTheDocument();
    expect(screen.queryByTestId("node-style-editor")).not.toBeInTheDocument();
  });

  it("switches to the Style tab on demand", () => {
    render(
      <NodeEditorModal ugm={ugmFixture()} nodeId="a" onClose={() => {}} />,
    );
    fireEvent.click(screen.getByTestId("tab-style"));
    expect(screen.getByTestId("tab-style")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("node-style-editor")).toBeInTheDocument();
    expect(
      screen.queryByTestId("node-property-inspector"),
    ).not.toBeInTheDocument();
  });

  it("honors defaultTab", () => {
    render(
      <NodeEditorModal
        ugm={ugmFixture()}
        nodeId="a"
        onClose={() => {}}
        defaultTab="style"
      />,
    );
    expect(screen.getByTestId("node-style-editor")).toBeInTheDocument();
  });

  it("closes on backdrop click and Escape", () => {
    const onClose = vi.fn();
    render(<NodeEditorModal ugm={ugmFixture()} nodeId="a" onClose={onClose} />);
    fireEvent.click(screen.getByTestId("node-editor-modal"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close when the panel itself is clicked", () => {
    const onClose = vi.fn();
    render(<NodeEditorModal ugm={ugmFixture()} nodeId="a" onClose={onClose} />);
    fireEvent.click(screen.getByTestId("tab-properties"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
