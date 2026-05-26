/**
 * DataPipeline: query-to-visualization bridge (M11.E1.T1 + T2).
 *
 * A DataPipeline has two functions:
 * - query(ugm) extracts chart-ready data from the graph
 * - reverseMap(selection, data) translates a chart interaction
 *   back to node IDs
 *
 * This pair is the contract that every chart renderer satisfies.
 * Framework-agnostic (D6).
 */

import type { UGM } from "@core/ugm";
import { linearRegression, rSquared } from "simple-statistics";

// ── Core Types ──────────────────────────────────────────────────────

export interface DataPipeline<TData, TSelection = CategoricalSelection> {
  readonly id: string;
  readonly name: string;
  query: (ugm: UGM) => TData;
  reverseMap: (selection: TSelection, data: TData) => string[];
}

// ── Selection Types ─────────────────────────────────────────────────

export interface CategoricalSelection {
  type: "categorical";
  category: string;
}

export interface RangeSelection {
  type: "range";
  min: number;
  max: number;
}

export interface PointSetSelection {
  type: "point-set";
  indices: number[];
}

export type ChartSelection =
  | CategoricalSelection
  | RangeSelection
  | PointSetSelection;

// ── Data Shapes ─────────────────────────────────────────────────────

export interface CategoricalData {
  categories: Array<{
    label: string;
    count: number;
    nodeIds: string[];
  }>;
}

export interface ScatterData {
  points: Array<{
    x: number;
    y: number;
    nodeId: string;
    label?: string;
  }>;
  trend?: {
    slope: number;
    intercept: number;
    r2: number;
    predict: (x: number) => number;
  };
}

export interface TimeSeriesData {
  series: Array<{
    time: number;
    value: number;
    nodeIds: string[];
  }>;
}

// ── Pipeline Registry ───────────────────────────────────────────────

export class PipelineRegistry {
  private readonly pipelines = new Map<
    string,
    DataPipeline<unknown, unknown>
  >();

  register<T, S>(pipeline: DataPipeline<T, S>): void {
    this.pipelines.set(pipeline.id, pipeline as DataPipeline<unknown, unknown>);
  }

  get(id: string): DataPipeline<unknown, unknown> | undefined {
    return this.pipelines.get(id);
  }

  list(): ReadonlyArray<DataPipeline<unknown, unknown>> {
    return [...this.pipelines.values()];
  }

  remove(id: string): boolean {
    return this.pipelines.delete(id);
  }
}

// ── Built-in Pipeline Functions (M11.E1.T2) ─────────────────────────

/**
 * Count nodes grouped by their primary type.
 * Bar chart: one bar per type, height = count.
 */
export function createCountByType(): DataPipeline<
  CategoricalData,
  CategoricalSelection
> {
  return {
    id: "count-by-type",
    name: "Node Count by Type",
    query: (ugm) => {
      const groups = new Map<string, string[]>();
      ugm.forEachNode((id, attrs) => {
        const type = attrs.types[0] ?? "Unknown";
        const list = groups.get(type) ?? [];
        list.push(id);
        groups.set(type, list);
      });
      return {
        categories: [...groups.entries()].map(([label, ids]) => ({
          label,
          count: ids.length,
          nodeIds: ids,
        })),
      };
    },
    reverseMap: (selection, data) => {
      const cat = data.categories.find((c) => c.label === selection.category);
      return cat?.nodeIds ?? [];
    },
  };
}

/**
 * Count nodes grouped by a specific property value.
 * Bar chart: one bar per distinct value.
 */
export function createCountByProperty(
  key: string,
): DataPipeline<CategoricalData, CategoricalSelection> {
  return {
    id: `count-by-${key}`,
    name: `Count by ${key}`,
    query: (ugm) => {
      const groups = new Map<string, string[]>();
      ugm.forEachNode((id, attrs) => {
        const val = String(attrs.properties[key] ?? "Unknown");
        const list = groups.get(val) ?? [];
        list.push(id);
        groups.set(val, list);
      });
      return {
        categories: [...groups.entries()].map(([label, ids]) => ({
          label,
          count: ids.length,
          nodeIds: ids,
        })),
      };
    },
    reverseMap: (selection, data) => {
      const cat = data.categories.find((c) => c.label === selection.category);
      return cat?.nodeIds ?? [];
    },
  };
}

/**
 * Degree distribution histogram.
 * Bar chart: X = degree, Y = count of nodes with that degree.
 */
export function createDegreeDistribution(): DataPipeline<
  CategoricalData,
  CategoricalSelection
> {
  return {
    id: "degree-distribution",
    name: "Degree Distribution",
    query: (ugm) => {
      const degreeCounts = new Map<number, string[]>();
      ugm.forEachNode((id) => {
        const degree = ugm.getNeighbors(id).length;
        const list = degreeCounts.get(degree) ?? [];
        list.push(id);
        degreeCounts.set(degree, list);
      });
      const sorted = [...degreeCounts.entries()].sort((a, b) => a[0] - b[0]);
      return {
        categories: sorted.map(([deg, ids]) => ({
          label: String(deg),
          count: ids.length,
          nodeIds: ids,
        })),
      };
    },
    reverseMap: (selection, data) => {
      const cat = data.categories.find((c) => c.label === selection.category);
      return cat?.nodeIds ?? [];
    },
  };
}

