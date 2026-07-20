/**
 * Multi-type membership rendering (review 5.21). Individuals in the
 * workbench legitimately belong to several classes at once,
 * especially with inference on (subclass and equivalence entailment
 * add memberships), but the canvas colors by types[0] only, so the
 * extra memberships were invisible. Cytoscape's native pie
 * backgrounds render a SPLIT RING: each membership gets an equal
 * slice, colored by the SAME categorical map the encoding spec and
 * legend use, so a slice color always matches a legend row.
 *
 * Two parts:
 * - stampMultiTypePies writes _pieSize plus per-slice
 *   _pieNColor/_pieNSize properties onto nodes with 2+ types
 *   (properties spread into Cytoscape data at conversion).
 * - MULTI_TYPE_PIE_RULES maps those via attribute-presence selectors,
 *   one rule PER SLICE, so a two-type node never triggers the
 *   missing-field mapping warning for slice 3 (the same per-frame
 *   console-flood discipline the base stylesheet follows).
 *
 * Memberships beyond MAX_SLICES are dropped from the ring (the
 * details rail still lists them all); four slices is the legibility
 * ceiling at demo node sizes.
 */
import type { UGM } from "@g3t/core";

export const MAX_SLICES = 4;

type CyStylesheet = { selector: string; style: Record<string, unknown> };

/**
 * Write pie-slice properties for every node with 2+ types whose
 * colors are known. Mutates and returns the given UGM (the workbench
 * projections are fresh per memo, so in-place is safe and cheap).
 */
export function stampMultiTypePies(
  ugm: UGM,
  colorOf: ReadonlyMap<string, string>,
): UGM {
  const patches: Array<[string, Record<string, unknown>]> = [];
  ugm.forEachNode((id, attrs) => {
    if (attrs.types.length < 2) return;
    const sliced = attrs.types.slice(0, MAX_SLICES);
    const colors = sliced.map((t) => colorOf.get(t));
    if (colors.some((c) => c === undefined)) return;
    const share = Math.floor(100 / sliced.length);
    const patch: Record<string, unknown> = { _pieSize: "100%" };
    sliced.forEach((_t, i) => {
      patch[`_pie${i + 1}Color`] = colors[i];
      patch[`_pie${i + 1}Size`] = share;
    });
    patches.push([id, patch]);
  });
  for (const [id, patch] of patches) {
    ugm.updateNodeProperties(id, patch);
  }
  return ugm;
}

/** One rule per slice: attribute-presence guarded (see module doc). */
export const MULTI_TYPE_PIE_RULES: CyStylesheet[] = [
  {
    selector: "node[_pie1Color]",
    style: {
      // 12.15 (Zach's confirmation): the pie is a CIRCLE overlay, so
      // on any non-ellipse node the two shapes clash visually. A
      // multi-type node's ring IS its shape story: force ellipse so
      // ring and body coincide. Single-type nodes keep their kind
      // shapes; the legend documents the shape channel.
      shape: "ellipse",
      "pie-size": "data(_pieSize)",
      "pie-1-background-color": "data(_pie1Color)",
      "pie-1-background-size": "data(_pie1Size)",
      "pie-1-background-opacity": 1,
    },
  },
  {
    selector: "node[_pie2Color]",
    style: {
      "pie-2-background-color": "data(_pie2Color)",
      "pie-2-background-size": "data(_pie2Size)",
      "pie-2-background-opacity": 1,
    },
  },
  {
    selector: "node[_pie3Color]",
    style: {
      "pie-3-background-color": "data(_pie3Color)",
      "pie-3-background-size": "data(_pie3Size)",
      "pie-3-background-opacity": 1,
    },
  },
  {
    selector: "node[_pie4Color]",
    style: {
      "pie-4-background-color": "data(_pie4Color)",
      "pie-4-background-size": "data(_pie4Size)",
      "pie-4-background-opacity": 1,
    },
  },
];
