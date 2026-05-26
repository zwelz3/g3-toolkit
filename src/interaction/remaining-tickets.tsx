/**
 * Remaining M12 + M13 components.
 *
 * M12.E2.T3: "Edit Appearance" context menu registration.
 * M12.E4.T1: Multi-selection context menu items.
 * M12.E4.T2: Bulk style application.
 * M13.E2.T2: Temporal range filter slider.
 * M13.E3.T2: Derived property definition UI.
 */

// R2.11: Export/reporting via serializeOverrides (partial).
// R2.12: Data entry/curation (planned; inline editing not yet implemented).
// R2.15: Investigation bookmarks (planned via workspace save/load).

import { useState, useCallback, useMemo } from "react";
import type { UGM } from "@core/ugm";
import type { ContextMenuManager } from "@interaction/context-menu";
import type { MenuTarget } from "@interaction/context-menu";
import type { NodeStyleOverride } from "@core/style-override/style-override";
import { useStyleOverrideStore } from "@state/style-override-store";
import {
  DerivedPropertyEngine,
  type DerivedProperty,
} from "@core/advanced/advanced";

// ── Edit Appearance Registration (M12.E2.T3) ────────────────────────

/**
 * Register "Edit Appearance" in the context menu.
 * The onEdit callback should open the NodeStyleEditor panel.
 */
export function registerEditAppearance(
  manager: ContextMenuManager,
  onEdit: (nodeId: string) => void,
): void {
  manager.register("style-override", [
    {
      id: "edit-appearance",
      label: "Edit Appearance",
      icon: "◉",
      filter: (target: MenuTarget) => target.type === "node",
      action: (target: MenuTarget) => {
        if (target.id) onEdit(target.id);
      },
      separator: true,
    },
  ]);
}

// ── Multi-Selection Context Menu (M12.E4.T1) ────────────────────────

/**
 * Register multi-selection menu items.
 * These appear when 2+ nodes are selected and the user right-clicks.
 */
export function registerMultiSelectMenu(
  manager: ContextMenuManager,
  callbacks: {
    onBulkColor?: (nodeIds: string[], color: string) => void;
    onBulkHide?: (nodeIds: string[]) => void;
    onShowOnly?: (nodeIds: string[]) => void;
    getSelectedIds: () => string[];
  },
): void {
  manager.register("multi-select", [
    {
      id: "bulk-set-color-red",
      label: "Set Color → Red",
      icon: "🔴",
      filter: () => callbacks.getSelectedIds().length > 1,
      action: () => {
        const ids = callbacks.getSelectedIds();
        callbacks.onBulkColor?.(ids, "#ef4444");
      },
    },
    {
      id: "bulk-set-color-blue",
      label: "Set Color → Blue",
      icon: "🔵",
      filter: () => callbacks.getSelectedIds().length > 1,
      action: () => {
        const ids = callbacks.getSelectedIds();
        callbacks.onBulkColor?.(ids, "#3b82f6");
      },
    },
    {
      id: "bulk-hide",
      label: "Hide Selected",
      filter: () => callbacks.getSelectedIds().length > 1,
      action: () => {
        callbacks.onBulkHide?.(callbacks.getSelectedIds());
      },
      separator: true,
    },
    {
      id: "show-only-selected",
      label: "Show Only Selected",
      filter: () => callbacks.getSelectedIds().length > 1,
      action: () => {
        callbacks.onShowOnly?.(callbacks.getSelectedIds());
      },
    },
  ]);
}

// ── Bulk Style Application (M12.E4.T2) ──────────────────────────────

/**
 * Apply a style override to multiple nodes at once.
 * Creates individual NodeStyleOverride entries for each node.
 */
export function applyBulkStyle(
  nodeIds: string[],
  style: Omit<NodeStyleOverride, "scope">,
): void {
  const { add } = useStyleOverrideStore.getState();
  for (const nodeId of nodeIds) {
    add({ ...style, scope: { nodeId } });
  }
}

// ── Temporal Range Filter (M13.E2.T2) ───────────────────────────────

export interface TemporalRangeFilterProps {
  ugm: UGM;
  timeProperty: string;
  onChange: (range: { min: number; max: number }) => void;
  className?: string;
}

