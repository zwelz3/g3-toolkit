// VR-2 (owner verification 2026-07-26): the color-by-confidence
// DATA path oracle. The pipeline was proven green here while the
// owner saw no color in preview, which localizes any failure to
// the presentation layer; the e2e spec covers that half.
import { describe, it, expect } from "vitest";
import { applyEncodingSpec } from "@g3t/react";
import { buildDigitalThread } from "./model";
import type { EncodingSpec } from "@g3t/react";

describe("VR-2: color-by-confidence pipeline", () => {
  it("produces _ecolor patches for confBand edges", () => {
    const ugm = buildDigitalThread();
    const spec: EncodingSpec = {
      version: 1,
      node: {},
      edge: {
        color: {
          driver: "confBand",
          scale: {
            kind: "categorical",
            overrides: {
              authoritative: "#22c55e",
              merged: "#eab308",
              low: "#ef4444",
            },
          },
        },
      },
    };
    const patch = applyEncodingSpec(spec, ugm);
    const colors = new Set<string>();
    patch.edges.forEach((p) => {
      if (p._ecolor !== undefined) colors.add(p._ecolor);
    });
    expect(colors.has("#eab308"), "merged amber present").toBe(true);
    expect(colors.has("#22c55e"), "authoritative green present").toBe(true);
  });
});
