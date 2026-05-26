/**
 * F6c: TemporalSlider with play/pause and speed controls.
 *
 * Wraps temporal filtering with animation: the time window
 * advances automatically at configurable speed, updating
 * the graph/map to show only entities active during that period.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { UGM } from "@g3t/core";

export interface TemporalSliderProps {
  ugm: UGM;
  /** Property name containing ISO date strings. */
  timeProperty: string;
  /** Window size in ms. Default 7 days. */
  windowSize?: number;
  /** Callback when the time range changes. */
  onRangeChange: (start: Date, end: Date) => void;
  className?: string;
}

const SPEEDS = [
  { label: "1x", factor: 1 },
  { label: "2x", factor: 2 },
  { label: "5x", factor: 5 },
  { label: "10x", factor: 10 },
];

const DAY_MS = 86_400_000;

export function TemporalSlider({
  ugm,
  timeProperty,
  windowSize = 7 * DAY_MS,
  onRangeChange,
  className,
}: TemporalSliderProps) {
  // Extract time range from UGM
  const { minTime, maxTime } = (() => {
    let min = Infinity;
    let max = -Infinity;
    ugm.forEachNode((_id, attrs) => {
      const val = attrs.properties[timeProperty];
      if (typeof val === "string") {
        const t = new Date(val).getTime();
        if (!isNaN(t)) {
          if (t < min) min = t;
          if (t > max) max = t;
        }
      }
    });
    if (min === Infinity) {
      min = Date.now() - 365 * DAY_MS;
      max = Date.now();
    }
    return { minTime: min, maxTime: max };
  })();

  const totalRange = maxTime - minTime || DAY_MS;
  const [position, setPosition] = useState(0); // 0-1 normalized
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update range on position change
  useEffect(() => {
    const startMs = minTime + position * (totalRange - windowSize);
    const start = new Date(startMs);
    const end = new Date(startMs + windowSize);
    onRangeChange(start, end);
  }, [position, minTime, totalRange, windowSize, onRangeChange]);

  // Play/pause animation
  useEffect(() => {
    if (playing) {
      const step = 0.005 * SPEEDS[speedIdx]!.factor;
      timerRef.current = setInterval(() => {
        setPosition((prev) => {
          const next = prev + step;
          if (next >= 1) {
            setPlaying(false);
            return 1;
          }
          return next;
        });
      }, 50);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speedIdx]);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const cycleSpeed = useCallback(
    () => setSpeedIdx((i) => (i + 1) % SPEEDS.length),
    [],
  );

  const currentStart = new Date(minTime + position * (totalRange - windowSize));
  const currentEnd = new Date(currentStart.getTime() + windowSize);

  return (
    <div
      data-testid="temporal-slider"
      className={className}
      style={{ fontSize: 11, padding: 4 }}
    >
      {/* Time range display */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          color: "var(--g3t-text-muted)",
        }}
      >
        <span>{currentStart.toLocaleDateString()}</span>
        <span>{currentEnd.toLocaleDateString()}</span>
      </div>

      {/* Slider */}
      <input
        type="range"
        data-testid="temporal-slider-input"
        min={0}
        max={1000}
        value={Math.round(position * 1000)}
        onChange={(e) => setPosition(parseInt(e.target.value, 10) / 1000)}
        style={{ width: "100%", cursor: "pointer" }}
      />

      {/* Controls */}
      <div
        style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}
      >
        <button
          data-testid="temporal-play-pause"
          className="g3t-btn g3t-btn-ghost"
          onClick={togglePlay}
          style={{ fontSize: 12, padding: "2px 8px", minWidth: 32 }}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button
          data-testid="temporal-speed"
          className="g3t-btn g3t-btn-ghost"
          onClick={cycleSpeed}
          style={{ fontSize: 10, padding: "2px 6px" }}
        >
          {SPEEDS[speedIdx]!.label}
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "var(--g3t-text-muted)" }}>
          {Math.round(position * 100)}%
        </span>
      </div>
    </div>
  );
}
