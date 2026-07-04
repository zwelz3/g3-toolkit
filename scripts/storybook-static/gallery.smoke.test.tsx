import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Gallery } from "./gallery";

// Smoke for the static gallery: it globs every story and lists it by
// category, shows the adopter overview, injects the --g3t-* design
// tokens (the core of the rendering fix), and renders a real non-canvas
// story end-to-end through the themed wrapper without the error
// boundary. Canvas/chart stories need a real browser and are not
// exercised here.
describe("static story gallery", () => {
  it("mounts, shows the overview, and lists stories by category", () => {
    const { container } = render(<Gallery />);
    expect(screen.getByText("g3-toolkit component gallery")).toBeTruthy();
    expect(screen.getByText(/g3-toolkit stories/)).toBeTruthy();
    for (const cat of ["Patterns", "Views", "Molecules", "Atoms", "Reference"]) {
      expect(screen.getAllByText(cat).length).toBeGreaterThan(0);
    }
    expect(container.querySelectorAll(".g3tg-item").length).toBeGreaterThan(15);
  });

  it("injects the g3t design tokens onto the document root", () => {
    render(<Gallery />);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--g3t-font")).not.toBe("");
    expect(root.dataset["theme"]).toBe("light");
  });

  it("renders a non-canvas story through the themed wrapper", () => {
    const { container } = render(<Gallery />);
    const btn = [...container.querySelectorAll("button.g3tg-item")].find((b) =>
      /SearchBar/.test(b.textContent ?? ""),
    ) as HTMLButtonElement | undefined;
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    expect(screen.queryByText(/This story threw while rendering/)).toBeNull();
    const host = container.querySelector(".g3tg-storyhost");
    expect((host?.textContent ?? "").length).toBeGreaterThan(0);
  });
});
