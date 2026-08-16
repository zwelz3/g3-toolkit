/**
 * The store channel's uniformity, asserted as a contract.
 *
 * Exported zustand stores are one of the three declared
 * host-integration channels, and they had drifted apart in ways no gate
 * could see: six stores called their reset `clear` and the
 * seventh called it `clearSelection`, four of the seven state types
 * were unexported so a host could subscribe but not write a typed
 * selector, and `setTheme` with an unknown id did nothing at all and
 * said nothing about it.
 *
 * A new store that skips any of this fails here rather than reaching an
 * adopter, which is the point: the drift was invisible precisely
 * because every store was individually reasonable.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { useSelectionStore } from "./selection-store";
import { useStyleOverrideStore } from "./style-override-store";
import { usePositionPinStore } from "./position-pin-store";
import { useOverlayStore } from "./overlay-store";
import { useInspectorSectionStore } from "./inspector-section-store";
import { useEmphasisStore } from "./emphasis-store";
import { useThemeStore, THEME_PRESETS } from "../theme/ThemeManager";

/**
 * A store whose state carries the uniform reset.
 *
 * Typing STORES with this makes the convention a COMPILE-TIME
 * constraint as well as a runtime one: a new store added to the list
 * without a `clear()` fails to build, which is a better place to find
 * out than a test run.
 */
type ResettableStore = { getState: () => { clear: () => void } };

/** Every store a host can reach, by the name it is exported under. */
const STORES: ReadonlyArray<readonly [string, ResettableStore]> = [
  ["useSelectionStore", useSelectionStore],
  ["useStyleOverrideStore", useStyleOverrideStore],
  ["usePositionPinStore", usePositionPinStore],
  ["useOverlayStore", useOverlayStore],
  ["useInspectorSectionStore", useInspectorSectionStore],
  ["useEmphasisStore", useEmphasisStore],
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("one reset name across the channel", () => {
  for (const [name, store] of STORES) {
    it(`${name} exposes clear()`, () => {
      // The type above already requires this; the runtime assertion
      // catches a store added through an `as` escape hatch.
      expect(typeof store.getState().clear).toBe("function");
    });
  }

  it("clearSelection still works and delegates to clear", () => {
    // The alias is deprecated, not removed: renaming outright would
    // break every host using the most-documented store in the library.
    useSelectionStore.getState().selectNodes(["a", "b"]);
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(2);

    useSelectionStore.getState().clearSelection();
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);
  });

  it("clear() empties both node and edge selections", () => {
    useSelectionStore.getState().selectNodes(["a"]);
    useSelectionStore.getState().selectEdges(["e1"]);
    useSelectionStore.getState().clear();
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0);
    expect(useSelectionStore.getState().selectedEdgeIds.size).toBe(0);
  });
});

describe("selection collections are handed out read-only", () => {
  it("the actions still produce working sets", () => {
    useSelectionStore.getState().clear();
    useSelectionStore.getState().selectNodes(["a", "b"]);
    const { selectedNodeIds } = useSelectionStore.getState();
    // ReadonlySet is a compile-time narrowing, so `has` and `size`
    // work exactly as before. Nothing changed at runtime for a host
    // that was already going through the actions, which is why this is
    // not a breaking change.
    expect(selectedNodeIds.has("a")).toBe(true);
    expect([...selectedNodeIds]).toEqual(["a", "b"]);
  });

  it("mutating a handed-out set does not notify subscribers", () => {
    // This is the failure the type now prevents at compile time, shown
    // here so the reason is on record rather than asserted abstractly.
    useSelectionStore.getState().clear();
    useSelectionStore.getState().selectNodes(["a"]);

    let notifications = 0;
    const unsubscribe = useSelectionStore.subscribe(() => {
      notifications++;
    });

    const smuggled = useSelectionStore.getState()
      .selectedNodeIds as Set<string>;
    smuggled.add("b");

    expect(smuggled.has("b")).toBe(true);
    // The store changed and nobody was told. A canvas subscribed here
    // would render a selection that no longer matches the store.
    expect(notifications).toBe(0);

    unsubscribe();
    useSelectionStore.getState().clear();
  });
});

describe("setTheme reports an id it cannot honor", () => {
  it("applies a known preset", () => {
    const known = Object.keys(THEME_PRESETS)[0];
    expect(known).toBeDefined();
    useThemeStore.getState().setTheme(known as string);
    expect(useThemeStore.getState().theme).toBe(THEME_PRESETS[known as string]);
  });

  it("warns and keeps the current theme on an unknown id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const before = useThemeStore.getState().theme;

    useThemeStore.getState().setTheme("no-such-theme");

    expect(useThemeStore.getState().theme).toBe(before);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    // The message has to be actionable: the bad id, the valid ones, and
    // the way to register one of your own.
    expect(message).toContain("no-such-theme");
    expect(message).toContain(Object.keys(THEME_PRESETS)[0] as string);
    expect(message).toContain("setCustomTheme");
  });

  it("does not throw, because a bad theme id must not take down a render", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => useThemeStore.getState().setTheme("nope")).not.toThrow();
  });
});
