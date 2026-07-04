/**
 * TreeView: containment hierarchy with lazy-load (M5.E4.T1).
 *
 * Renders a tree rooted at a given node. Expands first 2 levels
 * by default; deeper levels load on click. Enforces working-set
 * limit (1,000 nodes). Breadcrumb trail for navigation.
 *
 * @see specs/01-functional-views.md R1.6
 * @see specs/07-ux-defaults-accessibility.md R7.2
 */

import { useState, useMemo, useCallback } from "react";
import type { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";
import type { WorkingSetManager } from "@g3t/core";
import { Icon } from "../../icons";
import { EmptyState } from "../../interaction/feedback";

export interface TreeViewProps {
  /** Row density (B3): "comfortable" (default) or "compact". */
  density?: "comfortable" | "compact";
  ugm: UGM;
  /** Root node ID for the tree. If omitted, auto-detects. */
  rootId?: string;
  /** Maximum initial depth to expand (default 2). */
  initialDepth?: number;
  /** Working-set manager for limit enforcement. */
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
}

export function TreeView({
  density = "comfortable",
  ugm,
  rootId,
  initialDepth = 2,
  workingSetManager,
  className,
}: TreeViewProps) {
  const { selectedNodeIds, selectNodes } = useSelectionStore();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const selectedId = [...selectedNodeIds][0] ?? null;

  // Find root: explicit, or auto-detect (node with no incoming edges)
  const effectiveRootId = useMemo(() => {
    if (rootId) return rootId;
    const hasIncoming = new Set<string>();
    ugm.forEachEdge((_id, _attrs, _source, target) => {
      hasIncoming.add(target);
    });
    let found: string | null = null;
    ugm.forEachNode((id) => {
      if (found === null && !hasIncoming.has(id)) found = id;
    });
    return found ?? ugm.getNodeIds()[0] ?? null;
  }, [ugm, rootId]);

  // Build tree structure (BFS with depth limit)
  const tree = useMemo((): TreeNode | null => {
    if (!effectiveRootId || !ugm.hasNode(effectiveRootId)) return null;

    const children = new Map<string, string[]>();
    ugm.forEachEdge((_id, _attrs, source, target) => {
      if (!children.has(source)) children.set(source, []);
      children.get(source)?.push(target);
    });

    const visited = new Set<string>();
    let nodeCount = 0;
    const limit = workingSetManager?.getLimit("tree") ?? 1000;

    function build(nodeId: string, depth: number): TreeNode {
      visited.add(nodeId);
      nodeCount++;
      const attrs = ugm.getNode(nodeId);
      const childIds = (children.get(nodeId) ?? []).filter(
        (c) => !visited.has(c),
      );
      const isExpanded = depth < initialDepth || expandedIds.has(nodeId);

      return {
        id: nodeId,
        label:
          typeof attrs?.properties.name === "string"
            ? attrs.properties.name
            : nodeId,
        type: attrs?.types[0] ?? "Unknown",
        depth,
        hasChildren: childIds.length > 0,
        children:
          isExpanded && nodeCount < limit
            ? childIds.map((c) => build(c, depth + 1))
            : [],
      };
    }

    return build(effectiveRootId, 0);
  }, [ugm, effectiveRootId, initialDepth, expandedIds, workingSetManager]);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
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
    },
    [selectNodes],
  );

  if (!tree) {
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
      className={className}
      style={{ fontSize: 13, overflow: "auto" }}
    >
      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <div
          data-testid="tree-breadcrumb"
          style={{
            padding: "4px 8px",
            fontSize: 12,
            color: "#666",
            borderBottom: "1px solid #eee",
          }}
        >
          {breadcrumb.map((b, i) => (
            <span key={b.id}>
              {i > 0 && " › "}
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
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
      <TreeNodeRow
        density={density}
        node={tree}
        selectedNodeIds={selectedNodeIds}
        onSelect={selectNodes}
        onToggle={toggleExpand}
        onNavigate={navigateTo}
      />
    </div>
  );
}

// ── Tree Node Component ─────────────────────────────────────────────

interface TreeNodeRowProps {
  node: TreeNode;
  selectedNodeIds: Set<string>;
  onSelect: (ids: string[]) => void;
  onToggle: (nodeId: string) => void;
  onNavigate: (nodeId: string) => void;
  density: "comfortable" | "compact";
}

function TreeNodeRow({
  node,
  selectedNodeIds,
  onSelect,
  onToggle,
  onNavigate,
  density,
}: TreeNodeRowProps) {
  const isSelected = selectedNodeIds.has(node.id);
  const isExpanded = node.children.length > 0;
  const indent = node.depth * 20;

  return (
    <div data-testid={`tree-node-${node.id}`}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingLeft: indent,
          padding:
            density === "compact"
              ? `0px 6px 0px ${indent + 6}px`
              : `2px 8px 2px ${indent + 8}px`,
          backgroundColor: isSelected ? "rgba(37, 99, 235, 0.1)" : undefined,
          cursor: "pointer",
        }}
        onClick={() => {
          onSelect([node.id]);
          onNavigate(node.id);
        }}
      >
        {node.hasChildren && (
          <button
            data-testid={`tree-toggle-${node.id}`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 4px",
              fontSize: 12,
            }}
            onClick={(e) => {
              e.stopPropagation();
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
        <span style={{ color: "#666", fontSize: 11, marginRight: 4 }}>
          [{node.type}]
        </span>
        <span>{node.label}</span>
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <TreeNodeRow
            density={density}
            key={child.id}
            node={child}
            selectedNodeIds={selectedNodeIds}
            onSelect={onSelect}
            onToggle={onToggle}
            onNavigate={onNavigate}
          />
        ))}
    </div>
  );
}
