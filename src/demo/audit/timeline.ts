/**
 * Timeline and range derivations, the pure core behind the auditor's slider.
 * provenanceEvents flattens the record into time-stamped events (entity
 * generations, activity starts and ends), sorted. hiddenForRange is what
 * actually wires the slider to the graph: given a [start, end] window it
 * returns the set of node ids to hide, so dragging the slider filters the
 * graph and not just the timeline. provenanceReport groups the SHACL results
 * into violations and warnings for the report panel.
 */
import { UGM, validateShacl } from "@g3t/core";
import type { ShaclShape } from "@g3t/core";

export type EventKind = "generated" | "started" | "ended";

export interface ProvenanceEvent {
  time: number;
  iso: string;
  kind: EventKind;
  nodeId: string;
  nodeName: string;
}

function parseTime(v: unknown): number | undefined {
  if (typeof v !== "string") return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : t;
}
function name(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

/** All provenance events, sorted ascending by time. */
export function provenanceEvents(ugm: UGM): ProvenanceEvent[] {
  const events: ProvenanceEvent[] = [];
  ugm.forEachNode((id, attrs) => {
    const label = name(attrs.properties.name, id);
    const push = (key: string, kind: EventKind) => {
      const iso = attrs.properties[key];
      const time = parseTime(iso);
      if (time !== undefined && typeof iso === "string") {
        events.push({ time, iso, kind, nodeId: id, nodeName: label });
      }
    };
    if (attrs.types.includes("Entity")) push("generatedAtTime", "generated");
    if (attrs.types.includes("Activity")) {
      push("startedAtTime", "started");
      push("endedAtTime", "ended");
    }
  });
  return events.sort((a, b) => a.time - b.time);
}

export function timeBounds(events: ProvenanceEvent[]): {
  min: number;
  max: number;
} {
  if (events.length === 0) return { min: 0, max: 0 };
  let min = Infinity;
  let max = -Infinity;
  for (const e of events) {
    if (e.time < min) min = e.time;
    if (e.time > max) max = e.time;
  }
  return { min, max };
}

export function eventsInRange(
  events: ProvenanceEvent[],
  start: number,
  end: number,
): ProvenanceEvent[] {
  return events.filter((e) => e.time >= start && e.time <= end);
}

function visibleByTime(
  attrs: { types: string[]; properties: Record<string, unknown> },
  start: number,
  end: number,
): boolean {
  if (attrs.types.includes("Entity")) {
    const gen = parseTime(attrs.properties.generatedAtTime);
    return gen === undefined ? true : gen >= start && gen <= end;
  }
  if (attrs.types.includes("Activity")) {
    const s = parseTime(attrs.properties.startedAtTime);
    if (s === undefined) return true;
    const e = parseTime(attrs.properties.endedAtTime) ?? s;
    return s <= end && e >= start; // interval overlap
  }
  return true;
}

/**
 * Node ids to hide for a [start, end] window. Entities and activities are
 * filtered by their timestamps; an agent stays visible only while one of its
 * activities is visible; nodes with no timestamp at all are never hidden (a
 * missing time is a defect the report surfaces, not a filter criterion).
 */
export function hiddenForRange(
  ugm: UGM,
  start: number,
  end: number,
): Set<string> {
  const attrsById = new Map<
    string,
    { types: string[]; properties: Record<string, unknown> }
  >();
  ugm.forEachNode((id, attrs) =>
    attrsById.set(id, { types: attrs.types, properties: attrs.properties }),
  );

  const agentOfActivity = new Map<string, string>();
  ugm.forEachEdge((_e, edgeAttrs, source, target) => {
    if (edgeAttrs.type === "wasAssociatedWith")
      agentOfActivity.set(source, target);
  });

  const visible = new Set<string>();
  for (const [id, attrs] of attrsById) {
    if (attrs.types.includes("Agent")) continue;
    if (visibleByTime(attrs, start, end)) visible.add(id);
  }
  for (const [activityId, agentId] of agentOfActivity) {
    if (visible.has(activityId)) visible.add(agentId);
  }

  const hidden = new Set<string>();
  for (const id of attrsById.keys()) {
    if (!visible.has(id)) hidden.add(id);
  }
  return hidden;
}

export interface Finding {
  nodeId: string;
  nodeName: string;
  shapeName: string;
  path: string;
  message: string;
}
export interface ProvenanceReport {
  violations: Finding[];
  warnings: Finding[];
}

/** Group SHACL results into violations and warnings for the report panel. */
export function provenanceReport(
  ugm: UGM,
  shapes: ShaclShape[],
): ProvenanceReport {
  const names = new Map<string, string>();
  ugm.forEachNode((id, attrs) =>
    names.set(id, name(attrs.properties.name, id)),
  );

  const violations: Finding[] = [];
  const warnings: Finding[] = [];
  for (const result of validateShacl(ugm, shapes)) {
    if (result.valid) continue;
    for (const v of result.violations) {
      const finding: Finding = {
        nodeId: result.nodeId,
        nodeName: names.get(result.nodeId) ?? result.nodeId,
        shapeName: result.shapeName,
        path: v.path,
        message: v.message,
      };
      if (v.severity === "violation") violations.push(finding);
      else warnings.push(finding);
    }
  }
  return { violations, warnings };
}
