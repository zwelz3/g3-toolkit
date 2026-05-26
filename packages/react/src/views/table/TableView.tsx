/**
 * TableView: tabular display of UGM nodes using TanStack Table.
 *
 * Columns: id, types, and all observed property keys from the UGM
 * property-key registry. Supports sorting, pagination, selection
 * linking, and right-click context menu.
 *
 * @see specs/01-functional-views.md R1.7
 * @see specs/02-functional-interaction.md R2.1, R2.5
 * @see specs/07-ux-defaults-accessibility.md R7.4
 */

import { useMemo, useState, useCallback, useRef, type MouseEvent } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import type { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";
import type { ContextMenuManager, MenuTarget } from "../../interaction/context-menu";
import { ContextMenu } from "../../interaction/context-menu";

/** A flat row representation of a UGM node. */
interface NodeRow {
  id: string;
  types: string;
  [key: string]: unknown;
}

export interface TableViewProps {
  ugm: UGM;
  /** Optional menu manager for right-click (R2.1 universality). */
  menuManager?: ContextMenuManager;
  /** Page size (default 50; max working-set limit R7.4 is 10,000). */
  pageSize?: number;
  className?: string;
}

export function TableView({
  ugm,
  menuManager,
  pageSize = 50,
  className,
}: TableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const {
    selectedNodeIds,
    selectNodes,
    addNodesToSelection,
    toggleNodeSelection,
  } = useSelectionStore();

  // Context menu state
  const [menuState, setMenuState] = useState<{
    target: MenuTarget;
    items: ReturnType<ContextMenuManager["resolve"]>;
  } | null>(null);

  // Build flat rows from UGM
  const data = useMemo<NodeRow[]>(() => {
    const rows: NodeRow[] = [];
    ugm.forEachNode((id, attrs) => {
      const row: NodeRow = {
        id,
        types: attrs.types.join(", "),
      };
      for (const [key, value] of Object.entries(attrs.properties)) {
        row[key] = typeof value === "object" ? JSON.stringify(value) : value;
      }
      rows.push(row);
    });
    return rows;
  }, [ugm]);

  // Build columns dynamically from property-key registry
  const columns = useMemo<ColumnDef<NodeRow>[]>(() => {
    const cols: ColumnDef<NodeRow>[] = [
      {
        accessorKey: "id",
        header: "ID",
        size: 120,
      },
      {
        accessorKey: "types",
        header: "Types",
        size: 150,
      },
    ];

    const registry = ugm.getRegistry();
    for (const key of registry.nodePropertyKeys) {
      cols.push({
        accessorKey: key,
        header: key.charAt(0).toUpperCase() + key.slice(1),
        size: 120,
        cell: ({ getValue }) => {
          const v = getValue();
          if (v === undefined || v === null) return "—";
          return String(v);
        },
      });
    }

    return cols;
  }, [ugm]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnFilters },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  });

  // Track last-clicked row index for shift-click range selection
  const lastClickedIndexRef = useRef<number>(-1);

  // Row click with modifier key support (M1.E2.T2)
  // - Plain click: replace selection
  // - Ctrl/Cmd+click: toggle node in/out of selection
  // - Shift+click: range select from last-clicked row
  const handleRowClick = useCallback(
    (nodeId: string, rowIndex: number, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Toggle this node in/out of selection
        toggleNodeSelection(nodeId);
      } else if (e.shiftKey && lastClickedIndexRef.current >= 0) {
        // Range select from last-clicked to this row
        const rows = table.getRowModel().rows;
        const start = Math.min(lastClickedIndexRef.current, rowIndex);
        const end = Math.max(lastClickedIndexRef.current, rowIndex);
        const rangeIds = rows.slice(start, end + 1).map((r) => r.original.id);
        addNodesToSelection(rangeIds);
      } else {
        selectNodes([nodeId]);
      }
      lastClickedIndexRef.current = rowIndex;
    },
    [selectNodes, addNodesToSelection, toggleNodeSelection, table],
  );

  // Row right-click shows context menu (M1.E2.T3)
  const handleRowContextMenu = useCallback(
    (e: MouseEvent, nodeId: string) => {
      e.preventDefault();
      if (!menuManager) return;

      const target: MenuTarget = {
        type: "node",
        id: nodeId,
        position: { x: e.clientX, y: e.clientY },
        data: { types: ugm.getNode(nodeId)?.types ?? [] },
      };
      const items = menuManager.resolve(target);
      if (items.length > 0) {
        setMenuState({ target, items });
      }
    },
    [menuManager, ugm],
  );

  return (
    <div
      className={className}
      data-testid="table-view"
      onClick={() => setMenuState(null)}
    >
      {/* Column visibility toggle (M11.E4.T1) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 8px",
          gap: 8,
          fontSize: 11,
        }}
      >
        <button
          data-testid="column-visibility-toggle"
          className="g3t-btn g3t-btn-ghost"
          onClick={(e) => {
            e.stopPropagation();
            setShowColumnMenu(!showColumnMenu);
          }}
          style={{ fontSize: 11 }}
        >
          Columns ▾
        </button>
        {showColumnMenu && (
          <div
            data-testid="column-visibility-menu"
            style={{
              position: "absolute",
              zIndex: 100,
              background: "var(--g3t-bg-primary, white)",
              border: "1px solid var(--g3t-border, #dee2e6)",
              borderRadius: 4,
              padding: 8,
              boxShadow: "var(--g3t-shadow-md, 0 2px 8px rgba(0,0,0,0.1))",
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            {table.getAllLeafColumns().map((col) => (
              <label
                key={col.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 0",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  onChange={col.getToggleVisibilityHandler()}
                />
                {String(col.columnDef.header ?? col.id)}
              </label>
            ))}
          </div>
        )}
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  style={{
                    padding: "6px 8px",
                    borderBottom: "2px solid var(--g3t-border, #ddd)",
                    textAlign: "left",
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getIsSorted() === "asc"
                      ? " ▲"
                      : header.column.getIsSorted() === "desc"
                        ? " ▼"
                        : ""}
                  </div>
                  {/* Inline filter (M11.E4.T2) */}
                  {header.column.getCanFilter() && (
                    <input
                      data-testid={`column-filter-${header.id}`}
                      className="g3t-input"
                      placeholder="Filter..."
                      value={String(header.column.getFilterValue() ?? "")}
                      onChange={(e) =>
                        header.column.setFilterValue(
                          e.target.value || undefined,
                        )
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "100%",
                        fontSize: 10,
                        padding: "1px 4px",
                        marginTop: 2,
                        border: "1px solid var(--g3t-border, #dee2e6)",
                      }}
                    />
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, rowIndex) => {
            const nodeId = row.original.id;
            const isSelected = selectedNodeIds.has(nodeId);
            return (
              <tr
                key={row.id}
                data-testid={`table-row-${nodeId}`}
                data-selected={isSelected ? "true" : undefined}
                onClick={(e) => handleRowClick(nodeId, rowIndex, e)}
                onContextMenu={(e) => handleRowContextMenu(e, nodeId)}
                style={{
                  cursor: "pointer",
                  backgroundColor: isSelected
                    ? "rgba(37, 99, 235, 0.1)"
                    : undefined,
                  borderLeft: isSelected
                    ? "3px solid #2563eb"
                    : "3px solid transparent",
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      padding: "4px 8px",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagination controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 0",
          fontSize: 13,
        }}
        data-testid="table-pagination"
      >
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ← Prev
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next →
        </button>
        <span style={{ marginLeft: "auto", color: "#888" }}>
          {data.length} nodes
        </span>
      </div>

      {/* Context menu overlay */}
      {menuState && (
        <ContextMenu
          items={menuState.items}
          target={menuState.target}
          onClose={() => setMenuState(null)}
        />
      )}
    </div>
  );
}
