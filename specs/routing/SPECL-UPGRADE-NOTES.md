# specl upgrade: 0.2.0 to 0.11.0

`spec.md` was authored against specl 0.2.0 and is now on 0.11.0, graph
contract 2. Validates with zero violations and zero parser warnings.

## The bug reported earlier is fixed

The DecisionRecord title defect (shapes required `dct:title` at Violation
severity, the translator had no way to emit it, so any `# Decisions` section
was an unavoidable failure) is closed. 0.11.0 adds a `title:` annotation key
valid on all item classes, with the title derived from the description when
absent. The earlier writeup is withdrawn.

## What changed in this specification

| Change | Detail |
|---|---|
| `spec_base` | Now required. Set to `https://spec.g3-toolkit.dev/routing#`. specl no longer mints identifiers under its own domain, so this value is a permanent commitment and should be confirmed against whatever namespace g3-toolkit actually controls. |
| `prefix` | Set to `G3TR`, the short name another specification uses to reference this one. |
| Reference-valued keys | `constrains` and `verifiedBy` now resolve to IRIs rather than string literals. Component and test values become typed nodes carrying the original string as `dct:identifier`, one node per artifact however many requirements name it. |
| Decision titles | `title:` added to D1 through D5 rather than relying on the description-derived fallback, since a decision's title carries meaning worth curating. |
| `status:` split | `decisionStatus:` on decisions and `resolutionStatus:` on open questions, both preferred from 0.11.0 because they name the property they set and survive a bullet being moved between sections. |
| User stories | `asA` and `soThat` are retired. Roles are declared personas referenced by identifier, and the benefit clause is `benefit:`. |
| Personas | New `# Personas` section: P1 systems engineer, P2 reviewer, P3 diagram author, P4 maintainer. |
| Agents | New `# Agents` section: AG1 routing track, AG2 product owner. `owner:` now takes an agent identifier, so the previous free-text owners were invalid. |
| Design notes | `# Design Considerations` bullets now carry `DN` identifiers instead of content-hash IRIs. Unprefixed bullets are dropped with a warning. |
| Acceptance queries | New `# Acceptance Queries` section: Q1 through Q5, each gating the requirements it verifies. These express the scene-level invariants that cut across requirement groups, which the per-requirement acceptance criteria could not. |

## Migration note

`specl-migrate source spec.md --dry-run` reports zero remaining renames
against the updated file, so the hand migration is complete. That command
should have been the first step rather than a check at the end; it handles the
annotation renames and the DN and C identifier assignment directly.

## Score

Maturity 94 percent, 63 of 69 items clean, priority weighted. Progress 0
percent, correctly: nothing is built.

The six unclean items are the six open questions, and they are unclean because
they are open. 0.11.0 counts an unresolved open issue against maturity, which
is the right behaviour and should not be worked around by marking OQ1 through
OQ6 resolved. The number will move when the questions are answered.

Note that OQ6 carries `resolutionStatus: deferred` and still counts as
unclean, since only `resolved`, `closed`, and `answered` clear the check. A
deliberately deferred question is arguably a different state from an
unanswered one, and worth considering as a scoring refinement rather than a
defect in this specification.

## One value to confirm

`spec_base` is a permanent identifier namespace and specl deliberately refuses
to invent one. `https://spec.g3-toolkit.dev/routing#` is a placeholder chosen
to be well-formed under the grammar. It must be replaced with a namespace the
project actually controls before this graph is published or referenced by
another specification.
