/**
 * Supply-chain digital thread: the point of item 1 is that no single system
 * holds the whole picture. An ERP owns the bill of materials, a supplier
 * registry owns tiers and regions, a certification registry owns which
 * suppliers hold which quality/compliance credentials, a sourcing system
 * owns who actually supplies each part, and a logistics system owns
 * facilities. buildDigitalThread consolidates those sources into one UGM,
 * tagging every node with the source it came from (provenance) and
 * MATERIALIZING two derived facts on each part that no single source could
 * answer alone: how many suppliers it has (supplierCount) and whether any of
 * those suppliers actually holds the certification the part requires
 * (certificationStatus). Those derived facts are what the SHACL shapes and
 * the gap analytics read, so the "thread" is doing real cross-source work.
 *
 * The domain is a defense airframe program: critical parts, tiered suppliers
 * across regions, and credentials like AS9100 / NADCAP / ITAR.
 */
import { UGM } from "@g3t/core";

export type SourceSystem =
  | "ERP"
  | "SupplierDB"
  | "CertRegistry"
  | "Sourcing"
  | "Logistics";

interface PartRecord {
  id: string;
  name: string;
  criticality: "critical" | "standard";
  /** Credential the part's supplier must hold; absent = none required. */
  requiredCert?: string;
  assembly: string;
}
interface AssemblyRecord {
  id: string;
  name: string;
}
interface SupplierRecord {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  /** Optional on purpose: a source system that failed to provide region
   *  leaves a provenance gap the SHACL completeness shape flags. */
  region?: string;
}
interface CertGrant {
  supplier: string;
  cert: string;
}
interface SupplyRecord {
  supplier: string;
  part: string;
}
interface FacilityRecord {
  id: string;
  name: string;
  region: string;
}
interface OperatesRecord {
  supplier: string;
  facility: string;
}

// ── Source records (each block stands in for one upstream system) ─────────

const assemblies: AssemblyRecord[] = [
  { id: "asm.airframe", name: "Airframe Assembly" },
  { id: "asm.avionics", name: "Avionics Bay" },
];

const parts: PartRecord[] = [
  {
    id: "part.spar",
    name: "Wing Spar",
    criticality: "critical",
    requiredCert: "NADCAP",
    assembly: "asm.airframe",
  },
  {
    id: "part.skin",
    name: "Fuselage Skin",
    criticality: "critical",
    requiredCert: "NADCAP",
    assembly: "asm.airframe",
  },
  {
    id: "part.fastener",
    name: "Titanium Fastener",
    criticality: "standard",
    requiredCert: "AS9100",
    assembly: "asm.airframe",
  },
  {
    id: "part.fcc",
    name: "Flight Control Computer",
    criticality: "critical",
    requiredCert: "ITAR",
    assembly: "asm.avionics",
  },
  {
    id: "part.imu",
    name: "Inertial Measurement Unit",
    criticality: "critical",
    requiredCert: "ITAR",
    assembly: "asm.avionics",
  },
  {
    id: "part.harness",
    name: "Wiring Harness",
    criticality: "standard",
    requiredCert: "AS9100",
    assembly: "asm.avionics",
  },
];

const suppliers: SupplierRecord[] = [
  { id: "sup.alpha", name: "Alpha Aerostructures", tier: 1, region: "US-West" },
  { id: "sup.beta", name: "Beta Metals", tier: 2, region: "US-Midwest" },
  { id: "sup.gamma", name: "Gamma Composites", tier: 2, region: "EU-Central" },
  { id: "sup.delta", name: "Delta Avionics", tier: 1, region: "US-East" },
  { id: "sup.epsilon", name: "Epsilon Sensors", tier: 2 }, // region missing: provenance gap
  { id: "sup.zeta", name: "Zeta Interconnect", tier: 3, region: "APAC" },
  { id: "sup.eta", name: "Eta Fastening", tier: 3, region: "EU-Central" },
];

const certGrants: CertGrant[] = [
  { supplier: "sup.alpha", cert: "NADCAP" },
  { supplier: "sup.alpha", cert: "AS9100" },
  { supplier: "sup.beta", cert: "AS9100" }, // NOT NADCAP: relevant to a sole-sourced spar? no, beta doesn't supply spar
  { supplier: "sup.gamma", cert: "NADCAP" },
  { supplier: "sup.delta", cert: "ITAR" },
  { supplier: "sup.delta", cert: "AS9100" },
  // sup.epsilon holds NO ITAR: it supplies the IMU which requires ITAR -> missing-cert gap
  { supplier: "sup.zeta", cert: "AS9100" },
  { supplier: "sup.eta", cert: "AS9100" },
];

