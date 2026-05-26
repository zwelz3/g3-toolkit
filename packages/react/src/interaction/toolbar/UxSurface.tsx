/**
 * UX Surface components (M8.5.E3-E4).
 *
 * HoverTooltip (E3.T1): Node/edge tooltip on mouseover.
 * ZoomControls (E3.T2): +, -, fit buttons.
 * Toolbar (E3.T3): Mode buttons, toggles.
 * StatusBar (E3.T4): Node/edge counts, zoom.
 * KeyboardShortcutModal (E4.T1): "?" key reference.
 */

import { useEffect } from "react";
import type { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";

// ── HoverTooltip (M8.5.E3.T1) ──────────────────────────────────────

export interface TooltipData {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  x: number;
  y: number;
}

export interface HoverTooltipProps {
  data: TooltipData | null;
}

export function HoverTooltip({ data }: HoverTooltipProps) {
  if (!data) return null;

  const propEntries = Object.entries(data.properties).slice(0, 5);

  return (
    <div
      data-testid="hover-tooltip"
      style={{
        position: "fixed",
        left: data.x + 12,
        top: data.y - 8,
        padding: "6px 10px",
        background: "var(--g3t-bg-primary, white)",
        border: "1px solid var(--g3t-border, #dee2e6)",
        borderRadius: 4,
        fontSize: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        zIndex: 1000,
        maxWidth: 280,
        pointerEvents: "none",
        color: "var(--g3t-text-primary, #212529)",
      }}
    >
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      <div style={{ color: "var(--g3t-text-muted, #868e96)", fontSize: 11 }}>
        {data.type}
      </div>
      {propEntries.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 11 }}>
          {propEntries.map(([k, v]) => (
            <div
              key={k}
              style={{ color: "var(--g3t-text-secondary, #495057)" }}
            >
              <span style={{ color: "var(--g3t-text-muted)" }}>{k}:</span>{" "}
              {String(v)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ZoomControls (M8.5.E3.T2) ───────────────────────────────────────

export interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  /**
   * Bugfix 19: optional slider for direct zoom-level control. When
   * provided, a vertical range input shows below the buttons; current
   * level shows as the thumb position. `min`/`max` bound the slider
   * (defaults: 0.1x to 4x). The component is uncontrolled past initial
   * sync: caller must update zoomLevel after cy.zoom changes (e.g.
   * pinch-zoom, wheel-zoom).
   */
  zoomLevel?: number;
  onZoomChange?: (level: number) => void;
  zoomMin?: number;
  zoomMax?: number;
  className?: string;
}

export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onFit,
  zoomLevel,
  onZoomChange,
  zoomMin = 0.1,
  zoomMax = 4,
  className,
}: ZoomControlsProps) {
  const btnStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--g3t-border, #dee2e6)",
    background: "var(--g3t-bg-primary, white)",
    color: "var(--g3t-text-primary, #212529)",
    cursor: "pointer",
    fontSize: 16,
  };

  const showSlider = zoomLevel !== undefined && onZoomChange !== undefined;

  return (
    <div
      data-testid="zoom-controls"
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: showSlider ? 6 : 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderRadius: 4,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        }}
      >
        <button
          data-testid="zoom-in"
          onClick={onZoomIn}
          style={btnStyle}
          title="Zoom in"
        >
          +
        </button>
        <button
          data-testid="zoom-out"
          onClick={onZoomOut}
          style={{ ...btnStyle, borderTop: "none" }}
          title="Zoom out"
        >
          −
        </button>
        <button
          data-testid="zoom-fit"
          onClick={onFit}
          style={{ ...btnStyle, borderTop: "none", fontSize: 12 }}
          title="Fit to screen"
        >
          ⊞
        </button>
      </div>
      {showSlider && (
        <input
          data-testid="zoom-slider"
          type="range"
          min={zoomMin}
          max={zoomMax}
          step={0.05}
          value={zoomLevel}
          onChange={(e) => onZoomChange!(Number(e.target.value))}
          title={`Zoom: ${Math.round(zoomLevel! * 100)}%`}
          aria-label="Zoom level"
          // Vertical-orientation hacks: writingMode + the legacy
          // -webkit-appearance: slider-vertical. The latter isn't in
          // React.CSSProperties' WebkitAppearance enum, so we build
          // the style object with `as React.CSSProperties` rather
          // than inline each property.
          style={
            {
              writingMode: "vertical-lr",
              WebkitAppearance: "slider-vertical",
              width: 24,
              height: 90,
              padding: 0,
              margin: 0,
              cursor: "ns-resize",
            } as React.CSSProperties
          }
        />
      )}
    </div>
  );
}

// ── Toolbar (M8.5.E3.T3) ───────────────────────────────────────────

export type CanvasMode = "select" | "pan";

export interface ToolbarProps {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  onLayoutTrigger?: () => void;
  onToggleEncoding?: () => void;
  onToggleFilter?: () => void;
  onThemeChange?: (themeId: string) => void;
  activeTheme?: string;
  className?: string;
}