// @see R2.10: temporal playback support
export function TemporalRangeFilter({
  ugm,
  timeProperty,
  onChange,
  className,
}: TemporalRangeFilterProps) {
  // Memoize time range to avoid recomputing on every render
  const { globalMin, globalMax } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    ugm.forEachNode((_id, attrs) => {
      const raw = attrs.properties[timeProperty];
      if (raw === undefined || raw === null) return;
      const t = typeof raw === "number" ? raw : new Date(String(raw)).getTime();
      if (!isNaN(t)) {
        if (t < mn) mn = t;
        if (t > mx) mx = t;
      }
    });
    return {
      globalMin: isFinite(mn) ? mn : 0,
      globalMax: isFinite(mx) ? mx : Date.now(),
    };
  }, [ugm, timeProperty]);

  const [min, setMin] = useState(globalMin);
  const [max, setMax] = useState(globalMax);

  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setMin(v);
      onChange({ min: v, max });
    },
    [max, onChange],
  );

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setMax(v);
      onChange({ min, max: v });
    },
    [min, onChange],
  );

  const formatDate = (ts: number) => {
    try {
      return new Date(ts).toLocaleDateString();
    } catch {
      return String(ts);
    }
  };

  return (
    <div
      data-testid="temporal-range-filter"
      className={className}
      style={{ fontSize: "var(--g3t-font-sm, 12px)" }}
    >
      <div className="g3t-panel-title">Time Range</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: "var(--g3t-text-muted)", fontSize: 10 }}>
          {formatDate(min)}
        </span>
        <input
          data-testid="temporal-min"
          type="range"
          min={globalMin}
          max={globalMax}
          value={min}
          onChange={handleMinChange}
          style={{ flex: 1 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: "var(--g3t-text-muted)", fontSize: 10 }}>
          {formatDate(max)}
        </span>
        <input
          data-testid="temporal-max"
          type="range"
          min={globalMin}
          max={globalMax}
          value={max}
          onChange={handleMaxChange}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  );
}

// ── Derived Property UI (M13.E3.T2) ─────────────────────────────────

export interface DerivedPropertyPanelProps {
  ugm: UGM;
  engine: DerivedPropertyEngine;
  onCompute: () => void;
  className?: string;
}

export function DerivedPropertyPanel({
  ugm,
  engine,
  onCompute,
  className,
}: DerivedPropertyPanelProps) {
  const [name, setName] = useState("");
  const [expression, setExpression] = useState("");

  const registry = ugm.getRegistry();
  const numericKeys = [...registry.nodePropertyKeys];

  const handleDefine = useCallback(() => {
    if (!name.trim() || !expression.trim()) return;
    engine.define({
      name: name.trim(),
      expression: expression.trim(),
      reactive: false,
    });
    engine.compute(ugm);
    onCompute();
    setName("");
    setExpression("");
  }, [name, expression, engine, ugm, onCompute]);

  const definitions = engine.getDefinitions();

  return (
    <div
      data-testid="derived-property-panel"
      className={className}
      style={{ fontSize: "var(--g3t-font-sm, 12px)" }}
    >
      <div className="g3t-panel-title">Derived Properties</div>

      {/* Existing definitions */}
      {definitions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {definitions.map((d) => (
            <div
              key={d.name}
              data-testid={`derived-${d.name}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "2px 0",
                color: "var(--g3t-text-secondary)",
              }}
            >
              <span>
                <strong>{d.name}</strong> = {d.expression}
              </span>
              <button
                className="g3t-btn g3t-btn-ghost"
                onClick={() => {
                  engine.remove(d.name);
                  onCompute();
                }}
                style={{ fontSize: 12, padding: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New definition form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <input
          data-testid="derived-name-input"
          className="g3t-input"
          placeholder="Property name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ fontSize: 11 }}
        />
        <input
          data-testid="derived-expression-input"
          className="g3t-input g3t-input-mono"
          placeholder={`Expression (e.g., ${numericKeys[0] ?? "x"} * 2)`}
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          style={{ fontSize: 11 }}
        />
        <button
          data-testid="derived-compute"
          className="g3t-btn g3t-btn-active"
          onClick={handleDefine}
          style={{ fontSize: 11 }}
        >
          Compute
        </button>
      </div>
    </div>
  );
}
