/**
 * VisualEncodingManager: maps UGM properties to visual channels (M8.5.E2.T1).
 *
 * Framework-agnostic (D6). Produces Cytoscape stylesheet entries.
 *
 * EncodingPanel (M8.5.E2.T2): React UI for configuring encodings.
 * CanvasLegend (M8.5.E2.T3): auto-generated from active encoding.
 */

import { useCallback } from "react";
import type { UGM } from "@g3t/core";
import { useThemeStore } from "../../theme/ThemeManager";

// ── Encoding Configuration ──────────────────────────────────────────

export interface EncodingConfig {
  nodeSizeProperty: string | null;
  nodeSizeRange: [number, number];
  nodeColorProperty: string | null;
  edgeWidthProperty: string | null;
  edgeWidthRange: [number, number];
  nodeLabelProperty: string;
  edgeLabelProperty: string;
}

export const DEFAULT_ENCODING: EncodingConfig = {
  nodeSizeProperty: null,
  nodeSizeRange: [20, 60],
  nodeColorProperty: null,
  edgeWidthProperty: null,
  edgeWidthRange: [1, 8],
  nodeLabelProperty: "name",
  edgeLabelProperty: "type",
};

// ── Manager class (P3.1) ────────────────────────────────────────────

/**
 * Stateful manager for visual-encoding configuration (P3.1).
 *
 * Holds an EncodingConfig and provides a `toCytoscapeStyle()` method
 * that translates the current config to a Cytoscape stylesheet for
 * the given UGM and type palette. Lets callers `update()` the config
 * incrementally without re-passing the whole config each time.
 *
 * @example
 *   const mgr = new VisualEncodingManager();
 *   mgr.update({ nodeSizeProperty: "weight" });
 *   const styles = mgr.toCytoscapeStyle(ugm, palette);
 */
export class VisualEncodingManager {
  constructor(public config: EncodingConfig = { ...DEFAULT_ENCODING }) {}

  /** Replace a subset of the encoding config; unspecified keys are preserved. */
  update(patch: Partial<EncodingConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  /** Compute the Cytoscape stylesheet for the given UGM. */
  toCytoscapeStyle(ugm: UGM, typePalette: string[]): Record<string, unknown>[] {
    return encodingToCytoscapeStyle(this.config, ugm, typePalette);
  }
}

// ── Stylesheet Generation ───────────────────────────────────────────

export function encodingToCytoscapeStyle(
  encoding: EncodingConfig,
  ugm: UGM,
  typePalette: string[],
): Record<string, unknown>[] {
  const styles: Record<string, unknown>[] = [];

  // Type-based coloring (per node)
  const registry = ugm.getRegistry();
  const typeList = [...registry.nodeTypes];
  typeList.forEach((type, i) => {
    styles.push({
      selector: `node[_type = "${type}"]`,
      style: {
        "background-color": typePalette[i % typePalette.length],
      },
    });
  });

  // Size mapping
  if (encoding.nodeSizeProperty) {
    const { min, max } = getPropertyRange(ugm, encoding.nodeSizeProperty);
    if (max > min) {
      styles.push({
        selector: "node",
        style: {
          width: `mapData(${encoding.nodeSizeProperty}, ${min}, ${max}, ${encoding.nodeSizeRange[0]}, ${encoding.nodeSizeRange[1]})`,
          height: `mapData(${encoding.nodeSizeProperty}, ${min}, ${max}, ${encoding.nodeSizeRange[0]}, ${encoding.nodeSizeRange[1]})`,
        },
      });
    }
  }

  // Edge width mapping
  if (encoding.edgeWidthProperty) {
    const { min, max } = getEdgePropertyRange(ugm, encoding.edgeWidthProperty);
    if (max > min) {
      styles.push({
        selector: "edge",
        style: {
          width: `mapData(${encoding.edgeWidthProperty}, ${min}, ${max}, ${encoding.edgeWidthRange[0]}, ${encoding.edgeWidthRange[1]})`,
        },
      });
    }
  }

  // Labels
  styles.push({
    selector: "node",
    style: { label: `data(${encoding.nodeLabelProperty})` },
  });

  if (encoding.edgeLabelProperty) {
    styles.push({
      selector: "edge",
      style: { label: `data(${encoding.edgeLabelProperty})` },
    });
  }

  return styles;
}

function getPropertyRange(ugm: UGM, key: string): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  ugm.forEachNode((_id, attrs) => {
    const val = attrs.properties[key];
    if (typeof val === "number") {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  });
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 1 : max };
}

function getEdgePropertyRange(
  ugm: UGM,
  key: string,
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  ugm.forEachEdge((_id, attrs) => {
    const val = attrs.properties[key];
    if (typeof val === "number") {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  });
  return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 1 : max };
}

// ── EncodingPanel (M8.5.E2.T2) ─────────────────────────────────────

export interface EncodingPanelProps {
  ugm: UGM;
  encoding: EncodingConfig;
  onChange: (encoding: EncodingConfig) => void;
  className?: string;
}

