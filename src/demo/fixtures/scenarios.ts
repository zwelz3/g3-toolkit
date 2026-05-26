/**
 * Demo fixture datasets.
 *
 * Each scenario builds a UGM with realistic entities and
 * relationships that exercise different toolkit capabilities.
 */

import { UGM } from "@g3t/core";

// ── Helpers ─────────────────────────────────────────────────────────

function addNodes(
  ugm: UGM,
  nodes: Array<{ id: string; type: string; props: Record<string, unknown> }>,
) {
  for (const n of nodes) {
    ugm.addNode(n.id, { types: [n.type], properties: n.props });
  }
}

function addEdges(ugm: UGM, edges: Array<[string, string, string, number?]>) {
  for (const [s, t, type, conf] of edges) {
    ugm.addEdge(s, t, { type, confidence: conf ?? 0.85 });
  }
}

// ── 1. Counter-Threat Intelligence ──────────────────────────────────

export function buildIntelGraph(): UGM {
  const ugm = new UGM();

  addNodes(ugm, [
    {
      id: "volkov",
      type: "Person",
      props: {
        name: "Dmitri Volkov",
        role: "Handler",
        risk: 0.91,
        lat: 55.75,
        lon: 37.62,
      },
    },
    {
      id: "tanaka",
      type: "Person",
      props: {
        name: "Yuki Tanaka",
        role: "Courier",
        risk: 0.67,
        lat: 35.68,
        lon: 139.69,
      },
    },
    {
      id: "osei",
      type: "Person",
      props: {
        name: "Kwame Osei",
        role: "Financier",
        risk: 0.84,
        lat: 5.56,
        lon: -0.19,
      },
    },
    {
      id: "chen",
      type: "Person",
      props: {
        name: "Mei-Ling Chen",
        role: "Analyst",
        risk: 0.22,
        lat: 39.9,
        lon: 116.4,
      },
    },
    {
      id: "hassan",
      type: "Person",
      props: {
        name: "Farid Hassan",
        role: "Operative",
        risk: 0.73,
        lat: 25.2,
        lon: 55.27,
      },
    },
    {
      id: "reyes",
      type: "Person",
      props: {
        name: "Sofia Reyes",
        role: "Facilitator",
        risk: 0.58,
        lat: 19.43,
        lon: -99.13,
      },
    },
    {
      id: "mueller",
      type: "Person",
      props: {
        name: "Klaus Mueller",
        role: "Broker",
        risk: 0.69,
        lat: 53.55,
        lon: 9.99,
      },
    },
    {
      id: "nkosi",
      type: "Person",
      props: {
        name: "Thabo Nkosi",
        role: "Logistics",
        risk: 0.45,
        lat: -26.2,
        lon: 28.04,
      },
    },
    {
      id: "meridian",
      type: "Organization",
      props: { name: "Meridian Holdings", sector: "Finance", risk: 0.78 },
    },
    {
      id: "atlas",
      type: "Organization",
      props: { name: "Atlas Freight GmbH", sector: "Logistics", risk: 0.52 },
    },
    {
      id: "crescent",
      type: "Organization",
      props: {
        name: "Crescent Trading Co",
        sector: "Import/Export",
        risk: 0.63,
      },
    },
    {
      id: "istanbul",
      type: "Location",
      props: { name: "Istanbul", lat: 41.01, lon: 28.98 },
    },
    {
      id: "dubai",
      type: "Location",
      props: { name: "Dubai", lat: 25.2, lon: 55.27 },
    },
    {
      id: "hamburg",
      type: "Location",
      props: { name: "Hamburg", lat: 53.55, lon: 9.99 },
    },
    {
      id: "lagos",
      type: "Location",
      props: { name: "Lagos", lat: 6.45, lon: 3.41 },
    },
    {
      id: "singapore",
      type: "Location",
      props: { name: "Singapore", lat: 1.35, lon: 103.82 },
    },
    {
      id: "meeting",
      type: "Event",
      props: {
        name: "Istanbul Bazaar Meeting",
        date: "2025-09-14",
        risk: 0.88,
      },
    },
    {
      id: "transfer",
      type: "Event",
      props: { name: "Wire Transfer $2.4M", date: "2025-10-02", risk: 0.94 },
    },
    {
      id: "shipment",
      type: "Event",
      props: { name: "Container MSKU-7729104", date: "2025-10-18", risk: 0.71 },
    },
    {
      id: "intercept",
      type: "Event",
      props: { name: "SIGINT Intercept #4491", date: "2025-11-05", risk: 0.55 },
    },
  ]);

  addEdges(ugm, [
    ["volkov", "tanaka", "directs", 0.95],
    ["volkov", "meridian", "controls", 0.88],
    ["tanaka", "istanbul", "traveledTo", 0.92],
    ["tanaka", "meeting", "attended", 0.97],
    ["osei", "transfer", "authorized", 0.91],
    ["osei", "meridian", "directs", 0.85],
    ["hassan", "meeting", "attended", 0.94],
    ["hassan", "dubai", "basedIn", 0.99],
    ["hassan", "volkov", "reportsTo", 0.87],
    ["atlas", "shipment", "operated", 0.96],
    ["mueller", "atlas", "manages", 0.9],
    ["mueller", "hamburg", "basedIn", 0.99],
    ["crescent", "lagos", "headquarteredIn", 0.95],
    ["nkosi", "crescent", "worksFor", 0.88],
    ["nkosi", "shipment", "coordinated", 0.78],
    ["reyes", "tanaka", "contacted", 0.72],
    ["reyes", "singapore", "traveledTo", 0.65],
    ["chen", "intercept", "flagged", 0.99],
    ["intercept", "volkov", "mentions", 0.82],
    ["transfer", "meridian", "from", 0.98],
    ["transfer", "crescent", "to", 0.98],
  ]);

  return ugm;
}

