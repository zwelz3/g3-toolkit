# M9 Milestone Evaluation Steps

> **Status:** Not yet implemented. Retained as exit criteria for future M9 work.


## Exit Criteria Verification

### E9.1: Streaming Layout Controller

**EC-1: Stream 50 nodes without layout thrash**
1. Start test harness with 100-node canvas
2. Create StreamAdapter mock emitting 50 nodes over 10 seconds
3. Observe canvas during streaming

Pass criteria:
- All 50 new nodes appear in the canvas
- In stable mode: no existing node moves position
- In live mode: existing nodes shift but settle within 2 seconds
- No console errors during streaming
- UGM nodeCount increases from 100 to 150

**EC-2: StreamAdapter delta emission**
1. Run: `npm run test` (unit tests cover this)
2. Verify StreamAdapter.onDelta fires for each batch

Pass criteria:
- Mock stream test passes
- GraphDelta contains correct addedNodes/addedEdges

### E9.2: Write-Back Framework

**EC-3: Inline property edit with SHACL validation**
1. Load test harness
2. Select a node in the inspector
3. Edit a property value to a SHACL-invalid value
4. Click commit

Pass criteria:
- SHACL validation feedback appears (red border, error message)
- Write is blocked (UGM unchanged)
- Edit to a valid value: write succeeds, UGM updated

**EC-4: Drag-to-create edge**
1. In canvas, drag from node A to node B
2. Type selector dialog appears
3. Select edge type and confirm

Pass criteria:
- New edge appears in canvas
- UGM edgeCount increases by 1
- Edge has correct type
- Undo (Ctrl+Z) removes the edge

## Automated Test Targets

| Ticket | Unit | Component | E2E | Acceptance |
|--------|------|-----------|-----|------------|
| M9.E1.T1 StreamAdapter | 3+ | — | — | — |
| M9.E1.T2 Stable layout | 1 | — | 1 (Playwright) | 1 (Robot) |
| M9.E1.T3 Live layout | 1 | — | 1 (Playwright) | — |
| M9.E2.T1 Inline edit | — | 2 | 1 (Playwright) | 1 (Robot) |
| M9.E2.T2 SHACL validation | 2 | 1 | 1 (Playwright) | — |
| M9.E2.T3 Drag-to-create | — | 1 | 1 (Playwright) | — |

## Decision Gates

- OQ4 (streaming layout algorithm): Resolve before E9.2.
  Recommendation: stable mode as default; live mode opt-in.
- OQ9 (write-back conflict): Last-write-wins for initial release.
