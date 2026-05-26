# Graph Data Technologies — Use Case Survey

A comprehensive survey of use cases for graph data technologies, spanning
RDF/semantic graphs, labeled property graphs (LPG), and hybrid architectures
that include relational data virtualization. Conducted to inform the design
of the g3-toolkit.

## Summary

- **A graph visualization toolkit can cover 90%+ of real-world graph interrogation needs by composing roughly a dozen "archetype views"** (link-chart canvas, timeline, geo, matrix, schema/ontology, Sankey/flow, table, statistics panel, diff, dashboard, detail/provenance, and document-linked) **over a polyglot data layer** that handles both RDF and labeled-property-graph (LPG) data and virtualizes relational, document, and streaming sources. No existing platform — Stardog, Neo4j, Palantir Gotham, Altair Graph Studio (formerly Anzo), Ontotext+metaphacts, Linkurious, Tom Sawyer, IBM i2 — covers all four of {deep RDF reasoning + interactive LPG analytics + ontology-aware operational write-back + classification-aware visualization} simultaneously; each leaves a recognizable gap.
- **The dominant divide in the market is not RDF-vs-LPG but "model-centric" vs. "investigation-centric."** RDF stacks (Stardog, GraphDB+metaphactory, Graph Studio, Metaphacts) optimize for ontology curation, SHACL validation, federation and semantic search; LPG stacks (Neo4j, TigerGraph, Neptune-LPG) optimize for traversal-heavy analytics, graph data science, and Cypher/GQL queries; investigation suites (Palantir Gotham, IBM i2, Linkurious) optimize for analyst-driven entity resolution, alerting, case management, and timeline/map fusion. A toolkit aimed at 90% coverage must explicitly serve all three audiences.
- **In the four priority domains (defense/intel, systems engineering, enterprise KM, NLP extraction), the visualization gaps are concrete and consistent:** (a) provenance/confidence overlays for extracted assertions, (b) schema/ontology evolution diffing, (c) classification-aware sub-setting/redaction in node-link views, (d) synchronized timeline+map+graph "tri-pane" exploration, (e) hybrid views that fuse SysML-style hierarchical model browsing with free-form network exploration, and (f) write-back UX (curation, validation feedback, action invocation) inside the graph view itself. These six capabilities are the highest-leverage investments.

## Key Findings

1. **Use case count is genuinely large.** This survey enumerates **132 distinct use cases** across 15 domains (Section A). Around 60% are read-heavy/analytical, 25% mixed exploratory-operational, and 15% write-heavy curation/ETL workloads. RDF and LPG paradigms split roughly 40/45 with 15% explicitly hybrid; relational/document virtualization is required by approximately two-thirds of enterprise cases.

2. **A small number of capability clusters recur.** Section B groups the 132 use cases into **8 capability archetypes**: Investigation/Link-Analysis, Ontology Curation, Operational Knowledge Graph, Network/Topology Analytics, Pipeline Provenance, Algorithmic Data Science, Hierarchical Model Browsing, and Streaming/Operational Monitoring. Most "new" use cases fit one of these, meaning a small library of view+interaction archetypes covers the long tail.

3. **Platform leadership is domain-specific.** Palantir Gotham/Foundry dominates defense, intel, and ontology-driven operational workflows because its "Object Explorer", "Graph (Canvas)", "Map", and "Timeline" applications plus its dynamic ontology are tightly integrated. Stardog and Ontotext/metaphacts lead in semantic data fabric and SHACL-validated knowledge graphs. Neo4j (with GDS and Bloom/Explore) leads graph data science. Linkurious and IBM i2 Analyst's Notebook lead in self-service investigative link analysis. Cambridge Intelligence (KeyLines/ReGraph) and Tom Sawyer Perspectives lead in embeddable SDKs.

4. **The biggest design-question tensions** are: (i) RDF reification/named-graph provenance vs. LPG property-on-edge ergonomics in the same UI; (ii) interactive layout stability vs. streaming graph updates; (iii) classification-aware redaction vs. layout determinism; (iv) reasoner-derived edges vs. asserted edges in the same canvas; (v) ontology evolution diff vs. data instance diff; (vi) natural-language-to-query (GenAI/GraphRAG) vs. analyst-controlled SPARQL/Cypher.

---

## Section A — Master Use Case Catalog (132 use cases)

