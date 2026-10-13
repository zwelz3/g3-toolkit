/**
 * Breadcrumb behavior (bugfix): the tree breadcrumb shows the ancestor
 * PATH of the selected node (root -> ... -> selected), derived from
 * containment edges, not a click-history trail.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
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

/**
 * Issue #70: rows are paths (#59), so the breadcrumb follows the COPY
 * the user picked; a selection from outside shows the first copy in
 * placement order (the one the reveal scrolls to).
 */
describe("TreeView breadcrumb on a multi-parent node (#70)", () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
  });

  /** Root -> Alpha -> Mid -> Leaf, Root -> Beta -> Mid (Mid has two
   *  parents, so Mid and Leaf each render twice). */
  function diamond(): UGM {
    const ugm = new UGM();
    const node = (id: string, name: string) =>
      ugm.addNode(id, { types: ["T"], properties: { name } });
    node("root", "Root");
    node("a", "Alpha");
    node("b", "Beta");
    node("m", "Mid");
    node("x", "Leaf");
    const edge = (p: string, c: string) =>
      ugm.addEdge(p, c, { type: "c", properties: {} });
    edge("root", "a");
    edge("root", "b");
    edge("a", "m");
    edge("b", "m");
    edge("m", "x");
    return ugm;
  }
  const crumbText = () => screen.getByTestId("tree-breadcrumb").textContent!;
  const order = (...labels: string[]) => {
    const text = crumbText();
    const positions = labels.map((l) => text.indexOf(l));
    for (const pos of positions) expect(pos).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i - 1]!).toBeLessThan(positions[i]!);
    }
  };

  it("follows the copy picked in the tree: under the second parent, then under the first", () => {
    render(<TreeView ugm={diamond()} rootId="root" initialDepth={4} />);
    const [underAlpha, underBeta] = screen.getAllByTestId("tree-node-x");
    // Before #70 the path came from the first incoming edge, so this
    // pick showed Root > Alpha > Mid > Leaf.
    fireEvent.click(underBeta!.querySelector(".g3t-tree-row")!);
    order("Root", "Beta", "Mid", "Leaf");
    expect(crumbText()).not.toContain("Alpha");
    fireEvent.click(underAlpha!.querySelector(".g3t-tree-row")!);
    order("Root", "Alpha", "Mid", "Leaf");
    expect(crumbText()).not.toContain("Beta");
  });

  it("a keyboard pick follows the focused copy too", () => {
    render(<TreeView ugm={diamond()} rootId="root" initialDepth={4} />);
    // The tab stop starts on the root; End moves it to the last visible
    // row, the Leaf copy under Beta.
    const root = screen.getByTestId("tree-node-root");
    root.focus();
    fireEvent.keyDown(root, { key: "End" });
    const underBeta = screen.getAllByTestId("tree-node-x")[1]!;
    expect(document.activeElement).toBe(underBeta);
    fireEvent.keyDown(underBeta, { key: "Enter" });
    order("Root", "Beta", "Mid", "Leaf");
    expect(crumbText()).not.toContain("Alpha");
  });

  it("a selection from outside shows the first copy in placement order", () => {
    const ugm = diamond();
    useSelectionStore.getState().selectNodes(["x"]);
    render(<TreeView ugm={ugm} rootId="root" initialDepth={4} />);
    order("Root", "Alpha", "Mid", "Leaf");
    expect(crumbText()).not.toContain("Beta");
    // A pick under Beta, then the same node arriving again from
    // outside after another selection: the pick is forgotten.
    const underBeta = screen.getAllByTestId("tree-node-x")[1]!;
    fireEvent.click(underBeta.querySelector(".g3t-tree-row")!);
    expect(crumbText()).toContain("Beta");
    act(() => {
      useSelectionStore.getState().selectNodes(["a"]);
    });
    order("Root", "Alpha");
    act(() => {
      useSelectionStore.getState().selectNodes(["x"]);
    });
    order("Root", "Alpha", "Mid", "Leaf");
    expect(crumbText()).not.toContain("Beta");
  });

  it("a crumb click selects that ancestor and stays on the picked copy's path", () => {
    render(<TreeView ugm={diamond()} rootId="root" initialDepth={4} />);
    const underBeta = screen.getAllByTestId("tree-node-x")[1]!;
    fireEvent.click(underBeta.querySelector(".g3t-tree-row")!);
    const midCrumb = [
      ...screen.getByTestId("tree-breadcrumb").querySelectorAll("button"),
    ].find((b) => b.textContent === "Mid")!;
    fireEvent.click(midCrumb);
    expect(useSelectionStore.getState().selectedNodeIds.has("m")).toBe(true);
    // Mid's first copy is under Alpha; the crumb keeps the Beta path.
    order("Root", "Beta", "Mid");
    expect(crumbText()).not.toContain("Alpha");
    expect(crumbText()).not.toContain("Leaf");
  });

  it("shows no breadcrumb for a selected node the roots do not reach", () => {
    // Before #70 the edge-derived path showed Outside > Stray here, a
    // trail through rows the tree never renders.
    const ugm = diamond();
    ugm.addNode("outside", { types: ["T"], properties: { name: "Outside" } });
    ugm.addNode("stray", { types: ["T"], properties: { name: "Stray" } });
    ugm.addEdge("outside", "stray", { type: "c", properties: {} });
    ugm.addEdge("stray", "x", { type: "c", properties: {} });
    useSelectionStore.getState().selectNodes(["stray"]);
    render(<TreeView ugm={ugm} rootId="root" initialDepth={4} />);
    expect(screen.queryByTestId("tree-breadcrumb")).toBeNull();
  });
});
