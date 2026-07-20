/**
 * NodePropertyInspector: a polished inspector panel for a selected node
 * or edge, styled to match NodeStyleEditor (card chrome, accent stripe,
 * collapsible sections, close affordance).
 *
 * Layout, top to bottom: identity header; then collapsible sections in
 * priority order:
 *   1. Properties  -- rendered from a property spec (text / number /
 *      checkbox / toggle / select / ...), with a `mode` of "preview"
 *      (read-only) or "edit" (interactive, emitting onPropertyChange).
 *      Properties come first by design.
 *   2. Type        -- chips color-coded from the theme's type palette so
 *      a type reads the same here as on the canvas.
 *   3. Graph importance -- connectivity (degree, in/out, neighbors) as
 *      the element's "priority" in the graph, with a bar relative to the
 *      most-connected node.
 * Edges substitute Endpoints + Qualified metadata for the importance bar.
 *
 * Section collapse state is held in a graph-wide store, so the same
 * containment is shown when the selection changes. Accents derive from
 * theme.accentPrimary.
 */

import { useMemo, type CSSProperties, type ReactNode } from "react";
import type { UGM } from "@g3t/core";
import { useThemeStore } from "../../theme/ThemeManager";
import { useInspectorSectionStore } from "../../state/inspector-section-store";
import { resolveFields, type PropertyInspectorSpec } from "./property-spec";
import { PropertyField } from "./PropertyField";
import "./NodePropertyInspector.css";

export interface NodePropertyInspectorProps {
  /** The UGM instance to read data from. */
  ugm: UGM;
  /** The selected element: "node" or "edge" and its ID, or null. */
  selection: { type: "node" | "edge"; id: string } | null;
  /**
   * "preview" (default) renders properties read-only; "edit" makes the
   * property widgets interactive and emits onPropertyChange.
   */
  mode?: "preview" | "edit";
  /** Optional spec controlling the widget used per property key. */
  spec?: PropertyInspectorSpec;
  /** Called in edit mode when a property widget changes. */
  onPropertyChange?: (key: string, value: unknown) => void;
  /** Optional close handler; when provided a close button is shown. */
  onClose?: () => void;
  /** 12.11: surfaces that apply a custom EncodingSpec pass their own
   *  type -> color resolver (e.g. categoricalColorMap keyed by VALUE)
   *  so the panel's type chips match the graph exactly; the internal
   *  theme-palette map only matches the DEFAULT encoding. */
  typeColorOf?: (type: string) => string | undefined;
  /** CSS class for the container. */
  className?: string;
}

// Distinct node types in encounter order map to palette slots, matching
// the canvas default (VisualEncoding), so a type's color in the panel is
// the same as its color in the graph.
function buildTypeColors(ugm: UGM, palette: string[]): Map<string, string> {
  const order: string[] = [];
  ugm.forEachNode((_id, attrs) => {
    const t = attrs.types[0];
    if (t && !order.includes(t)) order.push(t);
  });
  const map = new Map<string, string>();
  const fallback = palette[0] ?? "#888888";
  order.forEach((t, i) => map.set(t, palette[i % palette.length] ?? fallback));
  return map;
}

interface NodeMetrics {
  degree: number;
  inDegree: number;
  outDegree: number;
  neighbors: number;
}

function nodeMetrics(ugm: UGM, id: string): NodeMetrics {
  const edgeIds = ugm.getNodeEdges(id);
  let inDegree = 0;
  let outDegree = 0;
  for (const eid of edgeIds) {
    const ep = ugm.getEdgeEndpoints(eid);
    if (!ep) continue;
    if (ep.source === id) outDegree += 1;
    if (ep.target === id) inDegree += 1;
  }
  return {
    degree: edgeIds.length,
    inDegree,
    outDegree,
    neighbors: ugm.getNeighbors(id).length,
  };
}

function maxDegree(ugm: UGM): number {
  let max = 0;
  ugm.forEachNode((id) => {
    const d = ugm.getNodeEdges(id).length;
    if (d > max) max = d;
  });
  return max;
}

