/**
 * LayoutManager: comprehensive layout controls with per-layout parameters.
 *
 * Each layout type exposes its own tuning parameters:
 * - Force: repulsion, gravity, edge length
 * - Hierarchy: direction, level spacing, node spacing
 * - Dagre: rank direction, node separation, rank separation
 * - ELK: algorithm variant, node spacing, layer spacing
 * - Circle/Grid/Concentric: spacing, sort property
 */

import { useState, useCallback, useRef, useEffect } from "react";

// ── Types ───────────────────────────────────────────────────────

export interface LayoutOptions {
  // Global
  animate: boolean;
  animationDuration: number;
  edgeStyle: "bezier" | "straight" | "taxi";

  // Force
  nodeRepulsion: number;
  gravity: number;
  edgeLength: number;

  // Hierarchy / Dagre / ELK
  direction: "TB" | "BT" | "LR" | "RL";
  nodeSeparation: number;
  rankSeparation: number;

  // Circle / Grid / Concentric
  spacing: number;
}

export interface LayoutManagerProps {
  activeLayout?: string;
  onLayoutChange: (layoutName: string, options: LayoutOptions) => void;
  onResetLayout: () => void;
  onFreezeLayout?: (frozen: boolean) => void;
  className?: string;
}

// ── Layout Definitions ──────────────────────────────────────────

export interface LayoutDef {
  id: string;
  label: string;
  group: "force" | "hierarchical" | "simple";
}

/** Selectable engines. Dagre and ELK were removed (round 15 review):
 *  both silently degraded to breadthfirst, which misleads. Dagre
 *  returns when the extension is bundled; ELK returns paired with
 *  compound/UML-element-container rendering, where layered layouts
 *  earn their keep (roadmap/design/toolbar-and-layouts.md). */
export const LAYOUTS: LayoutDef[] = [
  { id: "force", label: "Force-Directed", group: "force" },
  { id: "hierarchy", label: "Hierarchy", group: "hierarchical" },
  { id: "circle", label: "Circle", group: "simple" },
  { id: "grid", label: "Grid", group: "simple" },
  { id: "concentric", label: "Concentric", group: "simple" },
];

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  animate: true,
  animationDuration: 400,
  edgeStyle: "bezier",
  nodeRepulsion: 8000,
  gravity: 0.25,
  edgeLength: 80,
  direction: "TB",
  nodeSeparation: 50,
  rankSeparation: 80,
  spacing: 60,
};

// ── Component ───────────────────────────────────────────────────

