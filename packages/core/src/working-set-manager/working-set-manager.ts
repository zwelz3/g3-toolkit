/**
 * WorkingSetManager: enforces per-view-type element limits.
 *
 * Each view type has a default maximum (P2). Admin can override
 * via config. Views call checkLimit() before loading data and
 * prompt the user if the limit would be exceeded.
 *
 * ## Precedence (issue #5, specs/09 D5)
 *
 * Three layers resolve to one effective limit per view, and the
 * order is the contract:
 *
 * 1. Built-in defaults (`DEFAULT_LIMITS`).
 * 2. Deployment configuration: the constructor overrides, or a
 *    `WorkingSetConfig` document through `fromConfig`, which sets a
 *    soft `default` and/or a hard `ceiling` per view. `setLimit` is
 *    the administrator-level mutator of that soft default.
 * 3. A per-user override (`setUserOverride`), the "Show all with a
 *    performance warning" action. It may move the limit freely
 *    below the ceiling and is REFUSED above it, as a typed result
 *    rather than a throw, so a view can word the refusal instead of
 *    offering a prompt that cannot succeed.
 *
 * The ceiling bounds every layer: a built-in default above a
 * configured ceiling clamps to the ceiling, and the effective limit
 * is never above it. A configured default above its own ceiling is
 * rejected when the document is validated, not clamped here.
 *
 * `checkLimit` and `getLimit` read the resolved `limits` record;
 * every mutator recomputes it, so their bodies stay as they were.
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

import { validateWorkingSetConfig } from "./working-set-config";
import type { WorkingSetConfig } from "./working-set-config";

export type ViewType =
  | "canvas"
  | "table"
  | "tree"
  | "matrix"
  | "sankey"
  | "streaming";

const VIEW_TYPES: readonly ViewType[] = [
  "canvas",
  "table",
  "tree",
  "matrix",
  "sankey",
  "streaming",
];

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

/** A user-level raise that the manager accepts. `limit` is the resulting limit. */
export interface RaiseAllowed {
  ok: true;
  viewType: ViewType;
  requested: number;
  limit: number;
  ceiling?: number;
}

/**
 * A user-level raise the manager refuses. `above-ceiling` is the
 * administrator's hard limit (D5); `invalid` is a value that is not a
 * positive integer. Never thrown: a refusal is an expected answer a
 * view words for the user, not a programming error.
 */
export interface RaiseRefused {
  ok: false;
  reason: "above-ceiling" | "invalid";
  viewType: ViewType;
  requested: number;
  /** The limit that stays in force. */
  limit: number;
  ceiling?: number;
}

export type RaiseResult = RaiseAllowed | RaiseRefused;

// @see R7.1, R7.7: configurable working-set limits
export class WorkingSetManager {
  /** The resolved limits, recomputed by every mutator (see precedence). */
  private readonly limits: Record<ViewType, number>;
  /** Layer 2: deployment soft defaults (constructor overrides, config, setLimit). */
  private readonly deploymentDefaults: Partial<Record<ViewType, number>>;
  /** Layer 2: deployment hard ceilings; absent means unbounded. */
  private readonly ceilings: Partial<Record<ViewType, number>>;
  /** Layer 3: per-user overrides, always within the ceiling. */
  private readonly userOverrides: Partial<Record<ViewType, number>> = {};

  constructor(
    overrides?: Partial<Record<ViewType, number>>,
    ceilings?: Partial<Record<ViewType, number>>,
  ) {
    this.deploymentDefaults = { ...overrides };
    this.ceilings = { ...ceilings };
    this.limits = { ...DEFAULT_LIMITS };
    for (const view of VIEW_TYPES) this.recompute(view);
  }

  /**
   * Build a manager from a deployment configuration document. The
   * document is validated first (it is hand-authored; see
   * working-set-config.ts), so a malformed one throws a typed
   * `DocumentParseError` at host setup rather than configuring
   * nothing.
   */
  static fromConfig(
    doc: WorkingSetConfig | Record<string, unknown>,
  ): WorkingSetManager {
    const config = validateWorkingSetConfig(doc);
    const defaults: Partial<Record<ViewType, number>> = {};
    const ceilings: Partial<Record<ViewType, number>> = {};
    for (const view of VIEW_TYPES) {
      const entry = config.limits?.[view];
      if (entry?.default !== undefined) defaults[view] = entry.default;
      if (entry?.ceiling !== undefined) ceilings[view] = entry.ceiling;
    }
    return new WorkingSetManager(defaults, ceilings);
  }

  /** Resolve one view's effective limit from the three layers. */
  private recompute(viewType: ViewType): void {
    const base =
      this.userOverrides[viewType] ??
      this.deploymentDefaults[viewType] ??
      DEFAULT_LIMITS[viewType];
    const ceiling = this.ceilings[viewType];
    this.limits[viewType] =
      ceiling === undefined ? base : Math.min(base, ceiling);
  }

  /** The administrator ceiling for a view, or undefined when unbounded. */
  getCeiling(viewType: ViewType): number | undefined {
    return this.ceilings[viewType];
  }

  /**
   * Would a user-level override to `value` be accepted? Pure: answers
   * without changing anything, so a view can decide between a
   * "Show all" prompt (ok) and a refusal message (not ok) before it
   * offers either.
   */
  canRaise(viewType: ViewType, value: number): RaiseResult {
    const ceiling = this.ceilings[viewType];
    const limit = this.limits[viewType];
    const base = { viewType, requested: value, ceiling };
    if (!Number.isInteger(value) || value < 1) {
      return { ok: false, reason: "invalid", limit, ...base };
    }
    if (ceiling !== undefined && value > ceiling) {
      return { ok: false, reason: "above-ceiling", limit, ...base };
    }
    return { ok: true, limit: value, ...base };
  }

  /**
   * Apply a user-level override (the explicit "Show all" action).
   * Returns the same typed result as `canRaise`; on refusal nothing
   * changes and the result carries the limit that stays in force.
   */
  setUserOverride(viewType: ViewType, value: number): RaiseResult {
    const result = this.canRaise(viewType, value);
    if (result.ok) {
      this.userOverrides[viewType] = value;
      this.recompute(viewType);
    }
    return result;
  }

  /** Drop a user-level override, returning to the deployment default. */
  clearUserOverride(viewType: ViewType): void {
    this.userOverrides[viewType] = undefined;
    this.recompute(viewType);
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

  /**
   * Set the deployment soft default (admin use). Still bounded by the
   * ceiling, and shadowed by a user override while one is set; the
   * effective value is what `getLimit` reports afterwards.
   */
  setLimit(viewType: ViewType, value: number): void {
    this.deploymentDefaults[viewType] = value;
    this.recompute(viewType);
  }
}
