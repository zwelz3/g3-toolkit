/**
 * Healthcare Ontology fixture: ICD-10 subset with drugs, genes,
 * patients, pathways, and SHACL shapes.
 */

import { UGM } from "@core/ugm";
import type { ShaclShape } from "@core/shacl";

export function buildHealthcareUGM(): UGM {
  const ugm = new UGM();

  // Diseases (ICD-10 codes)
  const diseases = [
    {
      id: "dis:hypertension",
      name: "Hypertension",
      icd10: "I10",
      category: "Cardiovascular",
      severity: "high",
    },
    {
      id: "dis:diabetes-t2",
      name: "Type 2 Diabetes",
      icd10: "E11",
      category: "Endocrine",
      severity: "high",
    },
    {
      id: "dis:breast-cancer",
      name: "Breast Cancer",
      icd10: "C50",
      category: "Neoplasm",
      severity: "critical",
    },
    {
      id: "dis:copd",
      name: "COPD",
      icd10: "J44",
      category: "Respiratory",
      severity: "high",
    },
    {
      id: "dis:asthma",
      name: "Asthma",
      icd10: "J45",
      category: "Respiratory",
      severity: "moderate",
    },
    {
      id: "dis:heart-failure",
      name: "Heart Failure",
      icd10: "I50",
      category: "Cardiovascular",
      severity: "critical",
    },
    {
      id: "dis:stroke",
      name: "Stroke",
      icd10: "I63",
      category: "Cardiovascular",
      severity: "critical",
    },
    {
      id: "dis:pneumonia",
      name: "Pneumonia",
      icd10: "J18",
      category: "Respiratory",
      severity: "high",
    },
    {
      id: "dis:depression",
      name: "Major Depression",
      icd10: "F32",
      category: "Mental",
      severity: "moderate",
    },
    {
      id: "dis:arthritis",
      name: "Rheumatoid Arthritis",
      icd10: "M06",
      category: "Musculoskeletal",
      severity: "moderate",
    },
  ];

  for (const d of diseases) {
    ugm.addNode(d.id, {
      types: ["Disease"],
      properties: {
        name: d.name,
        icd10: d.icd10,
        category: d.category,
        severity: d.severity,
      },
    });
  }

  // Drugs
  const drugs = [
    {
      id: "drug:metformin",
      name: "Metformin",
      phase: 4,
      mechanism: "Biguanide",
    },
    {
      id: "drug:lisinopril",
      name: "Lisinopril",
      phase: 4,
      mechanism: "ACE Inhibitor",
    },
    {
      id: "drug:olaparib",
      name: "Olaparib",
      phase: 3,
      mechanism: "PARP Inhibitor",
    },
    {
      id: "drug:albuterol",
      name: "Albuterol",
      phase: 4,
      mechanism: "Beta-2 Agonist",
    },
    { id: "drug:sertraline", name: "Sertraline", phase: 4, mechanism: "SSRI" },
    {
      id: "drug:aspirin",
      name: "Aspirin",
      phase: 4,
      mechanism: "COX Inhibitor",
    },
  ];

  for (const d of drugs) {
    ugm.addNode(d.id, {
      types: ["Drug"],
      properties: { name: d.name, phase: d.phase, mechanism: d.mechanism },
    });
  }

  // Genes
  const genes = [
    {
      id: "gene:brca1",
      name: "BRCA1",
      chromosome: "17",
      function: "DNA repair",
    },
    {
      id: "gene:tp53",
      name: "TP53",
      chromosome: "17",
      function: "Tumor suppressor",
    },
    {
      id: "gene:ace",
      name: "ACE",
      chromosome: "17",
      function: "Blood pressure regulation",
    },
    {
      id: "gene:adrb2",
      name: "ADRB2",
      chromosome: "5",
      function: "Bronchodilation",
    },
    {
      id: "gene:slc6a4",
      name: "SLC6A4",
      chromosome: "17",
      function: "Serotonin transport",
    },
  ];

  for (const g of genes) {
    ugm.addNode(g.id, {
      types: ["Gene"],
      properties: {
        name: g.name,
        chromosome: g.chromosome,
        function: g.function,
      },
    });
  }

  // Patients
  for (let i = 1; i <= 5; i++) {
    ugm.addNode(`pt:${i}`, {
      types: ["Patient"],
      properties: {
        name: `PT-${String(i).padStart(3, "0")}`,
        age: 40 + i * 8,
        sex: i % 2 === 0 ? "F" : "M",
      },
    });
  }

  // Pathways
  const pathways = [
    { id: "pw:ras-mapk", name: "RAS/MAPK Pathway" },
    { id: "pw:pi3k-akt", name: "PI3K/AKT Pathway" },
    { id: "pw:serotonin", name: "Serotonin Pathway" },
    { id: "pw:raas", name: "Renin-Angiotensin System" },
  ];

  for (const p of pathways) {
    ugm.addNode(p.id, { types: ["Pathway"], properties: { name: p.name } });
  }

  // Hospitals
  const hospitals = [
    {
      id: "hosp:metro",
      name: "Metro General Hospital",
      beds: 450,
      lat: 40.7128,
      lon: -74.006,
    },
    {
      id: "hosp:univ",
      name: "University Medical Center",
      beds: 800,
      lat: 40.729,
      lon: -73.994,
    },
    {
      id: "hosp:community",
      name: "Community Health Center",
      beds: 120,
      lat: 40.748,
      lon: -73.986,
    },
  ];

  for (const h of hospitals) {
    ugm.addNode(h.id, {
      types: ["Hospital"],
      properties: {
        name: h.name,
        beds: h.beds,
        latitude: h.lat,
        longitude: h.lon,
      },
    });
  }

  // Clinical Trials
  for (let i = 1; i <= 3; i++) {
    ugm.addNode(`trial:${i}`, {
      types: ["ClinicalTrial"],
      properties: {
        name: `NCT-2025-${String(i).padStart(3, "0")}`,
        status: i === 1 ? "Recruiting" : "Active",
        startDate: `2025-0${i}-15`,
      },
    });
  }

  // ── Relationships ─────────────────────────────────────────────────

  // Drug → treats → Disease
  ugm.addEdge("drug:metformin", "dis:diabetes-t2", { type: "treats" });
  ugm.addEdge("drug:lisinopril", "dis:hypertension", { type: "treats" });
  ugm.addEdge("drug:lisinopril", "dis:heart-failure", { type: "treats" });
  ugm.addEdge("drug:olaparib", "dis:breast-cancer", { type: "treats" });
  ugm.addEdge("drug:albuterol", "dis:asthma", { type: "treats" });
  ugm.addEdge("drug:albuterol", "dis:copd", { type: "treats" });
  ugm.addEdge("drug:sertraline", "dis:depression", { type: "treats" });
  ugm.addEdge("drug:aspirin", "dis:stroke", { type: "prevents" });
  ugm.addEdge("drug:aspirin", "dis:arthritis", { type: "treats" });

  // Gene → associatedWith → Disease
  ugm.addEdge("gene:brca1", "dis:breast-cancer", { type: "associatedWith" });
  ugm.addEdge("gene:tp53", "dis:breast-cancer", { type: "associatedWith" });
  ugm.addEdge("gene:ace", "dis:hypertension", { type: "associatedWith" });
  ugm.addEdge("gene:adrb2", "dis:asthma", { type: "associatedWith" });
  ugm.addEdge("gene:slc6a4", "dis:depression", { type: "associatedWith" });

  // Gene → partOf → Pathway
  ugm.addEdge("gene:brca1", "pw:ras-mapk", { type: "partOf" });
  ugm.addEdge("gene:tp53", "pw:pi3k-akt", { type: "partOf" });
  ugm.addEdge("gene:ace", "pw:raas", { type: "partOf" });
  ugm.addEdge("gene:slc6a4", "pw:serotonin", { type: "partOf" });

  // Patient → diagnosed → Disease
  ugm.addEdge("pt:1", "dis:hypertension", { type: "diagnosedWith" });
  ugm.addEdge("pt:1", "dis:diabetes-t2", { type: "diagnosedWith" });
  ugm.addEdge("pt:2", "dis:breast-cancer", { type: "diagnosedWith" });
  ugm.addEdge("pt:3", "dis:copd", { type: "diagnosedWith" });
  ugm.addEdge("pt:3", "dis:depression", { type: "diagnosedWith" });
  ugm.addEdge("pt:4", "dis:asthma", { type: "diagnosedWith" });
  ugm.addEdge("pt:5", "dis:heart-failure", { type: "diagnosedWith" });
  ugm.addEdge("pt:5", "dis:stroke", { type: "diagnosedWith" });

  // Patient → treatedAt → Hospital
  ugm.addEdge("pt:1", "hosp:metro", { type: "treatedAt" });
  ugm.addEdge("pt:2", "hosp:univ", { type: "treatedAt" });
  ugm.addEdge("pt:3", "hosp:metro", { type: "treatedAt" });
  ugm.addEdge("pt:4", "hosp:community", { type: "treatedAt" });
  ugm.addEdge("pt:5", "hosp:univ", { type: "treatedAt" });

  // Drug → testedIn → ClinicalTrial
  ugm.addEdge("drug:olaparib", "trial:1", { type: "testedIn" });
  ugm.addEdge("drug:metformin", "trial:2", { type: "testedIn" });
  ugm.addEdge("drug:sertraline", "trial:3", { type: "testedIn" });

  // Disease taxonomy edges
  ugm.addEdge("dis:hypertension", "dis:heart-failure", {
    type: "riskFactorFor",
  });
  ugm.addEdge("dis:diabetes-t2", "dis:stroke", { type: "riskFactorFor" });
  ugm.addEdge("dis:copd", "dis:pneumonia", { type: "complicatedBy" });

  return ugm;
}

