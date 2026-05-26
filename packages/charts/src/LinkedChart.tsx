/**
 * LinkedChart: graph-aware chart wrapper (M11.E2.T1).
 *
 * Wires a DataPipeline to an ECharts renderer with bidirectional
 * selection. Clicking a chart element selects the corresponding
 * graph nodes via the selection store.
 *
 * Chart renderers (M11.E2.T2-T6):
 * - Bar, Scatter (with trend), Line/Area, Pie/Donut, Parallel Coords
 */

import { useMemo, useCallback, useRef } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { UGM } from "@g3t/core";
import type {
  DataPipeline,
  CategoricalData,
  ScatterData,
  TimeSeriesData,
  CategoricalSelection,
  PointSetSelection,
} from "@g3t/core";
import { useSelectionStore } from "@g3t/react";
import { useThemeStore } from "@g3t/react";

// ── Chart Types ─────────────────────────────────────────────────────

export type ChartType = "bar" | "scatter" | "line" | "pie" | "parallel";

// ── LinkedChart Component (M11.E2.T1) ───────────────────────────────

export interface LinkedChartProps<TData, TSelection> {
  ugm: UGM;
  pipeline: DataPipeline<TData, TSelection>;
  type: ChartType;
  height?: number;
  className?: string;
}

export function LinkedChart<TData, TSelection>({
  ugm,
  pipeline,
  type,
  height = 300,
  className,
}: LinkedChartProps<TData, TSelection>) {
  const { selectNodes } = useSelectionStore();
  const { theme } = useThemeStore();
  const chartRef = useRef<ReactECharts | null>(null);

  // Run pipeline query (re-runs when UGM identity changes)
  const data = useMemo(() => pipeline.query(ugm), [ugm, pipeline]);

  // Generate ECharts options based on chart type
  const options = useMemo(
    () => buildOptions(type, data, theme.typePalette),
    [type, data, theme.typePalette],
  );

  // Handle chart click events
  const handleClick = useCallback(
    (params: { dataIndex?: number; name?: string; data?: unknown }) => {
      let nodeIds: string[] = [];

      if (type === "bar" || type === "pie") {
        const catData = data as unknown as CategoricalData;
        const sel: CategoricalSelection = {
          type: "categorical",
          category: String(params.name ?? ""),
        };
        nodeIds = (
          pipeline as unknown as DataPipeline<
            CategoricalData,
            CategoricalSelection
          >
        ).reverseMap(sel, catData);
      } else if (type === "scatter" && params.dataIndex !== undefined) {
        const sel: PointSetSelection = {
          type: "point-set",
          indices: [params.dataIndex],
        };
        nodeIds = (
          pipeline as unknown as DataPipeline<ScatterData, PointSetSelection>
        ).reverseMap(sel, data as unknown as ScatterData);
      }

      if (nodeIds.length > 0) {
        selectNodes(nodeIds);
      }
    },
    [data, pipeline, type, selectNodes],
  );

  // Handle brush selection (scatter, line)
  const handleBrushSelected = useCallback(
    (params: {
      batch?: Array<{ selected?: Array<{ dataIndex?: number[] }> }>;
    }) => {
      if (type !== "scatter" && type !== "line") return;

      const indices = params.batch?.[0]?.selected?.[0]?.dataIndex ?? [];
      if (indices.length === 0) return;

      if (type === "scatter") {
        const sel: PointSetSelection = { type: "point-set", indices };
        const nodeIds = (
          pipeline as unknown as DataPipeline<ScatterData, PointSetSelection>
        ).reverseMap(sel, data as unknown as ScatterData);
        if (nodeIds.length > 0) selectNodes(nodeIds);
      }
    },
    [data, pipeline, type, selectNodes],
  );

  // ECharts event handlers
  const onEvents = useMemo(
    () => ({
      click: handleClick,
      brushSelected: handleBrushSelected,
    }),
    [handleClick, handleBrushSelected],
  );

  return (
    <div
      data-testid={`linked-chart-${pipeline.id}`}
      className={className}
      style={{ height }}
    >
      <ReactECharts
        ref={(ref) => {
          chartRef.current = ref;
        }}
        option={options}
        style={{ height: "100%", width: "100%" }}
        onEvents={onEvents}
        theme="g3t"
      />
    </div>
  );
}

// ── Option Builders ─────────────────────────────────────────────────