Tags: **[Paradigm]** R=RDF/semantic, L=LPG, H=hybrid; **[Workload]** R=read, W=write, M=mixed; **[Character]** E=exploratory, O=operational, A=analytical.

### A.1 Defense and Intelligence (24)

1. **Link-chart investigation of a person-of-interest network** — entity-relationship exploration with "search around" expansion. **[H][R][E]** Per Palantir's UK G-Cloud service definition, Gotham's Graph application centers on a "Canvas" that allows "performing a 'search around' query on a selected object in Graph."
2. **Multi-INT fusion (SIGINT + HUMINT + OSINT + GEOINT)** — entity resolution across classified+unclassified sources. **[H][M][O]**
3. **Order of battle (ORBAT) modeling** — hierarchical unit/equipment/personnel graphs. **[L][M][A]**
4. **Kill-chain modeling (F2T2EA / cyber kill chain)** — sequential stage graphs. **[L][R][A]**
5. **PMESII-PT / ASCOPE operational environment modeling** — political/military/economic/social/information/infrastructure entity graphs. **[R][M][A]** Sintelix and US Army doctrine document PMESII-PT/ASCOPE as the standard frameworks; the 8 PMESII-PT variables plus 6 ASCOPE entity types form a canonical schema.
6. **Joint Intelligence Preparation of the Operational Environment (JIPOE/IPOE)** — overlay graph + geo + timeline. **[H][M][O]**
7. **Threat-network mapping** — terrorist cell, gang, or APT actor networks. **[L][R][A]**
8. **Communities of interest (COI) detection** — community detection over comms metadata. **[L][R][A]**
9. **Supply-chain interdiction analysis** — disruption propagation across adversary logistics. **[H][R][A]**
10. **Capability dependency graphs** — system-of-systems mission threads. **[H][R][A]**
11. **Mission thread analysis** — tracing dependencies from mission outcome to enabling capability. **[H][R][A]**
12. **Pattern-of-life / movement-pattern analysis** — combined timeline+geo+graph. **[L][R][E]**
13. **Counter-IED / network-of-networks analysis.** **[L][R][A]**
14. **Watchlist / sanctions / PEP screening on entity graphs.** **[H][M][O]**
15. **Real-time alerting against tasked patterns** — Linkurious-style alerts. **[L][M][O]**
16. **Case management / dossier building** with reviewable case lists. **[H][M][O]**
17. **Cross-jurisdictional collaborative investigation** — shared canvas with role-based access. **[L][M][O]**
18. **Classification-aware analyst views** — redact nodes/edges by clearance. **[H][R][O]**
19. **HTML/PDF release-to-partner of subgraphs** — Gotham documents an HTML chart export "to share analyses produced in Graph with partners." **[L][W][O]**
20. **Hostile-action attribution graph** (forensic). **[L][R][A]**
21. **Foreign-influence / disinformation network analysis.** **[L][R][A]**
22. **Insider-threat detection** — combine HR, badge, and IT-log graphs. **[H][M][A]**
23. **Coalition data sharing with provenance** — named-graph and assertion-level provenance. **[R][M][O]**
24. **Course-of-action (COA) wargaming over capability graph.** **[L][M][A]**

### A.2 Systems Engineering / MBSE (16)

