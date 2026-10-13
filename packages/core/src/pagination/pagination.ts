/**
 * Paging over UGM query results (issue #6).
 *
 * Every view that can exceed its working-set limit was answering the
 * same question differently: the table paged (TanStack, view-local),
 * the matrix truncated, canvas/tree/streaming refused. This module is
 * the shared vocabulary: a `PageWindow` descriptor says which slice of
 * a result a view holds, and the `page*` helpers cut that slice with a
 * STABLE order, because a page over an unordered result is meaningless
 * (the same offset must name the same items on every call).
 *
 * Ordering guarantee: items are sorted by id with a plain code-unit
 * comparison (`<`), never `localeCompare`, so the order is the same in
 * every locale and runtime; a caller who wants another order passes
 * `order`, a comparator, and the guarantee becomes "sorted by that
 * comparator, ties broken by id". The sort runs on every call, so a
 * mutation between two calls shifts later pages exactly as the
 * mutated order dictates and never reorders untouched items.
 *
 * Offset form only. The in-memory UGM has no cursor-based query layer
 * (it holds the whole graph), so a cursor variant would be a promise
 * with nothing behind it. `totalExact` exists for the day a backend
 * answers with an estimate instead of a count: an in-memory page is
 * always exact.
 *
 * Framework-agnostic (D6).
 */

import type { UGM } from "../ugm";

/** Which slice of a result a view holds. */
export interface PageWindow {
  /** Zero-based index of the first item in the window. */
  offset: number;
  /** Requested page size (the window may hold fewer items at the end). */
  size: number;
  /** Total items in the result the window is cut from. */
  total: number;
  /** Whether `total` is a count (true) or a backend estimate (false).
   *  Pages cut in memory are always exact. */
  totalExact: boolean;
}

/** Request for one page. */
export interface PageRequest<T = string> {
  /** Zero-based offset; clamped to [0, total]. Default 0. */
  offset?: number;
  /** Page size; must be a positive integer. */
  size: number;
  /** Comparator replacing the default id order. Ties fall back to the
   *  id order so the result stays stable. */
  order?: (a: T, b: T) => number;
}

/** One page: the window descriptor plus the items in it. */
export interface PageResult<T = string> {
  window: PageWindow;
  items: T[];
}

function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function assertSize(size: number): void {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(
      `page size must be a positive integer, received ${String(size)}`,
    );
  }
}

/**
 * Page an array of string items (node ids, category labels) with the
 * stable ordering guarantee documented above. The input is not
 * mutated. Duplicates are kept (the caller decides whether its result
 * is a set).
 */
export function pageItems(
  items: readonly string[],
  request: PageRequest<string>,
): PageResult<string> {
  assertSize(request.size);
  const order = request.order;
  const sorted = [...items].sort(
    order ? (a, b) => order(a, b) || codeUnitCompare(a, b) : codeUnitCompare,
  );
  const total = sorted.length;
  const offset = Math.min(Math.max(0, Math.floor(request.offset ?? 0)), total);
  return {
    window: { offset, size: request.size, total, totalExact: true },
    items: sorted.slice(offset, offset + request.size),
  };
}

/**
 * Page the node ids of a UGM. Order: by id (code-unit), or by the
 * caller's comparator with id as the tie-break.
 */
export function pageNodes(
  ugm: Pick<UGM, "getNodeIds">,
  request: PageRequest<string>,
): PageResult<string> {
  return pageItems(ugm.getNodeIds(), request);
}

/**
 * Page a set of category labels (the matrix's node types, a facet's
 * values). Accepts any iterable; a Set is the usual input. Same
 * ordering guarantee as `pageNodes`.
 */
export function pageCategories(
  categories: Iterable<string>,
  request: PageRequest<string>,
): PageResult<string> {
  return pageItems([...categories], request);
}

/** Number of pages a window implies (at least 1, so "page 1 of 1"
 *  reads correctly for an empty result). */
export function pageCount(window: Pick<PageWindow, "size" | "total">): number {
  return Math.max(1, Math.ceil(window.total / Math.max(1, window.size)));
}

/** Zero-based index of the page a window sits on. */
export function pageIndex(window: Pick<PageWindow, "offset" | "size">): number {
  return Math.floor(window.offset / Math.max(1, window.size));
}
