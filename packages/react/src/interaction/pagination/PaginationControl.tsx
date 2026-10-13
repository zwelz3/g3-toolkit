/**
 * PaginationControl (Molecules/PaginationControl, issue #6).
 *
 * One prev/next control for every view that pages: the matrix uses it
 * per axis, and TableView's TanStack bar is the next adopter (it keeps
 * its own markup this round; the visual language here is copied from
 * it on purpose so the two read as one thing until then).
 *
 * State is the caller's: a zero-based `page`, the `pageSize` and the
 * `total` (a core `PageWindow` maps onto these as offset = page *
 * size). The control derives the page count and the "rows 1 to 200 of
 * 350" summary; an inexact total (a backend estimate, `totalExact:
 * false`) reads "of about 350".
 *
 * Keyboard: the buttons are native, so Enter/Space work; in addition
 * ArrowLeft/ArrowRight move one page and Home/End jump to the first
 * and last page from anywhere inside the control, so a user tabbed
 * onto Prev does not have to find Next. Bound buttons are disabled
 * (same convention as TableView) rather than aria-disabled.
 */

import type { CSSProperties, KeyboardEvent } from "react";
import { Icon } from "../../icons";
import { viewClass } from "../../theme/view-class";
import "./PaginationControl.css";

export interface PaginationControlProps {
  /** Zero-based page index. */
  page: number;
  /** Items per page; the page count is derived from it and `total`. */
  pageSize: number;
  /** Total items across all pages. */
  total: number;
  /** False when `total` is an estimate; the summary then says "about". */
  totalExact?: boolean;
  /** Receives the next zero-based page index. */
  onPageChange: (page: number) => void;
  /** Offer a page-size select with these options. Needs
   *  `onPageSizeChange`; without it no select renders. */
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (pageSize: number) => void;
  /** Noun for the summary and the aria-labels ("rows", "columns").
   *  Default "items". */
  noun?: string;
  /** Accessible name of the control. Default "<Noun> pagination". */
  ariaLabel?: string;
  /** Hide the "rows 1 to 200 of 350" summary. */
  hideSummary?: boolean;
  testId?: string;
  className?: string;
  style?: CSSProperties;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]?.toUpperCase() + s.slice(1);
}

export function PaginationControl({
  page,
  pageSize,
  total,
  totalExact = true,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  noun = "items",
  ariaLabel,
  hideSummary = false,
  testId = "pagination-control",
  className,
  style,
}: PaginationControlProps) {
  const size = Math.max(1, Math.floor(pageSize));
  const count = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const current = Math.min(Math.max(0, Math.floor(page)), count - 1);
  const first = total === 0 ? 0 : current * size + 1;
  const last = Math.min(total, (current + 1) * size);
  const canPrev = current > 0;
  const canNext = current < count - 1;

  const go = (next: number): void => {
    const clamped = Math.min(Math.max(0, next), count - 1);
    if (clamped !== current) onPageChange(clamped);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>): void => {
    // Leave the select alone: arrows change its value.
    if ((e.target as HTMLElement).tagName === "SELECT") return;
    switch (e.key) {
      case "ArrowLeft":
        go(current - 1);
        break;
      case "ArrowRight":
        go(current + 1);
        break;
      case "Home":
        go(0);
        break;
      case "End":
        go(count - 1);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const label = ariaLabel ?? `${capitalize(noun)} pagination`;

  return (
    <nav
      aria-label={label}
      className={viewClass("g3t-pagination", className)}
      style={style}
      data-testid={testId}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className="g3t-btn"
        onClick={() => go(current - 1)}
        disabled={!canPrev}
        aria-label={`Previous page of ${noun}`}
        data-testid={`${testId}-prev`}
      >
        <Icon name="chevron-left" size={14} />
        Prev
      </button>
      <span
        className="g3t-pagination-status"
        aria-live="polite"
        data-testid={`${testId}-status`}
      >
        Page {current + 1} of {count}
      </span>
      <button
        type="button"
        className="g3t-btn"
        onClick={() => go(current + 1)}
        disabled={!canNext}
        aria-label={`Next page of ${noun}`}
        data-testid={`${testId}-next`}
      >
        Next
        <Icon name="chevron-right" size={14} />
      </button>
      {pageSizeOptions && onPageSizeChange ? (
        <label className="g3t-pagination-size">
          <span className="g3t-pagination-size-label">Per page</span>
          <select
            className="g3t-select"
            value={size}
            aria-label={`${capitalize(noun)} per page`}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            data-testid={`${testId}-size`}
          >
            {(pageSizeOptions.includes(size)
              ? pageSizeOptions
              : [...pageSizeOptions, size].sort((a, b) => a - b)
            ).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {hideSummary ? null : (
        <span
          className="g3t-pagination-summary"
          data-testid={`${testId}-summary`}
        >
          {total === 0
            ? `no ${noun}`
            : `${noun} ${first} to ${last} of ${totalExact ? "" : "about "}${total}`}
        </span>
      )}
    </nav>
  );
}
