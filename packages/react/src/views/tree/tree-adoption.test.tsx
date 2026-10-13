/**
 * Issue #59: the adoption gaps a host found swapping its own keyboard
 * tree for TreeView. Filter with ancestors, a label render slot,
 * expand-only group rows, controlled selection, scroll-into-view on
 * an outside selection, `initialExpanded` plus the selected branch,
 * and a configurable aria-label.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import { TreeView, type TreeRowNode } from "./TreeView";
import { useSelectionStore } from "../../state/selection-store";

/**
 * Thing -> Agent -> (Person, Org)
 *       -> Entity -> Doc -> Report
 *       -> props [Group] -> (hasName, hasAge)
 */
function ontology(): UGM {
  const ugm = new UGM();
  const cls = (id: string, name: string, type = "Class") =>
    ugm.addNode(id, { types: [type], properties: { name } });
  cls("Thing", "Thing");
  cls("Agent", "Agent");
  cls("Person", "Person");
  cls("Org", "Organization");
  cls("Entity", "Entity");
  cls("Doc", "Document");
  cls("Report", "Report");
  cls("props", "Object properties", "Group");
  cls("hasName", "hasName", "Property");
  cls("hasAge", "hasAge", "Property");
  const sub = (p: string, c: string) =>
    ugm.addEdge(p, c, { type: "subClassOf", properties: {} });
  sub("Thing", "Agent");
  sub("Agent", "Person");
  sub("Agent", "Org");
  sub("Thing", "Entity");
  sub("Entity", "Doc");
  sub("Doc", "Report");
  sub("Thing", "props");
  sub("props", "hasName");
  sub("props", "hasAge");
  return ugm;
}

const item = (id: string) => screen.getByTestId(`tree-node-${id}`);
const row = (id: string) => item(id).querySelector(".g3t-tree-row")!;
const key = (id: string, k: string) => fireEvent.keyDown(item(id), { key: k });
const isGroup = (n: TreeRowNode) => n.type === "Group";

