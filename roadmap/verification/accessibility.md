# Accessibility: Table as Universal Fallback

**Area:** verification
**Owns:** R7.11 (proposed, MUST)

## Current state

The pieces exist separately: every view writes selections to the
shared selection store, and TableView renders UGM subsets. What R7.11
requires is the guarantee that ANY selection in ANY view is
representable as a table (the minimum-viable accessible
representation), and nothing currently wires arbitrary-view selections
into a table rendering or proves the property holds universally.

The remaining a11y requirements (R7.8 palette, R7.9 keyboard
navigation, R7.10 screen-reader summaries, R7.12 high contrast) are
implemented with cited tests; this is the last open MUST in the
accessibility set.

## Work breakdown (priority order)

1. **P1: Selection-to-table channel.** A "Show selection in table"
   action available from every view's context menu (R2.1 already
   mandates the menu everywhere) rendering the current selection store
   contents through TableView, including elements whose origin view is
   non-tabular (map markers, timeline events, sankey flows).
2. **P1: Universality test.** Parameterized colocated test iterating
   the view registry: select in view X, invoke the action, assert the
   table rows match the selection with properties present. New views
   added later inherit the assertion automatically, which is what
   makes the MUST durable rather than point-in-time.

## Exit

R7.11 advances to implemented when the parameterized test passes
across all registered views; AriaCompanion's announcement of the
action is included in the a11y test suite.
