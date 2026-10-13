/**
 * The hook's contract is about the STORE, not the hook's own state: it
 * must set exactly the ids it owns and leave every other overlay alone,
 * before, during and after. A foreign overlay registered active sits
 * in each of these tests as the witness.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOverlayStore } from "../../state/overlay-store";
import { useOverlaySequence } from "./useOverlaySequence";

const overlay = (id: string) => ({
  id,
  label: id,
  nodeIds: [`n-${id}`],
  edgeIds: [],
});
const IDS = ["info", "warning", "violation"];
const active = () => useOverlayStore.getState().activeIds;

beforeEach(() => {
  useOverlayStore.getState().clear();
  for (const id of IDS) useOverlayStore.getState().register(overlay(id), false);
  // The witness: a path overlay another part of the host owns, active.
  useOverlayStore.getState().register(overlay("path"), true);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useOverlaySequence: store writes", () => {
  it("activates step 0 on mount and never touches the foreign overlay", () => {
    expect(active()).toEqual(["path"]);
    const { result } = renderHook(() => useOverlaySequence({ ids: IDS }));
    expect(result.current.index).toBe(0);
    expect(result.current.length).toBe(3);
    expect(active()).toEqual(["path", "info"]);
  });

  it("next/prev/goTo move the index and the active set follows (single)", () => {
    const { result } = renderHook(() => useOverlaySequence({ ids: IDS }));
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    expect(active()).toEqual(["path", "warning"]);
    act(() => result.current.goTo(2));
    expect(active()).toEqual(["path", "violation"]);
    act(() => result.current.prev());
    expect(active()).toEqual(["path", "warning"]);
    // Clamped, not wrapped, without loop.
    act(() => result.current.goTo(99));
    expect(result.current.index).toBe(2);
    act(() => result.current.next());
    expect(result.current.index).toBe(2);
  });

  it("cumulative mode accumulates earlier steps", () => {
    const { result } = renderHook(() =>
      useOverlaySequence({ ids: IDS, mode: "cumulative" }),
    );
    act(() => result.current.goTo(2));
    expect(active()).toEqual(["path", "info", "warning", "violation"]);
    act(() => result.current.prev());
    expect(active()).toEqual(["path", "info", "warning"]);
  });

  it("loop wraps next and prev", () => {
    const { result } = renderHook(() =>
      useOverlaySequence({ ids: IDS, loop: true }),
    );
    act(() => result.current.prev());
    expect(result.current.index).toBe(2);
    act(() => result.current.next());
    expect(result.current.index).toBe(0);
  });

  it("a foreign toggle mid-sequence survives the next step", () => {
    const { result } = renderHook(() => useOverlaySequence({ ids: IDS }));
    act(() => useOverlayStore.getState().toggle("path")); // host turns it off
    expect(active()).toEqual(["info"]);
    act(() => result.current.next());
    expect(active()).toEqual(["warning"]);
    act(() => useOverlayStore.getState().toggle("path")); // and on again
    act(() => result.current.next());
    expect(active()).toEqual(["path", "violation"]);
  });

  it("an inline ids literal does not restart the sequence (content key)", () => {
    const { result, rerender } = renderHook(() =>
      useOverlaySequence({ ids: ["info", "warning", "violation"] }),
    );
    act(() => result.current.goTo(2));
    rerender();
    expect(result.current.index).toBe(2);
    expect(active()).toEqual(["path", "violation"]);
  });
});

describe("useOverlaySequence: hand-back", () => {
  it("unmount restores owned ids to their prior state, foreign untouched", () => {
    // 'warning' was on before the sequence took it; 'info' was not.
    useOverlayStore.getState().toggle("warning");
    expect(active()).toEqual(["path", "warning"]);
    const { result, unmount } = renderHook(() =>
      useOverlaySequence({ ids: IDS }),
    );
    expect(active()).toEqual(["path", "info"]);
    act(() => result.current.goTo(2));
    expect(active()).toEqual(["path", "violation"]);
    unmount();
    expect(active()).toEqual(["path", "warning"]);
  });

  it("unmount does not resurrect an owned id unregistered mid-sequence", () => {
    useOverlayStore.getState().toggle("warning");
    const { unmount } = renderHook(() => useOverlaySequence({ ids: IDS }));
    act(() => useOverlayStore.getState().unregister("warning"));
    unmount();
    expect(active()).toEqual(["path"]);
  });

  it("an ids change hands back the old set and takes the new one", () => {
    useOverlayStore.getState().register(overlay("phase-a"), false);
    useOverlayStore.getState().register(overlay("phase-b"), false);
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useOverlaySequence({ ids }),
      { initialProps: { ids: IDS } },
    );
    act(() => result.current.goTo(2));
    expect(active()).toEqual(["path", "violation"]);
    rerender({ ids: ["phase-a", "phase-b"] });
    // Old owned ids back to prior (all inactive); index clamped to the
    // shorter list; the new set's step is active.
    expect(result.current.index).toBe(1);
    expect(result.current.length).toBe(2);
    expect(active()).toEqual(["path", "phase-b"]);
  });

  it("an empty sequence writes nothing and is inert", () => {
    const { result } = renderHook(() => useOverlaySequence({ ids: [] }));
    expect(result.current.length).toBe(0);
    expect(result.current.index).toBe(0);
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(false);
    act(() => result.current.next());
    expect(active()).toEqual(["path"]);
  });
});

describe("useOverlaySequence: playback", () => {
  it("play advances on the interval, holds the last step once, then pauses", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useOverlaySequence({ ids: IDS, speedMs: 100 }),
    );
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.index).toBe(1);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.index).toBe(2);
    expect(result.current.isPlaying).toBe(true);
    expect(active()).toEqual(["path", "violation"]);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.index).toBe(2);
    expect(result.current.isPlaying).toBe(false);
    // Play again from the end restarts.
    act(() => result.current.play());
    expect(result.current.index).toBe(0);
  });

  it("loop keeps playing past the end", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useOverlaySequence({ ids: IDS, speedMs: 50, loop: true, autoplay: true }),
    );
    expect(result.current.isPlaying).toBe(true);
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.index).toBe(0);
    expect(result.current.isPlaying).toBe(true);
  });

  it("pause and unmount clear the interval", () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const { result, unmount } = renderHook(() =>
      useOverlaySequence({ ids: IDS, speedMs: 100, autoplay: true }),
    );
    act(() => result.current.pause());
    expect(clearSpy).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.index).toBe(0);
    act(() => result.current.play());
    unmount();
    expect(clearSpy).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    clearSpy.mockRestore();
  });

  it("a manual step while playing does not re-arm the timer", () => {
    vi.useFakeTimers();
    const setSpy = vi.spyOn(globalThis, "setInterval");
    const { result } = renderHook(() =>
      useOverlaySequence({
        ids: IDS,
        speedMs: 100,
        autoplay: true,
        loop: true,
      }),
    );
    expect(setSpy).toHaveBeenCalledTimes(1);
    act(() => result.current.next());
    expect(setSpy).toHaveBeenCalledTimes(1);
    setSpy.mockRestore();
  });
});
