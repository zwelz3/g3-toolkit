# M10 Milestone Evaluation Steps

> **Status:** Not yet implemented. Retained as exit criteria for future M10 work.


## Exit Criteria Verification

### E10.1: Security

**EC-1: Structural redaction**
1. Create UGM with nodes at SECRET and UNCLASSIFIED levels
2. Apply RedactionEngine with UNCLASSIFIED user clearance
3. Inspect resulting UGM

Pass criteria:
- SECRET nodes removed from UGM
- Edges to/from SECRET nodes removed
- Layout re-computed without gaps
- Fog mode alternative: SECRET nodes rendered as grey placeholders

**EC-2: Role-based subsetting**
1. Query same endpoint with two different roles
2. Compare result sets

Pass criteria:
- Role A sees nodes X, Y, Z
- Role B sees only nodes X, Y (Z is restricted)
- GraphAdapter enforces the filter before UGM population

**EC-3: Audit trail**
1. Perform 5 actions (query, expand, select, edit, export)
2. Inspect audit log output

Pass criteria:
- 5 log entries with timestamp, userId, action, elementIds
- Configurable output (console, JSON, callback all work)

### E10.2: Export Pipeline

**EC-4: Canvas image export**
1. Load 50-node canvas
2. Export PNG and SVG

Pass criteria:
- PNG is valid image (decodable, non-zero dimensions)
- SVG is valid XML (parseable, contains node/edge elements)
- Both exclude UI chrome (buttons, panels)

**EC-5: Subgraph export with access control**
1. Select 10 nodes (2 are SECRET-classified)
2. Export to Turtle as UNCLASSIFIED user

Pass criteria:
- Turtle output contains 8 nodes (2 redacted excluded)
- Output is valid Turtle (parseable by RDF library)
- JSON-LD and CSV variants also exclude redacted nodes

**EC-6: Workspace state round-trip**
1. Configure workspace (layout, selection, filters, zoom)
2. Export workspace state
3. Clear state and re-import

Pass criteria:
- All layout panels restored
- Selection restored
- Filter state restored
- Canvas viewport (zoom, pan) restored

### E10.3: Plugin Developer API

**EC-7: Example plugins compile and load**
1. Build circular layout plugin
2. Build "Flag for review" context menu plugin
3. Load both into test harness

Pass criteria:
- Circular layout appears in LayoutSwitcher
- "Flag for review" appears in right-click menu
- Both fire their callbacks on interaction
- Plugin API types are exported from barrel

**EC-8: Plugin documentation complete**
1. Review generated docs

Pass criteria:
- ContextMenuManager.register documented with example
- LayoutEngine interface documented with example
- GraphAdapter interface documented with example
- AlgorithmResultAdapter documented with example

### E10.4: Documentation

**EC-9: User guide**
1. Read docs/user-guide

Pass criteria:
- Getting started section with installation steps
- Workspace section explaining views and layout
- Each view type has a section with screenshot
- Keyboard shortcuts listed

**EC-10: Developer guide**
1. Read docs/developer-guide

Pass criteria:
- Architecture diagram (module dependency graph)
- Adapter integration walkthrough
- Plugin development walkthrough
- Testing guide (4-layer strategy)

**EC-11: API reference**
1. Run TypeDoc generation
2. Review output

Pass criteria:
- All 73+ barrel exports documented
- Each export has JSDoc description
- Type signatures rendered correctly

## Automated Test Targets

| Ticket | Unit | Component | E2E | Acceptance |
|--------|------|-----------|-----|------------|
| M10.E1.T1 Redaction | 4+ | — | — | 1 (Robot) |
| M10.E1.T2 Role subsetting | 2 | — | 1 (Playwright) | — |
| M10.E1.T3 Multi-tenancy | — | 1 | — | — |
| M10.E1.T4 Audit logger | 3+ | — | — | — |
| M10.E2.T1 PNG/SVG export | — | — | 2 (Playwright) | — |
| M10.E2.T2 Subgraph export | 3+ | — | 1 (Playwright) | — |
| M10.E2.T3 Workspace export | 1 | — | 1 (Playwright) | — |
| M10.E3.T1 Plugin docs | — | — | — | manual |
| M10.E3.T2 Layout plugin | 1 | 1 | — | — |
| M10.E3.T3 Menu plugin | 1 | 1 | — | — |
| M10.E4.T1-T3 Docs | — | — | — | manual |

## Parallelization Plan

```
Engineer A: E10.1 (Security) → E10.2 (Export)
            [4 tickets]         [3 tickets]

Engineer B: E10.3 (Plugins) → E10.4 (Documentation)
            [3 tickets]        [3 tickets]
```

Export must follow security (R8.4: redaction applied before export).
