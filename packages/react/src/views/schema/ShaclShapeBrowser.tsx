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
import { Icon } from "../../icons";

/** Local name of an IRI for compact display (full IRI via title). */
function localName(iri: string): string {
  const hash = iri.lastIndexOf("#");
  const slash = iri.lastIndexOf("/");
  const cut = Math.max(hash, slash);
  return cut >= 0 && cut < iri.length - 1 ? iri.slice(cut + 1) : iri;
}

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
        // Pass/fail differ by glyph as well as color (R7.8 extended to
        // badges, B4): icon + count, semantic theme colors.
        let badge: {
          icon: string | null;
          srLabel: string;
          count?: number;
          color: string;
        };
        if (!stats || stats.totalNodes === 0) {
          badge = {
            icon: null,
            srLabel: "Not validated",
            color: "var(--g3t-text-muted)",
          };
        } else if (stats.failing === 0) {
          badge = {
            icon: "check",
            srLabel: "All nodes pass",
            color: "var(--g3t-success, #22c55e)",
          };
        } else {
          badge = {
            icon: "close",
            srLabel: `${stats.failing} failing`,
            count: stats.failing,
            color: "var(--g3t-error, #ef4444)",
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
              className="g3t-panel-section-header"
            >
              <span style={{ fontWeight: 600 }}>
                <Icon
                  name={isExpanded ? "chevron-down" : "chevron-right"}
                  size={11}
                />{" "}
                {shape.name ?? shape.id}
                {shape.closed ? (
                  <span
                    data-testid={`shape-closed-${shape.id}`}
                    title="Closed shape (sh:closed): properties beyond those declared are violations"
                    style={{
                      color: "var(--g3t-text-muted)",
                      display: "inline-flex",
                      marginLeft: 4,
                    }}
                  >
                    <Icon name="lock" size={10} label="Closed shape" />
                  </span>
                ) : null}
              </span>
              <span
                title={shape.targetClass}
                style={{
                  fontSize: 10,
                  color: "var(--g3t-text-muted)",
                  // The full target IRI previously rendered unshrunk
                  // and pushed the badge out of narrow rails (review
                  // 3.6: "failing shape has no red X that I can
                  // see"). Local name + ellipsis; full IRI on hover.
                  minWidth: 0,
                  flexShrink: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                → {localName(shape.targetClass)}
              </span>
              <span style={{ flex: 1 }} />
              <span
                data-testid={`shape-badge-${shape.id}`}
                role="img"
                aria-label={badge.srLabel}
                style={{
                  fontWeight: 600,
                  color: badge.color,
                  fontSize: 11,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  // The badge is the row's point; it never yields.
                  flexShrink: 0,
                }}
              >
                {badge.icon ? <Icon name={badge.icon} size={11} /> : "—"}
                {badge.count !== undefined ? badge.count : null}
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
