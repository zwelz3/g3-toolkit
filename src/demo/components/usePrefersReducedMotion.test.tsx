/**
 * Reduced-motion wiring (P2.2 motion slice): the hook reads and
 * live-tracks the media query, and a shell passes its negation to the
 * canvas animate prop. matchMedia is mocked (jsdom has none).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type Listener = (e: { matches: boolean }) => void;

function mockMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    addEventListener: (_: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );
  return {
    flip(matches: boolean) {
      mql.matches = matches;
      for (const fn of listeners) fn({ matches });
    },
  };
}

function Probe() {
  const reduced = usePrefersReducedMotion();
  return <div data-testid="probe">{reduced ? "reduced" : "full"}</div>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("usePrefersReducedMotion", () => {
  it("reflects the initial media state and tracks changes", () => {
    const media = mockMatchMedia(false);
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("full");
    act(() => media.flip(true));
    expect(screen.getByTestId("probe").textContent).toBe("reduced");
    act(() => media.flip(false));
    expect(screen.getByTestId("probe").textContent).toBe("full");
  });

  it("defaults to full motion when matchMedia is unavailable (jsdom)", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("full");
  });
});
