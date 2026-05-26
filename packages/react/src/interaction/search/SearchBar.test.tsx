/**
 * SearchBar tests (upgraded with Fuse.js).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
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

  // Bugfix 10 regression: clear button must be present when there's
  // a query and must reset the input + close the dropdown when clicked.
  it("renders a clear button when there's a query and resets state on click", async () => {
    const onSearch = vi.fn();
    render(<SearchBar ugm={makeUGM()} onSearchChange={onSearch} />);

    // Initially no clear button (empty query)
    expect(screen.queryByTestId("search-clear")).not.toBeInTheDocument();

    const input = screen.getByTestId("search-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "alice" } });

    // Clear button appears once the user has typed
    await waitFor(() => {
      expect(screen.getByTestId("search-clear")).toBeInTheDocument();
    });

    // Click it
    fireEvent.click(screen.getByTestId("search-clear"));

    // Input cleared, button gone, last onSearch call has empty matchingIds
    expect(input.value).toBe("");
    expect(screen.queryByTestId("search-clear")).not.toBeInTheDocument();
    await waitFor(() => {
      const lastCall = onSearch.mock.calls[onSearch.mock.calls.length - 1]?.[0];
      expect(lastCall.query).toBe("");
      expect(lastCall.matchingIds).toHaveLength(0);
    });
  });

  // Bugfix 11 regression test: passing an inline-lambda onSearchChange
  // (i.e. fresh identity every render) must NOT cause an infinite
  // render loop. Before the ref-stash fix, this scenario hit
  // 'Maximum update depth exceeded' in AnalyticsDemo because the
  // useEffect dep array contained onSearchChange.
  it("doesn't loop infinitely when onSearchChange identity changes per render", () => {
    let outerRenderCount = 0;
    function Wrapper() {
      outerRenderCount++;
      // Bail out after a generous threshold so a real loop fails the
      // test rather than crashing vitest.
      if (outerRenderCount > 50) throw new Error("render loop detected");
      const [tick, setTick] = useState(0);
      return (
        <>
          <button data-testid="tick" onClick={() => setTick((t) => t + 1)}>
            tick {tick}
          </button>
          <SearchBar
            ugm={makeUGM()}
            // Fresh identity every render - the bad case.
            onSearchChange={(_r) => {}}
          />
        </>
      );
    }

    const { getByTestId } = render(<Wrapper />);
    // Force several parent re-renders.
    for (let i = 0; i < 5; i++) {
      fireEvent.click(getByTestId("tick"));
    }
    // If we got here without throwing, we're not looping.
    expect(outerRenderCount).toBeLessThanOrEqual(50);
  });
});
