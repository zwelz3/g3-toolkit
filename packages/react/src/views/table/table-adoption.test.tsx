/**
 * Issue #58: what a host with its own TanStack table still lacked in
 * TableView. Controlled and seeded sorting, per-column `hidden`, `csv`,
 * `align`, `width` and `title`, the empty-state row, the toolbar slot,
 * filter-kind inference from the column's values, first/last page
 * buttons with a rows-per-page select, unique row ids, and pruning of
 * filters and sorts on columns that leave with a column-set change.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import {
  TableView,
  getCsv,
  type DataGridColumn,
  type TableSort,
} from "./TableView";

interface Binding {
  s: string;
  label: string;
  count: number | null;
  kind: string;
}

const bindings: Binding[] = [
  { s: "urn:1", label: "one", count: 1, kind: "A" },
  { s: "urn:2", label: "two", count: 2, kind: "B" },
  { s: "urn:3", label: "three", count: 3, kind: "A" },
  { s: "urn:4", label: "four", count: null, kind: "A" },
];

/** No explicit filter kinds: every column is inferred. */
const columns: DataGridColumn<Binding>[] = [
  { id: "s", header: "Subject", value: (r) => r.s },
  { id: "label", header: "Label", value: (r) => r.label },
  { id: "count", header: "Count", value: (r) => r.count },
  { id: "kind", header: "Kind", value: (r) => r.kind },
];

function visibleRowIds(): string[] {
  return [...document.querySelectorAll("[data-testid^='table-row-']")].map(
    (tr) => String(tr.getAttribute("data-testid")).replace("table-row-", ""),
  );
}

function headerIds(): string[] {
  return [...document.querySelectorAll("thead th")].map((th) =>
    String(
      th
        .querySelector("[data-testid^='column-sort-']")
        ?.getAttribute("data-testid")
        ?.replace("column-sort-", ""),
    ),
  );
}

describe("TableView sorting props (#58.1)", () => {
  it("initialSorting seeds an uncontrolled sort that a click then changes and reports", () => {
    const onSortingChange = vi.fn();
    render(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        initialSorting={[{ id: "label", desc: false }]}
        onSortingChange={onSortingChange}
      />,
    );
    expect(visibleRowIds()).toEqual(["urn:4", "urn:1", "urn:3", "urn:2"]);
    expect(
      screen.getByTestId("column-sort-label").closest("th"),
    ).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(screen.getByTestId("column-sort-label"));
    expect(visibleRowIds()).toEqual(["urn:2", "urn:3", "urn:1", "urn:4"]);
    expect(onSortingChange).toHaveBeenLastCalledWith([
      { id: "label", desc: true },
    ]);
  });

  it("controlled sorting follows the prop; a toggle reports without applying", () => {
    const onSortingChange = vi.fn();
    const sorted: TableSort[] = [{ id: "kind", desc: true }];
    const { rerender } = render(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        sorting={sorted}
        onSortingChange={onSortingChange}
      />,
    );
    expect(visibleRowIds()).toEqual(["urn:2", "urn:1", "urn:3", "urn:4"]);
    fireEvent.click(screen.getByTestId("column-sort-kind"));
    expect(onSortingChange).toHaveBeenLastCalledWith([]);
    // Nothing moves until the host re-renders with the new value.
    expect(visibleRowIds()).toEqual(["urn:2", "urn:1", "urn:3", "urn:4"]);
    rerender(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        sorting={[{ id: "label", desc: false }]}
        onSortingChange={onSortingChange}
      />,
    );
    expect(visibleRowIds()).toEqual(["urn:4", "urn:1", "urn:3", "urn:2"]);
  });
});

