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
  STRUCTURAL_STYLE_CHANNELS,
  CANVAS_STYLE_CHANNELS,
  type StyleChannel,
} from "@g3t/core";
import { useStyleOverrideStore } from "../../state/style-override-store";

// ── Props ───────────────────────────────────────────────────────────

/** R-12b (round 21, 2026-08-05): the two facts the editor actually
 *  needs about its target. A structural scene carries a
 *  StructuralGraphInput rather than a UGM, so the editor could not
 *  be opened over one at all; passing a descriptor covers both
 *  callers and also lets the canvas case work on a graph the host
 *  has not loaded into a UGM. */
export interface NodeStyleTarget {
  id: string;
  /** Offered as the type scope; omit for node-scoped only. */
  type?: string;
  /** Display name in the header; falls back to the id. */
  label?: string;
  /** Existing override, so the editor opens showing current state
   *  rather than empty (the re-edit case). */
  current?: NodeStyleOverride;
  /** True when the element renders as a multi-type pie, which
   *  forces its shape (R-8). Derived from the UGM automatically in
   *  the convenience form. */
  isPie?: boolean;
}

export interface NodeStyleEditorProps {
  /** Convenience form: the editor derives the target from the
   *  graph. Supply this OR `target`. */
  ugm?: UGM;
  nodeId?: string;
  /** R-12b: renderer-neutral form, for structural scenes. */
  target?: NodeStyleTarget;
  onClose: () => void;
  className?: string;
  /** R-12c (round 21): wired by hosts that own their geometry
   *  document and can re-lay-out. When absent on a structural
   *  target, the size control is SUPPRESSED rather than offered
   *  inert, because a size override is layout input and applying
   *  it post-layout overlaps neighbours and invalidates routes. */
  onGeometryChange?: (nodeId: string, size: number) => void;
  /** R-16 (register, 2026-08-06): the channels this target's
   *  renderer can apply. Defaults to the renderer implied by the
   *  target form (canvas for ugm/nodeId, structural for `target`).
   *  Controls outside the set are not rendered. */
  channels?: readonly StyleChannel[];
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
  nodeId: nodeIdProp,
  target,
  onClose,
  className,
  onGeometryChange,
  channels: channelsProp,
}: NodeStyleEditorProps) {
  // R-12b: one resolved target, whichever form the caller used.
  const node =
    ugm !== undefined && nodeIdProp !== undefined
      ? ugm.getNode(nodeIdProp)
      : undefined;
  const nodeId = target?.id ?? nodeIdProp ?? "";
  const nodeType = target?.type ?? node?.types[0] ?? "Unknown";
  // Structural targets have no graph behind them, so size is only
  // offered when the host can act on it (R-12c option 2).
  const isStructuralTarget = target !== undefined && ugm === undefined;
  // R-16 (register, 2026-08-06): gate EVERY control on what the
  // target's renderer can apply, from one capability set, rather
  // than one channel at a time as each inapplicable one gets
  // reported. A reader opening this over a structural element was
  // offered a shape selector whose every choice did nothing.
  const channels =
    channelsProp ??
    (isStructuralTarget ? STRUCTURAL_STYLE_CHANNELS : CANVAS_STYLE_CHANNELS);
  const can = useCallback(
    (c: StyleChannel): boolean => channels.includes(c),
    [channels],
  );
  // Size is the one channel with a second condition: applicable in
  // principle on a structural target, but only when the host can
  // act on the geometry request (R-12c).
  const sizeEditable =
    can("size") || (isStructuralTarget && onGeometryChange !== undefined);
  // R-8 (upstream register, 2026-08-03): a multi-type node renders
  // as a PIE, which cytoscape draws as a circular overlay, so
  // MULTI_TYPE_PIE_RULES forces the ellipse. Offering a shape
  // control anyway produced two shapes at once, because an
  // element-scoped override outranks the rule. The control is
  // suppressed for pie nodes rather than left to fight the
  // renderer; consumers were re-asserting the ellipse on close.
  const isPieNode =
    target?.isPie ?? (node !== undefined && node.types.length > 1);
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
    if (shape && !isPieNode && can("shape")) override.shape = shape;
    // R-12c: on a structural target, size is REPORTED to the host
    // (which owns the geometry document and can re-lay-out) rather
    // than written into a presentational override the view would
    // have to honour by overlapping its neighbours.
    if (size !== 30) {
      if (isStructuralTarget) onGeometryChange?.(nodeId, size);
      else override.size = size;
    }
    if (selectedIcon && ICONS[selectedIcon] && can("icon")) {
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
    isPieNode,
    size,
    isStructuralTarget,
    onGeometryChange,
    can,
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
        width: "100%",
        boxSizing: "border-box",
        minWidth: 240,
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
          Any {nodeType}{" "}
          {/* LR-43: "Any Part" reads right where "All Part" did not */}
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
          {/* LR-42 (owner review 2026-07-22): a custom color wheel
              beside the presets: the native picker, styled as a
              swatch-sized well showing the current custom choice. */}
          <label
            data-testid="color-custom"
            title="Custom color"
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              border:
                color !== "" && !COLOR_PRESETS.includes(color)
                  ? "2px solid var(--g3t-text-primary)"
                  : "1px dashed var(--g3t-border)",
              cursor: "pointer",
              overflow: "hidden",
              position: "relative",
              background:
                color !== "" && !COLOR_PRESETS.includes(color)
                  ? color
                  : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
            }}
          >
            <input
              type="color"
              value={color !== "" && color.startsWith("#") ? color : "#888888"}
              onChange={(e) => setColor(e.target.value)}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                cursor: "pointer",
              }}
              aria-label="Custom color"
            />
          </label>
        </div>
      </div>

      {/* Shape (R-8: not offered for pie nodes; R-16: not offered
          where the renderer cannot apply it at all) */}
      {!can("shape") ? null : isPieNode ? (
        <div style={{ marginBottom: 12 }} data-testid="shape-suppressed">
          <div className="g3t-panel-title">Shape</div>
          <div
            style={{
              fontSize: 11,
              color: "var(--g3t-text-muted, #868e96)",
              lineHeight: 1.4,
            }}
          >
            Fixed to a circle: this node carries several types and renders as a
            pie.
          </div>
        </div>
      ) : (
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
      )}

      {/* Size (R-12c: layout input, not presentation) */}
      {sizeEditable ? (
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
      ) : (
        <div style={{ marginBottom: 12 }} data-testid="size-suppressed">
          <div className="g3t-panel-title">Size</div>
          <div
            style={{
              fontSize: 11,
              color: "var(--g3t-text-muted, #868e96)",
              lineHeight: 1.4,
            }}
          >
            Set by the layout on this view.
          </div>
        </div>
      )}

      {/* Icon (R-16: canvas-only; the structural view draws none) */}
      {can("icon") && (
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
      )}

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
