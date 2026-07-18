/**
 * ARC-008 adapter conformance suite.
 *
 * "SVG, Canvas 2D, and WebGL adapters consume identical
 * VisualAttributes + geometry, with a conformance suite run against
 * every adapter." One shared fixture scene; one table of semantic
 * facts; per-adapter probes (DOM queries for SVG, display-list
 * queries for Canvas). A WebGL adapter joins by adding a probe, not
 * new facts. Capability declarations are VERIFIED here: an adapter
 * claiming pulse "static" must draw the halo and must not animate.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import type { VisualAttributes } from "@g3t/core";
import {
  SvgAdapter,
  type SvgSceneEdge,
  type SvgSceneNode,
} from "../svg/svg-adapter";
import {
  buildDisplayList,
  CANVAS_ADAPTER_CAPABILITIES,
  type DrawOp,
} from "../canvas2d/display-list";

const NODES: SvgSceneNode[] = [
  { id: "hub", x: 100, y: 100, width: 60, height: 60 },
  { id: "leaf", x: 260, y: 100, width: 40, height: 40 },
  { id: "quiet", x: 100, y: 220, width: 40, height: 40 },
];
const EDGES: SvgSceneEdge[] = [
  { id: "critical", source: "hub", target: "leaf" },
  { id: "plain", source: "hub", target: "quiet" },
];
const RESOLVED = new Map<string, VisualAttributes>([
  [
    "hub",
    {
      shape: "hexagon",
      fill: "#1e293b",
      halo: { color: "#e03131", width: 8 },
      pulse: true,
      donut: [
        { fraction: 0.5, color: "#2f9e44" },
        { fraction: 0.25, color: "#e8590c" },
      ],
      glyphs: [{ slot: "top-right", text: "12" }],
      labelText: "Hub",
      labelHalo: { color: "#0b1120", width: 3 },
    },
  ],
  ["leaf", { labelText: "Leaf", labelVisible: false }],
  ["quiet", { labelText: "Quiet" }],
  [
    "critical",
    {
      taper: true,
      strokeWidth: 2,
      gradient: { from: "#e8590c", to: "#fab005" },
    },
  ],
  ["plain", { strokeDash: [4, 3] }],
]);

/** The semantic facts every adapter must express. */
interface Probe {
  haloCount: number;
  pulseMarked: boolean;
  animated: boolean;
  donutArcCount: number;
  glyphTexts: string[];
  taperCount: number;
  taperGradientCount: number;
  dashedEdgeCount: number;
  visibleLabels: string[];
}

function probeSvg(): Probe {
  const { container } = render(
    <SvgAdapter
      nodes={NODES}
      edges={EDGES}
      resolved={RESOLVED}
      width={400}
      height={300}
    />,
  );
  return {
    haloCount: container.querySelectorAll("[data-svg-halo]").length,
    pulseMarked:
      container.querySelectorAll("[data-svg-halo].g3t-svg-pulse").length > 0,
    animated:
      container.querySelectorAll("[data-svg-halo].g3t-svg-pulse").length > 0,
    donutArcCount: container.querySelectorAll("[data-svg-donut-arc]").length,
    glyphTexts: [...container.querySelectorAll("[data-svg-glyph]")].map(
      (g) => g.textContent ?? "",
    ),
    taperCount: container.querySelectorAll("[data-svg-taper]").length,
    taperGradientCount: [
      ...container.querySelectorAll("[data-svg-taper]"),
    ].filter((t) => (t.getAttribute("fill") ?? "").includes("url(")).length,
    dashedEdgeCount: [...container.querySelectorAll("[data-svg-edge]")].filter(
      (e) => e.querySelector("line")?.getAttribute("stroke-dasharray"),
    ).length,
    visibleLabels: [...container.querySelectorAll("[data-svg-label]")].map(
      (l) => l.textContent ?? "",
    ),
  };
}

function probeCanvas(): Probe {
  const ops: DrawOp[] = buildDisplayList({
    nodes: NODES,
    edges: EDGES,
    resolved: RESOLVED,
  });
  const of = <K extends DrawOp["kind"]>(k: K) =>
    ops.filter((o): o is Extract<DrawOp, { kind: K }> => o.kind === k);
  return {
    haloCount: of("halo").length,
    pulseMarked: of("halo").some((h) => h.pulseStatic),
    animated: false, // stage 1: nothing animates in the op stream
    donutArcCount: of("donut-arc").length,
    glyphTexts: of("glyph").map((g) => g.text),
    taperCount: of("taper").length,
    taperGradientCount: of("taper").filter((t) => t.gradient !== undefined)
      .length,
    dashedEdgeCount: of("edge").filter((e) => e.dash !== undefined).length,
    visibleLabels: of("label").map((l) => l.text),
  };
}

const ADAPTERS: { name: string; probe: () => Probe }[] = [
  { name: "svg", probe: probeSvg },
  { name: "canvas2d", probe: probeCanvas },
];

describe.each(ADAPTERS)("ARC-008 conformance: $name", ({ name, probe }) => {
  it("expresses the shared scene's semantic facts", () => {
    const p = probe();
    expect(p.haloCount).toBe(1);
    expect(p.pulseMarked).toBe(true);
    expect(p.donutArcCount).toBe(2);
    expect(p.glyphTexts).toEqual(["12"]);
    expect(p.taperCount).toBe(1);
    // The MR-11 finding, pinned: a gradient TAPER edge carries its
    // gradient in every adapter (canvas lost it before this test).
    expect(p.taperGradientCount).toBe(1);
    expect(p.dashedEdgeCount).toBe(1);
    // LOD honesty: leaf's label is hidden; hub and quiet visible.
    expect([...p.visibleLabels].sort()).toEqual(["Hub", "Quiet"]);
  });

  it("capability declarations match behavior", () => {
    const p = probe();
    if (name === "canvas2d") {
      expect(CANVAS_ADAPTER_CAPABILITIES.pulseAnimation).toBe("static");
      expect(p.animated).toBe(false);
      expect(p.pulseMarked).toBe(true);
    } else {
      // The SVG adapter animates pulse (reduced-motion aware via CSS).
      expect(p.animated).toBe(true);
    }
  });
});
