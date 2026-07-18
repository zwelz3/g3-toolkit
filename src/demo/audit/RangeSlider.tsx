/**
 * A dual-thumb range slider over the provenance time span. Two range inputs
 * share one track (only the thumbs take pointer events, per the stylesheet);
 * the fill marks the selected window and small ticks mark provenance events so
 * the span reads as a timeline, not just a slider. Values are epoch
 * milliseconds; the parent clamps start <= end and drives both the timeline
 * table and the graph filter from the window.
 */
interface Tick {
  time: number;
  kind: string;
  /** Hover tooltip: "<name>: <kind> <date>" (review 6.3). */
  label?: string;
}
interface RangeSliderProps {
  min: number;
  max: number;
  start: number;
  end: number;
  ticks: Tick[];
  onChange: (start: number, end: number) => void;
}

/** Mirrors the shell's KIND_SYMBOL so ticks and the list agree. */
const SYMBOL: Record<string, string> = {
  generated: "\u25cf",
  started: "\u25b6",
  ended: "\u25a0",
};

function pct(v: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

export function RangeSlider({
  min,
  max,
  start,
  end,
  ticks,
  onChange,
}: RangeSliderProps) {
  const startPct = pct(start, min, max);
  const endPct = pct(end, min, max);
  return (
    <div className="au-track">
      <div className="au-track-line" />
      <div
        className="au-track-fill"
        style={{
          left: `${startPct}%`,
          width: `${Math.max(0, endPct - startPct)}%`,
        }}
      />
      {ticks.map((t, i) => (
        <div
          key={i}
          className={`au-tick au-tick-${t.kind}`}
          style={{ left: `${pct(t.time, min, max)}%` }}
          title={t.label}
          data-testid="au-tick"
        >
          {SYMBOL[t.kind] ?? ""}
        </div>
      ))}
      <input
        className="au-range-input"
        type="range"
        min={min}
        max={max}
        value={start}
        aria-label="Window start"
        onChange={(e) => onChange(Math.min(Number(e.target.value), end), end)}
      />
      <input
        className="au-range-input"
        type="range"
        min={min}
        max={max}
        value={end}
        aria-label="Window end"
        onChange={(e) =>
          onChange(start, Math.max(Number(e.target.value), start))
        }
      />
    </div>
  );
}
