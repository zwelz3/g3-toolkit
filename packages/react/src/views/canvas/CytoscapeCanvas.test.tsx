/**
 * CytoscapeCanvas React component test (M0.E3.T1).
 *
 * Cytoscape requires a real Canvas 2D context which jsdom doesn't
 * provide (canvas npm package needs native deps). We mock cytoscape
 * to verify the React wrapper logic; full visual tests go in
 * Playwright (tests/e2e/).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UGM } from "@g3t/core";

// Mock cytoscape before importing the component
const mockCy = {
  on: vi.fn(),
  destroy: vi.fn(),
  nodes: vi.fn(() => ({ length: 2 })),
  edges: vi.fn(() => ({ length: 1 })),
};

vi.mock("cytoscape", () => ({
  default: vi.fn(() => mockCy),
  __esModule: true,
}));

vi.mock("cytoscape-fcose", () => ({
  default: vi.fn(),
  __esModule: true,
}));

// Import component AFTER mocks are set up
const { CytoscapeCanvas } = await import("./CytoscapeCanvas");

describe("CytoscapeCanvas component (M0.E3.T1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the container div with data-testid", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });

    render(<CytoscapeCanvas ugm={ugm} />);

    const container = screen.getByTestId("cytoscape-canvas");
    expect(container).toBeInTheDocument();
    expect(container.style.width).toBe("100%");
    expect(container.style.height).toBe("100%");
  });

  it("calls onReady with the Cytoscape instance", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["Person"], properties: { name: "Alice" } });
    ugm.addNode("b", { types: ["Person"], properties: { name: "Bob" } });
    ugm.addEdge("a", "b", { type: "knows" });

    const onReady = vi.fn();
    render(<CytoscapeCanvas ugm={ugm} onReady={onReady} />);

    expect(onReady).toHaveBeenCalledOnce();
    expect(onReady).toHaveBeenCalledWith(mockCy);
  });

  it("cleans up Cytoscape on unmount", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });

    const { unmount } = render(<CytoscapeCanvas ugm={ugm} />);
    unmount();

    expect(mockCy.destroy).toHaveBeenCalled();
  });

  // Bugfix 8 regression test: prevent the OS-level browser context menu
  // from showing alongside our custom one.
  it("suppresses the native contextmenu on the canvas container", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    render(<CytoscapeCanvas ugm={ugm} />);

    const container = screen.getByTestId("cytoscape-canvas");
    const evt = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    container.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
  });

  // Bugfix 8 regression test: the contextmenu listener must be removed
  // when the component unmounts, so it doesn't outlive the container.
  it("removes the contextmenu listener on unmount", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["X"] });
    const { unmount, container } = render(<CytoscapeCanvas ugm={ugm} />);

    // Find the canvas container BEFORE unmount; after unmount it's gone
    const canvasContainer = container.querySelector(
      '[data-testid="cytoscape-canvas"]',
    ) as HTMLElement;
    expect(canvasContainer).toBeTruthy();

    // Spy on removeEventListener so we can detect the cleanup
    const removeSpy = vi.spyOn(canvasContainer, "removeEventListener");
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("contextmenu", expect.any(Function));
  });
});
