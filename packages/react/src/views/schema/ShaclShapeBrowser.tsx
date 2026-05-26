/**
 * ShaclShapeBrowser: browsable list of SHACL shapes with
 * validation badges (DE.2).
 *
 * Shows each shape with:
 * - Target class name
 * - Constraint summary (required/optional count)
 * - Validation badge (✓ all pass / ⚠ warnings / ✗ violations)
 * - Expandable: per-node results
 */

import { useState, useMemo } from "react";
import type { ShaclShape, ShaclValidationResult } from "@g3t/core";
import { summarizeValidation } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";

export interface ShaclShapeBrowserProps {
  shapes: ShaclShape[];
  validationResults: ShaclValidationResult[];
  onSelectShape?: (shapeId: string) => void;
  className?: string;
}

export function ShaclShapeBrowser({
  shapes,
  validationResults,
  onSelectShape,
  className,
}: ShaclShapeBrowserProps) {
  const [expandedShape, setExpandedShape] = useState<string | null>(null);
  const { selectNodes } = useSelectionStore();
  const summary = useMemo(
    () => summarizeValidation(validationResults),
    [validationResults],
  );

  const handleToggle = (shapeId: string) => {
    const next = expandedShape === shapeId ? null : shapeId;
    setExpandedShape(next);
    if (next) onSelectShape?.(next);
  };

  return (
    <div
      data-testid="shacl-shape-browser"
      className={className}
      style={{ fontSize: "var(--g3t-font-sm, 12px)" }}
    >
      {shapes.map((shape) => {
        const stats = summary.find((s) => s.shapeId === shape.id);
        const isExpanded = expandedShape === shape.id;
        const required = shape.properties.filter(
          (p) => p.minCount && p.minCount > 0,
        ).length;
        const optional = shape.properties.length - required;

        // Badge
        let badge: { label: string; color: string };
        if (!stats || stats.totalNodes === 0) {
          badge = { label: "—", color: "var(--g3t-text-muted)" };
        } else if (stats.failing === 0) {
          badge = { label: "✓", color: "#22c55e" };
        } else {
          badge = {
            label: `✗ ${stats.failing}`,
            color: "#ef4444",
          };
        }

        // Per-node results for this shape
        const nodeResults = validationResults.filter(
          (r) => r.shapeId === shape.id,
        );

        return (
          <div
            key={shape.id}
            data-testid={`shape-${shape.id}`}
            style={{
              borderBottom: "1px solid var(--g3t-border)",
              padding: "var(--g3t-space-2, 8px) 0",
            }}
          >
            {/* Shape header */}
            <button
              data-testid={`shape-toggle-${shape.id}`}
              onClick={() => handleToggle(shape.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                padding: "4px 0",
                fontFamily: "inherit",
                fontSize: 12,
                color: "var(--g3t-text-primary)",
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {isExpanded ? "▾" : "▸"} {shape.name ?? shape.id}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--g3t-text-muted)",
                }}
              >
                → {shape.targetClass}
              </span>
              <span style={{ flex: 1 }} />
              <span
                data-testid={`shape-badge-${shape.id}`}
                style={{
                  fontWeight: 600,
                  color: badge.color,
                  fontSize: 11,
                }}
              >
                {badge.label}
              </span>
            </button>

            {/* Constraint summary */}
            <div
              style={{
                paddingLeft: 16,
                fontSize: 10,
                color: "var(--g3t-text-muted)",
              }}
            >
              {required} required, {optional} optional
              {stats && stats.totalNodes > 0 && (
                <span>
                  {" "}
                  · {stats.passing}/{stats.totalNodes} pass
                </span>
              )}
            </div>

            {/* Expanded: per-node results */}
            {isExpanded && (
              <div
                style={{
                  paddingLeft: 16,
                  marginTop: 4,
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                {/* Constraint list */}
                <div
                  style={{
                    marginBottom: 6,
                    padding: "4px 8px",
                    background: "var(--g3t-bg-secondary)",
                    borderRadius: 4,
                  }}
                >
                  {shape.properties.map((prop) => (
                    <div
                      key={prop.path}
                      style={{
                        display: "flex",
                        gap: 4,
                        fontSize: 10,
                        padding: "1px 0",
                      }}
                    >
                      <span
                        style={{
                          color:
                            prop.minCount && prop.minCount > 0
                              ? "var(--g3t-text-primary)"
                              : "var(--g3t-text-muted)",
                        }}
                      >
                        {prop.minCount && prop.minCount > 0 ? "●" : "○"}{" "}
                        {prop.name ?? prop.path}
                      </span>
                      {prop.datatype && (
                        <span style={{ color: "var(--g3t-text-muted)" }}>
                          ({prop.datatype})
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Failing nodes */}
                {nodeResults
                  .filter((r) => !r.valid)
                  .map((r) => (
                    <div
                      key={r.nodeId}
                      data-testid={`violation-${r.nodeId}`}
                      style={{
                        padding: "3px 8px",
                        marginBottom: 2,
                        borderRadius: 3,
                        background: "#fef2f2",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                      onClick={() => selectNodes([r.nodeId])}
                    >
                      <div style={{ fontWeight: 500, color: "#991b1b" }}>
                        {r.nodeId}
                      </div>
                      {r.violations.map((v, i) => (
                        <div key={i} style={{ fontSize: 10, color: "#b91c1c" }}>
                          {v.message}
                        </div>
                      ))}
                    </div>
                  ))}

                {nodeResults.filter((r) => !r.valid).length === 0 && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "#22c55e",
                      padding: "4px 8px",
                    }}
                  >
                    All {stats?.totalNodes ?? 0} nodes pass validation.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
