/**
 * SankeyView: flow visualization between node categories (M7.E1.T1).
 *
 * Renders aggregated path flows between node types using ECharts.
 * Also serves as the chord diagram mode (M7.E1.T2) via a mode toggle.
 *
 * @see specs/01-functional-views.md R1.9
 */

import { useRef, useEffect, useMemo, useState } from "react";
import * as echarts from "echarts";
import type { UGM } from "@g3t/core";
import { EmptyState } from "../../interaction/feedback";

export type FlowMode = "sankey" | "chord";

export interface SankeyViewProps {
  ugm: UGM;
  /** Display mode: sankey or chord (default: sankey). */
  mode?: FlowMode;
  className?: string;
}

interface FlowLink {
  source: string;
  target: string;
  value: number;
}

export function SankeyView({
  ugm,
  mode = "sankey",
  className,
}: SankeyViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [currentMode, setCurrentMode] = useState<FlowMode>(mode);

  // Aggregate edge counts between node types
  const { nodes, links } = useMemo(() => {
    const counts = new Map<string, number>();
    const typeSet = new Set<string>();

    ugm.forEachEdge((_id, _attrs, source, target) => {
      const srcType = ugm.getNode(source)?.types[0] ?? "Unknown";
      const tgtType = ugm.getNode(target)?.types[0] ?? "Unknown";
      typeSet.add(srcType);
      typeSet.add(tgtType);
      const key = `${srcType}→${tgtType}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const nodeList = [...typeSet].map((name) => ({ name }));
    const linkList: FlowLink[] = [];
    for (const [key, value] of counts) {
      const [source, target] = key.split("→");
      if (source && target && source !== target) {
        linkList.push({ source, target, value });
      }
    }

    return { nodes: nodeList, links: linkList };
  }, [ugm]);

  useEffect(() => {
    if (!chartRef.current || nodes.length === 0 || links.length === 0) return;

    const chart = echarts.init(chartRef.current);

    if (currentMode === "sankey") {
      chart.setOption({
        tooltip: { trigger: "item" },
        series: [
          {
            type: "sankey",
            data: nodes,
            links,
            emphasis: { focus: "adjacency" },
            lineStyle: { color: "gradient", curveness: 0.5 },
          },
        ],
      });
    } else {
      // Chord-like visualization via ECharts graph with circular layout
      chart.setOption({
        tooltip: {},
        series: [
          {
            type: "graph",
            layout: "circular",
            data: nodes.map((n) => ({ ...n, symbolSize: 30 })),
            links: links.map((l) => ({
              ...l,
              lineStyle: { width: Math.max(1, l.value) },
            })),
            roam: true,
            label: { show: true },
            emphasis: { focus: "adjacency" },
          },
        ],
      });
    }

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [nodes, links, currentMode]);

  if (nodes.length === 0 || links.length === 0) {
    return (
      <EmptyState
        testId="sankey-empty"
        icon="layers"
        title="No flows to draw"
        description="Flows aggregate edges between different node types. Load a graph whose typed nodes connect across types to see them."
      />
    );
  }

  return (
    <div
      data-testid="sankey-view"
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 200 }}
    >
      <div style={{ display: "flex", gap: 4, padding: "4px 8px" }}>
        <button
          data-testid="sankey-mode-sankey"
          onClick={() => setCurrentMode("sankey")}
          style={{
            fontSize: 11,
            padding: "2px 8px",
            background: currentMode === "sankey" ? "#2563eb" : "white",
            color: currentMode === "sankey" ? "white" : "#333",
            border: "1px solid #ccc",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Sankey
        </button>
        <button
          data-testid="sankey-mode-chord"
          onClick={() => setCurrentMode("chord")}
          style={{
            fontSize: 11,
            padding: "2px 8px",
            background: currentMode === "chord" ? "#2563eb" : "white",
            color: currentMode === "chord" ? "white" : "#333",
            border: "1px solid #ccc",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Chord
        </button>
      </div>
      <div
        ref={chartRef}
        data-testid="sankey-chart"
        style={{ width: "100%", height: "calc(100% - 30px)" }}
      />
    </div>
  );
}