// ── 2. Supply Chain Risk ────────────────────────────────────────────

export function buildSupplyChainGraph(): UGM {
  const ugm = new UGM();

  addNodes(ugm, [
    {
      id: "apex",
      type: "Manufacturer",
      props: { name: "Apex Semiconductors", risk: 0.15, revenue: 4200 },
    },
    {
      id: "nova",
      type: "Supplier",
      props: { name: "Nova Rare Earth Ltd", risk: 0.72, revenue: 890 },
    },
    {
      id: "titan",
      type: "Manufacturer",
      props: { name: "Titan Fabrication", risk: 0.31, revenue: 2100 },
    },
    {
      id: "zenith",
      type: "Assembler",
      props: { name: "Zenith Assembly Corp", risk: 0.08, revenue: 6700 },
    },
    {
      id: "drift",
      type: "Logistics",
      props: { name: "Drift Logistics SA", risk: 0.45, revenue: 1200 },
    },
    {
      id: "vortex",
      type: "Supplier",
      props: { name: "Vortex Materials", risk: 0.67, revenue: 560 },
    },
    {
      id: "cobalt",
      type: "Supplier",
      props: { name: "Cobalt Extraction Co", risk: 0.81, revenue: 340 },
    },
    {
      id: "shenzhen",
      type: "Port",
      props: { name: "Shenzhen", lat: 22.54, lon: 114.06 },
    },
    {
      id: "rotterdam",
      type: "Port",
      props: { name: "Rotterdam", lat: 51.91, lon: 4.48 },
    },
    {
      id: "la",
      type: "Port",
      props: { name: "Los Angeles", lat: 33.74, lon: -118.27 },
    },
    {
      id: "busan",
      type: "Port",
      props: { name: "Busan", lat: 35.1, lon: 129.04 },
    },
    {
      id: "santos",
      type: "Port",
      props: { name: "Santos", lat: -23.96, lon: -46.33 },
    },
  ]);

  addEdges(ugm, [
    ["nova", "titan", "supplies", 0.9],
    ["vortex", "titan", "supplies", 0.85],
    ["cobalt", "nova", "supplies", 0.7],
    ["titan", "zenith", "supplies", 0.95],
    ["apex", "zenith", "supplies", 0.92],
    ["drift", "shenzhen", "operatesFrom", 0.99],
    ["drift", "rotterdam", "operatesFrom", 0.98],
    ["drift", "la", "operatesFrom", 0.97],
    ["titan", "busan", "shipsFrom", 0.88],
    ["zenith", "la", "receivesAt", 0.93],
    ["nova", "shenzhen", "shipsFrom", 0.86],
    ["cobalt", "santos", "shipsFrom", 0.75],
    ["vortex", "shenzhen", "shipsFrom", 0.82],
  ]);

  return ugm;
}

// ── 3. Biomedical Knowledge Graph ───────────────────────────────────

