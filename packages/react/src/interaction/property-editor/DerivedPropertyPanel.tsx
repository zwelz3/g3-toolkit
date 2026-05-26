/**
 * Derived property definition UI (M13.E3.T2).
 *
 * Lets the user define and remove computed properties that are evaluated
 * on UGM nodes via the DerivedPropertyEngine (from @g3t/core).
 *
 * Extracted from interaction/remaining-tickets.tsx during P3.5.
 */

import { useState, useCallback } from "react";
import type { UGM } from "@g3t/core";
import { type DerivedPropertyEngine } from "@g3t/core";

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
