/**
 * Issue #47: the TableView follow-ups deferred from #39 that needed
 * no dependency ruling. CSV export of the filtered rows (visibility,
 * order and sort respected, RFC 4180 escaping), the "values" filter as
 * a checklist (several values at once, counts from the faceted row
 * model), menu-based column reorder over a host-controllable
 * `columnOrder`, and a cross-column search over the visible columns.
 * Each feature is exercised on the rows path and, where it applies,
 * on the UGM path. Virtualization stays deferred.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { createTable, getCoreRowModel } from "@tanstack/react-table";
import { UGM } from "@g3-toolkit/core";
import { useSelectionStore } from "../../state/selection-store";
import { TableView, getCsv, type DataGridColumn } from "./TableView";

interface Binding {
  s: string;
  label: string;
  count: number;
  kind: "A" | "B" | "C";
}

const bindings: Binding[] = [
  { s: "urn:1", label: "one", count: 1, kind: "A" },
  { s: "urn:2", label: "two", count: 2, kind: "B" },
  { s: "urn:3", label: "three", count: 3, kind: "A" },
  { s: "urn:4", label: "four", count: 4, kind: "C" },
];

const columns: DataGridColumn<Binding>[] = [
  { id: "s", header: "Subject", value: (r) => r.s },
  {
    id: "label",
    header: "Label",
    value: (r) => r.label,
    render: (v) => <em>{String(v).toUpperCase()}</em>,
  },
  { id: "count", header: "Count", value: (r) => r.count, filter: "range" },
  { id: "kind", header: "Kind", value: (r) => r.kind, filter: "values" },
];

function ugmFixture(): UGM {
  const ugm = new UGM();
  ugm.addNode("alice", { types: ["Person"], properties: { name: "Alice" } });
  ugm.addNode("bob", { types: ["Person"], properties: { name: "Bob" } });
  ugm.addNode("acme", { types: ["Org"], properties: { name: "Acme, Inc" } });
  return ugm;
}

/** Header ids of the rendered thead, in DOM order. */
function headerOrder(): string[] {
  return [...document.querySelectorAll("thead th")].map((th) =>
    String(
      th
        .querySelector("[data-testid^='column-sort-']")
        ?.getAttribute("data-testid")
        ?.replace("column-sort-", ""),
    ),
  );
}

function visibleRowIds(): string[] {
  return [...document.querySelectorAll("[data-testid^='table-row-']")].map(
    (tr) => String(tr.getAttribute("data-testid")).replace("table-row-", ""),
  );
}

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
});

describe("getCsv (#47): pure, headless, RFC 4180", () => {
  it("quotes only where needed, doubles embedded quotes, uses CRLF, values not nodes", () => {
    interface R {
      a: string;
      b: number | null;
      c: { x: number };
    }
    const data: R[] = [
      { a: 'say "hi", then', b: 1, c: { x: 1 } },
      { a: "line\nbreak", b: null, c: { x: 2 } },
      { a: "plain", b: 3, c: { x: 3 } },
    ];
    const table = createTable<R>({
      data,
      columns: [
        { id: "a", accessorFn: (r) => r.a, header: "A, with comma" },
        { id: "b", accessorFn: (r) => r.b, header: () => "fn header" },
        { id: "c", accessorFn: (r) => r.c, header: "C" },
      ],
      getCoreRowModel: getCoreRowModel(),
      state: {},
      onStateChange: () => {},
      renderFallbackValue: null,
    });
    const csv = getCsv(
      table.getCoreRowModel().rows,
      table.getVisibleLeafColumns(),
    );
    expect(csv).toBe(
      [
        '"A, with comma",b,C',
        '"say ""hi"", then",1,"{""x"":1}"',
        '"line\nbreak",,"{""x"":2}"',
        'plain,3,"{""x"":3}"',
      ].join("\r\n") + "\r\n",
    );
  });
});

