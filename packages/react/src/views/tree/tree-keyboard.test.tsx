/**
 * Issue #36: TreeView is a WAI-ARIA tree. Roles and states, one
 * roving tab stop, arrows move and open/close, Home/End jump,
 * Enter/Space select.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import { TreeView } from "./TreeView";
import { useSelectionStore } from "../../state/selection-store";

/** root -> (a -> a1, b). */
function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("root", { types: ["T"], properties: { name: "Root" } });
  ugm.addNode("a", { types: ["T"], properties: { name: "A" } });
  ugm.addNode("a1", { types: ["T"], properties: { name: "A1" } });
  ugm.addNode("b", { types: ["T"], properties: { name: "B" } });
  ugm.addEdge("root", "a", { type: "contains", properties: {} });
  ugm.addEdge("a", "a1", { type: "contains", properties: {} });
  ugm.addEdge("root", "b", { type: "contains", properties: {} });
  return ugm;
}

const item = (id: string) => screen.getByTestId(`tree-node-${id}`);
const key = (id: string, k: string) => fireEvent.keyDown(item(id), { key: k });

describe("TreeView ARIA tree (issue #36)", () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
  });

  it("exposes tree / treeitem / group roles with level, expanded and selected", () => {
    useSelectionStore.getState().selectNodes(["b"]);
    render(<TreeView ugm={graph()} rootId="root" />);
    expect(screen.getByRole("tree")).toBeInTheDocument();
    expect(item("root")).toHaveAttribute("role", "treeitem");
    expect(item("root")).toHaveAttribute("aria-level", "1");
    expect(item("root")).toHaveAttribute("aria-expanded", "true");
    expect(item("a")).toHaveAttribute("aria-level", "2");
    expect(item("a1")).toHaveAttribute("aria-level", "3");
    // A leaf has no aria-expanded at all (not "false").
    expect(item("b")).not.toHaveAttribute("aria-expanded");
    expect(item("b")).toHaveAttribute("aria-selected", "true");
    expect(item("a")).toHaveAttribute("aria-selected", "false");
    // Children sit in a group owned by their treeitem.
    expect(item("root").querySelector('[role="group"]')).toContainElement(
      item("a"),
    );
    expect(item("root")).toHaveAttribute("aria-label", "Root");
  });

  it("has exactly one tab stop (roving tabindex)", () => {
    render(<TreeView ugm={graph()} rootId="root" />);
    const stops = screen
      .getAllByRole("treeitem")
      .filter((el) => el.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(item("root"));
    // The toggle button is not a tab stop.
    expect(screen.getByTestId("tree-toggle-root")).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("ArrowDown / ArrowUp move focus through the visible rows", () => {
    render(<TreeView ugm={graph()} rootId="root" />);
    item("root").focus();
    key("root", "ArrowDown");
    expect(document.activeElement).toBe(item("a"));
    expect(item("a")).toHaveAttribute("tabindex", "0");
    expect(item("root")).toHaveAttribute("tabindex", "-1");
    key("a", "ArrowDown");
    expect(document.activeElement).toBe(item("a1"));
    key("a1", "ArrowDown");
    expect(document.activeElement).toBe(item("b"));
    // Last row: ArrowDown stays put.
    key("b", "ArrowDown");
    expect(document.activeElement).toBe(item("b"));
    key("b", "ArrowUp");
    expect(document.activeElement).toBe(item("a1"));
  });

  it("ArrowRight opens a closed row, then moves into its first child", () => {
    render(<TreeView ugm={graph()} rootId="root" initialDepth={1} />);
    item("root").focus();
    key("root", "ArrowDown");
    expect(document.activeElement).toBe(item("a"));
    expect(item("a")).toHaveAttribute("aria-expanded", "false");
    key("a", "ArrowRight");
    expect(item("a")).toHaveAttribute("aria-expanded", "true");
    // Focus stays on the row that opened.
    expect(document.activeElement).toBe(item("a"));
    key("a", "ArrowRight");
    expect(document.activeElement).toBe(item("a1"));
  });

  it("ArrowLeft closes an open row, then moves to the parent", () => {
    render(<TreeView ugm={graph()} rootId="root" />);
    item("root").focus();
    key("root", "End");
    expect(document.activeElement).toBe(item("b"));
    key("b", "ArrowUp");
    expect(document.activeElement).toBe(item("a1"));
    // Leaf: ArrowLeft goes to the parent.
    key("a1", "ArrowLeft");
    expect(document.activeElement).toBe(item("a"));
    // Open row: ArrowLeft closes it (a1 disappears), focus stays.
    key("a", "ArrowLeft");
    expect(item("a")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("tree-node-a1")).toBeNull();
    expect(document.activeElement).toBe(item("a"));
    key("a", "ArrowLeft");
    expect(document.activeElement).toBe(item("root"));
    // Root, once closed, has no parent: ArrowLeft stays.
    key("root", "ArrowLeft");
    key("root", "ArrowLeft");
    expect(document.activeElement).toBe(item("root"));
  });

  it("Home / End jump to the first and last visible rows", () => {
    render(<TreeView ugm={graph()} rootId="root" />);
    item("root").focus();
    key("root", "End");
    expect(document.activeElement).toBe(item("b"));
    key("b", "Home");
    expect(document.activeElement).toBe(item("root"));
  });

  it("Enter and Space select the focused row and notify onSelect", () => {
    const onSelect = vi.fn();
    render(<TreeView ugm={graph()} rootId="root" onSelect={onSelect} />);
    item("root").focus();
    key("root", "ArrowDown");
    key("a", "Enter");
    expect(useSelectionStore.getState().selectedNodeIds.has("a")).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith("a");
    key("a", "ArrowDown");
    key("a1", " ");
    expect(useSelectionStore.getState().selectedNodeIds.has("a1")).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith("a1");
  });

  it("a pointer click makes that row the tab stop", () => {
    render(<TreeView ugm={graph()} rootId="root" />);
    fireEvent.click(item("b").querySelector(".g3t-tree-row")!);
    expect(item("b")).toHaveAttribute("tabindex", "0");
    expect(item("root")).toHaveAttribute("tabindex", "-1");
  });

  it("does not steal focus on mount", () => {
    render(<TreeView ugm={graph()} rootId="root" />);
    expect(document.activeElement).toBe(document.body);
  });
});