function buildOptions(
  type: ChartType,
  data: unknown,
  palette: string[],
): EChartsOption {
  switch (type) {
    case "bar":
      return buildBarOptions(data as CategoricalData, palette);
    case "scatter":
      return buildScatterOptions(data as ScatterData, palette);
    case "line":
      return buildLineOptions(data as TimeSeriesData, palette);
    case "pie":
      return buildPieOptions(data as CategoricalData, palette);
    case "parallel":
      return buildParallelOptions(data, palette);
    default:
      return {};
  }
}

// ── Bar Chart (M11.E2.T2) ───────────────────────────────────────────

function buildBarOptions(
  data: CategoricalData,
  palette: string[],
): EChartsOption {
  return {
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: data.categories.map((c) => c.label),
      axisLabel: { fontSize: 11, color: "var(--g3t-text-secondary, #495057)" },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 11, color: "var(--g3t-text-secondary, #495057)" },
    },
    series: [
      {
        type: "bar",
        data: data.categories.map((c, i) => ({
          value: c.count,
          itemStyle: { color: palette[i % palette.length] },
        })),
        barMaxWidth: 40,
      },
    ],
    grid: { left: 48, right: 16, top: 16, bottom: 32 },
  };
}

// ── Scatter Chart with Trend (M11.E2.T3) ────────────────────────────

function buildScatterOptions(
  data: ScatterData,
  palette: string[],
): EChartsOption {
  const series: EChartsOption["series"] = [
    {
      type: "scatter",
      data: data.points.map((p) => [p.x, p.y]),
      symbolSize: 8,
      itemStyle: { color: palette[0] },
    },
  ];

  // Add OLS trend line
  if (data.trend && data.points.length >= 2) {
    const xs = data.points.map((p) => p.x);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    (series as unknown[]).push({
      type: "line",
      data: [
        [xMin, data.trend.predict(xMin)],
        [xMax, data.trend.predict(xMax)],
      ],
      lineStyle: { type: "dashed", color: palette[1] ?? "#999", width: 2 },
      symbol: "none",
      tooltip: {
        formatter: `r² = ${data.trend.r2.toFixed(3)}`,
      },
    });
  }

  return {
    tooltip: { trigger: "item" },
    xAxis: { type: "value", scale: true },
    yAxis: { type: "value", scale: true },
    series,
    brush: {
      toolbox: ["rect", "clear"],
      xAxisIndex: 0,
    },
    grid: { left: 48, right: 16, top: 16, bottom: 32 },
  };
}

// ── Line/Area Chart (M11.E2.T4) ─────────────────────────────────────

function buildLineOptions(
  data: TimeSeriesData,
  palette: string[],
): EChartsOption {
  return {
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "time",
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: "value",
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: "line",
        data: data.series.map((s) => [s.time, s.value]),
        areaStyle: { opacity: 0.15 },
        lineStyle: { color: palette[0], width: 2 },
        itemStyle: { color: palette[0] },
        smooth: true,
      },
    ],
    dataZoom: [{ type: "inside" }],
    grid: { left: 48, right: 16, top: 16, bottom: 32 },
  };
}

// ── Pie/Donut Chart (M11.E2.T5) ─────────────────────────────────────

function buildPieOptions(
  data: CategoricalData,
  palette: string[],
): EChartsOption {
  return {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        data: data.categories.map((c, i) => ({
          name: c.label,
          value: c.count,
          itemStyle: { color: palette[i % palette.length] },
        })),
        label: { fontSize: 11, color: "var(--g3t-text-secondary, #495057)" },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: "rgba(0,0,0,0.2)",
          },
        },
      },
    ],
  };
}

// ── Parallel Coordinates (M11.E2.T6) ────────────────────────────────

interface ParallelData {
  dimensions: string[];
  records: Array<Record<string, number> & { nodeId: string }>;
}

function buildParallelOptions(data: unknown, palette: string[]): EChartsOption {
  const pData = data as ParallelData;
  if (!pData.dimensions || !pData.records) return {};

  return {
    parallelAxis: pData.dimensions.map((dim, i) => ({
      dim: i,
      name: dim,
      nameTextStyle: { fontSize: 11 },
    })),
    series: [
      {
        type: "parallel",
        data: pData.records.map((r) => pData.dimensions.map((d) => r[d] ?? 0)),
        lineStyle: { color: palette[0], opacity: 0.4, width: 1.5 },
      },
    ],
  };
}
