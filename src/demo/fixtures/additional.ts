/**
 * MBSE Satellite System fixture (DE.6).
 */

import { UGM } from "@g3t/core";

export function buildMBSEUGM(): UGM {
  const ugm = new UGM();

  // Packages
  const pkgs = [
    { id: "pkg:system", name: "Satellite System", parent: null },
    { id: "pkg:rf", name: "RF Subsystem", parent: "pkg:system" },
    { id: "pkg:power", name: "Power Subsystem", parent: "pkg:system" },
    { id: "pkg:processor", name: "Processing Subsystem", parent: "pkg:system" },
    { id: "pkg:ground", name: "Ground Segment", parent: "pkg:system" },
  ];
  for (const p of pkgs) {
    ugm.addNode(p.id, { types: ["Package"], properties: { name: p.name } });
    if (p.parent) ugm.addEdge(p.parent, p.id, { type: "contains" });
  }

  // Blocks
  const blocks = [
    {
      id: "blk:antenna",
      name: "Antenna Assembly",
      pkg: "pkg:rf",
      mass: 8.2,
      power: 15,
      dataRate: 100,
    },
    {
      id: "blk:transceiver",
      name: "Transceiver",
      pkg: "pkg:rf",
      mass: 3.1,
      power: 45,
      dataRate: 200,
    },
    {
      id: "blk:lna",
      name: "Low Noise Amplifier",
      pkg: "pkg:rf",
      mass: 0.5,
      power: 4,
      dataRate: 200,
    },
    {
      id: "blk:solar",
      name: "Solar Panel Array",
      pkg: "pkg:power",
      mass: 12.0,
      power: -280,
      dataRate: 0,
    },
    {
      id: "blk:battery",
      name: "Battery Pack",
      pkg: "pkg:power",
      mass: 18.5,
      power: -120,
      dataRate: 0,
    },
    {
      id: "blk:pdu",
      name: "Power Distribution Unit",
      pkg: "pkg:power",
      mass: 2.3,
      power: 8,
      dataRate: 0,
    },
    {
      id: "blk:cpu",
      name: "Flight Computer",
      pkg: "pkg:processor",
      mass: 1.8,
      power: 25,
      dataRate: 500,
    },
    {
      id: "blk:fpga",
      name: "Signal Processor (FPGA)",
      pkg: "pkg:processor",
      mass: 0.9,
      power: 18,
      dataRate: 400,
    },
    {
      id: "blk:memory",
      name: "Mass Memory",
      pkg: "pkg:processor",
      mass: 0.4,
      power: 6,
      dataRate: 1000,
    },
    {
      id: "blk:ground-station",
      name: "Ground Station",
      pkg: "pkg:ground",
      mass: 0,
      power: 0,
      dataRate: 150,
    },
    {
      id: "blk:modem",
      name: "Baseband Modem",
      pkg: "pkg:rf",
      mass: 1.2,
      power: 12,
      dataRate: 200,
    },
    {
      id: "blk:encoder",
      name: "Data Encoder",
      pkg: "pkg:processor",
      mass: 0.3,
      power: 5,
      dataRate: 300,
    },
  ];
  for (const b of blocks) {
    ugm.addNode(b.id, {
      types: ["Block"],
      properties: {
        name: b.name,
        mass: b.mass,
        power: b.power,
        dataRate: b.dataRate,
      },
    });
    ugm.addEdge(b.pkg, b.id, { type: "contains" });
  }

  // Requirements
  const reqs = [
    { id: "req:001", name: "Data Rate > 100 Mbps", category: "Performance" },
    { id: "req:002", name: "Power Budget < 200W", category: "Resource" },
    { id: "req:003", name: "Mass < 50 kg", category: "Resource" },
    { id: "req:004", name: "Frequency 8-12 GHz", category: "Interface" },
    { id: "req:005", name: "Orbit LEO 550km", category: "Environment" },
    { id: "req:006", name: "Lifetime > 5 years", category: "Reliability" },
    { id: "req:007", name: "Redundant Power Path", category: "Reliability" },
    {
      id: "req:008",
      name: "Ground Link Availability > 99%",
      category: "Performance",
    },
  ];
  for (const r of reqs) {
    ugm.addNode(r.id, {
      types: ["Requirement"],
      properties: { name: r.name, category: r.category },
    });
  }

  // Interfaces
  const ifaces = [
    {
      id: "if:rf",
      name: "RF Signal Interface",
      from: "blk:antenna",
      to: "blk:transceiver",
    },
    { id: "if:power", name: "Power Bus", from: "blk:pdu", to: "blk:cpu" },
    { id: "if:data", name: "Data Bus", from: "blk:cpu", to: "blk:memory" },
    {
      id: "if:cmd",
      name: "Command Link",
      from: "blk:ground-station",
      to: "blk:cpu",
    },
    {
      id: "if:tlm",
      name: "Telemetry Link",
      from: "blk:cpu",
      to: "blk:ground-station",
    },
    {
      id: "if:ground",
      name: "Ground-Space Link",
      from: "blk:ground-station",
      to: "blk:modem",
    },
  ];
  for (const i of ifaces) {
    ugm.addNode(i.id, { types: ["Interface"], properties: { name: i.name } });
    ugm.addEdge(i.from, i.id, { type: "provides" });
    ugm.addEdge(i.id, i.to, { type: "consumedBy" });
  }

  // Requirement traces
  ugm.addEdge("req:001", "blk:transceiver", { type: "satisfiedBy" });
  ugm.addEdge("req:001", "blk:modem", { type: "satisfiedBy" });
  ugm.addEdge("req:002", "blk:pdu", { type: "satisfiedBy" });
  ugm.addEdge("req:003", "blk:antenna", { type: "constrains" });
  ugm.addEdge("req:004", "blk:antenna", { type: "constrains" });
  ugm.addEdge("req:007", "blk:battery", { type: "satisfiedBy" });
  ugm.addEdge("req:008", "blk:ground-station", { type: "satisfiedBy" });

  // Block dependencies
  ugm.addEdge("blk:transceiver", "blk:lna", { type: "dependsOn" });
  ugm.addEdge("blk:fpga", "blk:cpu", { type: "dependsOn" });
  ugm.addEdge("blk:encoder", "blk:fpga", { type: "dependsOn" });
  ugm.addEdge("blk:modem", "blk:transceiver", { type: "dependsOn" });

  return ugm;
}

