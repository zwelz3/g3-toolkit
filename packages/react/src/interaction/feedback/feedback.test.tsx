/** Skeleton tests (B2 completion). */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("renders the requested number of text lines, hidden from AT", () => {
    render(<Skeleton lines={4} />);
    const root = screen.getByTestId("g3t-skeleton");
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelectorAll(".g3t-skeleton").length).toBe(4);
  });

  it("block variant takes height and width", () => {
    render(<Skeleton variant="block" height={120} width={200} />);
    const el = screen.getByTestId("g3t-skeleton");
    expect(el.className).toContain("g3t-skeleton");
    expect(el.style.height).toBe("120px");
    expect(el.style.width).toBe("200px");
  });
});
