/**
 * Structural change-set API (G3L:MOD-010, workstream E3).
 *
 * A change set is the WRITE interface to a structural graph:
 * add/remove/update batches applied as one transaction, producing
 * (a) the next input and (b) a STRUCTURAL DIFF, the artifact the
 * incremental consumers are specified against: LAY-020 (re-lay-out
 * only the affected region when the change is local) and RTE-011
 * (incremental routing). The existing diff/ module diffs two UGM
 * SNAPSHOTS after the fact; this module is the forward path, where
 * the diff is a by-product of applying intent, exact by
 * construction rather than reconstructed.
 *
 * Design points:
 * - PURE: apply never mutates its input; callers own state.
 * - CASCADES ARE EXPLICIT: removing a node removes its incident
 *   edges, and those removals are RECORDED in the diff
 *   (cascadeRemovedEdges), never silent.
 * - DIAGNOSTICS, NOT THROWS: unknown ids, duplicate adds, and
 *   update/remove conflicts are reported per entry and the valid
 *   remainder still applies (the engine-diagnostics posture,
 *   G3L:ARC-006 family).
 * - VERSIONED WIRE FORMAT: serialize/parse with validation, per the
 *   document-format doctrine (IOP-001 alignment).
 */
import type {
  StructuralEdge,
  StructuralGraphInput,
  StructuralNode,
} from "../layout/structural";

export interface StructuralChangeSet {
  addNodes?: readonly StructuralNode[];
  /** Node ids. Incident edges cascade-remove (recorded in the diff). */
  removeNodes?: readonly string[];
  /** Shallow per-node patches; `id` is immutable (MOD-007). */
  updateNodes?: Readonly<Record<string, Partial<Omit<StructuralNode, "id">>>>;
  addEdges?: readonly StructuralEdge[];
  removeEdges?: readonly string[];
  updateEdges?: Readonly<Record<string, Partial<Omit<StructuralEdge, "id">>>>;
}

export interface StructuralDiff {
  addedNodes: string[];
  removedNodes: string[];
  changedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
  changedEdges: string[];
  /** Edges removed because an endpoint node was removed. */
  cascadeRemovedEdges: string[];
}

export interface ChangeSetDiagnostic {
  code:
    | "UNKNOWN_NODE"
    | "UNKNOWN_EDGE"
    | "DUPLICATE_NODE"
    | "DUPLICATE_EDGE"
    | "DANGLING_EDGE"
    | "REMOVED_AND_UPDATED";
  subject: string;
  message: string;
}

export interface ApplyChangeSetResult {
  input: StructuralGraphInput;
  diff: StructuralDiff;
  diagnostics: ChangeSetDiagnostic[];
}

function emptyDiff(): StructuralDiff {
  return {
    addedNodes: [],
    removedNodes: [],
    changedNodes: [],
    addedEdges: [],
    removedEdges: [],
    changedEdges: [],
    cascadeRemovedEdges: [],
  };
}

/** Apply a change set as one transaction. Pure; order of operations
 *  is removals, then updates, then adds, so a set may remove and
 *  re-add an id in one transaction (reported as removed + added). */
