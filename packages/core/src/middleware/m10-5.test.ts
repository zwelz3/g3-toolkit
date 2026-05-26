/**
 * M10.5 tests: Middleware, RestAdapter, Event Bus.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  composeMiddleware,
  bearerAuth,
  apiKeyHeader,
  retryOnError,
  requestLogger,
  type AdapterRequest,
  type AdapterResponse,
  type Middleware,
} from "../middleware";
import { RestAdapter } from "../adapter/rest-adapter";
import { G3tEventBus } from "../event-bus";

// ── Helpers ─────────────────────────────────────────────────────────

function mockFetch(
  body: string,
  status = 200,
): (req: AdapterRequest) => Promise<AdapterResponse> {
  return vi.fn(async () => ({
    status,
    headers: { "content-type": "application/json" },
    body,
    ok: status >= 200 && status < 300,
  }));
}

// ── Middleware (M10.5.E2.T2) ────────────────────────────────────────

describe("composeMiddleware", () => {
  it("passes request through empty middleware chain", async () => {
    const base = mockFetch('{"ok":true}');
    const chain = composeMiddleware([], base);
    const req: AdapterRequest = {
      url: "http://test",
      method: "GET",
      headers: {},
    };
    const res = await chain(req);
    expect(res.body).toBe('{"ok":true}');
    expect(base).toHaveBeenCalledOnce();
  });

  it("middleware wraps the base fetch", async () => {
    const base = mockFetch('{"ok":true}');
    const log: string[] = [];
    const mw: Middleware = async (req, next) => {
      log.push("before");
      const res = await next(req);
      log.push("after");
      return res;
    };
    const chain = composeMiddleware([mw], base);
    await chain({ url: "http://test", method: "GET", headers: {} });
    expect(log).toEqual(["before", "after"]);
  });

  it("middleware chain runs in order (first wraps outermost)", async () => {
    const base = mockFetch("base");
    const log: string[] = [];
    const mwA: Middleware = async (req, next) => {
      log.push("A-before");
      const res = await next(req);
      log.push("A-after");
      return res;
    };
    const mwB: Middleware = async (req, next) => {
      log.push("B-before");
      const res = await next(req);
      log.push("B-after");
      return res;
    };
    const chain = composeMiddleware([mwA, mwB], base);
    await chain({ url: "http://test", method: "GET", headers: {} });
    expect(log).toEqual(["A-before", "B-before", "B-after", "A-after"]);
  });

  it("middleware can modify request headers", async () => {
    const base = mockFetch("ok");
    const mw: Middleware = async (req, next) => {
      return next({ ...req, headers: { ...req.headers, "X-Custom": "value" } });
    };
    const chain = composeMiddleware([mw], base);
    await chain({ url: "http://test", method: "GET", headers: {} });
    expect(base).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Custom": "value" }),
      }),
    );
  });
});

describe("bearerAuth middleware", () => {
  it("injects Authorization header with static token", async () => {
    const base = mockFetch("ok");
    const mw = bearerAuth(() => "my-token");
    const chain = composeMiddleware([mw], base);
    await chain({ url: "http://test", method: "GET", headers: {} });
    expect(base).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      }),
    );
  });

  it("supports async token getter", async () => {
    const base = mockFetch("ok");
    const mw = bearerAuth(async () => "async-token");
    const chain = composeMiddleware([mw], base);
    await chain({ url: "http://test", method: "GET", headers: {} });
    expect(base).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer async-token",
        }),
      }),
    );
  });
});

describe("apiKeyHeader middleware", () => {
  it("injects custom header", async () => {
    const base = mockFetch("ok");
    const mw = apiKeyHeader("X-Api-Key", () => "key123");
    const chain = composeMiddleware([mw], base);
    await chain({ url: "http://test", method: "GET", headers: {} });
    expect(base).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Api-Key": "key123" }),
      }),
    );
  });
});

describe("retryOnError middleware", () => {
  it("retries on 500 status", async () => {
    let callCount = 0;
    const base = vi.fn(async (): Promise<AdapterResponse> => {
      callCount++;
      if (callCount < 3)
        return { status: 500, headers: {}, body: "error", ok: false };
      return { status: 200, headers: {}, body: "ok", ok: true };
    });
    const mw = retryOnError({ maxRetries: 3, baseDelay: 1 });
    const chain = composeMiddleware([mw], base);
    const res = await chain({ url: "http://test", method: "GET", headers: {} });
    expect(res.ok).toBe(true);
    expect(callCount).toBe(3);
  });

  it("gives up after maxRetries", async () => {
    const base = vi.fn(
      async (): Promise<AdapterResponse> => ({
        status: 500,
        headers: {},
        body: "error",
        ok: false,
      }),
    );
    const mw = retryOnError({ maxRetries: 2, baseDelay: 1 });
    const chain = composeMiddleware([mw], base);
    const res = await chain({ url: "http://test", method: "GET", headers: {} });
    expect(res.ok).toBe(false);
    expect(base).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe("requestLogger middleware", () => {
  it("logs request and response", async () => {
    const base = mockFetch("ok");
    const logs: string[] = [];
    const mw = requestLogger((msg) => logs.push(msg));
    const chain = composeMiddleware([mw], base);
    await chain({ url: "http://example.com/api", method: "POST", headers: {} });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toContain("POST");
    expect(logs[0]).toContain("example.com");
    expect(logs[1]).toContain("200");
  });
});

// ── RestAdapter (M10.5.E2.T1) ───────────────────────────────────────

describe("RestAdapter", () => {
  it("queries endpoint and maps response to UGM", async () => {
    const mockResponse = JSON.stringify({
      results: {
        nodes: [
          { id: "n1", label: "Person", data: { name: "Alice" } },
          { id: "n2", label: "Org", data: { name: "Acme" } },
        ],
        edges: [{ from: "n1", to: "n2", rel: "worksAt" }],
      },
    });

    // Mock global fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => mockResponse,
    })) as unknown as typeof fetch;

    try {
      const adapter = new RestAdapter({
        url: "http://api.example.com/graph",
        mapResponse: (raw: unknown) => {
          const json = raw as {
            results: {
              nodes: Array<{
                id: string;
                label: string;
                data: Record<string, unknown>;
              }>;
              edges: Array<{ from: string; to: string; rel: string }>;
            };
          };
          return {
            nodes: json.results.nodes.map((n) => ({
              id: n.id,
              types: [n.label],
              properties: n.data as Record<string, unknown>,
            })),
            edges: json.results.edges.map((e) => ({
              source: e.from,
              target: e.to,
              type: e.rel,
            })),
          };
        },
      });

      const ugm = await adapter.query("MATCH (n) RETURN n");
      expect(ugm.nodeCount).toBe(2);
      expect(ugm.edgeCount).toBe(1);
      expect(ugm.getNode("n1")?.properties.name).toBe("Alice");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("accepts middleware for auth", async () => {
    const originalFetch = global.fetch;
    let capturedHeaders: HeadersInit | undefined;
    global.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => JSON.stringify({ nodes: [], edges: [] }),
      };
    }) as unknown as typeof fetch;

    try {
      const adapter = new RestAdapter({
        url: "http://api.example.com/graph",
        mapResponse: (raw: unknown) => {
          const json = raw as { nodes: []; edges: [] };
          return json;
        },
        middleware: [bearerAuth(() => "secret-token")],
      });

      await adapter.query("test");
      expect(capturedHeaders).toEqual(
        expect.objectContaining({ Authorization: "Bearer secret-token" }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("throws on non-OK response", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      headers: new Headers(),
      text: async () => "Forbidden",
    })) as unknown as typeof fetch;

    try {
      const adapter = new RestAdapter({
        url: "http://api.example.com/graph",
        mapResponse: () => ({ nodes: [], edges: [] }),
      });

      await expect(adapter.query("test")).rejects.toThrow("403");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// ── Event Bus (M10.5.E3.T2) ────────────────────────────────────────

describe("G3tEventBus", () => {
  let bus: G3tEventBus;

  beforeEach(() => {
    bus = new G3tEventBus();
  });

  it("emits and receives events", () => {
    const handler = vi.fn();
    bus.on("node:selected", handler);
    bus.emit("node:selected", { nodeIds: ["n1", "n2"] });
    expect(handler).toHaveBeenCalledWith({ nodeIds: ["n1", "n2"] });
  });

  it("supports multiple handlers for same event", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("theme:changed", h1);
    bus.on("theme:changed", h2);
    bus.emit("theme:changed", { themeId: "dark" });
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it("unsubscribes via returned function", () => {
    const handler = vi.fn();
    const unsub = bus.on("node:selected", handler);
    bus.emit("node:selected", { nodeIds: ["n1"] });
    expect(handler).toHaveBeenCalledOnce();

    unsub();
    bus.emit("node:selected", { nodeIds: ["n2"] });
    expect(handler).toHaveBeenCalledOnce(); // not called again
  });

  it("once fires handler exactly once", () => {
    const handler = vi.fn();
    bus.once("selection:cleared", handler);
    bus.emit("selection:cleared", {});
    bus.emit("selection:cleared", {});
    expect(handler).toHaveBeenCalledOnce();
  });

  it("off removes all handlers for an event", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("theme:changed", h1);
    bus.on("theme:changed", h2);
    bus.off("theme:changed");
    bus.emit("theme:changed", { themeId: "light" });
    expect(h1).not.toHaveBeenCalled();
  });

  it("off() with no args clears everything", () => {
    bus.on("node:selected", vi.fn());
    bus.on("theme:changed", vi.fn());
    expect(bus.listenerCount).toBe(2);
    bus.off();
    expect(bus.listenerCount).toBe(0);
  });

  it("handler errors don't break other handlers", () => {
    const h1 = vi.fn(() => {
      throw new Error("oops");
    });
    const h2 = vi.fn();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    bus.on("node:selected", h1);
    bus.on("node:selected", h2);
    bus.emit("node:selected", { nodeIds: ["n1"] });

    expect(h2).toHaveBeenCalledOnce(); // h2 still fires despite h1 error
    consoleError.mockRestore();
  });

  it("listenerCount tracks active subscriptions", () => {
    expect(bus.listenerCount).toBe(0);
    const unsub1 = bus.on("node:selected", vi.fn());
    const unsub2 = bus.on("theme:changed", vi.fn());
    expect(bus.listenerCount).toBe(2);
    unsub1();
    expect(bus.listenerCount).toBe(1);
    unsub2();
    expect(bus.listenerCount).toBe(0);
  });

  it("emitting unsubscribed event is a no-op", () => {
    // Should not throw
    bus.emit("selection:cleared", {});
  });
});