describe("TreeView filter (#59)", () => {
  beforeEach(() => {
    useSelectionStore.getState().clear();
  });

  it("keeps matching rows plus their ancestors and opens those ancestors", () => {
    // initialDepth 0: nothing is open, so the match is only reachable
    // because the filter opens Thing, Entity and Doc.
    render(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        initialDepth={0}
        filter="REP"
      />,
    );
    expect(item("Report")).toBeInTheDocument();
    expect(item("Doc")).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByTestId("tree-node-Agent")).toBeNull();
    expect(screen.queryByTestId("tree-node-Person")).toBeNull();
    // A match with no matching children renders as a leaf.
    expect(item("Report")).not.toHaveAttribute("aria-expanded");
  });

  it("holds the ancestors open: the chevron is inert and ArrowLeft climbs", () => {
    render(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        initialDepth={0}
        filter="rep"
      />,
    );
    expect(screen.getByTestId("tree-toggle-Doc")).toBeDisabled();
    fireEvent.click(screen.getByTestId("tree-toggle-Doc"));
    expect(item("Report")).toBeInTheDocument();
    item("Doc").focus();
    key("Doc", "ArrowLeft");
    expect(item("Report")).toBeInTheDocument();
    expect(document.activeElement).toBe(item("Entity"));
  });

  it("clearing the filter restores the expansion the user had", () => {
    const { rerender } = render(
      <TreeView ugm={ontology()} rootId="Thing" initialDepth={0} />,
    );
    fireEvent.click(screen.getByTestId("tree-toggle-Thing"));
    expect(item("Agent")).toBeInTheDocument();
    rerender(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        initialDepth={0}
        filter="rep"
      />,
    );
    expect(screen.queryByTestId("tree-node-Agent")).toBeNull();
    rerender(<TreeView ugm={ontology()} rootId="Thing" initialDepth={0} />);
    // Thing is open again (the user's toggle), Entity is closed again
    // (the filter held it open, nothing more).
    expect(item("Agent")).toBeInTheDocument();
    expect(item("Entity")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("tree-node-Doc")).toBeNull();
  });

  it("accepts a predicate over the row", () => {
    render(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        filter={(n) => n.type === "Property"}
      />,
    );
    expect(item("hasAge")).toBeInTheDocument();
    expect(item("props")).toBeInTheDocument();
    expect(screen.queryByTestId("tree-node-Agent")).toBeNull();
  });

  it("shows a filter-specific empty state when nothing matches, and an empty string is no filter", () => {
    const { rerender } = render(
      <TreeView ugm={ontology()} rootId="Thing" filter="zzz" />,
    );
    expect(screen.getByTestId("tree-view-filter-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("tree-view-empty")).toBeNull();
    rerender(<TreeView ugm={ontology()} rootId="Thing" filter="" />);
    expect(item("Agent")).toBeInTheDocument();
  });
});

describe("TreeView renderLabel (#59)", () => {
  it("renders the slot with the row and its context, around the type prefix", () => {
    render(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        renderLabel={(n, ctx) => (
          <span data-testid={`label-${n.id}`} title={`${ctx.childCount}`}>
            <em>{n.label}</em> ({ctx.childCount}) d{ctx.depth}{" "}
            {ctx.expanded ? "open" : "closed"}
          </span>
        )}
      />,
    );
    const agent = screen.getByTestId("label-Agent");
    expect(agent).toHaveTextContent("Agent (2) d1 open");
    expect(agent.querySelector("em")).not.toBeNull();
    // Entity is seeded open (depth 1) and has one child.
    expect(screen.getByTestId("label-Entity")).toHaveTextContent(
      "Entity (1) d1 open",
    );
    expect(screen.getByTestId("label-Doc")).toHaveTextContent("(1) d2 closed");
    // The prefix still renders beside the slot.
    expect(screen.getByTestId("tree-type-Agent")).toHaveTextContent("[Class]");
  });

  it("reports childCount from the hierarchy even while a filter hides children", () => {
    render(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        filter="person"
        renderLabel={(n, ctx) => `${n.label} (${ctx.childCount})`}
      />,
    );
    expect(screen.getByTestId("tree-label-Agent")).toHaveTextContent(
      "Agent (2)",
    );
    expect(screen.queryByTestId("tree-node-Org")).toBeNull();
  });
});

describe("TreeView group rows (#59)", () => {
  beforeEach(() => {
    useSelectionStore.getState().clear();
  });

  it("a group row toggles on click, Enter and Space, and is never selected", () => {
    const onSelect = vi.fn();
    render(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        initialDepth={1}
        isGroup={isGroup}
        onSelect={onSelect}
      />,
    );
    const group = item("props");
    expect(group).toHaveAttribute("data-group", "true");
    expect(group).not.toHaveAttribute("aria-selected");
    expect(group).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(row("props"));
    expect(group).toHaveAttribute("aria-expanded", "true");
    expect(item("hasName")).toBeInTheDocument();
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);
    expect(onSelect).not.toHaveBeenCalled();
    group.focus();
    key("props", "Enter");
    expect(group).toHaveAttribute("aria-expanded", "false");
    key("props", " ");
    expect(group).toHaveAttribute("aria-expanded", "true");
    // A member row still selects.
    fireEvent.click(row("hasName"));
    expect(useSelectionStore.getState().selectedNodeIds.has("hasName")).toBe(
      true,
    );
    expect(item("props")).not.toHaveAttribute("aria-selected");
  });

  it("a group id in the selection gets no highlight", () => {
    useSelectionStore.getState().selectNodes(["props"]);
    render(<TreeView ugm={ontology()} rootId="Thing" isGroup={isGroup} />);
    expect(item("props")).not.toHaveAttribute("aria-selected");
    expect(row("props").getAttribute("style")).not.toContain(
      "selection-highlight",
    );
  });
});

describe("TreeView controlled selection (#59)", () => {
  beforeEach(() => {
    useSelectionStore.getState().clear();
  });

  it("highlights `selected`, ignores the store, and reports picks through onSelect only", () => {
    useSelectionStore.getState().selectNodes(["Org"]);
    const onSelect = vi.fn();
    const { rerender } = render(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        selected="Person"
        onSelect={onSelect}
      />,
    );
    expect(item("Person")).toHaveAttribute("aria-selected", "true");
    expect(item("Org")).toHaveAttribute("aria-selected", "false");
    // A store change does not reach a controlled tree.
    act(() => {
      useSelectionStore.getState().selectNodes(["Agent"]);
    });
    expect(item("Agent")).toHaveAttribute("aria-selected", "false");
    expect(item("Person")).toHaveAttribute("aria-selected", "true");
    // A pick reports and does not write the store; the highlight waits
    // for the host.
    fireEvent.click(row("Entity"));
    expect(onSelect).toHaveBeenCalledWith("Entity");
    expect(useSelectionStore.getState().selectedNodeIds.has("Entity")).toBe(
      false,
    );
    expect(item("Entity")).toHaveAttribute("aria-selected", "false");
    rerender(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        selected="Entity"
        onSelect={onSelect}
      />,
    );
    expect(item("Entity")).toHaveAttribute("aria-selected", "true");
    expect(item("Person")).toHaveAttribute("aria-selected", "false");
  });

  it("selected={null} highlights nothing", () => {
    useSelectionStore.getState().selectNodes(["Org"]);
    render(<TreeView ugm={ontology()} rootId="Thing" selected={null} />);
    expect(item("Org")).toHaveAttribute("aria-selected", "false");
  });

  it("uncontrolled still writes the store (the default path)", () => {
    render(<TreeView ugm={ontology()} rootId="Thing" />);
    fireEvent.click(row("Org"));
    expect(useSelectionStore.getState().selectedNodeIds.has("Org")).toBe(true);
    expect(item("Org")).toHaveAttribute("aria-selected", "true");
  });
});