describe("TableView per-column hidden (#58.2)", () => {
  it("starts toggled off, stays listed in the menu, and the user can show it", () => {
    render(
      <TableView
        rows={bindings}
        columns={columns.map((c) =>
          c.id === "label" ? { ...c, hidden: true } : c,
        )}
        rowId={(r) => r.s}
      />,
    );
    expect(headerIds()).toEqual(["s", "count", "kind"]);
    fireEvent.click(screen.getByTestId("column-visibility-toggle"));
    const row = screen.getByTestId("column-menu-row-label");
    expect(within(row).getByRole("checkbox")).not.toBeChecked();
    fireEvent.click(within(row).getByRole("checkbox"));
    expect(headerIds()).toEqual(["s", "label", "count", "kind"]);
  });
});

describe("TableView per-column csv (#58.3)", () => {
  it("the export writes the column's csv value instead of the cell value; getCsv takes the same hook", () => {
    const download = vi.fn();
    render(
      <TableView
        rows={bindings}
        columns={[
          {
            id: "s",
            header: "Subject",
            value: (r) => r.label,
            csv: (r) => `<${r.s}>`,
          },
          { id: "count", header: "Count", value: (r) => r.count },
        ]}
        rowId={(r) => r.s}
        exportCsv={{ download }}
      />,
    );
    fireEvent.click(screen.getByTestId("table-export-csv"));
    expect(download).toHaveBeenLastCalledWith(
      ["Subject,Count", "<urn:1>,1", "<urn:2>,2", "<urn:3>,3", "<urn:4>,"].join(
        "\r\n",
      ) + "\r\n",
      "table.csv",
    );
    type CsvRows = Parameters<typeof getCsv>[0];
    type CsvColumns = Parameters<typeof getCsv>[1];
    const csvRows = [
      { getValue: () => "cell", original: { iri: "urn:x" } },
    ] as unknown as CsvRows;
    const csvColumns = [
      { id: "a", columnDef: { header: "A" } },
      { id: "b", columnDef: { header: "B" } },
    ] as unknown as CsvColumns;
    expect(
      getCsv(csvRows, csvColumns, {
        value: (row, column) =>
          column.id === "a" ? (row.original as { iri: string }).iri : undefined,
      }),
    ).toBe("A,B\r\nurn:x,cell\r\n");
  });
});

describe("TableView empty state (#58.4)", () => {
  it("shows a status row when the filters match nothing, with the default or custom text, and not otherwise", () => {
    const { rerender } = render(
      <TableView rows={bindings} columns={columns} rowId={(r) => r.s} />,
    );
    expect(screen.queryByTestId("table-empty")).toBeNull();
    fireEvent.change(screen.getByTestId("column-filter-label"), {
      target: { value: "zzz" },
    });
    expect(visibleRowIds()).toEqual([]);
    const status = within(screen.getByTestId("table-empty")).getByRole(
      "status",
    );
    expect(status).toHaveTextContent("No rows match the current filters.");
    rerender(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        emptyMessage={<em>Nothing here</em>}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Nothing here");
    fireEvent.change(screen.getByTestId("column-filter-label"), {
      target: { value: "" },
    });
    expect(screen.queryByTestId("table-empty")).toBeNull();
  });

  it("an empty table says so, with the path's noun", () => {
    render(<TableView rows={[]} columns={columns} />);
    expect(screen.getByRole("status")).toHaveTextContent("No rows.");
  });

  it("UGM path: nodes", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["T"], properties: { name: "A" } });
    render(<TableView ugm={ugm} />);
    fireEvent.change(screen.getByTestId("column-filter-name"), {
      target: { value: "q" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "No nodes match the current filters.",
    );
  });
});

