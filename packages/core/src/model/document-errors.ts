/**
 * One failure convention for the versioned-JSON integration channel.
 *
 * Versioned JSON documents are one of the three declared host
 * integration channels, and until this module existed they were the
 * least defended: seven parsers across two packages failed in four
 * mutually incompatible ways, with no shared error type a host could
 * branch on.
 *
 * ## The rule
 *
 * The split between "throw" and "return a result" is NOT arbitrary and
 * is not being unified away. Forcing all seven into one return shape
 * would be a breaking change across the whole channel in exchange for
 * losing information three of them need. The shape tracks what the
 * document can usefully say when it fails:
 *
 * 1. **It can degrade, so it returns partial results plus
 *    diagnostics.** `parseGraphDocument` and `parseChangeSet` describe
 *    collections of independent elements, so one malformed edge must
 *    not cost the caller the other nine hundred. A throw would discard
 *    the good elements, which is the entire value.
 * 2. **It cannot degrade, but every problem is worth reporting at
 *    once, so it returns `{ ok, errors }`.** `parseStyleConfig` reads a
 *    file a human authored by hand. Handing back all five mistakes
 *    beats handing back the first one five times. A throw carries one
 *    error; this shape exists because that is not enough here.
 * 3. **It cannot degrade and the first failure is decisive, so it
 *    throws.** An encoding spec, a workspace snapshot, a SHACL report
 *    and an algorithm result are single objects, usually
 *    machine-generated, with no partial reading worth having. There is
 *    no "half an encoding spec".
 *
 * What IS unified is the error vocabulary. Every failure in this
 * channel, thrown or returned, carries the same `code`, names the same
 * `documentKind`, and points at a `path` inside the document. A host
 * that writes one handler for `DocumentParseError` handles all four
 * throwing parsers; `parseGraphDocument`'s `error` branch carries the
 * same typed error as `detail`; and the returned diagnostics and
 * `StyleConfigError` codes describe the same problems with the same
 * words (`parseStyleConfig` namespaces its with a `CFG_` prefix, which
 * predates this module and is kept because renaming a published code
 * would break any host matching on it).
 *
 * ## Why these are subclasses rather than one class with a code
 *
 * The three top-level cases are the ones a host actually branches on,
 * and they call for different responses: `InvalidJsonError` means the
 * file is not a document at all, `UnsupportedVersionError` means it is
 * a document this build is too old or too new to read (and carries the
 * version found, so a host can say so), and `MalformedDocumentError`
 * means the version matched but the contents did not. `instanceof` is
 * the cheapest way to express that, and every one still answers to
 * `instanceof Error`, so nothing that catches broadly breaks.
 *
 * Framework-agnostic (D6).
 */

/** Which versioned document a failure came from. */
export type DocumentKind =
  | "graph"
  | "encoding-spec"
  | "workspace"
  | "algorithm-result"
  | "shacl-report"
  | "style-config"
  | "change-set";

/**
 * Shared failure vocabulary. Used by the throwing parsers as
 * `DocumentParseError.code` and by the degrading parsers as the code on
 * a diagnostic, so the two halves of the channel describe the same
 * problems with the same words.
 */
export type DocumentErrorCode =
  /** The text was not JSON at all. */
  | "NOT_JSON"
  /** Valid JSON, but not an object (`null`, an array, a bare number). */
  | "NOT_OBJECT"
  /** An object, but `version` is not one this build reads. */
  | "UNSUPPORTED_VERSION"
  /** A field is present but the wrong type or shape. */
  | "BAD_SHAPE"
  /** A required field is absent. */
  | "MISSING_FIELD"
  /** A name in the document is reserved by the library. */
  | "RESERVED_NAME";

/**
 * Base class for every failure of a versioned-JSON parser that cannot
 * degrade.
 *
 * Catch this to handle all of them at once; catch a subclass to
 * distinguish "not a document" from "wrong version" from "bad
 * contents".
 */
export class DocumentParseError extends Error {
  readonly code: DocumentErrorCode;
  /** Which document kind rejected the input. */
  readonly documentKind: DocumentKind;
  /**
   * Slash-path to the offending place, rooted at `/`. `/` itself means
   * the whole document.
   */
  readonly path: string;

  constructor(args: {
    code: DocumentErrorCode;
    documentKind: DocumentKind;
    message: string;
    path?: string;
    cause?: unknown;
  }) {
    super(args.message, args.cause !== undefined ? { cause: args.cause } : {});
    this.name = "DocumentParseError";
    this.code = args.code;
    this.documentKind = args.documentKind;
    this.path = args.path ?? "/";
  }
}

/** The text was not JSON. The `SyntaxError` is the `cause`. */
export class InvalidJsonError extends DocumentParseError {
  constructor(documentKind: DocumentKind, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super({
      code: "NOT_JSON",
      documentKind,
      message: `not valid JSON for a ${documentKind} document: ${detail}`,
      cause,
    });
    this.name = "InvalidJsonError";
  }
}

/**
 * The document declares a version this build does not read.
 *
 * Carries the version found so a host can tell the user which one it
 * has, which is the difference between an actionable message and
 * "unsupported version undefined".
 */
export class UnsupportedVersionError extends DocumentParseError {
  /** The `version` value actually present, whatever its type. */
  readonly found: unknown;
  /** The versions this build reads. */
  readonly supported: readonly number[];

  constructor(
    documentKind: DocumentKind,
    found: unknown,
    supported: readonly number[] = [1],
  ) {
    super({
      code: "UNSUPPORTED_VERSION",
      documentKind,
      message:
        `unsupported ${documentKind} document version ${JSON.stringify(found)}; ` +
        `this build reads ${supported.join(", ")}`,
      path: "/version",
    });
    this.name = "UnsupportedVersionError";
    this.found = found;
    this.supported = supported;
  }
}

/** The version matched but the contents did not hold up. */
export class MalformedDocumentError extends DocumentParseError {
  constructor(args: {
    documentKind: DocumentKind;
    message: string;
    code?: Extract<
      DocumentErrorCode,
      "NOT_OBJECT" | "BAD_SHAPE" | "MISSING_FIELD" | "RESERVED_NAME"
    >;
    path?: string;
  }) {
    super({
      code: args.code ?? "BAD_SHAPE",
      documentKind: args.documentKind,
      message: `${args.documentKind} document: ${args.message}`,
      path: args.path,
    });
    this.name = "MalformedDocumentError";
  }
}

/**
 * Parse text that must be a JSON object, or throw a typed error.
 *
 * Four parsers used to call `JSON.parse` bare and then index the
 * result, so malformed text escaped as a raw `SyntaxError` and the
 * literal text `"null"` (valid JSON) escaped as a `TypeError` from
 * reading `version` off `null`. Both were failures of the declared
 * contract, not of the caller. Doing it once here means neither can
 * come back one parser at a time.
 */
export function parseJsonObject(
  documentKind: DocumentKind,
  text: string,
): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    throw new InvalidJsonError(documentKind, cause);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new MalformedDocumentError({
      documentKind,
      code: "NOT_OBJECT",
      message: `root is ${Array.isArray(raw) ? "an array" : String(raw)}, expected an object`,
    });
  }
  return raw as Record<string, unknown>;
}

/**
 * Assert the document's `version`, or throw {@link UnsupportedVersionError}.
 */
export function requireVersion(
  documentKind: DocumentKind,
  raw: Record<string, unknown>,
  supported: readonly number[] = [1],
): void {
  const found = raw["version"];
  if (typeof found !== "number" || !supported.includes(found)) {
    throw new UnsupportedVersionError(documentKind, found, supported);
  }
}