describe("TreeView reveal: scroll-into-view and branch opening (#59)", () => {
  const scrollIntoView = vi.fn();
  beforeEach(() => {
    useSelectionStore.getState().clear();
    scrollIntoView.mockClear();
    // jsdom does not implement scrollIntoView; the component guards
    // for that, and this stub observes the call.
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
  });
  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("a controlled selection change from outside opens its branch and scrolls to the row", () => {
    const { rerender } = render(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        initialDepth={0}
        selected={null}
      />,
    );
    expect(screen.queryByTestId("tree-node-Report")).toBeNull();
    rerender(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        initialDepth={0}
        selected="Report"
      />,
    );
    expect(item("Report")).toHaveAttribute("aria-selected", "true");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(item("Report"));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    // Other branches stay closed.
    expect(screen.queryByTestId("tree-node-Person")).toBeNull();
  });

  it("a store selection from outside scrolls; a pick inside the tree does not", () => {
    render(<TreeView ugm={ontology()} rootId="Thing" initialDepth={0} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    act(() => {
      useSelectionStore.getState().selectNodes(["Org"]);
    });
    expect(item("Org")).toHaveAttribute("aria-selected", "true");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(item("Org"));
    fireEvent.click(row("Agent"));
    expect(useSelectionStore.getState().selectedNodeIds.has("Agent")).toBe(
      true,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    item("Agent").focus();
    key("Agent", "ArrowDown");
    key("Person", "Enter");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // The same id arriving from outside later scrolls again.
    act(() => {
      useSelectionStore.getState().selectNodes(["Org"]);
    });
    act(() => {
      useSelectionStore.getState().selectNodes(["Person"]);
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(3);
  });

  it("the selection present at mount is seeded open and scrolled to", () => {
    useSelectionStore.getState().selectNodes(["Report"]);
    render(<TreeView ugm={ontology()} rootId="Thing" initialDepth={0} />);
    expect(item("Report")).toHaveAttribute("aria-selected", "true");
    expect(item("Doc")).toHaveAttribute("aria-expanded", "true");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("does not close an ancestor the user had toggled open when the selection moves under it", () => {
    const { rerender } = render(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        initialDepth={1}
        selected={null}
      />,
    );
    // Entity is beyond the seed: the user opens it by hand.
    fireEvent.click(screen.getByTestId("tree-toggle-Entity"));
    fireEvent.click(screen.getByTestId("tree-toggle-Doc"));
    expect(item("Report")).toBeInTheDocument();
    rerender(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        initialDepth={1}
        selected="Report"
      />,
    );
    expect(item("Report")).toHaveAttribute("aria-selected", "true");
    expect(item("Entity")).toHaveAttribute("aria-expanded", "true");
  });
});

describe("TreeView initialExpanded and ariaLabel (#59)", () => {
  beforeEach(() => {
    useSelectionStore.getState().clear();
  });

  it("initialExpanded opens the listed ids in addition to initialDepth, and they toggle afterwards", () => {
    render(
      <TreeView
        ugm={ontology()}
        rootId="Thing"
        initialDepth={1}
        initialExpanded={["Entity", "Doc"]}
      />,
    );
    expect(item("Report")).toBeInTheDocument();
    expect(screen.queryByTestId("tree-node-Person")).toBeNull();
    fireEvent.click(screen.getByTestId("tree-toggle-Doc"));
    expect(screen.queryByTestId("tree-node-Report")).toBeNull();
  });

  it("ariaLabel names the tree; the default stays Hierarchy", () => {
    const { unmount } = render(<TreeView ugm={ontology()} rootId="Thing" />);
    expect(screen.getByRole("tree")).toHaveAttribute("aria-label", "Hierarchy");
    unmount();
    render(<TreeView ugm={ontology()} rootId="Thing" ariaLabel="Classes" />);
    expect(screen.getByRole("tree", { name: "Classes" })).toBeInTheDocument();
  });
});

describe("TreeView: a node under several parents renders under each (#59 item 1)", () => {
  beforeEach(() => {
    useSelectionStore.getState().clear();
  });

  /** root -> a -> x -> x1, root -> b -> x (x has two parents). */
  function diamond(): UGM {
    const ugm = new UGM();
    for (const id of ["root", "a", "b", "x", "x1"]) {
      ugm.addNode(id, { types: ["T"], properties: { name: id } });
    }
    const edge = (p: string, c: string) =>
      ugm.addEdge(p, c, { type: "c", properties: {} });
    edge("root", "a");
    edge("root", "b");
    edge("a", "x");
    edge("b", "x");
    edge("x", "x1");
    return ugm;
  }

  it("renders a two-parent node under both parents, each row keyed by its path", () => {
    // Before the ruling `build` kept a visited set, so x rendered
    // under a only (and under b instead while a was closed).
    render(<TreeView ugm={diamond()} rootId="root" initialDepth={3} />);
    const copies = screen.getAllByTestId("tree-node-x");
    expect(copies).toHaveLength(2);
    expect(item("a").querySelector('[role="group"]')).toContainElement(
      copies[0]!,
    );
    expect(item("b").querySelector('[role="group"]')).toContainElement(
      copies[1]!,
    );
    expect(copies[0]!.getAttribute("data-path")).not.toBe(
      copies[1]!.getAttribute("data-path"),
    );
    // The subtree repeats too.
    expect(screen.getAllByTestId("tree-node-x1")).toHaveLength(2);
  });

  it("selecting one copy marks every copy selected", () => {
    render(<TreeView ugm={diamond()} rootId="root" initialDepth={3} />);
    const [first, second] = screen.getAllByTestId("tree-node-x");
    fireEvent.click(second!.querySelector(".g3t-tree-row")!);
    expect(useSelectionStore.getState().selectedNodeIds.has("x")).toBe(true);
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveAttribute("aria-selected", "true");
  });

  it("expansion is per copy: one copy open while the other stays closed", () => {
    render(<TreeView ugm={diamond()} rootId="root" initialDepth={2} />);
    const [first, second] = screen.getAllByTestId("tree-node-x");
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(second!.querySelector("button")!);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByTestId("tree-node-x1")).toHaveLength(1);
    // Keyboard identity is the path too: ArrowLeft from the open copy
    // closes it, then climbs to b, not a.
    second!.focus();
    fireEvent.keyDown(second!, { key: "ArrowLeft" });
    expect(second).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(second!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(item("b"));
  });

  it("cuts a cycle where a node is already on the current path", () => {
    // A -> B -> A, plus A -> C -> B: B appears under A and under C
    // (two paths), and A is never re-entered under B.
    const ugm = new UGM();
    for (const id of ["A", "B", "C"]) {
      ugm.addNode(id, { types: ["T"], properties: { name: id } });
    }
    ugm.addEdge("A", "B", { type: "c", properties: {} });
    ugm.addEdge("B", "A", { type: "c", properties: {} });
    ugm.addEdge("A", "C", { type: "c", properties: {} });
    ugm.addEdge("C", "B", { type: "c", properties: {} });
    render(<TreeView ugm={ugm} rootId="A" initialDepth={9} />);
    expect(screen.getAllByTestId("tree-node-A")).toHaveLength(1);
    expect(screen.getAllByTestId("tree-node-B")).toHaveLength(2);
    expect(screen.getAllByTestId("tree-node-C")).toHaveLength(1);
    for (const b of screen.getAllByTestId("tree-node-B")) {
      expect(b).not.toHaveAttribute("aria-expanded");
    }
  });

  it("the filter keeps the ancestors of every copy and reveals every copy", () => {
    const { rerender } = render(
      <TreeView ugm={diamond()} rootId="root" initialDepth={0} filter="x1" />,
    );
    expect(screen.getAllByTestId("tree-node-x1")).toHaveLength(2);
    expect(item("a")).toHaveAttribute("aria-expanded", "true");
    expect(item("b")).toHaveAttribute("aria-expanded", "true");
    // Reveal of an outside selection opens the branch of every copy.
    rerender(
      <TreeView ugm={diamond()} rootId="root" initialDepth={0} selected="x1" />,
    );
    const copies = screen.getAllByTestId("tree-node-x1");
    expect(copies).toHaveLength(2);
    for (const c of copies) expect(c).toHaveAttribute("aria-selected", "true");
  });

  it("the working-set limit counts rows, so a repeated node counts each time", () => {
    const ugm = diamond();
    const manager = {
      getLimit: () => 4,
    } as unknown as NonNullable<
      Parameters<typeof TreeView>[0]["workingSetManager"]
    >;
    render(
      <TreeView
        ugm={ugm}
        rootId="root"
        initialDepth={9}
        workingSetManager={manager}
      />,
    );
    // Pre-order: root, a, x, x1 reach the limit of 4; b is still
    // built as root's child (row 5) but gets no children of its own,
    // so x and x1 render once, not twice.
    expect(screen.getAllByRole("treeitem")).toHaveLength(5);
    expect(screen.getAllByTestId("tree-node-x")).toHaveLength(1);
    expect(screen.getAllByTestId("tree-node-x1")).toHaveLength(1);
  });
});
