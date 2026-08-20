# Pagination Across Views and the UGM

**Area:** engineering
**Owns:** R7.3 (in-progress, MUST)
**Design gate:** the UGM page/window model (offset vs cursor, exact vs
estimated totals) is unresolved; settle it in architecture/data-layer.md
before view work starts.
**Tracked as:** https://github.com/zwelz3/g3-toolkit/issues/6 (draft:
planning/github-issues/pagination-across-views-and-ugm.md)

## Current state

Pagination exists once, in `TableView`, supplied by TanStack
(`getPaginationRowModel`, `pageSize`, default 50). Every other view that
can exceed its working-set limit truncates or refuses instead.

R7.3 requires matrices beyond 200x200 to be "aggregated or paginated".
The matrix truncates to `maxSize` and renders a notice, which
`packages/react/src/views/matrix/matrix-acceptance.test.tsx` states
plainly in its header: "true aggregation/pagination per R7.3's letter
does not exist". The requirement read as `implemented` on that test's
citation until the test was read against the criterion (2026-08-20).

`relational-virtualizer/` is exported but virtualizes relational source
data into a graph; it is not a paging layer over the UGM.

## Work breakdown (priority order)

1. **P1: UGM page/window model.** A descriptor over query results
   carrying offset or cursor, size, total, and whether the total is
   exact or estimated. Stable ordering is a precondition: a page over an
   unordered result means nothing.
2. **P1: Richer limit response.** `WorkingSetManager.checkLimit()`
   returns `allowed: boolean`, so each view invents its own answer to
   "what now". It should distinguish refuse, truncate-with-notice, and
   page.
3. **P2: Matrix pages or aggregates.** Satisfies R7.3's letter and is
   the requirement's own acceptance case (350x350 request).
4. **P2: Shared pagination control**, so the table's existing UI and any
   new surface are one component rather than two.

Canvas and tree paging are deliberately excluded. Paging a layout is a
different problem from paging a list, and conflating them is how this
stalls.

## Exit

R7.3 implemented when a 350x350 matrix request renders within the
200x200 default with the remainder reachable, asserted in
matrix-acceptance.test.tsx, which already documents the gap it would
close.
