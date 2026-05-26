/**
 * FacetFilter tests (M1.E3.T4):
 * Graph with 3 types; hide one; verify count drops.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { FacetFilter } from "./FacetFilter";

function createTestUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["Person"] });
  ugm.addNode("b", { types: ["Person"] });
  ugm.addNode("c", { types: ["Organization"] });
  ugm.addNode("d", { types: ["Location"] });
  ugm.addNode("e", { types: ["Person"] });
  return ugm;
}

describe("FacetFilter (M1.E3.T4)", () => {
  it("lists all node types with counts", () => {
    const ugm = createTestUGM();
    render(<FacetFilter ugm={ugm} onFilterChange={vi.fn()} />);

    expect(screen.getByTestId("facet-Person")).toHaveTextContent("Person (3)");
    expect(screen.getByTestId("facet-Organization")).toHaveTextContent(
      "Organization (1)",
    );
    expect(screen.getByTestId("facet-Location")).toHaveTextContent(
      "Location (1)",
    );
  });

  it("calls onFilterChange with hidden types when toggled", () => {
    const ugm = createTestUGM();
    const onFilterChange = vi.fn();

    render(<FacetFilter ugm={ugm} onFilterChange={onFilterChange} />);

    // Uncheck "Location"
    const checkbox = screen
      .getByTestId("facet-Location")
      .querySelector('input[type="checkbox"]');
    fireEvent.click(checkbox!);

    expect(onFilterChange).toHaveBeenCalledWith(new Set(["Location"]));
  });

  it("toggles type back on when clicked again", () => {
    const ugm = createTestUGM();
    const onFilterChange = vi.fn();

    render(<FacetFilter ugm={ugm} onFilterChange={onFilterChange} />);

    const checkbox = screen
      .getByTestId("facet-Location")
      .querySelector('input[type="checkbox"]');
    // Hide
    fireEvent.click(checkbox!);
    expect(onFilterChange).toHaveBeenLastCalledWith(new Set(["Location"]));

    // Show again
    fireEvent.click(checkbox!);
    expect(onFilterChange).toHaveBeenLastCalledWith(new Set());
  });

  it("supports hiding multiple types simultaneously", () => {
    const ugm = createTestUGM();
    const onFilterChange = vi.fn();

    render(<FacetFilter ugm={ugm} onFilterChange={onFilterChange} />);

    const locationCb = screen
      .getByTestId("facet-Location")
      .querySelector('input[type="checkbox"]');
    const orgCb = screen
      .getByTestId("facet-Organization")
      .querySelector('input[type="checkbox"]');

    fireEvent.click(locationCb!);
    fireEvent.click(orgCb!);

    expect(onFilterChange).toHaveBeenLastCalledWith(
      new Set(["Location", "Organization"]),
    );
  });
});

// ── Audit edge cases ────────────────────────────────────────────────

describe("FacetFilter: edge cases (audit)", () => {
  it("renders empty state for UGM with no types", () => {
    const ugm = new UGM();
    render(<FacetFilter ugm={ugm} onFilterChange={vi.fn()} />);

    const filter = screen.getByTestId("facet-filter");
    expect(filter).toBeInTheDocument();
    // No checkboxes should exist
    expect(filter.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });
});