export function EncodingPanel({
  ugm,
  encoding,
  onChange,
  className,
}: EncodingPanelProps) {
  const registry = ugm.getRegistry();
  const propKeys = ["(none)", ...registry.nodePropertyKeys];

  const update = useCallback(
    (partial: Partial<EncodingConfig>) => {
      onChange({ ...encoding, ...partial });
    },
    [encoding, onChange],
  );

  return (
    <div
      data-testid="encoding-panel"
      className={className}
      style={{
        padding: 8,
        fontSize: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: "var(--g3t-bg-secondary, #f8f9fa)",
        borderRadius: 4,
      }}
    >
      <div style={{ fontWeight: 600, color: "var(--g3t-text-primary)" }}>
        Visual Encoding
      </div>

      {/* Node Size */}
      <label data-testid="encoding-node-size">
        <span style={{ color: "var(--g3t-text-secondary)" }}>Node size:</span>
        <select
          value={encoding.nodeSizeProperty ?? "(none)"}
          onChange={(e) =>
            update({
              nodeSizeProperty:
                e.target.value === "(none)" ? null : e.target.value,
            })
          }
          style={{ marginLeft: 4, fontSize: 11 }}
        >
          {propKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      {/* Node Color */}
      <label data-testid="encoding-node-color">
        <span style={{ color: "var(--g3t-text-secondary)" }}>Node color:</span>
        <select
          value={encoding.nodeColorProperty ?? "(none)"}
          onChange={(e) =>
            update({
              nodeColorProperty:
                e.target.value === "(none)" ? null : e.target.value,
            })
          }
          style={{ marginLeft: 4, fontSize: 11 }}
        >
          {propKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      {/* Edge Width */}
      <label data-testid="encoding-edge-width">
        <span style={{ color: "var(--g3t-text-secondary)" }}>Edge width:</span>
        <select
          value={encoding.edgeWidthProperty ?? "(none)"}
          onChange={(e) =>
            update({
              edgeWidthProperty:
                e.target.value === "(none)" ? null : e.target.value,
            })
          }
          style={{ marginLeft: 4, fontSize: 11 }}
        >
          <option value="(none)">(none)</option>
          <option value="confidence">confidence</option>
          <option value="weight">weight</option>
        </select>
      </label>

      {/* Node Label */}
      <label data-testid="encoding-node-label">
        <span style={{ color: "var(--g3t-text-secondary)" }}>Node label:</span>
        <select
          value={encoding.nodeLabelProperty}
          onChange={(e) => update({ nodeLabelProperty: e.target.value })}
          style={{ marginLeft: 4, fontSize: 11 }}
        >
          {[...registry.nodePropertyKeys].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// ── CanvasLegend (M8.5.E2.T3) ───────────────────────────────────────

export interface CanvasLegendProps {
  ugm: UGM;
  encoding: EncodingConfig;
  className?: string;
}

export function CanvasLegend({ ugm, encoding, className }: CanvasLegendProps) {
  const { theme } = useThemeStore();
  const registry = ugm.getRegistry();
  const typeList = [...registry.nodeTypes];

  return (
    <div
      data-testid="canvas-legend"
      className={className}
      style={{
        padding: 8,
        fontSize: 11,
        background: "var(--g3t-bg-secondary, #f8f9fa)",
        border: "1px solid var(--g3t-border, #dee2e6)",
        borderRadius: 4,
      }}
    >
      {/* Type-color mapping */}
      <div
        style={{
          fontWeight: 600,
          marginBottom: 4,
          color: "var(--g3t-text-primary)",
        }}
      >
        Types
      </div>
      {typeList.map((type, i) => (
        <div
          key={type}
          data-testid={`legend-type-${type}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: theme.typePalette[i % theme.typePalette.length],
              display: "inline-block",
              border: `1px solid var(--g3t-node-stroke, #495057)`,
            }}
          />
          <span style={{ color: "var(--g3t-text-secondary)" }}>{type}</span>
        </div>
      ))}

      {/* Size scale */}
      {encoding.nodeSizeProperty && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontWeight: 600,
              marginBottom: 2,
              color: "var(--g3t-text-primary)",
            }}
          >
            Size: {encoding.nodeSizeProperty}
          </div>
          <div
            data-testid="legend-size-scale"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <span
              style={{
                width: encoding.nodeSizeRange[0] / 3,
                height: encoding.nodeSizeRange[0] / 3,
                borderRadius: "50%",
                background: "var(--g3t-text-muted)",
              }}
            />
            <span style={{ fontSize: 10, color: "var(--g3t-text-muted)" }}>
              min
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: "var(--g3t-text-muted)" }}>
              max
            </span>
            <span
              style={{
                width: encoding.nodeSizeRange[1] / 3,
                height: encoding.nodeSizeRange[1] / 3,
                borderRadius: "50%",
                background: "var(--g3t-text-muted)",
              }}
            />
          </div>
        </div>
      )}

      {/* Line style meanings */}
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontWeight: 600,
            marginBottom: 2,
            color: "var(--g3t-text-primary)",
          }}
        >
          Edges
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 20,
              borderBottom: "2px solid var(--g3t-edge-color)",
            }}
          />
          <span style={{ color: "var(--g3t-text-secondary)" }}>Asserted</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 20,
              borderBottom: "2px dashed var(--g3t-edge-color)",
            }}
          />
          <span style={{ color: "var(--g3t-text-secondary)" }}>Inferred</span>
        </div>
      </div>
    </div>
  );
}
