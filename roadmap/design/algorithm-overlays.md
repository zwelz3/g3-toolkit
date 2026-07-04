# Algorithm Overlays and the Result Interchange

**Area:** design
**Owns:** no spec requirements; design record for the algorithm-result
work (round 21, 2026-06-12), expanding on the review request to
consider clustering, pathfinding, and external engines (networkx,
GraphBLAS).

## Doctrine: results, not computation

The toolkit never becomes a graph-algorithms library. Heavy
computation runs where it runs best: networkx or igraph in Python,
GraphBLAS for sparse linear-algebra formulations, a service, a
worker. The toolkit's job is a typed landing zone, visualization,
and controls. The reference built-ins (connected components, degree,
BFS shortest path) exist so the controls work without a backend;
they are deliberately trivial and stay that way.

## Two result modes

Algorithm results shape a graph in exactly two ways, and the
architecture mirrors that:

1. **Property-shaped** (centrality, community ids, anomaly scores,
   embeddings): ingested as node/edge properties in the UGM. The
   payoff is reuse: once a community id is a property, the ENCODING
   SPEC drives any channel from it through the ordinary grammar:
   color by community, size by pagerank, shape by cluster, with the
   panel, preview, legend, serialization, and reserved-channel
   guards all applying for free. Clustering support is therefore
   not a feature: it is a driver.
2. **Structure-shaped** (paths, spanning trees, ego networks,
   k-cores): named overlays of node/edge id sets that NEVER mutate
   the UGM. The canvas renders the union of active overlays as
   emphasized members (border/line, theme success color) over
   de-emphasized non-members (opacity dim), with independent
   toggles, restoring exactly on deactivation (classes only, so
   restoration is by construction).

## The interchange contract (version 1)

One versioned JSON document covers both modes:

    { "version": 1,
      "algorithm": "networkx.pagerank",        // provenance, optional
      "kind": "nodeProperties" | "edgeProperties" | "overlay",
      "properties": { "<elementId>": { "<key>": value } },   // property kinds
      "overlay": { "id", "label?", "nodeIds?", "edgeIds?" } } // overlay kind

Worked exports:

    # networkx: property-shaped
    json.dumps({"version": 1, "kind": "nodeProperties",
                "algorithm": "networkx.pagerank",
                "properties": {n: {"pagerank": s}
                               for n, s in nx.pagerank(G).items()}})

    # networkx: structure-shaped
    T = nx.minimum_spanning_tree(G)
    json.dumps({"version": 1, "kind": "overlay",
                "algorithm": "networkx.minimum_spanning_tree",
                "overlay": {"id": "mst",
                            "nodeIds": list(T.nodes),
                            "edgeIds": [G.edges[e]["id"] for e in T.edges]}})

    # python-graphblas: property-shaped from a vector
    # (v indexed by node position; ids maps position -> node id)
    json.dumps({"version": 1, "kind": "nodeProperties",
                "algorithm": "graphblas.bfs_level",
                "properties": {ids[i]: {"bfs_level": int(x)}
                               for i, x in zip(*v.to_coo())}})

Edge-id alignment is the host's responsibility: the document speaks
UGM edge ids, so exporters must carry them (the networkx example
stores them as edge attributes). parseAlgorithmResult validates
version and shape and surfaces failures verbatim in the panel.

## Precedence refinement (mechanisms and namespaces)

Round 14 established precedence by MECHANISM (theme = stylesheet
colors, spec = element data, instance = bypass, reserved = owner
styles). Overlays refine it with a NAMESPACE rule: overlays own the
g3t-ov-* class namespace and the emphasized border/line styling
(realizing the reserved borderWeight channel), while the spec owns
the _color/_size/_icon/_shape data fields. The documented tension
(instance border pins vs overlay emphasis) is now RESOLVED by
decision: instance pins are bypass styles and therefore shadow
overlay borders on the pinned element, deliberately, because an
explicit per-node act outranks a computed emphasis. The amber
position-pin underlay renders through the overlay dim (underlay vs
opacity compose).

## Controls

AlgorithmPanel: reference runners, the overlay registry with
independent toggles and member counts, and the ingest surface for
external documents (seedable for demos and host examples). Property
ingestion mutates the UGM in place and fires onIngested so hosts can
re-apply anything that reads attributes.

## Roadmap (narrowed 2026-06-12 by review direction)

Algorithm roadmap items are limited to those focused SOLELY on graph
visualization. Removed accordingly: async host-provided runners
(computation orchestration) and GraphBLAS columnar batch shapes
(ingest-performance interchange). The contract stays as shipped;
hosts orchestrate their own computation and emit version-1 documents.

Remaining (visualization-focused):
- Embeddings as layout: property-shaped vectors feeding the
  projection work (dimensionality-reduced positioning).
- Overlay set algebra (intersection/difference views) if union
  semantics prove insufficient in review.