/**
 * Data Scientist Exploration fixture (DE.9).
 */
export function buildDataSciUGM(): UGM {
  const ugm = new UGM();
  const depts = ["Engineering", "Marketing", "Sales", "Research", "Operations"];
  const teams = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"];

  for (let i = 1; i <= 50; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const dept = depts[(i - 1) % 5]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const team = teams[Math.floor((i - 1) / 10)]!;
    const community = Math.floor((i - 1) / 17) + 1; // 3 communities
    const pagerank = Math.max(0.01, 0.15 - i * 0.003 + Math.random() * 0.02);
    const betweenness = Math.max(0, 0.4 - i * 0.008 + Math.random() * 0.03);
    const degree = Math.max(1, Math.floor(8 - i * 0.12 + Math.random() * 3));
    ugm.addNode(`p${i}`, {
      types: ["Person"],
      properties: {
        name: `Person ${i}`,
        department: dept,
        team,
        community,
        pagerank: Math.round(pagerank * 1000) / 1000,
        betweenness: Math.round(betweenness * 1000) / 1000,
        degree,
        joinDate: `${2018 + Math.floor(i / 8)}-${String(((i * 3) % 12) + 1).padStart(2, "0")}-15`,
      },
    });
  }

  // Generate edges (reports_to, collaborates, mentors)
  for (let i = 2; i <= 50; i++) {
    const managerId = Math.max(1, Math.floor(i / 3));
    ugm.addEdge(`p${managerId}`, `p${i}`, { type: "reportsTo" });
  }
  for (let i = 1; i <= 30; i++) {
    const a = Math.floor(Math.random() * 50) + 1;
    let b = Math.floor(Math.random() * 50) + 1;
    if (b === a) b = (a % 50) + 1;
    if (!ugm.hasNode(`p${a}`) || !ugm.hasNode(`p${b}`)) continue;
    ugm.addEdge(`p${a}`, `p${b}`, { type: "collaboratesWith" });
  }
  for (let i = 1; i <= 10; i++) {
    const mentor = i;
    const mentee = i + 20;
    if (ugm.hasNode(`p${mentor}`) && ugm.hasNode(`p${mentee}`)) {
      ugm.addEdge(`p${mentor}`, `p${mentee}`, { type: "mentors" });
    }
  }

  return ugm;
}

