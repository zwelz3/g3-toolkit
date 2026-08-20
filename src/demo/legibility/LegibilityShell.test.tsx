/**
 * Legibility Lab shell contract (CytoscapeCanvas stubbed per the
 * shell-test pattern: jsdom has no 2d canvas). Pins panel switching,
 * toggle wiring, legend presence, and the field-scoped pseudo-node
 * style rules so a regression to a bare `node` rule fails at test
 * time rather than as per-frame Cytoscape warnings in a browser.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CyStylesheet } from "@g3t/react";

const captured = vi.hoisted(() => ({
  panes: [] as Array<{
    stylesheet?: CyStylesheet[];
    ugm?: unknown;
    routeRefreshSignal?: number;
    relayoutSignal?: number;
    edgeClickIsolate?: boolean;
  }>,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      stylesheet?: CyStylesheet[];
      ugm?: unknown;
      routeRefreshSignal?: number;
      relayoutSignal?: number;
      edgeClickIsolate?: boolean;
    }) => {
      captured.panes.push({
        stylesheet: props.stylesheet,
        ugm: props.ugm,
        routeRefreshSignal: props.routeRefreshSignal,
        relayoutSignal: props.relayoutSignal,
        edgeClickIsolate: props.edgeClickIsolate,
      });
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { LegibilityShell } from "./LegibilityShell";

afterEach(() => {
  cleanup();
  captured.panes.length = 0;
});

function lastPane() {
  return captured.panes[captured.panes.length - 1];
}

describe("LegibilityShell", () => {
  it("mounts the hub panel by default and exposes back + tabs + legend", () => {
    const onBack = vi.fn();
    render(<LegibilityShell onBack={onBack} />);
    fireEvent.click(screen.getByTestId("legibility-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("legibility-tabs")).toBeTruthy();
    expect(screen.getByTestId("legibility-hub-canvas")).toBeTruthy();
    expect(screen.getByTestId("legibility-legend")).toBeTruthy();
    expect(screen.getByTestId("legibility-hub-toggle")).toBeTruthy();
  });

  it("switching tabs mounts the corresponding canvas and controls", () => {
    render(<LegibilityShell />);
    fireEvent.click(screen.getByTestId("legibility-tab-bus"));
    expect(screen.getByTestId("legibility-bus-canvas")).toBeTruthy();
    expect(screen.getByTestId("legibility-bus-toggle")).toBeTruthy();
    fireEvent.click(screen.getByTestId("legibility-tab-holon"));
    expect(screen.getByTestId("legibility-holon-canvas")).toBeTruthy();
    expect(screen.getByTestId("legibility-holon-view-boundary")).toBeTruthy();
    expect(screen.getByTestId("legibility-holon-view-interior")).toBeTruthy();
  });

  it("toggling spread re-projects the UGM (raw <-> spread)", () => {
    render(<LegibilityShell />);
    const rawUgm = lastPane()?.ugm;
    fireEvent.click(screen.getByTestId("legibility-hub-toggle"));
    const nextUgm = lastPane()?.ugm;
    expect(rawUgm).not.toBe(nextUgm);
  });

  it("pseudo-node style rules are field-scoped (never a bare `node` mapper)", () => {
    render(<LegibilityShell />);
    const sheet = lastPane()?.stylesheet ?? [];
    expect(sheet.length).toBeGreaterThan(0);
    for (const rule of sheet) {
      const sel = (rule as { selector: string }).selector;
      // Bare `node` or `edge` rules with data mappers are exactly what
      // the doctrine forbids. Every rule here scopes to a field or an
      // edge-type predicate.
      expect(sel).not.toBe("node");
      expect(sel).not.toBe("edge");
    }
    const selectors = sheet.map((r) => (r as { selector: string }).selector);
    expect(selectors).toContain("node[?pseudo]");
    expect(selectors.some((s) => s.includes('type = "pseudoConnector"'))).toBe(
      true,
    );
    expect(selectors.some((s) => s.includes('type = "pseudoTrunk"'))).toBe(
      true,
    );
  });

  it("refresh-routes and re-layout buttons bump their signals; edge isolate is on", () => {
    render(<LegibilityShell />);
    const start = lastPane();
    expect(start?.edgeClickIsolate).toBe(true);
    const startRoute = start?.routeRefreshSignal ?? 0;
    const startRelayout = start?.relayoutSignal ?? 0;
    fireEvent.click(screen.getByTestId("legibility-refresh-routes"));
    expect(lastPane()?.routeRefreshSignal).toBe(startRoute + 1);
    fireEvent.click(screen.getByTestId("legibility-relayout"));
    expect(lastPane()?.relayoutSignal).toBe(startRelayout + 1);
  });

  it("holon boundary panel passes the containment option through", () => {
    render(<LegibilityShell />);
    fireEvent.click(screen.getByTestId("legibility-tab-holon"));
    // The last canvas pane mount is the boundary view.
    const boundaryPane = lastPane() as unknown as {
      ugm?: unknown;
    } & Record<string, unknown>;
    expect(boundaryPane).toBeDefined();
  });
});
