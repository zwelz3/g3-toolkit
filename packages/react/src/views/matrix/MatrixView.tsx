/**
 * MatrixView: adjacency/co-occurrence heatmap (M7.E1.T3, R1.4).
 *
 * Renders node type co-occurrence as a color-scaled grid.
 * Click a cell to drill to the subgraph connecting those types.
 *
 * Working-set limit (R7.3, issue #6): past `maxSize` types the view
 * PAGES, rows and columns independently, each axis cut by core's
 * `pageCategories` (stable id order) and driven by its own
 * PaginationControl. Two controls rather than one with an axis
 * selector because independence is the point: a 350x350 request
 * renders 200x200 and every (rowPage, colPage) pair is reachable, so
 * every cell is, and the user sees where they are on both axes at
 * once. Aggregating the remainder into an "other" row/column is the
 * documented non-goal: it hides which types made the bucket and the
 * cell click (select the nodes behind it) would have nothing precise
 * to select. The color scale is computed over the WHOLE matrix, so a
 * cell keeps its color when the page changes.
 *
 * @see specs/01-functional-views.md R1.4
 * @see specs/07-ux-defaults-accessibility.md R7.3
 */

import { useMemo, useCallback, useState } from "react";
import type { UGM } from "@g3-toolkit/core";
import { scaleColor, pageCategories, pageCount } from "@g3-toolkit/core";
import { useSelectionStore } from "../../state/selection-store";
import { EmptyState } from "../../interaction/feedback";
import { PaginationControl } from "../../interaction/pagination";

export interface MatrixViewProps {
  ugm: UGM;
  /** Page size per axis (default 200, R7.3): a matrix with more node
   *  types than this pages rows and columns independently. A host that
   *  consults `WorkingSetManager.checkLimit("matrix", n)` passes its
   *  `pageSize` here. */
  maxSize?: number;
  /** VR-18 (owner verification 2026-07-26): stretch the table to
   *  the host's width (the analytics rail) instead of the natural
   *  cell-count width. */
  fill?: boolean;
  className?: string;
}

interface MatrixCell {
  rowType: string;
  colType: string;
  count: number;
  nodeIds: string[];
}

export function MatrixView({
  ugm,
  maxSize = 200,
  fill = false,
  className,
}: MatrixViewProps) {
  const { selectNodes } = useSelectionStore();
  // Zero-based page per axis. Clamped at read time (below) rather than
  // reset in an effect, so a graph that shrinks never leaves the view
  // on a page past the end for a render.
  const [rowPage, setRowPage] = useState(0);
  const [colPage, setColPage] = useState(0);
  const pageSize = Math.max(1, Math.floor(maxSize));

  // Count edges by (source type, target type) once per graph; the
  // scale maximum is over every cell so paging never recolors.
  const { typeCounts, typeSet, maxCount } = useMemo(() => {
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

    let maxVal = 0;
    for (const row of typeCounts.values()) {
      for (const cell of row.values()) {
        if (cell.count > maxVal) maxVal = cell.count;
      }
    }
    return { typeCounts, typeSet, maxCount: maxVal };
  }, [ugm]);

  const totalTypes = typeSet.size;
  const pages = pageCount({ size: pageSize, total: totalTypes });
  const rowPageClamped = Math.min(rowPage, pages - 1);
  const colPageClamped = Math.min(colPage, pages - 1);

  // Cut the visible window per axis (core's stable id order) and
  // build only the cells in it.
  const { rowTypes, colTypes, matrix } = useMemo(() => {
    const rows = pageCategories(typeSet, {
      offset: rowPageClamped * pageSize,
      size: pageSize,
    }).items;
    const cols = pageCategories(typeSet, {
      offset: colPageClamped * pageSize,
      size: pageSize,
    }).items;
    const mtx: MatrixCell[][] = rows.map((rowType) =>
      cols.map(
        (colType) =>
          typeCounts.get(rowType)?.get(colType) ?? {
            rowType,
            colType,
            count: 0,
            nodeIds: [],
          },
      ),
    );
    return { rowTypes: rows, colTypes: cols, matrix: mtx };
  }, [typeSet, typeCounts, pageSize, rowPageClamped, colPageClamped]);
  const paged = totalTypes > pageSize;

  const handleCellClick = useCallback(
    (cell: MatrixCell) => {
      if (cell.nodeIds.length > 0) {
        selectNodes(cell.nodeIds);
      }
    },
    [selectNodes],
  );

  if (totalTypes === 0) {
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
      {paged ? (
        <div
          data-testid="matrix-paging"
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: "var(--g3t-space-4, 16px)",
          }}
        >
          <PaginationControl
            page={rowPageClamped}
            pageSize={pageSize}
            total={totalTypes}
            noun="rows"
            onPageChange={setRowPage}
            testId="matrix-rows-pagination"
          />
          <PaginationControl
            page={colPageClamped}
            pageSize={pageSize}
            total={totalTypes}
            noun="columns"
            onPageChange={setColPage}
            testId="matrix-columns-pagination"
          />
        </div>
      ) : null}
      <table
        style={{
          borderCollapse: "collapse",
          fontSize: 11,
          // VR-18: in fill mode the table stretches to the host
          // (the analytics rail) and columns share the width.
          ...(fill ? { width: "100%", tableLayout: "fixed" as const } : {}),
        }}
      >
        <thead>
          <tr>
            <th />
            {colTypes.map((t) => (
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
            <tr key={rowTypes[ri]}>
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
                {rowTypes[ri]}
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
                    data-testid={`matrix-cell-${rowTypes[ri]}-${colTypes[ci]}`}
                    onClick={() => handleCellClick(cell)}
                    style={{
                      ...(fill ? {} : { width: 28 }),
                      // G3 v2 (owner 2026-07-28): aspect-ratio does
                      // not apply to table cells; the INNER div below
                      // carries the square, the td wraps it. Fixed 28
                      // outside fill mode.
                      ...(fill ? { padding: 0 } : { height: 28 }),
                      textAlign: "center",
                      background: bg,
                      // Viridis luminance is monotonic: dark text reads
                      // on the bright high end, light text on the low end.
                      color: intensity > 0.6 ? "#1a1a1a" : "#f5f5f5",
                      cursor: cell.count > 0 ? "pointer" : "default",
                      border: "1px solid var(--g3t-border, #eee)",
                    }}
                    title={`${rowTypes[ri]} → ${colTypes[ci]}: ${cell.count}`}
                  >
                    {fill ? (
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 22,
                        }}
                      >
                        {cell.count > 0 ? cell.count : ""}
                      </div>
                    ) : cell.count > 0 ? (
                      cell.count
                    ) : (
                      ""
                    )}
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
