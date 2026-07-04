# Demonstration Surface: Storybook, Demos, and Docs as the Adopter Evaluation Path

**Area:** design
**Owns:** no spec requirements. The demonstration surface (Storybook,
the wiring guide, the demo shells, and the examples) is how adopters
evaluate and integrate the toolkit; quality here is cross-cutting and
enters the spec corpus only if an item grows into a requirement through
gap analysis (the route design-system.md, interaction-design.md, and
toolbar-and-layouts.md already take).
**Grounding:** assessed against the shipped Storybook
(packages/react/src/Overview.mdx and the `*.stories.tsx` set),
docs/wiring-guide.md (recipes gated in examples/wiring/),
planning/demo-overhaul-spec.md (the seven-demo coverage plan), the three
example tiers (examples/ dev-server scenarios,
examples/decision-dashboards; examples/flagship retired 2026-07-03,
see planning/flagship-retirement.md), and
roadmap/design/design-system.md (selection signature C1, theming demo
D2, shells D, adopter contract E).
**Predecessor:** the Storybook atomic-design reshape (STATUS.md;
taxonomy in Overview.mdx). That reshape is step one: it organizes the
sidebar. This record is the continuation: making the organized surface
actually demonstrate the toolkit's value and hand adopters the verified
code to reproduce it.

## The problem (stated once)

A component shown in isolation cannot demonstrate this toolkit's value,
because the value is coordination, not any single widget. The surfaces
that could show coordination exist, but they are disconnected from each
other and from the live components.

Evidence (verified 2026-06-21):

- Cross-view linking is the product's core verb (design-system.md C1:
  the moment a node lights up simultaneously across canvas, table,
  timeline, and chart). An isolated story renders one component against
  a fixture (Overview.mdx, "Reading a story"), so it cannot show that
  moment by construction.
- The closest existing Pattern story, `AppLayouts.stories.tsx`
  ("Layouts/Composition Patterns"), arranges panels but passes a
  hardcoded selection (`selection={{ type: "node", id: "p1" }}`); it
  demonstrates layout, not live linking. Retitling it to `Patterns/*`
  moves the folder, not the fact.
- No story references the CI-tested wiring snippets (examples/wiring/).
  An adopter who sees a component work in Storybook must leave it to
  find the integration code in docs/wiring-guide.md.
- Every example is large (the dev-server domain scenarios, the two
  capability dashboards; the flagship, since retired). There is no minimal,
  copy-the-file starter; the smallest complete app is described in prose
  only (Overview.mdx: "one CytoscapeCanvas plus a few molecules").

## The plan (priority-ordered)

The renaming is a prerequisite; the items below make the surface useful.
Two of them execute design work already specced (the selection signature
shown as a moment, the theming demo); the rest are new connective tissue
between surfaces that already exist.

### P1 — make Storybook prove the value and hand over the code

**DS1. Co-locate the verified wiring recipe with each Compound and
Pattern story.** Each Compound/Pattern Docs tab surfaces the exact
integration snippet that produces it, sourced from the CI-gated
examples/wiring/ snippets rather than re-typed. The snippets already run
in CI; surfacing them converts Storybook from a component gallery into
an integration manual, in the one place the adopter is already looking.
Lowest cost (the code exists and is gated), highest adopter payoff.

- Gate to confirm: the examples/wiring snippets must be importable into
  MDX (a shared module that both the story and the CI test consume, or a
  Storybook Source block bound to the snippet file) so the shown code
  cannot drift from the gated code. If neither path works without
  copying, that drift risk is itself the finding to record before
  proceeding.
- Exit: for at least CytoscapeCanvas, the coordination Pattern (DS2),
  and one filter molecule, the Docs-tab recipe is the same text the CI
  snippet exercises, enforced by a build-time include or a test (no
  hand-copied snippet).

**DS2. Make the Patterns tier demonstrate linking, interactively.** A
Pattern story wires CytoscapeCanvas plus a table plus one chart over the
shared selection store, so selecting a node in any one updates the
others live. This is the smallest unit that proves the value
proposition and the bridge between isolated stories and the full demos;
it is design-system C1's selection signature shown as the simultaneous
moment rather than per-component treatment. It supersedes the
hardcoded-selection AppLayouts pattern.

- Gate to confirm: the selection store must be drivable standalone
  inside a story (no full demo shell). Verify it can be instantiated and
  subscribed in Storybook's render context before committing the story
  shape.
- Exit (Given/When/Then): given the Pattern story rendered, when a node
  is selected in the canvas, then the table row and the chart mark for
  that node enter the selected treatment within the same frame budget
  the canvas uses; and the reverse holds (selecting the table row lights
  the canvas node).

### P1/P2 — prove brandability

**DS3. Build the theming demo (design-system.md D2).** A live theme
editor over the G3tTheme interface: set accent and palette, watch
canvas, table, and charts follow. "Will it look like my product, not
yours" is the adopter's gate before they read any recipe
(design-system.md design position: adopter products must look like
themselves, not like g3t). Specced as D2/P2 in design-system.md and not
yet built; this record raises its standing because it gates evaluation,
not just polish.

- Exit: per design-system.md D2 (an accent + palette change propagates
  to canvas, table, and charts from one editor).

### P2 — index by adopter intent, lower the first rung, state the limits

**DS4. Capability-to-intent index.** A single map from an adopter need
to its live demo, its wiring recipe, and its component story.
planning/demo-overhaul-spec.md is coverage-organized (is every
capability demonstrated); adopters evaluate by need (can it do my thing,
and how hard). The pieces all exist; nothing indexes them by intent.

- Exit: each capability in the demo-overhaul coverage matrix resolves,
  in one table, to a demo, a wiring-guide recipe, and a component story.

**DS5. Minimal starter example.** The smallest complete app: build a
UGM, mount CytoscapeCanvas, add one toolbar, wire selection.
Copy-the-file, deliberately smaller than the scenario shells, referenced
from Overview.mdx as "start here." It is the missing first rung; the
fastest path to a working graph is the strongest usability signal.

- Exit: a runnable example whose single app file an adopter can copy
  whole, linked from the Overview.

**DS6. Capabilities-and-limits page.** An adopter-facing shipped-vs-gap
page derived from planning/rdf-lpg-virtualization-audit.md and the
STATUS.md descope notes (no shapes parser, no reasoning, no canvas-level
virtualization). Adopters need the boundary before they invest, not
after they hit it; surfacing it honestly is a trust asset and matches
the no-overclaiming discipline the rest of the docs hold.

- Exit: a page that reflects the audit's current shipped/gap state,
  linked from the Overview and the README.

## Sequencing

DS1 and DS2 are one coherent first pass: together they make Storybook
demonstrate the coordination value (DS2) and hand over the verified code
to reproduce it (DS1), in the same view. DS3 follows as the brandability
proof. DS4 through DS6 are documentation connective tissue that can land
in any order once DS1/DS2 establish the pattern that a story points to
its recipe and a capability points to its demo.

No item here owns a spec requirement. If the coordination Pattern (DS2)
or the limits page (DS6) surfaces a genuine capability gap, it enters
the corpus through gap analysis, not from this file. The split worth
remembering: DS2 and DS3 execute design that design-system.md already
committed (C1, D2); DS1, DS4, DS5, and DS6 are new wiring between
surfaces that already ship.
