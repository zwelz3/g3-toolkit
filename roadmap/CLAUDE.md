# roadmap/ — CLAUDE.md

Context for anyone (human or coding agent) planning or executing work
from this directory. Read this before opening any roadmap file.

## Intent

This directory is the executable bridge between the specification
corpus (`specs/`) and the milestone machinery (`planning/`). It exists
to answer one question precisely: **for every spec requirement that is
not yet implemented, what work closes it, in what order, and under
which discipline does that work fall?**

The roadmap is organized by **architectural/discipline area first,
then by function/capability**:

```
roadmap/
├── CLAUDE.md                          ← this file
├── architecture/                      ← structural decisions and platform work
│   ├── data-layer.md                  federation, algorithm plugin protocol
│   ├── holonic-backend.md             backend-connected HolonicAdapter, layers
│   ├── security-model.md              redaction, RBAC, audit (M10 core)
│   └── release-engineering.md         typed CJS, e2e baselines, doc generation
├── design/                            ← decisions that gate engineering
│   ├── design-system.md               tokens, icons, motion, selection signature
│   ├── demonstration-surface.md       Storybook/demos/docs as adopter eval path (owns nothing)
│   ├── interaction-design.md          layout mixing, portal UX, edge actions
│   ├── projection-and-encoding.md     pipeline configurability, inferred edges, NL-to-query
│   ├── encoding-controls.md           channel/driver/scale grammar, disclosure tiers
│   ├── toolbar-and-layouts.md         pinning model, compound containers + ELK, layout audit
│   ├── algorithm-overlays.md          result interchange, overlay modes, precedence refinement
│   ├── shacl-views.md                 shape-graph rendering, validation-report visualization
│   ├── structural-rendering.md        ELK containers, compartments, ports (Group A)
│   └── working-set-and-performance.md limit values, streaming layout, large graphs
├── engineering/                       ← implementation work per capability
│   ├── streaming.md                   StreamAdapter, sliding window (M9)
│   ├── write-back.md                  commit-time SHACL, conflict policy (M9)
│   ├── export-reporting.md            subgraph export, reports (M10)
│   ├── document-linkage.md            source-document rendering and previews
│   ├── concept-editing.md             entity page, history, review (landscape)
│   ├── query-workflow.md              saved queries, history (landscape)
│   ├── bookmarks.md                   investigation bookmarks
│   └── temporal-playback.md           timeline animation
├── verification/                      ← code exists; acceptance is unproven
│   ├── view-acceptance.md             six secondary views
│   ├── data-layer-acceptance.md       algorithm adapter, relational virtualizer
│   └── accessibility.md               table-as-fallback wiring
└── human-actions.md                   ← deferred to human judgment, NOT agent-scheduled
```

## Alignment to the spec (normative chain)

1. **`specs/` is the source of truth.** Every roadmap item traces to a
   requirement ID (Rx.y), an open question (OQn), or a decision with
   status `considering` (Dn). The roadmap never restates requirement
   text as authority; it links and summarizes.
2. **Requirement statuses are the record of progress.** They are kept
   consistent with code citations by `scripts/sync_spec_status.py`
   (which runs in CI and guards against comment-only phantom
   citations). The roadmap's job is to plan the transitions:
   `proposed → in-progress → implemented`.
3. **A requirement advances to `implemented` only when a colocated
   test cites its ID and exercises its acceptance criteria.** Comments
   claiming implementation do not count; the remediation pass removed
   several such phantoms (see planning/audit-remediation.md, completion
   notes). When a roadmap item closes, the closing PR updates the spec
   status, and the roadmap file's exit-criteria checklist, together.
4. **Milestone alignment:** engineering/streaming.md and
   engineering/write-back.md constitute M9; architecture/
   security-model.md plus engineering/export-reporting.md constitute
   the core of M10. Exit criteria in those files defer to
   planning/m9-evaluation.md and planning/m10-evaluation.md rather
   than duplicating them.

## Coverage contract

