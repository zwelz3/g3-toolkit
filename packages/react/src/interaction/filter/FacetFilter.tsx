/**
 * FacetFilter: toggleable filter by node type (M1.E3.T4).
 *
 * Lists unique node types from the UGM property-key registry.
 * Toggling a type hides/shows nodes of that type. Hidden nodes
 * are removed from the Cytoscape canvas but NOT from the UGM.
 *
 * @see specs/02-functional-interaction.md R2.7
 */

import { useState, useMemo, useCallback } from "react";
import type { UGM } from "@g3t/core";
import { OKABE_ITO_COLORS } from "../../views/canvas/palette";

export interface FacetFilterProps {
  ugm: UGM;
  /** Called when the visible types change. */
  onFilterChange: (hiddenTypes: Set<string>) => void;
  className?: string;
}

export function FacetFilter({
  ugm,
  onFilterChange,
  className,
}: FacetFilterProps) {
  const types = useMemo(() => {
    const registry = ugm.getRegistry();
    return [...registry.nodeTypes].sort();
  }, [ugm]);

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  const toggleType = useCallback(
    (type: string) => {
      setHiddenTypes((prev) => {
        const next = new Set(prev);
        if (next.has(type)) {
          next.delete(type);
        } else {
          next.add(type);
        }
        onFilterChange(next);
        return next;
      });
    },
    [onFilterChange],
  );

  // Count nodes per type
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    ugm.forEachNode((_id, attrs) => {
      for (const t of attrs.types) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    });
    return counts;
  }, [ugm]);

  return (
    <div
      className={className}
      data-testid="facet-filter"
      style={{ padding: "8px 0" }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 13,
          padding: "0 8px 4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Node Types</span>
        <span style={{ display: "flex", gap: 4 }}>
          <button
            data-testid="facet-select-all"
            className="g3t-btn g3t-btn-ghost"
            onClick={() => {
              setHiddenTypes(new Set());
              onFilterChange(new Set());
            }}
            style={{ fontSize: 10, padding: "1px 4px" }}
          >
            All
          </button>
          <button
            data-testid="facet-clear-all"
            className="g3t-btn g3t-btn-ghost"
            onClick={() => {
              const all = new Set(types);
              setHiddenTypes(all);
              onFilterChange(all);
            }}
            style={{ fontSize: 10, padding: "1px 4px" }}
          >
            None
          </button>
        </span>
      </div>
      {types.map((type, idx) => {
        const hidden = hiddenTypes.has(type);
        const count = typeCounts.get(type) ?? 0;
        const color = OKABE_ITO_COLORS[idx % OKABE_ITO_COLORS.length] ?? "#999";

        return (
          <label
            key={type}
            data-testid={`facet-${type}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "2px 8px",
              fontSize: 13,
              opacity: hidden ? 0.5 : 1,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={!hidden}
              onChange={() => toggleType(type)}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: color,
                display: "inline-block",
              }}
            />
            <span>
              {type} ({count})
            </span>
          </label>
        );
      })}
    </div>
  );
}
