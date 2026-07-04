# Query Workflow

**Area:** engineering
**Owns:** R2.17 saved queries and history (proposed, SHOULD)
**Source:** research/capability-landscape.md, section E.3 (every
surveyed database console ships this; its absence taxes the W1
curation and W4 analytics workflows with re-authoring)
**Related, not owned:** R1.13's schema autocomplete SHOULD clause
stays with R1.13 (implemented; the clause is enhancement scope
tracked by its owning spec entry, not re-opened here).

## Work breakdown (priority order)

1. **P2: QueryLibrary store.** Named queries (text, target adapter
   id, declared parameters) persisted through the AnnotationStore's
   pluggable storage so deployments that already redirected annotation
   persistence get query persistence for free; localStorage default
   matches the rest of the toolkit.
2. **P2: Parameterized execution.** Placeholder declaration syntax
   (`$param` with optional type hint), prompt-on-run, substitution
   before dispatch to the adapter. Substitution is textual and the
   prompt warns as much; real parameter binding is per-backend
   (SPARQL bindings vs Cypher parameters) and can upgrade adapter-by-
   adapter behind the same UI later without changing the library
   format.
3. **P2: Session history.** Executed query text + adapter, most-
   recent-first, re-run and save-from-history actions. Session-scoped
   by default; persisting history is one flag once the library store
   exists.
4. **P2: Library/history panel.** A controls-tier component beside
   the QueryEditor; promotion path from history entry to named saved
   query is the affordance the consoles all converge on.

## Exit

R2.17 implemented on its two acceptance criteria (parameter prompt
and substitution; history re-run fidelity) with the storage contract
exercised against both the default and an injected store.