const supplies: SupplyRecord[] = [
  // spar: sole-sourced to alpha (NADCAP ok)
  { supplier: "sup.alpha", part: "part.spar" },
  // skin: two sources (alpha, gamma) both NADCAP -> covered, not sole-source
  { supplier: "sup.alpha", part: "part.skin" },
  { supplier: "sup.gamma", part: "part.skin" },
  // fastener: two sources (eta, beta) both AS9100
  { supplier: "sup.eta", part: "part.fastener" },
  { supplier: "sup.beta", part: "part.fastener" },
  // fcc: sole-sourced to delta (ITAR ok) -> SPOF but cert covered
  { supplier: "sup.delta", part: "part.fcc" },
  // imu: sole-sourced to epsilon, which lacks ITAR -> sole-source AND missing-cert
  { supplier: "sup.epsilon", part: "part.imu" },
  // harness: sole-sourced to zeta (AS9100 ok)
  { supplier: "sup.zeta", part: "part.harness" },
];

const facilities: FacilityRecord[] = [
  { id: "fac.longbeach", name: "Long Beach Plant", region: "US-West" },
  { id: "fac.dayton", name: "Dayton Plant", region: "US-Midwest" },
  { id: "fac.munich", name: "Munich Plant", region: "EU-Central" },
  { id: "fac.boston", name: "Boston Plant", region: "US-East" },
];

const operates: OperatesRecord[] = [
  { supplier: "sup.alpha", facility: "fac.longbeach" },
  { supplier: "sup.beta", facility: "fac.dayton" },
  { supplier: "sup.gamma", facility: "fac.munich" },
  { supplier: "sup.delta", facility: "fac.boston" },
  { supplier: "sup.zeta", facility: "fac.longbeach" },
  { supplier: "sup.eta", facility: "fac.munich" },
];

/** Node property keys the analytics and shapes rely on (kept stable). */
export const SUPPLY_KEYS = {
  source: "source",
  supplierCount: "supplierCount",
  certificationStatus: "certificationStatus",
  requiredCert: "requiredCert",
  criticality: "criticality",
  tier: "tier",
  region: "region",
  heldCerts: "heldCertifications",
} as const;

/**
 * Consolidate the source records into one UGM, tagging provenance and
 * materializing the two derived facts (supplierCount, certificationStatus).
 */
export function buildDigitalThread(): UGM {
  const ugm = new UGM();

  // Precompute cross-source joins the thread is responsible for.
  const heldBySupplier = new Map<string, Set<string>>();
  for (const g of certGrants) {
    const set = heldBySupplier.get(g.supplier) ?? new Set<string>();
    set.add(g.cert);
    heldBySupplier.set(g.supplier, set);
  }
  const suppliersByPart = new Map<string, string[]>();
  for (const s of supplies) {
    const list = suppliersByPart.get(s.part) ?? [];
    list.push(s.supplier);
    suppliersByPart.set(s.part, list);
  }

  for (const a of assemblies) {
    ugm.addNode(a.id, {
      types: ["Assembly"],
      properties: { name: a.name, source: "ERP" },
    });
  }

  for (const s of suppliers) {
    const held = [...(heldBySupplier.get(s.id) ?? [])];
    const properties: Record<string, unknown> = {
      name: s.name,
      source: "SupplierDB",
      tier: s.tier,
      [SUPPLY_KEYS.heldCerts]: held,
    };
    if (s.region) properties.region = s.region;
    ugm.addNode(s.id, { types: ["Supplier"], properties });
  }

  for (const f of facilities) {
    ugm.addNode(f.id, {
      types: ["Facility"],
      properties: { name: f.name, source: "Logistics", region: f.region },
    });
  }

  for (const p of parts) {
    const partSuppliers = suppliersByPart.get(p.id) ?? [];
    const covered = p.requiredCert
      ? partSuppliers.some(
          (sid) => heldBySupplier.get(sid)?.has(p.requiredCert ?? "") ?? false,
        )
      : true;
    const certificationStatus = !p.requiredCert
      ? "n/a"
      : covered
        ? "covered"
        : "missing";
    ugm.addNode(p.id, {
      types: ["Part"],
      properties: {
        name: p.name,
        source: "ERP",
        criticality: p.criticality,
        ...(p.requiredCert ? { requiredCert: p.requiredCert } : {}),
        supplierCount: partSuppliers.length,
        certificationStatus,
      },
    });
    ugm.addEdge(p.id, p.assembly, { type: "partOf", confidence: 1 });
  }

  for (const s of supplies) {
    ugm.addEdge(s.supplier, s.part, { type: "supplies", confidence: 0.9 });
  }
  for (const o of operates) {
    ugm.addEdge(o.supplier, o.facility, { type: "operatesAt", confidence: 1 });
  }

  return ugm;
}
