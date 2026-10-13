/**
 * TreeView: containment hierarchy with lazy-load (M5.E4.T1).
 *
 * Renders a tree (or a forest) rooted at the given node(s). The first
 * `initialDepth` levels open on mount; deeper levels load on click.
 * Enforces the working-set limit (1,000 rows). Breadcrumb trail for
 * navigation. Keyboard-operable as a WAI-ARIA tree: one tab stop
 * (roving tabindex), arrows move and open/close, Home/End jump,
 * Enter/Space select.
 *
 * Rows are PATHS, not nodes (#59, maintainer ruling): a node with
 * several parents renders under each of them, so a class with two
 * superclasses shows under both. Row identity (React key, expansion,
 * focus) is the path; selection is the node id, so selecting one copy
 * highlights every copy. A cycle is cut where a node is already on the
 * current path.
 *
 * @see specs/01-functional-views.md R1.6
 * @see specs/07-ux-defaults-accessibility.md R7.2
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { UGM, NodeAttributes } from "@g3-toolkit/core";
import {
  useSelectionStore,
  type SelectionState,
} from "../../state/selection-store";
import { useWorkingSetManager } from "../../state/working-set-context";
import type { WorkingSetManager } from "@g3-toolkit/core";
import { Icon } from "../../icons";
import { EmptyState } from "../../interaction/feedback";
import { viewClass } from "../../theme/view-class";
import "./TreeView.css";

/**
 * What the per-row callbacks (`filter`, `isGroup`, `renderLabel`)
 * receive (#59): the row's id, its resolved label (`properties.name`,
 * else the id), its first type, and the node's own attributes so a
 * host can decide by any property it owns.
 */
export interface TreeRowNode {
  id: string;
  label: string;
  type: string;
  attrs: NodeAttributes | undefined;
}

/** Render-time context for `renderLabel` (#59). */
export interface TreeLabelContext {
  /** 0 for a root. */
  depth: number;
  expanded: boolean;
  selected: boolean;
  /** Children in the hierarchy, filter or not (a count badge should
   *  not shrink while the host types). */
  childCount: number;
  /** True for an expand-only group row (see `isGroup`). */
  group: boolean;
}

