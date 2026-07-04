import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UGM } from "@g3t/core";
import { SpecLegend } from "./SpecLegend";
import type { EncodingSpec } from "./encoding-spec";
import { OKABE_ITO } from "./palette-bridge";

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
      hexToRgb(OKABE_ITO[1] ?? ""),
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
});
