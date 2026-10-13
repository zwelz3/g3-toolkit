/**
 * WorkingSetProvider / useWorkingSetManager (issue #5).
 *
 * The defect was an exported manager nothing instantiated: a
 * deployment override reached no view. These tests pin the wiring
 * from a config document, through the provider, into the two views
 * that enforce a limit today (TreeView, MatrixView), plus the
 * prop-over-context-over-default precedence and the refusal message.
 */

import { describe, it, expect } from "vitest";
import { render, screen, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { UGM, WorkingSetManager } from "@g3-toolkit/core";
import {
  WorkingSetProvider,
  useWorkingSetManager,
  getDefaultWorkingSetManager,
  workingSetLimitMessage,
} from "./working-set-context";
import { TreeView } from "../views/tree/TreeView";
import { MatrixView } from "../views/matrix/MatrixView";

/** A root with `fanout` children each having `fanout` children (1 + f + f^2 nodes). */
function treeGraph(fanout: number): UGM {
  const ugm = new UGM();
  ugm.addNode("root", { types: ["Dir"], properties: { name: "root" } });
  for (let i = 0; i < fanout; i++) {
    ugm.addNode(`a${i}`, { types: ["Dir"], properties: { name: `a${i}` } });
    ugm.addEdge("root", `a${i}`, { type: "contains" });
    for (let j = 0; j < fanout; j++) {
      ugm.addNode(`a${i}b${j}`, {
        types: ["File"],
        properties: { name: `a${i}b${j}` },
      });
      ugm.addEdge(`a${i}`, `a${i}b${j}`, { type: "contains" });
    }
  }
  return ugm;
}

/** `n` node types in a ring, so every type appears in the matrix. */
function typedRing(n: number): UGM {
  const ugm = new UGM();
  for (let i = 0; i < n; i++) {
    ugm.addNode(`n${i}`, { types: [`T${i}`], properties: {} });
  }
  for (let i = 0; i < n; i++) {
    ugm.addEdge(`n${i}`, `n${(i + 1) % n}`, { type: "next" });
  }
  return ugm;
}

const treeRows = () =>
  screen
    .getByTestId("tree-view")
    .querySelectorAll("[data-testid^='tree-node-']");

describe("useWorkingSetManager precedence", () => {
  it("falls back to one module default instance when no provider is mounted", () => {
    const { result } = renderHook(() => useWorkingSetManager());
    expect(result.current).toBe(getDefaultWorkingSetManager());
    expect(result.current.getLimit("canvas")).toBe(500);
  });

  it("returns the provider's manager, and an explicit prop wins over it", () => {
    const fromProvider = new WorkingSetManager({ canvas: 300 });
    const explicit = new WorkingSetManager({ canvas: 50 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkingSetProvider manager={fromProvider}>{children}</WorkingSetProvider>
    );
    const viaContext = renderHook(() => useWorkingSetManager(), { wrapper });
    expect(viaContext.result.current).toBe(fromProvider);
    const viaProp = renderHook(() => useWorkingSetManager(explicit), {
      wrapper,
    });
    expect(viaProp.result.current).toBe(explicit);
  });

  it("builds the manager from a config document and keeps it across re-renders", () => {
    const config = {
      version: 1 as const,
      limits: { canvas: { default: 300, ceiling: 800 } },
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WorkingSetProvider config={config}>{children}</WorkingSetProvider>
    );
    const { result, rerender } = renderHook(() => useWorkingSetManager(), {
      wrapper,
    });
    const first = result.current;
    expect(first.getLimit("canvas")).toBe(300);
    expect(first.setUserOverride("canvas", 600).ok).toBe(true);
    rerender();
    expect(result.current).toBe(first);
    expect(result.current.getLimit("canvas")).toBe(600);
  });
});

describe("views read their limit through the provider", () => {
  it("TreeView: a deployment tree limit cuts the forest; the prop still wins", () => {
    const ugm = treeGraph(6); // 43 nodes
    const { unmount } = render(
      <TreeView ugm={ugm} rootId="root" initialDepth={5} />,
    );
    expect(treeRows().length).toBe(43);
    unmount();

    const configured = render(
      <WorkingSetProvider
        config={{ version: 1, limits: { tree: { default: 10 } } }}
      >
        <TreeView ugm={ugm} rootId="root" initialDepth={5} />
      </WorkingSetProvider>,
    );
    const viaProvider = treeRows().length;
    expect(viaProvider).toBeLessThan(43);
    expect(viaProvider).toBeGreaterThan(0);
    configured.unmount();

    render(
      <WorkingSetProvider
        config={{ version: 1, limits: { tree: { default: 10 } } }}
      >
        <TreeView
          ugm={ugm}
          rootId="root"
          initialDepth={5}
          workingSetManager={new WorkingSetManager({ tree: 1_000 })}
        />
      </WorkingSetProvider>,
    );
    expect(treeRows().length).toBe(43);
  });

  it("MatrixView: a deployment matrix limit becomes the page size (#6 pages rather than truncates)", () => {
    const ugm = typedRing(5);
    render(
      <WorkingSetProvider
        config={{ version: 1, limits: { matrix: { default: 3 } } }}
      >
        <MatrixView ugm={ugm} />
      </WorkingSetProvider>,
    );
    expect(
      screen.getByTestId("matrix-rows-pagination-summary").textContent,
    ).toBe("rows 1 to 3 of 5");
  });

  it("MatrixView: without a provider the built-in 200 applies (no notice for 5 types)", () => {
    render(<MatrixView ugm={typedRing(5)} />);
    expect(screen.queryByText(/working-set limit/)).toBeNull();
  });
});

describe("workingSetLimitMessage (explicit action to exceed, D5)", () => {
  const mgr = WorkingSetManager.fromConfig({
    version: 1,
    limits: { canvas: { default: 300, ceiling: 800 } },
  });

  it("says nothing within the limit", () => {
    expect(workingSetLimitMessage(mgr, "canvas", 300).kind).toBe("within");
  });

  it("offers a prompt when the request is above the default but under the ceiling", () => {
    const m = workingSetLimitMessage(mgr, "canvas", 650);
    expect(m.kind).toBe("prompt");
    expect(m.message).toBe(
      "650 nodes exceeds the canvas limit of 300 and may slow this view. Show all?",
    );
    expect(m.ceiling).toBe(800);
  });

  it("refuses instead of prompting when the request is above the ceiling", () => {
    const m = workingSetLimitMessage(mgr, "canvas", 801);
    expect(m.kind).toBe("refused");
    expect(m.message).toBe(
      "801 nodes exceeds this deployment's canvas ceiling of 800; showing the first 300.",
    );
    // The affordance never bypasses the manager: the same request is refused there too.
    expect(mgr.setUserOverride("canvas", 801).ok).toBe(false);
  });

  it("with no ceiling, any excess is a prompt", () => {
    const m = workingSetLimitMessage(new WorkingSetManager(), "tree", 5_000);
    expect(m.kind).toBe("prompt");
    expect(m.message).toMatch(/5,000 nodes exceeds the tree limit of 1,000/);
  });
});