export const HEALTHCARE_SHACL_SHAPES: ShaclShape[] = [
  {
    id: "shape:disease",
    name: "Disease Shape",
    targetClass: "Disease",
    description: "Every disease must have a name, ICD-10 code, and category.",
    properties: [
      { path: "name", name: "Name", datatype: "string", minCount: 1 },
      {
        path: "icd10",
        name: "ICD-10 Code",
        datatype: "string",
        minCount: 1,
        pattern: "^[A-Z]\\d",
      },
      { path: "category", name: "Category", datatype: "string", minCount: 1 },
      {
        path: "severity",
        name: "Severity",
        in: ["low", "moderate", "high", "critical"],
      },
    ],
  },
  {
    id: "shape:drug",
    name: "Drug Shape",
    targetClass: "Drug",
    description: "Every drug must have a name and trial phase.",
    properties: [
      { path: "name", name: "Name", datatype: "string", minCount: 1 },
      {
        path: "phase",
        name: "Trial Phase",
        datatype: "number",
        minCount: 1,
        minInclusive: 1,
        maxInclusive: 4,
      },
      { path: "mechanism", name: "Mechanism", datatype: "string" },
    ],
  },
  {
    id: "shape:patient",
    name: "Patient Shape",
    targetClass: "Patient",
    description: "Patient records require name, age, and sex.",
    properties: [
      { path: "name", name: "Patient ID", datatype: "string", minCount: 1 },
      {
        path: "age",
        name: "Age",
        datatype: "number",
        minCount: 1,
        minInclusive: 0,
        maxInclusive: 150,
      },
      { path: "sex", name: "Sex", in: ["M", "F", "Other"] },
    ],
  },
  {
    id: "shape:gene",
    name: "Gene Shape",
    targetClass: "Gene",
    description: "Genes must have name and chromosome.",
    properties: [
      { path: "name", name: "Gene Symbol", datatype: "string", minCount: 1 },
      {
        path: "chromosome",
        name: "Chromosome",
        datatype: "string",
        minCount: 1,
      },
      { path: "function", name: "Function" },
    ],
  },
];