export interface TreeViewProps {
  /** Row density (B3): "comfortable" (default) or "compact". */
  density?: "comfortable" | "compact";
  /** Upstream P3 (prm-analyzer, 2026-07-28): render the breadcrumb
   *  trail. Default true. */
  showBreadcrumb?: boolean;
  /** Fires with the id when the user picks a row (click, Enter, Space,
   *  a breadcrumb). Uncontrolled it accompanies the store write;
   *  controlled (`selected` given) it is the only channel. */
  onSelect?: (id: string) => void;
  /**
   * Controlled selection (#59). Given (a string or null), the tree
   * highlights that id and neither reads nor writes the shared
   * `useSelectionStore`: a URL-driven rail no longer collides with the
   * canvas or table on the same page. Omitted, the tree reads and
   * writes the store as before. Switching between the two after mount
   * is not supported.
   */
  selected?: string | null;
  ugm: UGM;
  /** Root node ID for the tree. If omitted (and `rootIds` is not
   *  given), auto-detects the first node with no incoming edge. */
  rootId?: string;
  /**
   * Several roots, rendered as a forest with no synthetic parent row
   * (issue #36: an ontology's classes under `owl:Thing` plus reused
   * superclasses such as `prov:Entity` as further roots). Takes
   * precedence over `rootId` when non-empty. A declared root is
   * pinned to the top level: if it is also reachable from another
   * root it is NOT repeated as that root's descendant. Any other node
   * reachable from several parents renders under each (#59).
   * Hold the array in a `useMemo`: a fresh literal each render
   * rebuilds the tree each render (same contract as fixture graphs).
   */
  rootIds?: string[];
  /**
   * Levels open on first render (default 2). This SEEDS the expanded
   * set; every row, seeded or not, toggles afterwards. The seed is
   * recomputed when the graph, the roots or this value change, and
   * user toggles survive that reseed: a row the user closed stays
   * closed, a row the user opened stays open, and rows new to the
   * graph open or close by depth as on a first render.
   */
  initialDepth?: number;
  /**
   * Ids open on first render in addition to `initialDepth` (#59): every
   * row carrying a listed id. The same seed semantics: recomputed on
   * change, toggles survive. The branch holding the selection present
   * at mount is seeded open too, and a selection that later arrives
   * from outside (the store or `selected`) opens the branch of every
   * copy and scrolls the first into view.
   */
  initialExpanded?: string[];
  /**
   * Keep only the rows that match plus their ancestors (#59). A string
   * is a case-insensitive substring test on the label; a predicate
   * sees the row. Ancestors of a match are HELD open while the filter
   * is active (a filter is a result view, so their chevron is inert
   * and ArrowLeft climbs instead of closing); clearing it restores the
   * expansion the user had. Empty string or undefined: no filter.
   */
  filter?: string | ((node: TreeRowNode) => boolean);
  /**
   * Replace the label text (#59): a count with a tooltip, a tag, a
   * muted or italic row. The `[type]` prefix and the chevron stay in
   * place around it. Absent, the label renders as plain text.
   */
  renderLabel?: (node: TreeRowNode, ctx: TreeLabelContext) => ReactNode;
  /**
   * Mark a row as an expand-only group (#59): "Object properties" over
   * its members. Click, Enter and Space toggle it instead of selecting,
   * it carries no `aria-selected`, and `data-group="true"` for host
   * CSS. A predicate rather than a reserved node property because the
   * UGM data model is the adapter's, and a host's group rows are
   * usually synthetic nodes it injected itself (by type, id prefix or
   * a property only it knows), so it should decide.
   */
  isGroup?: (node: TreeRowNode) => boolean;
  /** Accessible name of the tree (#59). Default "Hierarchy". */
  ariaLabel?: string;
  /**
   * Print the `[type]` prefix before each label (default true, the
   * historical output). Turn off when every row shares one type and
   * the prefix is noise.
   */
  showType?: boolean;
  /** Working-set manager for limit enforcement. Wins over the nearest
   *  `WorkingSetProvider`; absent both, the module default applies. */
  workingSetManager?: WorkingSetManager;
  className?: string;
}

/** One placed row of the hierarchy: a node at the end of a path. */
interface PathRow {
  /** The path: ancestor ids joined by PATH_SEP, ending in `id`. */
  key: string;
  id: string;
  parentKey: string | null;
  childKeys: string[];
  depth: number;
}

interface TreeNode {
  /** The path key: React key, expansion, focus. */
  key: string;
  id: string;
  row: TreeRowNode;
  children: TreeNode[];
  depth: number;
  hasChildren: boolean;
  /** Children in the hierarchy, before the filter. */
  childCount: number;
  /** Expanded per the seed/toggle state. `children` may still be
   *  empty when the working-set limit cut the build short. */
  expanded: boolean;
  /** Held open by the active filter (an ancestor of a match). */
  lockedOpen: boolean;
  group: boolean;
}

/** One row of the rendered (visible) order, for keyboard movement. */
interface VisibleRow {
  key: string;
  parentKey: string | null;
  firstChildKey: string | null;
  hasChildren: boolean;
  expanded: boolean;
  lockedOpen: boolean;
}

const EMPTY_ROOTS: string[] = [];
const EMPTY_IDS: string[] = [];
const EMPTY_SET: ReadonlySet<string> = new Set();
/** Unit separator: a byte no node id carries. */
const PATH_SEP = "\u001f";
/**
 * Ceiling on placed rows. Paths, not nodes, so a dense DAG can place
 * many more rows than the graph has nodes; the working-set limit
 * bounds what RENDERS but the seed, filter and reveal walk the whole
 * hierarchy, and that walk must terminate in bounded time.
 */
const MAX_PATH_ROWS = 100_000;

