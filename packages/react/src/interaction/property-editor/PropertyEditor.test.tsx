/**
 * PropertyEditor tests (F5).
 *
 * Moved from packages/core/src/combo/f1-f8.test.tsx during Phase 4:
 * PropertyEditor is a React component in @g3t/react, so its tests
 * belong here, not in @g3t/core's test suite.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { PropertyEditor } from "./PropertyEditor";

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", {
    types: ["Person"],
    properties: { name: "Alice", age: 30 },
  });
  ugm.addNode("b", { types: ["Person"], properties: { name: "Bob", age: 25 } });
  ugm.addNode("c", { types: ["Org"], properties: { name: "Acme" } });
  ugm.addEdge("a", "c", { type: "worksAt" });
  ugm.addEdge("b", "c", { type: "worksAt" });
  return ugm;
}

describe("PropertyEditor (F5)", () => {
  it("renders non-internal properties", () => {
    const ugm = makeUGM();
    render(<PropertyEditor ugm={ugm} elementType="node" elementId="a" />);
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("enters edit mode on click", async () => {
    const ugm = makeUGM();
    render(<PropertyEditor ugm={ugm} elementType="node" elementId="a" />);
    fireEvent.click(screen.getByText("Alice"));
    const input = screen.getByTestId("edit-name");
    expect(input).toBeInTheDocument();
  });

  it("calls onEdit callback", async () => {
    const ugm = makeUGM();
    const onEdit = {
      onPropertyChange: vi.fn().mockResolvedValue(true),
    };
    render(
      <PropertyEditor
        ugm={ugm}
        elementType="node"
        elementId="a"
        onEdit={onEdit}
      />,
    );
    fireEvent.click(screen.getByText("Alice"));
    const input = screen.getByTestId("edit-name");
    fireEvent.change(input, { target: { value: "Alicia" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(onEdit.onPropertyChange).toHaveBeenCalledWith(
        "node",
        "a",
        "name",
        "Alice",
        "Alicia",
      );
    });
  });
});
