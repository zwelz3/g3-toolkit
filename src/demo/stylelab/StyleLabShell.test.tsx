/**
 * Style Lab shell smoke (demo-adoption doctrine: every demonstrated
 * behavior gate-enforced). CytoscapeCanvas is stubbed per the
 * established shell-test pattern (jsdom has no 2d canvas); the stub
 * captures each pane's props, and the test drives the captured
 * onReady handlers with REAL headless cytoscape instances built from
 * the shared fixture elements, so the shell's actual logic (class and
 * selection wiring, engine bypass application, live parity
 * computation, honesty report, LOD probe) runs unmodified.
 *
 * What a browser PAINTS remains MR-7's live review; this pins the
 * computed values and the DOM the shell derives from them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import cytoscape, { type Core } from "cytoscape";

const captured = vi.hoisted(() => ({
  panes: [] as Array<{
    stylesheet?: unknown;
    onReady?: (cy: unknown) => void;
  }>,
}));

vi.mock("@g3t/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@g3t/react")>();
  return {
    ...actual,
    CytoscapeCanvas: (props: {
      stylesheet?: unknown;
      onReady?: (cy: unknown) => void;
    }) => {
      captured.panes.push({
        stylesheet: props.stylesheet,
        onReady: props.onReady,
      });
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { StyleLabShell } from "./StyleLabShell";
import { styleLabRawCyElements } from "./style-lab-fixture";

// The REAL canvas rule stack beneath both panes, so the shell test's
// headless instances see the same stylesheet environment the browser
// does (the MR-7 oracle blind spot, closed here too).
async function canvasBaseStack(): Promise<object[]> {
  const mod = await vi.importActual<typeof import("@g3t/react")>("@g3t/react");
  const theme = mod.useThemeStore.getState().theme;
  return [...mod.DEFAULT_STYLESHEET, ...mod.themeColorRules(theme)] as object[];
}

let instances: Core[] = [];

async function mountPanes(): Promise<void> {
  // Pane order matches shell markup: [legacy, engine].
  const legacyPane = captured.panes[0];
  const enginePane = captured.panes[1];
  expect(legacyPane?.onReady).toBeDefined();
  expect(enginePane?.onReady).toBeDefined();
  const base = await canvasBaseStack();
  const legacy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: styleLabRawCyElements() as cytoscape.ElementDefinition[],
    style: [
      ...base,
      ...((legacyPane?.stylesheet as object[]) ?? []),
    ] as cytoscape.StylesheetJson,
  });
  const engine = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: styleLabRawCyElements() as cytoscape.ElementDefinition[],
    style: base as cytoscape.StylesheetJson,
  });
  instances = [legacy, engine];
  legacyPane?.onReady?.(legacy);
  enginePane?.onReady?.(engine);
}

beforeEach(() => {
  captured.panes.length = 0;
});
afterEach(() => {
  cleanup();
  for (const cy of instances) cy.destroy();
  instances = [];
});

describe("StyleLabShell", () => {
  it("computes 0 parity mismatches live once both panes are ready", async () => {
    render(<StyleLabShell />);
    expect(captured.panes).toHaveLength(2);
    // The legacy pane received the fixture stylesheet; the engine pane
    // deliberately received none (bypass provides its values).
    expect(Array.isArray(captured.panes[0]?.stylesheet)).toBe(true);
    expect(captured.panes[1]?.stylesheet).toBeUndefined();
    await mountPanes();
    const summary = await waitFor(() =>
      screen.getByTestId("style-lab-parity-summary"),
    );
    expect(summary.textContent).toMatch(/^0 mismatches across \d+ checks\./);
  });

  it("surfaces the engine-only zone honestly", async () => {
    render(<StyleLabShell />);
    await mountPanes();
    await waitFor(() => screen.getByTestId("style-lab-parity-summary"));
    const zone = screen.getByTestId("style-lab-engine-only");
    expect(zone.textContent).toContain("n1");
    expect(zone.textContent).toContain("halo");
    expect(zone.textContent).toContain("glyphs");
    expect(zone.textContent).toContain("taper");
  });

  it("renders the back affordance and forwards it to the router (MR-7)", () => {
    const onBack = vi.fn();
    render(<StyleLabShell onBack={onBack} />);
    fireEvent.click(screen.getByTestId("style-lab-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("the LOD probe DRIVES the engine pane: hairball tier hides labels via the bypass (MR-7)", async () => {
    render(<StyleLabShell />);
    await mountPanes();
    await waitFor(() => screen.getByTestId("style-lab-parity-summary"));
    const engineCy = instances[1];
    expect(engineCy).toBeDefined();
    if (!engineCy) return;
    // Full detail first: labels visible (no text-opacity bypass).
    expect(String(engineCy.$id("n1").style("text-opacity"))).not.toBe("0");
    // Hairball context: nodeLabels off -> labelVisible false ->
    // text-opacity 0 through the projection; edges fade entirely.
    fireEvent.change(screen.getByTestId("style-lab-lod-select"), {
      target: { value: "3" },
    });
    await waitFor(() => {
      expect(String(engineCy.$id("n1").style("text-opacity"))).toBe("0");
    });
    expect(String(engineCy.$id("e1").style("opacity"))).toBe("0");
    // Back to close-up: the base attributes re-apply (tier 0 restores).
    fireEvent.change(screen.getByTestId("style-lab-lod-select"), {
      target: { value: "0" },
    });
    await waitFor(() => {
      expect(String(engineCy.$id("n1").style("text-opacity"))).not.toBe("0");
    });
  });

  it("the LOD probe flips tiers with the simulated context", () => {
    render(<StyleLabShell />);
    const result = screen.getByTestId("style-lab-lod-result");
    expect(result.textContent).toContain("Tier 0");
    fireEvent.change(screen.getByTestId("style-lab-lod-select"), {
      target: { value: "3" },
    });
    expect(screen.getByTestId("style-lab-lod-result").textContent).toContain(
      "Tier 3",
    );
  });
});
