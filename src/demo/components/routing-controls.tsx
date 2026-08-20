/**
 * Shared routing controls for demo shells.
 *
 * useRoutingControls() — state for route mode + refresh/relayout signals.
 * RoutingControlStrip — Routes select + Refresh routes + Re-layout buttons.
 *
 * Each shell passes an idPrefix so the generated data-testids stay
 * shell-specific and existing tests continue to pass unchanged.
 */
import { useState } from "react";

export type RouteMode = "direct" | "orthogonal" | "off";

export interface RoutingControlsState {
  routeMode: RouteMode;
  setRouteMode: (m: RouteMode) => void;
  routeEdgesConfig: false | { mode: "direct" | "orthogonal" };
  routeRefreshSignal: number;
  refreshRoutes: () => void;
  relayoutSignal: number;
  relayout: () => void;
}

export function useRoutingControls(defaults?: {
  mode?: RouteMode;
}): RoutingControlsState {
  const [routeMode, setRouteMode] = useState<RouteMode>(
    defaults?.mode ?? "direct",
  );
  const [routeRefreshSignal, setRouteRefreshSignal] = useState(0);
  const [relayoutSignal, setRelayoutSignal] = useState(0);

  const routeEdgesConfig: false | { mode: "direct" | "orthogonal" } =
    routeMode === "off"
      ? false
      : { mode: routeMode as "direct" | "orthogonal" };

  return {
    routeMode,
    setRouteMode,
    routeEdgesConfig,
    routeRefreshSignal,
    refreshRoutes: () => setRouteRefreshSignal((n) => n + 1),
    relayoutSignal,
    relayout: () => setRelayoutSignal((n) => n + 1),
  };
}

export interface RoutingControlStripProps {
  idPrefix: string;
  routeMode: RouteMode;
  setRouteMode: (m: RouteMode) => void;
  refreshRoutes: () => void;
  relayout: () => void;
}

const BTN: React.CSSProperties = {
  font: "inherit",
  fontSize: 11,
  padding: "3px 10px",
  border: "1px solid #7ee081",
  borderRadius: 4,
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

export function RoutingControlStrip({
  idPrefix,
  routeMode,
  setRouteMode,
  refreshRoutes,
  relayout,
}: RoutingControlStripProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <label
        style={{
          fontSize: 11,
          display: "flex",
          gap: 4,
          alignItems: "center",
        }}
      >
        Routes
        <select
          data-testid={`${idPrefix}-route-mode`}
          value={routeMode}
          onChange={(e) => setRouteMode(e.target.value as RouteMode)}
          style={{ fontSize: 11 }}
        >
          <option value="direct">Direct (auto-Z)</option>
          <option value="orthogonal">Orthogonal (always)</option>
          <option value="off">Off (bezier)</option>
        </select>
      </label>
      <button
        type="button"
        data-testid={`${idPrefix}-refresh-routes`}
        onClick={refreshRoutes}
        style={BTN}
      >
        Refresh routes
      </button>
      <button
        type="button"
        data-testid={`${idPrefix}-relayout`}
        onClick={relayout}
        style={BTN}
      >
        Re-layout
      </button>
    </span>
  );
}
