/**
 * RDF file import for the Ontology Workbench (requirement 3).
 *
 * Supported (playground-only dependencies; nothing here enters the
 * toolkit packages or their bundle budget):
 * - .ttl / .n3 / .nt / .nq / .trig via N3.Parser (format inferred
 *   from the extension; named-graph context of quads is dropped)
 * - .jsonld / .json via jsonld.toRDF -> N-Quads -> N3.Parser
 *
 * NOT supported: RDF/XML (.owl / .rdf / .xml). A streaming RDF/XML
 * parser needs Node stream shims in the browser bundle; rather than
 * ship a fragile shim, the importer rejects with a message telling
 * the user to convert to Turtle (e.g. `riot --output=ttl file.owl`).
 */
// n3 and jsonld are loaded lazily: they are only needed when the
// user actually imports a file, so they stay out of the initial
// playground chunk.
import type { Quad } from "n3";
import type { RDFTriple } from "@g3t/core";

export interface ImportResult {
  triples: RDFTriple[];
  warnings: string[];
}

const N3_FORMATS: Record<string, string> = {
  ttl: "text/turtle",
  n3: "text/n3",
  nt: "application/N-Triples",
  nq: "application/N-Quads",
  trig: "application/TriG",
};

function quadToTriple(q: Quad): RDFTriple | null {
  const s = q.subject;
  const o = q.object;
  if (s.termType !== "NamedNode" && s.termType !== "BlankNode") return null;
  const base: RDFTriple = {
    subject: s.value,
    predicate: q.predicate.value,
    object: o.value,
    objectType:
      o.termType === "Literal"
        ? "literal"
        : o.termType === "BlankNode"
          ? "bnode"
          : "uri",
  };
  if (o.termType === "Literal") {
    if (o.language !== "") base.language = o.language;
    else if (o.datatype.value !== "") base.datatype = o.datatype.value;
  }
  return base;
}

async function parseWithN3(
  text: string,
  format: string,
): Promise<ImportResult> {
  const { Parser: N3Parser } = await import("n3");
  const parser = new N3Parser({ format });
  const quads = parser.parse(text);
  const triples: RDFTriple[] = [];
  const warnings: string[] = [];
  let dropped = 0;
  for (const q of quads) {
    const t = quadToTriple(q);
    if (t) triples.push(t);
    else dropped++;
  }
  if (dropped > 0) {
    warnings.push(`${dropped} statement(s) with unsupported terms dropped.`);
  }
  return { triples, warnings };
}

export async function parseRdfFile(
  fileName: string,
  text: string,
): Promise<ImportResult> {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();

  if (ext === "owl" || ext === "rdf" || ext === "xml") {
    throw new Error(
      "RDF/XML is not supported in the browser importer. Convert to Turtle first (e.g. `riot --output=ttl " +
        fileName +
        "`) and import the .ttl file.",
    );
  }

  if (ext === "jsonld" || ext === "json") {
    const { default: jsonld } = await import("jsonld");
    const doc: unknown = JSON.parse(text);
    const nquads = (await jsonld.toRDF(doc as object, {
      format: "application/n-quads",
    })) as unknown as string;
    return parseWithN3(nquads, "application/N-Quads");
  }

  const format = N3_FORMATS[ext];
  if (format === undefined) {
    throw new Error(
      `Unrecognized extension ".${ext}". Supported: .ttl, .n3, .nt, .nq, .trig, .jsonld, .json.`,
    );
  }
  return parseWithN3(text, format);
}