export function NodePropertyInspector({
  ugm,
  selection,
  mode = "preview",
  spec,
  onPropertyChange,
  onClose,
  typeColorOf,
  className,
}: NodePropertyInspectorProps): ReactNode {
  const theme = useThemeStore((s) => s.theme);
  const internalTypeColors = useMemo(
    () => buildTypeColors(ugm, theme.typePalette),
    [ugm, theme.typePalette],
  );
  const colorOfType = (t: string) =>
    typeColorOf?.(t) ?? internalTypeColors.get(t);
  const maxDeg = useMemo(() => maxDegree(ugm), [ugm]);
  const accent = theme.accentPrimary;

  const card: CSSProperties = {
    width: 300,
    background: "var(--g3t-bg-primary)",
    color: "var(--g3t-text-primary)",
    border: "1px solid var(--g3t-border)",
    borderTop: `3px solid ${accent}`,
    borderRadius: "var(--g3t-radius-lg, 8px)",
    boxShadow: "var(--g3t-shadow-lg)",
    fontSize: "var(--g3t-font-sm, 12px)",
    overflow: "hidden",
  };

  function frame(
    kind: "node" | "edge" | "empty",
    title: string,
    body: ReactNode,
    dotColor?: string,
  ): ReactNode {
    return (
      <div
        data-testid="node-property-inspector"
        className={className}
        style={card}
      >
        <Header
          title={title}
          kind={kind}
          accent={accent}
          onClose={onClose}
          dotColor={dotColor}
        />
        {body}
      </div>
    );
  }

  if (!selection) {
    return frame(
      "empty",
      "Inspector",
      <div style={{ padding: 16, color: "var(--g3t-text-muted)" }}>
        Select a node or edge to inspect its properties, type, and connectivity.
      </div>,
    );
  }

  const propsSection = (properties: Record<string, unknown>): ReactNode => {
    const fields = resolveFields(properties, spec);
    return (
      <CollapsibleSection
        id="properties"
        title={`Properties (${fields.length})`}
      >
        {fields.length === 0 ? (
          <div style={{ color: "var(--g3t-text-muted)", fontSize: 11 }}>
            No properties.
          </div>
        ) : (
          fields.map((f) => (
            <PropertyField
              key={f.key}
              fieldKey={f.key}
              label={f.label}
              widget={f.widget}
              value={properties[f.key]}
              options={f.options}
              editable={mode === "edit" && !f.readOnly}
              accent={accent}
              onChange={(v) => onPropertyChange?.(f.key, v)}
            />
          ))
        )}
      </CollapsibleSection>
    );
  };

  if (selection.type === "node") {
    const attrs = ugm.getNode(selection.id);
    if (!attrs) {
      return frame(
        "node",
        selection.id,
        <div style={{ padding: 16, color: "var(--g3t-text-muted)" }}>
          Node not found: {selection.id}
        </div>,
      );
    }
    const metrics = nodeMetrics(ugm, selection.id);
    const pct = maxDeg > 0 ? Math.round((metrics.degree / maxDeg) * 100) : 0;
    const primaryType = attrs.types[0] ?? "";
    return frame(
      "node",
      selection.id,
      <div style={{ padding: "0 12px 4px" }}>
        {propsSection(attrs.properties)}

        <CollapsibleSection id="type" title="Type">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {attrs.types.length === 0 ? (
              <span style={{ color: "var(--g3t-text-muted)" }}>untyped</span>
            ) : (
              attrs.types.map((t) => (
                <TypeChip key={t} label={t} color={colorOfType(t) ?? accent} />
              ))
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="importance" title="Graph importance">
          <ImportanceBar
            value={metrics.degree}
            max={maxDeg}
            pct={pct}
            accent={accent}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Metric label="In" value={metrics.inDegree} />
            <Metric label="Out" value={metrics.outDegree} />
            <Metric label="Neighbors" value={metrics.neighbors} />
          </div>
        </CollapsibleSection>
      </div>,
      colorOfType(primaryType),
    );
  }

  // Edge
  const attrs = ugm.getEdge(selection.id);
  const endpoints = ugm.getEdgeEndpoints(selection.id);
  if (!attrs || !endpoints) {
    return frame(
      "edge",
      selection.id,
      <div style={{ padding: 16, color: "var(--g3t-text-muted)" }}>
        Edge not found: {selection.id}
      </div>,
    );
  }
  const srcDeg = ugm.getNodeEdges(endpoints.source).length;
  const tgtDeg = ugm.getNodeEdges(endpoints.target).length;
  const metaEntries = Object.entries(attrs.meta);
  return frame(
    "edge",
    `${endpoints.source} \u2192 ${endpoints.target}`,
    <div style={{ padding: "0 12px 4px" }}>
      {propsSection(attrs.properties)}

      <CollapsibleSection id="type" title="Type">
        <TypeChip label={attrs.type} color={accent} />
      </CollapsibleSection>

      <CollapsibleSection id="endpoints" title="Endpoints">
        <EndpointRow
          role="Source"
          id={endpoints.source}
          degree={srcDeg}
          accent={accent}
        />
        <EndpointRow
          role="Target"
          id={endpoints.target}
          degree={tgtDeg}
          accent={accent}
        />
      </CollapsibleSection>

      {metaEntries.length > 0 && (
        <CollapsibleSection id="metadata" title="Qualified edge metadata">
          {metaEntries.map(([k, v]) => (
            <PropertyField
              key={k}
              fieldKey={k}
              label={k}
              widget="readonly"
              value={v}
              editable={false}
              accent={accent}
            />
          ))}
        </CollapsibleSection>
      )}
    </div>,
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function CollapsibleSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}): ReactNode {
  const collapsed = useInspectorSectionStore((s) => s.collapsed.includes(id));
  const toggle = useInspectorSectionStore((s) => s.toggle);
  return (
    <div className="g3t-inspector-section">
      <button
        type="button"
        className="g3t-inspector-section-header"
        data-testid={`inspector-section-${id}`}
        aria-expanded={!collapsed}
        onClick={() => toggle(id)}
      >
        <span className="g3t-inspector-caret" aria-hidden="true">
          {collapsed ? "\u25B8" : "\u25BE"}
        </span>
        {title}
      </button>
      {!collapsed && (
        <div className="g3t-inspector-section-body">{children}</div>
      )}
    </div>
  );
}

function Header({
  title,
  kind,
  accent,
  onClose,
  dotColor,
}: {
  title: string;
  kind: "node" | "edge" | "empty";
  accent: string;
  onClose?: () => void;
  /** 12.11: surfaces that apply a custom EncodingSpec pass their own
   *  type -> color resolver (e.g. categoricalColorMap keyed by VALUE)
   *  so the panel's type chips match the graph exactly; the internal
   *  theme-palette map only matches the DEFAULT encoding. */
  typeColorOf?: (type: string) => string | undefined;
  dotColor?: string;
}): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "10px 12px",
        borderBottom: "1px solid var(--g3t-border)",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 10,
            height: 10,
            borderRadius: kind === "edge" ? 2 : "50%",
            background: dotColor ?? accent,
            flex: "0 0 auto",
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "var(--g3t-text-muted)",
            }}
          >
            {kind === "empty" ? "inspector" : kind}
          </div>
          <div
            style={{
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={title}
          >
            {title}
          </div>
        </div>
      </div>
      {onClose && (
        <button
          className="g3t-btn g3t-btn-ghost"
          data-testid="inspector-close"
          onClick={onClose}
          aria-label="Close inspector"
          style={{ fontSize: 14, padding: 0, lineHeight: 1 }}
        >
          {"\u2715"}
        </button>
      )}
    </div>
  );
}

