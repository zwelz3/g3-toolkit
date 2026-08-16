/**
 * Adapter middleware: composable request/response interceptors (M10.5.E2.T2).
 *
 * All adapters accept a `middleware` option. Middleware wraps the
 * fetch call, enabling auth injection, retry, logging, and caching
 * without modifying adapter internals.
 *
 * Framework-agnostic (D6).
 */

// ── Types ───────────────────────────────────────────────────────────

export interface AdapterRequest {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers: Record<string, string>;
  body?: string;
  /**
   * Caller's cancellation signal.
   *
   * Honored by {@link defaultFetch} in addition to its own timeout, so
   * a host can cancel an in-flight query when the user navigates away
   * without giving up the timeout that stops a hung endpoint.
   */
  signal?: AbortSignal;
}

export interface AdapterResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  ok: boolean;
}

export type Middleware = (
  request: AdapterRequest,
  next: (req: AdapterRequest) => Promise<AdapterResponse>,
) => Promise<AdapterResponse>;

// ── Middleware Chain Runner ──────────────────────────────────────────

/**
 * Compose middleware into a single fetch-like function.
 * Middleware runs in order: first registered wraps outermost.
 */
export function composeMiddleware(
  middlewares: Middleware[],
  baseFetch: (req: AdapterRequest) => Promise<AdapterResponse>,
): (req: AdapterRequest) => Promise<AdapterResponse> {
  let chain = baseFetch;
  for (let i = middlewares.length - 1; i >= 0; i--) {
    const mw = middlewares[i];
    if (!mw) continue;
    const next = chain;
    chain = (req: AdapterRequest) => mw(req, next);
  }
  return chain;
}

/**
 * Default request timeout in milliseconds.
 *
 * There was none before. `fetch` has no timeout of its own, so an
 * endpoint that accepted the connection and then stopped answering
 * left the returned promise pending forever, and every adapter call
 * sits behind an `await`. In a browser that is a spinner that never
 * resolves, with no error to catch and nothing in the console.
 *
 * 30 seconds is chosen to sit above a slow-but-real analytic query and
 * below any user's patience. Hosts that genuinely run longer queries
 * should raise it explicitly per adapter rather than have the default
 * accommodate the worst case.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Thrown when a request exceeds its timeout, or when the caller's
 * signal aborts it.
 *
 * Carries `timedOut` so a host can tell the two apart: a timeout is
 * worth reporting, a caller-initiated abort usually is not.
 */
export class AdapterTimeoutError extends Error {
  readonly code = "ADAPTER_ABORTED";
  readonly url: string;
  /** True for the timeout; false when the caller's signal aborted. */
  readonly timedOut: boolean;
  /** Timeout in force for the request, in milliseconds. */
  readonly timeoutMs: number;

  constructor(args: { url: string; timedOut: boolean; timeoutMs: number }) {
    super(
      args.timedOut
        ? `Adapter request to ${args.url} timed out after ${args.timeoutMs} ms`
        : `Adapter request to ${args.url} was aborted by the caller`,
    );
    this.name = "AdapterTimeoutError";
    this.url = args.url;
    this.timedOut = args.timedOut;
    this.timeoutMs = args.timeoutMs;
  }
}

/**
 * Build a base fetch with a specific timeout.
 *
 * `AbortSignal.any` would express the "caller's signal OR our timeout"
 * composition directly, but it is newer than the runtime floor these
 * packages claim, so the composition is done by hand with one
 * controller and a forwarded listener. The listener is removed in
 * `finally`; without that, a long-lived caller signal accumulates one
 * listener per request and warns about a leak after ten.
 *
 * Pass `timeoutMs: 0` to disable the timeout. That is a deliberate
 * choice a host has to make in writing, which is the point.
 */
