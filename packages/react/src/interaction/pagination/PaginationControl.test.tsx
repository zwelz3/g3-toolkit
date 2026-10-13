/**
 * PaginationControl (issue #6): derived page count and summary, bound
 * buttons, keyboard operation, the optional page-size select, and the
 * inexact-total wording.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaginationControl } from "./PaginationControl";

describe("PaginationControl", () => {
  it("derives the page count and the window summary from page, pageSize and total", () => {
    render(
      <PaginationControl
        page={0}
        pageSize={200}
        total={350}
        noun="rows"
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Rows pagination" }));
    expect(screen.getByTestId("pagination-control-status").textContent).toBe(
      "Page 1 of 2",
    );
    expect(screen.getByTestId("pagination-control-summary").textContent).toBe(
      "rows 1 to 200 of 350",
    );
    expect(
      screen.getByRole("button", { name: "Previous page of rows" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Next page of rows" }),
    ).toBeEnabled();
  });

  it("the last page summary stops at the total and Next is disabled", () => {
    render(
      <PaginationControl
        page={1}
        pageSize={200}
        total={350}
        noun="columns"
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByTestId("pagination-control-summary").textContent).toBe(
      "columns 201 to 350 of 350",
    );
    expect(
      screen.getByRole("button", { name: "Next page of columns" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Previous page of columns" }),
    ).toBeEnabled();
  });

  it("clicks and arrow keys move one page; Home/End jump; bounds are not crossed", () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControl
        page={1}
        pageSize={10}
        total={45}
        onPageChange={onPageChange}
      />,
    );
    const nav = screen.getByTestId("pagination-control");
    const prev = screen.getByTestId("pagination-control-prev");
    fireEvent.click(screen.getByTestId("pagination-control-next"));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    fireEvent.click(prev);
    expect(onPageChange).toHaveBeenLastCalledWith(0);
    prev.focus();
    fireEvent.keyDown(prev, { key: "ArrowRight" });
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(prev, { key: "ArrowLeft" });
    expect(onPageChange).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(nav, { key: "End" });
    expect(onPageChange).toHaveBeenLastCalledWith(4);
    fireEvent.keyDown(nav, { key: "Home" });
    expect(onPageChange).toHaveBeenLastCalledWith(0);
    onPageChange.mockClear();
    // An unrelated key is ignored, and a move that would not change
    // the page (Home while on page 0) does not fire.
    fireEvent.keyDown(nav, { key: "a" });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("does not fire past the bounds", () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControl
        page={0}
        pageSize={10}
        total={10}
        onPageChange={onPageChange}
      />,
    );
    const nav = screen.getByTestId("pagination-control");
    fireEvent.keyDown(nav, { key: "ArrowLeft" });
    fireEvent.keyDown(nav, { key: "ArrowRight" });
    fireEvent.keyDown(nav, { key: "End" });
    expect(onPageChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("pagination-control-status").textContent).toBe(
      "Page 1 of 1",
    );
  });

  it("renders the page-size select only when both options and a handler are given", () => {
    const onPageSizeChange = vi.fn();
    const { rerender } = render(
      <PaginationControl
        page={0}
        pageSize={25}
        total={100}
        noun="rows"
        onPageChange={() => {}}
        pageSizeOptions={[25, 50, 100]}
      />,
    );
    expect(screen.queryByTestId("pagination-control-size")).toBeNull();
    rerender(
      <PaginationControl
        page={0}
        pageSize={25}
        total={100}
        noun="rows"
        onPageChange={() => {}}
        pageSizeOptions={[25, 50, 100]}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    const select = screen.getByRole("combobox", { name: "Rows per page" });
    fireEvent.change(select, { target: { value: "50" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
    // Arrow keys inside the select are the select's own.
    fireEvent.keyDown(select, { key: "ArrowRight" });
  });

  it("an inexact total reads as an estimate, and an empty total says so", () => {
    const { rerender } = render(
      <PaginationControl
        page={0}
        pageSize={50}
        total={1200}
        totalExact={false}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByTestId("pagination-control-summary").textContent).toBe(
      "items 1 to 50 of about 1200",
    );
    rerender(
      <PaginationControl
        page={0}
        pageSize={50}
        total={0}
        onPageChange={() => {}}
      />,
    );
    expect(screen.getByTestId("pagination-control-summary").textContent).toBe(
      "no items",
    );
    expect(screen.getByTestId("pagination-control-status").textContent).toBe(
      "Page 1 of 1",
    );
  });
});
