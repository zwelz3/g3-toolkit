/**
 * TreeView: containment hierarchy with lazy-load (M5.E4.T1).
 *
 * Renders a tree (or a forest) rooted at the given node(s). The first
 * `initialDepth` levels open on mount; deeper levels load on click.
 * Enforces the working-set limit (1,000 nodes). Breadcrumb trail for
 * navigation. Keyboard-operable as a WAI-ARIA tree: one tab stop
 * (roving tabindex), arrows move and open/close, Home/End jump,
 * Enter/Space select.
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
} from "react";
import type { UGM } from "@g3-toolkit/core";
import { useSelectionStore } from "../../state/selection-store";
import { useWorkingSetManager } from "../../state/working-set-context";
import type { WorkingSetManager } from "@g3-toolkit/core";
import { Icon } from "../../icons";
import { EmptyState } from "../../interaction/feedback";
import { viewClass } from "../../theme/view-class";
import "./TreeView.css";

export interface TreeViewProps {
  /** Row density (B3): "comfortable" (default) or "compact". */
  density?: "comfortable" | "compact";
  /** Upstream P3 (prm-analyzer, 2026-07-28): render the breadcrumb
   *  trail. Default true. */
  showBreadcrumb?: boolean;
  /** Upstream round-6 P3: observe row selection (tree-to-canvas
   *  sync for hosts outside the selection store). */
  onSelect?: (id: string) => void;
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
   * root it is NOT repeated as that root's descendant, so each node
   * renders once and the forest does not reshape as rows open.
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

interface TreeNode {
  id: string;
  label: string;
  type: string;
  children: TreeNode[];
  depth: number;
  hasChildren: boolean;
  /** Expanded per the seed/toggle state. `children` may still be
   *  empty when the working-set limit cut the build short. */
  expanded: boolean;
}

/** One row of the rendered (visible) order, for keyboard movement. */
interface VisibleRow {
  id: string;
  parentId: string | null;
  firstChildId: string | null;
  hasChildren: boolean;
  expanded: boolean;
}

const EMPTY_ROOTS: string[] = [];