export function applyChangeSet(
  input: StructuralGraphInput,
  cs: StructuralChangeSet,
): ApplyChangeSetResult {
  const diff = emptyDiff();
  const diagnostics: ChangeSetDiagnostic[] = [];
  const nodeIds = new Set(input.nodes.map((n) => n.id));
  const edgeIds = new Set(input.edges.map((e) => e.id));

  const removeNodeSet = new Set<string>();
  for (const id of cs.removeNodes ?? []) {
    if (!nodeIds.has(id)) {
      diagnostics.push({
        code: "UNKNOWN_NODE",
        subject: id,
        message: `removeNodes: no node "${id}"`,
      });
      continue;
    }
    removeNodeSet.add(id);
  }
  const removeEdgeSet = new Set<string>();
  for (const id of cs.removeEdges ?? []) {
    if (!edgeIds.has(id)) {
      diagnostics.push({
        code: "UNKNOWN_EDGE",
        subject: id,
        message: `removeEdges: no edge "${id}"`,
      });
      continue;
    }
    removeEdgeSet.add(id);
  }

  // Removals + cascade.
  const nodes: StructuralNode[] = [];
  for (const n of input.nodes) {
    if (removeNodeSet.has(n.id)) {
      diff.removedNodes.push(n.id);
    } else {
      nodes.push(n);
    }
  }
  const edges: StructuralEdge[] = [];
  for (const e of input.edges) {
    if (removeEdgeSet.has(e.id)) {
      diff.removedEdges.push(e.id);
      continue;
    }
    if (removeNodeSet.has(e.source) || removeNodeSet.has(e.target)) {
      diff.cascadeRemovedEdges.push(e.id);
      continue;
    }
    edges.push(e);
  }

  // Updates (on survivors).
  const nodePatches = cs.updateNodes ?? {};
  for (let i = 0; i < nodes.length; i++) {
    const current = nodes[i];
    if (current === undefined) continue;
    const patch = nodePatches[current.id];
    if (patch === undefined) continue;
    nodes[i] = { ...current, ...patch, id: current.id };
    diff.changedNodes.push(current.id);
  }
  for (const id of Object.keys(nodePatches)) {
    if (removeNodeSet.has(id)) {
      diagnostics.push({
        code: "REMOVED_AND_UPDATED",
        subject: id,
        message: `updateNodes: "${id}" is removed in the same set; update ignored`,
      });
    } else if (!nodeIds.has(id)) {
      diagnostics.push({
        code: "UNKNOWN_NODE",
        subject: id,
        message: `updateNodes: no node "${id}"`,
      });
    }
  }
  const edgePatches = cs.updateEdges ?? {};
  for (let i = 0; i < edges.length; i++) {
    const current = edges[i];
    if (current === undefined) continue;
    const patch = edgePatches[current.id];
    if (patch === undefined) continue;
    edges[i] = { ...current, ...patch, id: current.id };
    diff.changedEdges.push(current.id);
  }
  for (const id of Object.keys(edgePatches)) {
    if (removeEdgeSet.has(id)) {
      diagnostics.push({
        code: "REMOVED_AND_UPDATED",
        subject: id,
        message: `updateEdges: "${id}" is removed in the same set; update ignored`,
      });
    } else if (!edgeIds.has(id)) {
      diagnostics.push({
        code: "UNKNOWN_EDGE",
        subject: id,
        message: `updateEdges: no edge "${id}"`,
      });
    }
  }

  // Adds (after removals: remove+re-add in one set is legal).
  const liveNodeIds = new Set(nodes.map((n) => n.id));
  for (const n of cs.addNodes ?? []) {
    if (liveNodeIds.has(n.id)) {
      diagnostics.push({
        code: "DUPLICATE_NODE",
        subject: n.id,
        message: `addNodes: "${n.id}" already exists`,
      });
      continue;
    }
    liveNodeIds.add(n.id);
    nodes.push({ ...n });
    diff.addedNodes.push(n.id);
  }
  const liveEdgeIds = new Set(edges.map((e) => e.id));
  for (const e of cs.addEdges ?? []) {
    if (liveEdgeIds.has(e.id)) {
      diagnostics.push({
        code: "DUPLICATE_EDGE",
        subject: e.id,
        message: `addEdges: "${e.id}" already exists`,
      });
      continue;
    }
    if (!liveNodeIds.has(e.source) || !liveNodeIds.has(e.target)) {
      diagnostics.push({
        code: "DANGLING_EDGE",
        subject: e.id,
        message: `addEdges: "${e.id}" references a missing endpoint`,
      });
      continue;
    }
    liveEdgeIds.add(e.id);
    edges.push({ ...e });
    diff.addedEdges.push(e.id);
  }

  return { input: { nodes, edges }, diff, diagnostics };
}

/**
 * Invert a change set against the input it was applied TO (the
 * BEFORE state), producing the undo set: applying the inverse to the
 * AFTER state restores the before state (id-stable round trip).
 * Cascade-removed edges are restored by the inverse as explicit
 * addEdges.
 */
