/**
 * Convert UGM nodes and edges to Cytoscape ElementDefinition arrays.
 *
 * This module bridges the framework-agnostic UGM (D6) with the
 * Cytoscape renderer (D13). It lives in src/views/ because it
 * imports Cytoscape types.
 */

import type { ElementDefinition } from "cytoscape";
import type { UGM } from "@core/ugm";
import { buildTypeVisualMap } from "./palette";

/**
 * Convert all UGM nodes and edges to Cytoscape elements.
 * Assigns visual properties (color, shape) based on the node's
 * primary type (types[0]).
 */
export function ugmToCytoscapeElements(ugm: UGM): ElementDefinition[] {
  const registry = ugm.getRegistry();
  const typeMap = buildTypeVisualMap(registry.nodeTypes);
  const elements: ElementDefinition[] = [];

  ugm.forEachNode((id, attrs) => {
    const primaryType = attrs.types[0] ?? "_default";
    const visual = typeMap.get(primaryType) ?? {
      color: "#999999",
      shape: "ellipse" as const,
    };

    elements.push({
      group: "nodes",
      data: {
        id,
        label:
          typeof attrs.properties.name === "string"
            ? attrs.properties.name
            : id,
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

  ugm.forEachEdge((edgeId, attrs, source, target) => {
    elements.push({
      group: "edges",
      data: {
        id: edgeId,
        source,
        target,
        label: attrs.type,
        type: attrs.type,
        _confidence: attrs.meta.confidence ?? 1,
        _asserted: attrs.meta.asserted ?? true,
        ...attrs.properties,
      },
    });
  });

  return elements;
}
