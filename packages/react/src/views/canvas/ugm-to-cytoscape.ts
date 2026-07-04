/**
 * Convert UGM nodes and edges to Cytoscape ElementDefinition arrays.
 *
 * This module bridges the framework-agnostic UGM (D6) with the
 * Cytoscape renderer (D13). It lives in src/views/ because it
 * imports Cytoscape types.
 */

import type { ElementDefinition } from "cytoscape";
import type { UGM } from "@g3t/core";
import { buildTypeVisualMap } from "./palette";

/**
 * Convert all UGM nodes and edges to Cytoscape elements.
 * Assigns visual properties (color, shape) based on the node's
 * primary type (types[0]).
 *
 * Bugfix 21: each edge gets a `_curveStyle` data field so the
 * stylesheet can use `straight` for the common case and reserve
 * `bezier` for edges that actually need the curve to stay visible:
 * self-loops, multi-edges (parallel between the same pair), and
 * bidirectional pairs (A→B AND B→A). For everything else - single
 * directed edge between distinct nodes - a straight line is
 * cleaner. See CytoscapeCanvas DEFAULT_STYLESHEET for how this
 * data field gets consumed.
 */
/** Compound-container mapping (slice 1, round 17;
 *  roadmap/design/toolbar-and-layouts.md). Edges of the named type
 *  become Cytoscape parent assignments (containment) and are OMITTED
 *  as rendered edges; container nodes carry a UML-style
 *  «Stereotype» label. */
export interface ContainmentOptions {
  /** UGM edge type expressing containment. */
  edgeType: string;
  /** Whether the edge points parent→child or child→parent. */
  direction: "parentToChild" | "childToParent";
}

export interface UgmToCytoscapeOptions {
  containment?: ContainmentOptions;
}

export function ugmToCytoscapeElements(
  ugm: UGM,
  options?: UgmToCytoscapeOptions,
): ElementDefinition[] {
  const registry = ugm.getRegistry();
  const typeMap = buildTypeVisualMap(registry.nodeTypes);
  const elements: ElementDefinition[] = [];

  // Containment pre-pass: child -> parent, plus the parent id set
  // (for «Stereotype» container labels).
  const containment = options?.containment;
  const parentOf = new Map<string, string>();
  const parentIds = new Set<string>();
  if (containment) {
    ugm.forEachEdge((_edgeId, attrs, source, target) => {
      if (attrs.type !== containment.edgeType) return;
      const [parent, child] =
        containment.direction === "parentToChild"
          ? [source, target]
          : [target, source];
      parentOf.set(child, parent);
      parentIds.add(parent);
    });
  }

  ugm.forEachNode((id, attrs) => {
    const primaryType = attrs.types[0] ?? "_default";
    const visual = typeMap.get(primaryType) ?? {
      color: "#999999",
      shape: "ellipse" as const,
    };

    const name =
      typeof attrs.properties.name === "string" ? attrs.properties.name : id;
    elements.push({
      group: "nodes",
      data: {
        id,
        label: name,
        ...(parentOf.has(id) ? { parent: parentOf.get(id) } : {}),
        ...(parentIds.has(id)
          ? { _compoundLabel: `\u00AB${primaryType}\u00BB\n${name}` }
          : {}),
        types: attrs.types,
        _color: visual.color,
        _shape: visual.shape,
        _size:
          typeof attrs.properties.size === "number"
            ? attrs.properties.size
            : 30,
        ...attrs.properties,
      },
    });
  });

  // First pass: index edges by ordered (source→target) and unordered
  // ({source,target}) keys so we can detect parallels and bidirectional
  // pairs in O(E).
  const orderedCount = new Map<string, number>();
  const unorderedCount = new Map<string, number>();
  ugm.forEachEdge((_edgeId, _attrs, source, target) => {
    const ordered = `${source}\x00${target}`;
    const unordered =
      source < target ? `${source}\x00${target}` : `${target}\x00${source}`;
    orderedCount.set(ordered, (orderedCount.get(ordered) ?? 0) + 1);
    unorderedCount.set(unordered, (unorderedCount.get(unordered) ?? 0) + 1);
  });

  ugm.forEachEdge((edgeId, attrs, source, target) => {
    // Containment edges became parent assignments above: omit them
    // from the rendered edge set.
    if (containment && attrs.type === containment.edgeType) return;
    // Curve style decision:
    //   - self-loop (source === target): bezier (straight degenerates)
    //   - more than one edge in this ordered direction: bezier (parallels overlap)
    //   - exists an edge in the reverse direction too (unordered pair has >1
    //     edge total even though this direction has 1): bezier (arrowheads
    //     would clash)
    //   - otherwise: straight
    let curveStyle: "straight" | "bezier" = "straight";
    if (source === target) {
      curveStyle = "bezier";
    } else {
      const orderedKey = `${source}\x00${target}`;
      const unorderedKey =
        source < target ? `${source}\x00${target}` : `${target}\x00${source}`;
      const ord = orderedCount.get(orderedKey) ?? 1;
      const unord = unorderedCount.get(unorderedKey) ?? 1;
      if (ord > 1 || unord > ord) curveStyle = "bezier";
    }

    elements.push({
      group: "edges",
      data: {
        id: edgeId,
        source,
        target,
        label: attrs.type,
        type: attrs.type,
        _confidence: attrs.meta.confidence ?? 1,
        // Cytoscape selectors can't match boolean false; use 0/1
        _asserted: (attrs.meta.asserted ?? true) ? 1 : 0,
        _curveStyle: curveStyle,
        ...attrs.properties,
      },
    });
  });

  return elements;
}