describe("TableView toolbar slot (#58.5)", () => {
  it("renders beside the Export CSV button, and alone when the export is off", () => {
    const { rerender } = render(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        exportCsv
        toolbar={<button data-testid="host-json">Export JSON</button>}
      />,
    );
    const end = screen.getByTestId("table-toolbar-end");
    expect(within(end).getByTestId("table-export-csv")).toBeInTheDocument();
    expect(within(end).getByTestId("host-json")).toBeInTheDocument();
    expect(end.parentElement).toHaveClass("g3t-table-toolbar");
    rerender(
      <TableView
        rows={bindings}
        columns={columns}
        rowId={(r) => r.s}
        toolbar={<button data-testid="host-json">Export JSON</button>}
      />,
    );
    expect(screen.queryByTestId("table-export-csv")).toBeNull();
    expect(screen.getByTestId("host-json")).toBeInTheDocument();
    rerender(
      <TableView rows={bindings} columns={columns} rowId={(r) => r.s} />,
    );
    expect(screen.queryByTestId("table-toolbar-end")).toBeNull();
  });
});

describe("TableView filter kind inference (#58.6)", () => {
  it("numbers get a range, a low-cardinality column a checklist, distinct strings text; nulls do not count", () => {
    render(<TableView rows={bindings} columns={columns} rowId={(r) => r.s} />);
    // count: 1, 2, 3 and a null: every present value is a number.
    expect(screen.getByTestId("column-filter-count-min")).toBeInTheDocument();
    // kind: A, B, A, A: 2 distinct of 4 present.
    fireEvent.click(screen.getByTestId("column-filter-kind"));
    expect(
      [
        ...screen
          .getByTestId("column-filter-kind-menu")
          .querySelectorAll("label"),
      ].map((l) => l.textContent),
    ).toEqual(["A (3)", "B (1)"]);
    // s and label: all distinct, so a checklist would be as long as the
    // column; text.
    expect(screen.getByTestId("column-filter-s")).toHaveAttribute(
      "placeholder",
      "Filter...",
    );
    expect(screen.getByTestId("column-filter-label")).toHaveAttribute(
      "placeholder",
      "Filter...",
    );
  });

  it("the distinct-count ceiling and the half-the-rows ratio both bound the checklist; an explicit kind wins; an empty table is text", () => {
    interface R {
      id: number;
      many: string;
      few: string;
    }
    // 60 rows: `many` has 25 distinct values (over the ceiling of 20),
    // `few` has 3 (within both bounds).
    const rows: R[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      many: `v${i % 25}`,
      few: `k${i % 3}`,
    }));
    const cols: DataGridColumn<R>[] = [
      { id: "id", header: "Id", value: (r) => r.id, filter: "text" },
      { id: "many", header: "Many", value: (r) => r.many },
      { id: "few", header: "Few", value: (r) => r.few },
    ];
    const { rerender } = render(
      <TableView rows={rows} columns={cols} rowId={(r) => String(r.id)} />,
    );
    // Explicit "text" on a numeric column wins over the inference.
    expect(screen.getByTestId("column-filter-id")).toHaveAttribute(
      "placeholder",
      "Filter...",
    );
    expect(screen.getByTestId("column-filter-many")).toHaveAttribute(
      "placeholder",
      "Filter...",
    );
    expect(screen.getByTestId("column-filter-few")).toHaveTextContent("All");
    rerender(<TableView rows={[]} columns={cols} />);
    expect(screen.getByTestId("column-filter-few")).toHaveAttribute(
      "placeholder",
      "Filter...",
    );
  });

  it("a column whose inferred kind flips with new rows drops its filter value", () => {
    interface R {
      id: string;
      v: unknown;
    }
    const cols: DataGridColumn<R>[] = [
      { id: "v", header: "V", value: (r) => r.v },
    ];
    const numeric: R[] = [
      { id: "a", v: 1 },
      { id: "b", v: 5 },
    ];
    const { rerender } = render(
      <TableView rows={numeric} columns={cols} rowId={(r) => r.id} />,
    );
    fireEvent.change(screen.getByTestId("column-filter-v-min"), {
      target: { value: "3" },
    });
    expect(visibleRowIds()).toEqual(["b"]);
    const text: R[] = [
      { id: "a", v: "x" },
      { id: "b", v: "y" },
    ];
    rerender(<TableView rows={text} columns={cols} rowId={(r) => r.id} />);
    // The [min, max] pair would have been fed to includesString; the
    // filter is gone and the text box is empty.
    expect(screen.getByTestId("column-filter-v")).toHaveValue("");
    expect(visibleRowIds()).toEqual(["a", "b"]);
  });
});