function TypeChip({
  label,
  color,
}: {
  label: string;
  color: string;
}): ReactNode {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 11,
        color: "var(--g3t-text-primary)",
        background: "var(--g3t-bg-secondary)",
        border: `1px solid ${color}`,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: "50%", background: color }}
      />
      {label}
    </span>
  );
}

function ImportanceBar({
  value,
  max,
  pct,
  accent,
}: {
  value: number;
  max: number;
  pct: number;
  accent: string;
}): ReactNode {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          marginBottom: 3,
        }}
      >
        <span style={{ color: "var(--g3t-text-secondary)" }}>Connections</span>
        <span style={{ fontWeight: 600 }}>{value}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "var(--g3t-bg-tertiary, var(--g3t-border))",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: accent,
            borderRadius: 3,
          }}
        />
      </div>
      <div
        style={{ fontSize: 10, color: "var(--g3t-text-muted)", marginTop: 3 }}
      >
        {max > 0
          ? `${value} of ${max} max (${pct}%)`
          : "no connections in graph"}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <div
      style={{
        flex: 1,
        textAlign: "center",
        padding: "6px 4px",
        borderRadius: "var(--g3t-radius-sm, 4px)",
        background: "var(--g3t-bg-secondary)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--g3t-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}

function EndpointRow({
  role,
  id,
  degree,
  accent,
}: {
  role: string;
  id: string;
  degree: number;
  accent: string;
}): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "3px 0",
      }}
    >
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: "var(--g3t-text-muted)",
          minWidth: 48,
        }}
      >
        {role}
      </span>
      <span
        style={{
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
        title={id}
      >
        {id}
      </span>
      <span style={{ fontSize: 10, color: accent }}>{degree} conn.</span>
    </div>
  );
}
