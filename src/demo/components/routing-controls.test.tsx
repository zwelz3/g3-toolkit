/**
 * Unit tests for useRoutingControls + RoutingControlStrip.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { useRoutingControls, RoutingControlStrip } from "./routing-controls";

afterEach(cleanup);

describe("useRoutingControls", () => {
  it("defaults to direct mode with correct config", () => {
    const { result } = renderHook(() => useRoutingControls());
    expect(result.current.routeMode).toBe("direct");
    expect(result.current.routeEdgesConfig).toEqual({ mode: "direct" });
  });

  it("accepts a custom default mode", () => {
    const { result } = renderHook(() =>
      useRoutingControls({ mode: "orthogonal" }),
    );
    expect(result.current.routeMode).toBe("orthogonal");
    expect(result.current.routeEdgesConfig).toEqual({ mode: "orthogonal" });
  });

  it("routeEdgesConfig is false when mode is off", () => {
    const { result } = renderHook(() => useRoutingControls({ mode: "off" }));
    expect(result.current.routeEdgesConfig).toBe(false);
  });

  it("refreshRoutes increments routeRefreshSignal", () => {
    const { result } = renderHook(() => useRoutingControls());
    const before = result.current.routeRefreshSignal;
    act(() => {
      result.current.refreshRoutes();
    });
    expect(result.current.routeRefreshSignal).toBe(before + 1);
  });

  it("relayout increments relayoutSignal", () => {
    const { result } = renderHook(() => useRoutingControls());
    const before = result.current.relayoutSignal;
    act(() => {
      result.current.relayout();
    });
    expect(result.current.relayoutSignal).toBe(before + 1);
  });
});

describe("RoutingControlStrip", () => {
  function mount(idPrefix = "test") {
    const { result } = renderHook(() => useRoutingControls());
    const { rerender } = render(
      <RoutingControlStrip
        idPrefix={idPrefix}
        routeMode={result.current.routeMode}
        setRouteMode={result.current.setRouteMode}
        refreshRoutes={result.current.refreshRoutes}
        relayout={result.current.relayout}
      />,
    );
    return { result, rerender };
  }

  it("renders select with correct testid and default value", () => {
    mount("x");
    const sel = screen.getByTestId("x-route-mode") as HTMLSelectElement;
    expect(sel.value).toBe("direct");
  });

  it("renders refresh-routes and relayout buttons with correct testids", () => {
    mount("x");
    expect(screen.getByTestId("x-refresh-routes")).toBeTruthy();
    expect(screen.getByTestId("x-relayout")).toBeTruthy();
  });

  it("changing select to orthogonal calls setRouteMode", () => {
    const { result } = renderHook(() => useRoutingControls());
    render(
      <RoutingControlStrip
        idPrefix="y"
        routeMode={result.current.routeMode}
        setRouteMode={result.current.setRouteMode}
        refreshRoutes={result.current.refreshRoutes}
        relayout={result.current.relayout}
      />,
    );
    fireEvent.change(screen.getByTestId("y-route-mode"), {
      target: { value: "orthogonal" },
    });
    expect(result.current.routeMode).toBe("orthogonal");
  });

  it("clicking refresh-routes calls refreshRoutes", () => {
    const { result } = renderHook(() => useRoutingControls());
    render(
      <RoutingControlStrip
        idPrefix="z"
        routeMode={result.current.routeMode}
        setRouteMode={result.current.setRouteMode}
        refreshRoutes={result.current.refreshRoutes}
        relayout={result.current.relayout}
      />,
    );
    const before = result.current.routeRefreshSignal;
    fireEvent.click(screen.getByTestId("z-refresh-routes"));
    expect(result.current.routeRefreshSignal).toBe(before + 1);
  });

  it("clicking relayout calls relayout", () => {
    const { result } = renderHook(() => useRoutingControls());
    render(
      <RoutingControlStrip
        idPrefix="z"
        routeMode={result.current.routeMode}
        setRouteMode={result.current.setRouteMode}
        refreshRoutes={result.current.refreshRoutes}
        relayout={result.current.relayout}
      />,
    );
    const before = result.current.relayoutSignal;
    fireEvent.click(screen.getByTestId("z-relayout"));
    expect(result.current.relayoutSignal).toBe(before + 1);
  });
});
