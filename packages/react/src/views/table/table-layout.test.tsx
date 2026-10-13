/**
 * Issue #21: TableView could not fill a sized host, and pageSize was
 * read once.
 *
 * - pageSize reached TanStack through initialState, which is read at
 *   construction only, so a host computing a row count from its height
 *   could apply it only by remounting (discarding sort, filter and
 *   visibility state). It is controlled state now.
 * - The root carried no layout and its regions had no class names, so
 *   hosts selected on data-testid. The region classes are stable;
 *   `fill` opts into the flex-column layout.
 * - rowHeight makes the row count a host can fit derivable;
 *   autoPageSize derives it in-component from a ResizeObserver.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";
import { TableView } from "./TableView";

function graph(count: number): UGM {
  const ugm = new UGM();
  for (let i = 0; i < count; i++) {
    ugm.addNode(`n${i}`, { types: ["T"], properties: { name: `Row ${i}` } });
  }
  return ugm;
}

describe("TableView pageSize is live (#21b)", () => {
  it("re-paginates when the pageSize prop changes after mount", () => {
    const ugm = graph(30);
    const { rerender } = render(<TableView ugm={ugm} pageSize={10} />);
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 3",
    );
    expect(
      document.querySelectorAll("[data-testid^='table-row-']"),
    ).toHaveLength(10);

    rerender(<TableView ugm={ugm} pageSize={30} />);
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 1",
    );
    expect(
      document.querySelectorAll("[data-testid^='table-row-']"),
    ).toHaveLength(30);
  });

  it("keeps the first visible row in view (page index clamped) when the page grows", () => {
    const ugm = graph(30);
    const { rerender } = render(<TableView ugm={ugm} pageSize={10} />);
    fireEvent.click(screen.getByText("Next →"));
    fireEvent.click(screen.getByText("Next →"));
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 3 of 3",
    );

    // Top row was n20; with 20 per page that row is on page 2, and
    // page 3 no longer exists.
    rerender(<TableView ugm={ugm} pageSize={20} />);
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 2 of 2",
    );
    expect(screen.getByTestId("table-row-n20")).toBeInTheDocument();
  });

  it("a pageSize change does not discard sort state (the remount workaround did)", () => {
    const ugm = new UGM();
    ugm.addNode("c", { types: ["Z"], properties: { name: "Charlie" } });
    ugm.addNode("a", { types: ["A"], properties: { name: "Alice" } });
    ugm.addNode("b", { types: ["M"], properties: { name: "Bob" } });
    const { rerender } = render(<TableView ugm={ugm} pageSize={10} />);
    fireEvent.click(screen.getByTestId("column-sort-types"));
    const header = screen.getByTestId("column-sort-types").closest("th");
    expect(header).toHaveAttribute("aria-sort", "ascending");

    rerender(<TableView ugm={ugm} pageSize={20} />);
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(
      document
        .querySelector("[data-testid^='table-row-']")
        ?.getAttribute("data-testid"),
    ).toBe("table-row-a");
  });
});

describe("TableView layout classes and fill mode (#21a)", () => {
  it("names each region so a host can style them without test ids", () => {
    render(<TableView ugm={graph(3)} className="host-class" />);
    const root = screen.getByTestId("table-view");
    expect(root).toHaveClass("g3t-table");
    expect(root).toHaveClass("host-class");
    expect(root).not.toHaveClass("g3t-table-fill");
    expect(root.querySelector(":scope > .g3t-table-toolbar")).not.toBeNull();
    expect(
      root.querySelector(":scope > .g3t-table-scroll > table"),
    ).not.toBeNull();
    expect(root.querySelector(":scope > .g3t-table-pagination")).toBe(
      screen.getByTestId("table-pagination"),
    );
  });

  it("fill adds the layout class", () => {
    render(<TableView ugm={graph(3)} fill />);
    expect(screen.getByTestId("table-view")).toHaveClass(
      "g3t-table",
      "g3t-table-fill",
    );
  });
});

describe("TableView rowHeight and autoPageSize (#21c)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (HTMLElement.prototype as any).clientHeight;
  });

  it("applies rowHeight to data rows and filler rows", () => {
    render(<TableView ugm={graph(30)} pageSize={20} rowHeight={28} />);
    fireEvent.click(screen.getByText("Next →"));
    expect(screen.getByTestId("table-row-n20").style.height).toBe("28px");
    const fillers = screen.getAllByTestId("table-filler-row");
    expect(fillers.length).toBe(10);
    expect(fillers[0]!.style.height).toBe("28px");
  });

  it("autoPageSize falls back to pageSize where ResizeObserver is absent", () => {
    // jsdom has no ResizeObserver; the guard must leave pagination on
    // the prop rather than throwing or sizing to 1.
    expect(typeof ResizeObserver).toBe("undefined");
    render(
      <TableView
        ugm={graph(30)}
        pageSize={10}
        rowHeight={20}
        fill
        autoPageSize
      />,
    );
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 3",
    );
  });

  it("autoPageSize derives the page size from the scroll region and rowHeight", () => {
    // A ResizeObserver stub that reports once on observe (the real one
    // delivers the initial size the same way), and a 200px scroll
    // region: 200 / 20 = 10 rows per page.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private cb: () => void) {}
        observe() {
          this.cb();
        }
        disconnect() {}
      },
    );
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("g3t-table-scroll") ? 200 : 0;
      },
    });
    render(
      <TableView
        ugm={graph(30)}
        pageSize={50}
        rowHeight={20}
        fill
        autoPageSize
      />,
    );
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 3",
    );
    expect(
      document.querySelectorAll("[data-testid^='table-row-']"),
    ).toHaveLength(10);
  });

  it("autoPageSize is inert outside fill mode (no host height to measure)", () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private cb: () => void) {}
        observe() {
          this.cb();
        }
        disconnect() {}
      },
    );
    render(
      <TableView ugm={graph(30)} pageSize={15} rowHeight={20} autoPageSize />,
    );
    expect(screen.getByTestId("table-pagination")).toHaveTextContent(
      "Page 1 of 2",
    );
  });
});
