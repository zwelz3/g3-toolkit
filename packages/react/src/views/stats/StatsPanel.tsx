/**
 * StatsPanel: histogram of node property values (M5.E3.T1, T2).
 *
 * Renders a histogram of a numeric property across all nodes.
 * Brush selection on the histogram highlights matching nodes.
 *
 * @see specs/01-functional-views.md R1.8
 */

import { useMemo, useCallback, useRef, useEffect } from "react";
import * as echarts from "echarts";
import type { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";

export interface StatsPanelProps {
  ugm: UGM;
  /** Property key to plot (e.g., "pagerank", "score"). */
  propertyKey: string;
  /** Number of histogram bins (default 20). */
  bins?: number;
  className?: string;
}

interface HistogramBin {
  label: string;
  count: number;
  min: number;
  max: number;
  nodeIds: string[];
}

function buildHistogram(
  ugm: UGM,
  propertyKey: string,
  binCount: number,
): HistogramBin[] {
  // Collect numeric values
  const values: Array<{ id: string; value: number }> = [];
  ugm.forEachNode((id, attrs) => {
    const val = attrs.properties[propertyKey];
    if (typeof val === "number" && Number.isFinite(val)) {
      values.push({ id, value: val });
    }
  });

  if (values.length === 0) return [];

  const min = Math.min(...values.map((v) => v.value));
  const max = Math.max(...values.map((v) => v.value));
  const range = max - min || 1;
  const binWidth = range / binCount;

  const bins: HistogramBin[] = [];
  for (let i = 0; i < binCount; i++) {
    const binMin = min + i * binWidth;
    const binMax = min + (i + 1) * binWidth;
    bins.push({
      label: `${binMin.toFixed(2)}-${binMax.toFixed(2)}`,
      count: 0,
      min: binMin,
      max: binMax,
      nodeIds: [],
    });
  }

  for (const { id, value } of values) {
    const idx = Math.min(
      Math.floor(((value - min) / range) * binCount),
      binCount - 1,
    );
    const bin = bins[idx];
    if (bin) {
      bin.count++;
      bin.nodeIds.push(id);
    }
  }

  return bins;
}

export function StatsPanel({
  ugm,
  propertyKey,
  bins: binCount = 20,
  className,
}: StatsPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const echartsRef = useRef<echarts.ECharts | null>(null);
  const { selectNodes } = useSelectionStore();

  const histogram = useMemo(
    () => buildHistogram(ugm, propertyKey, binCount),
    [ugm, propertyKey, binCount],
  );

  const handleBrush = useCallback(
    (binIndices: number[]) => {
      const nodeIds = binIndices.flatMap(
        (idx) => histogram[idx]?.nodeIds ?? [],
      );
      if (nodeIds.length > 0) {
        selectNodes(nodeIds);
      }
    },
    [histogram, selectNodes],
  );

  useEffect(() => {
    if (!chartRef.current || histogram.length === 0) return;

    const chart = echarts.init(chartRef.current);
    echartsRef.current = chart;

    chart.setOption({
      title: {
        text: `Distribution: ${propertyKey}`,
        textStyle: { fontSize: 13 },
      },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: histogram.map((b) => b.label),
        axisLabel: { rotate: 45, fontSize: 10 },
      },
      yAxis: { type: "value", name: "Count" },
      series: [
        {
          type: "bar",
          data: histogram.map((b) => b.count),
          itemStyle: { color: "#2563eb" },
        },
      ],
      brush: { toolbox: ["rect"], xAxisIndex: 0 },
    });

    chart.on("brushSelected", (params: unknown) => {
      const p = params as {
        batch?: Array<{ selected?: Array<{ dataIndex?: number[] }> }>;
      };
      const selected = p.batch?.[0]?.selected?.[0]?.dataIndex ?? [];
      handleBrush(selected);
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      echartsRef.current = null;
    };
  }, [histogram, propertyKey, handleBrush]);

  return (
    <div
      data-testid="stats-panel"
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 200 }}
    >
      {histogram.length === 0 ? (
        <div
          data-testid="stats-empty"
          style={{ padding: 16, color: "#888", fontSize: 13 }}
        >
          No numeric data for property "{propertyKey}".
        </div>
      ) : (
        <div
          ref={chartRef}
          data-testid="stats-chart"
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
