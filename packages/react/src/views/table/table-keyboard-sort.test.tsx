/**
 * Issue #57: the header sort trigger was a div with an onClick, so a
 * keyboard or screen-reader user could not sort at all. It is a native
 * button now (in the tab order, Enter and Space activate it, the
 * stylesheet focus ring applies); Shift+Enter adds a sort column the
 * way Shift+click does; aria-sort stays on the th, omitted on a column
 * that cannot sort.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TableView, type DataGridColumn } from "./TableView";

interface Binding {
  s: string;
  kind: string;
  count: number;
}

const rows: Binding[] = [
  { s: "urn:1", kind: "B", count: 2 },
  { s: "urn:2", kind: "A", count: 3 },
  { s: "urn:3", kind: "B", count: 1 },
  { s: "urn:4", kind: "A", count: 4 },
];

const columns: DataGridColumn<Binding>[] = [
  { id: "s", header: "Subject", value: (r) => r.s },
  { id: "kind", header: "Kind", value: (r) => r.kind, filter: "none" },
  { id: "count", header: "Count", value: (r) => r.count, filter: "range" },
];

function visibleRowIds(): string[] {
  return [...document.querySelectorAll("[data-testid^='table-row-']")].map(
    (tr) => String(tr.getAttribute("data-testid")).replace("table-row-", ""),
  );
}

describe("TableView keyboard sorting (#57)", () => {
  it("the sort trigger is a native button in the tab order; aria-sort rides on the th", () => {
    render(<TableView rows={rows} columns={columns} rowId={(r) => r.s} />);
    const trigger = screen.getByTestId("column-sort-kind");
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Kind" })).toBe(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.closest("th")).toHaveAttribute("aria-sort", "none");
  });

  it("Enter cycles the sort and aria-sort follows: ascending, descending, none", () => {
    render(<TableView rows={rows} columns={columns} rowId={(r) => r.s} />);
    const trigger = screen.getByTestId("column-sort-kind");
    const th = trigger.closest("th");
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(th).toHaveAttribute("aria-sort", "ascending");
    expect(visibleRowIds()).toEqual(["urn:2", "urn:4", "urn:1", "urn:3"]);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(th).toHaveAttribute("aria-sort", "descending");
    expect(visibleRowIds()).toEqual(["urn:1", "urn:3", "urn:2", "urn:4"]);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(th).toHaveAttribute("aria-sort", "none");
    expect(visibleRowIds()).toEqual(["urn:1", "urn:2", "urn:3", "urn:4"]);
  });

  it("Space sorts too, and the default is suppressed so the browser's own click does not toggle twice", () => {
    render(<TableView rows={rows} columns={columns} rowId={(r) => r.s} />);
    const trigger = screen.getByTestId("column-sort-count");
    const th = trigger.closest("th");
    const notCancelled = fireEvent.keyDown(trigger, { key: " " });
    expect(notCancelled).toBe(false);
    // Numeric columns sort descending first (TanStack getAutoSortDir).
    expect(th).toHaveAttribute("aria-sort", "descending");
    expect(visibleRowIds()).toEqual(["urn:4", "urn:2", "urn:1", "urn:3"]);
    // Other keys pass through untouched.
    expect(fireEvent.keyDown(trigger, { key: "Tab" })).toBe(true);
    expect(th).toHaveAttribute("aria-sort", "descending");
  });

  it("Shift+Enter adds a sort column, matching Shift+click", () => {
    render(<TableView rows={rows} columns={columns} rowId={(r) => r.s} />);
    const kind = screen.getByTestId("column-sort-kind");
    const count = screen.getByTestId("column-sort-count");
    fireEvent.keyDown(kind, { key: "Enter" });
    fireEvent.keyDown(count, { key: "Enter", shiftKey: true });
    expect(kind.closest("th")).toHaveAttribute("aria-sort", "ascending");
    // A numeric column enters the sort descending (getAutoSortDir), on
    // the keyboard exactly as on a click.
    expect(count.closest("th")).toHaveAttribute("aria-sort", "descending");
    // Kind ascending, then count descending within each kind.
    expect(visibleRowIds()).toEqual(["urn:4", "urn:2", "urn:1", "urn:3"]);

    // A plain Enter on a third column replaces the whole sort, exactly
    // as a plain click does.
    fireEvent.keyDown(screen.getByTestId("column-sort-s"), { key: "Enter" });
    expect(kind.closest("th")).toHaveAttribute("aria-sort", "none");
    expect(count.closest("th")).toHaveAttribute("aria-sort", "none");
    expect(screen.getByTestId("column-sort-s").closest("th")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("click behavior and the multi-sort modifier are unchanged", () => {
    render(<TableView rows={rows} columns={columns} rowId={(r) => r.s} />);
    fireEvent.click(screen.getByTestId("column-sort-kind"));
    fireEvent.click(screen.getByTestId("column-sort-count"), {
      shiftKey: true,
    });
    expect(visibleRowIds()).toEqual(["urn:4", "urn:2", "urn:1", "urn:3"]);
  });
});
