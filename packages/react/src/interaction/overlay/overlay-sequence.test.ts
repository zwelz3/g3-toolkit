import { describe, it, expect } from "vitest";
import {
  computeSequenceActiveIds,
  stepSequence,
  mergeSequenceActiveIds,
} from "./overlay-sequence";

const IDS = ["info", "warning", "violation"];

describe("computeSequenceActiveIds", () => {
  it("single mode shows only the step's own overlay", () => {
    expect(computeSequenceActiveIds(IDS, 0, "single")).toEqual(["info"]);
    expect(computeSequenceActiveIds(IDS, 2, "single")).toEqual(["violation"]);
  });

  it("cumulative mode accumulates every earlier step", () => {
    expect(computeSequenceActiveIds(IDS, 0, "cumulative")).toEqual(["info"]);
    expect(computeSequenceActiveIds(IDS, 2, "cumulative")).toEqual(IDS);
  });

  it("is empty for an empty sequence or an out-of-range index", () => {
    expect(computeSequenceActiveIds([], 0, "single")).toEqual([]);
    expect(computeSequenceActiveIds(IDS, -1, "single")).toEqual([]);
    expect(computeSequenceActiveIds(IDS, 3, "cumulative")).toEqual([]);
    expect(computeSequenceActiveIds(IDS, 1.5, "single")).toEqual([]);
  });
});

describe("stepSequence", () => {
  it("clamps at both ends without loop", () => {
    expect(stepSequence(0, "next", 3, false)).toBe(1);
    expect(stepSequence(2, "next", 3, false)).toBe(2);
    expect(stepSequence(0, "prev", 3, false)).toBe(0);
    expect(stepSequence(2, "prev", 3, false)).toBe(1);
  });

  it("wraps at both ends with loop", () => {
    expect(stepSequence(2, "next", 3, true)).toBe(0);
    expect(stepSequence(0, "prev", 3, true)).toBe(2);
    expect(stepSequence(1, "next", 3, true)).toBe(2);
  });

  it("returns 0 for an empty sequence", () => {
    expect(stepSequence(0, "next", 0, false)).toBe(0);
    expect(stepSequence(4, "prev", 0, true)).toBe(0);
  });
});

describe("mergeSequenceActiveIds", () => {
  it("keeps foreign ids in place and sets owned ids exactly", () => {
    expect(
      mergeSequenceActiveIds(["path", "info", "other"], IDS, ["violation"]),
    ).toEqual(["path", "other", "violation"]);
  });

  it("drops a target id outside the owned set", () => {
    expect(mergeSequenceActiveIds([], IDS, ["info", "path"])).toEqual(["info"]);
  });

  it("clears owned ids when the target is empty, foreign untouched", () => {
    expect(mergeSequenceActiveIds(["info", "path"], IDS, [])).toEqual(["path"]);
  });
});