export function buildBiomedicalGraph(): UGM {
  const ugm = new UGM();

  addNodes(ugm, [
    {
      id: "brca1",
      type: "Gene",
      props: { name: "BRCA1", chromosome: "17q21", score: 0.95 },
    },
    {
      id: "tp53",
      type: "Gene",
      props: { name: "TP53", chromosome: "17p13.1", score: 0.98 },
    },
    {
      id: "egfr",
      type: "Gene",
      props: { name: "EGFR", chromosome: "7p12", score: 0.87 },
    },
    {
      id: "kras",
      type: "Gene",
      props: { name: "KRAS", chromosome: "12p12.1", score: 0.91 },
    },
    {
      id: "p53",
      type: "Protein",
      props: { name: "Tumor protein p53", mass: 43.7, score: 0.96 },
    },
    {
      id: "egfr-p",
      type: "Protein",
      props: {
        name: "Epidermal growth factor receptor",
        mass: 134.3,
        score: 0.88,
      },
    },
    {
      id: "brca1-p",
      type: "Protein",
      props: { name: "BRCA1 DNA repair protein", mass: 207.7, score: 0.93 },
    },
    {
      id: "ras",
      type: "Protein",
      props: { name: "GTPase KRas", mass: 21.6, score: 0.85 },
    },
    {
      id: "breast-ca",
      type: "Disease",
      props: { name: "Breast carcinoma", icd10: "C50", prevalence: 0.124 },
    },
    {
      id: "lung-ca",
      type: "Disease",
      props: {
        name: "Non-small cell lung cancer",
        icd10: "C34",
        prevalence: 0.063,
      },
    },
    {
      id: "ovarian-ca",
      type: "Disease",
      props: { name: "Ovarian carcinoma", icd10: "C56", prevalence: 0.012 },
    },
    {
      id: "crc",
      type: "Disease",
      props: { name: "Colorectal cancer", icd10: "C18", prevalence: 0.045 },
    },
    {
      id: "olaparib",
      type: "Drug",
      props: {
        name: "Olaparib",
        phase: "Approved",
        target: "PARP",
        score: 0.89,
      },
    },
    {
      id: "erlotinib",
      type: "Drug",
      props: {
        name: "Erlotinib",
        phase: "Approved",
        target: "EGFR",
        score: 0.82,
      },
    },
    {
      id: "pembrolizumab",
      type: "Drug",
      props: {
        name: "Pembrolizumab",
        phase: "Approved",
        target: "PD-1",
        score: 0.94,
      },
    },
    {
      id: "sotorasib",
      type: "Drug",
      props: {
        name: "Sotorasib",
        phase: "Phase III",
        target: "KRAS G12C",
        score: 0.77,
      },
    },
    {
      id: "pi3k",
      type: "Pathway",
      props: { name: "PI3K/AKT/mTOR signaling", score: 0.86 },
    },
    {
      id: "ddr",
      type: "Pathway",
      props: { name: "DNA damage response", score: 0.92 },
    },
  ]);

  addEdges(ugm, [
    ["tp53", "p53", "encodes", 0.99],
    ["egfr", "egfr-p", "encodes", 0.99],
    ["brca1", "brca1-p", "encodes", 0.99],
    ["kras", "ras", "encodes", 0.99],
    ["brca1", "breast-ca", "associatedWith", 0.92],
    ["brca1", "ovarian-ca", "associatedWith", 0.88],
    ["tp53", "breast-ca", "associatedWith", 0.85],
    ["tp53", "lung-ca", "associatedWith", 0.8],
    ["egfr", "lung-ca", "driverMutation", 0.91],
    ["kras", "lung-ca", "driverMutation", 0.87],
    ["kras", "crc", "driverMutation", 0.84],
    ["olaparib", "brca1-p", "inhibits", 0.93],
    ["erlotinib", "egfr-p", "inhibits", 0.89],
    ["sotorasib", "ras", "inhibits", 0.78],
    ["pembrolizumab", "lung-ca", "treats", 0.86],
    ["olaparib", "breast-ca", "treats", 0.81],
    ["brca1-p", "ddr", "participatesIn", 0.95],
    ["p53", "ddr", "participatesIn", 0.93],
    ["egfr-p", "pi3k", "activates", 0.88],
    ["ras", "pi3k", "activates", 0.85],
  ]);

  return ugm;
}

// ── 4. Cyber Threat Landscape ───────────────────────────────────────