describe("TableView pagination additions (#58)", () => {
  const many: Binding[] = Array.from({ length: 25 }, (_, i) => ({
    s: `urn:${i}`,
    label: `row ${i}`,
    count: i,
    kind: "A",
  }));

  it("first/last jump to the ends and disable there", () => {
    render(
      <TableView
        rows={many}
        columns={columns}
        rowId={(r) => r.s}
        pageSize={10}
      />,
    );
    const first = screen.getByTestId("table-page-first");
    const last = screen.getByTestId("table-page-last");
    expect(first).toBeDisabled();
    fireEvent.click(last);
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 3 of 3",
    );
    expect(last).toBeDisabled();
    expect(visibleRowIds()).toEqual([
      "urn:20",
      "urn:21",
      "urn:22",
      "urn:23",
      "urn:24",
    ]);
    fireEvent.click(first);
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 3",
    );
    expect(first).toBeDisabled();
  });

  it("the rows-per-page select is internal without onPageSizeChange and lasts until the prop changes", () => {
    const { rerender } = render(
      <TableView
        rows={many}
        columns={columns}
        rowId={(r) => r.s}
        pageSize={10}
        pageSizeOptions={[5, 25]}
      />,
    );
    const select = screen.getByTestId("table-page-size");
    // The current size is listed even when it is not an option.
    expect([...select.querySelectorAll("option")].map((o) => o.value)).toEqual([
      "5",
      "10",
      "25",
    ]);
    fireEvent.change(select, { target: { value: "25" } });
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 1",
    );
    expect(visibleRowIds()).toHaveLength(25);
    rerender(
      <TableView
        rows={many}
        columns={columns}
        rowId={(r) => r.s}
        pageSize={5}
        pageSizeOptions={[5, 25]}
      />,
    );
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 5",
    );
  });

  it("with onPageSizeChange the pick is reported and the host's pageSize governs", () => {
    const onPageSizeChange = vi.fn();
    render(
      <TableView
        rows={many}
        columns={columns}
        rowId={(r) => r.s}
        pageSize={10}
        pageSizeOptions={[10, 25]}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    fireEvent.change(screen.getByTestId("table-page-size"), {
      target: { value: "25" },
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 3",
    );
  });
});

describe("TableView per-column align, width and title (#58)", () => {
  it("num right-aligns header and cells on tabular figures; width and title reach the header", () => {
    render(
      <TableView
        rows={bindings}
        columns={[
          { id: "s", header: "Subject", value: (r) => r.s, width: 240 },
          {
            id: "count",
            header: "N",
            value: (r) => r.count,
            align: "num",
            title: "Number of statements",
          },
        ]}
        rowId={(r) => r.s}
      />,
    );
    const sTh = screen.getByTestId("column-sort-s").closest("th")!;
    expect(sTh.style.width).toBe("240px");
    expect(sTh.style.textAlign).toBe("left");
    const nButton = screen.getByTestId("column-sort-count");
    expect(nButton).toHaveAttribute("title", "Number of statements");
    expect(nButton.closest("th")!.style.textAlign).toBe("right");
    const cells = screen.getByTestId("table-row-urn:1").querySelectorAll("td");
    expect(cells[0]!.style.textAlign).toBe("");
    expect(cells[1]!.style.textAlign).toBe("right");
    expect(cells[1]!.style.fontVariantNumeric).toBe("tabular-nums");
  });
});

