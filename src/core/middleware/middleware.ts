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
 * Default base fetch using the global `fetch` API.
 */
export async function defaultFetch(
  req: AdapterRequest,
): Promise<AdapterResponse> {
  const response = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
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
}

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
 * Retry middleware with exponential backoff.
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
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await next(req);
        if (!shouldRetry(response) || attempt === maxRetries) {
          return response;
        }
        lastResponse = response;
      } catch {
        if (attempt === maxRetries) throw new Error("Max retries exceeded");
      }
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
    }
    return lastResponse!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
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
