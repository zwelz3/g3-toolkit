/**
 * SearchBar tests (upgraded with Fuse.js).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";
import { SearchBar } from "./SearchBar";

beforeEach(() => {
  useSelectionStore.setState({
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    hoveredNodeId: null,
  });
});

function makeUGM(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", {
    types: ["Person"],
    properties: { name: "Alice Johnson" },
  });
  ugm.addNode("p2", { types: ["Person"], properties: { name: "Bob Smith" } });
  ugm.addNode("o1", {
    types: ["Organization"],
    properties: { name: "Acme Corp" },
  });
  return ugm;
}

describe("SearchBar (Fuse.js)", () => {
  it("renders search input", () => {
    render(<SearchBar ugm={makeUGM()} onSearchChange={vi.fn()} />);
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
  });

  it("fuzzy matches node names", async () => {
    const onSearch = vi.fn();
    render(<SearchBar ugm={makeUGM()} onSearchChange={onSearch} />);

    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "alice" },
    });

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalled();
      const lastCall = onSearch.mock.calls[onSearch.mock.calls.length - 1]?.[0];
      expect(lastCall.matchingIds).toContain("p1");
    });
  });

  it("shows dropdown results", async () => {
    render(<SearchBar ugm={makeUGM()} onSearchChange={vi.fn()} />);

    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "alice" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("search-dropdown")).toBeInTheDocument();
    });
  });

  it("reports non-matching IDs for dimming", async () => {
    const onSearch = vi.fn();
    render(<SearchBar ugm={makeUGM()} onSearchChange={onSearch} />);

    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "bob" },
    });

    await waitFor(() => {
      const lastCall = onSearch.mock.calls[onSearch.mock.calls.length - 1]?.[0];
      expect(lastCall.matchingIds).toContain("p2");
      expect(lastCall.nonMatchingIds.length).toBeGreaterThan(0);
    });
  });

  it("clears results on empty query", async () => {
    const onSearch = vi.fn();
    render(<SearchBar ugm={makeUGM()} onSearchChange={onSearch} />);

    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "" },
    });

    await waitFor(() => {
      const lastCall = onSearch.mock.calls[onSearch.mock.calls.length - 1]?.[0];
      expect(lastCall.matchingIds).toHaveLength(0);
    });
  });

  it("selects node on Enter key", async () => {
    render(<SearchBar ugm={makeUGM()} onSearchChange={vi.fn()} />);

    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "acme" } });

    await waitFor(() => {
      expect(screen.getByTestId("search-dropdown")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "Enter" });
    expect(useSelectionStore.getState().selectedNodeIds.has("o1")).toBe(true);
  });
});