export function createDefaultFetch(options?: {
  timeoutMs?: number;
}): (req: AdapterRequest) => Promise<AdapterResponse> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async function boundFetch(
    req: AdapterRequest,
  ): Promise<AdapterResponse> {
    // Short-circuit a signal that already fired. Issuing a request the
    // caller has cancelled is wasted work at best, and relying on the
    // transport to reject a pre-aborted signal makes correctness depend
    // on the transport rather than on us.
    if (req.signal?.aborted) {
      throw new AdapterTimeoutError({
        url: req.url,
        timedOut: false,
        timeoutMs,
      });
    }

    const controller = new AbortController();
    let timedOut = false;

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs)
        : undefined;

    const forwardAbort = () => controller.abort();
    req.signal?.addEventListener("abort", forwardAbort);

    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        headers: responseHeaders,
        body: await response.text(),
        ok: response.ok,
      };
    } catch (cause) {
      // `fetch` reports both cases as the same bare AbortError, so the
      // reason has to come from our own bookkeeping rather than from
      // the error. Translating here means a host never has to
      // string-match on "The operation was aborted".
      if (controller.signal.aborted) {
        throw new AdapterTimeoutError({ url: req.url, timedOut, timeoutMs });
      }
      throw cause;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      req.signal?.removeEventListener("abort", forwardAbort);
    }
  };
}

/**
 * Default base fetch using the global `fetch` API, with
 * {@link DEFAULT_TIMEOUT_MS} applied.
 */
export const defaultFetch: (req: AdapterRequest) => Promise<AdapterResponse> =
  createDefaultFetch();

// ── Built-in Middleware ─────────────────────────────────────────────

/**
 * Bearer token auth middleware.
 * @param getToken Function that returns the current token (can be async).
 */
export function bearerAuth(
  getToken: () => string | Promise<string>,
): Middleware {
  return async (req, next) => {
    const token = await getToken();
    return next({
      ...req,
      headers: { ...req.headers, Authorization: `Bearer ${token}` },
    });
  };
}

/**
 * API key header middleware.
 */
export function apiKeyHeader(
  headerName: string,
  getKey: () => string,
): Middleware {
  return async (req, next) => {
    return next({
      ...req,
      headers: { ...req.headers, [headerName]: getKey() },
    });
  };
}

/**
 * Thrown when every retry attempt failed with a thrown error.
 *
 * The original failure is the `cause`. The previous implementation
 * threw a bare `new Error("Max retries exceeded")` from an empty
 * `catch {}`, which discarded the only thing worth knowing: whether the
 * endpoint was refusing connections, rejecting the token, or timing
 * out. A host saw the same six words for all three.
 */
export class RetryExhaustedError extends Error {
  readonly code = "RETRY_EXHAUSTED";
  /** Number of attempts made, including the first. */
  readonly attempts: number;

  constructor(attempts: number, cause: unknown) {
    super(
      `Adapter request failed on all ${attempts} attempt(s); the last error is the cause`,
      { cause },
    );
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
  }
}

/**
 * Retry middleware with exponential backoff.
 *
 * Aborts are never retried. A timeout or a caller cancellation is not
 * a transient fault to ride out: retrying a cancelled request ignores
 * an explicit instruction, and retrying a timeout multiplies the wait
 * the timeout existed to bound (3 retries over a 30 s timeout is two
 * minutes of a hung spinner, which is worse than the hang it replaced).
 */
export function retryOnError(options?: {
  maxRetries?: number;
  baseDelay?: number;
  retryOn?: (response: AdapterResponse) => boolean;
}): Middleware {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelay = options?.baseDelay ?? 500;
  const shouldRetry =
    options?.retryOn ?? ((res) => res.status >= 500 || !res.ok);

  return async (req, next) => {
    let lastResponse: AdapterResponse | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await next(req);
        if (!shouldRetry(response) || attempt === maxRetries) {
          return response;
        }
        lastResponse = response;
      } catch (err) {
        if (err instanceof AdapterTimeoutError) throw err;
        lastError = err;
        if (attempt === maxRetries) {
          throw new RetryExhaustedError(attempt + 1, err);
        }
      }
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
    }
    // Unreachable: the loop returns or throws on its final attempt.
    // Kept as a throw rather than a non-null assertion so a future edit
    // that breaks that invariant fails loudly instead of returning
    // `undefined` typed as a response.
    throw new RetryExhaustedError(maxRetries + 1, lastError ?? lastResponse);
  };
}

/**
 * Request logging middleware.
 */
export function requestLogger(
  log: (msg: string) => void = console.log,
): Middleware {
  return async (req, next) => {
    const start = Date.now();
    log(`[g3t] ${req.method} ${req.url}`);
    const response = await next(req);
    log(`[g3t] ${response.status} ${req.url} (${Date.now() - start}ms)`);
    return response;
  };
}
