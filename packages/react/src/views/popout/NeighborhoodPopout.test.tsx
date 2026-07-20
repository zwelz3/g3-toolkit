/**
 * NeighborhoodPopout (review 4.10) and core khopNeighborhood: the
 * popout renders the k-hop cut hierarchically with a bounded hop
 * stepper; the core helper's BFS semantics and truncation flag are
 * pinned directly.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UGM, khopNeighborhood } from "@g3t/core";

const captured = vi.hoisted(() => ({
  mounts: [] as Array<{ nodes: number; layout: string | undefined }>,
}));

vi.mock("../canvas/CytoscapeCanvas", () => ({
  CytoscapeCanvas: (props: { ugm: UGM; layout?: string }) => {
    captured.mounts.push({
      nodes: props.ugm.getNodeIds().length,
      layout: props.layout,
    });
    return <div data-testid="canvas-stub" />;
  },
}));

import { NeighborhoodPopout } from "./NeighborhoodPopout";

afterEach(() => {
  cleanup();
  captured.mounts.length = 0;
});

/** a - b - c - d chain plus an offshoot b - x. */
function chain(): UGM {
  const g = new UGM();
  for (const id of ["a", "b", "c", "d", "x"]) {
    g.addNode(id, { types: ["T"], properties: { name: id } });
  }
  g.addEdge("a", "b", { type: "r" });
  g.addEdge("b", "c", { type: "r" });
  g.addEdge("c", "d", { type: "r" });
  g.addEdge("b", "x", { type: "r" });
  return g;
}

describe("khopNeighborhood", () => {
  it("collects BFS rings and cuts the subgraph", () => {
    const g = chain();
    const one = khopNeighborhood(g, "b", 1);
    expect(new Set(one.ugm.getNodeIds())).toEqual(
      new Set(["b", "a", "c", "x"]),
    );
    const two = khopNeighborhood(g, "a", 2);
    expect(new Set(two.ugm.getNodeIds())).toEqual(
      new Set(["a", "b", "c", "x"]),
    );
    expect(two.truncated).toBe(false);
  });

  it("missing focus yields an empty, non-throwing result", () => {
    const r = khopNeighborhood(chain(), "ghost", 2);
    expect(r.ugm.getNodeIds().length).toBe(0);
  });

  it("honors the working-set cap with the truncation flag", () => {
    const g = new UGM();
    g.addNode("hub", { types: ["T"] });
    for (let i = 0; i < 10; i++) {
      g.addNode(`n${i}`, { types: ["T"] });
      g.addEdge("hub", `n${i}`, { type: "r" });
    }
    const r = khopNeighborhood(g, "hub", 1, { limit: 5 });
    expect(r.truncated).toBe(true);
    expect(r.ugm.getNodeIds().length).toBeLessThanOrEqual(5);
  });
});

describe("NeighborhoodPopout", () => {
  it("renders the 1-hop cut hierarchically by default; stepper widens within bounds", () => {
    render(
      <NeighborhoodPopout
        ugm={chain()}
        focusId="a"
        maxHops={3}
        onClose={() => undefined}
      />,
    );
    expect(screen.getByTestId("popout-hops").textContent).toBe("1-hop");
    expect(captured.mounts.at(-1)).toEqual({
      nodes: 2, // a + b
      layout: "breadthfirst",
    });
    // Down is disabled at the 1-hop floor.
    expect(
      (screen.getByTestId("popout-hops-down") as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByTestId("popout-hops-up"));
    expect(screen.getByTestId("popout-hops").textContent).toBe("2-hop");
    expect(captured.mounts.at(-1)?.nodes).toBe(4); // a,b,c,x

    fireEvent.click(screen.getByTestId("popout-hops-up"));
    expect(
      (screen.getByTestId("popout-hops-up") as HTMLButtonElement).disabled,
    ).toBe(true); // maxHops reached
  });

  it("close invokes the handler", () => {
    const onClose = vi.fn();
    render(<NeighborhoodPopout ugm={chain()} focusId="a" onClose={onClose} />);
    fireEvent.click(screen.getByTestId("popout-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
