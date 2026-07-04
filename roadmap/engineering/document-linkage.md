# Document Linkage

**Area:** engineering
**Owns:** R3.8 (proposed, MUST), R6.3 (proposed, SHOULD; extends R3.8)

## Current state

Nothing. The earlier comment crediting generic property storage as
document linkage was removed in the audit remediation; the relational
virtualizer explicitly disclaims this capability. The Detail Inspector
renders properties but treats `source_document_url` and `source_span`
as plain strings.

## Work breakdown (priority order)

1. **P1: DocumentLinker conventions (R3.8 core).** Recognize the
   `source_document_url` and `source_span` property conventions in the
   Detail Inspector and render them as actionable links: URL opens in
   a new context; span carries document + page + character range.
   Define the span microformat once (URI fragment vs structured
   property object) and document it; NLP-extraction pipelines upstream
   will encode against it.
2. **P1: Acceptance wiring.** Spec acceptance for R3.8: clicking
   "Show source" on an NLP-extracted entity opens the referenced
   location. For the MUST to close, link-out is sufficient; inline
   viewing is R6.3's territory.
3. **P2: Inline previews (R6.3).** Embedded PDF viewer opening at the
   referenced page/span, image-region previews. Renderer dependency
   (pdf.js or equivalent) enters as an optional peer of @g3t/react,
   consistent with the each-view-brings-its-runtime posture; a
   deployment without it degrades to R3.8's link-out.

## Exit

R3.8 implemented with a colocated test on a fixture entity carrying
both property conventions; R6.3 implemented behind the optional peer
with its preview acceptance test; the span microformat documented in
the data-layer docs.
