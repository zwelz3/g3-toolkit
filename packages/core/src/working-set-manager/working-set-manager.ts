/**
 * WorkingSetManager: enforces per-view-type element limits.
 *
 * Each view type has a default maximum (P2). Admin can override
 * via config. Views call checkLimit() before loading data and
 * prompt the user if the limit would be exceeded.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/07-ux-defaults-accessibility.md R7.1-R7.7
 * @see specs/09-design-decisions.md D5, P2
 */

// Implements: R7.1 (canvas 500 node limit), R7.2 (tree 1000 node limit),
// R7.3 (matrix 200x200 limit), R7.4 (table 10000 row limit),
// Sankey flow-path cap (requirement removed from the roadmap
// 2026-06-12; behavior retained as-is), R7.7 (configurable limits).

export type ViewType =
  | "canvas"
  | "table"
  | "tree"
  | "matrix"
  | "sankey"
  | "streaming";

/** Default limits per view type (P2). */
const DEFAULT_LIMITS: Record<ViewType, number> = {
  canvas: 500,
  table: 10_000,
  tree: 1_000,
  matrix: 200,
  sankey: 100,
  streaming: 500,
};

/**
 * What a view should do about a count (issue #6). `allowed: boolean`
 * only answered "may I render this"; each view then invented its own
 * answer to "so what do I do instead", which is how the table paged,
 * the matrix truncated and the canvas prompted, with no shared
 * concept between them.
 *
 *   allow     within the limit; render as is
 *   refuse    do not render; prompt the user (an explicit action is
 *             needed to exceed the limit)
 *   truncate  render the first `limit` items and announce the cut
 *   page      render `pageSize` items at a time with a control that
 *             reaches the rest (see `pageNodes` / `pageCategories`
 *             and the PaginationControl molecule in @g3-toolkit/react)
 */
export type LimitStrategy = "allow" | "refuse" | "truncate" | "page";

/**
 * Default strategy per view type when the count EXCEEDS the limit. A
 * view passes its own strategy to `checkLimit` to override a row.
 * Canvas, tree and streaming refuse because paging a LAYOUT is a
 * different problem from paging a list (issue #6 scopes it out);
 * table and matrix page; sankey keeps its flow-path cap (truncate).
 */
export const DEFAULT_LIMIT_STRATEGIES: Readonly<
  Record<ViewType, LimitStrategy>
> = {
  canvas: "refuse",
  table: "page",
  tree: "refuse",
  matrix: "page",
  sankey: "truncate",
  streaming: "refuse",
};

export interface LimitCheckResult {
  /** True when `requested <= limit`. Kept for existing callers. */
  allowed: boolean;
  limit: number;
  requested: number;
  /** What the view should do; "allow" whenever `allowed` is true. */
  strategy: LimitStrategy;
  /** Items per page the view should render (the limit): meaningful
   *  for "page", and the size of the kept slice for "truncate". */
  pageSize: number;
}

// @see R7.1, R7.7: configurable working-set limits
export class WorkingSetManager {
  private readonly limits: Record<ViewType, number>;

  constructor(overrides?: Partial<Record<ViewType, number>>) {
    this.limits = { ...DEFAULT_LIMITS, ...overrides };
  }

  /**
   * Check whether the requested count is within the limit for
   * the given view type, and say what to do when it is not.
   * `strategy` overrides the DEFAULT_LIMIT_STRATEGIES row for this
   * call (a matrix host that would rather aggregate passes
   * "truncate"; a table that cannot page passes "refuse").
   */
  checkLimit(
    viewType: ViewType,
    count: number,
    strategy?: Exclude<LimitStrategy, "allow">,
  ): LimitCheckResult {
    const limit = this.limits[viewType];
    const allowed = count <= limit;
    return {
      allowed,
      limit,
      requested: count,
      strategy: allowed
        ? "allow"
        : (strategy ?? DEFAULT_LIMIT_STRATEGIES[viewType]),
      pageSize: limit,
    };
  }

  /** Get the current limit for a view type. */
  getLimit(viewType: ViewType): number {
    return this.limits[viewType];
  }

  /** Override a limit (admin use). */
  setLimit(viewType: ViewType, value: number): void {
    this.limits[viewType] = value;
  }
}
