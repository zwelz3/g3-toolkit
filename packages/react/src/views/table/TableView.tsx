/**
 * TableView: tabular display of UGM nodes using TanStack Table.
 *
 * Columns: id, types, and all observed property keys from the UGM
 * property-key registry. Supports sorting, pagination, selection
 * linking, and right-click context menu.
 *
 * Since issue #39 the same component also renders plain rows without
 * a UGM (`rows` + `columns`), with a table-wide `renderCell` and a
 * `selection` mode that can bypass the shared selection store. The
 * UGM path keeps its behavior and test ids; the rows path reuses the
 * same chrome (sort, filters, column menu, pagination).
 *
 * Issue #47 (the #39 deferrals that needed no dependency ruling): CSV
 * export of the filtered rows (`getCsv`, a pure helper, plus an
 * optional toolbar button), a checklist "values" filter, menu-based
 * column reorder over TanStack `columnOrder` (host-controllable), and
 * a cross-column search over the visible columns. Virtualization
 * stays deferred: it needs a dependency decision.
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
  type ReactNode,
} from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type Column,
  type ColumnDef,
  type ColumnOrderState,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
  type ColumnFiltersState,
  type PaginationState,
  type Row,
} from "@tanstack/react-table";
import type { UGM } from "@g3-toolkit/core";
import { useSelectionStore } from "../../state/selection-store";
import type {
  ContextMenuManager,
  MenuTarget,
} from "../../interaction/context-menu";
import { ContextMenu } from "../../interaction/context-menu";
import { Icon } from "../../icons";

/** A flat row representation of a UGM node (what `renderCell` sees
 *  on the UGM path: built-in `id` and `types`, then one key per
 *  node property, objects pre-stringified). */
export interface TableNodeRow {
  id: string;
  types: string;
  [key: string]: unknown;
}

/** A column for the rows path (#39): how to read a value out of a
 *  row, optionally how to render it, and which inline filter the
 *  header carries. */
export interface DataGridColumn<T> {
  /** Stable column id (test ids and visibility state key off it). */
  id: string;
  /** Header text, also the label in the column-visibility menu. */
  header: string;
  /** Reads the sortable, filterable value out of a row. */
  value: (row: T) => unknown;
  /** Renders the cell; defaults to the stringified value, with
   *  null/undefined shown as a dash. A table-wide `renderCell` that
   *  returns a non-undefined node takes precedence. */
  render?: (value: unknown, row: T) => ReactNode;
  /** Inline header filter kind. "text" (default) is a substring
   *  match, "values" a checklist over the distinct values with counts
   *  (#47: several at once, exact match on the value's string form),
   *  "range" a numeric min/max pair, "none" no filter (and no
   *  cross-column search over it either). */
  filter?: "text" | "values" | "range" | "none";
}

/** CSV export options (#47) for the toolbar button. */
export interface TableCsvExport {
  /** Download name; default "table.csv". */
  filename?: string;
  /** Replaces the browser download (an anchor with an object URL):
   *  hosts that save elsewhere, and tests, read the text here. */
  download?: (csv: string, filename: string) => void;
}

/** What a table-wide cell renderer receives, on either path. */
export interface TableCellContext<T> {
  columnId: string;
  value: unknown;
  row: T;
  /** The row's id: the node id on the UGM path, `rowId` (or the
   *  index) on the rows path. */
  rowId: string;
}

/** Where a row click goes (#39). "store" writes the SHARED selection
 *  store (right for a view linked to a canvas); "none" renders inert
 *  rows; the object form keeps the selection in the host, which
 *  receives the FULL next selection after every click (plain
 *  replaces, ctrl/cmd toggles, shift extends over the visible range). */
export type TableSelection =
  | "store"
  | "none"
  | {
      selected: ReadonlySet<string>;
      onSelect: (ids: string[]) => void;
    };

