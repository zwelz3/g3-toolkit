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

export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  requested: number;
}

// @see R7.1, R7.7: configurable working-set limits
export class WorkingSetManager {
  private readonly limits: Record<ViewType, number>;

  constructor(overrides?: Partial<Record<ViewType, number>>) {
    this.limits = { ...DEFAULT_LIMITS, ...overrides };
  }

  /**
   * Check whether the requested count is within the limit for
   * the given view type.
   */
  checkLimit(viewType: ViewType, count: number): LimitCheckResult {
    const limit = this.limits[viewType];
    return {
      allowed: count <= limit,
      limit,
      requested: count,
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
