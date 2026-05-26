/**
 * PropertyFilter: multi-criteria filter model and evaluator (M11.E3.T1).
 *
 * The PropertyFilter and FilterGroup types are g3t's filter API; the
 * evaluator iterates UGM nodes and applies each filter's operator
 * directly against node properties. An earlier design called for a
 * crossfilter2-based bitmap-indexed backend; that integration was
 * dropped before v1.0.0-rc in favor of the simpler direct evaluator,
 * which is fast enough for the working-set sizes the toolkit targets
 * (see WorkingSetManager limits).
 *
 * ViewFilter (M11.E3.T3): graph-level visibility control.
 *
 * Framework-agnostic (D6).
 */

import type { UGM } from "../ugm";

// ── Filter Types ────────────────────────────────────────────────────

export interface PropertyFilter {
  key: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists";
  value?: unknown;
}

export interface FilterGroup {
  logic: "and" | "or";
  filters: Array<PropertyFilter | FilterGroup>;
}

// ── Filter Evaluator ────────────────────────────────────────────────

/**
 * Evaluate a filter group against a UGM. Returns the set of
 * node IDs that pass the filter.
 */
export function evaluateFilter(ugm: UGM, filter: FilterGroup): Set<string> {
  const result = new Set<string>();

  ugm.forEachNode((id, attrs) => {
    if (evaluateGroup(attrs.properties, filter)) {
      result.add(id);
    }
  });

  return result;
}

function evaluateGroup(
  props: Record<string, unknown>,
  group: FilterGroup,
): boolean {
  if (group.logic === "and") {
    return group.filters.every((f) => evaluateItem(props, f));
  }
  return group.filters.some((f) => evaluateItem(props, f));
}

function evaluateItem(
  props: Record<string, unknown>,
  item: PropertyFilter | FilterGroup,
): boolean {
  if ("logic" in item) {
    return evaluateGroup(props, item);
  }
  return evaluateCondition(props, item);
}

function evaluateCondition(
  props: Record<string, unknown>,
  filter: PropertyFilter,
): boolean {
  const actual = props[filter.key];

  switch (filter.operator) {
    case "exists":
      return actual !== undefined && actual !== null;
    case "eq":
      return actual === filter.value;
    case "neq":
      return actual !== filter.value;
    case "gt":
      return typeof actual === "number" && actual > (filter.value as number);
    case "gte":
      return typeof actual === "number" && actual >= (filter.value as number);
    case "lt":
      return typeof actual === "number" && actual < (filter.value as number);
    case "lte":
      return typeof actual === "number" && actual <= (filter.value as number);
    case "contains":
      return (
        typeof actual === "string" &&
        actual.toLowerCase().includes(String(filter.value).toLowerCase())
      );
    default:
      return true;
  }
}

// ── ViewFilter (M11.E3.T3) ──────────────────────────────────────────

/**
 * Graph-level visibility control. Sits between UGM and renderers.
 * Nodes not in visibleNodeIds (or in hiddenNodeIds) are not rendered.
 * Pinned nodes remain visible regardless of filters.
 */
export interface ViewFilter {
  /** If set, only these nodes are visible. null = show all. */
  visibleNodeIds: Set<string> | null;
  /** These nodes are explicitly hidden. */
  hiddenNodeIds: Set<string>;
  /** Pinned nodes are always visible despite filters. */
  pinnedNodeIds: Set<string>;
}

export function createViewFilter(): ViewFilter {
  return {
    visibleNodeIds: null,
    hiddenNodeIds: new Set(),
    pinnedNodeIds: new Set(),
  };
}

/**
 * Apply a ViewFilter to determine which nodes/edges are visible.
 */
export function applyViewFilter(
  ugm: UGM,
  filter: ViewFilter,
): { visibleNodes: string[]; visibleEdges: string[] } {
  const visibleNodes: string[] = [];

  ugm.forEachNode((id) => {
    // Pinned nodes are always visible
    if (filter.pinnedNodeIds.has(id)) {
      visibleNodes.push(id);
      return;
    }
    // Hidden nodes are always hidden
    if (filter.hiddenNodeIds.has(id)) return;
    // If visibleNodeIds is set, only those are shown
    if (filter.visibleNodeIds !== null && !filter.visibleNodeIds.has(id))
      return;
    visibleNodes.push(id);
  });

  const visibleNodeSet = new Set(visibleNodes);
  const visibleEdges: string[] = [];

  ugm.forEachEdge((id, _attrs, source, target) => {
    if (visibleNodeSet.has(source) && visibleNodeSet.has(target)) {
      visibleEdges.push(id);
    }
  });

  return { visibleNodes, visibleEdges };
}

/**
 * Show only the selected nodes (hide everything else).
 */
export function showOnlySelected(selectedNodeIds: Set<string>): ViewFilter {
  return {
    visibleNodeIds: new Set(selectedNodeIds),
    hiddenNodeIds: new Set(),
    pinnedNodeIds: new Set(),
  };
}

/**
 * Hide the selected nodes (keep everything else).
 */
export function hideSelected(
  selectedNodeIds: Set<string>,
  existing?: ViewFilter,
): ViewFilter {
  const base = existing ?? createViewFilter();
  const hidden = new Set(base.hiddenNodeIds);
  for (const id of selectedNodeIds) hidden.add(id);
  return { ...base, hiddenNodeIds: hidden };
}

/**
 * Show only the N-hop neighborhood of a node.
 */
export function expandToNHops(
  ugm: UGM,
  centerNodeId: string,
  hops: number,
): ViewFilter {
  const visited = new Set<string>();
  let frontier = new Set<string>([centerNodeId]);

  for (let i = 0; i <= hops; i++) {
    for (const id of frontier) visited.add(id);
    if (i === hops) break;
    const next = new Set<string>();
    for (const id of frontier) {
      for (const neighbor of ugm.getNeighbors(id)) {
        if (!visited.has(neighbor)) next.add(neighbor);
      }
    }
    frontier = next;
  }

  return {
    visibleNodeIds: visited,
    hiddenNodeIds: new Set(),
    pinnedNodeIds: new Set(),
  };
}
