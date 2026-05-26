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
import type { UGM } from "@g3t/core";
import { useSelectionStore } from "../../state/selection-store";

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

export function TimelineView({ ugm, className }: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const { selectNodes } = useSelectionStore();

  // Extract temporal items from UGM
  const items = useMemo<TimelineItem[]>(() => {
    const result: TimelineItem[] = [];
    ugm.forEachNode((id, attrs) => {
      const start = attrs.properties.temporal_start;
      const end = attrs.properties.temporal_end;
      if (start && (typeof start === "string" || typeof start === "number")) {
        const item: TimelineItem = {
          id,
          content:
            typeof attrs.properties.name === "string"
              ? attrs.properties.name
              : id,
          start: new Date(start as string | number),
          group: attrs.types[0],
        };
        if (end && (typeof end === "string" || typeof end === "number")) {
          item.end = new Date(end as string | number);
        }
        result.push(item);
      }
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
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 200 }}
    >
      {items.length === 0 ? (
        <div
          data-testid="timeline-empty"
          style={{ padding: 16, color: "#888", fontSize: 13 }}
        >
          No temporal data. Nodes need temporal_start/temporal_end properties.
        </div>
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