// Store selectors. Controlled, the tree subscribes with the inert one:
// the hook cannot be skipped, but no store change reaches the tree.
const selectNodeIds = (s: SelectionState): ReadonlySet<string> =>
  s.selectedNodeIds;
const selectNothing = (): ReadonlySet<string> => EMPTY_SET;

function rowOf(ugm: UGM, id: string): TreeRowNode {
  const attrs = ugm.getNode(id);
  return {
    id,
    label:
      typeof attrs?.properties.name === "string" ? attrs.properties.name : id,
    type: attrs?.types[0] ?? "Unknown",
    attrs,
  };
}

export function TreeView({
  showBreadcrumb = true,
  onSelect,
  selected,
  density = "comfortable",
  ugm,
  rootId,
  rootIds = EMPTY_ROOTS,
  initialDepth = 2,
  initialExpanded = EMPTY_IDS,
  filter,
  renderLabel,
  isGroup,
  ariaLabel = "Hierarchy",
  showType = true,
  workingSetManager,
  className,
}: TreeViewProps) {
  const controlled = selected !== undefined;
  const storeNodeIds = useSelectionStore(
    controlled ? selectNothing : selectNodeIds,
  );
  const workingSet = useWorkingSetManager(workingSetManager);
  // User toggles, NOT the expanded set. A row is expanded when its
  // seed membership XOR its toggle membership holds (see `isExpanded`
  // below). Before issue #36 the row test was
  // `depth < initialDepth || expandedIds.has(id)`, so a row inside
  // initialDepth could never collapse: the depth clause re-opened it
  // on every render. Keeping toggles separate from the seed is what
  // lets the seed be recomputed on a graph change without discarding
  // what the user did. Both sets hold PATH keys (#59), so one copy of
  // a node can be open while another is closed.
  const [toggledKeys, setToggledKeys] = useState<Set<string>>(new Set());
  const selectedId = controlled
    ? (selected ?? null)
    : ([...storeNodeIds][0] ?? null);
  const isSelected = useCallback(
    (id: string): boolean =>
      controlled ? id === selectedId : storeNodeIds.has(id),
    [controlled, selectedId, storeNodeIds],
  );

  // Roots: explicit forest, explicit single root, or auto-detect (the
  // first node with no incoming edge).
  const roots = useMemo<string[]>(() => {
    if (rootIds.length > 0) {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const id of rootIds) {
        if (seen.has(id) || !ugm.hasNode(id)) continue;
        seen.add(id);
        out.push(id);
      }
      return out;
    }
    if (rootId) return ugm.hasNode(rootId) ? [rootId] : [];
    const hasIncoming = new Set<string>();
    ugm.forEachEdge((_id, _attrs, _source, target) => {
      hasIncoming.add(target);
    });
    let found: string | null = null;
    ugm.forEachNode((id) => {
      if (found === null && !hasIncoming.has(id)) found = id;
    });
    const auto = found ?? ugm.getNodeIds()[0] ?? null;
    return auto ? [auto] : [];
  }, [ugm, rootId, rootIds]);

  // Containment adjacency, built once per graph.
  const childrenOf = useMemo(() => {
    const children = new Map<string, string[]>();
    ugm.forEachEdge((_id, _attrs, source, target) => {
      if (!children.has(source)) children.set(source, []);
      children.get(source)?.push(target);
    });
    return children;
  }, [ugm]);

  // The hierarchy: one full pre-order walk from the roots, ignoring
  // expansion and the working-set limit, that places every PATH. A
  // node under several parents is placed under each (#59 ruling); a
  // declared root is never a descendant (#36); a node already on the
  // current path is not re-entered, which is the only cycle cut.
  // Everything downstream (seed, filter, reveal, build) reads
  // placement from here. Before #59 `build` ran a visited set over the
  // OPEN rows only, so a child was dropped from every parent but the
  // first, and which parent that was changed as rows opened.
  const structure = useMemo(() => {
    const rows = new Map<string, PathRow>();
    const keysOf = new Map<string, string[]>();
    const rootKeys: string[] = [];
    const rootSet = new Set(roots);
    const onPath = new Set<string>();
    const place = (
      id: string,
      parentKey: string | null,
      depth: number,
    ): string | null => {
      if (rows.size >= MAX_PATH_ROWS) return null;
      const key = parentKey === null ? id : parentKey + PATH_SEP + id;
      const row: PathRow = { key, id, parentKey, childKeys: [], depth };
      rows.set(key, row);
      const keys = keysOf.get(id);
      if (keys) keys.push(key);
      else keysOf.set(id, [key]);
      onPath.add(id);
      for (const c of childrenOf.get(id) ?? []) {
        if (onPath.has(c) || rootSet.has(c)) continue;
        const childKey = place(c, key, depth + 1);
        if (childKey !== null) row.childKeys.push(childKey);
      }
      onPath.delete(id);
      return key;
    };
    for (const r of roots) {
      const key = place(r, null, 0);
      if (key !== null) rootKeys.push(key);
    }
    return { rows, keysOf, rootKeys };
  }, [childrenOf, roots]);

  /** Ancestor keys of a row, nearest first. */
  const ancestorKeysOf = useCallback(
    (key: string): string[] => {
      const out: string[] = [];
      let cur = structure.rows.get(key)?.parentKey ?? null;
      while (cur !== null) {
        out.push(cur);
        cur = structure.rows.get(cur)?.parentKey ?? null;
      }
      return out;
    },
    [structure],
  );
  /** Ancestor keys of every copy of a node, each once (copies share
   *  the upper path, and the reveal FLIPS toggles, so a repeat would
   *  close what the first opened). */
  const ancestorKeysOfId = useCallback(
    (id: string | null): string[] => {
      if (id === null) return [];
      const out = new Set<string>();
      for (const key of structure.keysOf.get(id) ?? []) {
        for (const a of ancestorKeysOf(key)) out.add(a);
      }
      return [...out];
    },
    [structure, ancestorKeysOf],
  );

  // The selection present at mount: its branch joins the seed so the
  // first paint already shows it (a later arrival is handled by the
  // reveal below, which flips toggles instead; putting a LIVE
  // selection in the seed would close an ancestor the user had
  // toggled open, since seed XOR toggle would then read false).
  const [initialSelectedId] = useState(selectedId);

  // Seed: the keys a first render opens. Walks exactly what the
  // pre-#36 build opened (depth < initialDepth), so the initial
  // picture is unchanged; only the collapse works now.
  const seedKeys = useMemo(() => {
    const seed = new Set<string>();
    const walk = (key: string): void => {
      const row = structure.rows.get(key);
      if (!row || row.depth >= initialDepth) return;
      seed.add(key);
      for (const c of row.childKeys) walk(c);
    };
    for (const r of structure.rootKeys) walk(r);
    for (const id of initialExpanded) {
      for (const key of structure.keysOf.get(id) ?? []) seed.add(key);
    }
    for (const key of ancestorKeysOfId(initialSelectedId)) seed.add(key);
    return seed;
  }, [
    structure,
    initialDepth,
    initialExpanded,
    ancestorKeysOfId,
    initialSelectedId,
  ]);

  // Filter (#59): the rows kept are the matches plus their ancestors
  // (of every copy); the ancestors are held open. Computed over the
  // whole hierarchy so a match deep in a closed branch is found.
  const filterState = useMemo<{
    keep: ReadonlySet<string>;
    lockedOpen: ReadonlySet<string>;
  } | null>(() => {
    if (filter === undefined || filter === "") return null;
    const matches =
      typeof filter === "string"
        ? ((): ((node: TreeRowNode) => boolean) => {
            const needle = filter.toLowerCase();
            return (node) => node.label.toLowerCase().includes(needle);
          })()
        : filter;
    // A node matches or not regardless of which copy; test it once.
    const matchById = new Map<string, boolean>();
    const matchesId = (id: string): boolean => {
      let m = matchById.get(id);
      if (m === undefined) {
        m = matches(rowOf(ugm, id));
        matchById.set(id, m);
      }
      return m;
    };
    const keep = new Set<string>();
    const lockedOpen = new Set<string>();
    const walk = (key: string): boolean => {
      const row = structure.rows.get(key);
      if (!row) return false;
      let kept = false;
      for (const c of row.childKeys) {
        if (walk(c)) kept = true;
      }
      if (kept) lockedOpen.add(key);
      if (kept || matchesId(row.id)) {
        keep.add(key);
        return true;
      }
      return false;
    };
    for (const r of structure.rootKeys) walk(r);
    return { keep, lockedOpen };
  }, [filter, structure, ugm]);

  // Build the forest (DFS, working-set limit over ROWS, so a node
  // placed twice counts twice).
  const forest = useMemo((): TreeNode[] => {
    if (structure.rootKeys.length === 0) return [];
    let rowCount = 0;
    const limit = workingSet.getLimit("tree");
    const isExpanded = (key: string): boolean =>
      seedKeys.has(key) !== toggledKeys.has(key);

    function build(placed: PathRow): TreeNode {
      rowCount++;
      const key = placed.key;
      const row = rowOf(ugm, placed.id);
      const childKeys = filterState
        ? placed.childKeys.filter((c) => filterState.keep.has(c))
        : placed.childKeys;
      const lockedOpen = filterState?.lockedOpen.has(key) ?? false;
      const expanded = lockedOpen || isExpanded(key);

      return {
        key,
        id: placed.id,
        row,
        depth: placed.depth,
        hasChildren: childKeys.length > 0,
        childCount: placed.childKeys.length,
        expanded,
        lockedOpen,
        group: isGroup?.(row) ?? false,
        children:
          expanded && rowCount < limit
            ? childKeys.flatMap((c) => {
                const child = structure.rows.get(c);
                return child ? [build(child)] : [];
              })
            : [],
      };
    }

    const shown = filterState
      ? structure.rootKeys.filter((r) => filterState.keep.has(r))
      : structure.rootKeys;
    return shown.flatMap((r) => {
      const root = structure.rows.get(r);
      return root ? [build(root)] : [];
    });
  }, [ugm, structure, seedKeys, toggledKeys, workingSet, filterState, isGroup]);

  const toggleExpand = useCallback(
    (key: string) => {
      // A row the filter holds open does not toggle (its chevron is
      // disabled; this guards the keyboard path).
      if (filterState?.lockedOpen.has(key)) return;
      setToggledKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [filterState],
  );

  // Visible rows in render order: the keyboard model. A row with
  // `expanded` but no built children (working-set cut) reads as a
  // leaf here, matching the chevron it shows.
  const visibleRows = useMemo<VisibleRow[]>(() => {
    const rows: VisibleRow[] = [];
    const visit = (node: TreeNode, parentKey: string | null): void => {
      const open = node.children.length > 0;
      rows.push({
        key: node.key,
        parentKey,
        firstChildKey: node.children[0]?.key ?? null,
        hasChildren: node.hasChildren,
        expanded: open,
        lockedOpen: node.lockedOpen,
      });
      if (open) for (const child of node.children) visit(child, node.key);
    };
    for (const root of forest) visit(root, null);
    return rows;
  }, [forest]);

  // Roving tabindex: exactly one row is the tab stop. Falls back to
  // the first visible row when the remembered one is no longer
  // visible (collapsed away, or gone with a graph change).
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const activeKey = useMemo(() => {
    if (focusedKey && visibleRows.some((r) => r.key === focusedKey)) {
      return focusedKey;
    }
    return visibleRows[0]?.key ?? null;
  }, [focusedKey, visibleRows]);

  // DOM focus follows a keyboard move only (never on mount, never on
  // a graph change), so the tree does not steal focus from the host.
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusRef = useRef<string | null>(null);
  const registerItem = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(key, el);
    else itemRefs.current.delete(key);
  }, []);
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (pending === null) return;
    pendingFocusRef.current = null;
    itemRefs.current.get(pending)?.focus();
  });
  const moveFocus = useCallback((key: string) => {
    pendingFocusRef.current = key;
    setFocusedKey(key);
  }, []);

  // Reveal (#59): a selection that arrives from OUTSIDE the tree (the
  // store, or the controlled `selected`, including the one present at
  // mount) opens the branch holding every copy and scrolls the first
  // copy into view. A pick made in the tree is already visible and
  // must not scroll the host's pane, so `selectId` records its id and
  // that one change is skipped. The branches open by adjusting state
  // during render (React's "adjust state when a prop changes" pattern)
  // so the rows exist in the same commit the selection lands; the
  // scroll then waits for the row through an every-render effect,
  // since a branch that had to open is only in the DOM after that
  // commit.
  const [internalPick, setInternalPick] = useState<string | null>(null);
  const [revealedFor, setRevealedFor] = useState<string | null>(selectedId);
  const pendingScrollRef = useRef<string | null>(null);
  if (selectedId !== revealedFor) {
    setRevealedFor(selectedId);
    if (selectedId !== internalPick) {
      // Consumed or superseded: the next arrival of this id from
      // outside must reveal again.
      if (internalPick !== null) setInternalPick(null);
      const closed = ancestorKeysOfId(selectedId).filter(
        (a) =>
          !(seedKeys.has(a) !== toggledKeys.has(a)) &&
          !filterState?.lockedOpen.has(a),
      );
      if (closed.length > 0) {
        const next = new Set(toggledKeys);
        for (const a of closed) {
          if (next.has(a)) next.delete(a);
          else next.add(a);
        }
        setToggledKeys(next);
      }
    }
  }
  useEffect(() => {
    if (selectedId === null || selectedId === internalPick) return;
    pendingScrollRef.current = selectedId;
  }, [selectedId, internalPick]);
  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (pending === null) return;
    // The first copy in hierarchy order that is in the DOM.
    const key = (structure.keysOf.get(pending) ?? []).find((k) =>
      itemRefs.current.has(k),
    );
    if (key === undefined) return;
    const el = itemRefs.current.get(key);
    if (!el) return;
    pendingScrollRef.current = null;
    // jsdom has no scrollIntoView; the guard keeps tests (and any
    // other headless DOM) on the same code path.
    if (typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  });

  // True breadcrumb: the ancestor PATH (root -> ... -> selected) of
  // the selected node, derived from containment edges. This replaces
  // the former click-history trail, which showed an arbitrary sequence
  // of clicked nodes rather than a hierarchy path and never reset to a
  // real path when an ancestor was clicked. A node under several
  // parents shows the path through its first incoming edge.
  const breadcrumb = useMemo<Array<{ id: string; label: string }>>(() => {
    if (!selectedId || !ugm.hasNode(selectedId)) return [];
    const parent = new Map<string, string>();
    ugm.forEachEdge((_id, _attrs, source, target) => {
      if (!parent.has(target)) parent.set(target, source);
    });
    const labelOf = (id: string): string => {
      const n = ugm.getNode(id);
      return typeof n?.properties.name === "string" ? n.properties.name : id;
    };
    const path: Array<{ id: string; label: string }> = [];
    const seen = new Set<string>();
    let cur: string | undefined = selectedId;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      path.unshift({ id: cur, label: labelOf(cur) });
      cur = parent.get(cur);
    }
    // A lone selected root is not a useful "path"; show nothing.
    return path.length > 1 ? path : [];
  }, [ugm, selectedId]);

  // Select a node id: through the store (uncontrolled) and `onSelect`.
  // A group is never selected; from the breadcrumb it is a no-op.
  const selectId = useCallback(
    (id: string) => {
      if (isGroup?.(rowOf(ugm, id))) return;
      setInternalPick(id);
      if (!controlled) useSelectionStore.getState().selectNodes([id]);
      onSelect?.(id);
    },
    [isGroup, ugm, controlled, onSelect],
  );
  // A pick on a row: a group row toggles instead.
  const pickRow = useCallback(
    (key: string) => {
      const id = structure.rows.get(key)?.id;
      if (id === undefined) return;
      if (isGroup?.(rowOf(ugm, id))) toggleExpand(key);
      else selectId(id);
    },
    [structure, isGroup, ugm, toggleExpand, selectId],
  );

  // WAI-ARIA tree keyboard model, handled once at the tree root over
  // the visible-row list rather than per row. Only a treeitem's own
  // keys are handled: the toggle button (tabIndex -1, reachable by
  // pointer) keeps its native Enter/Space.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.getAttribute("role") !== "treeitem") return;
      const idx = visibleRows.findIndex((r) => r.key === activeKey);
      const cur = visibleRows[idx];
      if (!cur) return;
      let next: string | null = null;
      switch (e.key) {
        case "ArrowDown":
          next = visibleRows[idx + 1]?.key ?? null;
          break;
        case "ArrowUp":
          next = visibleRows[idx - 1]?.key ?? null;
          break;
        case "ArrowRight":
          if (cur.hasChildren && !cur.expanded) toggleExpand(cur.key);
          else next = cur.firstChildKey;
          break;
        case "ArrowLeft":
          if (cur.expanded && !cur.lockedOpen) toggleExpand(cur.key);
          else next = cur.parentKey;
          break;
        case "Home":
          next = visibleRows[0]?.key ?? null;
          break;
        case "End":
          next = visibleRows[visibleRows.length - 1]?.key ?? null;
          break;
        case "Enter":
        case " ":
          pickRow(cur.key);
          break;
        default:
          return;
      }
      e.preventDefault();
      if (next !== null) moveFocus(next);
    },
    [visibleRows, activeKey, toggleExpand, pickRow, moveFocus],
  );

  if (forest.length === 0 && filterState === null) {
    return (
      <EmptyState
        testId="tree-view-empty"
        icon="layers"
        title="No hierarchy to show"
        description="The tree follows containment edges from a root node. Select a root or load a graph with containment relationships."
      />
    );
  }

  return (
    <div
      data-testid="tree-view"
      className={viewClass(className)}
      style={{
        fontSize: 13,
        overflow: "auto",
        color: "var(--g3t-text-primary, inherit)",
      }}
    >
      {/* Breadcrumb */}
      {showBreadcrumb && breadcrumb.length > 0 && (
        <div
          data-testid="tree-breadcrumb"
          style={{
            padding: "4px 8px",
            fontSize: 12,
            color: "var(--g3t-text-muted, #666)",
            borderBottom: "1px solid var(--g3t-border, #eee)",
          }}
        >
          {breadcrumb.map((b, i) => (
            <span key={b.id}>
              {i > 0 && " › "}
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--g3t-accent-primary, #2563eb)",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 12,
                }}
                onClick={() => selectId(b.id)}
              >
                {b.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Tree */}
      {forest.length === 0 ? (
        <EmptyState
          testId="tree-view-filter-empty"
          icon="layers"
          title="No rows match"
          description="No row label contains the filter text. Clear or shorten the filter."
        />
      ) : (
        <div role="tree" aria-label={ariaLabel} onKeyDown={onKeyDown}>
          {forest.map((root, i) => (
            <TreeNodeRow
              key={root.key}
              density={density}
              node={root}
              setSize={forest.length}
              posInSet={i + 1}
              showType={showType}
              activeKey={activeKey}
              isSelected={isSelected}
              renderLabel={renderLabel}
              onToggle={toggleExpand}
              onPick={pickRow}
              onFocusRow={moveFocus}
              registerItem={registerItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tree Node Component ─────────────────────────────────────────────

interface TreeNodeRowProps {
  node: TreeNode;
  setSize: number;
  posInSet: number;
  showType: boolean;
  /** The roving tab stop (a path key). */
  activeKey: string | null;
  /** Store membership (uncontrolled) or the one controlled id. */
  isSelected: (id: string) => boolean;
  renderLabel?: (node: TreeRowNode, ctx: TreeLabelContext) => ReactNode;
  onToggle: (key: string) => void;
  onPick: (key: string) => void;
  onFocusRow: (key: string) => void;
  registerItem: (key: string, el: HTMLDivElement | null) => void;
  density: "comfortable" | "compact";
}

function TreeNodeRow({
  node,
  setSize,
  posInSet,
  showType,
  activeKey,
  isSelected,
  renderLabel,
  onToggle,
  onPick,
  onFocusRow,
  registerItem,
  density,
}: TreeNodeRowProps) {
  // A group row is never selected, whatever the store or `selected`
  // holds (a host that points `selected` at a group gets no highlight).
  const selected = !node.group && isSelected(node.id);
  const isExpanded = node.children.length > 0;
  const indent = node.depth * 20;

  return (
    // The treeitem is the wrapper (it owns its group, as the ARIA
    // pattern requires); aria-label keeps the accessible name to the
    // row's own label rather than every descendant's. TreeView.css
    // moves the focus ring from the wrapper onto the row. The testids
    // carry the node id (a node under several parents repeats them);
    // `data-path` is the row's own identity.
    <div
      data-testid={`tree-node-${node.id}`}
      data-path={node.key}
      data-group={node.group ? "true" : undefined}
      className={node.group ? "g3t-tree-item g3t-tree-group" : "g3t-tree-item"}
      role="treeitem"
      aria-label={node.row.label}
      aria-level={node.depth + 1}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      // An expand-only row carries no aria-selected at all: the ARIA
      // tree pattern makes the attribute optional, and "false" on a
      // row that can never become true would read as a selectable
      // row that is not selected.
      aria-selected={node.group ? undefined : selected}
      aria-expanded={node.hasChildren ? isExpanded : undefined}
      tabIndex={node.key === activeKey ? 0 : -1}
      ref={(el) => registerItem(node.key, el)}
    >
      <div
        className="g3t-tree-row"
        style={{
          display: "flex",
          alignItems: "center",
          paddingLeft: indent,
          padding:
            density === "compact"
              ? `0px 6px 0px ${indent + 6}px`
              : `2px 8px 2px ${indent + 8}px`,
          backgroundColor: selected
            ? "var(--g3t-selection-highlight, rgba(37, 99, 235, 0.1))"
            : undefined,
          cursor: "pointer",
        }}
        onClick={() => {
          onFocusRow(node.key);
          onPick(node.key);
        }}
      >
        {node.hasChildren && (
          <button
            data-testid={`tree-toggle-${node.id}`}
            tabIndex={-1}
            disabled={node.lockedOpen}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: node.lockedOpen ? "default" : "pointer",
              padding: "0 4px",
              fontSize: 12,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onFocusRow(node.key);
              onToggle(node.key);
            }}
          >
            <Icon
              name={isExpanded ? "chevron-down" : "chevron-right"}
              size={12}
              label={isExpanded ? "Collapse" : "Expand"}
            />
          </button>
        )}
        {!node.hasChildren && (
          <span style={{ width: 20, display: "inline-block" }} />
        )}
        {showType && (
          <span
            data-testid={`tree-type-${node.id}`}
            style={{
              color: "var(--g3t-text-muted, #666)",
              fontSize: 11,
              marginRight: 4,
            }}
          >
            [{node.row.type}]
          </span>
        )}
        <span data-testid={`tree-label-${node.id}`}>
          {renderLabel
            ? renderLabel(node.row, {
                depth: node.depth,
                expanded: isExpanded,
                selected,
                childCount: node.childCount,
                group: node.group,
              })
            : node.row.label}
        </span>
      </div>
      {isExpanded && (
        <div role="group">
          {node.children.map((child, i) => (
            <TreeNodeRow
              density={density}
              key={child.key}
              node={child}
              setSize={node.children.length}
              posInSet={i + 1}
              showType={showType}
              activeKey={activeKey}
              isSelected={isSelected}
              renderLabel={renderLabel}
              onToggle={onToggle}
              onPick={onPick}
              onFocusRow={onFocusRow}
              registerItem={registerItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
