/**
 * The versioned-JSON failure convention, asserted as a contract rather
 * than parser by parser.
 *
 * The point of this file is that a host can write ONE handler for the
 * whole channel. If a parser drifts back to a bare `Error` or a raw
 * `SyntaxError`, the sweep at the bottom goes red.
 */
import { describe, it, expect } from "vitest";
import {
  DocumentParseError,
  InvalidJsonError,
  UnsupportedVersionError,
  MalformedDocumentError,
  parseJsonObject,
  requireVersion,
} from "./document-errors";
import { parseGraphDocument } from "./graph-document";
import { parseAlgorithmResult } from "../algorithm-adapter/algorithm-results";
import { parseShaclReport } from "../shacl/shacl-report";
import { parseStyleConfig } from "../style/style-config-json";

describe("the error hierarchy", () => {
  it("every member answers to DocumentParseError and to Error", () => {
    const members = [
      new InvalidJsonError("graph", new SyntaxError("boom")),
      new UnsupportedVersionError("workspace", 7),
      new MalformedDocumentError({
        documentKind: "shacl-report",
        message: "results must be an array",
      }),
    ];
    for (const m of members) {
      expect(m).toBeInstanceOf(DocumentParseError);
      // Nothing that already catches broadly may start missing these.
      expect(m).toBeInstanceOf(Error);
      expect(typeof m.code).toBe("string");
      expect(typeof m.documentKind).toBe("string");
      expect(m.path.startsWith("/")).toBe(true);
    }
  });

  it("InvalidJsonError keeps the SyntaxError as cause", () => {
    const syntax = new SyntaxError("Unexpected token");
    const err = new InvalidJsonError("graph", syntax);
    expect(err.code).toBe("NOT_JSON");
    expect(err.cause).toBe(syntax);
  });

  it("UnsupportedVersionError reports the version it found", () => {
    const err = new UnsupportedVersionError("encoding-spec", 4);
    expect(err.code).toBe("UNSUPPORTED_VERSION");
    expect(err.found).toBe(4);
    expect(err.path).toBe("/version");
    // "unsupported version undefined" is the message this replaces.
    expect(err.message).toContain("4");
    expect(err.message).toContain("reads 1");
  });

  it("names an absent version rather than reading undefined off it", () => {
    const err = new UnsupportedVersionError("workspace", undefined);
    expect(err.found).toBeUndefined();
    expect(err.message).toContain("undefined");
  });
});

describe("parseJsonObject", () => {
  it("returns the object for well-formed input", () => {
    expect(parseJsonObject("graph", '{"version":1}')).toEqual({ version: 1 });
  });

  it("turns a SyntaxError into InvalidJsonError", () => {
    expect(() => parseJsonObject("graph", "{oops")).toThrow(InvalidJsonError);
  });

  it("rejects valid JSON that is not an object", () => {
    // The literal "null" is valid JSON and used to reach `raw["version"]`,
    // where it threw a raw TypeError out of four separate parsers.
    for (const text of ["null", "[1,2]", '"a string"', "42"]) {
      const err = (() => {
        try {
          parseJsonObject("graph", text);
        } catch (e) {
          return e as DocumentParseError;
        }
        return undefined;
      })();
      expect(err, text).toBeInstanceOf(MalformedDocumentError);
      expect(err?.code, text).toBe("NOT_OBJECT");
    }
  });
});

describe("requireVersion", () => {
  it("accepts a supported version and rejects anything else", () => {
    expect(() => requireVersion("graph", { version: 1 })).not.toThrow();
    for (const version of [2, "1", null, undefined, Number.NaN]) {
      expect(() =>
        requireVersion("graph", { version } as Record<string, unknown>),
      ).toThrow(UnsupportedVersionError);
    }
  });
});

describe("the convention itself", () => {
  it("a document that can degrade RETURNS partial results", () => {
    // One bad edge must not cost the caller the good nodes.
    const result = parseGraphDocument(
      JSON.stringify({
        version: 1,
        nodes: [{ id: "a" }, { id: "b" }],
        edges: [null, { id: "e1", source: "a", target: "b" }],
      }),
    );
    expect("document" in result).toBe(true);
    if (!("document" in result)) return;
    expect(result.document.nodes).toHaveLength(2);
    expect(result.document.edges).toHaveLength(1);
    expect(result.diagnostics.some((d) => d.code === "BAD_SHAPE")).toBe(true);
  });

  it("its unreadable-document branch carries the same typed error", () => {
    const result = parseGraphDocument("{oops");
    expect("error" in result).toBe(true);
    if (!("error" in result)) return;
    // The whole point: a host branches on `code`, not on the message.
    expect(result.detail).toBeInstanceOf(InvalidJsonError);
    expect(result.detail.code).toBe("NOT_JSON");
    expect(result.detail.documentKind).toBe("graph");
    expect(result.error).toBe(result.detail.message);
  });

  it("reports a wrong version and a non-object distinctly", () => {
    const version = parseGraphDocument(
      '{"version": 9, "nodes": [], "edges": []}',
    );
    expect("error" in version && version.detail.code).toBe(
      "UNSUPPORTED_VERSION",
    );
    const notObject = parseGraphDocument("[]");
    expect("error" in notObject && notObject.detail.code).toBe("NOT_OBJECT");
  });

  it("a hand-authored document reports EVERY problem at once", () => {
    // Arm 2 of the rule. A throw would carry one of these; the point of
    // the result shape here is that it carries all of them.
    const result = parseStyleConfig(
      JSON.stringify({ version: 3, rules: "not an array" }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors.map((e) => e.code)).toContain("CFG_BAD_VERSION");
    expect(result.errors.map((e) => e.code)).toContain("CFG_RULE_SHAPE");
  });

  it("a document with no partial reading THROWS", () => {
    expect(() => parseShaclReport({ version: 1 })).toThrow(
      MalformedDocumentError,
    );
    expect(() => parseAlgorithmResult('{"version": 1}')).toThrow(
      DocumentParseError,
    );
  });
});

describe("one handler covers the channel", () => {
  /**
   * The sweep. Every throwing parser, every top-level failure mode. If
   * any parser regresses to a bare Error or lets a raw SyntaxError or
   * TypeError escape, this goes red.
   */
  const BAD_INPUTS = ["not json", "null", "[]", '{"version": 99}'];

  const throwingParsers: Array<[string, (text: string) => unknown]> = [
    ["parseAlgorithmResult", (t) => parseAlgorithmResult(t)],
    ["parseShaclReport", (t) => parseShaclReport(JSON.parse(t) as unknown)],
  ];

  for (const [name, parse] of throwingParsers) {
    for (const bad of BAD_INPUTS) {
      // parseShaclReport takes a parsed value, so "not json" is not its
      // failure mode to report; skip that one pairing rather than
      // asserting something the contract never claimed.
      if (name === "parseShaclReport" && bad === "not json") continue;

      it(`${name} rejects ${bad} with a typed error`, () => {
        let thrown: unknown;
        try {
          parse(bad);
        } catch (e) {
          thrown = e;
        }
        expect(thrown).toBeInstanceOf(DocumentParseError);
        expect(thrown).not.toBeInstanceOf(SyntaxError);
        expect(thrown).not.toBeInstanceOf(TypeError);
      });
    }
  }
});
