/**
 * The biomedical example, reworked as actual RDF (item 2). The source of
 * truth is a set of triples over a small gene / protein / disease / drug /
 * pathway ontology; the graph view renders a UGM projected from those
 * triples, and the SPARQL panel queries the triples directly. Numeric
 * literals (molecular weight, approval year, prevalence) exist so the linked
 * analytics panels have something to scatter and bar.
 */
import { UGM } from "@g3t/core";
import type { RDFTriple, RDFGraph } from "@g3t/core";

export const EX = "http://example.org/bio#";
export const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
export const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
export const RDFS_SUBCLASS = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
export const XSD_INT = "http://www.w3.org/2001/XMLSchema#integer";
export const XSD_DEC = "http://www.w3.org/2001/XMLSchema#decimal";

export const PREFIXES: Record<string, string> = {
  ex: EX,
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

/** Collapse a full IRI to a prefixed name for display (ex:BRCA1). */
export function shorten(iri: string): string {
  for (const [prefix, ns] of Object.entries(PREFIXES)) {
    if (iri.startsWith(ns)) return `${prefix}:${iri.slice(ns.length)}`;
  }
  return iri;
}

/** Local name after the last # or /. */
export function localName(iri: string): string {
  const hash = iri.lastIndexOf("#");
  const slash = iri.lastIndexOf("/");
  const cut = Math.max(hash, slash);
  return cut >= 0 ? iri.slice(cut + 1) : iri;
}

function uri(s: string, p: string, o: string): RDFTriple {
  return {
    subject: EX + s,
    predicate: p.startsWith("http") ? p : EX + p,
    object: EX + o,
    objectType: "uri",
  };
}
function lit(s: string, p: string, o: string, datatype?: string): RDFTriple {
  return {
    subject: EX + s,
    predicate: EX + p,
    object: o,
    objectType: "literal",
    datatype,
  };
}
function label(s: string, text: string): RDFTriple {
  return {
    subject: EX + s,
    predicate: RDFS_LABEL,
    object: text,
    objectType: "literal",
  };
}
function isa(s: string, cls: string): RDFTriple {
  return {
    subject: EX + s,
    predicate: RDF_TYPE,
    object: EX + cls,
    objectType: "uri",
  };
}

// ── Ontology (TBox): the class hierarchy the explorer shows ────────────────
const ontology: RDFTriple[] = [
  {
    subject: EX + "BiologicalEntity",
    predicate: RDF_TYPE,
    object: "http://www.w3.org/2000/01/rdf-schema#Class",
    objectType: "uri",
  },
  ...["Gene", "Protein", "Disease", "Drug", "Pathway"].flatMap((c) => [
    {
      subject: EX + c,
      predicate: RDF_TYPE,
      object: "http://www.w3.org/2000/01/rdf-schema#Class",
      objectType: "uri",
    } as RDFTriple,
    {
      subject: EX + c,
      predicate: RDFS_SUBCLASS,
      object: EX + "BiologicalEntity",
      objectType: "uri",
    } as RDFTriple,
  ]),
];

// ── Instances (ABox) ───────────────────────────────────────────────────────
const instances: RDFTriple[] = [
  // Genes
  isa("BRCA1", "Gene"),
  label("BRCA1", "BRCA1"),
  lit("BRCA1", "chromosome", "17"),
  isa("TP53", "Gene"),
  label("TP53", "TP53"),
  lit("TP53", "chromosome", "17"),
  isa("EGFR", "Gene"),
  label("EGFR", "EGFR"),
  lit("EGFR", "chromosome", "7"),
  isa("APOE", "Gene"),
  label("APOE", "APOE"),
  lit("APOE", "chromosome", "19"),
  // Proteins (encoded by genes)
  isa("p53", "Protein"),
  label("p53", "Cellular tumor antigen p53"),
  lit("p53", "molecularWeight", "43.7", XSD_DEC),
  isa("BRCA1p", "Protein"),
  label("BRCA1p", "Breast cancer type 1 protein"),
  lit("BRCA1p", "molecularWeight", "207.7", XSD_DEC),
  isa("EGFRp", "Protein"),
  label("EGFRp", "Epidermal growth factor receptor"),
  lit("EGFRp", "molecularWeight", "134.3", XSD_DEC),
  isa("ApoE", "Protein"),
  label("ApoE", "Apolipoprotein E"),
  lit("ApoE", "molecularWeight", "36.2", XSD_DEC),
  uri("BRCA1", "encodes", "BRCA1p"),
  uri("TP53", "encodes", "p53"),
  uri("EGFR", "encodes", "EGFRp"),
  uri("APOE", "encodes", "ApoE"),
  // Diseases
  isa("BreastCancer", "Disease"),
  label("BreastCancer", "Breast cancer"),
  lit("BreastCancer", "prevalence", "13", XSD_INT),
  isa("LungCancer", "Disease"),
  label("LungCancer", "Lung cancer"),
  lit("LungCancer", "prevalence", "6", XSD_INT),
  isa("Alzheimer", "Disease"),
  label("Alzheimer", "Alzheimer disease"),
  lit("Alzheimer", "prevalence", "11", XSD_INT),
  // Gene/protein - disease associations
  uri("BRCA1", "associatedWith", "BreastCancer"),
  uri("TP53", "associatedWith", "BreastCancer"),
  uri("TP53", "associatedWith", "LungCancer"),
  uri("EGFR", "associatedWith", "LungCancer"),
  uri("APOE", "associatedWith", "Alzheimer"),
  // Drugs (target proteins, treat diseases)
  isa("Olaparib", "Drug"),
  label("Olaparib", "Olaparib"),
  lit("Olaparib", "approvalYear", "2014", XSD_INT),
  isa("Erlotinib", "Drug"),
  label("Erlotinib", "Erlotinib"),
  lit("Erlotinib", "approvalYear", "2004", XSD_INT),
  isa("Donepezil", "Drug"),
  label("Donepezil", "Donepezil"),
  lit("Donepezil", "approvalYear", "1996", XSD_INT),
  uri("Olaparib", "targets", "BRCA1p"),
  uri("Olaparib", "treats", "BreastCancer"),
  uri("Erlotinib", "targets", "EGFRp"),
  uri("Erlotinib", "treats", "LungCancer"),
  uri("Donepezil", "treats", "Alzheimer"),
  // Pathways
  isa("Apoptosis", "Pathway"),
  label("Apoptosis", "Apoptosis"),
  isa("DNARepair", "Pathway"),
  label("DNARepair", "DNA repair"),
  uri("p53", "participatesIn", "Apoptosis"),
  uri("p53", "participatesIn", "DNARepair"),
  uri("BRCA1p", "participatesIn", "DNARepair"),
];

export const bioGraph: RDFGraph = { triples: [...ontology, ...instances] };

const CLASS_URIS = new Set(
  ["Gene", "Protein", "Disease", "Drug", "Pathway"].map((c) => EX + c),
);

function numericFrom(triple: RDFTriple): number | undefined {
  if (triple.datatype === XSD_INT || triple.datatype === XSD_DEC) {
    const n = Number(triple.object);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Project the ABox into a UGM for the graph view: each typed instance becomes
 * a node (type = class local name), URI-object predicates become edges, and
 * literal predicates become node properties (numeric where typed). TBox
 * triples (class declarations, subClassOf) are left for the ontology explorer.
 */
export function rdfToUgm(graph: RDFGraph): UGM {
  const ugm = new UGM();
  const types = new Map<string, string[]>();
  const labels = new Map<string, string>();
  const props = new Map<string, Record<string, unknown>>();

  for (const t of graph.triples) {
    if (
      t.predicate === RDF_TYPE &&
      t.objectType === "uri" &&
      CLASS_URIS.has(t.object)
    ) {
      const list = types.get(t.subject) ?? [];
      list.push(localName(t.object));
      types.set(t.subject, list);
    } else if (t.predicate === RDFS_LABEL) {
      labels.set(t.subject, t.object);
    } else if (t.objectType === "literal") {
      const rec = props.get(t.subject) ?? {};
      const num = numericFrom(t);
      rec[localName(t.predicate)] = num ?? t.object;
      props.set(t.subject, rec);
    }
  }

  for (const [subject, nodeTypes] of types) {
    ugm.addNode(subject, {
      types: nodeTypes,
      properties: {
        name: labels.get(subject) ?? shorten(subject),
        iri: subject,
        ...(props.get(subject) ?? {}),
      },
    });
  }

  for (const t of graph.triples) {
    if (t.objectType !== "uri") continue;
    if (t.predicate === RDF_TYPE || t.predicate === RDFS_SUBCLASS) continue;
    if (types.has(t.subject) && types.has(t.object)) {
      ugm.addEdge(t.subject, t.object, {
        type: localName(t.predicate),
        confidence: 1,
      });
    }
  }

  return ugm;
}

/**
 * Raw triple view: every resource IRI is a node, every literal is its
 * own node, every triple (rdf:type included) is an edge labeled with
 * the predicate's local name. This is what the dataset looks like
 * BEFORE projection: the canvas toggle in BioShell renders it beside
 * the projected view so the collapses the projection pipeline performs
 * (types into node labels, literals into properties) are visible as a
 * count drop, not just a claim.
 */
export function rawTripleUgm(graph: RDFGraph): UGM {
  const ugm = new UGM();
  const ensure = (id: string): void => {
    if (!ugm.hasNode(id))
      ugm.addNode(id, {
        types: ["Resource"],
        properties: { name: localName(id) },
      });
  };
  let lit = 0;
  for (const t of graph.triples) {
    ensure(t.subject);
    if (t.objectType === "literal") {
      const litId = `lit:${lit++}`;
      ugm.addNode(litId, {
        types: ["Literal"],
        properties: { name: t.object, value: t.object },
      });
      ugm.addEdge(t.subject, litId, { type: localName(t.predicate) });
    } else {
      ensure(t.object);
      ugm.addEdge(t.subject, t.object, { type: localName(t.predicate) });
    }
  }
  return ugm;
}
