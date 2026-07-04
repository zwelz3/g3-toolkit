# Concept Editing

**Area:** engineering
**Owns:** R1.15 Entity Page (proposed, SHOULD), R2.16 change history
and review (proposed, SHOULD)
**Source:** research/capability-landscape.md, sections E.1-E.2 (the
concept-tracker and KG-management workflow gap: the toolkit can debug
an entity but cannot present or steward one)
**Gates:** R2.16 is hard-gated on R2.12's write path
(engineering/write-back.md); R1.15 has no gate.

## Work breakdown (priority order)

1. **P2: EntityPage compound (R1.15).** Schema-driven property
   grouping (SchemaModel classes/shapes as section headers; ungrouped
   properties in a residual section), outbound relations grouped by
   type, inbound relations with per-type counts (one
   expand_neighborhood-shaped adapter call, depth 1, reversed),
   media/document references rendered through the DocumentLinker
   conventions (engineering/document-linkage.md; link-out works even
   before previews land). Navigation between pages drives the
   selection store so canvas and table stay linked (R2.5). Honest
   scope note: readability is the product here; resist letting this
   become a second inspector. The inspector shows everything; the
   page shows what a curator needs, in reading order.
2. **P2: RevisionFeed (R2.16 first half).** Renders history records
   from a `getEntityHistory(id)` adapter capability (optional
   capability flag on GraphAdapter; absent capability renders an
   explanatory empty state, not an error). Property-level diff rows
   reuse the DiffRenderer's changed-property presentation rather than
   a second diff implementation.
3. **P2 (gated on R2.12): ReviewQueue (R2.16 second half).** Pending
   edits staged locally before commit; accept routes through
   WriteBackManager's validate-then-write path; reject discards with
   a recorded reason. Authorization comes from the security boundary
   (architecture/security-model.md) when it exists; until then the
   queue ships, the approval claim does not.

## Exit

R1.15 implemented on its two acceptance criteria with a fixture
SchemaModel; R2.16 implemented against a mock history-capable adapter
and the write-back test double, statuses advanced per the colocated-
test policy.
