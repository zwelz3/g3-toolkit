/**
 * DiffRenderer: visual diff of two UGM graphs (M6.E2.T4).
 *
 * Overlay mode: single view with color-coded nodes.
 * Added=green, removed=red, changed=amber, unchanged=grey.
 *
 * @see specs/01-functional-views.md R1.10
 */

import { useMemo } from "react";
import type { DiffResult } from "@g3t/core";
import { EmptyState } from "../../interaction/feedback";

export interface DiffRendererProps {
  diff: DiffResult;
  className?: string;
}

const COLORS = {
  added: "#22c55e",
  removed: "#ef4444",
  changed: "#f59e0b",
  unchanged: "#9ca3af",
} as const;

export function DiffRenderer({ diff, className }: DiffRendererProps) {
  const summary = useMemo(() => {
    return {
      addedNodes: diff.addedNodes.length,
      removedNodes: diff.removedNodes.length,
      changedNodes: diff.changedNodes.length,
      addedEdges: diff.addedEdges.length,
      removedEdges: diff.removedEdges.length,
      changedEdges: diff.changedEdges.length,
    };
  }, [diff]);

  const totalChanges =
    summary.addedNodes +
    summary.removedNodes +
    summary.changedNodes +
    summary.addedEdges +
    summary.removedEdges +
    summary.changedEdges;

  if (totalChanges === 0) {
    return (
      <EmptyState
        testId="diff-empty"
        icon="check"
        title="No differences"
        description="The two graph states match: no nodes or edges were added, removed, or changed."
      />
    );
  }

  return (
    <div
      data-testid="diff-renderer"
      className={className}
      style={{ padding: 8, fontSize: 13 }}
    >
      {/* Summary bar */}
      <div
        data-testid="diff-summary"
        style={{ display: "flex", gap: 12, marginBottom: 12 }}
      >
        <DiffBadge
          color={COLORS.added}
          label="Added"
          count={summary.addedNodes + summary.addedEdges}
        />
        <DiffBadge
          color={COLORS.removed}
          label="Removed"
          count={summary.removedNodes + summary.removedEdges}
        />
        <DiffBadge
          color={COLORS.changed}
          label="Changed"
          count={summary.changedNodes + summary.changedEdges}
        />
      </div>

      {/* Node diffs */}
      {diff.addedNodes.map((n) => (
        <DiffRow key={n.id} id={n.id} status="added" type="node" />
      ))}
      {diff.removedNodes.map((n) => (
        <DiffRow key={n.id} id={n.id} status="removed" type="node" />
      ))}
      {diff.changedNodes.map((n) => (
        <DiffRow
          key={n.id}
          id={n.id}
          status="changed"
          type="node"
          changes={n.propertyChanges}
        />
      ))}

      {/* Edge diffs */}
      {diff.addedEdges.map((e) => (
        <DiffRow
          key={e.id}
          id={`${e.source}→${e.target}`}
          status="added"
          type="edge"
        />
      ))}
      {diff.removedEdges.map((e) => (
        <DiffRow
          key={e.id}
          id={`${e.source}→${e.target}`}
          status="removed"
          type="edge"
        />
      ))}
    </div>
  );
}

function DiffBadge({
  color,
  label,
  count,
}: {
  color: string;
  label: string;
  count: number;
}) {
  return (
    <span
      data-testid={`diff-badge-${label.toLowerCase()}`}
      style={{
        padding: "2px 8px",
        borderRadius: 8,
        fontSize: 12,
        background: `${color}20`,
        color,
        fontWeight: 600,
      }}
    >
      {label}: {count}
    </span>
  );
}

function DiffRow({
  id,
  status,
  type,
  changes,
}: {
  id: string;
  status: "added" | "removed" | "changed";
  type: "node" | "edge";
  changes?: Array<{ key: string; oldValue: unknown; newValue: unknown }>;
}) {
  return (
    <div
      data-testid={`diff-${status}-${id}`}
      style={{
        padding: "4px 8px",
        borderLeft: `3px solid ${COLORS[status]}`,
        marginBottom: 4,
        fontSize: 12,
      }}
    >
      <span style={{ color: COLORS[status], fontWeight: 600 }}>
        {status.toUpperCase()}
      </span>{" "}
      [{type}] {id}
      {changes && changes.length > 0 && (
        <div style={{ color: "#888", marginLeft: 16 }}>
          {changes.map((c, i) => (
            <div key={i}>
              {c.key}: {JSON.stringify(c.oldValue)} →{" "}
              {JSON.stringify(c.newValue)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
