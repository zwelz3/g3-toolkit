/**
 * TimelineView: temporal visualization using vis-timeline (M5.E1.T1, T2).
 *
 * Renders nodes that have temporal_start/temporal_end properties as
 * timeline items. Brush selection writes to the selection store.
 *
 * @see specs/01-functional-views.md R1.2
 */

// R2.10: Temporal playback (planned; timeline renders but animation not yet).

import { useRef, useEffect, useMemo, useCallback } from "react";
import { Timeline, type TimelineOptions } from "vis-timeline/standalone";
import { DataSet } from "vis-data/standalone";
// vis-timeline's stylesheet is VENDORED (vis-timeline-vendor.css) rather
// than imported from node_modules: vis-timeline is a build external, so a
// bare import would survive into dist/*.mjs and break plain-Node/SSR
// consumers (the WorkspaceShell/flexlayout precedent; see
// scripts/smoke-test.mjs). As a local import it is extracted into the
// exported ./style.css with the rest of the package CSS. vendor-css.test.ts
// byte-compares the vendored copy against the installed package so a
// vis-timeline upgrade fails loudly instead of drifting.
import "./vis-timeline-vendor.css";
import "./TimelineView.css";
import type { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";
import { EmptyState } from "../../interaction/feedback";

export interface TimelineViewProps {
  ugm: UGM;
  className?: string;
}

interface TimelineItem {
  id: string;
  content: string;
  start: Date;
  end?: Date;
  group?: string;
}

// Property names recognized as the start/end of a temporal item, in
// priority order. temporal_start/temporal_end are the documented keys;
// the date/time aliases let ordinary graph data populate the timeline
// without renaming properties first.
const TEMPORAL_START_KEYS = [
  "temporal_start",
  "date",
  "datetime",
  "timestamp",
  "time",
  "start",
] as const;
const TEMPORAL_END_KEYS = ["temporal_end", "end"] as const;

function readDate(
  properties: Record<string, unknown>,
  keys: readonly string[],
): Date | null {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
}

export function TimelineView({ ugm, className }: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const { selectNodes } = useSelectionStore();

  // Extract temporal items from UGM
  const items = useMemo<TimelineItem[]>(() => {
    const result: TimelineItem[] = [];
    ugm.forEachNode((id, attrs) => {
      const start = readDate(attrs.properties, TEMPORAL_START_KEYS);
      if (!start) return;
      const item: TimelineItem = {
        id,
        content:
          typeof attrs.properties.name === "string"
            ? attrs.properties.name
            : id,
        start,
        group: attrs.types[0],
      };
      const end = readDate(attrs.properties, TEMPORAL_END_KEYS);
      if (end) item.end = end;
      result.push(item);
    });
    return result;
  }, [ugm]);

  // Handle range selection (brush)
  const handleRangeChanged = useCallback(
    (properties: { start: Date; end: Date }) => {
      const start = properties.start.getTime();
      const end = properties.end.getTime();
      const matching = items
        .filter((item) => {
          const itemStart = item.start.getTime();
          const itemEnd = item.end?.getTime() ?? itemStart;
          return itemStart <= end && itemEnd >= start;
        })
        .map((item) => item.id);
      if (matching.length > 0) {
        selectNodes(matching);
      }
    },
    [items, selectNodes],
  );

  useEffect(() => {
    if (!containerRef.current || items.length === 0) return;

    const dataset = new DataSet(items);
    const options: TimelineOptions = {
      height: "100%",
      selectable: true,
      multiselect: true,
      zoomMin: 1000 * 60 * 60, // 1 hour minimum zoom
    };

    const timeline = new Timeline(containerRef.current, dataset, options);
    timelineRef.current = timeline;

    timeline.on("rangechanged", handleRangeChanged);
    timeline.on("select", (properties: { items: string[] }) => {
      if (properties.items.length > 0) {
        selectNodes(properties.items);
      }
    });

    return () => {
      timeline.destroy();
      timelineRef.current = null;
    };
  }, [items, selectNodes, handleRangeChanged]);

  return (
    <div
      data-testid="timeline-view"
      className={`g3t-timeline-view${className ? ` ${className}` : ""}`}
      style={{ width: "100%", height: "100%", minHeight: 200 }}
    >
      {items.length === 0 ? (
        <EmptyState
          testId="timeline-empty"
          icon="info"
          title="No temporal data"
          description="The timeline reads temporal_start/temporal_end or common date and time properties. Load time-stamped elements to populate it."
        />
      ) : (
        <div
          ref={containerRef}
          data-testid="timeline-container"
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
