/**
 * Temporal range filter slider (M13.E2.T2).
 *
 * Lets the user select a [min, max] time range from a UGM's nodes
 * (filtering by a configurable time property). The component reports
 * the selected range via onChange.
 *
 * @see R2.10 (temporal playback support)
 *
 * Extracted from interaction/remaining-tickets.tsx during P3.5.
 */

import { useState, useCallback, useMemo } from "react";
import type { UGM } from "@g3t/core";

export interface TemporalRangeFilterProps {
  ugm: UGM;
  timeProperty: string;
  onChange: (range: { min: number; max: number }) => void;
  className?: string;
}

export function TemporalRangeFilter({
  ugm,
  timeProperty,
  onChange,
  className,
}: TemporalRangeFilterProps) {
  // Bugfix 4: memoize time-range scan so we don't iterate the entire
  // UGM on every parent re-render. Without this, when a parent passes
  // a non-stable onChange callback the chain
  //   parent render -> new onChange -> Filter re-render -> UGM walk
  // becomes O(N_nodes) per keystroke / state change anywhere upstream.
  // The patch we got from the v1.0.0-rc bug pass also called out a
  // "Maximum update depth exceeded" loop; in the current code path
  // (after P3.5 split) the loop itself doesn't fire because globalMin/
  // globalMax only seed state on first render — but the wasted scan
  // is real and useMemo fixes it cleanly.
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
      // eslint-disable-next-line react-hooks/purity
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
