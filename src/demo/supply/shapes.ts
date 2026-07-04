/**
 * SHACL shapes over the consolidated thread. Both are node-local (the
 * toolkit validator reads a node's own properties), which is why the thread
 * materializes certificationStatus during consolidation: the cross-source
 * "does any supplier hold the required cert" question is answered when the
 * thread is built, then this shape simply checks the derived flag. The
 * provenance shape catches records a source system left incomplete.
 */
import type { ShaclShape } from "@g3t/core";

export const SHAPE_CERT = "shape.part.cert";
export const SHAPE_PROVENANCE = "shape.supplier.provenance";

export const supplyShapes: ShaclShape[] = [
  {
    id: SHAPE_CERT,
    targetClass: "Part",
    name: "Certification coverage",
    description:
      "Each part's suppliers must collectively hold the certification the part requires.",
    properties: [
      {
        path: "certificationStatus",
        name: "Certification status",
        in: ["covered", "n/a"],
        severity: "violation",
      },
    ],
  },
  {
    id: SHAPE_PROVENANCE,
    targetClass: "Supplier",
    name: "Supplier record completeness",
    description:
      "Consolidated supplier records must carry both a tier and a region.",
    properties: [
      { path: "tier", name: "Tier", minCount: 1, severity: "warning" },
      { path: "region", name: "Region", minCount: 1, severity: "warning" },
    ],
  },
];
