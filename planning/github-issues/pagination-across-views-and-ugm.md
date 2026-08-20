# Support pagination across UI components and at the UGM level

**Labels:** `enhancement`, `core`, `react`, `performance`
**Relates to:** requirement `R7.3` (`specs/07-ux-defaults-accessibility.md`)

## Summary

Pagination exists in exactly one place and is implemented by a third-party
table library. Every other view that can exceed its working-set limit either
truncates or refuses. `R7.3` says matrices beyond 200x200 "MUST be aggregated
or paginated before rendering", and today the matrix truncates and announces
it, which is not what the requirement asks for.

Rather than fix the matrix in isolation, this issue proposes pagination as a
general capability with a UGM-level foundation, because every view hitting a
limit is hitting the same underlying problem: the model holds everything and
the view is expected to cope.

## Current state, verified

| Surface | Behaviour today |
|---|---|
| `TableView` | **Real pagination.** TanStack `getPaginationRowModel`, `pageSize` prop, default 50 |
| Matrix | Truncates to `maxSize` and renders a notice. No aggregation, no pagination |
| Canvas, tree, streaming | `WorkingSetManager.checkLimit()` returns `allowed: false`; the caller prompts |
| UGM | No windowed or paged access. Holds the full graph in memory |

`packages/core/src/relational-virtualizer/` exists and is exported, but it
virtualizes *relational* source data into a graph. It is not a paging layer
over the UGM, and `CLAUDE.md` records that canvas-level virtualization does
not exist.

So the repository has one view-local pagination implementation, one
truncation, one refusal mechanism, and no shared concept.

## Why this is worth generalising

1. **The limits are already centralised and the responses are not.**
   `WorkingSetManager` owns every limit (`canvas: 500`, `table: 10_000`,
   `tree: 1_000`, `matrix: 200`, `sankey: 100`, `streaming: 500`) but only
   answers "is this allowed". Each view then invents its own answer to "so
   what do I do about it".
2. **Truncation loses data silently at the model boundary.** The matrix's
   notice is honest, but the user cannot reach the truncated cells at all.
   Pagination is the difference between "we showed you part" and "we showed
   you part and here is the rest".
3. **A UGM-level page is reusable; a view-level page is not.** Table
   pagination cannot help the matrix because it pages *rows of a table*, not
   *a window over a graph*.

## Proposed scope

**Foundation, `@g3t/core`**

- A page/window descriptor over UGM query results: offset or cursor, size,
  total count, and whether the total is exact or an estimate. The estimate
  case matters: counting an unbounded backend is itself expensive.
- `WorkingSetManager` gains a response richer than `allowed: boolean` so a
  view can distinguish "refuse", "truncate with notice", and "page".
- Stable ordering guarantees, since a page is meaningless over an unordered
  result.

**Views, `@g3t/react`**

- Matrix: page or aggregate beyond 200x200, satisfying `R7.3`'s letter.
- A shared pagination control so the table's existing UI and any new one are
  the same component, rather than two.
- Canvas and tree: out of scope for a first cut. Paging a *layout* is a
  different problem from paging a *list*, and pretending otherwise is how
  this gets stuck.

## Explicitly not in scope

- Canvas-level virtualization. Related, larger, and tracked separately.
- Changing any default limit value. Those are frozen and owned by the product
  owner.

## Acceptance

`R7.3`'s existing criterion is the bar: given a matrix request of 350x350
categories, when the view opens, cells are aggregated or paginated to within
the 200x200 default before rendering, and the user can reach the remainder.

## Notes for whoever picks this up

`packages/react/src/views/matrix/matrix-acceptance.test.tsx` already states
the gap in its header comment and is the natural place to assert the fix. The
requirement is currently `implementation: in-progress` with that test in
`verifiedBy`; it was reading as `implemented` on the strength of the citation
until the test was read against the criterion.