export function LayoutManager({
  activeLayout: initialLayout = "force",
  onLayoutChange,
  onResetLayout,
  onFreezeLayout,
  className,
}: LayoutManagerProps) {
  const [layout, setLayout] = useState(initialLayout);
  const [options, setOptions] = useState<LayoutOptions>(DEFAULT_LAYOUT_OPTIONS);
  const [frozen, setFrozen] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const activeEntry = LAYOUTS.find((l) => l.id === layout);

  const handleLayoutChange = useCallback(
    (newLayout: string) => {
      setLayout(newLayout);
      onLayoutChange(newLayout, options);
    },
    [options, onLayoutChange],
  );

  // Round-15 layout pass: committing on EVERY option tick re-ran the
  // layout dozens of times during a single slider drag (layout runs
  // fighting each other mid-animation). Display updates immediately;
  // the engine re-run commits after the drag settles.
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = useCallback(
    (key: keyof LayoutOptions, value: number | boolean | string) => {
      const updated = { ...options, [key]: value };
      setOptions(updated);
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(
        () => onLayoutChange(layout, updated),
        250,
      );
    },
    [options, layout, onLayoutChange],
  );
  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    },
    [],
  );

  const handleReset = useCallback(() => {
    setOptions(DEFAULT_LAYOUT_OPTIONS);
    onLayoutChange(layout, DEFAULT_LAYOUT_OPTIONS);
    onResetLayout();
  }, [layout, onLayoutChange, onResetLayout]);

  const handleFreeze = useCallback(() => {
    const next = !frozen;
    setFrozen(next);
    onFreezeLayout?.(next);
  }, [frozen, onFreezeLayout]);

  return (
    <div
      data-testid="layout-manager"
      className={className}
      style={{ fontSize: 12, padding: 8 }}
    >
      {/* Layout selector */}
      <div className="g3t-panel-title">Layout</div>
      <select
        data-testid="layout-select"
        value={layout}
        onChange={(e) => handleLayoutChange(e.target.value)}
        style={{
          width: "100%",
          padding: "4px 6px",
          fontSize: 12,
          border: "1px solid var(--g3t-border)",
          borderRadius: 4,
          background: "var(--g3t-bg-primary)",
          color: "var(--g3t-text-primary)",
          marginBottom: 6,
        }}
      >
        {LAYOUTS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>

      {/* Action row */}
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        <button
          data-testid="layout-reset"
          className="g3t-btn g3t-btn-ghost"
          onClick={handleReset}
          style={{ flex: 1, fontSize: 11, padding: "3px 8px" }}
        >
          Reset
        </button>
        <button
          data-testid="layout-freeze"
          className={`g3t-btn ${frozen ? "g3t-btn-active" : "g3t-btn-ghost"}`}
          onClick={handleFreeze}
          style={{ flex: 1, fontSize: 11, padding: "3px 8px" }}
        >
          {frozen ? "Unfreeze" : "Freeze"}
        </button>
      </div>

      {/* Global: animate + edge style */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 6,
          alignItems: "center",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
          }}
        >
          <input
            type="checkbox"
            checked={options.animate}
            onChange={(e) => update("animate", e.target.checked)}
          />
          Animate
        </label>
        <select
          data-testid="edge-style-select"
          value={options.edgeStyle}
          onChange={(e) => update("edgeStyle", e.target.value)}
          style={{
            fontSize: 11,
            padding: "2px 4px",
            border: "1px solid var(--g3t-border)",
            borderRadius: 3,
          }}
        >
          <option value="bezier">Curved</option>
          <option value="straight">Straight</option>
          <option value="taxi">Orthogonal</option>
        </select>
      </div>

      {/* Per-layout controls */}
      <button
        className="g3t-btn g3t-btn-ghost"
        onClick={() => setShowControls(!showControls)}
        style={{
          fontSize: 10,
          padding: "2px 6px",
          marginBottom: 4,
          width: "100%",
        }}
      >
        {showControls ? "▾" : "▸"} {activeEntry?.label} Parameters
      </button>

      {showControls && (
        <div
          style={{
            padding: 8,
            background: "var(--g3t-bg-secondary)",
            borderRadius: 4,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {/* Force controls */}
          {activeEntry?.group === "force" && (
            <>
              <Slider
                label="Repulsion"
                value={options.nodeRepulsion}
                min={1000}
                max={20000}
                step={500}
                onChange={(v) => update("nodeRepulsion", v)}
              />
              <Slider
                label="Gravity"
                value={options.gravity}
                min={0.05}
                max={1.0}
                step={0.05}
                onChange={(v) => update("gravity", v)}
              />
              <Slider
                label="Edge Length"
                value={options.edgeLength}
                min={30}
                max={200}
                step={10}
                onChange={(v) => update("edgeLength", v)}
              />
            </>
          )}

          {/* Hierarchical controls (Hierarchy, Dagre, ELK) */}
          {activeEntry?.group === "hierarchical" && (
            <>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--g3t-text-muted)",
                    marginBottom: 2,
                  }}
                >
                  Direction
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  {(["TB", "BT", "LR", "RL"] as const).map((d) => (
                    <button
                      key={d}
                      data-testid={`direction-${d}`}
                      className={`g3t-btn ${options.direction === d ? "g3t-btn-active" : "g3t-btn-ghost"}`}
                      onClick={() => update("direction", d)}
                      style={{ flex: 1, fontSize: 10, padding: "3px 0" }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <Slider
                label="Node Separation"
                value={options.nodeSeparation}
                min={20}
                max={150}
                step={5}
                onChange={(v) => update("nodeSeparation", v)}
              />
              <Slider
                label="Rank Separation"
                value={options.rankSeparation}
                min={30}
                max={200}
                step={10}
                onChange={(v) => update("rankSeparation", v)}
              />
            </>
          )}

          {/* Simple layout controls (Circle, Grid, Concentric) */}
          {activeEntry?.group === "simple" && (
            <Slider
              label="Spacing"
              value={options.spacing}
              min={20}
              max={150}
              step={5}
              onChange={(v) => update("spacing", v)}
            />
          )}

          {/* Animation duration (all layouts) */}
          <Slider
            label="Animation (ms)"
            value={options.animationDuration}
            min={100}
            max={1500}
            step={100}
            onChange={(v) => update("animationDuration", v)}
          />
        </div>
      )}
    </div>
  );
}

// ── Slider helper ───────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--g3t-text-muted)",
          marginBottom: 2,
        }}
      >
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", cursor: "pointer" }}
      />
    </div>
  );
}
