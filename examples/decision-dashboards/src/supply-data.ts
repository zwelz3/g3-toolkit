/**
 * Data layer for the impact dashboard (the INGEST BOUNDARY).
 *
 * Same architectural role as satellite-data.ts: this is the one module
 * an integrator swaps to point at real data (an ERP/PLM export, a
 * supplier database, a CSV). The dashboard consumes the UGM and never
 * needs to know where it came from.
 *
 * The source here is a synthetic-but-realistically-scaled supply
 * network (~50 nodes across four tiers: suppliers, parts, assemblies,
 * products) with deliberate concentration risk (a few suppliers single-
 * source many parts) so the centrality sizing and the blast-radius
 * trace have something meaningful to show.
 *
 * @see examples/decision-dashboards/README.md (architecture)
 */

import { UGM } from "@g3t/core";

export type Tier = "Supplier" | "Part" | "Assembly" | "Product";

export interface SupplyNode {
  id: string;
  name: string;
  tier: Tier;
  /** Country of origin for suppliers (drives a geographic risk view). */
  country?: string;
}

export interface SupplyEdge {
  from: string;
  to: string;
  /** "supplies" (supplier->part) or "partOf" (part->assembly etc). */
  kind: "supplies" | "partOf";
}

/** The "query result": nodes across the four tiers. */
export function fetchSupplyNodes(): SupplyNode[] {
  const nodes: SupplyNode[] = [];
  const sup = (id: string, name: string, country: string) =>
    nodes.push({ id, name, tier: "Supplier", country });
  const part = (id: string, name: string) =>
    nodes.push({ id, name, tier: "Part" });
  const asm = (id: string, name: string) =>
    nodes.push({ id, name, tier: "Assembly" });
  const prod = (id: string, name: string) =>
    nodes.push({ id, name, tier: "Product" });

  // Suppliers (some single-source many parts: concentration risk).
  sup("acme", "Acme Components", "US");
  sup("globex", "Globex Metals", "DE");
  sup("initech", "Initech Plastics", "US");
  sup("umbrella", "Umbrella Alloys", "JP");
  sup("hooli", "Hooli Electronics", "TW");
  sup("stark", "Stark Fasteners", "US");
  sup("wayne", "Wayne Composites", "GB");

  // Parts.
  part("bearing", "Precision Bearing");
  part("casing", "Alloy Casing");
  part("gasket", "Polymer Gasket");
  part("bolt", "Titanium Bolt");
  part("pcb", "Control PCB");
  part("connector", "Wire Connector");
  part("spring", "Compression Spring");
  part("seal", "Hydraulic Seal");
  part("magnet", "Rare-Earth Magnet");
  part("lens", "Optical Lens");
  part("sensor", "MEMS Sensor");
  part("cable", "Shielded Cable");
  part("bracket", "Mounting Bracket");
  part("damper", "Vibration Damper");

  // Assemblies.
  asm("gearbox", "Gearbox Assembly");
  asm("housing", "Sensor Housing");
  asm("actuator-core", "Actuator Core");
  asm("control-unit", "Control Unit");
  asm("optical-bench", "Optical Bench");
  asm("power-module", "Power Module");

  // Products.
  prod("actuator", "Actuator Unit");
  prod("sensor-pod", "Sensor Pod");
  prod("camera", "Camera System");
  prod("controller", "Flight Controller");
  return nodes;
}

