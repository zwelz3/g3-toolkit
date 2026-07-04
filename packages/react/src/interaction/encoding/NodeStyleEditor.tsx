/**
 * NodeStyleEditor: per-node visual customization panel (M12.E2.T1-T2).
 *
 * Color picker, shape selector, size slider, icon grid, label dropdown.
 * Scope toggle: "This node only" vs "All [Type] nodes" (T2).
 */

import { useState, useCallback, type ReactNode } from "react";
import type { UGM } from "@g3t/core";
import {
  ICONS,
  ICON_NAMES,
  type NodeStyleOverride,
  type CytoscapeShape,
} from "@g3t/core";
import { useStyleOverrideStore } from "../../state/style-override-store";

// ── Props ───────────────────────────────────────────────────────────

export interface NodeStyleEditorProps {
  ugm: UGM;
  nodeId: string;
  onClose: () => void;
  className?: string;
}

// ── Presets ─────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#F0E442",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
  "#999999",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
];

const SHAPES: CytoscapeShape[] = [
  "ellipse",
  "rectangle",
  "roundrectangle",
  "diamond",
  "hexagon",
  "triangle",
  "star",
  "octagon",
];

// Small SVG glyph per shape so the shape buttons read visually instead
// of by name. Keyed loosely so an unmapped shape falls back to ellipse.
const SHAPE_GLYPHS: Record<string, ReactNode> = {
  ellipse: <ellipse cx="12" cy="12" rx="10" ry="7" />,
  rectangle: <rect x="3" y="6" width="18" height="12" />,
  roundrectangle: <rect x="3" y="6" width="18" height="12" rx="4" />,
  diamond: <polygon points="12,2 22,12 12,22 2,12" />,
  hexagon: <polygon points="7,3 17,3 22,12 17,21 7,21 2,12" />,
  triangle: <polygon points="12,3 22,21 2,21" />,
  star: <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" />,
  octagon: <polygon points="8,2 16,2 22,8 22,16 16,22 8,22 2,16 2,8" />,
};

function ShapeGlyph({ shape }: { shape: CytoscapeShape }): ReactNode {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {SHAPE_GLYPHS[shape] ?? SHAPE_GLYPHS["ellipse"]}
    </svg>
  );
}

// ── Component ───────────────────────────────────────────────────────

export function NodeStyleEditor({
  ugm,
  nodeId,
  onClose,
  className,
}: NodeStyleEditorProps) {
  const node = ugm.getNode(nodeId);
  const nodeType = node?.types[0] ?? "Unknown";
  const { add } = useStyleOverrideStore();

  const [scope, setScope] = useState<"node" | "type">("node");
  const [color, setColor] = useState<string>("");
  const [shape, setShape] = useState<CytoscapeShape | "">("");
  const [size, setSize] = useState<number>(30);
  const [selectedIcon, setSelectedIcon] = useState<string>("");
  const [iconColor] = useState<string>("#ffffff");

  const handleApply = useCallback(() => {
    const override: NodeStyleOverride = {
      scope: scope === "node" ? { nodeId } : { type: nodeType },
    };
    if (color) override.color = color;
    if (shape) override.shape = shape;
    if (size !== 30) override.size = size;
    if (selectedIcon && ICONS[selectedIcon]) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      override.icon = { svg: ICONS[selectedIcon]!, color: iconColor };
    }
    add(override);
    onClose();
  }, [
    scope,
    nodeId,
    nodeType,
    color,
    shape,
    size,
    selectedIcon,
    iconColor,
    add,
    onClose,
  ]);

  return (
    <div
      data-testid="node-style-editor"
      className={className}
      style={{
        padding: "var(--g3t-space-4, 16px)",
        background: "var(--g3t-bg-primary)",
        border: "1px solid var(--g3t-border)",
        borderRadius: "var(--g3t-radius-lg, 8px)",
        boxShadow: "var(--g3t-shadow-lg)",
        width: 280,
        fontSize: "var(--g3t-font-sm, 12px)",
        color: "var(--g3t-text-primary)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 600 }}>Edit Appearance</div>
        <button
          className="g3t-btn g3t-btn-ghost"
          onClick={onClose}
          style={{ fontSize: 14, padding: 0 }}
        >
          ✕
        </button>
      </div>

      {/* Scope toggle (M12.E2.T2) */}
      <div
        data-testid="scope-toggle"
        style={{ display: "flex", gap: 4, marginBottom: 12 }}
      >
        <button
          data-testid="scope-node"
          className={`g3t-btn ${scope === "node" ? "g3t-btn-active" : ""}`}
          onClick={() => setScope("node")}
          style={{ fontSize: 11, flex: 1 }}
        >
          This node only
        </button>
        <button
          data-testid="scope-type"
          className={`g3t-btn ${scope === "type" ? "g3t-btn-active" : ""}`}
          onClick={() => setScope("type")}
          style={{ fontSize: 11, flex: 1 }}
        >
          All {nodeType}
        </button>
      </div>

      {/* Color */}
      <div style={{ marginBottom: 12 }}>
        <div className="g3t-panel-title">Color</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              data-testid={`color-${c}`}
              onClick={() => setColor(c)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                background: c,
                border:
                  color === c
                    ? "2px solid var(--g3t-text-primary)"
                    : "1px solid var(--g3t-border)",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>

      {/* Shape */}
      <div style={{ marginBottom: 12 }}>
        <div className="g3t-panel-title">Shape</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {SHAPES.map((s) => (
            <button
              key={s}
              data-testid={`shape-${s}`}
              className={`g3t-btn ${shape === s ? "g3t-btn-active" : ""}`}
              onClick={() => setShape(s)}
              title={s}
              style={{ padding: 4, lineHeight: 0 }}
            >
              <ShapeGlyph shape={s} />
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div style={{ marginBottom: 12 }}>
        <div className="g3t-panel-title">Size: {size}px</div>
        <input
          data-testid="size-slider"
          type="range"
          min={10}
          max={80}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      {/* Icon */}
      <div style={{ marginBottom: 12 }}>
        <div className="g3t-panel-title">Icon</div>
        <div
          style={{
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
            maxHeight: 80,
            overflow: "auto",
          }}
        >
          <button
            data-testid="icon-none"
            className={`g3t-btn ${selectedIcon === "" ? "g3t-btn-active" : ""}`}
            onClick={() => setSelectedIcon("")}
            style={{ fontSize: 10, padding: "2px 6px" }}
          >
            None
          </button>
          {ICON_NAMES.map((name) => (
            <button
              key={name}
              data-testid={`icon-${name}`}
              className={`g3t-btn ${selectedIcon === name ? "g3t-btn-active" : ""}`}
              onClick={() => setSelectedIcon(name)}
              style={{ padding: 4, lineHeight: 0 }}
              title={name}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                style={{ display: "block" }}
              >
                <path d={ICONS[name] ?? ""} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Apply */}
      <button
        data-testid="apply-style"
        className="g3t-btn g3t-btn-active"
        onClick={handleApply}
        style={{ width: "100%", fontSize: 12, padding: "6px 0" }}
      >
        Apply
      </button>
    </div>
  );
}
