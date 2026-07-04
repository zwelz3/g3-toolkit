# Projection and Visual Encoding

**Area:** design
**Owns:** OQ2 (user-configurable pipelines, deferred), OQ3
(NL-to-query engine), OQ6 (per-holon projection defaults, deferred),
D4.1 (default projection configuration, considering), D9
(inferred-edge encoding, considering), D10 (NL-query transparency,
considering)
**Gates:** architecture/data-layer.md item 2 (sameAs visibility under
presets), architecture/holonic-backend.md item 5 (visual channel
allocation).

## D9: Reasoner-derived vs asserted edge encoding

The toggle ("show only asserted") is uncontroversial and partially
wired (asserted=false renders dashed since M0). What is undecided is
the committed encoding once multiple metadata dimensions compete for
the same channels: confidence already maps to opacity, asserted to
dash pattern; interior attribution (R5.8) and federation source
(architecture/data-layer.md item 3) both want border or badge.
Resolution criteria: the channel-allocation table below, prototyped
in the Encoding stories, then D9 advances to accepted. Produced
2026-06-11 (design-pass 2); the holonic and federation items now
build against it.

| Visual channel | Owner (node) | Owner (edge) | Redundant channel |
|---|---|---|---|
| Hue (categorical) | node type (Okabe-Ito) | edge type | node shape (R7.8) |
| Hue (continuous) | magnitude encodings via `--g3t-seq-*` | flow/score via `--g3t-seq-*` | numeric label |
| Accent color | SELECTION (signature; exclusive) | SELECTION | halo/bar geometry from `--g3t-selection-*` tokens |
| Opacity | de-emphasis of non-members (`--g3t-deemphasized-opacity`) | confidence (existing) | edge: width steps |
| Dash pattern | (reserved) | asserted=false / inferred (D9) | "show only asserted" toggle |
| Border weight | algorithm overlay membership (R3.9 emphasis) | overlay membership | overlay legend entry |
| Badge/glyph | validation, holonic interior attribution (R5.8) | n/a | icon + count, never color alone (B4) |

Rules: selection holds the accent exclusively (no feature may color
on accent); overlays own weight; inference owns dash; continuous
magnitude never reuses the categorical palette. Conflicts are design
defects, resolved here before code.

## D4.1 / OQ6: Default projection per holon type and domain

Standard preset (all collapses on) is shipping as the universal
default; OQ6 defers per-type overrides until adoption feedback exists.
Resolution criteria: instrument nothing; collect explicit feedback
from the first two real ontology-curation users (the population D4.1
names as at-risk) on whether they manually switch to the Ontology
preset and how often. If the answer is "every session," per-holon-type
Projection-layer defaults (R5.6 machinery) get promoted from P2;
otherwise close OQ6 with the universal default confirmed.

One concrete sub-issue surfaced by federation design: Literal/Type
Collapse must not strip owl:sameAs assertions that the EntityResolver
needs. Resolution: decide whether sameAs survives Standard preset as
edge data or is consumed adapter-side before projection; record in the
preset documentation either way.

## OQ2: User-configurable ProjectionPipelines

Deferred, and should stay deferred: the recommendation (pipelines are
admin-managed configuration in the initial releases) has held through
fourteen milestones without user pressure. Re-open only on concrete
demand; the resolution then requires a pipeline-editor UX design,
which is substantial. No work scheduled.

## OQ3 / D10: Natural-language-to-query

D10's transparency posture (generated query always visible, editable,
flagged until validated) is the right constraint and should advance to
accepted as-is; it is a values decision, not a research question. OQ3
(engine selection) resolves in two steps: (1) freeze the
NLQueryEngine interface contract (NL string + schema context in;
query + confidence out) as a published type so the editor UI can build
against it; (2) defer engine implementation to a plugin, exactly as
the recommendation states. Step 1 is small and unblocks third parties;
schedule it with OQ8's protocol freeze (architecture/data-layer.md)
since both are publish-a-contract tasks.

## Exit

D9 and D10 advance to accepted in specs/09; OQ3 closes with the
contract published; OQ6 closes or escalates on the stated evidence;
OQ2 remains deferred with this file as the periodic review point.
