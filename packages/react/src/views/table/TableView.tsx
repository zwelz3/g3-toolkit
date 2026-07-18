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

import {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  type MouseEvent,
} from "react";
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
import type {
  ContextMenuManager,
  MenuTarget,
} from "../../interaction/context-menu";
import { ContextMenu } from "../../interaction/context-menu";
import { Icon } from "../../icons";

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
  /** Row density (B3, design-system roadmap): "comfortable" (default)
   *  or "compact" for thin-client analyst deployments where row
   *  count is the job. */
  density?: "comfortable" | "compact";
  className?: string;
  /** Display-only formatter for the built-in ID column (review 5.18:
   *  a projection whose node ids are IRIs can show local names while
   *  selection keeps the full id; the cell title carries it). */
  idFormatter?: (id: string) => string;
  /** Hide built-in columns entirely (review 5.19: adapter-fed UGMs
   *  whose ids are ordinals and whose type is constant would render
   *  two noise columns otherwise). Hidden here means never built,
   *  not toggled off, so the visibility menu does not list them. */
  hideBuiltinColumns?: ReadonlyArray<"id" | "types">;
  /** When false, rows render without click/context-menu handlers and
   *  without selection styling (review 5.19: adapter rows carry
   *  ordinal ids; writing those into the SHARED selection store
   *  would clobber a live canvas selection). Default true. */
  selectable?: boolean;
}

export function TableView({
  ugm,
  menuManager,
  pageSize = 50,
  density = "comfortable",
  className,
  idFormatter,
  hideBuiltinColumns,
  selectable = true,
}: TableViewProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  // Close the column-visibility menu on an outside click or Escape
  // (bugfix: the menu previously had no way to close once it overlapped
  // content). The toggle button stops propagation, so clicking it does
  // not re-trigger this.
  useEffect(() => {
    if (!showColumnMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!columnMenuRef.current?.contains(e.target as Node))
        setShowColumnMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowColumnMenu(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showColumnMenu]);
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
    const cols: ColumnDef<NodeRow>[] = [];
    if (hideBuiltinColumns?.includes("id") !== true) {
      cols.push({
        accessorKey: "id",
        header: "ID",
        size: 120,
        cell: ({ getValue }) => {
          const raw = String(getValue());
          if (idFormatter === undefined) return raw;
          return <span title={raw}>{idFormatter(raw)}</span>;
        },
      });
    }
    if (hideBuiltinColumns?.includes("types") !== true) {
      cols.push({
        accessorKey: "types",
        header: "Types",
        size: 150,
      });
    }

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
  }, [ugm, idFormatter, hideBuiltinColumns]);

  // eslint-disable-next-line react-hooks/incompatible-library
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
          padding: density === "compact" ? "2px 6px" : "4px 8px",
          gap: 8,
          fontSize: 11,
        }}
      >
        <div ref={columnMenuRef} style={{ position: "relative" }}>
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
                top: "100%",
                left: 0,
                marginTop: 4,
                zIndex: 100,
                background: "var(--g3t-bg-primary, white)",
                border: "1px solid var(--g3t-border, #dee2e6)",
                borderRadius: 4,
                padding: 8,
                boxShadow: "var(--g3t-shadow-md, 0 2px 8px rgba(0,0,0,0.1))",
                maxHeight: 240,
                overflow: "auto",
                minWidth: 160,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                <span>Columns</span>
                <button
                  data-testid="column-visibility-close"
                  className="g3t-btn g3t-btn-ghost"
                  onClick={() => setShowColumnMenu(false)}
                  style={{ fontSize: 13, padding: "0 4px", lineHeight: 1 }}
                  aria-label="Close column menu"
                >
                  ✕
                </button>
              </div>
              {table.getAllLeafColumns().map((col) => (
                <label
                  key={col.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 0",
                    cursor: selectable ? "pointer" : "default",
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
                    padding: density === "compact" ? "2px 6px" : "6px 8px",
                    borderBottom: "2px solid var(--g3t-border, #ddd)",
                    textAlign: "left",
                    cursor: selectable ? "pointer" : "default",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getIsSorted() === "asc" ? (
                      <Icon name="sort-asc" size={12} />
                    ) : header.column.getIsSorted() === "desc" ? (
                      <Icon name="sort-desc" size={12} />
                    ) : null}
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
            const isSelected = selectable && selectedNodeIds.has(nodeId);
            return (
              <tr
                key={row.id}
                data-testid={`table-row-${nodeId}`}
                data-selected={isSelected ? "true" : undefined}
                onClick={
                  selectable
                    ? (e) => handleRowClick(nodeId, rowIndex, e)
                    : undefined
                }
                onContextMenu={
                  selectable
                    ? (e) => handleRowContextMenu(e, nodeId)
                    : undefined
                }
                style={{
                  cursor: selectable ? "pointer" : "default",
                  // C1 selection signature: accent bar + tinted fill,
                  // geometry from tokens, color from the active theme
                  // (the previous literals were a different blue than
                  // the theme accent entirely).
                  backgroundColor: isSelected
                    ? "color-mix(in srgb, var(--g3t-accent-primary, #0072b2) 10%, transparent)"
                    : undefined,
                  borderLeft: isSelected
                    ? "var(--g3t-selection-bar-width, 3px) solid var(--g3t-accent-primary, #0072b2)"
                    : "var(--g3t-selection-bar-width, 3px) solid transparent",
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      padding: density === "compact" ? "2px 6px" : "4px 8px",
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
          className="g3t-btn"
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
          className="g3t-btn"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next →
        </button>
        <span
          style={{ marginLeft: "auto", color: "var(--g3t-text-muted, #888)" }}
        >
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