export function TreeView({
  showBreadcrumb = true,
  onSelect,
  density = "comfortable",
  ugm,
  rootId,
  rootIds = EMPTY_ROOTS,
  initialDepth = 2,
  showType = true,
  workingSetManager,
  className,
}: TreeViewProps) {
  const { selectedNodeIds, selectNodes } = useSelectionStore();
  const workingSet = useWorkingSetManager(workingSetManager);
  // User toggles, NOT the expanded set. A row is expanded when its
  // seed membership XOR its toggle membership holds (see `isExpanded`
  // below). Before issue #36 the row test was
  // `depth < initialDepth || expandedIds.has(id)`, so a row inside
  // initialDepth could never collapse: the depth clause re-opened it
  // on every render. Keeping toggles separate from the seed is what
  // lets the seed be recomputed on a graph change without discarding
  // what the user did.
  const [toggledIds, setToggledIds] = useState<Set<string>>(new Set());
  const selectedId = [...selectedNodeIds][0] ?? null;

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

  // Seed: the ids a first render opens. Walks exactly what the
  // pre-#36 build opened (depth < initialDepth, first visit wins), so
  // the initial picture is unchanged; only the collapse works now.
  const seedIds = useMemo(() => {
    const seed = new Set<string>();
    const rootSet = new Set(roots);
    const visited = new Set<string>();
    const walk = (id: string, depth: number): void => {
      visited.add(id);
      if (depth >= initialDepth) return;
      seed.add(id);
      for (const c of childrenOf.get(id) ?? []) {
        if (!visited.has(c) && !rootSet.has(c)) walk(c, depth + 1);
      }
    };
    for (const r of roots) if (!visited.has(r)) walk(r, 0);
    return seed;
  }, [childrenOf, roots, initialDepth]);

  // Build the forest (DFS, working-set limit).
  const forest = useMemo((): TreeNode[] => {
    if (roots.length === 0) return [];
    const rootSet = new Set(roots);
    const visited = new Set<string>();
    let nodeCount = 0;
    const limit = workingSet.getLimit("tree");
    const isExpanded = (id: string): boolean =>
      seedIds.has(id) !== toggledIds.has(id);

    function build(nodeId: string, depth: number): TreeNode {
      visited.add(nodeId);
      nodeCount++;
      const attrs = ugm.getNode(nodeId);
      const childIds = (childrenOf.get(nodeId) ?? []).filter(
        (c) => !visited.has(c) && !rootSet.has(c),
      );
      const expanded = isExpanded(nodeId);

      return {
        id: nodeId,
        label:
          typeof attrs?.properties.name === "string"
            ? attrs.properties.name
            : nodeId,
        type: attrs?.types[0] ?? "Unknown",
        depth,
        hasChildren: childIds.length > 0,
        expanded,
        children:
          expanded && nodeCount < limit
            ? childIds.map((c) => build(c, depth + 1))
            : [],
      };
    }

    return roots.map((r) => build(r, 0));
  }, [ugm, roots, childrenOf, seedIds, toggledIds, workingSet]);

  const toggleExpand = useCallback((nodeId: string) => {
    setToggledIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Visible rows in render order: the keyboard model. A row with
  // `expanded` but no built children (working-set cut) reads as a
  // leaf here, matching the chevron it shows.
  const visibleRows = useMemo<VisibleRow[]>(() => {
    const rows: VisibleRow[] = [];
    const visit = (node: TreeNode, parentId: string | null): void => {
      const open = node.children.length > 0;
      rows.push({
        id: node.id,
        parentId,
        firstChildId: node.children[0]?.id ?? null,
        hasChildren: node.hasChildren,
        expanded: open,
      });
      if (open) for (const child of node.children) visit(child, node.id);
    };
    for (const root of forest) visit(root, null);
    return rows;
  }, [forest]);

  // Roving tabindex: exactly one row is the tab stop. Falls back to
  // the first visible row when the remembered one is no longer
  // visible (collapsed away, or gone with a graph change).
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const activeId = useMemo(() => {
    if (focusedId && visibleRows.some((r) => r.id === focusedId)) {
      return focusedId;
    }
    return visibleRows[0]?.id ?? null;
  }, [focusedId, visibleRows]);

  // DOM focus follows a keyboard move only (never on mount, never on
  // a graph change), so the tree does not steal focus from the host.
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingFocusRef = useRef<string | null>(null);
  const registerItem = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (pending === null) return;
    pendingFocusRef.current = null;
    itemRefs.current.get(pending)?.focus();
  });
  const moveFocus = useCallback((id: string) => {
    pendingFocusRef.current = id;
    setFocusedId(id);
  }, []);

  // True breadcrumb: the ancestor PATH (root -> ... -> selected) of
  // the selected node, derived from containment edges. This replaces
  // the former click-history trail, which showed an arbitrary sequence
  // of clicked nodes rather than a hierarchy path and never reset to a
  // real path when an ancestor was clicked.
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

  const navigateTo = useCallback(
    (nodeId: string) => {
      selectNodes([nodeId]);
      onSelect?.(nodeId);
    },
    [selectNodes, onSelect],
  );

  // WAI-ARIA tree keyboard model, handled once at the tree root over
  // the visible-row list rather than per row. Only a treeitem's own
  // keys are handled: the toggle button (tabIndex -1, reachable by
  // pointer) keeps its native Enter/Space.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.getAttribute("role") !== "treeitem") return;
      const idx = visibleRows.findIndex((r) => r.id === activeId);
      const cur = visibleRows[idx];
      if (!cur) return;
      let next: string | null = null;
      switch (e.key) {
        case "ArrowDown":
          next = visibleRows[idx + 1]?.id ?? null;
          break;
        case "ArrowUp":
          next = visibleRows[idx - 1]?.id ?? null;
          break;
        case "ArrowRight":
          if (cur.hasChildren && !cur.expanded) toggleExpand(cur.id);
          else next = cur.firstChildId;
          break;
        case "ArrowLeft":
          if (cur.expanded) toggleExpand(cur.id);
          else next = cur.parentId;
          break;
        case "Home":
          next = visibleRows[0]?.id ?? null;
          break;
        case "End":
          next = visibleRows[visibleRows.length - 1]?.id ?? null;
          break;
        case "Enter":
        case " ":
          navigateTo(cur.id);
          break;
        default:
          return;
      }
      e.preventDefault();
      if (next !== null) moveFocus(next);
    },
    [visibleRows, activeId, toggleExpand, navigateTo, moveFocus],
  );

  if (forest.length === 0) {
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
                onClick={() => navigateTo(b.id)}
              >
                {b.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Tree */}
      <div role="tree" aria-label="Hierarchy" onKeyDown={onKeyDown}>
        {forest.map((root, i) => (
          <TreeNodeRow
            key={root.id}
            density={density}
            node={root}
            setSize={forest.length}
            posInSet={i + 1}
            showType={showType}
            activeId={activeId}
            selectedNodeIds={selectedNodeIds}
            onSelect={selectNodes}
            onToggle={toggleExpand}
            onNavigate={navigateTo}
            onFocusRow={moveFocus}
            registerItem={registerItem}
          />
        ))}
      </div>
    </div>
  );
}

