# Investigation Bookmarks

**Area:** engineering
**Owns:** R2.15 (proposed, SHOULD)
**Design gate:** bookmark interaction model, resolved in
design/interaction-design.md (recommendation: workspace-scoped)

## Current state

Nothing; the phantom citation that briefly marked this implemented
was a bare comment in WorkspaceShell and was removed in the audit
remediation. Adjacent machinery exists: tagging persists labels,
AnnotationPanel has pluggable storage, WorkspaceShell saves/loads
layout state. A bookmark is, structurally, a named snapshot of
(selection, active filters, viewport) inside workspace state.

## Work breakdown (priority order)

1. **P2: Bookmark model + store.** Capture/restore of selection IDs,
   filter state (PropertyFilter + facet state), and viewport
   (pan/zoom) as a named entry in workspace state, per the design
   resolution. Restore must tolerate deleted elements (bookmarked
   nodes since removed) with a visible partial-restore notice rather
   than silent failure.
2. **P2: UI surface.** Bookmark list panel (create from current
   state, rename, delete, activate); creation also reachable from the
   toolbar.
3. **P2: Shareability.** Bookmarks travel inside exported workspace
   state (R1.12 path) with no separate mechanism, which is what the
   requirement's "shareable as workspace state" literally asks.

Priority note: everything here is P2 because the requirement is
SHOULD and nothing downstream depends on it; it is, however, the
cheapest remaining item that visibly improves the investigation
workflow, which makes it a good between-milestones slot.

## Exit

R2.15 implemented when its acceptance (save, reload session, activate,
state restored) runs as a colocated test over WorkspaceShell
save/load.