describe("TableView unique row ids (#58)", () => {
  it("suffixes repeated rowIds in data order, skipping a suffix the data already holds", () => {
    const onSelect = vi.fn();
    const rows = [
      { s: "urn:1", label: "a", count: 1, kind: "A" },
      { s: "urn:1", label: "b", count: 2, kind: "A" },
      { s: "urn:1#2", label: "c", count: 3, kind: "A" },
      { s: "urn:1", label: "d", count: 4, kind: "A" },
    ];
    render(
      <TableView
        rows={rows}
        columns={columns}
        rowId={(r) => r.s}
        selection={{ selected: new Set(), onSelect }}
      />,
    );
    expect(visibleRowIds()).toEqual([
      "urn:1",
      "urn:1#2",
      "urn:1#2#2",
      "urn:1#3",
    ]);
    fireEvent.click(screen.getByTestId("table-row-urn:1#3"));
    expect(onSelect).toHaveBeenLastCalledWith(["urn:1#3"]);
  });
});

describe("TableView column-set change (#58)", () => {
  interface Result {
    vars: string[];
    rows: Record<string, string | number>[];
  }
  const first: Result = {
    vars: ["s", "n"],
    rows: [
      { s: "urn:1", n: 1 },
      { s: "urn:2", n: 2 },
      { s: "urn:3", n: 3 },
    ],
  };
  const second: Result = {
    vars: ["s", "label"],
    rows: [
      { s: "urn:1", label: "one" },
      { s: "urn:2", label: "two" },
    ],
  };
  const third: Result = {
    vars: ["s", "n"],
    rows: [
      { s: "urn:9", n: 9 },
      { s: "urn:8", n: 8 },
    ],
  };
  const colsOf = (
    r: Result,
    extra: Partial<DataGridColumn<Record<string, string | number>>> = {},
  ): DataGridColumn<Record<string, string | number>>[] =>
    r.vars.map((v) => ({
      id: v,
      header: v,
      value: (row) => row[v],
      ...(v === "label" ? extra : {}),
    }));

  it("drops filters and the internal sort on columns that left, so they do not resurface when the column returns", () => {
    const { rerender } = render(
      <TableView
        rows={first.rows}
        columns={colsOf(first)}
        rowId={(r) => String(r.s)}
      />,
    );
    fireEvent.change(screen.getByTestId("column-filter-n-min"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("column-sort-n"));
    expect(visibleRowIds()).toEqual(["urn:3", "urn:2"]);
    rerender(
      <TableView
        rows={second.rows}
        columns={colsOf(second)}
        rowId={(r) => String(r.s)}
      />,
    );
    expect(headerIds()).toEqual(["s", "label"]);
    expect(visibleRowIds()).toEqual(["urn:1", "urn:2"]);
    expect(screen.getByTestId("table-pagination")).toHaveTextContent("2 rows");
    // The variable comes back: no stale filter hides urn:8, no stale
    // sort reorders.
    rerender(
      <TableView
        rows={third.rows}
        columns={colsOf(third)}
        rowId={(r) => String(r.s)}
      />,
    );
    expect(visibleRowIds()).toEqual(["urn:9", "urn:8"]);
    expect(screen.getByTestId("column-filter-n-min")).toHaveValue(null);
    expect(screen.getByTestId("column-sort-n").closest("th")).toHaveAttribute(
      "aria-sort",
      "none",
    );
  });

  it("a controlled sort on a departed column is reported back pruned; a column arriving hidden starts hidden", () => {
    const onSortingChange = vi.fn();
    const { rerender } = render(
      <TableView
        rows={first.rows}
        columns={colsOf(first)}
        rowId={(r) => String(r.s)}
        sorting={[{ id: "n", desc: true }]}
        onSortingChange={onSortingChange}
      />,
    );
    expect(visibleRowIds()).toEqual(["urn:3", "urn:2", "urn:1"]);
    rerender(
      <TableView
        rows={second.rows}
        columns={colsOf(second, { hidden: true })}
        rowId={(r) => String(r.s)}
        sorting={[{ id: "n", desc: true }]}
        onSortingChange={onSortingChange}
      />,
    );
    expect(onSortingChange).toHaveBeenLastCalledWith([]);
    expect(headerIds()).toEqual(["s"]);
  });
});
