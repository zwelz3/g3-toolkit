import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { AlgorithmPanel } from "./AlgorithmPanel";
import { useOverlayStore } from "../../state/overlay-store";

beforeEach(() => useOverlayStore.getState().clear());

function graph(): UGM {
  const ugm = new UGM();
  for (const id of ["a", "b", "c"]) {
    ugm.addNode(id, { types: ["T"], properties: {} });
  }
  ugm.addEdge("a", "b", { type: "rel", properties: {} });
  ugm.addEdge("b", "c", { type: "rel", properties: {} });
  return ugm;
}

describe("AlgorithmPanel", () => {
  it("components runner ingests _component and reports", () => {
    const ugm = graph();
    const onIngested = vi.fn();
    render(<AlgorithmPanel ugm={ugm} onIngested={onIngested} />);
    fireEvent.click(screen.getByTestId("algo-components"));
    expect(ugm.getNode("a")?.properties._component).toBe(0);
    expect(onIngested).toHaveBeenCalledWith(
      expect.stringContaining("1 found"),
      ["_component"],
    );
  });

  it("shortest path registers an active overlay", () => {
    render(<AlgorithmPanel ugm={graph()} />);
    fireEvent.change(screen.getByLabelText("Path source"), {
      target: { value: "a" },
    });
    fireEvent.change(screen.getByLabelText("Path target"), {
      target: { value: "c" },
    });
    fireEvent.click(screen.getByTestId("algo-path"));
    const s = useOverlayStore.getState();
    expect(s.overlays).toHaveLength(1);
    expect(s.activeIds).toEqual(["path-a-c"]);
    expect(s.overlays[0]?.nodeIds).toEqual(["a", "b", "c"]);
  });

  it("ingests an external overlay document; surfaces parse errors verbatim", () => {
    const ugm = graph();
    render(<AlgorithmPanel ugm={ugm} />);
    fireEvent.change(screen.getByLabelText("Algorithm result JSON"), {
      target: {
        value: JSON.stringify({
          version: 1,
          kind: "overlay",
          algorithm: "networkx.minimum_spanning_tree",
          overlay: { id: "mst", label: "MST", nodeIds: ["a", "b"] },
        }),
      },
    });
    fireEvent.click(screen.getByTestId("algo-ingest"));
    expect(useOverlayStore.getState().overlays[0]?.id).toBe("mst");
    expect(screen.getByTestId("algo-status").textContent).toContain("MST");

    fireEvent.change(screen.getByLabelText("Algorithm result JSON"), {
      target: { value: '{"version": 7}' },
    });
    fireEvent.click(screen.getByTestId("algo-ingest"));
    expect(screen.getByTestId("algo-error").textContent).toContain("version 7");
  });
});