export function invertChangeSet(
  before: StructuralGraphInput,
  cs: StructuralChangeSet,
): StructuralChangeSet {
  const applied = applyChangeSet(before, cs);
  const nodeById = new Map(before.nodes.map((n) => [n.id, n] as const));
  const edgeById = new Map(before.edges.map((e) => [e.id, e] as const));
  const inv: {
    addNodes: StructuralNode[];
    removeNodes: string[];
    updateNodes: Record<string, Partial<Omit<StructuralNode, "id">>>;
    addEdges: StructuralEdge[];
    removeEdges: string[];
    updateEdges: Record<string, Partial<Omit<StructuralEdge, "id">>>;
  } = {
    addNodes: [],
    removeNodes: [],
    updateNodes: {},
    addEdges: [],
    removeEdges: [],
    updateEdges: {},
  };
  for (const id of applied.diff.removedNodes) {
    const n = nodeById.get(id);
    if (n) inv.addNodes.push(n);
  }
  for (const id of [
    ...applied.diff.removedEdges,
    ...applied.diff.cascadeRemovedEdges,
  ]) {
    const e = edgeById.get(id);
    if (e) inv.addEdges.push(e);
  }
  for (const id of applied.diff.addedNodes) inv.removeNodes.push(id);
  for (const id of applied.diff.addedEdges) inv.removeEdges.push(id);
  for (const id of applied.diff.changedNodes) {
    const orig = nodeById.get(id);
    if (orig) {
      const rest = { ...orig } as Partial<StructuralNode>;
      delete rest.id;
      inv.updateNodes[id] = rest;
    }
  }
  for (const id of applied.diff.changedEdges) {
    const orig = edgeById.get(id);
    if (orig) {
      const rest = { ...orig } as Partial<StructuralEdge>;
      delete rest.id;
      inv.updateEdges[id] = rest;
    }
  }
  return inv;
}

/**
 * Locality assessment for LAY-020: a diff is LOCAL when it touches
 * no container membership (adds/removes of containers change the
 * global structure) and the touched population stays under the
 * threshold. The affected region is the touched elements plus their
 * one-hop neighborhood, the seed the incremental layout consumes.
 */
export function affectedRegion(
  input: StructuralGraphInput,
  diff: StructuralDiff,
  options?: { localThreshold?: number },
): { local: boolean; region: string[] } {
  const threshold = options?.localThreshold ?? 24;
  const touched = new Set<string>([
    ...diff.addedNodes,
    ...diff.removedNodes,
    ...diff.changedNodes,
  ]);
  for (const id of [
    ...diff.addedEdges,
    ...diff.removedEdges,
    ...diff.changedEdges,
    ...diff.cascadeRemovedEdges,
  ]) {
    const e = input.edges.find((x) => x.id === id);
    if (e) {
      touched.add(e.source);
      touched.add(e.target);
    }
  }
  const region = new Set(touched);
  for (const e of input.edges) {
    if (touched.has(e.source)) region.add(e.target);
    if (touched.has(e.target)) region.add(e.source);
  }
  const containersTouched = input.nodes.some(
    (n) => touched.has(n.id) && (n.compartments?.length ?? 0) > 0,
  );
  return {
    local: !containersTouched && touched.size <= threshold,
    region: [...region].sort(),
  };
}

/** Versioned wire format (IOP-001 alignment). */
export interface ChangeSetDocument {
  version: 1;
  changeSet: StructuralChangeSet;
}

export function serializeChangeSet(cs: StructuralChangeSet): string {
  const doc: ChangeSetDocument = { version: 1, changeSet: cs };
  return JSON.stringify(doc);
}

export function parseChangeSet(
  text: string,
): { changeSet: StructuralChangeSet } | { error: string } {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { error: `invalid JSON: ${String(e)}` };
  }
  if (
    typeof doc !== "object" ||
    doc === null ||
    (doc as { version?: unknown }).version !== 1 ||
    typeof (doc as { changeSet?: unknown }).changeSet !== "object" ||
    (doc as { changeSet?: unknown }).changeSet === null
  ) {
    return { error: "not a version-1 change-set document" };
  }
  return { changeSet: (doc as ChangeSetDocument).changeSet };
}
