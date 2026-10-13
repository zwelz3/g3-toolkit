/**
 * Issue #47, the last deferral: row virtualization through
 * @tanstack/react-virtual (the maintainer's dependency ruling), opt-in
 * through `virtualize` and active only when the current page holds
 * more rows than the threshold. Below it the DOM is the unvirtualized
 * table; above it only the windowed rows mount, with spacer rows
 * holding the height. jsdom has no layout, so the scroll region
 * measures 0 and the virtualizer has no window: the component must
 * then render the first `overscan` rows rather than nothing (the
 * same path as a browser's first commit). One test gives the scroll
 * region a height to exercise the real windowing, scrolling and the
 * focused-row pin.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TableView, type DataGridColumn } from "./TableView";

interface Rec {
  id: string;
  label: string;
  n: number;
}

function records(count: number): Rec[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    label: `row ${i}`,
    n: i,
  }));
}

const columns: DataGridColumn<Rec>[] = [
  { id: "id", header: "Id", value: (r) => r.id },
  { id: "label", header: "Label", value: (r) => r.label },
  { id: "n", header: "N", value: (r) => r.n, filter: "range" },
];

function rowIds(): string[] {
  return [...document.querySelectorAll("[data-testid^='table-row-']")].map(
    (tr) => String(tr.getAttribute("data-testid")).replace("table-row-", ""),
  );
}

function spacers(): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      "[data-testid='table-virtual-spacer']",
    ),
  ];
}

// jsdom defines offsetHeight on HTMLElement.prototype itself, so the
// override is restored from the saved descriptor rather than deleted
// (deleting it leaves `undefined`, which the virtualizer rounds to
// NaN and treats as a non-zero viewport). clientHeight lives on
// Element.prototype, so the override on HTMLElement can be deleted.
const offsetHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetHeight",
);
afterEach(() => {
  vi.unstubAllGlobals();
  if (offsetHeightDescriptor !== undefined)
    Object.defineProperty(
      HTMLElement.prototype,
      "offsetHeight",
      offsetHeightDescriptor,
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (HTMLElement.prototype as any).clientHeight;
});

describe("TableView virtualize (#47)", () => {
  it("is off by default: every page row is in the DOM", () => {
    render(
      <TableView
        rows={records(200)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={20}
      />,
    );
    expect(rowIds()).toHaveLength(200);
    expect(spacers()).toHaveLength(0);
  });

  it("at or below the threshold the DOM is unchanged (150 rows, default threshold)", () => {
    render(
      <TableView
        rows={records(150)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={20}
        virtualize
      />,
    );
    expect(rowIds()).toHaveLength(150);
    expect(spacers()).toHaveLength(0);
    expect(document.querySelector("tr[data-index]")).toBeNull();
  });

  it("above the threshold without layout (jsdom) renders the first overscan rows and a spacer, and still reports the total", () => {
    render(
      <TableView
        rows={records(200)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={20}
        virtualize
      />,
    );
    // Default overscan 10: rows 0..9, indexed for the focus pin.
    expect(rowIds()).toEqual(Array.from({ length: 10 }, (_, i) => `r${i}`));
    expect(screen.getByTestId("table-row-r9").getAttribute("data-index")).toBe(
      "9",
    );
    // One trailing spacer holds the rest: (200 - 10) * 20px.
    const sp = spacers();
    expect(sp).toHaveLength(1);
    expect(sp[0]!.style.height).toBe("3800px");
    // The count comes from the row model, not the DOM.
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "200 rows",
    );
  });

  it("overscan and threshold are configurable", () => {
    render(
      <TableView
        rows={records(40)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={10}
        virtualize={{ overscan: 3, threshold: 20 }}
      />,
    );
    expect(rowIds()).toEqual(["r0", "r1", "r2"]);
    expect(spacers()[0]!.style.height).toBe("370px");
  });

  it("rowHeight drives the estimate; without it a density estimate is used and rows are measured", () => {
    const { unmount } = render(
      <TableView
        rows={records(200)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={30}
        virtualize
      />,
    );
    expect(spacers()[0]!.style.height).toBe("5700px");
    unmount();
    render(
      <TableView
        rows={records(200)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        virtualize
        density="compact"
      />,
    );
    // The compact estimate is 22px. The ten mounted rows are measured
    // (jsdom reports 0 for a mounted row), so they contribute nothing
    // and the spacer holds the 180 unmeasured rows: 180 * 22. That the
    // number is not 190 * 22 is the proof the measurement is wired.
    expect(document.querySelectorAll("tr[data-index]")).toHaveLength(10);
    expect(spacers()[0]!.style.height).toBe("3960px");
  });

  it("is decided per page: a filtered page below the threshold is unvirtualized again", () => {
    render(
      <TableView
        rows={records(200)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={20}
        virtualize
        search
      />,
    );
    expect(spacers()).toHaveLength(1);
    // Quoted (#58 ruling: unquoted words match anywhere in the row,
    // so a bare `row 19` would keep every row holding "19").
    fireEvent.change(screen.getByTestId("table-search"), {
      target: { value: '"row 19"' },
    });
    // "row 19", "row 190".."row 199": 11 rows, all in the DOM.
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "11 of 200 rows",
    );
    expect(rowIds()).toHaveLength(11);
    expect(spacers()).toHaveLength(0);
  });

  it("CSV export writes every filtered row, not the mounted subset", () => {
    const download = vi.fn();
    render(
      <TableView
        rows={records(200)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={20}
        virtualize
        exportCsv={{ download }}
      />,
    );
    expect(rowIds()).toHaveLength(10);
    fireEvent.click(screen.getByTestId("table-export-csv"));
    const csv = download.mock.calls[0]![0] as string;
    const lines = csv.split("\r\n").filter((l) => l !== "");
    expect(lines).toHaveLength(201);
    expect(lines[200]).toBe("r199,row 199,199");
  });

  it("selection and renderCell work on virtual rows with their page indexes", () => {
    const onSelect = vi.fn();
    render(
      <TableView
        rows={records(200)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={20}
        virtualize
        selection={{ selected: new Set(["r3"]), onSelect }}
        renderCell={({ columnId, value }) =>
          columnId === "n" ? <b>#{String(value)}</b> : undefined
        }
      />,
    );
    expect(screen.getByTestId("table-row-r3").dataset.selected).toBe("true");
    expect(screen.getByText("#7").tagName).toBe("B");
    fireEvent.click(screen.getByTestId("table-row-r2"));
    fireEvent.click(screen.getByTestId("table-row-r5"), { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith(["r3", "r2", "r4", "r5"]);
  });

  it("autoPageSize is ignored while virtualize is set, so the page stays large", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        // Both observers (the table's page measurer and the
        // virtualizer's rect observer) get a report on observe; the
        // virtualizer reads entries[0], so an empty list is passed.
        constructor(private cb: (entries: unknown[]) => void) {}
        observe() {
          this.cb([]);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("g3t-table-scroll") ? 200 : 0;
      },
    });
    const { unmount } = render(
      <TableView
        rows={records(200)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={20}
        fill
        autoPageSize
      />,
    );
    // Without virtualize the measured page (200 / 20) applies.
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 20",
    );
    unmount();
    render(
      <TableView
        rows={records(200)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={20}
        fill
        autoPageSize
        virtualize
      />,
    );
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 1",
    );
    expect(spacers()).toHaveLength(1);
  });

  it("with a measured scroll region: windows the rows, moves the window on scroll, and keeps a focused row mounted", () => {
    // The virtualizer reads the scroll element's offsetHeight; give the
    // region 300px so the real range calculation runs (15 rows of 20px).
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("g3t-table-scroll") ? 300 : 0;
      },
    });
    render(
      <TableView
        rows={records(200)}
        columns={columns}
        rowId={(r) => r.id}
        pageSize={200}
        rowHeight={20}
        fill
        virtualize={{ overscan: 2 }}
        renderCell={({ columnId, rowId }) =>
          columnId === "id" ? (
            <button type="button" data-testid={`btn-${rowId}`}>
              {rowId}
            </button>
          ) : undefined
        }
      />,
    );
    // 15 in view + 2 overscan below; nothing above at scrollTop 0.
    expect(rowIds()).toEqual(Array.from({ length: 17 }, (_, i) => `r${i}`));
    let sp = spacers();
    expect(sp).toHaveLength(1);
    expect(sp[0]!.style.height).toBe(`${(200 - 17) * 20}px`);

    // Focus a control in row 0, then scroll 2000px down.
    act(() => screen.getByTestId("btn-r0").focus());
    expect(document.activeElement).toBe(screen.getByTestId("btn-r0"));
    const scroll = document.querySelector(".g3t-table-scroll") as HTMLElement;
    scroll.scrollTop = 2000;
    fireEvent.scroll(scroll);

    // Window is rows 100..114, overscan 2 each side; row 0 stays
    // because it holds the focus; rows 1..97 are gone.
    const ids = rowIds();
    expect(ids[0]).toBe("r0");
    expect(ids.slice(1)).toEqual(
      Array.from({ length: 19 }, (_, i) => `r${98 + i}`),
    );
    expect(document.activeElement).toBe(screen.getByTestId("btn-r0"));
    // Three spacers: between r0 and r98, none before r0 (height 0 is
    // not rendered), and after r116.
    sp = spacers();
    expect(sp.map((s) => s.style.height)).toEqual([
      `${(98 - 1) * 20}px`,
      `${(200 - 117) * 20}px`,
    ]);

    // Blur, scroll again: the pin lifts on the next window move.
    act(() => screen.getByTestId("btn-r0").blur());
    scroll.scrollTop = 2020;
    fireEvent.scroll(scroll);
    expect(rowIds()[0]).toBe("r99");
  });
});