export interface TableViewProps<T = TableNodeRow> {
  /** The graph to tabulate (one row per node). Omit it to render
   *  `rows` instead. */
  ugm?: UGM;
  /** Rows path (#39): tabular data that is not a graph (SPARQL
   *  bindings, registers, entity lists). Ignored when `ugm` is set.
   *  Hold it in a useMemo: a fresh array each render rebuilds the row
   *  model (the same referential-stability contract fixture graphs
   *  carry). */
  rows?: readonly T[];
  /** Column definitions for `rows`. Required for the rows path: the
   *  table has no registry to derive columns from. */
  columns?: readonly DataGridColumn<T>[];
  /** Row identity on the rows path; defaults to the array index.
   *  Selection and the `table-row-{id}` test ids use it. */
  rowId?: (row: T, index: number) => string;
  /** Table-wide cell renderer, both paths. Return undefined to fall
   *  back to the column's own rendering for that cell. */
  renderCell?: (ctx: TableCellContext<T>) => ReactNode;
  /** Selection target (default "store", the pre-#39 behavior). The
   *  older `selectable={false}` is equivalent to "none" and also
   *  drops the context menu. */
  selection?: TableSelection;
  /** Toolbar "Export CSV" button (#47): the FILTERED rows in the
   *  current sort, the visible columns in their current order, cell
   *  values rather than rendered nodes (see `getCsv`). Default off.
   *  The download is a no-op where `URL.createObjectURL` is absent
   *  (jsdom) unless `download` is given. */
  exportCsv?: boolean | TableCsvExport;
  /** Column order (#47) as TanStack `columnOrder`: column ids first
   *  in this order, the rest after in definition order. Omit it to
   *  let the table own the order (the column menu's move buttons
   *  still report through `onColumnOrderChange`, so a host can
   *  persist it without controlling it). */
  columnOrder?: readonly string[];
  /** Receives the full next order after every move. */
  onColumnOrderChange?: (order: string[]) => void;
  /** Cross-column search box (#47) in the toolbar, above the
   *  per-column filters: a case-insensitive substring match over the
   *  VISIBLE columns only (hidden and `filter: "none"` columns are
   *  skipped), on top of the per-column filters. The "N of M" count
   *  reflects it. Default off, so the chrome is unchanged. */
  search?: boolean;
  /** Optional menu manager for right-click (R2.1 universality). */
  menuManager?: ContextMenuManager;
  /** Page size (default 50; max working-set limit R7.4 is 10,000).
   *  Live: a later change re-paginates, keeping the first visible
   *  row's page in view (#21: it used to be read once at mount). */
  pageSize?: number;
  /** Row density (B3, design-system roadmap): "comfortable" (default)
   *  or "compact" for thin-client analyst deployments where row
   *  count is the job. */
  density?: "comfortable" | "compact";
  className?: string;
  /** Fill mode (#21): the root becomes a flex column at 100% of the
   *  host's height, the body scrolls with a sticky header, and the
   *  pagination bar stays pinned at the bottom. Needs the package
   *  stylesheet (`@g3-toolkit/react/style.css`) and a host with a
   *  definite height. */
  fill?: boolean;
  /** Row height in px, applied to every data and filler row (#21:
   *  `density` is two padding values, so the row count a host can fit
   *  was not derivable). Table rows cannot shrink below their content,
   *  so pick a value at least the content's natural height. */
  rowHeight?: number;
  /** In fill mode with `rowHeight`, derive the page size from the
   *  measured scroll region (ResizeObserver) instead of `pageSize`,
   *  so rows meet the bottom edge and re-fit on resize without a
   *  remount. No-op where ResizeObserver is absent (jsdom). */
  autoPageSize?: boolean;
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

/** Empty-cell glyph (pre-existing on the UGM path; shared so the rows
 *  path renders nulls the same way). */
const EMPTY_CELL = "—";

function cellText(v: unknown): string {
  if (v === undefined || v === null) return EMPTY_CELL;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Exact-match SET filter for "values" columns (#47). TanStack's
 *  equalsString lowercases the row value, which throws on numbers;
 *  the faceted checklist hands back the values' string forms, so
 *  compare those. The value is the list of ticked strings (an empty
 *  list matches nothing: "none", then tick a few); a single string
 *  still works for a host that sets one value. `undefined` is "all"
 *  and is auto-removed. */
function includesValueString(
  row: Row<unknown>,
  columnId: string,
  filterValue: unknown,
): boolean {
  const wanted = Array.isArray(filterValue)
    ? (filterValue as unknown[])
    : [filterValue];
  const actual = String(row.getValue(columnId));
  return wanted.some((v) => String(v) === actual);
}
includesValueString.autoRemove = (v: unknown) => v === undefined || v === "";

/** What the search box stores as TanStack `globalFilter` (#47). The
 *  searchable column ids travel WITH the query because the filtered
 *  row model memoizes on `globalFilter` (and column filters and the
 *  data), not on column visibility: a filter function that consulted
 *  `column.getIsVisible()` at evaluation time would keep matching on
 *  a column after it was hidden until the next query edit. The object
 *  is memoized in the component so identity changes exactly when the
 *  query or the visible set does. */
interface SearchFilter {
  /** Lowercased query. */
  query: string;
  /** Visible, searchable column ids. */
  columnIds: readonly string[];
}

function searchVisibleColumns(
  row: Row<unknown>,
  columnId: string,
  filterValue: SearchFilter,
): boolean {
  if (!filterValue.columnIds.includes(columnId)) return false;
  const v = row.getValue(columnId);
  if (v === undefined || v === null) return false;
  return cellText(v).toLowerCase().includes(filterValue.query);
}

/** RFC 4180 field: quoted when it holds a quote, a comma, CR or LF,
 *  with embedded quotes doubled. */
function csvField(v: unknown): string {
  const text =
    v === undefined || v === null
      ? ""
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV text (#47) for TanStack rows and columns, RFC 4180: CRLF
 * records, a header record from each column's header text (its id
 * when the header is not a string), fields quoted and quote-doubled
 * only where needed, cell VALUES (`row.getValue`, so null is empty
 * and objects are JSON) rather than rendered nodes.
 *
 * It is pure and headless so a host that owns its own TanStack table
 * (or wires its own button) can call it; TableView's `exportCsv`
 * button passes `table.getSortedRowModel().rows` (the filtered rows
 * in the current sort) and `table.getVisibleLeafColumns()` (column
 * visibility and order applied).
 */
export function getCsv<T>(
  rows: readonly Row<T>[],
  columns: readonly Column<T, unknown>[],
): string {
  const header = columns.map((c) => {
    const h = c.columnDef.header;
    return csvField(typeof h === "string" ? h : c.id);
  });
  const records = rows.map((row) =>
    columns.map((c) => csvField(row.getValue(c.id))).join(","),
  );
  return [header.join(","), ...records].join("\r\n") + "\r\n";
}

/** Browser download through an object URL. Silently a no-op where
 *  `URL.createObjectURL` is missing (jsdom): the helper above is the
 *  testable part, this is the browser-only part. */
function downloadCsv(csv: string, filename: string): void {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  )
    return;
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const SELECT_STYLE = {
  fontSize: 10,
  padding: "1px 4px",
  marginTop: 2,
  border: "1px solid var(--g3t-border, #dee2e6)",
} as const;

/** Checklist filter for a "values" column (#47): a button showing the
 *  current pick opens a popover of checkboxes with per-value counts
 *  from the faceted row model (so the counts follow the OTHER
 *  filters and the search), with All/None shortcuts. Closes on
 *  Escape or an outside pointerdown, like the column menu. The
 *  filter value is `undefined` for "all" or the list of ticked
 *  string forms; unticking from "all" materializes the list. */
function ValuesFilter({
  column,
  testId,
}: {
  column: Column<unknown, unknown>;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options = [...column.getFacetedUniqueValues()]
    .map(([v, n]) => [cellText(v), n] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const raw = column.getFilterValue();
  const picked: readonly string[] | undefined =
    raw === undefined || raw === ""
      ? undefined
      : Array.isArray(raw)
        ? raw.map(String)
        : [String(raw)];
  const isChecked = (v: string) => picked === undefined || picked.includes(v);
  const toggle = (v: string) => {
    const current = picked ?? options.map(([o]) => o);
    const next = current.includes(v)
      ? current.filter((x) => x !== v)
      : [...current, v];
    column.setFilterValue(next);
  };
  const label =
    picked === undefined
      ? "All"
      : picked.length === 0
        ? "None"
        : picked.length === 1
          ? picked[0]
          : `${picked.length} selected`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        data-testid={testId}
        className="g3t-btn g3t-btn-ghost"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        style={{
          ...SELECT_STYLE,
          width: "100%",
          textAlign: "left",
          fontWeight: "normal",
        }}
      >
        {label} ▾
      </button>
      {open && (
        <div
          data-testid={`${testId}-menu`}
          role="listbox"
          aria-multiselectable
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 2,
            zIndex: 100,
            background: "var(--g3t-bg-primary, white)",
            border: "1px solid var(--g3t-border, #dee2e6)",
            borderRadius: 4,
            padding: 6,
            boxShadow: "var(--g3t-shadow-md, 0 2px 8px rgba(0,0,0,0.1))",
            maxHeight: 240,
            overflow: "auto",
            minWidth: 140,
            fontWeight: "normal",
            fontSize: 11,
          }}
        >
          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
            <button
              type="button"
              data-testid={`${testId}-all`}
              className="g3t-btn g3t-btn-ghost"
              style={{ fontSize: 10 }}
              onClick={() => column.setFilterValue(undefined)}
            >
              All
            </button>
            <button
              type="button"
              data-testid={`${testId}-none`}
              className="g3t-btn g3t-btn-ghost"
              style={{ fontSize: 10 }}
              onClick={() => column.setFilterValue([])}
            >
              None
            </button>
          </div>
          {options.map(([v, n]) => (
            <label
              key={v}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "1px 0",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                data-testid={`${testId}-option-${v}`}
                checked={isChecked(v)}
                onChange={() => toggle(v)}
              />
              {v} ({n})
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_ROWS: readonly never[] = [];

export function TableView<T = TableNodeRow>({
  ugm,
  rows = EMPTY_ROWS,
  columns: gridColumns,
  rowId,
  renderCell,
  selection = "store",
  exportCsv = false,
  columnOrder: columnOrderProp,
  onColumnOrderChange,
  search = false,
  menuManager,
  pageSize = 50,
  density = "comfortable",
  className,
  fill = false,
  rowHeight,
  autoPageSize = false,
  idFormatter,
  hideBuiltinColumns,
  selectable = true,
}: TableViewProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // #47: column order is controlled from the host when `columnOrder`
  // is given, internal otherwise; either way every move reports the
  // full next order so a host can persist without controlling.
  const [internalOrder, setInternalOrder] = useState<ColumnOrderState>([]);
  const columnOrder: ColumnOrderState =
    columnOrderProp !== undefined
      ? (columnOrderProp as ColumnOrderState)
      : internalOrder;
  const handleColumnOrderChange = useCallback<OnChangeFn<ColumnOrderState>>(
    (updater) => {
      const next =
        typeof updater === "function" ? updater(columnOrder) : updater;
      if (columnOrderProp === undefined) setInternalOrder(next);
      onColumnOrderChange?.(next);
    },
    [columnOrder, columnOrderProp, onColumnOrderChange],
  );
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

  // `selectable={false}` predates `selection` and stays the master
  // switch: it also drops the context menu, which `selection: "none"`
  // on its own does not (a standalone register may still want a menu).
  const selectionMode: TableSelection = selectable ? selection : "none";

  // Context menu state
  const [menuState, setMenuState] = useState<{
    target: MenuTarget;
    items: ReturnType<ContextMenuManager["resolve"]>;
  } | null>(null);

  // Build flat rows from UGM
  const nodeRows = useMemo<TableNodeRow[]>(() => {
    const out: TableNodeRow[] = [];
    ugm?.forEachNode((id, attrs) => {
      const row: TableNodeRow = {
        id,
        types: attrs.types.join(", "),
      };
      for (const [key, value] of Object.entries(attrs.properties)) {
        row[key] = typeof value === "object" ? JSON.stringify(value) : value;
      }
      out.push(row);
    });
    return out;
  }, [ugm]);

  // Build columns dynamically from property-key registry
  const nodeColumns = useMemo<ColumnDef<TableNodeRow>[]>(() => {
    const cols: ColumnDef<TableNodeRow>[] = [];
    if (ugm === undefined) return cols;
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
          if (v === undefined || v === null) return EMPTY_CELL;
          return String(v);
        },
      });
    }

    return cols;
  }, [ugm, idFormatter, hideBuiltinColumns]);

  // Rows path (#39): one TanStack column per DataGridColumn. The
  // filter kind decides the filter function here and the header
  // control below (looked up by id; TanStack's ColumnMeta would need
  // a module augmentation that leaks into every consumer's types).
  const dataColumns = useMemo<ColumnDef<T>[]>(() => {
    if (ugm !== undefined || gridColumns === undefined) return [];
    return gridColumns.map((col) => {
      const kind = col.filter ?? "text";
      return {
        id: col.id,
        accessorFn: (row: T) => col.value(row),
        header: col.header,
        enableColumnFilter: kind !== "none",
        enableGlobalFilter: kind !== "none",
        filterFn:
          kind === "values"
            ? (includesValueString as ColumnDef<T>["filterFn"])
            : kind === "range"
              ? "inNumberRange"
              : "includesString",
        cell: ({ getValue, row }) =>
          col.render
            ? col.render(getValue(), row.original)
            : cellText(getValue()),
      };
    });
  }, [ugm, gridColumns]);
  const gridColumnById = useMemo(
    () => new Map((gridColumns ?? []).map((c) => [c.id, c] as const)),
    [gridColumns],
  );

  // Both paths feed ONE table instance. On the UGM path T is
  // TableNodeRow by default, so the casts only widen what the rows
  // path already types honestly.
  const data = useMemo<T[]>(
    () => (ugm !== undefined ? (nodeRows as unknown as T[]) : [...rows]),
    [ugm, nodeRows, rows],
  );
  const columns = useMemo<ColumnDef<T>[]>(
    () =>
      ugm !== undefined
        ? (nodeColumns as unknown as ColumnDef<T>[])
        : dataColumns,
    [ugm, nodeColumns, dataColumns],
  );
  const getRowId = useCallback(
    (row: T, index: number): string =>
      ugm !== undefined
        ? (row as unknown as TableNodeRow).id
        : (rowId?.(row, index) ?? String(index)),
    [ugm, rowId],
  );

  // #21(c): in fill mode the scroll region's height is the host's,
  // not the content's, so it can be measured without a feedback
  // loop. The thead is measured rather than computed because the
  // inline filter input makes its height underivable from the
  // padding constants. ResizeObserver delivers the initial size on
  // observe, so no synchronous measurement is needed here.
  const scrollRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [measuredPageSize, setMeasuredPageSize] = useState<number | null>(null);
  const measuring =
    fill && autoPageSize && rowHeight !== undefined && rowHeight > 0;
  useEffect(() => {
    if (!measuring) return;
    const el = scrollRef.current;
    if (el === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const head = theadRef.current?.offsetHeight ?? 0;
      const available = el.clientHeight - head;
      setMeasuredPageSize(Math.max(1, Math.floor(available / rowHeight)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [measuring, rowHeight]);
  const effectivePageSize =
    measuring && measuredPageSize !== null ? measuredPageSize : pageSize;

  // #47: the search travels as one object with the visible, searchable
  // column ids (see SearchFilter for why visibility cannot be read at
  // evaluation time). `undefined` when empty, so TanStack skips the
  // global pass entirely.
  const searchFilter = useMemo<SearchFilter | undefined>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!search || query === "") return undefined;
    const columnIds = columns
      .map((c) => c.id ?? (c as { accessorKey?: string }).accessorKey ?? "")
      .filter(
        (id) =>
          id !== "" &&
          columnVisibility[id] !== false &&
          (ugm !== undefined || gridColumnById.get(id)?.filter !== "none"),
      );
    return { query, columnIds };
  }, [search, searchQuery, columns, columnVisibility, ugm, gridColumnById]);

  // #21(b): pagination is CONTROLLED state like sorting, visibility
  // and filters, so the pageSize prop stays live. (It was passed
  // through TanStack's initialState, which is read once at
  // construction, so a host that computed a row count from its height
  // could only apply it by remounting, which discarded sort, filter
  // and visibility state.) A pageSize change re-derives the page
  // index so the first visible row stays in view, which also keeps
  // the index in range when the page grows.
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: effectivePageSize,
  });
  if (pagination.pageSize !== effectivePageSize) {
    const topRow = pagination.pageIndex * pagination.pageSize;
    setPagination({
      pageSize: effectivePageSize,
      pageIndex: Math.floor(topRow / effectivePageSize),
    });
  }

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      columnOrder,
      pagination,
      globalFilter: searchFilter,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: handleColumnOrderChange,
    onPaginationChange: setPagination,
    // The search box owns the query; TanStack never sets it itself.
    onGlobalFilterChange: () => {},
    globalFilterFn: searchVisibleColumns as never,
    // TanStack's default admits only columns whose FIRST row holds a
    // string or number; the visible/searchable set is decided per
    // render in `searchFilter` instead.
    getColumnCanGlobalFilter: () => true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // #47: swap a column with its neighbor in the leaf order (hidden
  // columns included, so the move is visible in the menu's own list).
  // The full order is written, not a delta, so a controlled host
  // receives something it can store as-is.
  const moveColumn = (id: string, delta: -1 | 1) => {
    const ids = table.getAllLeafColumns().map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const [moved] = ids.splice(i, 1);
    ids.splice(j, 0, moved as string);
    table.setColumnOrder(ids);
  };

  const csvOptions: TableCsvExport | null =
    exportCsv === false ? null : exportCsv === true ? {} : exportCsv;
  const handleExportCsv = () => {
    if (csvOptions === null) return;
    const csv = getCsv(
      table.getSortedRowModel().rows,
      table.getVisibleLeafColumns(),
    );
    const filename = csvOptions.filename ?? "table.csv";
    (csvOptions.download ?? downloadCsv)(csv, filename);
  };

  // Track last-clicked row index for shift-click range selection
  const lastClickedIndexRef = useRef<number>(-1);

  // Row click with modifier key support (M1.E2.T2)
  // - Plain click: replace selection
  // - Ctrl/Cmd+click: toggle node in/out of selection
  // - Shift+click: range select from last-clicked row
  const handleRowClick = useCallback(
    (id: string, rowIndex: number, e: React.MouseEvent) => {
      const rangeIds = () => {
        const visible = table.getRowModel().rows;
        const start = Math.min(lastClickedIndexRef.current, rowIndex);
        const end = Math.max(lastClickedIndexRef.current, rowIndex);
        return visible.slice(start, end + 1).map((r) => r.id);
      };
      const toggle = e.ctrlKey || e.metaKey;
      const extend = e.shiftKey && lastClickedIndexRef.current >= 0;
      if (selectionMode === "store") {
        if (toggle) toggleNodeSelection(id);
        else if (extend) addNodesToSelection(rangeIds());
        else selectNodes([id]);
      } else if (selectionMode !== "none") {
        // Host-owned selection: hand back the whole next set so the
        // host never has to replicate the modifier rules.
        const current = selectionMode.selected;
        const next = toggle
          ? current.has(id)
            ? [...current].filter((x) => x !== id)
            : [...current, id]
          : extend
            ? [...new Set([...current, ...rangeIds()])]
            : [id];
        selectionMode.onSelect(next);
      }
      lastClickedIndexRef.current = rowIndex;
    },
    [
      selectionMode,
      selectNodes,
      addNodesToSelection,
      toggleNodeSelection,
      table,
    ],
  );

  // Row right-click shows context menu (M1.E2.T3)
  const handleRowContextMenu = useCallback(
    (e: MouseEvent, id: string) => {
      e.preventDefault();
      if (!menuManager) return;

      const target: MenuTarget = {
        type: "node",
        id,
        position: { x: e.clientX, y: e.clientY },
        data: { types: ugm?.getNode(id)?.types ?? [] },
      };
      const items = menuManager.resolve(target);
      if (items.length > 0) {
        setMenuState({ target, items });
      }
    },
    [menuManager, ugm],
  );

  const interactive = selectionMode !== "none";
  const isRowSelected = (id: string): boolean => {
    if (selectionMode === "store") return selectedNodeIds.has(id);
    if (selectionMode === "none") return false;
    return selectionMode.selected.has(id);
  };

  const visibleRows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const noun = ugm !== undefined ? "nodes" : "rows";

  return (
    <div
      // #21(a): a stable class structure so a host can style each
      // region without selecting on test ids; g3t-table-fill is the
      // opt-in layout (packages/react/src/theme/g3t-base.css).
      className={["g3t-table", fill ? "g3t-table-fill" : "", className ?? ""]
        .filter((c) => c !== "")
        .join(" ")}
      data-testid="table-view"
      onClick={() => setMenuState(null)}
    >
      {/* Column visibility toggle (M11.E4.T1) */}
      <div
        className="g3t-table-toolbar"
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
              {table.getAllLeafColumns().map((col, i, all) => (
                <div
                  key={col.id}
                  data-testid={`column-menu-row-${col.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 0",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flex: 1,
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
                  {/* #47: reorder lives beside show/hide; the buttons
                      sit OUTSIDE the label so a click does not also
                      toggle visibility. */}
                  <button
                    type="button"
                    data-testid={`column-move-left-${col.id}`}
                    className="g3t-btn g3t-btn-ghost"
                    aria-label={`Move ${String(col.columnDef.header ?? col.id)} left`}
                    disabled={i === 0}
                    onClick={() => moveColumn(col.id, -1)}
                    style={{ fontSize: 10, padding: "0 3px", lineHeight: 1 }}
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    data-testid={`column-move-right-${col.id}`}
                    className="g3t-btn g3t-btn-ghost"
                    aria-label={`Move ${String(col.columnDef.header ?? col.id)} right`}
                    disabled={i === all.length - 1}
                    onClick={() => moveColumn(col.id, 1)}
                    style={{ fontSize: 10, padding: "0 3px", lineHeight: 1 }}
                  >
                    ▶
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* #47: cross-column search, above the per-column filters. */}
        {search && (
          <input
            data-testid="table-search"
            className="g3t-input"
            type="search"
            aria-label="Search visible columns"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 11,
              padding: "1px 4px",
              border: "1px solid var(--g3t-border, #dee2e6)",
              minWidth: 140,
            }}
          />
        )}
        {csvOptions !== null && (
          <button
            type="button"
            data-testid="table-export-csv"
            className="g3t-btn g3t-btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleExportCsv();
            }}
            style={{ fontSize: 11, marginLeft: "auto" }}
          >
            Export CSV
          </button>
        )}
      </div>

      <div className="g3t-table-scroll" ref={scrollRef}>
        <table
          style={{
            width: "100%",
            // G3 (owner 2026-07-28): in narrow hosts the 100% width
            // squeezed columns into clipping; max-content lets the
            // table take its natural width and the host scroll.
            minWidth: "max-content",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead ref={theadRef}>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const filterKind =
                    ugm === undefined
                      ? (gridColumnById.get(header.column.id)?.filter ?? "text")
                      : "text";
                  const filterInputStyle = {
                    fontSize: 10,
                    padding: "1px 4px",
                    marginTop: 2,
                    border: "1px solid var(--g3t-border, #dee2e6)",
                  } as const;
                  return (
                    <th
                      key={header.id}
                      // The sort state was legible only as an icon glyph,
                      // which no assistive technology reports and no test
                      // can assert without matching on an SVG. aria-sort is
                      // the standard carrier.
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : "none"
                      }
                      style={{
                        padding: density === "compact" ? "2px 6px" : "6px 8px",
                        borderBottom: "2px solid var(--g3t-border, #ddd)",
                        textAlign: "left",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <div
                        // The sort handler lives here, not on the th, so
                        // that the inline filter input below does not
                        // toggle sorting when it is clicked. The pointer
                        // cursor belongs on the same element for the same
                        // reason: it was on the th and keyed off
                        // `selectable`, which is ROW selection and has
                        // nothing to do with sorting, so the whole header
                        // cell advertised a click that only its top half
                        // answered.
                        data-testid={`column-sort-${header.id}`}
                        style={{
                          cursor: header.column.getCanSort()
                            ? "pointer"
                            : "default",
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
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
                      {header.column.getCanFilter() &&
                        filterKind === "text" && (
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
                            style={{ ...filterInputStyle, width: "100%" }}
                          />
                        )}
                      {header.column.getCanFilter() &&
                        filterKind === "values" && (
                          <ValuesFilter
                            column={
                              header.column as unknown as Column<
                                unknown,
                                unknown
                              >
                            }
                            testId={`column-filter-${header.id}`}
                          />
                        )}
                      {header.column.getCanFilter() &&
                        filterKind === "range" &&
                        (() => {
                          const [min, max] = (header.column.getFilterValue() as
                            | [string | undefined, string | undefined]
                            | undefined) ?? [undefined, undefined];
                          const set = (lo?: string, hi?: string) =>
                            header.column.setFilterValue(
                              lo || hi
                                ? [lo || undefined, hi || undefined]
                                : undefined,
                            );
                          return (
                            <div style={{ display: "flex", gap: 2 }}>
                              <input
                                data-testid={`column-filter-${header.id}-min`}
                                className="g3t-input"
                                type="number"
                                placeholder="Min"
                                value={min ?? ""}
                                onChange={(e) => set(e.target.value, max)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ ...filterInputStyle, width: "50%" }}
                              />
                              <input
                                data-testid={`column-filter-${header.id}-max`}
                                className="g3t-input"
                                type="number"
                                placeholder="Max"
                                value={max ?? ""}
                                onChange={(e) => set(min, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ ...filterInputStyle, width: "50%" }}
                              />
                            </div>
                          );
                        })()}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => {
              const id = row.id;
              const isSelected = isRowSelected(id);
              return (
                <tr
                  key={id}
                  data-testid={`table-row-${id}`}
                  data-selected={isSelected ? "true" : undefined}
                  onClick={
                    interactive
                      ? (e) => handleRowClick(id, rowIndex, e)
                      : undefined
                  }
                  onContextMenu={
                    selectable ? (e) => handleRowContextMenu(e, id) : undefined
                  }
                  style={{
                    cursor: interactive ? "pointer" : "default",
                    height: rowHeight,
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
                  {row.getVisibleCells().map((cell) => {
                    const custom = renderCell?.({
                      columnId: cell.column.id,
                      value: cell.getValue(),
                      row: row.original,
                      rowId: id,
                    });
                    // Issue #17: a derived cell carries the producing
                    // definition's id, so a reader (and a host style)
                    // can tell computed from measured. UGM path only;
                    // the rows path has no registry.
                    const derivedBy = ugm?.getDerivation(
                      id,
                      cell.column.id,
                    )?.definitionId;
                    return (
                      <td
                        key={cell.id}
                        className={
                          derivedBy !== undefined
                            ? "g3t-table-cell-derived"
                            : undefined
                        }
                        data-derived={derivedBy}
                        style={{
                          padding:
                            density === "compact" ? "2px 6px" : "4px 8px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        {custom !== undefined
                          ? custom
                          : flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* LR-48 (owner review 2026-07-22): the last page has fewer
                rows, so the grid (and the Prev/Next controls under it)
                jumped height on every page change, making the buttons a
                moving target. Filler rows keep every page the same
                height; cell padding mirrors the data cells so row
                heights match. */}
            {Array.from(
              {
                // Fillers only when the data actually paginates: a
                // single-page table has no jump to prevent (and a huge
                // pageSize would otherwise render thousands of fillers).
                length:
                  table.getPageCount() > 1
                    ? Math.max(0, effectivePageSize - visibleRows.length)
                    : 0,
              },
              (_, i) => (
                <tr
                  key={`filler-${i}`}
                  aria-hidden
                  data-testid="table-filler-row"
                  style={{ height: rowHeight }}
                >
                  <td
                    colSpan={table.getAllLeafColumns().length}
                    style={{
                      padding: density === "compact" ? "2px 6px" : "6px 8px",
                      border: "none",
                    }}
                  >
                    {" "}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div
        className="g3t-table-pagination"
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
          {filteredCount < data.length
            ? `${filteredCount} of ${data.length} ${noun}`
            : `${data.length} ${noun}`}
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