Every requirement whose status is `in-progress` or `proposed` is owned
by **exactly one** roadmap file (cross-references are encouraged;
ownership is not shared). `scripts/check_roadmap_coverage.py` enforces
this in CI: it fails if a non-implemented requirement is unowned, owned
twice, or if a roadmap file claims ownership of an already-implemented
requirement (stale roadmap).

Current ownership index (30 items: 10 in-progress, 20 proposed):

| Requirement | Status | Owning file |
|---|---|---|
| R1.2 Timeline view | in-progress | verification/view-acceptance.md |
| R1.3 Geospatial view | in-progress | verification/view-acceptance.md |
| R1.4 Matrix view | in-progress | verification/view-acceptance.md |
| R1.6 Tree view | in-progress | verification/view-acceptance.md |
| R1.15 Entity Page view | proposed | engineering/concept-editing.md |
| R1.8 Stats panel | in-progress | verification/view-acceptance.md |
| R1.16 SHACL shape view | proposed | verification/view-acceptance.md |
| R1.17 SHACL report visualization | proposed | verification/view-acceptance.md |
| R1.18 Structural element views | in-progress | design/structural-rendering.md |
| R2.10 Temporal playback | in-progress | engineering/temporal-playback.md |
| R2.11 Export and reporting | in-progress | engineering/export-reporting.md |
| R2.12 Data entry and curation | in-progress | engineering/write-back.md |
| R2.15 Investigation bookmarks | proposed | engineering/bookmarks.md |
| R2.16 Change history and review | proposed | engineering/concept-editing.md |
| R2.17 Saved queries and history | proposed | engineering/query-workflow.md |
| R3.6 StreamAdapter | proposed | engineering/streaming.md |
| R3.7 Virtualized-source visualization | proposed | verification/data-layer-acceptance.md |
| R3.8 Document linkage | proposed | engineering/document-linkage.md |
| R5.1 Holonic backend transparency | in-progress | architecture/holonic-backend.md |
| R5.6 Per-holon view configuration | proposed | architecture/holonic-backend.md |
| R5.8 Multi-interior rendering | proposed | architecture/holonic-backend.md |
| R6.2 Multi-source federation | proposed | architecture/data-layer.md |
| R6.3 Document previews | proposed | engineering/document-linkage.md |
| R7.6 Streaming working-set window | proposed | engineering/streaming.md |
| R7.11 Table as accessible fallback | proposed | verification/accessibility.md |
| R8.1 Classification-aware redaction | proposed | architecture/security-model.md |
| R8.2 Role-based graph subsetting | proposed | architecture/security-model.md |
| R8.3 Multi-tenancy indicators | proposed | architecture/security-model.md |
| R8.4 Export access control | proposed | architecture/security-model.md |
| R8.5 Audit trail | proposed | architecture/security-model.md |

Open questions and `considering` decisions are owned by design/ and
architecture/ files; their index lives in each file's header. The
register of record for open questions remains
specs/10-open-questions.md.

## Conventions

- **Priority ordering, never duration estimates.** Work is sequenced
  P0 (blocks a release claim or another area) / P1 (closes a MUST) /
  P2 (closes a SHOULD or polish). No day or week figures anywhere in
  this directory.
- **Exit criteria are testable.** Each item ends in either a Given/
  When/Then acceptance restated from the spec, or a pointer to the
  milestone evaluation doc that holds it.
- **Design gates are explicit.** Where engineering depends on an
  unresolved OQ or `considering` decision, the engineering file names
  the gate and the design file names the resolution criteria; neither
  proceeds on an assumed answer.
- **Honesty over coverage optics.** If verification reveals a view or
  module does not meet its acceptance criteria, the fix is scoped here
  and the spec status stays where the evidence puts it. The metric
  that matters is requirements verifiably closed, not files marked
  done.

## Maintenance

Update this directory when: a spec status changes (sync the index
table); a milestone closes (move its file's content summary to
CHANGELOG and prune); an OQ is resolved (record the resolution in
specs/09 or specs/10, then delete the design item). The coverage
check keeps the index honest; the prose is on you.
