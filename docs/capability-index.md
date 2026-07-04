# Capability index (by intent)

The other docs are organized by what the toolkit contains. This one is
organized by what you are trying to do. Find your need in the first
column; the row points you to a demo that shows it working, the wiring
recipe that gives you the integration code, and the component story that
shows the piece in isolation.

How to use the three columns:

- **Demo (run it):** the dev-server scenarios (Biomedical, Auditor,
  MBSE, Supply Chain) run from `pnpm dev`, which opens a gallery you
  pick from. Analytics and Schema are in
  [`examples/decision-dashboards`](../examples/decision-dashboards);
  Workspace is in [`examples/full-workspace`](../examples/full-workspace);
  Flagship is in [`examples/flagship`](../examples/flagship).
- **Recipe (copy it):** a section of
  [`docs/wiring-guide.md`](wiring-guide.md). Every snippet there runs in
  CI, so it does not rot.
- **Story (see it):** the Storybook sidebar path for the component in
  isolation.

For where support is partial or absent, read alongside
[capabilities and limits](capabilities-and-limits.md); this index points
at what exists, not at what is complete.

| I need to...                                                                           | Demo (run it)                                                                             | Recipe (copy it)                                                                                       | Story (see it)                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Render a graph on a canvas                                                             | Biomedical                                                                                | Composition levels                                                                                     | Views / CytoscapeCanvas                                                           |
| Show the same data as a table, tree, matrix, timeline, map, or Sankey                  | Biomedical (tree, table); Supply Chain (map); Auditor (timeline); Schema (matrix, Sankey) | Composition levels                                                                                     | Views                                                                             |
| Link selection across every view (pick once, highlight everywhere)                     | all scenarios                                                                             | Select and focus a node of interest                                                                    | Patterns / Coordinated Selection                                                  |
| Search for and jump to a node                                                          | MBSE                                                                                      | Select and focus a node of interest                                                                    | Molecules / SearchBar                                                             |
| Filter what is visible (by type, or a built query)                                     | Analytics; all scenarios                                                                  | Filter by hiding, not by rebuilding                                                                    | Molecules / FacetFilter; Molecules / FilterBuilder                                |
| Chart the graph, linked to selection (bar, scatter, pie)                               | Analytics; Supply Chain                                                                   | (charts auto-link through the selection store; see "Select and focus")                                 | Reference / Charts                                                                |
| Style nodes and edges from data (encoding, legend, style editor, import/export styles) | Biomedical; Analytics; MBSE                                                               | Drive the encoding from app state                                                                      | UX Surface / Visual Encoding; Reference / Charts                                  |
| Switch layouts at runtime (force, hierarchy, dagre, ELK)                               | all scenarios                                                                             | Re-run or shuffle the layout                                                                           | Compounds / Toolbar & Algorithms; Reference / Features (Layout Manager)           |
| Run graph algorithms, or show results computed by my backend                           | Analytics; Biomedical                                                                     | Register an algorithm result from your backend                                                         | Compounds / Toolbar & Algorithms                                                  |
| Lay out a structural / SysML block view (typed compartments, ports)                    | MBSE; Schema                                                                              | Lay out a structural (UML-style) view                                                                  | Atoms / SpecPort                                                                  |
| Validate against SHACL and show the report (graph overlays + shape browser)            | Biomedical; Auditor; Schema                                                               | Visualize a SHACL validation report; Render a SHACL shape graph; Link the shape view and the data view | Reference / Charts (Shacl Shape Browser); Views (Diff)                            |
| Show provenance and time (PROV-O chain, timeline, temporal filter)                     | Auditor                                                                                   | (no dedicated recipe yet)                                                                              | Views (TimelineView); Molecules / TemporalRangeFilter                             |
| Project and clean the graph (collapse blank nodes and literals; diff before/after)     | Biomedical; Analytics; Schema                                                             | (no dedicated recipe yet; ProjectionPipeline is a core API)                                            | Views (DiffRenderer)                                                              |
| Add custom toolbar buttons (pin, focus, relayout)                                      | all scenarios                                                                             | Pin / unpin everything; Select and focus a node; Re-run or shuffle the layout                          | UX Surface / Toolbar                                                              |
| Add custom right-click (context-menu) actions                                          | MBSE; all scenarios                                                                       | Add your action to the canvas context menu                                                             | (behavioral; the recipe is the reference)                                         |
| Theme the toolkit to match my product                                                  | all scenarios                                                                             | Theme from your app's settings                                                                         | (cross-cutting; see the Overview "Theming" notes)                                 |
| Connect to my backend (SPARQL, Cypher, REST, Gremlin)                                  | Analytics (adapter switch); Auditor                                                       | The integration surface                                                                                | (adapters are non-visual; integration examples in ARCHITECTURE.md)                |
| Build a query interactively                                                            | Analytics; Schema                                                                         | The integration surface                                                                                | Views (QueryEditor)                                                               |
| Save and load a multi-view workspace; cap the working set                              | Workspace; Analytics                                                                      | The other direction: toolkit state driving YOUR components (workspace snapshot)                        | (the workspace shell itself; `examples/full-workspace`)                           |
| Drive my own app from toolkit state (non-React subscription)                           | (integration pattern)                                                                     | The other direction: toolkit state driving YOUR components                                             | (non-visual)                                                                      |
| Annotate, group, or edit properties on the graph                                       | Supply Chain; Analytics                                                                   | (no dedicated recipe yet)                                                                              | Reference / Features (Annotation Panel, Combo Manager, Property Editor)           |
| Compute derived properties and undo/redo edits                                         | Supply Chain (derived); Analytics (undo)                                                  | (no dedicated recipe yet)                                                                              | Reference / Charts (Derived Property Panel)                                       |
| Show graph statistics (density, diameter, degree)                                      | Analytics                                                                                 | (no dedicated recipe yet)                                                                              | Views (StatsPanel)                                                                |
| Keep it keyboard- and screen-reader-accessible                                         | all scenarios                                                                             | (built in; no wiring needed)                                                                           | (cross-cutting: AriaCompanion and the keyboard-shortcut modal ship in every view) |

Two backends in the matrix, Gremlin and Holonic, are documented in
ARCHITECTURE.md rather than demoed, because both need live server
infrastructure that a fixture cannot stand in for.
