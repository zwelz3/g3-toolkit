// R-17 (register, 2026-08-06): FloatingLegend must stay in step
// with SpecLegend. R-13.3 gave the inner component an `elements`
// alternative for structural scenes; the floating wrapper, which
// is the one that puts a legend ON the canvas, still demanded a
// UGM, so a consumer had to position SpecLegend itself.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloatingLegend } from "./FloatingLegend";
import type { EncodingSpec } from "../../interaction/encoding/encoding-spec";

const SPEC: EncodingSpec = {
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

describe("FloatingLegend", () => {
  it("renders over a structural scene from element descriptors, with no UGM", () => {
    render(
      <FloatingLegend
        spec={SPEC}
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

  it("forwards override disclosure like the inner component", () => {
    render(
      <FloatingLegend
        spec={SPEC}
        elements={[{ id: "a", type: "Block" }]}
        overrides={[{ scope: { nodeId: "a" } }]}
      />,
    );
    expect(screen.getByTestId("legend-override-notice")).toBeTruthy();
  });
});
