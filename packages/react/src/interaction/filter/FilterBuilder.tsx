/**
 * FilterBuilder: visual property filter builder (M11.E3.T2).
 *
 * Renders a list of filter conditions with property dropdown,
 * operator selector, value input, and AND/OR toggle. Calls
 * evaluateFilter and passes the matching node IDs to a callback.
 */

import { useState, useCallback } from "react";
import type { UGM } from "@g3t/core";
import {
  evaluateFilter,
  type FilterGroup,
  type PropertyFilter,
} from "@g3t/core";

// ── FilterBuilder (M11.E3.T2) ───────────────────────────────────────

export interface FilterBuilderProps {
  ugm: UGM;
  onApply: (matchingNodeIds: Set<string>) => void;
  className?: string;
}

const OPERATORS: Array<{ value: PropertyFilter["operator"]; label: string }> = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "contains", label: "contains" },
  { value: "exists", label: "exists" },
];

interface FilterRow {
  id: number;
  key: string;
  operator: PropertyFilter["operator"];
  value: string;
}

export function FilterBuilder({ ugm, onApply, className }: FilterBuilderProps) {
  const [rows, setRows] = useState<FilterRow[]>([
    { id: 1, key: "", operator: "gt", value: "" },
  ]);
  const [logic, setLogic] = useState<"and" | "or">("and");

  const registry = ugm.getRegistry();
  const propKeys = [...registry.nodePropertyKeys];

  const addRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      { id: Date.now(), key: "", operator: "gt", value: "" },
    ]);
  }, []);

  const removeRow = useCallback((id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateRow = useCallback((id: number, patch: Partial<FilterRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const handleApply = useCallback(() => {
    const filters: PropertyFilter[] = rows
      .filter((r) => r.key)
      .map((r) => ({
        key: r.key,
        operator: r.operator,
        value: r.operator === "exists" ? undefined : parseValue(r.value),
      }));

    if (filters.length === 0) {
      // No filters; return all nodes
      const allIds = new Set<string>();
      ugm.forEachNode((id) => allIds.add(id));
      onApply(allIds);
      return;
    }

    const group: FilterGroup = { logic, filters };
    onApply(evaluateFilter(ugm, group));
  }, [rows, logic, ugm, onApply]);

  return (
    <div
      data-testid="filter-builder"
      className={className}
      style={{
        fontSize: "var(--g3t-font-sm, 12px)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--g3t-space-2, 8px)",
      }}
    >
      {/* Logic toggle */}
      {rows.length > 1 && (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ color: "var(--g3t-text-muted)" }}>Match:</span>
          <button
            data-testid="filter-logic-and"
            className={`g3t-btn ${logic === "and" ? "g3t-btn-active" : ""}`}
            onClick={() => setLogic("and")}
            style={{ fontSize: 11, padding: "2px 8px" }}
          >
            ALL
          </button>
          <button
            data-testid="filter-logic-or"
            className={`g3t-btn ${logic === "or" ? "g3t-btn-active" : ""}`}
            onClick={() => setLogic("or")}
            style={{ fontSize: 11, padding: "2px 8px" }}
          >
            ANY
          </button>
        </div>
      )}

      {/* Filter rows */}
      {rows.map((row) => (
        <div
          key={row.id}
          data-testid={`filter-row-${row.id}`}
          style={{ display: "flex", gap: 4, alignItems: "center" }}
        >
          <select
            className="g3t-select"
            value={row.key}
            onChange={(e) => updateRow(row.id, { key: e.target.value })}
            style={{ flex: 1, fontSize: 11 }}
          >
            <option value="">Property...</option>
            {propKeys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            className="g3t-select"
            value={row.operator}
            onChange={(e) =>
              updateRow(row.id, {
                operator: e.target.value as PropertyFilter["operator"],
              })
            }
            style={{ width: 80, fontSize: 11 }}
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          {row.operator !== "exists" && (
            <input
              className="g3t-input"
              value={row.value}
              onChange={(e) => updateRow(row.id, { value: e.target.value })}
              placeholder="Value"
              style={{ width: 80, fontSize: 11, padding: "2px 6px" }}
            />
          )}
          <button
            className="g3t-btn g3t-btn-ghost"
            onClick={() => removeRow(row.id)}
            style={{ fontSize: 14, padding: "0 4px" }}
          >
            ✕
          </button>
        </div>
      ))}

      {/* Actions */}
      <div style={{ display: "flex", gap: 4 }}>
        <button
          data-testid="filter-add-row"
          className="g3t-btn g3t-btn-ghost"
          onClick={addRow}
          style={{ fontSize: 11 }}
        >
          + Add condition
        </button>
        <span style={{ flex: 1 }} />
        <button
          data-testid="filter-apply"
          className="g3t-btn g3t-btn-active"
          onClick={handleApply}
          style={{ fontSize: 11 }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function parseValue(v: string): unknown {
  const num = Number(v);
  if (!isNaN(num) && v.trim() !== "") return num;
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}
