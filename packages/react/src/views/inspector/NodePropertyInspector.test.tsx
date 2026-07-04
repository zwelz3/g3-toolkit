import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { NodePropertyInspector } from "./NodePropertyInspector";
import type { PropertyInspectorSpec } from "./property-spec";
import { useInspectorSectionStore } from "../../state/inspector-section-store";

function ugmFixture(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", {
    types: ["Person"],
    properties: { name: "Alice", role: "Engineer", active: true },
  });
  ugm.addNode("b", { types: ["Organization"], properties: { name: "Acme" } });
  ugm.addEdge("a", "b", { type: "worksAt", confidence: 0.9 });
  return ugm;
}

function firstEdgeId(ugm: UGM): string {
  let id = "";
  ugm.forEachEdge((eid) => {
    if (!id) id = eid;
  });
  return id;
}

beforeEach(() => {
  // Section collapse is graph-wide module state; reset between tests.
  useInspectorSectionStore.getState().clear();
});

describe("NodePropertyInspector", () => {
  it("shows the empty state when nothing is selected", () => {
    render(<NodePropertyInspector ugm={ugmFixture()} selection={null} />);
    expect(screen.getByTestId("node-property-inspector")).toBeInTheDocument();
    expect(screen.getByText(/select a node or edge/i)).toBeInTheDocument();
  });

  it("renders a node's properties, type, and importance (properties first)", () => {
    render(
      <NodePropertyInspector
        ugm={ugmFixture()}
        selection={{ type: "node", id: "a" }}
      />,
    );
    expect(screen.getByText("Person")).toBeInTheDocument();
    expect(screen.getByText("Graph importance")).toBeInTheDocument();
    expect(screen.getByTestId("inspector-prop-name")).toHaveTextContent(
      "Alice",
    );
    expect(screen.getByTestId("inspector-prop-role")).toHaveTextContent(
      "Engineer",
    );
  });

  it("renders an edge's endpoints, type, and qualified metadata", () => {
    const ugm = ugmFixture();
    render(
      <NodePropertyInspector
        ugm={ugm}
        selection={{ type: "edge", id: firstEdgeId(ugm) }}
      />,
    );
    expect(screen.getByText("worksAt")).toBeInTheDocument();
    expect(screen.getByText("Endpoints")).toBeInTheDocument();
    expect(screen.getByTitle("a")).toBeInTheDocument();
    expect(screen.getByTitle("b")).toBeInTheDocument();
    expect(screen.getByText(/qualified edge metadata/i)).toBeInTheDocument();
  });

  it("invokes onClose from the close button", () => {
    const onClose = vi.fn();
    render(
      <NodePropertyInspector
        ugm={ugmFixture()}
        selection={{ type: "node", id: "a" }}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId("inspector-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("edit mode renders interactive spec widgets and emits coerced changes", () => {
    const spec: PropertyInspectorSpec = {
      fields: [{ key: "active", widget: "checkbox" }],
    };
    const onPropertyChange = vi.fn();
    render(
      <NodePropertyInspector
        ugm={ugmFixture()}
        selection={{ type: "node", id: "a" }}
        mode="edit"
        spec={spec}
        onPropertyChange={onPropertyChange}
      />,
    );
    const field = screen.getByTestId("inspector-prop-active");
    const checkbox = within(field).getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBe(false);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(onPropertyChange).toHaveBeenCalledWith("active", false);
  });

  it("preview mode renders boolean widgets disabled (value visible)", () => {
    const spec: PropertyInspectorSpec = {
      fields: [{ key: "active", widget: "toggle" }],
    };
    render(
      <NodePropertyInspector
        ugm={ugmFixture()}
        selection={{ type: "node", id: "a" }}
        mode="preview"
        spec={spec}
      />,
    );
    const field = screen.getByTestId("inspector-prop-active");
    expect(field).toHaveAttribute("data-widget", "toggle");
    const checkbox = within(field).getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(true);
  });

  it("collapses a section and keeps it collapsed across selections", () => {
    const ugm = ugmFixture();
    const { rerender } = render(
      <NodePropertyInspector ugm={ugm} selection={{ type: "node", id: "a" }} />,
    );
    expect(screen.getByTestId("inspector-prop-name")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("inspector-section-properties"));
    expect(screen.queryByTestId("inspector-prop-name")).not.toBeInTheDocument();
    expect(useInspectorSectionStore.getState().collapsed).toContain(
      "properties",
    );

    // Different element: properties stays collapsed (graph-wide state).
    rerender(
      <NodePropertyInspector ugm={ugm} selection={{ type: "node", id: "b" }} />,
    );
    expect(screen.queryByTestId("inspector-prop-name")).not.toBeInTheDocument();
  });
});
