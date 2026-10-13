/**
 * Issue #39: TableView accepted only UGM rows, rendered cells as
 * strings, and always wrote row clicks into the shared selection
 * store. The rows path (`rows` + `columns`), the table-wide
 * `renderCell`, and the `selection` mode close those three gaps
 * without touching the UGM path's behavior or test ids.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import { useSelectionStore } from "../../state/selection-store";
import { createDefaultMenuManager } from "../../interaction/context-menu";
import { TableView, type DataGridColumn } from "./TableView";

interface Binding {
  s: string;
  label: string;
  count: number;
  kind: "A" | "B";
}

const bindings: Binding[] = [
  { s: "urn:1", label: "one", count: 1, kind: "A" },
  { s: "urn:2", label: "two", count: 2, kind: "B" },
  { s: "urn:3", label: "three", count: 3, kind: "A" },
];

const columns: DataGridColumn<Binding>[] = [
  { id: "s", header: "Subject", value: (r) => r.s },
  {
    id: "label",
    header: "Label",
    value: (r) => r.label,
    render: (v, r) => <a href={r.s}>{String(v)}</a>,
  },
  { id: "count", header: "Count", value: (r) => r.count, filter: "range" },
  { id: "kind", header: "Kind", value: (r) => r.kind, filter: "values" },
];

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
});

describe("TableView rows path (#39)", () => {
  it("renders rows and columns without a UGM", () => {
    render(<TableView rows={bindings} columns={columns} rowId={(r) => r.s} />);
    expect(screen.getByText("Subject")).toBeInTheDocument();
    expect(screen.getByText("Kind")).toBeInTheDocument();
    const row = screen.getByTestId("table-row-urn:2");
    expect(within(row).getByText("urn:2")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(screen.getByTestId("table-pagination")).toHaveTextContent("3 rows");
  });

  it("rowId defaults to the index", () => {
    render(<TableView rows={bindings} columns={columns} />);
    expect(screen.getByTestId("table-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("table-row-2")).toBeInTheDocument();
  });

  it("a column render produces nodes, not strings", () => {
    render(<TableView rows={bindings} columns={columns} />);
    const link = within(screen.getByTestId("table-row-1")).getByRole("link");
    expect(link).toHaveAttribute("href", "urn:2");
    expect(link).toHaveTextContent("two");
  });

  it("sorts by a column value", () => {
    render(<TableView rows={bindings} columns={columns} rowId={(r) => r.s} />);
    // TanStack sorts numeric columns descending first (getAutoSortDir),
    // so one click puts the largest count on top.
    fireEvent.click(screen.getByTestId("column-sort-count"));
    expect(
      screen.getByTestId("column-sort-count").closest("th"),
    ).toHaveAttribute("aria-sort", "descending");
    expect(
      document
        .querySelector("[data-testid^='table-row-']")
        ?.getAttribute("data-testid"),
    ).toBe("table-row-urn:3");
  });

  it("filter kinds: values select lists distinct values with counts, range narrows numerically", () => {
    render(<TableView rows={bindings} columns={columns} rowId={(r) => r.s} />);
    const select = screen.getByTestId(
      "column-filter-kind",
    ) as HTMLSelectElement;
    const labels = [...select.options].map((o) => o.textContent);
    expect(labels).toEqual(["All", "A (2)", "B (1)"]);
    fireEvent.change(select, { target: { value: "B" } });
    expect(screen.queryByTestId("table-row-urn:1")).toBeNull();
    expect(screen.getByTestId("table-row-urn:2")).toBeInTheDocument();
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "1 of 3 rows",
    );
    fireEvent.change(select, { target: { value: "" } });

    fireEvent.change(screen.getByTestId("column-filter-count-min"), {
      target: { value: "2" },
    });
    expect(screen.queryByTestId("table-row-urn:1")).toBeNull();
    expect(screen.getByTestId("table-row-urn:3")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("column-filter-count-max"), {
      target: { value: "2" },
    });
    expect(screen.queryByTestId("table-row-urn:3")).toBeNull();
    expect(screen.getByTestId("table-row-urn:2")).toBeInTheDocument();
  });

  it("filter 'none' renders no filter control; text is the default", () => {
    render(
      <TableView
        rows={bindings}
        columns={[
          { id: "s", header: "Subject", value: (r) => r.s, filter: "none" },
          { id: "label", header: "Label", value: (r) => r.label },
        ]}
      />,
    );
    expect(screen.queryByTestId("column-filter-s")).toBeNull();
    fireEvent.change(screen.getByTestId("column-filter-label"), {
      target: { value: "thr" },
    });
    expect(screen.queryByTestId("table-row-0")).toBeNull();
    expect(screen.getByTestId("table-row-2")).toBeInTheDocument();
  });
});

describe("TableView renderCell (#39)", () => {
  it("overrides cells on the rows path and defers to the column when it returns undefined", () => {
    render(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        renderCell={({ columnId, value, row }) =>
          columnId === "count" ? (
            <em data-testid={`chip-${row.s}`}>{Number(value) * 10}</em>
          ) : undefined
        }
      />,
    );
    expect(screen.getByTestId("chip-urn:2")).toHaveTextContent("20");
    // The label column's own render still applies.
    expect(
      within(screen.getByTestId("table-row-urn:2")).getByRole("link"),
    ).toBeInTheDocument();
  });

  it("applies on the UGM path too, with the flat node row as context", () => {
    const ugm = new UGM();
    ugm.addNode("alice", { types: ["Person"], properties: { name: "Alice" } });
    render(
      <TableView
        ugm={ugm}
        renderCell={({ columnId, value, row, rowId }) =>
          columnId === "name" ? (
            <span data-testid="custom-name">
              {String(value)}/{row.types}/{rowId}
            </span>
          ) : undefined
        }
      />,
    );
    expect(screen.getByTestId("custom-name")).toHaveTextContent(
      "Alice/Person/alice",
    );
    expect(
      within(screen.getByTestId("table-row-alice")).getByText("alice"),
    ).toBeInTheDocument();
  });
});

describe("TableView selection modes (#39)", () => {
  it('"none" leaves the shared store untouched and renders inert rows', () => {
    render(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        selection="none"
      />,
    );
    const row = screen.getByTestId("table-row-urn:1");
    expect(row.style.cursor).toBe("default");
    fireEvent.click(row);
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);
    expect(row.getAttribute("data-selected")).toBeNull();
  });

  it('"none" keeps the context menu available when a menuManager is given', () => {
    render(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        selection="none"
        menuManager={createDefaultMenuManager()}
      />,
    );
    fireEvent.contextMenu(screen.getByTestId("table-row-urn:1"));
    expect(screen.getByTestId("context-menu")).toBeInTheDocument();
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);
  });

  it("host-owned selection: onSelect receives the full next set per modifier", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        selection={{ selected: new Set(), onSelect }}
      />,
    );
    fireEvent.click(screen.getByTestId("table-row-urn:1"));
    expect(onSelect).toHaveBeenLastCalledWith(["urn:1"]);
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);

    rerender(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        selection={{ selected: new Set(["urn:1"]), onSelect }}
      />,
    );
    expect(
      screen.getByTestId("table-row-urn:1").getAttribute("data-selected"),
    ).toBe("true");
    fireEvent.click(screen.getByTestId("table-row-urn:3"), { ctrlKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(["urn:1", "urn:3"]);
    fireEvent.click(screen.getByTestId("table-row-urn:1"), { ctrlKey: true });
    expect(onSelect).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByTestId("table-row-urn:3"), { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(["urn:1", "urn:2", "urn:3"]);
  });

  it('default "store" keeps writing the shared store on the UGM path', () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"], properties: {} });
    render(<TableView ugm={ugm} />);
    fireEvent.click(screen.getByTestId("table-row-a"));
    expect(useSelectionStore.getState().selectedNodeIds.has("a")).toBe(true);
  });
});
