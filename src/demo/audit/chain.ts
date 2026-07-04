/**
 * Provenance chain derivation for the auditor shell.
 *
 * Builds the ProvenanceChain (pre-order hop list) the @g3t/react
 * ProvenanceTrace component renders for a selected node: the node
 * itself at depth 0, then a bounded pre-order descent along outgoing
 * PROV-O edges (wasGeneratedBy, wasDerivedFrom, used,
 * wasAssociatedWith, wasAttributedTo). An Entity that the model built
 * with attributed=false bottoms out in an ABSENCE hop: the trace ends
 * in the documented lack of proof, which is the same fact the SHACL
 * report flags. Pure; tested headlessly in chain.test.ts.
 */
import type { UGM } from "@g3t/core";
import type { ProvenanceChain, ProvenanceHop } from "@g3t/react";

const PROV_EDGES = new Set([
  "wasGeneratedBy",
  "wasDerivedFrom",
  "used",
  "wasAssociatedWith",
  "wasAttributedTo",
]);

const MAX_DEPTH = 3;

export function provenanceChainFor(ugm: UGM, rootId: string): ProvenanceChain {
  if (!ugm.hasNode(rootId)) return [];
  const chain: ProvenanceHop[] = [];
  const visited = new Set<string>();

  const hopFor = (
    id: string,
    depth: number,
    parentId: string | undefined,
    via: string | undefined,
  ): ProvenanceHop => {
    const attrs = ugm.getNode(id);
    const tier = (attrs?.types[0] ?? "node").toLowerCase();
    const name = attrs?.properties.name;
    return {
      id,
      tier,
      label: typeof name === "string" ? name : id,
      ...(via !== undefined ? { detail: via } : {}),
      depth,
      ...(parentId !== undefined ? { parentId } : {}),
    };
  };

  const walk = (
    id: string,
    depth: number,
    parentId: string | undefined,
    via: string | undefined,
  ) => {
    visited.add(id);
    const hop = hopFor(id, depth, parentId, via);
    chain.push(hop);

    const attrs = ugm.getNode(id);
    const children: Array<{ target: string; type: string }> = [];
    if (depth < MAX_DEPTH) {
      const queued = new Set<string>();
      for (const edgeId of ugm.getNodeEdges(id)) {
        const ends = ugm.getEdgeEndpoints(edgeId);
        const edge = ugm.getEdge(edgeId);
        if (!ends || !edge || ends.source !== id) continue; // out-edges only
        if (
          PROV_EDGES.has(edge.type) &&
          !visited.has(ends.target) &&
          !queued.has(ends.target)
        ) {
          queued.add(ends.target);
          children.push({ target: ends.target, type: edge.type });
        }
      }
    }

    // An unattributed Entity is a leaf that ends in missing evidence:
    // surface it with the component's absence semantics instead of
    // silently stopping.
    if (
      children.length === 0 &&
      attrs?.types.includes("Entity") === true &&
      attrs.properties.attributed === false
    ) {
      chain.push({
        id: `${id}::absence`,
        tier: "gap",
        label: "No attribution recorded",
        detail: "wasAttributedTo / wasGeneratedBy absent",
        depth: depth + 1,
        parentId: id,
        leaf: true,
        absence: true,
      });
      return;
    }

    if (children.length === 0) {
      hop.leaf = true;
      return;
    }
    for (const c of children) {
      if (!visited.has(c.target)) walk(c.target, depth + 1, id, c.type);
    }
  };

  walk(rootId, 0, undefined, undefined);
  return chain;
}
