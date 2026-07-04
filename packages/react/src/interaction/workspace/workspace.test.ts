/**
 * Workspace snapshot tests (slice 1, round 19): capture/apply
 * round-trip, version guard, and the reserved-channel guard riding
 * along through parseEncodingSpec.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Core } from "cytoscape";
import { usePositionPinStore } from "../../state/position-pin-store";
import { useThemeStore } from "../../theme/ThemeManager";
import {
  captureWorkspace,
  applyWorkspace,
  serializeWorkspace,
  parseWorkspace,
} from "./workspace";
import { DEFAULT_SPEC } from "../encoding/encoding-spec";

beforeEach(() => {
  usePositionPinStore.setState({ pinnedIds: [], allPinned: false });
});

function mockCy(positions: Record<string, { x: number; y: number }>) {
  const written: Record<string, { x: number; y: number }> = {};
  const unlocked: string[] = [];
  const nodes = Object.entries(positions).map(([id, pos]) => ({
    id: () => id,
    position: vi.fn((next?: { x: number; y: number }) => {
      if (next) written[id] = next;
      return pos;
    }),
    unlock: vi.fn(() => unlocked.push(id)),
    nonempty: (): boolean => true,
  }));
  const cy = {
    nodes: vi.fn(() => ({
      forEach: (fn: (n: (typeof nodes)[number]) => void) => nodes.forEach(fn),
    })),
    getElementById: vi.fn(
      (id: string) =>
        nodes.find((n) => n.id() === id) ?? { nonempty: (): boolean => false },
    ),
    batch: vi.fn((fn: () => void) => fn()),
  };
  return { cy: cy as unknown as Core, written, unlocked };
}

describe("workspace snapshot (slice 1)", () => {
  it("captures positions, pins, spec, and theme", () => {
    const { cy } = mockCy({ a: { x: 10, y: 20 }, b: { x: 30, y: 40 } });
    usePositionPinStore.setState({ pinnedIds: ["a"], allPinned: false });
    const snap = captureWorkspace({ cy, spec: DEFAULT_SPEC });
    expect(snap.positions).toEqual({
      a: { x: 10, y: 20 },
      b: { x: 30, y: 40 },
    });
    expect(snap.pinnedIds).toEqual(["a"]);
    expect(snap.encodingSpec).toEqual(DEFAULT_SPEC);
    expect(snap.themeId).toBe(useThemeStore.getState().theme.id);
  });

  it("applies positions (unlocking first), pins, and spec through their owners", () => {
    const { cy, written, unlocked } = mockCy({
      a: { x: 0, y: 0 },
      b: { x: 0, y: 0 },
    });
    const setSpec = vi.fn();
    applyWorkspace(
      {
        version: 1,
        encodingSpec: DEFAULT_SPEC,
        positions: { a: { x: 5, y: 6 }, ghost: { x: 1, y: 1 } },
        pinnedIds: ["a"],
        allPinned: false,
      },
      { cy, setSpec },
    );
    expect(written["a"]).toEqual({ x: 5, y: 6 });
    expect(unlocked).toContain("a");
    expect(usePositionPinStore.getState().pinnedIds).toEqual(["a"]);
    expect(setSpec).toHaveBeenCalledWith(DEFAULT_SPEC);
  });

  it("round-trips through serialize/parse", () => {
    const { cy } = mockCy({ a: { x: 1.5, y: -2 } });
    usePositionPinStore.setState({ pinnedIds: ["a"], allPinned: true });
    const snap = captureWorkspace({ cy, spec: DEFAULT_SPEC });
    const back = parseWorkspace(serializeWorkspace(snap));
    expect(back).toEqual(snap);
  });

  it("rejects unsupported versions on parse and apply", () => {
    expect(() => parseWorkspace('{"version": 2}')).toThrow(/version 2/);
    expect(() =>
      applyWorkspace(
        { version: 2 } as unknown as Parameters<typeof applyWorkspace>[0],
        { cy: null },
      ),
    ).toThrow(/version 2/);
  });

  it("the reserved-channel guard rides along through the spec parser", () => {
    const hostile = JSON.stringify({
      version: 1,
      positions: {},
      pinnedIds: [],
      allPinned: false,
      encodingSpec: {
        version: 1,
        node: {},
        edge: {},
        effects: { accent: { driver: "confidence" } },
      },
    });
    expect(() => parseWorkspace(hostile)).toThrow(/selection/);
  });
});
