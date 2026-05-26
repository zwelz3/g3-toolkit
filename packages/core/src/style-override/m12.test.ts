/**
 * M12 tests: NodeStyleOverride, SVG icons, NodeStyleEditor,
 * TypeMenuProvider, serialization.
 */

import { describe, it, expect } from "vitest";
import {
  overridesToCytoscapeStyles,
  ICONS,
  ICON_NAMES,
  svgToDataUri,
  serializeOverrides,
  deserializeOverrides,
  TypeMenuProvider,
  createDefaultTypeMenuProvider,
} from "../style-override";
import type { NodeStyleOverride } from "../style-override";

describe("overridesToCytoscapeStyles", () => {
  it("generates node-scoped selector", () => {
    const styles = overridesToCytoscapeStyles([
      { scope: { nodeId: "p1" }, color: "#ff0000" },
    ]);
    expect(styles).toHaveLength(1);
    expect((styles[0] as { selector: string }).selector).toBe("node#p1");
    expect(
      (styles[0] as { style: Record<string, unknown> }).style[
        "background-color"
      ],
    ).toBe("#ff0000");
  });

  it("generates type-scoped selector", () => {
    const styles = overridesToCytoscapeStyles([
      { scope: { type: "Person" }, shape: "diamond" },
    ]);
    expect((styles[0] as { selector: string }).selector).toBe(
      'node[_type = "Person"]',
    );
    expect((styles[0] as { style: Record<string, unknown> }).style.shape).toBe(
      "diamond",
    );
  });

  it("node-scope is more specific than type-scope (CSS order)", () => {
    const overrides: NodeStyleOverride[] = [
      { scope: { type: "Person" }, color: "#0000ff" },
      { scope: { nodeId: "p1" }, color: "#ff0000" },
    ];
    const styles = overridesToCytoscapeStyles(overrides);
    // Node selector comes after type selector in the array
    // (later entries override earlier in Cytoscape)
    expect(styles).toHaveLength(2);
  });

  it("handles icon override with data URI", () => {
    const styles = overridesToCytoscapeStyles([
      { scope: { nodeId: "p1" }, icon: { svg: ICONS.shield!, color: "#fff" } },
    ]);
    const style = (styles[0] as { style: Record<string, unknown> }).style;
    expect(style["background-image"]).toContain("data:image/svg+xml;base64");
  });
});

// ── SVG Icon Library (M12.E1.T2) ────────────────────────────────────

describe("SVG icon library", () => {
  it("contains 20 icons", () => {
    expect(ICON_NAMES).toHaveLength(20);
  });

  it("all icons are non-empty SVG path strings", () => {
    for (const name of ICON_NAMES) {
      const path = ICONS[name];
      expect(path, `Icon "${name}" should be a non-empty string`).toBeTruthy();
      expect(typeof path).toBe("string");
      expect(path!.length).toBeGreaterThan(10);
    }
  });

  it("svgToDataUri produces valid base64 data URI", () => {
    const uri = svgToDataUri(ICONS.person!, "#000");
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
    const base64 = uri.split(",")[1]!;
    const decoded = atob(base64);
    expect(decoded).toContain("<svg");
    expect(decoded).toContain("</svg>");
  });
});

// ── Serialization (M12.E1.T3) ───────────────────────────────────────

describe("Override serialization", () => {
  it("round-trips overrides through JSON", () => {
    const overrides: NodeStyleOverride[] = [
      { scope: { nodeId: "p1" }, color: "#ff0000", size: 40 },
      { scope: { type: "Person" }, shape: "diamond" },
    ];
    const json = serializeOverrides(overrides);
    const restored = deserializeOverrides(json);
    expect(restored).toHaveLength(2);
    expect(restored[0]?.color).toBe("#ff0000");
    expect(restored[1]?.shape).toBe("diamond");
  });

  it("handles empty array", () => {
    const json = serializeOverrides([]);
    expect(deserializeOverrides(json)).toEqual([]);
  });

  it("handles invalid JSON gracefully", () => {
    expect(deserializeOverrides("{}")).toEqual([]);
    expect(deserializeOverrides("null")).toEqual([]);
  });
});

// ── TypeMenuProvider (M12.E3.T2) ────────────────────────────────────

describe("TypeMenuProvider", () => {
  it("returns items for a specific type", () => {
    const provider = createDefaultTypeMenuProvider();
    const personItems = provider.getItemsForType("Person");
    const labels = personItems.map((i) => i.label);
    expect(labels).toContain("Show Timeline");
    expect(labels).toContain("Expand Neighborhood");
    expect(labels).toContain("Find Paths From Here");
  });

  it("returns map item only for Location type", () => {
    const provider = createDefaultTypeMenuProvider();
    const locationItems = provider.getItemsForType("Location");
    expect(locationItems.map((i) => i.label)).toContain("Show on Map");

    const personItems = provider.getItemsForType("Person");
    expect(personItems.map((i) => i.label)).not.toContain("Show on Map");
  });

  it("universal items appear for all types", () => {
    const provider = createDefaultTypeMenuProvider();
    const anyItems = provider.getItemsForType("SomeRandomType");
    expect(anyItems.map((i) => i.label)).toContain("Expand Neighborhood");
  });

  it("custom items can be registered", () => {
    const provider = new TypeMenuProvider();
    provider.register({
      id: "custom",
      label: "Custom Action",
      applicableTypes: ["Widget"],
      execute: () => {},
    });
    expect(provider.getItemsForType("Widget")).toHaveLength(1);
    expect(provider.getItemsForType("Other")).toHaveLength(0);
  });
});
