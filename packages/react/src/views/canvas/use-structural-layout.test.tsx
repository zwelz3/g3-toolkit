/**
 * useStructuralLayout: the collapse-free structural layout hook (the
 * expand/collapse feature was removed by ruling 2026-07-10; the
 * behaviors tested here are the SURVIVING stability infrastructure:
 * stale-while-revalidate scene continuity and the same-input sketch).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useStructuralLayout } from "./use-structural-layout";
import type { StructuralGraphInput } from "@g3t/core";

/**
 * Set to make the next layout call reject. The real layout is used
 * everywhere else in this file, so the failure path is exercised
 * without weakening the tests that depend on real geometry.
 *
 * Reproduces the two live rejection sources: the layout engine throws,
 * or its dynamically imported chunk fails to load.
 */
let rejectNextWith: Error | null = null;

vi.mock("@g3t/core", async () => {
  const actual = await vi.importActual<typeof import("@g3t/core")>("@g3t/core");
  return {
    ...actual,
    layoutStructural: (...args: Parameters<typeof actual.layoutStructural>) => {
      if (rejectNextWith !== null) {
        const reason = rejectNextWith;
        rejectNextWith = null;
        return Promise.reject(reason);
      }
      return actual.layoutStructural(...args);
    },
  };
});

afterEach(() => {
  rejectNextWith = null;
});

const INPUT: StructuralGraphInput = {
  nodes: [
    {
      id: "boxA",
      header: { stereotype: "Block", name: "A" },
      compartments: [
        {
          id: "props",
          title: "properties",
          rows: [
            { id: "boxA.p1", text: "mass : kg" },
            { id: "boxA.p2", text: "power : W" },
          ],
        },
      ],
    },
    {
      id: "boxB",
      header: { stereotype: "Block", name: "B" },
      compartments: [
        { id: "props", rows: [{ id: "boxB.p1", text: "id : string" }] },
      ],
    },
  ],
  edges: [{ id: "e1", source: "boxA", target: "boxB" }],
};

describe("useStructuralLayout", () => {
  it("lays out the input and idles on null", async () => {
    const { result, rerender } = renderHook(
      ({ input }: { input: StructuralGraphInput | null }) =>
        useStructuralLayout(input, { direction: "DOWN" }),
      { initialProps: { input: null as StructuralGraphInput | null } },
    );
    expect(result.current.structural).toBeNull();
    rerender({ input: INPUT });
    await waitFor(() => expect(result.current.structural).not.toBeNull());
    expect(result.current.structural?.geometry.nodes["boxA"]).toBeDefined();
  });

  it("stale-while-revalidate: an options re-layout keeps the prior scene until the new geometry lands", async () => {
    const { result, rerender } = renderHook(
      ({ dir }: { dir: "DOWN" | "RIGHT" }) =>
        useStructuralLayout(INPUT, { direction: dir }),
      { initialProps: { dir: "DOWN" as "DOWN" | "RIGHT" } },
    );
    await waitFor(() => expect(result.current.structural).not.toBeNull());
    const before = result.current.structural;
    act(() => {
      rerender({ dir: "RIGHT" });
    });
    // The prior scene is STILL returned (no loading gap: the canvas
    // stays mounted and gets patched when the new geometry lands).
    expect(result.current.structural).not.toBeNull();
    await waitFor(() => {
      expect(result.current.structural).not.toBe(before);
      expect(result.current.structural).not.toBeNull();
    });
  });

  it("an input SWITCH shows loading (a stale scene from another input is never returned)", async () => {
    const other: StructuralGraphInput = {
      nodes: [
        {
          id: "solo",
          header: { stereotype: "Block", name: "S" },
          compartments: [],
        },
      ],
      edges: [],
    };
    const { result, rerender } = renderHook(
      ({ input }: { input: StructuralGraphInput }) =>
        useStructuralLayout(input, { direction: "DOWN" }),
      { initialProps: { input: INPUT } },
    );
    await waitFor(() => expect(result.current.structural).not.toBeNull());
    act(() => {
      rerender({ input: other });
    });
    // Immediately after the switch: null (never the old input's scene).
    expect(result.current.structural).toBeNull();
    await waitFor(() => {
      expect(result.current.structural?.input).toBe(other);
    });
  });
});

describe("useStructuralLayout: a failed layout is reported, not spun forever", () => {
  it("surfaces the reason instead of an eternal null scene", async () => {
    rejectNextWith = new Error("Failed to fetch dynamically imported module");
    const { result } = renderHook(() =>
      useStructuralLayout(INPUT, { direction: "DOWN" }),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toBe(
      "Failed to fetch dynamically imported module",
    );
    // Both states still read as `structural === null`, which is exactly
    // why the reason has to come out of a channel of its own.
    expect(result.current.structural).toBeNull();
  });

  it("wraps a non-Error rejection rather than handing the host a string", async () => {
    rejectNextWith = "boom" as unknown as Error;
    const { result } = renderHook(() =>
      useStructuralLayout(INPUT, { direction: "DOWN" }),
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
  });

  it("a failure belongs to the input that produced it", async () => {
    const other: StructuralGraphInput = {
      nodes: [
        {
          id: "solo",
          header: { stereotype: "Block", name: "S" },
          compartments: [],
        },
      ],
      edges: [],
    };
    rejectNextWith = new Error("engine threw");
    const { result, rerender } = renderHook(
      ({ input }: { input: StructuralGraphInput }) =>
        useStructuralLayout(input, { direction: "DOWN" }),
      { initialProps: { input: INPUT } },
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    act(() => {
      rerender({ input: other });
    });
    // Immediately after the switch: the previous input's failure is not
    // attributed to the one now laying out.
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.structural?.input).toBe(other));
    expect(result.current.error).toBeNull();
  });

  it("a later successful layout of the same input clears the error", async () => {
    rejectNextWith = new Error("engine threw");
    const { result, rerender } = renderHook(
      ({ dir }: { dir: "DOWN" | "RIGHT" }) =>
        useStructuralLayout(INPUT, { direction: dir }),
      { initialProps: { dir: "DOWN" as "DOWN" | "RIGHT" } },
    );
    await waitFor(() => expect(result.current.error).not.toBeNull());
    act(() => {
      rerender({ dir: "RIGHT" });
    });
    await waitFor(() => expect(result.current.structural).not.toBeNull());
    expect(result.current.error).toBeNull();
  });
});
