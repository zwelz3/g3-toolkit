/**
 * Query-argument safety for the remote graph adapters.
 *
 * The published `GraphAdapter` contract (`./types`) takes `nodeId`,
 * `depth` and `edgeTypes` from the host, which in practice means from
 * a node click, a search result, or a server payload. Those values
 * used to be spliced directly into query text by all three remote
 * adapters, so a hostile id could close the literal it sat in and
 * append clauses of its own.
 *
 * The rule now: where the wire protocol HAS a binding mechanism, the
 * adapter uses it (Gremlin `bindings`, Cypher `parameters`). Where the
 * protocol has none for that position (Cypher relationship types,
 * SPARQL IRIs and path quantifiers are all syntax, not terms), the
 * value is validated here before it reaches the string, and a value
 * that cannot be proven safe is rejected rather than escaped. Escaping
 * would require this module to model each dialect's quoting rules
 * correctly forever; rejection only requires it to recognize the safe
 * subset.
 *
 * Framework-agnostic (D6).
 */

/**
 * Thrown when an adapter argument cannot be safely placed in a query.
 *
 * Hosts that pass user-controlled ids should catch this and treat it
 * as a bad request, not as a transport failure: it means the value
 * never reached the endpoint.
 */
export class AdapterArgumentError extends Error {
  readonly code = "UNSAFE_ARGUMENT";
  /** Name of the rejected `GraphAdapter` argument, e.g. "nodeId". */
  readonly argument: string;

  constructor(argument: string, message: string) {
    super(message);
    this.name = "AdapterArgumentError";
    this.argument = argument;
  }
}

/** Upper bound on traversal depth when the caller supplies none. */
export const MAX_TRAVERSAL_DEPTH = 10;

/**
 * Coerce a traversal depth to an integer in [1, max].
 *
 * `depth` is typed `number` on the interface, but nothing enforces
 * that at the JS boundary, and in two of the three adapters it lands
 * inside query syntax (a `.times()` argument, a `{1,N}` quantifier)
 * where a string would be interpolated verbatim. Out-of-range numbers
 * clamp; values that are not numbers at all are rejected, because a
 * NaN depth is a caller bug worth surfacing rather than silently
 * reading as 1.
 */
export function coerceDepth(
  depth: unknown,
  max: number = MAX_TRAVERSAL_DEPTH,
): number {
  const n = typeof depth === "number" ? depth : Number(depth);
  if (!Number.isFinite(n)) {
    throw new AdapterArgumentError(
      "depth",
      `depth must be a finite number, received ${JSON.stringify(depth)}`,
    );
  }
  return Math.min(Math.max(1, Math.floor(n)), max);
}

/**
 * Assert that a value is usable as a bare identifier in query syntax.
 *
 * Cypher relationship types cannot be parameterized, so
 * `[r:${types}]` has to be built by interpolation. Neo4j's own
 * unquoted-identifier rule is the safe subset accepted here; anything
 * needing backtick quoting is rejected instead of quoted, since a
 * backtick inside the value would escape the quoting.
 */
export function assertPlainIdentifier(
  value: unknown,
  argument: string,
): string {
  if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new AdapterArgumentError(
      argument,
      `${argument} must match /^[A-Za-z_][A-Za-z0-9_]*$/, received ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/**
 * Characters that terminate an IRI inside SPARQL angle brackets, plus
 * the rest of what RFC 3987 excludes from an IRI anyway. `>` alone
 * would be enough to stop the `SERVICE`-clause escape, but
 * the others are equally not-an-IRI and cost nothing to refuse.
 * Control characters are checked separately, by `hasControlChar`.
 */
const IRI_FORBIDDEN = /[<>"{}|^`\\\s]/;

/**
 * True if the string contains a C0 or C1 control character (or a
 * space, which the class above also catches). Written as a codepoint
 * scan rather than a regex range so no literal control byte has to
 * appear in this source file.
 */
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x20 || (c >= 0x7f && c <= 0x9f)) return true;
  }
  return false;
}

/**
 * Assert that a value is an absolute IRI safe to place between angle
 * brackets in a SPARQL query.
 *
 * Requires a scheme, because a relative reference resolves against the
 * endpoint's base and is rarely what a host means by a node id.
 */
export function assertSafeIri(value: unknown, argument: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AdapterArgumentError(
      argument,
      `${argument} must be a non-empty IRI string, received ${JSON.stringify(value)}`,
    );
  }
  if (IRI_FORBIDDEN.test(value) || hasControlChar(value)) {
    throw new AdapterArgumentError(
      argument,
      `${argument} contains characters that are not legal in an IRI: ${JSON.stringify(value)}`,
    );
  }
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) {
    throw new AdapterArgumentError(
      argument,
      `${argument} must be an absolute IRI with a scheme, received ${JSON.stringify(value)}`,
    );
  }
  return value;
}
