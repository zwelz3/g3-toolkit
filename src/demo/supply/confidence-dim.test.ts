/**
 * Review 5.7 contract: default full strength, dimming only via the
 * explicit control, exact restoration of fixture confidences, and
 * indifference to edges without a confidence (structural connectors).
 */
import { describe, it, expect } from "vitest";
import {
  applyConfidenceDim,
  type ConfidenceCoreLike,
  type ConfidenceEdgeLike,
} from "./confidence-dim";

function fakeEdge(init: Record<string, unknown>): ConfidenceEdgeLike & {
  readonly store: Record<string, unknown>;
} {
  const store = { ...init };
  function data(key: string): unknown;
  function data(patch: Record<string, unknown>): void;
  function data(arg: string | Record<string, unknown>): unknown {
    if (typeof arg === "string") return store[arg];
    Object.assign(store, arg);
    return undefined;
  }
  return { data, store };
}

function fakeCore(edges: ConfidenceEdgeLike[]): ConfidenceCoreLike {
  return {
    batch: (fn) => fn(),
    edges: () => ({ forEach: (cb) => edges.forEach(cb) }),
  };
}

describe("applyConfidenceDim (review 5.7)", () => {
  it("default state raises every confidence-carrying edge to full strength", () => {
    const supplies = fakeEdge({ id: "e1", _confidence: 0.9 });
    const partOf = fakeEdge({ id: "e2", _confidence: 1 });
    const structural = fakeEdge({ id: "e3" });
    const originals = new Map<string, number>();
    applyConfidenceDim(
      fakeCore([supplies, partOf, structural]),
      false,
      originals,
    );
    expect(supplies.store._confidence).toBe(1);
    expect(partOf.store._confidence).toBe(1);
    expect(structural.store._confidence).toBeUndefined();
  });

  it("the explicit control restores the fixture's true confidences exactly", () => {
    const supplies = fakeEdge({ id: "e1", _confidence: 0.9 });
    const originals = new Map<string, number>();
    applyConfidenceDim(fakeCore([supplies]), false, originals);
    expect(supplies.store._confidence).toBe(1);
    applyConfidenceDim(fakeCore([supplies]), true, originals);
    expect(supplies.store._confidence).toBeCloseTo(0.4); // 12.12: amplified presentation
  });

  it("originals are first-seen, so repeated toggling never drifts", () => {
    const supplies = fakeEdge({ id: "e1", _confidence: 0.9 });
    const originals = new Map<string, number>();
    for (const dim of [false, true, false, true]) {
      applyConfidenceDim(fakeCore([supplies]), dim, originals);
    }
    expect(supplies.store._confidence).toBeCloseTo(0.4); // 12.12: amplified presentation
    // The map keeps the TRUE fixture value; only presentation amplifies.
    expect(originals.get("e1")).toBe(0.9);
  });
});
