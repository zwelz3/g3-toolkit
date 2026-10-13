/**
 * WorkingSetConfig validation (issue #5): the deployment document is
 * hand-authored, so every rejection names a path and a reason, and
 * the failure vocabulary is the shared one (model/document-errors.ts).
 */

import { describe, it, expect } from "vitest";
import {
  parseWorkingSetConfig,
  validateWorkingSetConfig,
} from "./working-set-config";
import {
  DocumentParseError,
  InvalidJsonError,
  MalformedDocumentError,
  UnsupportedVersionError,
} from "../model/document-errors";

function failure(fn: () => unknown): DocumentParseError {
  try {
    fn();
  } catch (e) {
    if (e instanceof DocumentParseError) return e;
    throw e;
  }
  throw new Error("expected a DocumentParseError");
}

describe("parseWorkingSetConfig / validateWorkingSetConfig", () => {
  it("accepts a full document and echoes only the known fields", () => {
    const doc = parseWorkingSetConfig(
      JSON.stringify({
        version: 1,
        limits: {
          canvas: { default: 300, ceiling: 800 },
          tree: { ceiling: 2_000 },
          matrix: { default: 150 },
        },
      }),
    );
    expect(doc).toEqual({
      version: 1,
      limits: {
        canvas: { default: 300, ceiling: 800 },
        tree: { ceiling: 2_000 },
        matrix: { default: 150 },
      },
    });
  });

  it("accepts a document with no limits (every view optional)", () => {
    expect(validateWorkingSetConfig({ version: 1 })).toEqual({ version: 1 });
    expect(validateWorkingSetConfig({ version: 1, limits: {} })).toEqual({
      version: 1,
      limits: {},
    });
  });

  it("rejects text that is not JSON with the shared InvalidJsonError", () => {
    const e = failure(() => parseWorkingSetConfig("{nope"));
    expect(e).toBeInstanceOf(InvalidJsonError);
    expect(e.documentKind).toBe("working-set-config");
  });

  it("rejects a non-object root", () => {
    const e = failure(() => validateWorkingSetConfig([1]));
    expect(e).toBeInstanceOf(MalformedDocumentError);
    expect(e.code).toBe("NOT_OBJECT");
  });

  it("rejects an unsupported version and reports what it found", () => {
    const e = failure(() => validateWorkingSetConfig({ version: 2 }));
    expect(e).toBeInstanceOf(UnsupportedVersionError);
    expect((e as UnsupportedVersionError).found).toBe(2);
    expect(e.path).toBe("/version");
  });

  it("rejects an unknown view name at its path (a typo configures nothing otherwise)", () => {
    const e = failure(() =>
      validateWorkingSetConfig({
        version: 1,
        limits: { canvass: { ceiling: 300 } },
      }),
    );
    expect(e.code).toBe("BAD_SHAPE");
    expect(e.path).toBe("/limits/canvass");
  });

  it("rejects limits that are not an object", () => {
    const e = failure(() =>
      validateWorkingSetConfig({ version: 1, limits: [300] }),
    );
    expect(e.path).toBe("/limits");
  });

  it("rejects a view entry that is not an object", () => {
    const e = failure(() =>
      validateWorkingSetConfig({ version: 1, limits: { canvas: 300 } }),
    );
    expect(e.path).toBe("/limits/canvas");
  });

  it.each([0, -1, 1.5, "300", null])(
    "rejects a non-positive-integer count (%j) at the field path",
    (bad) => {
      const e = failure(() =>
        validateWorkingSetConfig({
          version: 1,
          limits: { canvas: { ceiling: bad } },
        }),
      );
      expect(e.path).toBe("/limits/canvas/ceiling");
      expect(e.message).toContain("positive integer");
    },
  );

  it("rejects a default above its own ceiling rather than clamping it", () => {
    const e = failure(() =>
      validateWorkingSetConfig({
        version: 1,
        limits: { canvas: { default: 900, ceiling: 800 } },
      }),
    );
    expect(e.path).toBe("/limits/canvas/default");
    expect(e.message).toMatch(/exceeds/);
  });
});
