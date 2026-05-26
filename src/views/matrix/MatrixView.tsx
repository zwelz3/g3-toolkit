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
import type { UGM } from "@core/ugm";
import { useSelectionStore } from "@state/selection-store";

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
  const { types, matrix, maxCount } = useMemo(() => {
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

    const sortedTypes = [...typeSet].sort().slice(0, maxSize);
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
    return { types: sortedTypes, matrix: mtx, maxCount: maxVal };
  }, [ugm, maxSize]);

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
      <div data-testid="matrix-empty" style={{ padding: 16, color: "#888" }}>
        No matrix data. Graph needs edges between typed nodes.
      </div>
    );
  }

  return (
    <div
      data-testid="matrix-view"
      className={className}
      style={{ overflow: "auto", padding: 8 }}
    >
      <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th />
            {types.map((t) => (
              <th
                key={t}
                style={{
                  padding: "2px 4px",
                  transform: "rotate(-45deg)",
                  whiteSpace: "nowrap",
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
              <td style={{ padding: "2px 8px", fontWeight: 600 }}>
                {types[ri]}
              </td>
              {row.map((cell, ci) => {
                const intensity = maxCount > 0 ? cell.count / maxCount : 0;
                return (
                  <td
                    key={`${ri}-${ci}`}
                    data-testid={`matrix-cell-${types[ri]}-${types[ci]}`}
                    onClick={() => handleCellClick(cell)}
                    style={{
                      width: 28,
                      height: 28,
                      textAlign: "center",
                      background: `rgba(37, 99, 235, ${intensity * 0.8})`,
                      color: intensity > 0.5 ? "white" : "#333",
                      cursor: cell.count > 0 ? "pointer" : "default",
                      border: "1px solid #eee",
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