/** The "query result": supplies and partOf edges. */
export function fetchSupplyEdges(): SupplyEdge[] {
  const s = (from: string, to: string): SupplyEdge => ({
    from,
    to,
    kind: "supplies",
  });
  const p = (from: string, to: string): SupplyEdge => ({
    from,
    to,
    kind: "partOf",
  });
  return [
    // Acme single-sources four parts: the dominant choke point.
    s("acme", "bearing"),
    s("acme", "bolt"),
    s("acme", "spring"),
    s("acme", "bracket"),
    // Globex: metals.
    s("globex", "casing"),
    s("globex", "bearing"), // bearing dual-sourced
    s("globex", "bolt"), // bolt dual-sourced
    // Initech: polymers.
    s("initech", "gasket"),
    s("initech", "seal"),
    s("initech", "damper"),
    // Umbrella: specialty alloys.
    s("umbrella", "magnet"),
    s("umbrella", "casing"), // casing dual-sourced
    // Hooli: electronics (another concentration: 4 parts).
    s("hooli", "pcb"),
    s("hooli", "connector"),
    s("hooli", "sensor"),
    s("hooli", "cable"),
    // Stark: fasteners.
    s("stark", "bolt"), // bolt triple-sourced
    s("stark", "spring"), // spring dual-sourced
    // Wayne: composites/optics.
    s("wayne", "lens"),
    s("wayne", "bracket"), // bracket dual-sourced

    // Parts -> assemblies.
    p("bearing", "gearbox"),
    p("bolt", "gearbox"),
    p("spring", "gearbox"),
    p("gasket", "housing"),
    p("casing", "housing"),
    p("sensor", "housing"),
    p("magnet", "actuator-core"),
    p("bearing", "actuator-core"),
    p("seal", "actuator-core"),
    p("pcb", "control-unit"),
    p("connector", "control-unit"),
    p("cable", "control-unit"),
    p("lens", "optical-bench"),
    p("bracket", "optical-bench"),
    p("sensor", "optical-bench"),
    p("pcb", "power-module"),
    p("connector", "power-module"),
    p("damper", "power-module"),

    // Assemblies -> products.
    p("gearbox", "actuator"),
    p("actuator-core", "actuator"),
    p("control-unit", "actuator"),
    p("housing", "sensor-pod"),
    p("control-unit", "sensor-pod"),
    p("optical-bench", "camera"),
    p("control-unit", "camera"),
    p("power-module", "camera"),
    p("control-unit", "controller"),
    p("power-module", "controller"),
    p("housing", "controller"),
  ];
}

/**
 * Build the dependency UGM from the "query results". The ingest step
 * an integrator owns: tier travels as a node type AND a property (the
 * encoding colors by tier; the panels read the property).
 */
export function buildSupplyNetwork(): UGM {
  const g = new UGM();
  for (const node of fetchSupplyNodes()) {
    g.addNode(node.id, {
      types: [node.tier],
      properties: {
        name: node.name,
        tier: node.tier,
        ...(node.country !== undefined ? { country: node.country } : {}),
      },
    });
  }
  for (const edge of fetchSupplyEdges()) {
    g.addEdge(edge.from, edge.to, { type: edge.kind, properties: {} });
  }
  return g;
}

/**
 * Downstream blast radius of a node: everything reachable by following
 * outgoing edges transitively (a supplier's parts, the assemblies that
 * use them, the products that ship them). Pure directed walk; the start
 * node is excluded. Moved here from the former ImpactDashboard so the
 * graph logic lives with the data it operates on.
 */
export function downstreamImpact(ugm: UGM, start: string): string[] {
  const out = new Map<string, string[]>();
  ugm.forEachEdge((_id, _attrs, source, target) => {
    const list = out.get(source);
    if (list) list.push(target);
    else out.set(source, [target]);
  });
  const seen = new Set<string>();
  const stack = [...(out.get(start) ?? [])];
  while (stack.length > 0) {
    const n = stack.pop();
    if (n === undefined || seen.has(n) || n === start) continue;
    seen.add(n);
    for (const next of out.get(n) ?? []) stack.push(next);
  }
  return [...seen];
}

/**
 * Origin-declaration coverage per tier: the share of nodes in each tier
 * carrying a `country` property. The supply fixture leaves origin
 * genuinely undeclared on part of the network, so this is a real
 * partial-coverage signal (claimed supply base vs geographically
 * substantiated), rendered by CoverageMeter in the analytics dashboard.
 */
export function originCoverageByTier(
  ugm: UGM,
): Array<{ tier: string; substantiated: number; total: number }> {
  const byTier = new Map<string, { declared: number; total: number }>();
  ugm.forEachNode((_id, attrs) => {
    const tier = String(attrs.properties.tier ?? "unknown");
    const rec = byTier.get(tier) ?? { declared: 0, total: 0 };
    rec.total += 1;
    if (attrs.properties.country !== undefined) rec.declared += 1;
    byTier.set(tier, rec);
  });
  return [...byTier.entries()]
    .map(([tier, r]) => ({
      tier,
      substantiated: r.total === 0 ? 0 : r.declared / r.total,
      total: r.total,
    }))
    .sort((a, b) => a.tier.localeCompare(b.tier));
}
