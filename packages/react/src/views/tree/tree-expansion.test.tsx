/**
 * Issue #36: `initialDepth` seeds the expanded set instead of pinning
 * rows open, several roots render as a forest, the `[type]` prefix is
 * optional, and colors come from --g3t-* tokens.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import { TreeView } from "./TreeView";
import { useSelectionStore } from "../../state/selection-store";

/** root -> mid -> leaf -> deep, plus a sibling under root. */
function chainGraph(): UGM {
  const ugm = new UGM();
  ugm.addNode("root", { types: ["System"], properties: { name: "Root" } });
  ugm.addNode("mid", { types: ["Subsystem"], properties: { name: "Mid" } });
  ugm.addNode("leaf", { types: ["Part"], properties: { name: "Leaf" } });
  ugm.addNode("deep", { types: ["Part"], properties: { name: "Deep" } });
  ugm.addNode("sib", { types: ["Part"], properties: { name: "Sibling" } });
  ugm.addEdge("root", "mid", { type: "contains", properties: {} });
  ugm.addEdge("mid", "leaf", { type: "contains", properties: {} });
  ugm.addEdge("leaf", "deep", { type: "contains", properties: {} });
  ugm.addEdge("root", "sib", { type: "contains", properties: {} });
  return ugm;
}

describe("TreeView expansion (issue #36)", () => {
  beforeEach(() => {
    useSelectionStore.getState().clearSelection();
  });

  it("initialDepth opens the first levels on mount, as before", () => {
    render(<TreeView ugm={chainGraph()} rootId="root" />);
    // Default initialDepth 2: root (depth 0) and mid (depth 1) are
    // open, so leaf (depth 2) is visible but its child deep is not.
    expect(screen.getByTestId("tree-node-leaf")).toBeInTheDocument();
    expect(screen.queryByTestId("tree-node-deep")).toBeNull();
  });

  it("REGRESSION: a row within initialDepth collapses when toggled", () => {
    render(<TreeView ugm={chainGraph()} rootId="root" />);
    expect(screen.getByTestId("tree-node-mid")).toBeInTheDocument();
    // Before the fix `depth < initialDepth || expandedIds.has(id)`
    // re-opened the root on every render, so this click did nothing.
    fireEvent.click(screen.getByTestId("tree-toggle-root"));
    expect(screen.queryByTestId("tree-node-mid")).toBeNull();
    expect(screen.getByTestId("tree-node-root")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // And it re-opens on the next toggle.
    fireEvent.click(screen.getByTestId("tree-toggle-root"));
    expect(screen.getByTestId("tree-node-mid")).toBeInTheDocument();
  });

  it("a row beyond initialDepth still expands on click", () => {
    render(<TreeView ugm={chainGraph()} rootId="root" />);
    fireEvent.click(screen.getByTestId("tree-toggle-leaf"));
    expect(screen.getByTestId("tree-node-deep")).toBeInTheDocument();
  });

  it("initialDepth={0} renders only the root, collapsed", () => {
    render(<TreeView ugm={chainGraph()} rootId="root" initialDepth={0} />);
    expect(screen.getByTestId("tree-node-root")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByTestId("tree-node-mid")).toBeNull();
  });

  it("a graph change reseeds new nodes and keeps user toggles on existing ones", () => {
    const { rerender } = render(<TreeView ugm={chainGraph()} rootId="root" />);
    // User closes mid (a seeded row) and opens leaf (an unseeded one).
    fireEvent.click(screen.getByTestId("tree-toggle-mid"));
    expect(screen.queryByTestId("tree-node-leaf")).toBeNull();
    fireEvent.click(screen.getByTestId("tree-toggle-mid"));
    fireEvent.click(screen.getByTestId("tree-toggle-mid"));
    expect(screen.queryByTestId("tree-node-leaf")).toBeNull();

    // New graph: same shape plus a new subtree under root.
    const next = chainGraph();
    next.addNode("extra", { types: ["Part"], properties: { name: "Extra" } });
    next.addNode("extra-child", {
      types: ["Part"],
      properties: { name: "Extra child" },
    });
    next.addEdge("root", "extra", { type: "contains", properties: {} });
    next.addEdge("extra", "extra-child", {
      type: "contains",
      properties: {},
    });
    rerender(<TreeView ugm={next} rootId="root" />);

    // The new depth-1 row is seeded open; the user's collapse of mid
    // survives the reseed.
    expect(screen.getByTestId("tree-node-extra-child")).toBeInTheDocument();
    expect(screen.queryByTestId("tree-node-leaf")).toBeNull();
    expect(screen.getByTestId("tree-node-mid")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

describe("TreeView forest (issue #36 rootIds)", () => {
  it("renders several roots as top-level rows with no synthetic parent", () => {
    const ugm = new UGM();
    ugm.addNode("Thing", { types: ["Class"], properties: { name: "Thing" } });
    ugm.addNode("Entity", {
      types: ["Class"],
      properties: { name: "Entity" },
    });
    ugm.addNode("Doc", { types: ["Class"], properties: { name: "Doc" } });
    ugm.addNode("Agent", { types: ["Class"], properties: { name: "Agent" } });
    ugm.addEdge("Thing", "Agent", { type: "subClassOf", properties: {} });
    ugm.addEdge("Entity", "Doc", { type: "subClassOf", properties: {} });

    render(<TreeView ugm={ugm} rootIds={["Thing", "Entity"]} />);
    const tree = screen.getByRole("tree");
    const topLevel = [...tree.children].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(topLevel).toEqual(["tree-node-Thing", "tree-node-Entity"]);
    expect(screen.getByTestId("tree-node-Thing")).toHaveAttribute(
      "aria-level",
      "1",
    );
    expect(screen.getByTestId("tree-node-Entity")).toHaveAttribute(
      "aria-level",
      "1",
    );
    expect(screen.getByTestId("tree-node-Doc")).toHaveAttribute(
      "aria-level",
      "2",
    );
    expect(screen.getByTestId("tree-node-Agent")).toBeInTheDocument();
  });

  it("a declared root reachable from another root is pinned to the top level, once", () => {
    const ugm = chainGraph();
    render(<TreeView ugm={ugm} rootIds={["root", "mid"]} />);
    // mid renders exactly once, as a root, not again under root.
    expect(screen.getAllByTestId("tree-node-mid")).toHaveLength(1);
    expect(screen.getByTestId("tree-node-mid")).toHaveAttribute(
      "aria-level",
      "1",
    );
    // root still shows its other child.
    expect(screen.getByTestId("tree-node-sib")).toHaveAttribute(
      "aria-level",
      "2",
    );
  });

  it("rootIds takes precedence over rootId; unknown ids are skipped", () => {
    render(
      <TreeView ugm={chainGraph()} rootId="root" rootIds={["mid", "nope"]} />,
    );
    expect(screen.queryByTestId("tree-node-root")).toBeNull();
    expect(screen.getByTestId("tree-node-mid")).toHaveAttribute(
      "aria-level",
      "1",
    );
  });

  it("shows the empty state when no root exists", () => {
    render(<TreeView ugm={chainGraph()} rootIds={["nope"]} />);
    expect(screen.getByTestId("tree-view-empty")).toBeInTheDocument();
  });
});

describe("TreeView type prefix and tokens (issue #36)", () => {
  it("prints [type] by default and omits it with showType={false}", () => {
    const { unmount } = render(<TreeView ugm={chainGraph()} rootId="root" />);
    expect(screen.getByTestId("tree-type-root")).toHaveTextContent("[System]");
    unmount();
    render(<TreeView ugm={chainGraph()} rootId="root" showType={false} />);
    expect(screen.queryByTestId("tree-type-root")).toBeNull();
    expect(screen.getByTestId("tree-node-root")).not.toHaveTextContent(
      "[System]",
    );
  });

  it("styles rows, the type prefix and the breadcrumb from theme tokens", () => {
    useSelectionStore.getState().selectNodes(["leaf"]);
    render(<TreeView ugm={chainGraph()} rootId="root" />);
    const typePrefix = screen.getByTestId("tree-type-root");
    expect(typePrefix.getAttribute("style")).toContain("var(--g3t-text-muted");
    const selectedRow = screen
      .getByTestId("tree-node-leaf")
      .querySelector(".g3t-tree-row")!;
    expect(selectedRow.getAttribute("style")).toContain(
      "var(--g3t-selection-highlight",
    );
    const crumb = screen.getByTestId("tree-breadcrumb");
    expect(crumb.getAttribute("style")).toContain("var(--g3t-border");
    expect(crumb.querySelector("button")!.getAttribute("style")).toContain(
      "var(--g3t-accent-primary",
    );
    // No hard-coded light literals remain outside var() fallbacks.
    const html = screen.getByTestId("tree-view").innerHTML;
    expect(html).not.toMatch(/(?<!var\([^)]*)#2563eb/);
    expect(html).not.toMatch(/(?<!var\([^)]*)#666/);
  });
});
