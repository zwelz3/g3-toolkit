/**
 * ExplorerShell wiring: the lens, profile and row-detail controls drive
 * the entity view, the map seeds the toolkit selection store with the
 * class in view, and the back button leaves the scenario. Rendered
 * geometry is asserted in derive.test.ts; parity with the prototype is
 * a browser check (see the round log).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useSelectionStore, useThemeStore } from "@g3-toolkit/react";
import { ExplorerShell } from "./ExplorerShell";

afterEach(() => {
  cleanup();
  useSelectionStore.getState().clearSelection();
});

describe("ExplorerShell", () => {
  it("opens on Transponder as a SysML block for the systems-engineer profile", () => {
    render(<ExplorerShell onBack={() => {}} />);
    const svg = screen.getByTestId("mx-entity-svg");
    expect(svg.textContent).toContain("«block»");
    expect(svg.textContent).toContain(
      "instantaneousBandwidth : Real [1] {> 0, unit = MHz}",
    );
    // Internal and inherited rows are hidden by the profile, and say so.
    expect(screen.getByTestId("mx-hidden-rows").textContent).toContain(
      "3 rows hidden",
    );
  });

  it("switches to ontology notation with IRIs for the knowledge-engineer profile", () => {
    render(<ExplorerShell onBack={() => {}} />);
    fireEvent.change(screen.getByTestId("mx-profile-select"), {
      target: { value: "ke" },
    });
    const svg = screen.getByTestId("mx-entity-svg");
    expect(svg.textContent).toContain("ex:Transponder");
    expect(svg.textContent).toContain("UNCLASSIFIED (NO CONCEPT)");
    expect(screen.queryByTestId("mx-modified")).toBeNull();
  });

  it("flags a lens change as a modification of the profile, and resets it", () => {
    render(<ExplorerShell onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("mx-lens-combined"));
    expect(screen.getByLabelText("Legend")).toBeDefined();
    expect(screen.getByTestId("mx-modified")).toBeDefined();
    fireEvent.click(screen.getByText("Reset"));
    expect(screen.queryByTestId("mx-modified")).toBeNull();
  });

  it("shows where each layer's value comes from when a row is clicked", () => {
    render(<ExplorerShell onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("mx-row-band"));
    const detail = screen.getByTestId("mx-detail");
    expect(detail.textContent).toContain("Layers disagree");
    expect(detail.textContent).toContain("conversions, engineer");
    expect(detail.textContent).toContain(
      "The Rust enum Band has C and Ku only.",
    );
  });

  it("re-centers on a related class and walks back", () => {
    render(<ExplorerShell onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("mx-stub-Channel"));
    expect(screen.getByTestId("mx-entity-svg").textContent).toContain(
      "centerFrequency",
    );
    fireEvent.click(screen.getByText("← Transponder"));
    expect(screen.getByTestId("mx-entity-svg").textContent).toContain(
      "instantaneousBandwidth",
    );
  });

  it("opens the map with the class in view selected in the toolkit store", () => {
    render(<ExplorerShell onBack={() => {}} />);
    fireEvent.click(screen.getByTestId("mx-view-map"));
    expect(screen.getByTestId("mx-map")).toBeDefined();
    expect(Array.from(useSelectionStore.getState().selectedNodeIds)).toEqual([
      "Transponder",
    ]);
    expect(screen.getByTestId("mx-selcard").textContent).toContain(
      "Transponder",
    );
  });

  it("names each lens with its layer letter", () => {
    render(<ExplorerShell onBack={() => {}} />);
    expect(screen.getByTestId("mx-lens-contract").textContent).toBe(
      "SShape / Contract",
    );
    fireEvent.click(screen.getByTestId("mx-customize"));
    const opt = document.querySelector('label[for="mx-o-lens-contract"]');
    expect(opt?.textContent).toContain("Shape / Contract (S)");
  });

  it("switches light and dark through the toolkit theme store", () => {
    useThemeStore.getState().setTheme("light");
    render(<ExplorerShell onBack={() => {}} />);
    expect(screen.getByTestId("mx-shell").className).not.toContain("mx-dark");
    fireEvent.click(screen.getByTestId("mx-theme-dark"));
    expect(useThemeStore.getState().theme.id).toBe("dark");
    expect(screen.getByTestId("mx-shell").className).toContain("mx-dark");
    useThemeStore.getState().setTheme("light");
  });

  it("leaves the scenario through the back button", () => {
    const onBack = vi.fn();
    render(<ExplorerShell onBack={onBack} />);
    fireEvent.click(screen.getByText("← Scenarios"));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