/**
 * Auditor Provenance Certification fixture (DE.10).
 */
export function buildAuditorUGM(): UGM {
  const ugm = new UGM();

  // Entities (data products)
  const entities = [
    {
      id: "ent:raw-data",
      name: "Raw Dataset v1",
      "prov:generatedAtTime": "2025-01-15T09:00:00Z",
    },
    {
      id: "ent:clean-data",
      name: "Cleaned Dataset v1",
      "prov:generatedAtTime": "2025-02-01T14:00:00Z",
    },
    {
      id: "ent:features",
      name: "Feature Set v1",
      "prov:generatedAtTime": "2025-02-15T10:00:00Z",
    },
    {
      id: "ent:model-v1",
      name: "ML Model v1",
      "prov:generatedAtTime": "2025-03-01T16:00:00Z",
    },
    {
      id: "ent:model-v2",
      name: "ML Model v2",
      "prov:generatedAtTime": "2025-04-10T11:00:00Z",
    },
    {
      id: "ent:report",
      name: "Validation Report Q1",
      "prov:generatedAtTime": "2025-03-15T09:00:00Z",
    },
    {
      id: "ent:cert",
      name: "Certification Package",
      "prov:generatedAtTime": "2025-04-01T15:00:00Z",
    },
    {
      id: "ent:pub",
      name: "Published Results",
      "prov:generatedAtTime": "2025-05-01T10:00:00Z",
    },
  ];
  for (const e of entities) {
    ugm.addNode(e.id, {
      types: ["Entity"],
      properties: {
        name: e.name,
        "prov:generatedAtTime": e["prov:generatedAtTime"],
      },
    });
  }

  // Activities
  const activities = [
    {
      id: "act:collect",
      name: "Data Collection",
      "prov:startedAtTime": "2025-01-10T08:00:00Z",
      "prov:endedAtTime": "2025-01-15T17:00:00Z",
    },
    {
      id: "act:clean",
      name: "Data Cleaning",
      "prov:startedAtTime": "2025-01-20T09:00:00Z",
      "prov:endedAtTime": "2025-02-01T17:00:00Z",
    },
    {
      id: "act:train",
      name: "Model Training",
      "prov:startedAtTime": "2025-02-20T09:00:00Z",
      "prov:endedAtTime": "2025-03-01T18:00:00Z",
    },
    {
      id: "act:validate",
      name: "Model Validation",
      "prov:startedAtTime": "2025-03-05T09:00:00Z",
      "prov:endedAtTime": "2025-03-15T17:00:00Z",
    },
    {
      id: "act:certify",
      name: "Certification Review",
      "prov:startedAtTime": "2025-03-20T09:00:00Z",
      "prov:endedAtTime": "2025-04-01T17:00:00Z",
    },
    {
      id: "act:publish",
      name: "Publication",
      "prov:startedAtTime": "2025-04-15T09:00:00Z",
      "prov:endedAtTime": "2025-05-01T17:00:00Z",
    },
  ];
  for (const a of activities) {
    ugm.addNode(a.id, {
      types: ["Activity"],
      properties: {
        name: a.name,
        "prov:startedAtTime": a["prov:startedAtTime"],
        "prov:endedAtTime": a["prov:endedAtTime"],
      },
    });
  }

  // Agents
  const agents = [
    { id: "agent:data-eng", name: "Data Engineer", role: "DataEngineer" },
    { id: "agent:ml-eng", name: "ML Engineer", role: "MLEngineer" },
    { id: "agent:auditor", name: "Compliance Auditor", role: "Auditor" },
    { id: "agent:regulator", name: "Regulatory Body", role: "Regulator" },
  ];
  for (const a of agents) {
    ugm.addNode(a.id, {
      types: ["Agent"],
      properties: { name: a.name, role: a.role },
    });
  }

  // Plans
  const plans = [
    { id: "plan:governance", name: "Data Governance Policy" },
    { id: "plan:mlops", name: "MLOps Pipeline Spec" },
    { id: "plan:cert-process", name: "Certification Process" },
    { id: "plan:audit", name: "Audit Procedure" },
  ];
  for (const p of plans) {
    ugm.addNode(p.id, { types: ["Plan"], properties: { name: p.name } });
  }

  // PROV-O relationships
  ugm.addEdge("ent:raw-data", "act:collect", { type: "prov:wasGeneratedBy" });
  ugm.addEdge("ent:clean-data", "act:clean", { type: "prov:wasGeneratedBy" });
  ugm.addEdge("ent:features", "act:clean", { type: "prov:wasGeneratedBy" });
  ugm.addEdge("ent:model-v1", "act:train", { type: "prov:wasGeneratedBy" });
  ugm.addEdge("ent:model-v2", "act:train", { type: "prov:wasGeneratedBy" });
  ugm.addEdge("ent:report", "act:validate", { type: "prov:wasGeneratedBy" });
  ugm.addEdge("ent:cert", "act:certify", { type: "prov:wasGeneratedBy" });
  ugm.addEdge("ent:pub", "act:publish", { type: "prov:wasGeneratedBy" });

  // used
  ugm.addEdge("act:clean", "ent:raw-data", { type: "prov:used" });
  ugm.addEdge("act:train", "ent:clean-data", { type: "prov:used" });
  ugm.addEdge("act:train", "ent:features", { type: "prov:used" });
  ugm.addEdge("act:validate", "ent:model-v1", { type: "prov:used" });
  ugm.addEdge("act:certify", "ent:report", { type: "prov:used" });
  ugm.addEdge("act:certify", "ent:model-v2", { type: "prov:used" });
  ugm.addEdge("act:publish", "ent:cert", { type: "prov:used" });

  // wasDerivedFrom
  ugm.addEdge("ent:clean-data", "ent:raw-data", {
    type: "prov:wasDerivedFrom",
  });
  ugm.addEdge("ent:model-v1", "ent:clean-data", {
    type: "prov:wasDerivedFrom",
  });
  ugm.addEdge("ent:model-v2", "ent:model-v1", { type: "prov:wasDerivedFrom" });
  ugm.addEdge("ent:report", "ent:model-v1", { type: "prov:wasDerivedFrom" });

  // wasAssociatedWith
  ugm.addEdge("act:collect", "agent:data-eng", {
    type: "prov:wasAssociatedWith",
  });
  ugm.addEdge("act:clean", "agent:data-eng", {
    type: "prov:wasAssociatedWith",
  });
  ugm.addEdge("act:train", "agent:ml-eng", { type: "prov:wasAssociatedWith" });
  ugm.addEdge("act:validate", "agent:ml-eng", {
    type: "prov:wasAssociatedWith",
  });
  ugm.addEdge("act:certify", "agent:auditor", {
    type: "prov:wasAssociatedWith",
  });
  ugm.addEdge("act:publish", "agent:regulator", {
    type: "prov:wasAssociatedWith",
  });

  // hadPlan
  ugm.addEdge("act:collect", "plan:governance", { type: "hadPlan" });
  ugm.addEdge("act:train", "plan:mlops", { type: "hadPlan" });
  ugm.addEdge("act:certify", "plan:cert-process", { type: "hadPlan" });
  ugm.addEdge("act:certify", "plan:audit", { type: "hadPlan" });

  // wasAttributedTo (intentionally missing for ent:pub to create SHACL violation)
  ugm.addEdge("ent:raw-data", "agent:data-eng", {
    type: "prov:wasAttributedTo",
  });
  ugm.addEdge("ent:clean-data", "agent:data-eng", {
    type: "prov:wasAttributedTo",
  });
  ugm.addEdge("ent:model-v1", "agent:ml-eng", { type: "prov:wasAttributedTo" });
  ugm.addEdge("ent:model-v2", "agent:ml-eng", { type: "prov:wasAttributedTo" });
  ugm.addEdge("ent:report", "agent:ml-eng", { type: "prov:wasAttributedTo" });
  ugm.addEdge("ent:cert", "agent:auditor", { type: "prov:wasAttributedTo" });
  // ent:pub intentionally has NO wasAttributedTo (SHACL violation for demo)

  return ugm;
}
