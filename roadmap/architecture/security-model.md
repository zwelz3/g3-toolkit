# Security Model

**Area:** architecture | **Milestone:** M10 (core)
**Owns:** R8.1, R8.2, R8.3, R8.4, R8.5 (all proposed, all MUST)
**Open questions owned:** OQ13 (export behavior under fog redaction)
**Exit criteria of record:** planning/m10-evaluation.md, E10.1

## Why architecture-first

R8.2 mandates that authorization be enforced at the data-adapter
layer, not solely at the view layer. That makes security a structural
property of the adapter stack, not a feature bolted onto renderers:
every adapter (SPARQL, Cypher, REST, Gremlin, Holonic) must pass
through an authorization boundary before a UGM ever reaches a view.
Getting this wrong means retrofitting five adapters and every export
path later. Design the boundary once; the per-requirement engineering
falls out of it.

## Current state

Nothing implemented. No RedactionEngine, AuthorizationManager,
TenancyManager, or AuditLogger module exists; no adapter accepts a
security context. The middleware stack
(packages/core/src/middleware/) is the natural seam: it already
composes request/response transforms around adapter fetches.

## Work breakdown (priority order)

1. **P0: Security context and authorization boundary design.** Define
   a `SecurityContext` (principal, roles, clearance, tenant) threaded
   through `GraphAdapter` calls, and an authorization middleware that
   filters UGM output. Decide filter placement: post-query UGM
   filtering (universal, but data crosses the wire) vs query rewriting
   (per-backend, but data never leaves the store). The spec's
   adapter-layer mandate (R8.2) permits both; the architecture note
   must state which backends get which, because SPARQL named-graph
   scoping and Cypher subgraph predicates differ materially.
2. **P0: Resolve OQ13 before any export work.** R8.4's "no trace"
   acceptance is unambiguous for structural redaction and unspecified
   for fog mode. The recommendation on file (omit always; annotate the
   export manifest with a withheld-element count) needs Security Lead
   sign-off because it creates a deliberate view/export inconsistency.
   engineering/export-reporting.md is blocked on this.
3. **P1: RedactionEngine (R8.1).** Structural and fog modes,
   deployment-configured, not user-togglable (D8 is `accepted`; no
   design work remains). Layout re-computation on structural removal
   must not leak position gaps (US8.1's inference concern).
4. **P1: Role-based subsetting (R8.2)** as authorization middleware
   over all five adapters, with the per-backend strategy from item 1.
5. **P1: Export access control (R8.4),** implemented as the same
   authorization boundary applied to the export pipeline; depends on
   engineering/export-reporting.md existing, but the enforcement
   component lives here so view and export cannot diverge.
6. **P2: Multi-tenancy indicators (R8.3).** Context watermark/banner
   on tenant switch; workspace serialization carries graph-source
   metadata. Renderer work is small once SecurityContext exists.
7. **P2: AuditLogger (R8.5).** Event taxonomy (query, expand, export,
   edit, portal traversal), pluggable sinks (syslog, JSON, database).
   Hook points already exist in the UGM event bus and context-menu
   action dispatch.

## Dependencies and cross-references

- engineering/export-reporting.md consumes items 2 and 5.
- engineering/write-back.md must route edits through the same
  authorization boundary (an unauthorized write is worse than an
  unauthorized read).
- The Holonic backend (architecture/holonic-backend.md) should accept
  SecurityContext from day one; retrofitting it is exactly the mistake
  this file exists to prevent.

## Exit

All five R8.x advance to implemented per the colocated-test policy,
with tests restating the spec acceptance criteria (TS/SCI node absent
under structural mode for a SECRET principal; grey placeholder under
fog; 45-of-50-node export with no trace of the redacted 5; three audit
events for expand/edit/export). E10.1 pass in
planning/m10-evaluation.md is the milestone gate.
