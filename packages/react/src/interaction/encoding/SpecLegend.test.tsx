import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { SpecLegend } from "./SpecLegend";
import type { EncodingSpec } from "./encoding-spec";
import { CANVAS_CATEGORICAL } from "./palette-bridge";

function graph(): UGM {
  const ugm = new UGM();
  ugm.addNode("p1", { types: ["Person"], properties: { pagerank: 0.1 } });
  ugm.addNode("o1", { types: ["Org"], properties: { pagerank: 0.9 } });
  ugm.addEdge("p1", "o1", { type: "worksAt", properties: { weight: 3 } });
  return ugm;
}

const SPEC: EncodingSpec = {
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
      scale: { kind: "sequential", domain: [0, 0.2], range: [14, 34] },
    },
    icon: {
      driver: "types",
      scale: { kind: "categorical", overrides: { Org: "layers" } },
    },
  },
  edge: {
    width: {
      driver: "weight",
      scale: { kind: "sequential", domain: "auto", range: [1, 6] },
    },
  },
};

describe("SpecLegend", () => {
  it("mirrors the spec through the shared resolvers", () => {
    render(<SpecLegend ugm={graph()} spec={SPEC} />);
    const person = screen.getByTestId("legend-color-Person");
    const personSwatch = person.querySelector(
      ".g3t-legend-swatch",
    ) as HTMLElement;
    expect(personSwatch.style.background).toBe("rgb(122, 11, 192)");
    const org = screen.getByTestId("legend-color-Org");
    const orgSwatch = org.querySelector(".g3t-legend-swatch") as HTMLElement;
    expect(orgSwatch.style.background.toLowerCase()).toBe(
      hexToRgb(CANVAS_CATEGORICAL[1] ?? ""),
    );
    expect(screen.getByTestId("legend-size").textContent).toContain("14px");
    expect(screen.getByTestId("legend-size").textContent).toContain("34px");
    expect(
      screen
        .getByTestId("legend-icon-Org")
        .querySelector('[data-testid="g3t-icon-layers"]'),
    ).toBeTruthy();
    expect(screen.queryByTestId("legend-icon-Person")).toBeNull();
    expect(screen.getByTestId("legend-edge-width")).toBeTruthy();
  });

  it("renders the ramp for sequential color", () => {
    const seq: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "pagerank",
          scale: { kind: "sequential", domain: "auto" },
        },
      },
      edge: {},
    };
    render(<SpecLegend ugm={graph()} spec={seq} />);
    expect(
      screen.getByTestId("legend-color-ramp").querySelectorAll("span").length,
    ).toBeGreaterThan(4);
  });
});

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

describe("shape section (round 13)", () => {
  it("renders glyph rows through the shape resolver", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        shape: {
          driver: "types",
          scale: { kind: "categorical", overrides: { Person: "diamond" } },
        },
      },
      edge: {},
    };
    render(<SpecLegend ugm={graph()} spec={spec} />);
    const person = screen.getByTestId("legend-shape-Person");
    expect(person.textContent).toContain("(diamond)");
    expect(person.querySelector("polygon")).toBeTruthy();
    // Org auto-cycles to slot 1 (rectangle) despite Person's pin.
    expect(screen.getByTestId("legend-shape-Org").textContent).toContain(
      "(rectangle)",
    );
  });

  it("documents the DEFAULT shape channel when the spec declares none (12.15)", () => {
    const ugm = new UGM();
    ugm.addNode("a", { types: ["Alpha"] });
    ugm.addNode("b", { types: ["Beta"] });
    render(
      <SpecLegend
        ugm={ugm}
        spec={{
          version: 1,
          node: {
            color: {
              driver: "types",
              scale: { kind: "categorical", palette: "okabe-ito" },
            },
          },
          edge: {},
        }}
      />,
    );
    // Sorted types cycle shapeForIndex: the legend mirrors the canvas
    // default exactly instead of showing color only.
    expect(screen.getByTestId("legend-shape-Alpha")).toBeDefined();
    expect(screen.getByTestId("legend-shape-Beta")).toBeDefined();
  });
});

describe("R-13: the legend discloses manual overrides", () => {
  it("says nothing when there are none", () => {
    render(<SpecLegend ugm={graph()} spec={SPEC} />);
    expect(screen.queryByTestId("legend-override-notice")).toBeNull();
  });

  it("discloses their presence and offers a reset", () => {
    const onResetOverrides = vi.fn();
    render(
      <SpecLegend
        ugm={graph()}
        spec={SPEC}
        overrides={[{ scope: { nodeId: "n1" } }]}
        onResetOverrides={onResetOverrides}
      />,
    );
    const notice = screen.getByTestId("legend-override-notice");
    expect(notice.textContent).toContain("does not describe");
    fireEvent.click(screen.getByTestId("legend-override-reset"));
    expect(onResetOverrides).toHaveBeenCalledOnce();
  });
});

describe("R-13.3 (round 21): one legend serves both renderers", () => {
  it("renders from element descriptors when there is no UGM", () => {
    const spec: EncodingSpec = {
      version: 1,
      node: {
        color: {
          driver: "type",
          scale: {
            kind: "categorical",
            overrides: { Block: "#ff0000", Port: "#00ff00" },
          },
        },
      },
      edge: {},
    };
    render(
      <SpecLegend
        spec={spec}
        elements={[
          { id: "a", type: "Block" },
          { id: "b", type: "Port" },
        ]}
      />,
    );
    const legend = screen.getByTestId("g3t-spec-legend");
    expect(legend.textContent).toContain("Block");
    expect(legend.textContent).toContain("Port");
  });
});