// ── Tree Node Component ─────────────────────────────────────────────

interface TreeNodeRowProps {
  node: TreeNode;
  setSize: number;
  posInSet: number;
  showType: boolean;
  /** The roving tab stop. */
  activeId: string | null;
  // ReadonlySet: this row only calls .has(). Declaring the mutable
  // type here was what made SelectionState's narrowing surface as an
  // error, which is the narrowing doing its job.
  selectedNodeIds: ReadonlySet<string>;
  onSelect: (ids: string[]) => void;
  onToggle: (nodeId: string) => void;
  onNavigate: (nodeId: string) => void;
  onFocusRow: (nodeId: string) => void;
  registerItem: (id: string, el: HTMLDivElement | null) => void;
  density: "comfortable" | "compact";
}

function TreeNodeRow({
  node,
  setSize,
  posInSet,
  showType,
  activeId,
  selectedNodeIds,
  onSelect,
  onToggle,
  onNavigate,
  onFocusRow,
  registerItem,
  density,
}: TreeNodeRowProps) {
  const isSelected = selectedNodeIds.has(node.id);
  const isExpanded = node.children.length > 0;
  const indent = node.depth * 20;

  return (
    // The treeitem is the wrapper (it owns its group, as the ARIA
    // pattern requires); aria-label keeps the accessible name to the
    // row's own label rather than every descendant's. TreeView.css
    // moves the focus ring from the wrapper onto the row.
    <div
      data-testid={`tree-node-${node.id}`}
      className="g3t-tree-item"
      role="treeitem"
      aria-label={node.label}
      aria-level={node.depth + 1}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      aria-selected={isSelected}
      aria-expanded={node.hasChildren ? isExpanded : undefined}
      tabIndex={node.id === activeId ? 0 : -1}
      ref={(el) => registerItem(node.id, el)}
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
          backgroundColor: isSelected
            ? "var(--g3t-selection-highlight, rgba(37, 99, 235, 0.1))"
            : undefined,
          cursor: "pointer",
        }}
        onClick={() => {
          onFocusRow(node.id);
          onSelect([node.id]);
          onNavigate(node.id);
        }}
      >
        {node.hasChildren && (
          <button
            data-testid={`tree-toggle-${node.id}`}
            tabIndex={-1}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: "0 4px",
              fontSize: 12,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onFocusRow(node.id);
              onToggle(node.id);
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
            [{node.type}]
          </span>
        )}
        <span>{node.label}</span>
      </div>
      {isExpanded && (
        <div role="group">
          {node.children.map((child, i) => (
            <TreeNodeRow
              density={density}
              key={child.id}
              node={child}
              setSize={node.children.length}
              posInSet={i + 1}
              showType={showType}
              activeId={activeId}
              selectedNodeIds={selectedNodeIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onNavigate={onNavigate}
              onFocusRow={onFocusRow}
              registerItem={registerItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}
