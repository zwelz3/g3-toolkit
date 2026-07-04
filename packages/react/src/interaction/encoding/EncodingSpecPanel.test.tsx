/**
 * EncodingSpecPanel + EncodingPreview tests
 * (roadmap/design/encoding-controls.md, tiers 1-2).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { EncodingSpecPanel, EncodingPreview } from "./EncodingSpecPanel";
import { DEFAULT_SPEC, type EncodingSpec } from "./encoding-spec";
import { OKABE_ITO } from "./palette-bridge";

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", {
    types: ["Person"],
    properties: { label: "Aris", pagerank: 0.1 },
  });
  ugm.addNode("o1", {
    types: ["Org"],
    properties: { label: "Helix", pagerank: 0.9 },
  });
  ugm.addEdge("p1", "o1", { type: "worksAt", properties: { weight: 3 } });
  return ugm;
}

describe("EncodingSpecPanel (tier 1 + 2)", () => {
  it("renders one row per channel, including theme-delegated rows", () => {
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={DEFAULT_SPEC}
        onChange={() => {}}
      />,
    );
    for (const ch of [
      "node.color",
      "node.size",
      "node.icon",
      "node.label",
      "edge.color",
      "edge.width",
      "effects.accent",
      "canvas.background",
    ]) {
      expect(screen.getByTestId(`enc-row-${ch}`)).toBeTruthy();
    }
    expect(screen.getByTestId("enc-row-effects.accent").textContent).toContain(
      "reserved",
    );
  });

  it("chip expands the tier-2 editor for that channel only", () => {
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={DEFAULT_SPEC}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByTestId("enc-editor-node.color")).toBeNull();
    fireEvent.click(screen.getByTestId("enc-chip-node.color"));
    expect(screen.getByTestId("enc-editor-node.color")).toBeTruthy();
    expect(screen.queryByTestId("enc-editor-node.size")).toBeNull();
  });

  it("UC1 through the UI: pinning one value emits an override and leaves others stable", () => {
    const onChange = vi.fn();
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={DEFAULT_SPEC}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId("enc-chip-node.color"));
    const personPicker = screen
      .getByTestId("enc-value-Person")
      .querySelector("input") as HTMLInputElement;
    fireEvent.change(personPicker, { target: { value: "#7a0bc0" } });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(emitted.node.color?.scale).toMatchObject({
      kind: "categorical",
      overrides: { Person: "#7a0bc0" },
    });
  });

  it("driver change to a numeric property emits a sequential size scale", () => {
    const onChange = vi.fn();
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={DEFAULT_SPEC}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("node.size driver"), {
      target: { value: "pagerank" },
    });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(emitted.node.size).toMatchObject({
      driver: "pagerank",
      scale: { kind: "sequential", domain: "auto" },
    });
  });

  it("custom palette surfaces the warn-not-block messages", () => {
    const spec: EncodingSpec = {
      ...DEFAULT_SPEC,
      node: {
        ...DEFAULT_SPEC.node,
        color: {
          driver: "types",
          scale: { kind: "categorical", palette: ["#fefefe", "#0072b2"] },
        },
      },
    };
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={spec}
        onChange={() => {}}
        defaultExpanded={["node.color"]}
      />,
    );
    const warnings = screen.getAllByRole("status");
    expect(warnings.some((w) => w.textContent?.includes("Low contrast"))).toBe(
      true,
    );
    expect(warnings.some((w) => w.textContent?.includes("color-vision"))).toBe(
      true,
    );
  });
});

describe("EncodingPreview (resolver-driven proof)", () => {
  it("renders samples through the real resolvers", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "types",
          scale: {
            kind: "categorical",
            palette: "okabe-ito",
            overrides: { Person: "#7a0bc0" },
          },
        },
        size: {
          driver: "pagerank",
          scale: { kind: "sequential", domain: [0, 1], range: [10, 30] },
        },
        icon: {
          driver: "types",
          scale: { kind: "categorical", overrides: { Org: "layers" } },
        },
        label: { driver: "label" },
      },
      edge: {},
    };
    render(
      <EncodingPreview
        ugm={graph()}
        spec={spec}
        samples={[
          { types: ["Person"], properties: { label: "Aris", pagerank: 0 } },
          { types: ["Org"], properties: { label: "Helix", pagerank: 1 } },
        ]}
      />,
    );
    const person = screen
      .getByTestId("enc-sample-0")
      .querySelector(".g3t-enc-samplenode") as HTMLElement;
    const org = screen
      .getByTestId("enc-sample-1")
      .querySelector(".g3t-enc-samplenode") as HTMLElement;
    // Color: override for Person; palette slot for Org (stability).
    expect(person.style.background).toBe("rgb(122, 11, 192)");
    expect(org.style.background.toLowerCase()).toBe(
      hexToRgb(OKABE_ITO[1] ?? ""),
    );
    // Size: domain endpoints map to range endpoints.
    expect(person.getAttribute("data-size")).toBe("10");
    expect(org.getAttribute("data-size")).toBe("30");
    // Icon: only Org mapped.
    expect(org.querySelector('[data-testid="g3t-icon-layers"]')).toBeTruthy();
    expect(person.querySelector("svg")).toBeNull();
    // Labels through the label driver.
    expect(screen.getByText("Helix")).toBeTruthy();
  });
});

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

describe("round-8 review regressions", () => {
  it("chip renders colors for non-types drivers (label)", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "label",
          scale: { kind: "categorical", palette: "okabe-ito" },
        },
      },
      edge: {},
    };
    render(<EncodingSpecPanel ugm={graph()} spec={spec} onChange={() => {}} />);
    const strip = screen
      .getByTestId("enc-chip-node.color")
      .querySelector(".g3t-enc-chipstrip") as HTMLElement;
    const fills = [...strip.querySelectorAll("span")].map(
      (s) => (s as HTMLElement).style.background,
    );
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every((f) => f && f !== "transparent")).toBe(true);
  });

  it("switching the color driver to a numeric property defaults to sequential", () => {
    const onChange = vi.fn();
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={DEFAULT_SPEC}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("node.color driver"), {
      target: { value: "pagerank" },
    });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(emitted.node.color).toMatchObject({
      driver: "pagerank",
      scale: { kind: "sequential", domain: "auto" },
    });
  });

  it("custom palette: picker edits the array and the warning clears when fixed", () => {
    const onChange = vi.fn();
    const lowContrast: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "types",
          scale: { kind: "categorical", palette: ["#fefefe", "#0072b2"] },
        },
      },
      edge: {},
    };
    const { rerender } = render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={lowContrast}
        onChange={onChange}
        canvasBg="#ffffff"
        defaultExpanded={["node.color"]}
      />,
    );
    expect(
      screen
        .getAllByRole("status")
        .some((w) => w.textContent?.includes("#fefefe")),
    ).toBe(true);
    // Fix the offending slot through the picker.
    const picker = screen
      .getByTestId("enc-value-Person")
      .querySelector("input") as HTMLInputElement;
    fireEvent.change(picker, { target: { value: "#009e73" } });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(emitted.node.color?.scale).toMatchObject({
      kind: "categorical",
      palette: ["#009e73", "#0072b2"],
    });
    expect(
      (emitted.node.color?.scale as { overrides?: unknown }).overrides,
    ).toBeUndefined();
    rerender(
      <EncodingSpecPanel
        ugm={graph()}
        spec={emitted}
        onChange={onChange}
        canvasBg="#ffffff"
        defaultExpanded={["node.color"]}
      />,
    );
    // Both effective colors are palette-safe members: silence.
    expect(screen.queryAllByRole("status")).toHaveLength(0);
  });

  it("switching to custom folds effective colors and clears overrides", () => {
    const onChange = vi.fn();
    const pinned: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "types",
          scale: {
            kind: "categorical",
            palette: "okabe-ito",
            overrides: { Person: "#7a0bc0" },
          },
        },
      },
      edge: {},
    };
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={pinned}
        onChange={onChange}
        defaultExpanded={["node.color"]}
      />,
    );
    const editor = screen.getByTestId("enc-editor-node.color");
    const paletteSelect = editor.querySelector("select") as HTMLSelectElement;
    fireEvent.change(paletteSelect, { target: { value: "custom" } });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    const scale = emitted.node.color?.scale as {
      palette: string[];
      overrides?: unknown;
    };
    expect(scale.palette[0]).toBe("#7a0bc0");
    expect(scale.overrides).toBeUndefined();
  });
});

describe("round-9 review regressions", () => {
  it("chip strip shows DISTINCT palette colors (one resolver per strip)", () => {
    // No overrides: every distinct driver value must get its own slot.
    const spec: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "types",
          scale: { kind: "categorical", palette: "okabe-ito" },
        },
      },
      edge: {},
    };
    render(<EncodingSpecPanel ugm={graph()} spec={spec} onChange={() => {}} />);
    const strip = screen
      .getByTestId("enc-chip-node.color")
      .querySelector(".g3t-enc-chipstrip") as HTMLElement;
    const fills = new Set(
      [...strip.querySelectorAll("span")].map(
        (s) => (s as HTMLElement).style.background,
      ),
    );
    expect(fills.size).toBeGreaterThanOrEqual(2);
  });

  it("fixed node.size is editable and emits the new value", () => {
    const onChange = vi.fn();
    const spec: EncodingSpec = {
      version: 1,
      node: { size: { scale: { kind: "fixed", value: 18 } } },
      edge: {},
    };
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={spec}
        onChange={onChange}
        defaultExpanded={["node.size"]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Fixed size value"), {
      target: { value: "24" },
    });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(emitted.node.size).toEqual({ scale: { kind: "fixed", value: 24 } });
  });

  it("fixed edge.width is editable via the slider", () => {
    const onChange = vi.fn();
    const spec: EncodingSpec = {
      version: 1,
      node: {},
      edge: { width: { scale: { kind: "fixed", value: 2 } } },
    };
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={spec}
        onChange={onChange}
        defaultExpanded={["edge.width"]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Fixed width"), {
      target: { value: "5" },
    });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(emitted.edge.width).toEqual({ scale: { kind: "fixed", value: 5 } });
  });

  it("edge.color categorical gets a chip strip and an editor that emits", () => {
    const onChange = vi.fn();
    const spec: EncodingSpec = {
      version: 1,
      node: {},
      edge: {
        color: {
          driver: "type",
          scale: { kind: "categorical", palette: "okabe-ito" },
        },
      },
    };
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={spec}
        onChange={onChange}
        defaultExpanded={["edge.color"]}
      />,
    );
    const strip = screen
      .getByTestId("enc-chip-edge.color")
      .querySelector(".g3t-enc-chipstrip");
    expect(strip).not.toBeNull();
    const picker = screen
      .getByTestId("enc-value-worksAt")
      .querySelector("input") as HTMLInputElement;
    fireEvent.change(picker, { target: { value: "#7a0bc0" } });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(
      (emitted.edge.color?.scale as { overrides?: Record<string, string> })
        .overrides,
    ).toEqual({ worksAt: "#7a0bc0" });
  });

  it("fixed edge.color is editable with a picker", () => {
    const onChange = vi.fn();
    const spec: EncodingSpec = {
      version: 1,
      node: {},
      edge: { color: { scale: { kind: "fixed", value: "#9aa0a6" } } },
    };
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={spec}
        onChange={onChange}
        defaultExpanded={["edge.color"]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Fixed edge color"), {
      target: { value: "#0072b2" },
    });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(emitted.edge.color).toEqual({
      scale: { kind: "fixed", value: "#0072b2" },
    });
  });
});

describe("node.shape channel (round 13)", () => {
  const shapeSpec = (shapeDriver: string): EncodingSpec => ({
    version: 1,
    node: {
      color: {
        driver: "types",
        scale: { kind: "categorical", palette: "okabe-ito" },
      },
      shape: {
        driver: shapeDriver,
        scale: { kind: "categorical", overrides: {} },
      },
    },
    edge: {},
  });

  it("emits shape overrides through the editor", () => {
    const onChange = vi.fn();
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={shapeSpec("types")}
        onChange={onChange}
        defaultExpanded={["node.shape"]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Shape for Person"), {
      target: { value: "diamond" },
    });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(emitted.node.shape?.scale).toMatchObject({
      kind: "categorical",
      overrides: { Person: "diamond" },
    });
  });

  it("warns when shape and color drive from different attributes; silent when paired", () => {
    const { rerender } = render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={shapeSpec("label")}
        onChange={() => {}}
        defaultExpanded={["node.shape"]}
      />,
    );
    expect(
      screen
        .getAllByRole("status")
        .some((w) => w.textContent?.includes("paired-redundancy")),
    ).toBe(true);
    rerender(
      <EncodingSpecPanel
        ugm={graph()}
        spec={shapeSpec("types")}
        onChange={() => {}}
        defaultExpanded={["node.shape"]}
      />,
    );
    expect(
      screen
        .queryAllByRole("status")
        .filter((w) => w.textContent?.includes("paired-redundancy")),
    ).toHaveLength(0);
  });
});

describe("node.shape fixed mode (round 18)", () => {
  it("driver 'fixed' yields a fixed scale, not None", () => {
    const onChange = vi.fn();
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={{ version: 1, node: {}, edge: {} }}
        onChange={onChange}
        defaultExpanded={["node.shape"]}
      />,
    );
    const row = screen.getByTestId("enc-row-node.shape");
    fireEvent.change(within(row).getByLabelText(/driver/i), {
      target: { value: "fixed" },
    });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(emitted.node.shape?.scale).toEqual({
      kind: "fixed",
      value: "ellipse",
    });
  });

  it("fixed editor changes the shape for every node", () => {
    const onChange = vi.fn();
    render(
      <EncodingSpecPanel
        ugm={graph()}
        spec={{
          version: 1,
          node: { shape: { scale: { kind: "fixed", value: "ellipse" } } },
          edge: {},
        }}
        onChange={onChange}
        defaultExpanded={["node.shape"]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Fixed node shape"), {
      target: { value: "hexagon" },
    });
    const emitted = onChange.mock.calls[0]![0] as EncodingSpec;
    expect(emitted.node.shape?.scale).toEqual({
      kind: "fixed",
      value: "hexagon",
    });
  });
});
