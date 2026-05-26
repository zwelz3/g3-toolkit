/**
 * DetailInspector: property panel for inspecting node/edge details.
 *
 * Renders key-value properties with nested object expansion and
 * Qualified Edge metadata display.
 *
 * @see specs/01-functional-views.md R1.11
 */

// Implements: R1.14 (community overlay), R5.7 (holonic layer display).

import { useState } from "react";
import type { UGM } from "@core/ugm";

export interface DetailInspectorProps {
  /** The UGM instance to read data from. */
  ugm: UGM;
  /** The selected element: "node" or "edge" and its ID. */
  selection: { type: "node" | "edge"; id: string } | null;
  /** CSS class for the container. */
  className?: string;
}

// @see R5.7: holonic layer display in inspector
export function DetailInspector({
  ugm,
  selection,
  className,
}: DetailInspectorProps) {
  if (!selection) {
    return (
      <div className={className} data-testid="detail-inspector">
        <p style={{ color: "#888", padding: 12 }}>
          Right-click an element and select &quot;Inspect properties&quot;
        </p>
      </div>
    );
  }

  if (selection.type === "node") {
    const attrs = ugm.getNode(selection.id);
    if (!attrs) {
      return (
        <div className={className} data-testid="detail-inspector">
          <p>Node not found: {selection.id}</p>
        </div>
      );
    }
    return (
      <div className={className} data-testid="detail-inspector">
        <h3 style={{ margin: "8px 12px" }}>Node: {selection.id}</h3>
        <PropertySection label="Types" value={attrs.types} />
        <PropertySection label="Properties" value={attrs.properties} />
      </div>
    );
  }

  // Edge
  const attrs = ugm.getEdge(selection.id);
  const endpoints = ugm.getEdgeEndpoints(selection.id);
  if (!attrs || !endpoints) {
    return (
      <div className={className} data-testid="detail-inspector">
        <p>Edge not found: {selection.id}</p>
      </div>
    );
  }
  return (
    <div className={className} data-testid="detail-inspector">
      <h3 style={{ margin: "8px 12px" }}>
        Edge: {endpoints.source} → {endpoints.target}
      </h3>
      <PropertyRow label="Type" value={attrs.type} />
      <PropertySection label="Properties" value={attrs.properties} />
      {Object.keys(attrs.meta).length > 0 && (
        <PropertySection label="Qualified Edge Metadata" value={attrs.meta} />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function PropertyRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "2px 12px",
        fontSize: 13,
        gap: 8,
      }}
    >
      <span style={{ fontWeight: 600, minWidth: 100 }}>{label}:</span>
      <span data-testid={`prop-${label}`}>{formatValue(value)}</span>
    </div>
  );
}

function PropertySection({ label, value }: { label: string; value: unknown }) {
  const [expanded, setExpanded] = useState(true);

  if (value === null || value === undefined) return null;

  if (typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return null;

    return (
      <div style={{ margin: "4px 0" }}>
        <button
          onClick={() => setExpanded(!expanded)}
          data-testid={`section-${label}`}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
            padding: "4px 12px",
          }}
        >
          {expanded ? "▼" : "▶"} {label} ({entries.length})
        </button>
        {expanded && (
          <div style={{ paddingLeft: 12 }}>
            {entries.map(([k, v]) => (
              <PropertyRow key={k} label={k} value={v} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return <PropertyRow label={label} value={value} />;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
