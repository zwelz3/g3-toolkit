/**
 * Request hygiene for the remote adapters: timeouts, cancellation,
 * preserved server error bodies, and preserved retry causes.
 *
 * Each block below pins a defect that was reachable before this suite
 * existed, so a regression reads as a named failure rather than as a
 * silent loss of diagnostics.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AdapterHttpError,
  MAX_ERROR_BODY_CHARS,
  assertOk,
} from "./adapter-error";
import {
  createDefaultFetch,
  retryOnError,
  composeMiddleware,
  AdapterTimeoutError,
  RetryExhaustedError,
  DEFAULT_TIMEOUT_MS,
  type AdapterResponse,
} from "../middleware/middleware";
import { SparqlAdapter } from "./sparql-adapter";
import { CypherAdapter } from "./cypher-adapter";
import { GremlinAdapter } from "./gremlin-adapter";
import { RestAdapter } from "./rest-adapter";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A fetch-shaped response with the body and status a test wants. */
function httpResponse(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => body,
  };
}

// ── The error body survives ─────────────────────────────────────────

describe("AdapterHttpError", () => {
  it("carries status, url and body, and puts the body in the message", () => {
    const err = new AdapterHttpError({
      adapter: "SPARQL",
      status: 400,
      url: "http://store/sparql",
      body: "Lexical error at line 3, column 12. Encountered: '}'",
    });

    expect(err.name).toBe("AdapterHttpError");
    expect(err.code).toBe("ADAPTER_HTTP_ERROR");
    expect(err.status).toBe(400);
    expect(err.url).toBe("http://store/sparql");
    expect(err.body).toContain("Lexical error at line 3");
    expect(err.bodyTruncated).toBe(false);
    // A host that logs only `err.message` is the common case, so the
    // diagnostic has to be there and not only on a property.
    expect(err.message).toContain("400");
    expect(err.message).toContain("http://store/sparql");
    expect(err.message).toContain("Lexical error at line 3");
  });

  it("truncates a long body and says so", () => {
    const err = new AdapterHttpError({
      adapter: "REST",
      status: 502,
      url: "http://api/graph",
      body: "x".repeat(MAX_ERROR_BODY_CHARS + 500),
    });

    expect(err.body).toHaveLength(MAX_ERROR_BODY_CHARS);
    expect(err.bodyTruncated).toBe(true);
    expect(err.message).toContain("[truncated]");
  });

  it("says the body was empty rather than trailing a bare colon", () => {
    const err = new AdapterHttpError({
      adapter: "Gremlin",
      status: 503,
      url: "http://g/gremlin",
      body: "   ",
    });
    expect(err.message).toContain("empty response body");
  });

  it("assertOk passes a 2xx through and throws otherwise", () => {
    const ok: AdapterResponse = {
      status: 200,
      headers: {},
      body: "{}",
      ok: true,
    };
    expect(() => assertOk("REST", "http://api", ok)).not.toThrow();

    const bad: AdapterResponse = {
      status: 500,
      headers: {},
      body: "boom",
      ok: false,
    };
    expect(() => assertOk("REST", "http://api", bad)).toThrow(AdapterHttpError);
  });
});

describe("every remote adapter reports the server's error body", () => {
  const BODY = "MalformedQueryException: unexpected token at offset 41";

  it("SparqlAdapter", async () => {
    const adapter = new SparqlAdapter("http://store/sparql", undefined, {
      middleware: [async (req, next) => next(req)],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => httpResponse(400, BODY)),
    );
    await expect(adapter.query("SELECT")).rejects.toThrow(AdapterHttpError);
    await expect(adapter.query("SELECT")).rejects.toThrow(BODY);
  });

  it("CypherAdapter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => httpResponse(401, BODY)),
    );
    const adapter = new CypherAdapter("http://neo/tx");
    await expect(adapter.query("MATCH (n) RETURN n")).rejects.toThrow(BODY);
  });

  it("GremlinAdapter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => httpResponse(500, BODY)),
    );
    const adapter = new GremlinAdapter({ endpoint: "http://g/gremlin" });
    await expect(adapter.query("g.V()")).rejects.toThrow(BODY);
  });

  it("RestAdapter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => httpResponse(422, BODY)),
    );
    const adapter = new RestAdapter({
      url: "http://api/graph",
      mapResponse: () => ({ nodes: [], edges: [] }),
    });
    await expect(adapter.query("{}")).rejects.toThrow(BODY);
  });
});

// ── Timeout and cancellation ────────────────────────────────────────

