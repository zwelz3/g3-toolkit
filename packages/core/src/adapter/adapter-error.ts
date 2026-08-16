/**
 * Transport-failure error for the remote graph adapters.
 *
 * Every adapter used to reject a non-2xx response with a bare status:
 * `throw new Error("SPARQL query failed: 500")`. That is the least
 * useful half of the exchange. Endpoints answer a rejected query with
 * a body saying WHICH clause failed and at what offset, and the
 * adapters read that body, then discarded it. The consequence was that
 * a host had no way to tell a malformed query from an unreachable
 * store from an expired token without reproducing the request by hand
 * outside the app.
 *
 * The body is now preserved on the error, truncated, alongside the
 * status and the URL that produced it.
 *
 * Framework-agnostic (D6).
 *
 * @see specs/03-technical-data-layer.md R3.4(a)
 */
import type { AdapterResponse } from "../middleware/middleware";

/**
 * Longest error body kept on the error.
 *
 * Endpoints in front of a proxy answer a 502 with a full HTML page, and
 * a SPARQL store can echo the whole submitted query back inside a parse
 * error. Neither belongs in a log line or a toast in full. 1000
 * characters holds every real parse message observed from the four
 * dialects with room to spare, and the truncation is marked so nobody
 * reads a cut-off body as a complete one.
 */
export const MAX_ERROR_BODY_CHARS = 1000;

/**
 * Thrown when an adapter's endpoint answers with a non-2xx status.
 *
 * Distinct from `AdapterArgumentError`, which means the request never
 * left: this one means the endpoint was reached and refused. Hosts that
 * surface adapter failures should branch on that difference, because
 * only one of the two is worth retrying.
 */
export class AdapterHttpError extends Error {
  readonly code = "ADAPTER_HTTP_ERROR";
  /** Adapter that issued the request, e.g. "SPARQL". */
  readonly adapter: string;
  /** HTTP status returned by the endpoint. */
  readonly status: number;
  /** URL that was requested. */
  readonly url: string;
  /** Response body, truncated to {@link MAX_ERROR_BODY_CHARS}. */
  readonly body: string;
  /** True when {@link body} was cut short. */
  readonly bodyTruncated: boolean;

  constructor(args: {
    adapter: string;
    status: number;
    url: string;
    body: string;
  }) {
    const truncated = args.body.length > MAX_ERROR_BODY_CHARS;
    const body = truncated
      ? args.body.slice(0, MAX_ERROR_BODY_CHARS)
      : args.body;
    // The message carries the body too. A host that logs `err.message`
    // and nothing else is the common case, and the whole point of this
    // class is that such a host stops losing the only diagnostic the
    // endpoint sent.
    const detail = body.trim()
      ? `: ${body.trim()}${truncated ? " [truncated]" : ""}`
      : " (empty response body)";
    super(
      `${args.adapter} query failed: ${args.status} from ${args.url}${detail}`,
    );
    this.name = "AdapterHttpError";
    this.adapter = args.adapter;
    this.status = args.status;
    this.url = args.url;
    this.body = body;
    this.bodyTruncated = truncated;
  }
}

/**
 * Throw {@link AdapterHttpError} if `response` is not ok.
 *
 * Every adapter calls this instead of writing its own throw, so the
 * error shape cannot drift back apart adapter by adapter.
 */
export function assertOk(
  adapter: string,
  url: string,
  response: AdapterResponse,
): void {
  if (response.ok) return;
  throw new AdapterHttpError({
    adapter,
    status: response.status,
    url,
    body: response.body,
  });
}
