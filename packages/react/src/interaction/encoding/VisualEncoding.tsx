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

  // Size mapping.
  // Bugfix 12: scope the mapping with `[<property>]` so cytoscape
  // only applies it to nodes that actually have the property. Without
  // this, every node without the property triggers
  //   "Do not assign mappings to elements without corresponding data"
  // We also skip entirely when no node has a numeric value for the
  // property (getPropertyRange returns null), which fixes
  //   "Do not use continuous mappers without specifying numeric data"
  // that fired when a user picked a non-numeric property (e.g. asn).
  if (encoding.nodeSizeProperty) {
    const range = getPropertyRange(ugm, encoding.nodeSizeProperty);
    if (range && range.max > range.min) {
      const prop = encoding.nodeSizeProperty;
      styles.push({
        selector: `node[${prop}]`,
        style: {
          width: `mapData(${prop}, ${range.min}, ${range.max}, ${encoding.nodeSizeRange[0]}, ${encoding.nodeSizeRange[1]})`,
          height: `mapData(${prop}, ${range.min}, ${range.max}, ${encoding.nodeSizeRange[0]}, ${encoding.nodeSizeRange[1]})`,
        },
      });
    }
  }

  // Edge width mapping (same fix)
  if (encoding.edgeWidthProperty) {
    const range = getEdgePropertyRange(ugm, encoding.edgeWidthProperty);
    if (range && range.max > range.min) {
      const prop = encoding.edgeWidthProperty;
      styles.push({
        selector: `edge[${prop}]`,
        style: {
          width: `mapData(${prop}, ${range.min}, ${range.max}, ${encoding.edgeWidthRange[0]}, ${encoding.edgeWidthRange[1]})`,
        },
      });
    }
  }

  // Labels: also use property-presence selector so nodes/edges
  // without the label property don't get an empty label.
  styles.push({
    selector: `node[${encoding.nodeLabelProperty}]`,
    style: { label: `data(${encoding.nodeLabelProperty})` },
  });

  if (encoding.edgeLabelProperty) {
    styles.push({
      selector: `edge[${encoding.edgeLabelProperty}]`,
      style: { label: `data(${encoding.edgeLabelProperty})` },
    });
  }

  return styles;
}

function getPropertyRange(
  ugm: UGM,
  key: string,
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  let foundNumeric = false;
  ugm.forEachNode((_id, attrs) => {
    const val = attrs.properties[key];
    if (typeof val === "number" && Number.isFinite(val)) {
      foundNumeric = true;
      if (val < min) min = val;
      if (val > max) max = val;
    }
  });
  // Bugfix 12: signal "no usable data" via null. Previously we returned
  // fallback {0, 1} which caused cytoscape to apply mapData() to
  // non-numeric values and warn loudly.
  if (!foundNumeric) return null;
  return { min, max };
}

function getEdgePropertyRange(
  ugm: UGM,
  key: string,
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  let foundNumeric = false;
  ugm.forEachEdge((_id, attrs) => {
    const val = attrs.properties[key];
    if (typeof val === "number" && Number.isFinite(val)) {
      foundNumeric = true;
      if (val < min) min = val;
      if (val > max) max = val;
    }
  });
  if (!foundNumeric) return null;
  return { min, max };
}

// ── EncodingPanel (M8.5.E2.T2) ─────────────────────────────────────

export interface EncodingPanelProps {
  ugm: UGM;
  encoding: EncodingConfig;
  onChange: (encoding: EncodingConfig) => void;
  className?: string;
}

/** @deprecated Use EncodingSpecPanel over an EncodingSpec
 *  (fromLegacyConfig lifts this config). No in-repo consumers remain
 *  as of visual round 13 (shells and DemoApp migrated); kept for
 *  external API stability, removal scheduled for the next major. */
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
      <div className="g3t-panel-section-header" style={{ cursor: "default" }}>
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
      <div className="g3t-panel-section-header" style={{ cursor: "default" }}>
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