/**
 * Edge type breakdown.
 * Bar/pie chart: one segment per edge type.
 */
export function createEdgeTypeBreakdown(): DataPipeline<
  CategoricalData,
  CategoricalSelection
> {
  return {
    id: "edge-type-breakdown",
    name: "Edge Types",
    query: (ugm) => {
      const groups = new Map<string, string[]>();
      ugm.forEachEdge((id, attrs) => {
        const type = String(attrs.type ?? "Unknown");
        const list = groups.get(type) ?? [];
        list.push(id);
        groups.set(type, list);
      });
      return {
        categories: [...groups.entries()].map(([label, ids]) => ({
          label,
          count: ids.length,
          nodeIds: ids,
        })),
      };
    },
    reverseMap: (selection, data) => {
      const cat = data.categories.find((c) => c.label === selection.category);
      return cat?.nodeIds ?? [];
    },
  };
}

/**
 * Scatter plot: two numeric properties as X and Y axes.
 * Includes OLS trend line via simple-statistics.
 */
export function createPropertyCorrelation(
  xKey: string,
  yKey: string,
): DataPipeline<ScatterData, PointSetSelection> {
  return {
    id: `correlation-${xKey}-${yKey}`,
    name: `${xKey} vs ${yKey}`,
    query: (ugm) => {
      const points: ScatterData["points"] = [];
      ugm.forEachNode((id, attrs) => {
        const x = Number(attrs.properties[xKey]);
        const y = Number(attrs.properties[yKey]);
        if (!isNaN(x) && !isNaN(y)) {
          points.push({
            x,
            y,
            nodeId: id,
            label: String(attrs.properties.name ?? id),
          });
        }
      });

      // OLS trend line (simple-statistics)
      let trend: ScatterData["trend"];
      if (points.length >= 2) {
        const pairs: Array<[number, number]> = points.map((p) => [p.x, p.y]);
        const reg = linearRegression(pairs);
        const r2Val = rSquared(pairs, (x) => reg.m * x + reg.b);
        trend = {
          slope: reg.m,
          intercept: reg.b,
          r2: r2Val,
          predict: (x) => reg.m * x + reg.b,
        };
      }

      return { points, trend };
    },
    reverseMap: (selection, data) => {
      return selection.indices
        .map((i) => data.points[i]?.nodeId)
        .filter((id): id is string => id !== undefined);
    },
  };
}

/**
 * Scatter: graph metric (e.g., centrality) vs a node property.
 * Uses a pre-computed property key (from ingestAlgorithmResults).
 */
export function createCentralityVsProperty(
  centralityKey: string,
  propertyKey: string,
): DataPipeline<ScatterData, PointSetSelection> {
  return createPropertyCorrelation(centralityKey, propertyKey);
}

/**
 * Time series: count events in time buckets.
 * Line/area chart with time brush selection.
 */
export function createActivityTimeline(
  startKey: string,
  _endKey?: string,
): DataPipeline<TimeSeriesData, RangeSelection> {
  return {
    id: `timeline-${startKey}`,
    name: `Activity Timeline (${startKey})`,
    query: (ugm) => {
      const events: Array<{ time: number; nodeId: string }> = [];
      ugm.forEachNode((id, attrs) => {
        const raw = attrs.properties[startKey];
        if (raw === undefined || raw === null) return;
        const time =
          typeof raw === "number" ? raw : new Date(String(raw)).getTime();
        if (!isNaN(time)) {
          events.push({ time, nodeId: id });
        }
      });

      events.sort((a, b) => a.time - b.time);

      // Bucket by equal intervals (10 buckets)
      if (events.length === 0) return { series: [] };
      const minTime = events[0]!.time;
      const maxTime = events[events.length - 1]!.time;
      const range = maxTime - minTime || 1;
      const bucketCount = Math.min(10, events.length);
      const bucketSize = range / bucketCount;

      const buckets = new Map<number, string[]>();
      for (const evt of events) {
        const bucketIdx = Math.min(
          Math.floor((evt.time - minTime) / bucketSize),
          bucketCount - 1,
        );
        const bucketTime = minTime + bucketIdx * bucketSize;
        const list = buckets.get(bucketTime) ?? [];
        list.push(evt.nodeId);
        buckets.set(bucketTime, list);
      }

      return {
        series: [...buckets.entries()].map(([time, ids]) => ({
          time,
          value: ids.length,
          nodeIds: ids,
        })),
      };
    },
    reverseMap: (selection, data) => {
      return data.series
        .filter((s) => s.time >= selection.min && s.time <= selection.max)
        .flatMap((s) => s.nodeIds);
    },
  };
}

/**
 * Community breakdown (requires community IDs from algorithm ingest).
 * Pie/bar chart: one segment per community.
 */
// @see R1.14: community overlay visualization
export function createCommunityBreakdown(
  communityKey: string,
): DataPipeline<CategoricalData, CategoricalSelection> {
  return createCountByProperty(communityKey);
}