describe("createDefaultFetch timeout", () => {
  it("rejects with AdapterTimeoutError when the endpoint never answers", async () => {
    // A fetch that resolves only on abort is exactly the hang this
    // defends against: before the timeout the promise stayed pending
    // with nothing to catch.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      ),
    );

    const boundFetch = createDefaultFetch({ timeoutMs: 20 });
    const err = await boundFetch({
      url: "http://slow/sparql",
      method: "POST",
      headers: {},
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AdapterTimeoutError);
    expect((err as AdapterTimeoutError).timedOut).toBe(true);
    expect((err as AdapterTimeoutError).timeoutMs).toBe(20);
    expect((err as AdapterTimeoutError).url).toBe("http://slow/sparql");
  });

  it("distinguishes a caller abort from a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      ),
    );

    const controller = new AbortController();
    const boundFetch = createDefaultFetch({ timeoutMs: 10_000 });
    const pending = boundFetch({
      url: "http://slow/sparql",
      method: "POST",
      headers: {},
      signal: controller.signal,
    }).catch((e: unknown) => e);

    controller.abort();
    const err = await pending;

    expect(err).toBeInstanceOf(AdapterTimeoutError);
    // The distinction is the whole point: a user navigating away is
    // not an incident, a hung endpoint is.
    expect((err as AdapterTimeoutError).timedOut).toBe(false);
  });

  it("honors a signal that is already aborted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () =>
              reject(new Error("aborted")),
            );
          }),
      ),
    );

    const controller = new AbortController();
    controller.abort();

    const err = await createDefaultFetch({ timeoutMs: 10_000 })({
      url: "http://slow/sparql",
      method: "POST",
      headers: {},
      signal: controller.signal,
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AdapterTimeoutError);
    expect((err as AdapterTimeoutError).timedOut).toBe(false);
  });

  it("removes its abort listener so a reused signal does not leak", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => httpResponse(200, "{}")),
    );

    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const boundFetch = createDefaultFetch({ timeoutMs: 1000 });

    for (let i = 0; i < 3; i++) {
      await boundFetch({
        url: "http://api",
        method: "GET",
        headers: {},
        signal: controller.signal,
      });
    }

    // One long-lived signal across many requests is the normal host
    // pattern (one controller per view). Without the cleanup this
    // accumulates a listener per request.
    expect(remove).toHaveBeenCalledTimes(3);
  });

  it("timeoutMs: 0 disables the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => httpResponse(200, "{}")),
    );

    const res = await createDefaultFetch({ timeoutMs: 0 })({
      url: "http://api",
      method: "GET",
      headers: {},
    });

    expect(res.ok).toBe(true);
    // No timer was scheduled, so there is nothing pending to run.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("the default is 30 seconds", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
  });

  it("passes a non-abort transport error through unchanged", async () => {
    const network = new TypeError("Failed to fetch");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(network)),
    );

    const err = await createDefaultFetch({ timeoutMs: 1000 })({
      url: "http://api",
      method: "GET",
      headers: {},
    }).catch((e: unknown) => e);

    expect(err).toBe(network);
  });
});

// ── Retry keeps its cause ───────────────────────────────────────────

describe("retryOnError", () => {
  it("wraps the last thrown error as the cause instead of discarding it", async () => {
    const underlying = new Error("ECONNREFUSED 10.0.0.4:7474");
    const base = vi.fn(() => Promise.reject(underlying));
    const chain = composeMiddleware(
      [retryOnError({ maxRetries: 2, baseDelay: 1 })],
      base,
    );

    const err = await chain({
      url: "http://neo/tx",
      method: "POST",
      headers: {},
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(RetryExhaustedError);
    expect((err as RetryExhaustedError).attempts).toBe(3);
    // The old implementation threw a bare "Max retries exceeded" from
    // an empty catch, so this was unrecoverable.
    expect((err as RetryExhaustedError).cause).toBe(underlying);
    expect(base).toHaveBeenCalledTimes(3);
  });

  it("does not retry a timeout", async () => {
    const base = vi.fn(() =>
      Promise.reject(
        new AdapterTimeoutError({
          url: "http://slow",
          timedOut: true,
          timeoutMs: 30_000,
        }),
      ),
    );
    const chain = composeMiddleware(
      [retryOnError({ maxRetries: 3, baseDelay: 1 })],
      base,
    );

    const err = await chain({
      url: "http://slow",
      method: "GET",
      headers: {},
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AdapterTimeoutError);
    // Retrying three times over a 30 s timeout is two minutes of a
    // hung spinner, which is worse than the hang the timeout replaced.
    expect(base).toHaveBeenCalledTimes(1);
  });

  it("does not retry a caller cancellation either", async () => {
    const base = vi.fn(() =>
      Promise.reject(
        new AdapterTimeoutError({
          url: "http://api",
          timedOut: false,
          timeoutMs: 30_000,
        }),
      ),
    );
    const chain = composeMiddleware(
      [retryOnError({ maxRetries: 3, baseDelay: 1 })],
      base,
    );

    await chain({ url: "http://api", method: "GET", headers: {} }).catch(
      () => undefined,
    );
    expect(base).toHaveBeenCalledTimes(1);
  });
});
