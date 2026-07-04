# Interaction Design

**Area:** design
**Owns:** OQ1 (layout mixing), OQ5 (portal grouping), OQ12
(edge-type-specific actions), OQ14 (cross-holarchy transition),
D12 (perspective/ontology-version warnings, status: considering)
**Owns no requirements;** gates: engineering/bookmarks.md (UX model),
architecture/holonic-backend.md items 5-6 (channel coordination via
projection-and-encoding).

Each item below states the question, the on-file recommendation, and
the resolution criteria (what evidence converts the recommendation
into a decision recorded in specs/09 or closes the OQ in specs/10).

## OQ1: Hybrid hierarchical/network layout mixing

Question: how does a user define system-boundary regions in one canvas
(hierarchical inside, force-directed outside)?
Recommendation on file: defer until user testing with MBSE engineers.
Resolution criteria: a moderated session with at least three MBSE
engineers on a SysML containment fixture (the AuditorMBSEDemo shell is
the harness), comparing draw-a-boundary vs edge-type inference vs
auto-nesting hybrid. Decision recorded with the losing options'
failure modes, because this question will be re-asked.

## OQ5: Portal grouping above ten outbound portals

Recommendation on file: flat list to 10, grouped-by-target-type above,
"Browse all portals" panel as overflow. Resolution criteria: a fixture
holarchy with a 25-portal holon exercised in the demo; threshold and
grouping confirmed or adjusted, then implemented in
holonic-portal-menu (small engineering follow-on, tracked there).

## OQ12: Edge-type-specific context actions

Recommendation on file: plugin mechanism only (R2.3) initially;
promote recurring registrations to built-ins later. Resolution
criteria: this can be resolved by decision rather than research; the
plugin filter API already supports type predicates. Record as a
specs/09 decision and close the OQ; revisit promotion after two
external plugin registrations exist.

## OQ14: Cross-holarchy navigation transition

Recommendation on file: breadcrumb trail plus watermark change as
minimum viable. Resolution criteria: prototype both the breadcrumb and
the animated zoom-through in Storybook; pick on two grounds:
disorientation (can a user say where they are after three traversals)
and the multi-tenancy indicator interplay (R8.3 also wants watermarks;
the two must not collide). Coordinate with
architecture/security-model.md item 6 before finalizing.

## D12: Ontology-version dependence of saved perspectives

Status: considering. The decision's substance (track dependencies,
warn on breakage) is accepted in spirit; what is undesigned is the
warning UX and migration assistance. Resolution criteria: design the
warning surface (load-time banner with diff summary vs per-element
badges) and the minimum migration affordance (re-point renamed class,
drop deprecated property) against a fixture ontology bump. Advance D12
to accepted with the UX attached; implementation then schedules as P2
engineering under workspace.

## Bookmark interaction model (gates engineering/bookmarks.md)

R2.15 needs an answer to one design question before build: are
bookmarks workspace-scoped objects (saved into R1.12 workspace state,
shareable with it) or a parallel store like tags (AnnotationStore)?
Recommendation: workspace-scoped, because R2.15's own text requires
shareability as workspace state and a second persistence mechanism
would duplicate AnnotationPanel's storage plumbing. Resolution
criteria: confirm against the WorkspaceShell save/load format and
record in the engineering file; no user research needed.
