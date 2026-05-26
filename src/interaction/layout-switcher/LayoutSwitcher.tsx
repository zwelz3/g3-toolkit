/**
 * LayoutSwitcher: UI for switching between layout engines (M2.E3.T1)
 * and pin/unpin state management (M2.E3.T2).
 *
 * @see specs/02-functional-interaction.md R2.9
 */

import { useState, useCallback } from "react";
import type { LayoutEngine, Position } from "@core/layout";

export interface PinState {
  /** Pinned node positions. */
  pinned: Map<string, Position>;
  /** Pin a node at its current position. */
  pin: (nodeId: string, position: Position) => void;
  /** Unpin a node. */
  unpin: (nodeId: string) => void;
  /** Check if a node is pinned. */
  isPinned: (nodeId: string) => boolean;
}

/** Hook for managing pin state. */
export function usePinState(): PinState {
  const [pinned, setPinned] = useState<Map<string, Position>>(new Map());

  const pin = useCallback((nodeId: string, position: Position) => {
    setPinned((prev) => {
      const next = new Map(prev);
      next.set(nodeId, position);
      return next;
    });
  }, []);

  const unpin = useCallback((nodeId: string) => {
    setPinned((prev) => {
      const next = new Map(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  const isPinned = useCallback(
    (nodeId: string) => pinned.has(nodeId),
    [pinned],
  );

  return { pinned, pin, unpin, isPinned };
}

export interface LayoutSwitcherProps {
  /** Available layout engines. */
  engines: LayoutEngine[];
  /** Currently active engine ID. */
  activeId: string;
  /** Called when the user selects a different engine. */
  onSwitch: (engineId: string) => void;
  className?: string;
}

export function LayoutSwitcher({
  engines,
  activeId,
  onSwitch,
  className,
}: LayoutSwitcherProps) {
  return (
    <div
      className={className}
      data-testid="layout-switcher"
      style={{
        display: "flex",
        gap: 4,
        padding: "4px 8px",
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 600, marginRight: 4 }}>Layout:</span>
      {engines.map((engine) => (
        <button
          key={engine.id}
          data-testid={`layout-btn-${engine.id}`}
          onClick={() => onSwitch(engine.id)}
          style={{
            padding: "2px 8px",
            border: "1px solid #ccc",
            borderRadius: 4,
            background: engine.id === activeId ? "#2563eb" : "white",
            color: engine.id === activeId ? "white" : "#333",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {engine.name}
        </button>
      ))}
    </div>
  );
}
