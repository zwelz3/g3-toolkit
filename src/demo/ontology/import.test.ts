/**
 * RDF import tests: Turtle and JSON-LD parse to core RDFTriples with
 * datatypes and language tags preserved; RDF/XML and unknown
 * extensions are rejected with actionable messages.
 */
import { describe, it, expect } from "vitest";
import { parseRdfFile } from "./import";

const TTL = `
@prefix ex: <http://example.org/sat#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
ex:vega a ex:Satellite ;
  ex:mass "310.5"^^xsd:decimal ;
  ex:nickname "Vega"@en .
`;

const JSONLD = JSON.stringify({
  "@context": { ex: "http://example.org/sat#" },
  "@id": "http://example.org/sat#lyra",
  "@type": "http://example.org/sat#Satellite",
  "ex:callSign": "LYRA-1",
});

describe("parseRdfFile", () => {
  it("parses Turtle with datatypes and language tags", async () => {
    const result = await parseRdfFile("extra.ttl", TTL);
    expect(result.triples.length).toBe(3);
    const mass = result.triples.find((t) => t.predicate.endsWith("mass"));
    expect(mass?.objectType).toBe("literal");
    expect(mass?.datatype).toBe("http://www.w3.org/2001/XMLSchema#decimal");
    const nick = result.triples.find((t) => t.predicate.endsWith("nickname"));
    expect(nick?.language).toBe("en");
    const type = result.triples.find((t) => t.predicate.endsWith("#type"));
    expect(type?.object).toBe("http://example.org/sat#Satellite");
    expect(type?.objectType).toBe("uri");
  });

  it("parses JSON-LD via N-Quads", async () => {
    const result = await parseRdfFile("extra.jsonld", JSONLD);
    const subjects = new Set(result.triples.map((t) => t.subject));
    expect(subjects.has("http://example.org/sat#lyra")).toBe(true);
    const call = result.triples.find((t) => t.predicate.endsWith("callSign"));
    expect(call?.object).toBe("LYRA-1");
    expect(call?.objectType).toBe("literal");
  });

  it("rejects RDF/XML with a convert-to-Turtle message", async () => {
    await expect(parseRdfFile("onto.owl", "<rdf:RDF/>")).rejects.toThrow(
      /RDF\/XML is not supported.*riot/s,
    );
  });

  it("rejects unrecognized extensions with the supported list", async () => {
    await expect(parseRdfFile("data.csv", "a,b")).rejects.toThrow(
      /Unrecognized extension.*\.ttl/s,
    );
  });
});
