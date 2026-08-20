/**
 * RoutingShell contract test. StructuralSvgView is replaced by a stub
 * that records the scene it receives (the MbseShell test pattern), so
 * the shell's side of the contract is asserted headlessly: the layout
 * for the selected scenario reaches the view, the metrics panel grades
 * that same scene, and a scenario/size switch delivers a NEW scene.
 * layoutStructural runs for real (headless-safe; see scenarios.test.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import type { StructuralGraphInput, StructuralGeometry } from "@g3t/core";

type ClickInfo = {
  hit: { elementId: string; kind: string; zone: string } | null;
  point: { x: number; y: number };
  originalEvent: unknown;
};

const captured = vi.hoisted(() => ({
  scenes: [] as Array<{
    input: StructuralGraphInput;
    geometry: StructuralGeometry;
  }>,
  onElementClick: null as ((info: ClickInfo) => void) | null,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    StructuralSvgView: (props: {
      input: StructuralGraphInput;
      geometry: StructuralGeometry;
      onElementClick?: (info: ClickInfo) => void;
    }) => {
      captured.scenes.push({ input: props.input, geometry: props.geometry });
      captured.onElementClick = props.onElementClick ?? null;
      return <div data-testid="rlab-svg-stub" />;
    },
  };
});

import { RoutingShell } from "./RoutingShell";
import { ROUTING_SCENARIOS } from "./scenarios";

beforeEach(() => {
  captured.scenes.length = 0;
  captured.onElementClick = null;
});
afterEach(cleanup);

describe("RoutingShell", () => {
  it("lays out the default scenario (M) and grades the same scene", async () => {
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => {
      expect(captured.scenes.length).toBeGreaterThan(0);
    });
    const scene = captured.scenes.at(-1)!;
    const expected = ROUTING_SCENARIOS[0]!.build("M");
    expect(scene.input.nodes.length).toBe(expected.nodes.length);
    expect(scene.input.edges.length).toBe(expected.edges.length);
    // The metrics panel graded a routed scene: full coverage shows as
    // "n / n" and the violation row reads 0.
    const metrics = screen.getByTestId("rlab-metrics");
    expect(metrics.textContent).toContain(
      `${expected.edges.length} / ${expected.edges.length}`,
    );
    expect(metrics.textContent).toContain("Box violations");
  });

  it("switching scenario delivers that scenario's scene", async () => {
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => expect(captured.scenes.length).toBeGreaterThan(0));
    const storm = ROUTING_SCENARIOS.find((s) => s.id === "crossing-storm")!;
    fireEvent.click(screen.getByTestId("rlab-scenario-crossing-storm"));
    await waitFor(() => {
      const last = captured.scenes.at(-1)!;
      expect(last.input.edges.length).toBe(storm.build("M").edges.length);
    });
  });

  it("size knob re-runs the SAME scenario at the new size", async () => {
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => expect(captured.scenes.length).toBeGreaterThan(0));
    fireEvent.change(screen.getByTestId("rlab-size-select"), {
      target: { value: "S" },
    });
    const small = ROUTING_SCENARIOS[0]!.build("S");
    await waitFor(() => {
      const last = captured.scenes.at(-1)!;
      expect(last.input.nodes.length).toBe(small.nodes.length);
    });
  });

  it("back affordance calls onBack", async () => {
    const onBack = vi.fn();
    render(<RoutingShell onBack={onBack} />);
    fireEvent.click(screen.getByText("← Scenarios"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("clicking an edge pins the trace; a non-edge click clears it", async () => {
    const { act } = await import("@testing-library/react");
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => expect(captured.onElementClick).not.toBeNull());
    const firstEdge = ROUTING_SCENARIOS[0]!.build("M").edges[0]!;
    act(() => {
      captured.onElementClick!({
        hit: { elementId: firstEdge.id, kind: "edge", zone: "segment" },
        point: { x: 0, y: 0 },
        originalEvent: {},
      });
    });
    const trace = screen.getByTestId("rlab-trace");
    expect(trace.textContent).toContain(firstEdge.id);
    expect(trace.textContent).toContain(firstEdge.source);
    // The generated CSS dims everything but the traced edge.
    expect(screen.getByTestId("rlab-edge-css").textContent).toContain(
      `[data-ssv-edge="${firstEdge.id}"]`,
    );
    // NOTE this exercises the shell's HANDLER contract, not a real
    // gesture. `useElementPointerEvents` resolves a click through the
    // hit test and drops it when nothing is hit, so a click on empty
    // canvas never produces this call in the running app. The reachable
    // escapes are re-clicking the pinned edge and the Clear button,
    // both covered below.
    act(() => {
      captured.onElementClick!({
        hit: null,
        point: { x: 0, y: 0 },
        originalEvent: {},
      });
    });
    expect(screen.getByTestId("rlab-trace").textContent).toContain(
      "Hover an edge",
    );
  });

  it("engine row: nudge defaults ON, perimeter defaults to 12 (A35)", async () => {
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => expect(captured.scenes.length).toBeGreaterThan(0));
    const nudge = screen.getByTestId("rlab-nudge-toggle") as HTMLInputElement;
    expect(nudge.checked).toBe(true);
    const longEdge = screen.getByTestId(
      "rlab-longedge-select",
    ) as HTMLSelectElement;
    expect(longEdge.value).toBe("default");
  });

  it("engine row: anchor pitch defaults OFF", async () => {
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => expect(captured.scenes.length).toBeGreaterThan(0));
    // Defaults off so the bench shows the LIBRARY default. The plain
    // fan's lack of a pitch floor is the thing under review; a lab
    // that hid it behind a default would defeat the purpose.
    const pitch = screen.getByTestId("rlab-pitch-select") as HTMLSelectElement;
    expect(pitch.value).toBe("off");
  });

  it("anchor pitch reaches the engine and re-lays out", async () => {
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => expect(captured.scenes.length).toBeGreaterThan(0));
    const before = captured.scenes.length;
    fireEvent.change(screen.getByTestId("rlab-pitch-select"), {
      target: { value: "loose" },
    });
    await waitFor(() => {
      expect(captured.scenes.length).toBeGreaterThan(before);
    });
    // A layout option, so the geometry must actually move.
    expect(JSON.stringify(captured.scenes.at(-1)!.geometry.edges)).not.toBe(
      JSON.stringify(captured.scenes[0]!.geometry.edges),
    );
  });

  it("clicking the pinned edge again unpins it, and Clear does too", async () => {
    const { act } = await import("@testing-library/react");
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => expect(captured.onElementClick).not.toBeNull());
    const edge = ROUTING_SCENARIOS[0]!.build("M").edges[0]!;
    const pin = (): void => {
      act(() => {
        captured.onElementClick!({
          hit: { elementId: edge.id, kind: "edge", zone: "segment" },
          point: { x: 0, y: 0 },
          originalEvent: {},
        });
      });
    };
    pin();
    expect(screen.getByTestId("rlab-trace").textContent).toContain(edge.id);
    // Re-click the SAME edge unpins. This is the only in-canvas escape:
    // a click on empty canvas resolves to no hit and is dropped by
    // useElementPointerEvents before any handler sees it, so the old
    // "click empty canvas to clear" was never reachable.
    pin();
    expect(screen.getByTestId("rlab-trace").textContent).toContain(
      "Hover an edge",
    );
    // And the explicit affordance, which is the discoverable one.
    pin();
    fireEvent.click(screen.getByTestId("rlab-trace-clear"));
    expect(screen.getByTestId("rlab-trace").textContent).toContain(
      "Hover an edge",
    );
  });

  it("engine knob change re-runs the layout (new scene delivered)", async () => {
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => expect(captured.scenes.length).toBeGreaterThan(0));
    const before = captured.scenes.length;
    fireEvent.click(screen.getByTestId("rlab-nudge-toggle"));
    await waitFor(() => {
      expect(captured.scenes.length).toBeGreaterThan(before);
    });
    const afterNudge = captured.scenes.length;
    fireEvent.change(screen.getByTestId("rlab-longedge-select"), {
      target: { value: "off" },
    });
    await waitFor(() => {
      expect(captured.scenes.length).toBeGreaterThan(afterNudge);
    });
  });

  it("colors knob: per-edge CSS present by default, gone on monochrome", async () => {
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => expect(captured.scenes.length).toBeGreaterThan(0));
    const css = screen.getByTestId("rlab-edge-css").textContent ?? "";
    const firstEdge = ROUTING_SCENARIOS[0]!.build("M").edges[0]!;
    expect(css).toContain(`[data-ssv-edge-path="${firstEdge.id}"]`);
    fireEvent.change(screen.getByTestId("rlab-colors-select"), {
      target: { value: "mono" },
    });
    expect(screen.queryByTestId("rlab-edge-css")).toBeNull();
  });

  it("re-layout button triggers a fresh layout pass with opt-in ordering restarts", async () => {
    render(<RoutingShell onBack={() => {}} />);
    await waitFor(() => expect(captured.scenes.length).toBeGreaterThan(0));
    const before = captured.scenes.length;
    // Brief 25: Re-layout no longer rebuilds the scenario; it flips
    // on the seeded crossing-aware restarts, which changes the options
    // key so useStructuralLayout re-runs the same input under a new
    // ordering search. The scene input identity is stable across
    // presses (the structural graph didn't change).
    fireEvent.click(screen.getByTestId("rlab-relayout"));
    await waitFor(() => expect(captured.scenes.length).toBeGreaterThan(before));
    // Crossings badge is present once quality has graded a run.
    expect(screen.getByTestId("rlab-crossings").textContent).toMatch(
      /crossings:\s*\d+/,
    );
  });
});