export function buildCyberGraph(): UGM {
  const ugm = new UGM();

  addNodes(ugm, [
    {
      id: "apt28",
      type: "ThreatActor",
      props: { name: "APT28 (Fancy Bear)", origin: "Russia", risk: 0.95 },
    },
    {
      id: "apt41",
      type: "ThreatActor",
      props: { name: "APT41 (Wicked Panda)", origin: "China", risk: 0.88 },
    },
    {
      id: "lazarus",
      type: "ThreatActor",
      props: { name: "Lazarus Group", origin: "DPRK", risk: 0.92 },
    },
    {
      id: "solarstorm",
      type: "Campaign",
      props: { name: "Operation SolarStorm", startDate: "2025-03", risk: 0.89 },
    },
    {
      id: "nightowl",
      type: "Campaign",
      props: { name: "Operation NightOwl", startDate: "2025-07", risk: 0.76 },
    },
    {
      id: "cobalt-strike",
      type: "Malware",
      props: { name: "Cobalt Strike", family: "RAT", risk: 0.85 },
    },
    {
      id: "mimikatz",
      type: "Malware",
      props: { name: "Mimikatz", family: "Credential Theft", risk: 0.79 },
    },
    {
      id: "sunburst",
      type: "Malware",
      props: { name: "SUNBURST", family: "Backdoor", risk: 0.94 },
    },
    {
      id: "ip-185",
      type: "Infrastructure",
      props: { name: "185.141.62.0/24", asn: "AS48031", risk: 0.82 },
    },
    {
      id: "ip-103",
      type: "Infrastructure",
      props: { name: "103.216.220.0/24", asn: "AS135377", risk: 0.71 },
    },
    {
      id: "c2-alpha",
      type: "Infrastructure",
      props: {
        name: "update-service.cloud",
        registrar: "Namecheap",
        risk: 0.9,
      },
    },
    {
      id: "c2-bravo",
      type: "Infrastructure",
      props: { name: "cdn-static.tech", registrar: "GoDaddy", risk: 0.86 },
    },
    {
      id: "vuln-log4j",
      type: "Vulnerability",
      props: { name: "CVE-2021-44228 (Log4Shell)", cvss: 10.0, risk: 0.99 },
    },
    {
      id: "vuln-exchange",
      type: "Vulnerability",
      props: { name: "CVE-2023-23397", cvss: 9.8, risk: 0.93 },
    },
    {
      id: "energy-sector",
      type: "Target",
      props: { name: "Energy Sector", criticality: "High", risk: 0.88 },
    },
    {
      id: "finance-sector",
      type: "Target",
      props: { name: "Financial Services", criticality: "High", risk: 0.85 },
    },
    {
      id: "defense-sector",
      type: "Target",
      props: {
        name: "Defense Industrial Base",
        criticality: "Critical",
        risk: 0.96,
      },
    },
    {
      id: "gov-sector",
      type: "Target",
      props: { name: "Government", criticality: "Critical", risk: 0.91 },
    },
  ]);

  addEdges(ugm, [
    ["apt28", "solarstorm", "conducts", 0.92],
    ["apt41", "nightowl", "conducts", 0.85],
    ["lazarus", "nightowl", "supports", 0.68],
    ["solarstorm", "sunburst", "deploys", 0.96],
    ["solarstorm", "cobalt-strike", "deploys", 0.88],
    ["nightowl", "mimikatz", "deploys", 0.82],
    ["nightowl", "cobalt-strike", "deploys", 0.79],
    ["apt28", "ip-185", "operates", 0.9],
    ["apt41", "ip-103", "operates", 0.84],
    ["sunburst", "c2-alpha", "callsHome", 0.95],
    ["cobalt-strike", "c2-bravo", "callsHome", 0.87],
    ["solarstorm", "vuln-log4j", "exploits", 0.91],
    ["nightowl", "vuln-exchange", "exploits", 0.86],
    ["solarstorm", "energy-sector", "targets", 0.93],
    ["solarstorm", "gov-sector", "targets", 0.89],
    ["nightowl", "finance-sector", "targets", 0.82],
    ["nightowl", "defense-sector", "targets", 0.88],
    ["lazarus", "finance-sector", "targets", 0.91],
  ]);

  return ugm;
}

/**
 * Upgrade functions for DE.7 (Cyber dates) and DE.8 (Supply props).
 */

export function upgradeCyberWithDates(ugm: UGM): void {
  const dates: Record<string, string> = {
    apt28: "2024-03-15",
    apt41: "2024-06-22",
    lazarus: "2024-01-10",
  };
  ugm.forEachNode((id, attrs) => {
    if (attrs.types.includes("ThreatActor") && dates[id]) {
      ugm.updateNodeProperties(id, { firstSeen: dates[id] });
    }
    if (attrs.types.includes("Campaign")) {
      ugm.updateNodeProperties(id, {
        startDate:
          "2024-" +
          String(Math.floor(Math.random() * 12) + 1).padStart(2, "0") +
          "-01",
        endDate:
          "2025-" +
          String(Math.floor(Math.random() * 6) + 1).padStart(2, "0") +
          "-28",
      });
    }
  });
}

export function upgradeSupplyWithProps(ugm: UGM): void {
  ugm.forEachNode((id, attrs) => {
    if (
      attrs.types.includes("Company") ||
      attrs.types.includes("Manufacturer") ||
      attrs.types.includes("Supplier")
    ) {
      ugm.updateNodeProperties(id, {
        revenue: Math.floor(Math.random() * 50 + 5) * 100, // millions
        employees: Math.floor(Math.random() * 10000 + 500),
      });
    }
  });
}
