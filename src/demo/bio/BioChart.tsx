/**
 * A small chart over SPARQL result data. Bar mode is a set of DOM tracks;
 * scatter mode is an SVG of points (category index on x, value on y). Both are
 * "linked": clicking a bar or point calls onSelect with the row's URI so the
 * shell can select that node in the graph. Kept intentionally minimal (no
 * chart dependency) so it renders deterministically from the tested data.
 */
import type { ChartDatum } from "./derive";

interface BioChartProps {
  /** LR-28: axis names for the scatter (the query hint's
   *  labelVar/valueVar); omitted axes render no label. */
  xLabel?: string;
  yLabel?: string;
  data: ChartDatum[];
  type: "bar" | "scatter";
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

export function BioChart({
  data,
  type,
  selectedId,
  onSelect,
  xLabel,
  yLabel,
}: BioChartProps) {
  if (data.length === 0) {
    return (
      <div className="bio-empty">
        Run a query with a numeric column to chart it.
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.value), 1);

  if (type === "scatter") {
    const w = 300;
    const h = 150;
    const pad = 24;
    const n = data.length;
    const x = (i: number) =>
      n <= 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (n - 1);
    const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);
    return (
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="scatter chart"
      >
        <line
          x1={pad}
          y1={h - pad}
          x2={w - pad}
          y2={h - pad}
          stroke="#2c2740"
        />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#2c2740" />
        {/* LR-28: axis labels in the pad gutters. */}
        {xLabel ? (
          <text
            x={w / 2}
            y={h - 6}
            textAnchor="middle"
            fontSize={9}
            fill="#8b83a3"
          >
            {xLabel}
          </text>
        ) : null}
        {yLabel ? (
          <text
            x={9}
            y={h / 2}
            textAnchor="middle"
            fontSize={9}
            fill="#8b83a3"
            transform={`rotate(-90 9 ${h / 2})`}
          >
            {yLabel}
          </text>
        ) : null}
        {data.map((d, i) => {
          const sel = d.id === selectedId;
          return (
            <g
              key={d.id}
              onClick={() => onSelect(d.id)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={x(i)}
                cy={y(d.value)}
                r={sel ? 6 : 4}
                fill={sel ? "#34d399" : "#b17ef0"}
              />
              <title>{`${d.label}: ${d.value}`}</title>
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <div>
      {data.map((d) => {
        const sel = d.id === selectedId;
        return (
          <div
            key={d.id}
            className={`bio-bar-row${sel ? " is-selected" : ""}`}
            onClick={() => onSelect(d.id)}
            title={`${d.label}: ${d.value}`}
          >
            <span className="bio-bar-label">{d.label}</span>
            <span className="bio-bar-track">
              <span
                className="bio-bar-fill"
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </span>
            <span className="bio-bar-value">{d.value}</span>
          </div>
        );
      })}
    </div>
  );
}
