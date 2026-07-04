import { describe, it, expect } from "vitest";
import { buildProvenance } from "./model";
import { provenanceShapes } from "./shapes";
import {
  provenanceEvents,
  timeBounds,
  hiddenForRange,
  provenanceReport,
} from "./timeline";

const JAN_START = Date.parse("2025-01-01T00:00:00Z");
const JAN_END = Date.parse("2025-01-31T23:59:59Z");

describe("provenance model + timeline", () => {
  it("flattens the record into sorted, time-stamped events", () => {
    const ugm = buildProvenance();
    const events = provenanceEvents(ugm);
    // 5 entity generations (release has none) + 9 activity start/end (approve has no end)
    expect(events.length).toBe(14);
    // sorted ascending; earliest is the legacy spec
    expect(events[0]?.nodeId).toBe("ent:legacy");
    for (let i = 1; i < events.length; i += 1) {
      expect((events[i]?.time ?? 0) >= (events[i - 1]?.time ?? 0)).toBe(true);
    }
  });

  it("bounds the timeline by the earliest and latest event", () => {
    const b = timeBounds(provenanceEvents(buildProvenance()));
    expect(b.min).toBe(Date.parse("2025-01-05T00:00:00Z"));
    expect(b.max).toBe(Date.parse("2025-04-01T10:00:00Z"));
  });

  it("hides out-of-range nodes so the slider filters the graph", () => {
    const ugm = buildProvenance();
    const hidden = hiddenForRange(ugm, JAN_START, JAN_END);
    // February+ artifacts and their activities/agents are hidden
    expect(hidden.has("ent:analysis")).toBe(true);
    expect(hidden.has("act:review")).toBe(true);
    expect(hidden.has("agent:carol")).toBe(true);
    // January artifacts stay; a timeless node (release) is never hidden
    expect(hidden.has("ent:reqs")).toBe(false);
    expect(hidden.has("act:draft")).toBe(false);
    expect(hidden.has("ent:release")).toBe(false);
  });

  it("keeps an agent visible only while one of its activities is in range", () => {
    const ugm = buildProvenance();
    // a window around the review (March) shows Bob, hides Alice
    const marchStart = Date.parse("2025-03-01T00:00:00Z");
    const marchEnd = Date.parse("2025-03-31T00:00:00Z");
    const hidden = hiddenForRange(ugm, marchStart, marchEnd);
    expect(hidden.has("agent:bob")).toBe(false);
    expect(hidden.has("agent:alice")).toBe(true);
  });
});

describe("provenanceReport", () => {
  const report = provenanceReport(buildProvenance(), provenanceShapes);

  it("reports the missing generation time as a violation", () => {
    expect(report.violations.length).toBe(1);
    expect(report.violations[0]?.nodeId).toBe("ent:release");
    expect(report.violations[0]?.path).toBe("generatedAtTime");
  });

  it("reports the orphan artifact and the open activity as warnings", () => {
    const ids = report.warnings.map((w) => w.nodeId).sort();
    expect(ids).toEqual(["act:approve", "ent:legacy"]);
  });
});
