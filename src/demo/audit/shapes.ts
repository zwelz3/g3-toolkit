/**
 * Node-local SHACL shapes over the provenance record. Entities must carry a
 * generation time (violation if absent) and must be attributed to some
 * activity or prior entity (warning if orphaned, read from the materialized
 * `attributed` flag). Activities must record a start (violation) and should
 * record an end (warning if the record was never closed out).
 */
import type { ShaclShape } from "@g3t/core";

export const SHAPE_ENTITY = "shape:entity";
export const SHAPE_ACTIVITY = "shape:activity";

export const provenanceShapes: ShaclShape[] = [
  {
    id: SHAPE_ENTITY,
    targetClass: "Entity",
    name: "Entity provenance",
    description:
      "Every artifact must record when and from what it was generated.",
    properties: [
      {
        path: "generatedAtTime",
        name: "Generation time",
        minCount: 1,
        severity: "violation",
      },
      {
        path: "attributed",
        name: "Attribution",
        in: [true],
        severity: "warning",
      },
    ],
  },
  {
    id: SHAPE_ACTIVITY,
    targetClass: "Activity",
    name: "Activity record",
    description:
      "Every activity must record a start, and should record an end.",
    properties: [
      {
        path: "startedAtTime",
        name: "Start time",
        minCount: 1,
        severity: "violation",
      },
      {
        path: "endedAtTime",
        name: "End time",
        minCount: 1,
        severity: "warning",
      },
    ],
  },
];