describe("TableView exportCsv (#47)", () => {
  it("rows path: filtered rows in the current sort, visible columns in order, cell values", () => {
    const download = vi.fn();
    render(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        exportCsv={{ filename: "bindings.csv", download }}
        columnOrder={["count", "s"]}
      />,
    );
    // Hide the rendered (uppercased) label column, filter to kind A,
    // sort by count descending.
    fireEvent.click(screen.getByTestId("column-visibility-toggle"));
    fireEvent.click(
      within(screen.getByTestId("column-menu-row-label")).getByRole("checkbox"),
    );
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("column-filter-kind"));
    fireEvent.click(screen.getByTestId("column-filter-kind-none"));
    fireEvent.click(screen.getByTestId("column-filter-kind-option-A"));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("column-sort-count"));
    expect(visibleRowIds()).toEqual(["urn:3", "urn:1"]);

    fireEvent.click(screen.getByTestId("table-export-csv"));
    expect(download).toHaveBeenCalledTimes(1);
    const [csv, filename] = download.mock.calls[0] as [string, string];
    expect(filename).toBe("bindings.csv");
    expect(csv).toBe(
      ["Count,Subject,Kind", "3,urn:3,A", "1,urn:1,A"].join("\r\n") + "\r\n",
    );
  });

  it("UGM path: header text, escaping of a comma in a property, text filter respected", () => {
    const download = vi.fn();
    render(<TableView ugm={ugmFixture()} exportCsv={{ download }} />);
    fireEvent.change(screen.getByTestId("column-filter-types"), {
      target: { value: "Org" },
    });
    fireEvent.click(screen.getByTestId("table-export-csv"));
    expect(download).toHaveBeenLastCalledWith(
      'ID,Types,Name\r\nacme,Org,"Acme, Inc"\r\n',
      "table.csv",
    );
  });

  it("the button is absent by default; the browser download goes through an object URL and is a no-op without one", () => {
    const { rerender } = render(
      <TableView rows={bindings} columns={columns} rowId={(r) => r.s} />,
    );
    expect(screen.queryByTestId("table-export-csv")).toBeNull();
    rerender(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        exportCsv
      />,
    );
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:table");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockReturnValue();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("table.csv");
        expect(this.href).toBe("blob:table");
      });
    try {
      fireEvent.click(screen.getByTestId("table-export-csv"));
      expect(create).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith("blob:table");
      // jsdom's own window.URL has no createObjectURL (the one above is
      // Node's); without it the click is a guarded no-op.
      const original = URL.createObjectURL;
      Object.defineProperty(URL, "createObjectURL", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      try {
        expect(() =>
          fireEvent.click(screen.getByTestId("table-export-csv")),
        ).not.toThrow();
        expect(click).toHaveBeenCalledTimes(1);
      } finally {
        Object.defineProperty(URL, "createObjectURL", {
          value: original,
          configurable: true,
          writable: true,
        });
      }
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe("TableView values checklist (#47)", () => {
  it("ticks several values at once (union within the column), counts follow the other filters", () => {
    render(<TableView rows={bindings} columns={columns} rowId={(r) => r.s} />);
    const button = screen.getByTestId("column-filter-kind");
    expect(button).toHaveTextContent("All");
    fireEvent.click(button);
    const menu = screen.getByTestId("column-filter-kind-menu");
    expect(
      [...menu.querySelectorAll("label")].map((l) => l.textContent),
    ).toEqual(["A (2)", "B (1)", "C (1)"]);
    // Unticking from "all" materializes the remaining set.
    fireEvent.click(screen.getByTestId("column-filter-kind-option-B"));
    expect(visibleRowIds()).toEqual(["urn:1", "urn:3", "urn:4"]);
    expect(button).toHaveTextContent("2 selected");
    fireEvent.click(screen.getByTestId("column-filter-kind-option-A"));
    expect(visibleRowIds()).toEqual(["urn:4"]);
    expect(button).toHaveTextContent("C");
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "1 of 4 rows",
    );
    fireEvent.click(screen.getByTestId("column-filter-kind-option-A"));
    expect(visibleRowIds()).toEqual(["urn:1", "urn:3", "urn:4"]);

    // A range filter on another column narrows the counts (faceted
    // model excludes only this column's own filter).
    fireEvent.change(screen.getByTestId("column-filter-count-min"), {
      target: { value: "3" },
    });
    expect(
      [...menu.querySelectorAll("label")].map((l) => l.textContent),
    ).toEqual(["A (1)", "C (1)"]);
    expect(visibleRowIds()).toEqual(["urn:3", "urn:4"]);

    // "None" keeps nothing; "All" clears the filter.
    fireEvent.click(screen.getByTestId("column-filter-kind-none"));
    expect(visibleRowIds()).toEqual([]);
    expect(button).toHaveTextContent("None");
    fireEvent.click(screen.getByTestId("column-filter-kind-all"));
    expect(visibleRowIds()).toEqual(["urn:3", "urn:4"]);
    expect(button).toHaveTextContent("All");
  });

  it("closes on Escape and on an outside pointerdown, and the header sort is not toggled by the popover", () => {
    render(<TableView rows={bindings} columns={columns} rowId={(r) => r.s} />);
    fireEvent.click(screen.getByTestId("column-filter-kind"));
    expect(screen.getByTestId("column-filter-kind-menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("column-filter-kind-menu")).toBeNull();
    fireEvent.click(screen.getByTestId("column-filter-kind"));
    fireEvent.click(screen.getByTestId("column-filter-kind-option-A"));
    expect(screen.getByTestId("column-filter-kind-menu")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("column-filter-kind-menu")).toBeNull();
    expect(
      screen.getByTestId("column-sort-kind").closest("th"),
    ).toHaveAttribute("aria-sort", "none");
  });
});

describe("TableView column reorder (#47)", () => {
  it("rows path: the menu moves a column left/right and reports the full order", () => {
    const onColumnOrderChange = vi.fn();
    render(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        onColumnOrderChange={onColumnOrderChange}
      />,
    );
    expect(headerOrder()).toEqual(["s", "label", "count", "kind"]);
    fireEvent.click(screen.getByTestId("column-visibility-toggle"));
    expect(screen.getByTestId("column-move-left-s")).toBeDisabled();
    expect(screen.getByTestId("column-move-right-kind")).toBeDisabled();
    fireEvent.click(screen.getByTestId("column-move-right-s"));
    expect(headerOrder()).toEqual(["label", "s", "count", "kind"]);
    expect(onColumnOrderChange).toHaveBeenLastCalledWith([
      "label",
      "s",
      "count",
      "kind",
    ]);
    fireEvent.click(screen.getByTestId("column-move-left-kind"));
    expect(headerOrder()).toEqual(["label", "s", "kind", "count"]);
    // The menu lists columns in the same order, and the move buttons
    // do not toggle visibility.
    const menu = screen.getByTestId("column-visibility-menu");
    expect(
      [...menu.querySelectorAll("[data-testid^='column-menu-row-']")].map(
        (el) => el.getAttribute("data-testid"),
      ),
    ).toEqual([
      "column-menu-row-label",
      "column-menu-row-s",
      "column-menu-row-kind",
      "column-menu-row-count",
    ]);
    expect(menu.querySelectorAll("input:checked")).toHaveLength(4);
  });

  it("rows path: controlled columnOrder follows the prop and the move reports without applying", () => {
    const onColumnOrderChange = vi.fn();
    const { rerender } = render(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        columnOrder={["kind"]}
        onColumnOrderChange={onColumnOrderChange}
      />,
    );
    expect(headerOrder()).toEqual(["kind", "s", "label", "count"]);
    fireEvent.click(screen.getByTestId("column-visibility-toggle"));
    fireEvent.click(screen.getByTestId("column-move-right-kind"));
    expect(onColumnOrderChange).toHaveBeenLastCalledWith([
      "s",
      "kind",
      "label",
      "count",
    ]);
    // Fully controlled: nothing moves until the host re-renders.
    expect(headerOrder()).toEqual(["kind", "s", "label", "count"]);
    rerender(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        columnOrder={["s", "kind", "label", "count"]}
        onColumnOrderChange={onColumnOrderChange}
      />,
    );
    expect(headerOrder()).toEqual(["s", "kind", "label", "count"]);
  });

  it("UGM path: built-in and property columns reorder alike", () => {
    render(<TableView ugm={ugmFixture()} />);
    expect(headerOrder()).toEqual(["id", "types", "name"]);
    fireEvent.click(screen.getByTestId("column-visibility-toggle"));
    fireEvent.click(screen.getByTestId("column-move-left-name"));
    fireEvent.click(screen.getByTestId("column-move-left-name"));
    expect(headerOrder()).toEqual(["name", "id", "types"]);
    const first = screen.getByTestId("table-row-alice").querySelector("td");
    expect(first).toHaveTextContent("Alice");
  });
});

describe("TableView search (#47)", () => {
  it("is off by default; on, it matches the visible columns only and the count reflects it", () => {
    const { rerender } = render(
      <TableView rows={bindings} columns={columns} rowId={(r) => r.s} />,
    );
    expect(screen.queryByTestId("table-search")).toBeNull();
    rerender(
      <TableView rows={bindings} columns={columns} rowId={(r) => r.s} search />,
    );
    const box = screen.getByTestId("table-search");
    // "T" matches labels two/three (case-insensitive) but no subject.
    fireEvent.change(box, { target: { value: "T" } });
    expect(visibleRowIds()).toEqual(["urn:2", "urn:3"]);
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "2 of 4 rows",
    );
    // Hide the label column: the same query now matches nothing, and
    // the count follows.
    fireEvent.click(screen.getByTestId("column-visibility-toggle"));
    fireEvent.click(
      within(screen.getByTestId("column-menu-row-label")).getByRole("checkbox"),
    );
    expect(visibleRowIds()).toEqual([]);
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "0 of 4 rows",
    );
    // Showing it again restores the matches without editing the query.
    fireEvent.click(
      within(screen.getByTestId("column-menu-row-label")).getByRole("checkbox"),
    );
    expect(visibleRowIds()).toEqual(["urn:2", "urn:3"]);
    // Numbers match by their string form; the search stacks on the
    // per-column filters.
    fireEvent.change(box, { target: { value: "4" } });
    expect(visibleRowIds()).toEqual(["urn:4"]);
    fireEvent.change(box, { target: { value: "" } });
    expect(screen.getByTestId("table-pagination")).toHaveTextContent("4 rows");
  });

  it('skips filter: "none" columns and feeds the values-filter counts', () => {
    render(
      <TableView
        rows={bindings}
        columns={[
          { id: "s", header: "Subject", value: (r) => r.s, filter: "none" },
          { id: "label", header: "Label", value: (r) => r.label },
          {
            id: "kind",
            header: "Kind",
            value: (r) => r.kind,
            filter: "values",
          },
        ]}
        rowId={(r) => r.s}
        search
      />,
    );
    // "urn" is in every subject but the subject column is render-only.
    fireEvent.change(screen.getByTestId("table-search"), {
      target: { value: "urn" },
    });
    expect(visibleRowIds()).toEqual([]);
    fireEvent.change(screen.getByTestId("table-search"), {
      target: { value: "o" },
    });
    expect(visibleRowIds()).toEqual(["urn:1", "urn:2", "urn:4"]);
    fireEvent.click(screen.getByTestId("column-filter-kind"));
    expect(
      [
        ...screen
          .getByTestId("column-filter-kind-menu")
          .querySelectorAll("label"),
      ].map((l) => l.textContent),
    ).toEqual(["A (1)", "B (1)", "C (1)"]);
  });

  it("UGM path: searches id, types and properties", () => {
    render(<TableView ugm={ugmFixture()} search />);
    fireEvent.change(screen.getByTestId("table-search"), {
      target: { value: "org" },
    });
    expect(visibleRowIds()).toEqual(["acme"]);
    fireEvent.change(screen.getByTestId("table-search"), {
      target: { value: "bo" },
    });
    expect(visibleRowIds()).toEqual(["bob"]);
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "1 of 3 nodes",
    );
  });
});