export function Toolbar({
  mode,
  onModeChange,
  onLayoutTrigger,
  onToggleEncoding,
  onToggleFilter,
  onThemeChange,
  activeTheme = "light",
  className,
}: ToolbarProps) {
  const toolBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px",
    fontSize: 12,
    border: "1px solid var(--g3t-border, #dee2e6)",
    borderRadius: 4,
    background: active
      ? "var(--g3t-accent-primary, #2563eb)"
      : "var(--g3t-bg-primary, white)",
    color: active ? "white" : "var(--g3t-text-primary, #212529)",
    cursor: "pointer",
  });

  return (
    <div
      data-testid="toolbar"
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        background: "var(--g3t-bg-secondary, #f8f9fa)",
        borderBottom: "1px solid var(--g3t-border, #dee2e6)",
      }}
    >
      {/* Mode buttons */}
      <button
        data-testid="toolbar-select"
        onClick={() => onModeChange("select")}
        style={toolBtnStyle(mode === "select")}
        title="Selection mode"
      >
        ◇ Select
      </button>
      <button
        data-testid="toolbar-pan"
        onClick={() => onModeChange("pan")}
        style={toolBtnStyle(mode === "pan")}
        title="Pan mode"
      >
        ✥ Pan
      </button>

      <span style={{ width: 1, height: 20, background: "var(--g3t-border)" }} />

      {/* Layout */}
      {onLayoutTrigger && (
        <button
          data-testid="toolbar-layout"
          onClick={onLayoutTrigger}
          style={toolBtnStyle(false)}
          title="Re-run layout"
        >
          ⟳ Layout
        </button>
      )}

      {/* Toggles */}
      {onToggleFilter && (
        <button
          data-testid="toolbar-filter"
          onClick={onToggleFilter}
          style={toolBtnStyle(false)}
          title="Toggle filter panel"
        >
          ▽ Filter
        </button>
      )}
      {onToggleEncoding && (
        <button
          data-testid="toolbar-encoding"
          onClick={onToggleEncoding}
          style={toolBtnStyle(false)}
          title="Toggle encoding panel"
        >
          ◉ Encoding
        </button>
      )}

      <span style={{ flex: 1 }} />

      {/* Theme selector */}
      {onThemeChange && (
        <select
          data-testid="toolbar-theme"
          value={activeTheme}
          onChange={(e) => onThemeChange(e.target.value)}
          style={{ fontSize: 11, padding: "2px 4px" }}
        >
          <option value="light">☀ Light</option>
          <option value="dark">☾ Dark</option>
          <option value="high-contrast">◐ High Contrast</option>
        </select>
      )}
    </div>
  );
}

// ── StatusBar (M8.5.E3.T4) ──────────────────────────────────────────

export interface StatusBarProps {
  ugm: UGM;
  zoomLevel?: number;
  className?: string;
}

export function StatusBar({ ugm, zoomLevel, className }: StatusBarProps) {
  const { selectedNodeIds, selectedEdgeIds } = useSelectionStore();

  return (
    <div
      data-testid="status-bar"
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "2px 12px",
        fontSize: 11,
        color: "var(--g3t-text-muted, #868e96)",
        background: "var(--g3t-bg-secondary, #f8f9fa)",
        borderTop: "1px solid var(--g3t-border, #dee2e6)",
      }}
    >
      <span data-testid="status-nodes">Nodes: {ugm.nodeCount}</span>
      <span data-testid="status-edges">Edges: {ugm.edgeCount}</span>
      {selectedNodeIds.size > 0 && (
        <span data-testid="status-selection">
          Selected: {selectedNodeIds.size}
          {selectedEdgeIds.size > 0 && ` + ${selectedEdgeIds.size} edges`}
        </span>
      )}
      {zoomLevel !== undefined && (
        <span data-testid="status-zoom">
          Zoom: {Math.round(zoomLevel * 100)}%
        </span>
      )}
    </div>
  );
}

// ── KeyboardShortcutModal (M8.5.E4.T1) ──────────────────────────────

export interface KeyboardShortcutModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: "Click", action: "Select node/edge" },
  { keys: "Shift + Click", action: "Add to selection" },
  { keys: "Ctrl + Z", action: "Undo" },
  { keys: "Ctrl + Shift + Z", action: "Redo" },
  { keys: "Ctrl + Enter", action: "Execute query" },
  { keys: "Arrow Right", action: "Navigate to neighbor (a11y)" },
  { keys: "Arrow Left", action: "Previous node (a11y)" },
  { keys: "Tab", action: "Next focusable element" },
  { keys: "?", action: "Show this help" },
  { keys: "Escape", action: "Close dialog / deselect" },
  { keys: "Scroll", action: "Zoom canvas" },
  {
    keys: "Drag",
    action: "Pan canvas (pan mode) / Lasso select (select mode)",
  },
];

export function KeyboardShortcutModal({
  open,
  onClose,
}: KeyboardShortcutModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="shortcut-modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
    >
      <div
        data-testid="shortcut-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--g3t-bg-primary, white)",
          borderRadius: 8,
          padding: 24,
          maxWidth: 420,
          width: "90%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          color: "var(--g3t-text-primary, #212529)",
        }}
      >
        <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>
          Keyboard Shortcuts
        </h3>
        <table
          style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}
        >
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td
                  style={{
                    padding: "4px 8px",
                    fontFamily: "monospace",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                    color: "var(--g3t-accent-primary, #2563eb)",
                  }}
                >
                  {s.keys}
                </td>
                <td
                  style={{
                    padding: "4px 8px",
                    color: "var(--g3t-text-secondary, #495057)",
                  }}
                >
                  {s.action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: "right", marginTop: 12 }}>
          <button
            onClick={onClose}
            style={{
              padding: "6px 16px",
              fontSize: 12,
              border: "none",
              borderRadius: 4,
              background: "var(--g3t-accent-primary, #2563eb)",
              color: "white",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
