---
spec_id: g3-security
title: "g3-toolkit: Security and Deployment"
version: 0.1.0
status: draft
spec_base: https://w3id.org/g3t/spec/security#
prefix: g3tsec
references:
  g3t:
    base: https://w3id.org/g3t/spec/g3t#
    path: g3t/spec.ttl
refines: g3t
---



<!--specl
created: 2026-05-17
parent: g3-overview
-->

# Intent

This specification defines requirements for classification-aware
visualization, role-based access, multi-tenancy, and deployment
constraints relevant to defense, intelligence, and enterprise contexts.

# Requirements

- R8.1 The toolkit MUST support classification-aware redaction with two configurable modes: (a) structural redaction (remove the node and re-layout the affected subgraph) and (b) "fog" redaction (node visible as an opaque placeholder but properties and label hidden). Deployment configuration MUST dictate which mode is active; the user MUST NOT be able to override it.
  - implementation: not-started
  - priority: MUST
  - role: g3t:PER8
  - constrains: https://w3id.org/g3t/components#RedactionEngine
  - constrains: https://w3id.org/g3t/components#LayoutEngine
  - acceptance: Given a node marked TS/SCI and a user with SECRET clearance, when structural redaction is active, then the node is absent and the surrounding layout adjusts.
  - acceptance: Given the same scenario with fog redaction, then the node renders as a grey placeholder with no label or properties.

- R8.2 The toolkit MUST support role-based graph subsetting such that users only see nodes and edges they are authorized to view. Authorization MUST be enforced at the data-adapter layer, not solely at the view layer.
  - implementation: not-started
  - priority: MUST
  - role: g3t:PER8
  - constrains: AuthorizationManager
  - constrains: https://w3id.org/g3t/components#GraphAdapter
  - acceptance: Given two users with different role-based access, when both view the same graph, then each sees only the nodes and edges their role permits.

- R8.3 The toolkit MUST support multi-tenancy with visual context indicators (border color, watermark, or banner) when the user switches between graphs, ontologies, or organizational boundaries. Workspace serialization MUST include graph-source metadata.
  - implementation: not-started
  - priority: MUST
  - role: g3t:PER8
  - constrains: TenancyManager
  - constrains: https://w3id.org/g3t/components#WorkspaceManager
  - acceptance: Given a user switching from "NATO" graph context to "National" graph context, then a visible indicator (watermark or banner) changes to reflect the new context.

- R8.4 The export pipeline (R2.11) MUST enforce source-level access controls. Exporting a subgraph MUST NOT include nodes or edges the user is not authorized to view, even if those elements are structurally adjacent to authorized elements.
  - implementation: not-started
  - priority: MUST
  - role: g3t:PER8
  - constrains: https://w3id.org/g3t/components#ExportManager
  - constrains: AuthorizationManager
  - acceptance: Given a subgraph export containing 50 nodes, when 5 nodes are above the user's clearance, then the export contains 45 nodes with no trace of the 5 redacted nodes.

- R8.5 The toolkit MUST log all user actions (queries, expansions, exports, property edits, portal traversals) to an audit trail. The audit trail format MUST be configurable (syslog, JSON, database).
  - implementation: not-started
  - priority: MUST
  - role: g3t:PER8
  - constrains: AuditLogger
  - acceptance: Given an analyst who expands a node, edits a property, and exports a subgraph, then 3 audit events are recorded with timestamp, user ID, action type, and affected element IDs.

# User Stories

- US8.1 As a platform administrator deploying to a multi-classification environment, I want to configure structural redaction so that TOP SECRET nodes are completely invisible (not even placeholder shapes) to SECRET-cleared analysts.
  - role: g3t:PER8
  - benefit: I can ensure no classification leakage through layout inference
  - implementation: not-started
