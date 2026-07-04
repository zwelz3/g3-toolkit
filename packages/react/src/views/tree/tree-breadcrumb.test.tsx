/**
 * Breadcrumb behavior (bugfix): the tree breadcrumb shows the ancestor
 * PATH of the selected node (root -> ... -> selected), derived from
 * containment edges, not a click-history trail.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { TreeView } from "./TreeView";
import { useSelectionStore } from "../../state/selection-store";

function chainGraph(): UGM {
  // root -> mid -> leaf, plus a sibling under root.
  const ugm = new UGM();
  ugm.addNode("root", { types: ["System"], properties: { name: "Root" } });
  ugm.addNode("mid", { types: ["Subsystem"], properties: { name: "Mid" } });
  ugm.addNode("leaf", { types: ["Part"], properties: { name: "Leaf" } });
  ugm.addNode("sib", { types: ["Part"], properties: { name: "Sibling" } });
  ugm.addEdge("root", "mid", { type: "contains", properties: {} });
  ugm.addEdge("mid", "leaf", { type: "contains", properties: {} });
  ugm.addEdge("root", "sib", { type: "contains", properties: {} });
  return ugm;
}

describe("TreeView ancestor breadcrumb", () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
  });

  it("shows the full ancestor path of the selected node", () => {
    useSelectionStore.getState().selectNodes(["leaf"]);
    render(<TreeView ugm={chainGraph()} rootId="root" />);
    const crumb = screen.getByTestId("tree-breadcrumb");
    // Path is Root > Mid > Leaf, in order.
    expect(crumb.textContent).toContain("Root");
    expect(crumb.textContent).toContain("Mid");
    expect(crumb.textContent).toContain("Leaf");
    const rootPos = crumb.textContent!.indexOf("Root");
    const midPos = crumb.textContent!.indexOf("Mid");
    const leafPos = crumb.textContent!.indexOf("Leaf");
    expect(rootPos).toBeLessThan(midPos);
    expect(midPos).toBeLessThan(leafPos);
  });

  it("resets to the new node's path when a different branch is selected", () => {
    useSelectionStore.getState().selectNodes(["leaf"]);
    const { rerender } = render(<TreeView ugm={chainGraph()} rootId="root" />);
    expect(screen.getByTestId("tree-breadcrumb").textContent).toContain("Mid");
    // Switch to the sibling: path is Root > Sibling, NOT a click trail
    // that still includes Mid/Leaf.
    useSelectionStore.getState().selectNodes(["sib"]);
    rerender(<TreeView ugm={chainGraph()} rootId="root" />);
    const crumb = screen.getByTestId("tree-breadcrumb");
    expect(crumb.textContent).toContain("Root");
    expect(crumb.textContent).toContain("Sibling");
    expect(crumb.textContent).not.toContain("Mid");
    expect(crumb.textContent).not.toContain("Leaf");
  });

  it("shows no breadcrumb for a lone root selection", () => {
    useSelectionStore.getState().selectNodes(["root"]);
    render(<TreeView ugm={chainGraph()} rootId="root" />);
    expect(screen.queryByTestId("tree-breadcrumb")).toBeNull();
  });

  it("clicking an ancestor crumb selects that ancestor", () => {
    useSelectionStore.getState().selectNodes(["leaf"]);
    render(<TreeView ugm={chainGraph()} rootId="root" />);
    const crumb = screen.getByTestId("tree-breadcrumb");
    const midButton = [...crumb.querySelectorAll("button")].find(
      (b) => b.textContent === "Mid",
    )!;
    fireEvent.click(midButton);
    expect(useSelectionStore.getState().selectedNodeIds.has("mid")).toBe(true);
  });
});
