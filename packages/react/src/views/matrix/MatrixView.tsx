/**
 * MatrixView: adjacency/co-occurrence heatmap (M7.E1.T3, R1.4).
 *
 * Renders node type co-occurrence as a color-scaled grid.
 * Click a cell to drill to the subgraph connecting those types.
 *
 * @see specs/01-functional-views.md R1.4
 * @see specs/07-ux-defaults-accessibility.md R7.3
 */

import { useMemo, useCallback } from "react";
import type { UGM } from "@g3t/core";
import { scaleColor } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";
import { EmptyState } from "../../interaction/feedback";

export interface MatrixViewProps {
  ugm: UGM;
  /** Maximum dimensions before aggregation (default 200, R7.3). */
  maxSize?: number;
  className?: string;
}

interface MatrixCell {
  rowType: string;
  colType: string;
  count: number;
  nodeIds: string[];
}

export function MatrixView({ ugm, maxSize = 200, className }: MatrixViewProps) {
  const { selectNodes } = useSelectionStore();

  // Build adjacency matrix by node type
  const { types, matrix, maxCount, totalTypes } = useMemo(() => {
    const typeCounts = new Map<string, Map<string, MatrixCell>>();
    const typeSet = new Set<string>();

    ugm.forEachEdge((_id, _attrs, source, target) => {
      const srcType = ugm.getNode(source)?.types[0] ?? "Unknown";
      const tgtType = ugm.getNode(target)?.types[0] ?? "Unknown";
      typeSet.add(srcType);
      typeSet.add(tgtType);

      if (!typeCounts.has(srcType)) typeCounts.set(srcType, new Map());
      const row = typeCounts.get(srcType)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      if (!row.has(tgtType)) {
        row.set(tgtType, {
          rowType: srcType,
          colType: tgtType,
          count: 0,
          nodeIds: [],
        });
      }
      const cell = row.get(tgtType)!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      cell.count++;
      if (!cell.nodeIds.includes(source)) cell.nodeIds.push(source);
      if (!cell.nodeIds.includes(target)) cell.nodeIds.push(target);
    });

    const allTypes = [...typeSet].sort();
    const sortedTypes = allTypes.slice(0, maxSize);
    const mtx: MatrixCell[][] = sortedTypes.map((rowType) =>
      sortedTypes.map((colType) => {
        return (
          typeCounts.get(rowType)?.get(colType) ?? {
            rowType,
            colType,
            count: 0,
            nodeIds: [],
          }
        );
      }),
    );

    const maxVal = Math.max(0, ...mtx.flat().map((c) => c.count));
    return {
      types: sortedTypes,
      matrix: mtx,
      maxCount: maxVal,
      totalTypes: allTypes.length,
    };
  }, [ugm, maxSize]);
  const truncated = totalTypes > types.length;

  const handleCellClick = useCallback(
    (cell: MatrixCell) => {
      if (cell.nodeIds.length > 0) {
        selectNodes(cell.nodeIds);
      }
    },
    [selectNodes],
  );

  if (types.length === 0) {
    return (
      <EmptyState
        testId="matrix-empty"
        icon="layers"
        title="No co-occurrence data"
        description="The matrix counts edges between typed nodes. Load a graph with typed nodes and at least one edge to populate it."
      />
    );
  }

  return (
    <div
      data-testid="matrix-view"
      className={className}
      style={{ overflow: "auto", padding: 8 }}
    >
      {truncated ? (
        <div
          data-testid="matrix-truncation-notice"
          role="status"
          style={{
            fontSize: "var(--g3t-font-sm, 12px)",
            color: "var(--g3t-text-muted, #888)",
            padding: "4px 0",
          }}
        >
          Showing {types.length} of {totalTypes} node types (working-set limit).
          Raise maxSize or filter to specific types to see the rest.
        </div>
      ) : null}
      <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th />
            {types.map((t) => (
              <th
                key={t}
                scope="col"
                style={{
                  // Vertical column labels: the previous rotate(-45deg)
                  // had no transform sizing, so labels overlapped cell
                  // content and touched the table boundary
                  // (visual-acceptance VA-4/VA-5, 2026-06-11).
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  verticalAlign: "bottom",
                  textAlign: "left",
                  padding: "6px 2px 8px",
                  fontFamily: "var(--g3t-font-mono, monospace)",
                  fontSize: 10,
                  fontWeight: 500,
                  color: "var(--g3t-text-secondary, #666)",
                  whiteSpace: "nowrap",
                  maxHeight: 120,
                }}
              >
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, ri) => (
            <tr key={types[ri]}>
              <th
                scope="row"
                style={{
                  padding: "2px 10px 2px 4px",
                  textAlign: "right",
                  fontFamily: "var(--g3t-font-mono, monospace)",
                  fontSize: 10,
                  fontWeight: 500,
                  color: "var(--g3t-text-secondary, #666)",
                  whiteSpace: "nowrap",
                }}
              >
                {types[ri]}
              </th>
              {row.map((cell, ci) => {
                const intensity = maxCount > 0 ? cell.count / maxCount : 0;
                // Sequential viridis scale (R7.8 extended to continuous
                // encodings): perceptually uniform, colorblind-safe,
                // legible in both light and dark themes; replaces the
                // hardcoded alpha-blue ramp that washed out on dark
                // backgrounds.
                const bg =
                  cell.count > 0
                    ? scaleColor(intensity)
                    : "var(--g3t-bg-secondary, #f8f9fa)";
                return (
                  <td
                    key={`${ri}-${ci}`}
                    data-testid={`matrix-cell-${types[ri]}-${types[ci]}`}
                    onClick={() => handleCellClick(cell)}
                    style={{
                      width: 28,
                      height: 28,
                      textAlign: "center",
                      background: bg,
                      // Viridis luminance is monotonic: dark text reads
                      // on the bright high end, light text on the low end.
                      color: intensity > 0.6 ? "#1a1a1a" : "#f5f5f5",
                      cursor: cell.count > 0 ? "pointer" : "default",
                      border: "1px solid var(--g3t-border, #eee)",
                    }}
                    title={`${types[ri]} → ${types[ci]}: ${cell.count}`}
                  >
                    {cell.count > 0 ? cell.count : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
