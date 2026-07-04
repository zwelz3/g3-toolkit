# Write-Back and Curation

**Area:** engineering | **Milestone:** M9
**Owns:** R2.12 (in-progress, SHOULD; capped by acceptance criteria)
**Open questions owned:** OQ9 (concurrent-edit conflict policy)
**Exit criteria of record:** planning/m9-evaluation.md, E9.2

## Current state (why R2.12 is capped at in-progress)

PropertyEditor ships inline editing with a backend-validation
callback, which is the UI third of the requirement. Missing:
commit-time SHACL validation actually wired (the ShaclValidator module
exists but nothing connects editor commits to it against the target
shapes graph), relationship creation via drag-from-node, and any write
path to a backend. The status cap is recorded in
scripts/sync_spec_status.py with this rationale.

## Work breakdown (priority order)

1. **P1: WriteBackManager.** Adapter-level write contract
   (updateNodeProperties, createEdge, deleteEdge) for the SPARQL and
   Cypher adapters; SPARQL via UPDATE against a configured write
   endpoint, Cypher via transaction API. Writes route through the
   authorization boundary once architecture/security-model.md item 1
   lands; until then the manager carries the SecurityContext parameter
   unused, so the seam exists.
2. **P1: Commit-time SHACL (R2.12's acceptance criterion).** Editor
   commit invokes ShaclValidator against the configured shapes graph;
   pass persists via WriteBackManager, fail surfaces violations
   without persisting. The validation callback prop remains as the
   escape hatch for non-SHACL backends.
3. **P1: Optimistic UI with rollback.** Apply the edit to the UGM
   immediately, reconcile on backend ack, roll back with a visible
   notice on failure; this is the M9 plan's framework (and the
   behavior OQ9's original text misattributed to D5 before the audit
   correction).
4. **P2 (resolves OQ9): Conflict policy.** Last-write-wins with a
   stale-write detection signal (compare a version/etag property when
   the backend provides one) per the on-file recommendation; CRDT/OT
   stays out unless concurrent multi-user editing becomes a launch
   requirement. Record the decision and close OQ9.
5. **P2: Relationship creation via drag-from-node.** Canvas gesture
   producing a typed-edge dialog, committing through the same
   validate-then-write path.

## Exit

R2.12 advances to implemented when its spec acceptance (edit, commit,
SHACL pass/fail before persistence) runs as a colocated test against
a fixture shapes graph and a mock write endpoint, and the
sync_spec_status.py cap is removed in the same PR. E9.2 pass is the
milestone gate; OQ9 closed in specs/10.
