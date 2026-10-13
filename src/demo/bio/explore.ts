/**
 * Neighborhood explorer over the projected biomedical graph (the demo
 * opt-in for additive graph updates, issue #26). The canvas grows a
 * drawn graph in place only when each step hands it a SUPERSET ugm
 * whose drawn edges keep their ids, so the drawn subset is derived here
 * as the subgraph of the full projected UGM induced by a set of node
 * ids, with every edge keyed by its endpoints and type. The key is a
 * function of the data, not of the UGM instance, so the same edge gets
 * the same id on every step; a generated id differs per instance and
 * would make the canvas replace every edge each step (correct, but a
 * churn that hides what the additive pass does). Pure, so the superset
 * and stable-id contracts are tested without a browser.
 */
import { UGM } from "@g3-toolkit/core";

/** Deterministic edge id: endpoints plus type. */
export function edgeKey(source: string, type: string, target: string): string {
  return `${source}|${type}|${target}`;
}

/**
 * The subgraph of `full` induced by `nodeIds`: those nodes, and every
 * edge of `full` whose endpoints are both among them. Nodes are added
 * in the FULL graph's order (not the order they were drawn in), so the
 * categorical encounter order the canvas sees is the same whichever
 * node was expanded first.
 */
export function induceSubgraph(full: UGM, nodeIds: Iterable<string>): UGM {
  const wanted = new Set(nodeIds);
  const next = new UGM();
  full.forEachNode((id, attrs) => {
    if (!wanted.has(id)) return;
    next.addNode(id, {
      types: [...attrs.types],
      properties: { ...attrs.properties },
    });
  });
  full.forEachEdge((_id, attrs, source, target) => {
    if (!wanted.has(source) || !wanted.has(target)) return;
    const base = edgeKey(source, attrs.type, target);
    // Parallel same-typed edges (none in the bio data) take an
    // ordinal, in the full graph's edge order, so a dataset change
    // cannot throw on a duplicate key.
    let key = base;
    for (let n = 1; next.hasEdge(key); n++) key = `${base}#${n}`;
    next.addEdge(source, target, {
      key,
      type: attrs.type,
      properties: { ...attrs.properties },
      ...attrs.meta,
    });
  });
  return next;
}

/** Ids of every node carrying `type`, in the full graph's order. */
export function nodesOfType(full: UGM, type: string): string[] {
  const out: string[] = [];
  full.forEachNode((id, attrs) => {
    if (attrs.types.includes(type)) out.push(id);
  });
  return out;
}

/**
 * One explorer step: `drawn` plus `nodeId` and its depth-1 neighbors in
 * `full`. Returns `drawn` ITSELF (same reference) when the step adds
 * nothing (the node is unknown, or it and its neighbors are already
 * drawn), so a caller keying a memo on the array can tell a no-op from
 * growth without comparing contents.
 */
export function expandNeighborhood(
  full: UGM,
  drawn: readonly string[],
  nodeId: string,
): readonly string[] {
  if (!full.hasNode(nodeId)) return drawn;
  const have = new Set(drawn);
  const added: string[] = [];
  for (const id of [nodeId, ...full.getNeighbors(nodeId)]) {
    if (have.has(id)) continue;
    have.add(id);
    added.push(id);
  }
  return added.length === 0 ? drawn : [...drawn, ...added];
}
