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
import "./TemporalRangeFilter.css";

export interface TemporalRangeFilterProps {
  ugm: UGM;
  timeProperty: string;
  onChange: (range: { min: number; max: number }) => void;
  /**
   * Input style. "slider" (default) shows lower/upper bounded range
   * sliders; "datepicker" shows start/end date fields. Both report the
   * same { min, max } millisecond range via onChange.
   */
  mode?: "slider" | "datepicker";
  className?: string;
}

const toDateInput = (ts: number): string => {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const fromDateInput = (value: string): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

export function TemporalRangeFilter({
  ugm,
  timeProperty,
  onChange,
  mode = "slider",
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
      const v = Math.min(Number(e.target.value), max);
      setMin(v);
      onChange({ min: v, max });
    },
    [max, onChange],
  );

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Math.max(Number(e.target.value), min);
      setMax(v);
      onChange({ min, max: v });
    },
    [min, onChange],
  );

  const handleStartDate = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = fromDateInput(e.target.value);
      if (parsed === null) return;
      const v = Math.min(parsed, max);
      setMin(v);
      onChange({ min: v, max });
    },
    [max, onChange],
  );

  const handleEndDate = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = fromDateInput(e.target.value);
      if (parsed === null) return;
      const v = Math.max(parsed, min);
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

  const span = globalMax - globalMin || 1;
  const pctMin = ((min - globalMin) / span) * 100;
  const pctMax = ((max - globalMin) / span) * 100;

  return (
    <div
      data-testid="temporal-range-filter"
      className={`g3t-temporal-filter${className ? ` ${className}` : ""}`}
      style={{ fontSize: "var(--g3t-font-sm, 12px)" }}
    >
      <div className="g3t-panel-title">Time Range</div>
      {mode === "datepicker" ? (
        <div className="g3t-temporal-dates">
          <label>
            <span>Start</span>
            <input
              data-testid="temporal-start-date"
              type="date"
              min={toDateInput(globalMin)}
              max={toDateInput(globalMax)}
              value={toDateInput(min)}
              onChange={handleStartDate}
            />
          </label>
          <label>
            <span>End</span>
            <input
              data-testid="temporal-end-date"
              type="date"
              min={toDateInput(globalMin)}
              max={toDateInput(globalMax)}
              value={toDateInput(max)}
              onChange={handleEndDate}
            />
          </label>
        </div>
      ) : (
        <div className="g3t-temporal-slider">
          <div className="g3t-temporal-track" />
          <div
            className="g3t-temporal-fill"
            style={{
              left: `${pctMin}%`,
              width: `${Math.max(0, pctMax - pctMin)}%`,
            }}
          />
          <input
            data-testid="temporal-min"
            type="range"
            min={globalMin}
            max={globalMax}
            value={min}
            onChange={handleMinChange}
            aria-label="Range start"
          />
          <input
            data-testid="temporal-max"
            type="range"
            min={globalMin}
            max={globalMax}
            value={max}
            onChange={handleMaxChange}
            aria-label="Range end"
          />
        </div>
      )}
      <div className="g3t-temporal-readout">
        {formatDate(min)}
        <span aria-hidden="true">→</span>
        {formatDate(max)}
      </div>
    </div>
  );
}
