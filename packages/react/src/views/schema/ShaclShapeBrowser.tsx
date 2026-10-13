/**
 * ShaclShapeBrowser: browsable list of SHACL shapes with
 * validation badges (DE.2).
 *
 * Shows each shape with:
 * - Target class name (and every other declared target)
 * - Constraint summary (required/optional count)
 * - Validation badge (✓ all pass / ⚠ warnings / ✗ violations)
 * - Expandable: per-node results
 */

import { useState, useMemo } from "react";
import type {
  ShaclSeverity,
  ShaclShape,
  ShaclShapeTarget,
  ShaclValidationResult,
} from "@g3-toolkit/core";
import { summarizeValidation } from "@g3-toolkit/core";
import { useSelectionStore } from "../../state/selection-store";
import { Icon } from "../../icons";
import { viewClass } from "../../theme/view-class";

/** Local name of an IRI for compact display (full IRI via title). */
function localName(iri: string): string {
  const hash = iri.lastIndexOf("#");
  const slash = iri.lastIndexOf("/");
  const cut = Math.max(hash, slash);
  return cut >= 0 && cut < iri.length - 1 ? iri.slice(cut + 1) : iri;
}

/** Most severe first, so the badge reports the worst tier present. */
const SEVERITY_RANK: Record<ShaclSeverity, number> = {
  violation: 3,
  warning: 2,
  info: 1,
};