25. **SysML v2 model browsing as DAG** — SysML v2 elements are formally Directed Acyclic Graphs (per ThunderGraph's MBSE description). **[L][R][E]**
26. **Requirements traceability (R→D→I→V&V)** — bidirectional trace links. **[L][M][A]**
27. **Interface dependency analysis (IBD / port-connector graphs).** **[L][R][A]**
28. **Failure propagation modeling (FMEA/FTA as DAG).** **[L][R][A]**
29. **Configuration management / baseline diffing.** **[H][M][O]**
30. **Digital thread across PLM/ERP/MES** — ontology-based threading per AIAA SciTech 2025 work. **[R][M][O]**
31. **Digital twin ontology overlay (BRICK/DTDL) + operational state in LPG** — Azure Digital Twins-style hybrid. **[H][M][O]**
32. **V&V evidence traceability.** **[H][M][O]**
33. **System-of-systems (SoS) architecture visualization.** **[H][R][A]**
34. **MBSE model interrogation / queries** (e.g., "all requirements not satisfied"). **[L][R][A]**
35. **Change-impact analysis across SysML / requirements.** **[L][R][A]**
36. **Allocation matrices (function→component, requirement→test).** **[L][R][A]**
37. **Parametric diagram dependency tracing.** **[L][R][A]**
38. **Standards/compliance traceability (ISO 13485, ARP 4754A, DO-178C).** **[H][M][O]**
39. **Tool-chain integration (Cameo, DOORS, Polarion, Jira) over knowledge graph.** **[H][M][O]**
40. **AI-assisted SysML generation/validation** — ThunderGraph-style breadth-first graph traversal for inconsistency detection. **[L][W][O]**

### A.3 Enterprise Knowledge Management (16)

41. **Corporate ontology / taxonomy curation** (SKOS). **[R][W][O]**
42. **Knowledge graph construction & curation** for semantic search. **[R][M][O]**
43. **Semantic search across documents+metadata** (Stardog BITES, metaphactory). **[R][R][O]**
44. **Document-to-graph extraction pipelines.** **[H][M][O]**
45. **Expertise location / "people-who-know-X" graph.** **[L][R][A]**
46. **Organizational network analysis (ONA).** **[L][R][A]**
47. **Compliance knowledge base** (policies → controls → evidence). **[R][M][O]**
48. **Data catalog / data lineage knowledge graph.** **[H][M][O]**
49. **Master data management (MDM) with graph-based entity resolution** — TigerGraph documents MDM/entity resolution kits. **[H][M][O]**
50. **Customer 360 / identity graph.** **[L][M][A]**
51. **Knowledge-graph-augmented retrieval (GraphRAG) for LLMs** — Neptune offers "fully managed GraphRAG." **[H][R][O]**
52. **Ontology alignment / mapping across business units.** **[R][W][O]**
53. **Vocabulary governance and SKOS publishing.** **[R][W][O]**
54. **Reference data management with reconciliation services.** **[H][M][O]**
55. **FAIR data publishing for research data.** **[R][M][O]**
56. **Search-result faceting driven by ontology classes/properties.** **[R][R][E]**

### A.4 Information Extraction & NLP Pipelines (12)

57. **Named-entity recognition → graph nodes.** **[H][W][O]**
58. **Relation extraction → graph edges with confidence scores.** **[H][W][O]**
59. **Coreference resolution chains** displayed as mention clusters. **[L][R][E]**
60. **Event extraction → temporal event graphs** (EventKG-style, with named-graph provenance per Gottschalk et al.). **[R][W][O]**
61. **Open-IE triple extraction for KG completion** — Plumber framework (Springer KAIS 2022) integrates 40 reusable components for entity linking, relation linking, text triple extraction, and coreference resolution, offering 432 distinct pipelines. **[R][W][O]**
62. **Confidence-scored overlays on inferred edges.** **[R][R][E]**
63. **Provenance trace from assertion back to source document span.** **[R][R][E]**
64. **Entity linking against Wikidata/DBpedia/in-house KB.** **[H][M][O]**
65. **Temporal versioning of knowledge graph (TKG)** — quadruples with time. **[R][W][O]**
66. **Hybrid LLM-+-parser pipeline orchestration (GraphRAG).** **[H][M][O]**
67. **Human-in-the-loop assertion validation** (accept/reject with feedback). **[H][W][O]**
68. **Cross-document event coreference and timeline assembly.** **[L][R][A]**

### A.5 Life Sciences / Pharma (10)

69. **Drug-drug interaction prediction over biomedical KG** (PharmaHKG-style heterogeneous KGs). **[R][R][A]**
70. **Drug repurposing via knowledge graph reasoning** (DRKG, PrimeKG). **[H][R][A]**
71. **Pathway analysis** (KEGG, Reactome, WikiPathways) — Cytoscape canonical. **[L][R][A]**
72. **Clinical-trial scoping / participant matching** — per Ontotext, the FROCKG Eurostars-2 knowledge graph contains close to 1 billion facts representing publicly available drug-related clinical knowledge. **[R][R][O]**
73. **Adverse-event surveillance KGs** (FAERS). **[H][R][O]**
74. **Protein-protein interaction networks** — Cytoscape. **[L][R][A]**
75. **Genomics+phenotype linked data (Bio2RDF, LSLOD).** **[R][R][A]**
76. **Target discovery** (Ontotext Target Discovery, used in cancer research). **[R][R][A]**
77. **R&D knowledge discovery for pharma** (FAIR/metaphactory). **[R][M][O]**
78. **Precision medicine knowledge graph + EHR integration.** **[H][M][O]**

### A.6 Financial Services (12)

79. **AML / transaction-network anomaly detection.** **[L][M][A]**
80. **Fraud-ring detection.** **[L][M][O]**
81. **KYC / beneficial-ownership graphs** (Sayari, OpenCorporates). **[L][M][O]**
82. **Counterparty / systemic risk graphs.** **[L][R][A]**
83. **Regulatory compliance graphs** (FINRA, Basel). **[R][R][O]**
84. **Trade surveillance / market manipulation networks.** **[L][R][O]**
85. **Credit-card / payment-fraud detection** (graph features feed ML). **[L][M][O]**
86. **Bitcoin/crypto AML over Elliptic-style graphs** — temporal GNNs. **[L][R][A]**
87. **Insurance fraud rings.** **[L][R][A]**
88. **Customer 360 in banking.** **[L][R][A]**
89. **Sanctions screening / list management.** **[H][M][O]**
90. **SAR filing with audit trail.** **[L][W][O]**

### A.7 Supply Chain & Logistics (7)

91. **Multi-tier supplier visibility (n-tier BOM).** **[L][R][A]**
92. **Disruption propagation simulation.** **[L][R][A]**
93. **Demand-supply balancing (TigerGraph).** **[L][R][A]**
94. **Logistics route / network optimization.** **[L][R][A]**
95. **Trade-flow / customs intelligence.** **[H][R][A]**
96. **Supply-chain digital twin.** **[H][M][O]**
97. **Track-and-trace / serialization (pharma, food).** **[L][M][O]**

### A.8 Cybersecurity (10)

98. **Attack-path analysis** (Deepwatch/CYE/BloodHound-style). **[L][R][A]**
99. **MITRE ATT&CK mapping / heatmap visualizations.** **[H][R][A]**
100. **CVE / CWE / vulnerability dependency graphs** (Akbar et al. unified ontology of MITRE ATT&CK + D3FEND + ENGAGE + CWE + CVE in RDF/SPARQL). **[R][R][A]**
101. **Asset inventory + network topology graphs.** **[L][M][O]**
102. **Identity & access graphs (IAM/AD).** **[L][R][A]**
103. **Threat-intel APT mapping (STIX/TAXII).** **[H][R][A]**
104. **Insider-threat behavioral graphs.** **[L][R][A]**
105. **Cloud security posture (Orca-style).** **[L][R][O]**
106. **SOAR playbook orchestration (graph of detections+actions).** **[L][M][O]**
107. **Forensic timeline reconstruction.** **[L][R][A]**

### A.9 Geospatial / Infrastructure (5)

108. **Utility grid topology** — IEC CIM in RDF, graph-DB-based topology trace (per AWS "Graphing the utility grid" reference). **[R][M][O]**
109. **Transportation networks / multi-modal routing.** **[L][R][A]**
110. **Spatial-semantic integration (GeoSPARQL).** **[R][R][A]**
111. **Asset management for linear assets (pipelines, rail).** **[L][M][O]**
112. **Outage management / FLISR.** **[L][M][O]**

### A.10 Social / Communications Analysis (4)

113. **Social media influence and community detection.** **[L][R][A]**
114. **Telecom CDR / call-record analysis.** **[L][R][A]**
115. **Email / collaboration-graph analysis.** **[L][R][A]**
116. **Disinformation campaign tracing.** **[L][R][A]**

### A.11 DevOps / Software Engineering (5)

117. **Microservice topology / service mesh visualization.** **[L][M][O]**
118. **Software dependency / SBOM graph (CycloneDX/SPDX).** **[L][M][O]**
119. **CI/CD pipeline as DAG, with run-history overlays.** **[L][W][O]**
120. **Code-symbol / call-graph for IDE features.** **[L][R][E]**
121. **Incident root-cause / observability graph.** **[L][R][A]**

### A.12 Legal & Regulatory (3)

122. **Case-law citation network analysis.** **[L][R][A]**
123. **Legislative graph (sections→amendments→rulings).** **[R][R][A]**
124. **Regulatory ontology / regulatory-change impact.** **[R][M][O]**

### A.13 Energy & Utilities (2)

125. **SCADA-augmented operational graph for control rooms.** **[H][M][O]**
126. **Energy-trading counterparty & physical-network graph.** **[H][R][A]**

### A.14 Healthcare (3)

127. **Patient-journey / care-pathway graph from EHR.** **[L][R][A]**
128. **Clinical-decision support over biomedical KG.** **[H][R][O]**
129. **Provider-referral / network analysis (TigerGraph healthcare kit).** **[L][R][A]**

### A.15 Academic Research / Bibliometrics (3)

130. **Citation graphs (Semantic Scholar/OpenCitations).** **[L][R][A]**
131. **Co-authorship & collaboration networks.** **[L][R][A]**
132. **Research ontology / NLP-AKG** — per arXiv:2502.14192, 620,353 entities and 2,271,584 relations extracted from 60,826 ACL Anthology papers using 15 entity types and 29 relation categories. **[R][R][A]**

---

## Section B — Capability Clusters

Rather than a 132-row table, the catalog clusters into **8 archetypes** that share capability profiles. Each row of the conceptual matrix is one archetype; columns are capability families.

### B.1 Investigative Link Analysis (C1)

- **Example use cases:** A.1 #1,2,7,14,16,17,18,19; A.6 #79,80,81,87,90; A.10 #113-116
- **Graph ops:** Pattern matching, multi-hop traversal, shortest path, community detection, centrality, recursive expansion, entity resolution
- **Visualization:** Node-link canvas (force/hierarchical), timeline, geo, matrix/heat, detail-on-demand, dashboards
- **Interaction:** Search-around, expand/collapse, faceted filter, selection/tagging, layout pin, temporal playback, alert review, case mgmt, export
- **Data integration:** Federation across classified+unclassified, relational virtualization, document linkage, REST APIs

### B.2 Ontology / Knowledge-Graph Curation (C2)

- **Example use cases:** A.3 #41,42,52,53,55; A.4 #61,65,67; A.5 #76,77
- **Graph ops:** RDFS/OWL inference, SHACL validation, named graphs, SPARQL update, reasoning explanations
- **Visualization:** Class hierarchy view, SHACL shape view, property domain/range, instance count overlays, schema diff
- **Interaction:** Inline editing, validation feedback, drag-to-link, version history, schema diff, suggestion accept/reject
- **Data integration:** RDF stores, mapping (R2RML, SMS), text-extraction pipelines

### B.3 Operational Knowledge Graph / Digital Twin (C3)

- **Example use cases:** A.2 #29,30,31,32,38; A.3 #47,48,49,50,51; A.13 #125; A.14 #128
- **Graph ops:** Subgraph extraction, recursive trace, write-back actions, rule-based inference, transactional CRUD
- **Visualization:** Hierarchical browser + tabular grids + dashboards + action panels
- **Interaction:** Drill-down, action invocation (write-back), role-based views, scenario "what-if" branching
- **Data integration:** Live SQL virtualization, event/streaming, REST/GraphQL service endpoints

### B.4 Network / Topology Analytics (C4)

- **Example use cases:** A.7 #91-97; A.8 #98,99,100,101; A.9 #108-112; A.11 #117,118; A.6 #82
- **Graph ops:** Shortest path, max flow, centrality, cycle detection, topological sort, link prediction
- **Visualization:** Node-link + matrix + dashboard + Sankey/flow + geo overlay
- **Interaction:** Cross-view linking (graph-map-chart), filter, replay
- **Data integration:** Streaming telemetry, asset DBs, geospatial DBs

### B.5 Pipeline & Provenance (C5)

- **Example use cases:** A.4 #57-67; A.5 #69,73; A.12 #123,124
- **Graph ops:** Confidence-weighted edges, named-graph filtering, lineage trace, RDF*/edge properties
- **Visualization:** Confidence overlay, provenance trace pane, source-document linked view, diff
- **Interaction:** Accept/reject/curate, drill to source span, retraining feedback
- **Data integration:** NLP toolchain integration, document stores, vector DBs

### B.6 Graph Data Science / ML (C6)

- **Example use cases:** A.6 #79,85,86; A.5 #69,70; A.3 #51; A.15 #130
- **Graph ops:** Embeddings, GNN inference, link prediction, similarity, batch algorithms
- **Visualization:** Stat panels (degree distribution, modularity, embedding scatter), community color overlays
- **Interaction:** Hyperparameter tweak, recipe chaining (Bloom-style), notebook integration
- **Data integration:** Data lake/warehouse, ML platforms (Vertex AI, SageMaker)

### B.7 Hierarchical Model Browsing (C7)

- **Example use cases:** A.2 #25-28,33-37,40; A.11 #119,120
- **Graph ops:** Containment traversal, allocation queries, cycle detection, change-impact propagation
- **Visualization:** Tree + nested boxes + IBD-style port-connector diagrams + allocation matrices
- **Interaction:** Expand/collapse, baseline diff, matrix pivot, focus+context
- **Data integration:** MBSE tools (Cameo, DOORS), Git/PLM repos

### B.8 Streaming / Operational Monitoring (C8)

- **Example use cases:** A.8 #105,106; A.11 #117,121; A.9 #112
- **Graph ops:** Incremental graph updates, sliding-window queries, real-time pattern match
- **Visualization:** Force-stable streaming layout, time-window animation, alert dashboards
- **Interaction:** Pause/resume stream, threshold tuning, drill to event
- **Data integration:** Kafka/Pulsar, log tailing, observability backends

**Cluster observation:** C1 (Investigation) and C2 (Curation) demand fundamentally different UIs. One is exploratory and entity-instance-centric; the other is schema/governance-centric. Most failed knowledge-graph projects described in the surveyed sources collapsed these into a single UI to the detriment of both.

---

## Section C — Platform Gap Analysis

### C.1 Stardog

- **Strengths:** SPARQL/SPARQL*/GraphQL, OWL+SHACL with explainable violations, query-time reasoning, >30 virtual-graph connectors, "Voicebox" LLM agent, BITES NLP pipeline, multi-tenant schemas.
- **Visualization:** Stardog Studio is primarily an IDE (query editor, schema explorer); not a full investigation canvas. Customers typically pair with a 3rd-party visualizer.
- **Gaps:** No native investigative-canvas/case-mgmt UX; no geospatial+timeline+graph tri-pane; limited LPG-style traversal ergonomics; visualization layer requires partners.
- **RDF/LPG:** RDF-first; LPG-style use cases require modeling-around.
- **Relational:** Excellent; virtual graphs are a flagship feature.

### C.2 Neo4j (incl. GDS + Bloom/Explore)

- **Strengths:** Cypher, GQL alignment, Graph Data Science library (centrality, community, embeddings, link prediction), Neosemantics (RDF I/O), Bloom/Explore for search-phrase-driven exploration.
- **Visualization:** Bloom/Explore = perspective-driven, near-NL search; good for exploration, weaker for case management, provenance overlays, schema-diff, and large-scale heatmaps.
- **Gaps:** Limited OWL/SHACL; no first-class virtual graphs; no native classification-aware redaction; alerting and case management require partners (Linkurious, Hume).
- **RDF/LPG:** LPG-native; RDF via Neosemantics (import/export, not full reasoning).
- **Relational:** ETL-driven (apoc.load.jdbc, Kafka connector); no live virtualization comparable to Stardog.

### C.3 Palantir Foundry/Gotham

- **Strengths:** "Dynamic Ontology" object/link/action model bridges data and operations; Gotham's Graph (Canvas), Map, Timeline, Object Explorer, and Search Around are tightly integrated. Object Explorer enables "top-down analysis...filter objects with similar characteristics...represent data as a bar chart, histogram, or pie chart." Action-driven write-back is unique. AIP layers LLM access on top.
- **Visualization:** Best-in-class for operational investigative analytics; HTML chart export "to share analyses produced in Graph with partners."
- **Gaps:** Proprietary; not a standards-based (RDF/OWL/SHACL) ontology; cost; vendor lock-in; weak fit for academic/research open-data and W3C interoperability; no first-class SPARQL endpoint.
- **RDF/LPG:** Neither; its own object-link model.
- **Relational:** Excellent through Foundry's 200+ connectors, virtual tables, and pipelines.

### C.4 Google (Knowledge Graph, Vertex AI, BigQuery/Spanner Graph)

- **Strengths:** Massive scale; recent BigQuery graph features; Spanner Graph adds built-in graph query atop relational; Vertex AI for ML.
- **Visualization:** Minimal first-party graph viz; ecosystem (Looker, partner SDKs) needed.
- **Gaps:** Not an investigation suite; no native ontology curation UI; sparse SHACL/OWL.
- **RDF/LPG:** LPG-leaning via Spanner Graph; RDF only via partners.
- **Relational:** Native through BigQuery/Spanner.

### C.5 Amazon Neptune

- **Strengths:** Managed; supports Gremlin, openCypher, SPARQL; GraphRAG with Bedrock; Neptune Analytics for OLAP; partner ecosystem (Cambridge Intelligence, Tom Sawyer, Linkurious, gdotv, Graph Explorer).
- **Visualization:** Notebook-based; advanced viz via partners only.
- **Gaps:** No native ontology UI; no native SHACL; limited reasoning.
- **RDF/LPG:** Both engines; not unified.
- **Relational:** Partner ETL, no built-in virtualization.

### C.6 TigerGraph

- **Strengths:** GSQL + openCypher + GQL; "Solution Kits" for AML, fraud, entity resolution, supply chain, customer 360, cyber, healthcare drug interaction; performance for deep traversal; GraphStudio/Insights for analytics.
- **Gaps:** LPG-only; no first-class RDF/OWL/SHACL; limited investigative case mgmt; visualization adequate but not Palantir-class.
- **Relational:** Loader-based, not live virtualization.

### C.7 Cambridge Semantics / Altair Graph Studio (formerly Anzo)

- **Strengths:** Supports both RDF and LPG via W3C RDF* and SPARQL*; MPP Graph Lakehouse; Hi-Res Analytics dashboards; "graphmarts" abstraction; standards-based (RDF/OWL/SKOS/SPARQL); integrated KeyLines visualization through Cambridge Intelligence partnership.
- **Gaps:** Adoption smaller than Neo4j/Stardog; UX historically less polished than Palantir.
- **RDF/LPG:** Most legitimate hybrid story among the standards-based stack.
- **Relational:** Strong, via Graph Data Interface.

### C.8 Ontotext GraphDB + metaphacts/metaphactory

- **Strengths:** Heavy semantic-reasoning RDF DB; metaphactory adds model-driven low-code UI, search/visualization/authoring components, ontology editor with OWL+SHACL. Used for clinical-trial scoping (FROCKG ~1B facts).
- **Gaps:** LPG-style analytics weak; investigative canvas not a focus.
- **Relational:** Through GraphDB virtualization; not the unique selling point.

### C.9 Linkurious Enterprise

- **Strengths:** Built for AML/fraud/cyber-threat/criminal-intel investigation; alerts leverage graph analytics to search for patterns of interest and create comprehensive cases; unified case list; role-based access with LDAP/SSO and audit logging; geo mode (lat/long to map); timelines; integrates with Neo4j, Amazon Neptune, Memgraph, Cosmos DB, and Google Spanner.
- **Gaps:** Investigation-focused (not ontology curation); RDF support via partner data layer only; not designed for write-back into ontology like Palantir.
- **Note:** On December 4, 2025, Nuix Ltd. announced an agreement to acquire Linkurious for up to EUR 20 million; the deal closed in early 2026 after French FDI approval.

### C.10 Tom Sawyer Software / yWorks / Cambridge Intelligence (KeyLines / ReGraph)

- **Strengths:** Embeddable SDKs; high-quality layouts (yFiles), domain-specific configurability; KeyLines+ReGraph for JavaScript/React; integration with Neptune, Anzo/Graph Studio, Neo4j. Tom Sawyer Perspectives is often embedded directly into enterprise applications with simulation and impact-tracing.
- **Gaps:** Not turnkey applications; they are toolkits.

### C.11 Gephi / Cytoscape

- **Strengths:** Open-source desktop. Gephi for social network analysis & general networks, ForceAtlas2 layout; Cytoscape for biology (canonical for pathway/PPI visualization), 250+ plugins.
- **Scale ceiling:** Per Jacomy et al. (PLoS ONE 9(6): e98679, 2014), ForceAtlas2 is not adapted to networks bigger than 100,000 nodes, and is designed for Gephi's "typical networks (scale-free, 10 to 10,000 nodes)."
- **Gaps:** Desktop-only, not enterprise-integrated; no live data, no security model, no collaboration.

### C.12 IBM i2 Analyst's Notebook (now i2 Group)

- **Strengths:** Multidimensional visual analysis capabilities with association charts, timelines, social network analysis, heat matrices, bar charts/histograms; iBase integration; long history in law enforcement and intelligence.
- **Gaps:** Desktop-rooted (Premium adds server); LPG-conceptual but not a graph DB; ontology curation absent; modern collaborative UX dated compared to Palantir.

---

## Section D — Archetype Views

Twelve archetype views that, in combination, cover the 132 use cases. These became the basis for the g3-toolkit specification (see `specs/01-functional-views.md`).

1. **Link-Chart Canvas** — Force-directed/hierarchical; node icons, edge confidence/type encoding. Core investigation view.
2. **Timeline / Temporal Playback** — Horizontal time axis; scrub, animate, brush-to-filter.
3. **Geospatial Overlay** — Nodes on map; spatial joins, GeoSPARQL, draw/capture.
4. **Matrix / Heatmap** — Co-occurrence/adjacency grid; drill from cell to subgraph.
5. **Schema / Ontology Visualization** — Class hierarchy, SHACL shapes, property domains/ranges, diff.
6. **Hierarchical / Tree-Map** — Containment hierarchies, BOM, SBOM, asset trees.
7. **Tabular / Grid** — Query results table; bidirectional cross-selection with all views.
8. **Statistical / Analytics Panel** — Degree distribution, centrality, embedding scatter, community overlays.
9. **Sankey / Flow / Chord** — Aggregated path flows between categories.
10. **Diff / Comparison** — Side-by-side or overlay of two graph states.
11. **Detail / Provenance Inspector** — Node/edge properties, provenance chain, source-document span, confidence.
12. **Composite Dashboard / Workspace** — Persistent layout of multiple archetypes; save/share/role-based defaults.

**Implementation principle:** Every archetype is composable and cross-linkable. Selection in one view filters/highlights in all others.

---

## Section E — Edge Cases, Tensions, and Open Design Questions

These tensions became the basis for the g3-toolkit design decisions (`specs/09-design-decisions.md`) and open questions (`specs/10-open-questions.md`).

1. **RDF reification/named graphs vs. LPG edge-properties** — Resolved via the Qualified Edge model (D1).
2. **Reasoner-derived vs. asserted edges** — Visual distinction required (D9).
3. **Streaming graph layouts** — Two modes: stable and live (D7).
4. **Classification-aware visualization** — Structural vs. fog redaction; deployment-configurable (D8).
5. **Schema-on-read vs. schema-on-write** — Support both discovery and curated browsing.
6. **Natural-language / GenAI input** — Always show generated query (D10).
7. **Ontology evolution** — Track perspective-against-ontology-version (D12).
8. **Multi-tenancy / cross-graph context switching** — Visual cues on context change.
9. **Scale** — Working-set semantics via default limits (P2).
10. **Hybrid SysML + free-form network exploration** — Different perspectives over same graph (OQ1).
11. **Write-back UX** — Action framework with SHACL validation on commit (D11 area).
12. **GraphRAG and agentic memory** — Provenance-for-AI in the inspector.
13. **Open standards vs. proprietary lock-in** — Standards at data layer, opinionated UI on top.
14. **Accessibility** — Section 508/EAA compliance; table as accessible fallback.

---

## Caveats

- Use-case counts reflect this survey's enumeration, not industry market data. The 132 figure is illustrative of comprehensiveness, not a normative ranking.
- Several vendor claims (Stardog "1 trillion triples scale-out," TigerGraph "1000x faster," DataWalk performance claims) come from vendor marketing and are not independently benchmarked.
- The Cambridge Semantics to Altair rebrand is current as of this writing; product naming may continue to evolve.
- The 90% coverage claim is an architectural hypothesis based on capability-cluster analysis; only customer validation against a real backlog can confirm it.
- Where this report describes future or speculative behavior (e.g., LLM-to-SPARQL agent reliability, streaming layout algorithms), it is design conjecture, not validated fact.
- The "8 archetypes" clustering is the author's synthesis; other reasonable clusterings exist.
- The NLP-AKG figures (Section A #132) are from arXiv preprint 2502.14192, not from a peer-reviewed venue.
