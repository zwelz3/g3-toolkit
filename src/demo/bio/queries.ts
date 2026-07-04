/**
 * Default queries for the SPARQL panel. Each carries a chart hint so a
 * numeric result can drive a linked bar or scatter panel: labelVar names the
 * category (a URI, shortened for display) and valueVar the numeric literal.
 */
export interface NamedQuery {
  id: string;
  name: string;
  description: string;
  sparql: string;
  chart?: { kind: "bar" | "scatter"; labelVar: string; valueVar: string };
}

export const defaultQueries: NamedQuery[] = [
  {
    id: "q.gene-disease",
    name: "Gene to disease associations",
    description: "Every gene and the disease it is associated with.",
    sparql: `PREFIX ex: <http://example.org/bio#>
SELECT ?gene ?disease WHERE {
  ?gene a ex:Gene ;
        ex:associatedWith ?disease .
}`,
  },
  {
    id: "q.drug-target-disease",
    name: "Drug to target to disease",
    description: "Drugs, the protein they target, and the disease they treat.",
    sparql: `PREFIX ex: <http://example.org/bio#>
SELECT ?drug ?protein ?disease WHERE {
  ?drug a ex:Drug ;
        ex:targets ?protein ;
        ex:treats ?disease .
}`,
  },
  {
    id: "q.protein-mw",
    name: "Protein molecular weights",
    description: "Proteins ordered by molecular weight (kDa).",
    sparql: `PREFIX ex: <http://example.org/bio#>
SELECT ?protein ?mw WHERE {
  ?protein a ex:Protein ;
           ex:molecularWeight ?mw .
} ORDER BY DESC(?mw)`,
    chart: { kind: "bar", labelVar: "protein", valueVar: "mw" },
  },
  {
    id: "q.drug-year",
    name: "Drug approval years",
    description: "Approval year per drug.",
    sparql: `PREFIX ex: <http://example.org/bio#>
SELECT ?drug ?year WHERE {
  ?drug a ex:Drug ;
        ex:approvalYear ?year .
} ORDER BY ?year`,
    chart: { kind: "bar", labelVar: "drug", valueVar: "year" },
  },
  {
    id: "q.disease-prevalence",
    name: "Disease prevalence",
    description: "Approximate prevalence per disease (cases per 100k).",
    sparql: `PREFIX ex: <http://example.org/bio#>
SELECT ?disease ?prevalence WHERE {
  ?disease a ex:Disease ;
           ex:prevalence ?prevalence .
}`,
    chart: { kind: "bar", labelVar: "disease", valueVar: "prevalence" },
  },
];