function worstOf(a: ShaclSeverity | null, b: ShaclSeverity): ShaclSeverity {
  return a && SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/**
 * Severity tier -> theme token. The vocabulary (docs/design-tokens.md)
 * has error and warning tokens but no info token; the canvas overlay
 * tones draw info in theme.accentPrimary, so the badge follows that
 * mapping rather than inventing a name the gate would reject.
 */
const SEVERITY_COLOR: Record<ShaclSeverity, string> = {
  violation: "var(--g3t-error, #ef4444)",
  warning: "var(--g3t-warning, #eab308)",
  info: "var(--g3t-accent-primary, #1971c2)",
};

/** Failing-row surface per tier. The muted tokens are optional on a
 *  custom theme, so each carries its fallback (design-tokens.md). */
const SEVERITY_SURFACE: Record<ShaclSeverity, string> = {
  violation: "var(--g3t-error-muted, rgba(239, 68, 68, 0.12))",
  warning: "var(--g3t-warning-muted, rgba(234, 179, 8, 0.12))",
  info: "var(--g3t-accent-muted, rgba(25, 113, 194, 0.12))",
};

/** Failure glyph per tier: color is never the only carrier (R7.8). */
const SEVERITY_ICON: Record<ShaclSeverity, string> = {
  violation: "close",
  warning: "warning",
  info: "info",
};

/** Host-supplied per-shape totals, for a report already aggregated
 *  elsewhere (pyshacl, Jena, a SPARQL COUNT). `focus` is the number of
 *  focus nodes the shape targeted; `failing` how many did not conform.
 *  `bySeverity` counts results per tier and decides the badge tier;
 *  absent, the tier is read from `validationResults` for that shape. */
export interface ShaclShapeSummary {
  focus: number;
  failing: number;
  bySeverity?: Partial<Record<ShaclSeverity, number>>;
}

export interface ShaclShapeBrowserProps {
  shapes: ShaclShape[];
  validationResults: ShaclValidationResult[];
  /** Per-shape totals keyed by shape id. When a shape has an entry it
   *  takes precedence over counting `validationResults`, so a host
   *  with an aggregated report need not invent one placeholder result
   *  per passing focus node to get the totals right. */
  summary?: Record<string, ShaclShapeSummary>;
  /** Controlled selection: the shape to show as selected and expanded
   *  (a deep link, for instance). `null` means none. When this prop is
   *  present the browser never keeps its own expanded state; pass
   *  `onSelectShape` and feed the id back. Absent, the browser is
   *  uncontrolled, as before. */
  selectedShape?: string | null;
  /** Called when the user picks (or, controlled, collapses) a shape.
   *  Uncontrolled: fires with the id on expand only, the original
   *  contract. Controlled: also fires with `null` when the selected
   *  shape is collapsed, so the host can clear its state.
   *
   *  Declared as a method signature on purpose: method parameters are
   *  bivariant under strictFunctionTypes, so a host that typed its
   *  handler as `(id: string) => void` before `null` existed keeps
   *  compiling. Uncontrolled hosts never receive `null`. */
  onSelectShape?(shapeId: string | null): void;
  className?: string;
}

/** Every target a shape declares, `targetClass` first, with a duplicate
 *  class entry in `targets` folded away so it is not drawn twice. A
 *  shape with no class target (subjects-of only, SPARQL only, or no
 *  target at all) leaves `targetClass` absent (#67) or, from a host on
 *  the older required type, passes `""` (#54); both mean no class
 *  target and contribute no entry. */
function targetsOf(shape: ShaclShape): ShaclShapeTarget[] {
  const targetClass = shape.targetClass ?? "";
  const out: ShaclShapeTarget[] = [];
  if (targetClass !== "") {
    out.push({ kind: "class", value: targetClass });
  }
  for (const t of shape.targets ?? []) {
    if (t.kind === "class" && t.value === targetClass) continue;
    out.push(t);
  }
  return out;
}

function targetLabel(t: ShaclShapeTarget): string {
  switch (t.kind) {
    case "class":
      return localName(t.value);
    case "subjectsOf":
      return `subjects of ${localName(t.value)}`;
    case "objectsOf":
      return `objects of ${localName(t.value)}`;
    case "node":
      return `node ${localName(t.value)}`;
    case "sparql":
      return "SPARQL target";
  }
}

function targetTitle(t: ShaclShapeTarget): string {
  switch (t.kind) {
    case "class":
      return `sh:targetClass ${t.value}`;
    case "subjectsOf":
      return `sh:targetSubjectsOf ${t.value}`;
    case "objectsOf":
      return `sh:targetObjectsOf ${t.value}`;
    case "node":
      return `sh:targetNode ${t.value}`;
    case "sparql":
      return `sh:target (SPARQL)\n${t.value}`;
  }
}

export function ShaclShapeBrowser({
  shapes,
  validationResults,
  summary: hostSummary,
  selectedShape,
  onSelectShape,
  className,
}: ShaclShapeBrowserProps) {
  const [expandedState, setExpandedState] = useState<string | null>(null);
  // Controlled when the prop is present (null included): the expanded
  // row then follows the host's selection, so a deep-linked shape
  // opens expanded without the host also tracking an expand state.
  const isControlled = selectedShape !== undefined;
  const expandedShape = isControlled ? selectedShape : expandedState;
  const { selectNodes } = useSelectionStore();
  const summary = useMemo(
    () => summarizeValidation(validationResults),
    [validationResults],
  );
  // Worst severity per shape, read once from the results rather than
  // per row. A host summary with `bySeverity` overrides this below.
  const worstByShape = useMemo(() => {
    const worst = new Map<string, ShaclSeverity>();
    for (const r of validationResults) {
      if (r.valid) continue;
      for (const v of r.violations) {
        worst.set(r.shapeId, worstOf(worst.get(r.shapeId) ?? null, v.severity));
      }
    }
    return worst;
  }, [validationResults]);

  const handleToggle = (shapeId: string) => {
    const next = expandedShape === shapeId ? null : shapeId;
    if (isControlled) {
      onSelectShape?.(next);
    } else {
      setExpandedState(next);
      if (next) onSelectShape?.(next);
    }
  };

  return (
    <div
      data-testid="shacl-shape-browser"
      className={viewClass(className)}
      style={{ fontSize: "var(--g3t-font-sm, 12px)" }}
    >
      {shapes.map((shape) => {
        // Host totals win over counted results for this shape.
        const hosted = hostSummary?.[shape.id];
        const counted = summary.find((s) => s.shapeId === shape.id);
        const stats = hosted
          ? {
              totalNodes: hosted.focus,
              failing: hosted.failing,
              passing: Math.max(0, hosted.focus - hosted.failing),
            }
          : counted
            ? {
                totalNodes: counted.totalNodes,
                failing: counted.failing,
                passing: counted.passing,
              }
            : undefined;
        const isExpanded = expandedShape === shape.id;
        const required = shape.properties.filter(
          (p) => p.minCount && p.minCount > 0,
        ).length;
        const optional = shape.properties.length - required;

        // Worst tier present: host bySeverity first, then the results.
        // A host that reports failures without either falls back to
        // violation, the conservative reading.
        let worst: ShaclSeverity | null = null;
        if (hosted?.bySeverity) {
          for (const tier of ["violation", "warning", "info"] as const) {
            if ((hosted.bySeverity[tier] ?? 0) > 0) {
              worst = tier;
              break;
            }
          }
        }
        worst = worst ?? worstByShape.get(shape.id) ?? null;

        // Badge
        // Pass/fail differ by glyph as well as color (R7.8 extended to
        // badges, B4): icon + count, semantic theme colors. The failure
        // glyph and color follow the worst tier, so a warning-only
        // shape is not drawn as if it had violations.
        let badge: {
          icon: string | null;
          srLabel: string;
          count?: number;
          color: string;
          severity?: ShaclSeverity;
          state: "not-validated" | "no-focus-nodes" | "pass" | "fail";
        };
        if (!stats) {
          // No summary entry and no results: nothing ran for this shape.
          badge = {
            icon: null,
            srLabel: "Not validated",
            color: "var(--g3t-text-muted)",
            state: "not-validated",
          };
        } else if (stats.totalNodes === 0) {
          // The shape ran and its targets matched nothing (#55). Only a
          // host summary can say so: counted results always carry at
          // least one focus node. Neutral, not a pass and not idle.
          badge = {
            icon: "minus",
            srLabel: "No focus nodes",
            color: "var(--g3t-text-muted)",
            state: "no-focus-nodes",
          };
        } else if (stats.failing === 0) {
          badge = {
            icon: "check",
            srLabel: "All nodes pass",
            color: "var(--g3t-success, #22c55e)",
            state: "pass",
          };
        } else {
          const tier = worst ?? "violation";
          badge = {
            icon: SEVERITY_ICON[tier],
            srLabel: `${stats.failing} failing`,
            count: stats.failing,
            color: SEVERITY_COLOR[tier],
            severity: tier,
            state: "fail",
          };
        }

        // Per-node results for this shape
        const nodeResults = validationResults.filter(
          (r) => r.shapeId === shape.id,
        );
        const targets = targetsOf(shape);

        return (
          <div
            key={shape.id}
            data-testid={`shape-${shape.id}`}
            data-selected={isExpanded ? "true" : undefined}
            style={{
              borderBottom: "1px solid var(--g3t-border)",
              padding: "var(--g3t-space-2, 8px) 0",
            }}
          >
            {/* Shape header */}
            <button
              data-testid={`shape-toggle-${shape.id}`}
              onClick={() => handleToggle(shape.id)}
              aria-expanded={isExpanded}
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
              {/* No declared target: no arrow either, so the header
                  does not dangle one at nothing (#54). */}
              {targets.length > 0 ? (
                <span
                  data-testid={`shape-targets-${shape.id}`}
                  title={targets.map(targetTitle).join("\n")}
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
                  →{" "}
                  {targets.map((t, i) => (
                    <span
                      key={`${t.kind}:${t.value}`}
                      data-target-kind={t.kind}
                    >
                      {i > 0 ? ", " : ""}
                      {targetLabel(t)}
                    </span>
                  ))}
                </span>
              ) : null}
              <span style={{ flex: 1 }} />
              <span
                data-testid={`shape-badge-${shape.id}`}
                data-severity={badge.severity}
                data-state={badge.state}
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
              {stats && stats.totalNodes === 0 && <span> · 0 focus nodes</span>}
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
                  {shape.properties.map((prop, i) => (
                    // One shape may constrain a path twice (two
                    // property shapes on one predicate), so `path` is
                    // not a key. The property shape's id is; absent,
                    // path plus position.
                    <div
                      key={prop.id ?? `${prop.path}#${i}`}
                      data-testid={`constraint-${shape.id}-${prop.id ?? `${prop.path}#${i}`}`}
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

                {/* Failing nodes, tinted by the node's own worst tier.
                    Theme tokens only: the former light-theme literals
                    were unreadable on a dark theme and needed
                    !important to override. */}
                {nodeResults
                  .filter((r) => !r.valid)
                  .map((r) => {
                    const tier = r.violations.reduce<ShaclSeverity | null>(
                      (acc, v) => worstOf(acc, v.severity),
                      null,
                    );
                    const rowTier = tier ?? "violation";
                    return (
                      <div
                        key={r.nodeId}
                        data-testid={`violation-${r.nodeId}`}
                        data-severity={rowTier}
                        style={{
                          padding: "3px 8px",
                          marginBottom: 2,
                          borderRadius: 3,
                          background: SEVERITY_SURFACE[rowTier],
                          color: "var(--g3t-text-primary)",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                        onClick={() => selectNodes([r.nodeId])}
                      >
                        <div
                          style={{
                            fontWeight: 500,
                            color: SEVERITY_COLOR[rowTier],
                          }}
                        >
                          {r.nodeId}
                        </div>
                        {r.violations.map((v, i) => (
                          <div
                            key={i}
                            style={{
                              fontSize: 10,
                              color: "var(--g3t-text-secondary)",
                            }}
                          >
                            {v.message}
                          </div>
                        ))}
                      </div>
                    );
                  })}

                {nodeResults.filter((r) => !r.valid).length === 0 &&
                  (badge.state === "no-focus-nodes" ? (
                    // Nothing passed because nothing was selected; the
                    // success tone would overstate it (#55).
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--g3t-text-muted)",
                        padding: "4px 8px",
                      }}
                    >
                      No focus nodes: the shape's targets matched nothing.
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--g3t-success, #22c55e)",
                        padding: "4px 8px",
                      }}
                    >
                      All {stats?.totalNodes ?? 0} nodes pass validation.
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
