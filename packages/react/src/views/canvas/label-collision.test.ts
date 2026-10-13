/**
 * Label collision resolver (issue #40): the pure placement rule.
 * Overlap detection, priority order, deterministic output, and the
 * shorten strategy, all headless (boxes in, decisions out).
 */
import { describe, it, expect } from "vitest";
import {
  boxesOverlap,
  composeLabelPriority,
  orderLabelCandidates,
  resolveLabelCollisions,
  shortenLabel,
  shortenedBox,
  type LabelCandidate,
} from "./label-collision";

const cand = (
  id: string,
  box: [number, number, number, number],
  extra: Partial<LabelCandidate> = {},
): LabelCandidate => ({
  id,
  kind: "node",
  box: { x: box[0], y: box[1], w: box[2], h: box[3] },
  priority: 0,
  text: id,
  ...extra,
});

describe("boxesOverlap", () => {
  it("detects intersecting boxes and ignores boxes that only touch", () => {
    expect(
      boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }),
    ).toBe(true);
    // Shared edge: not a collision.
    expect(
      boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }),
    ).toBe(false);
    // Padding turns a near miss into a collision.
    expect(
      boxesOverlap(
        { x: 0, y: 0, w: 10, h: 10 },
        { x: 11, y: 0, w: 10, h: 10 },
        2,
      ),
    ).toBe(true);
  });
});

describe("resolveLabelCollisions: hide", () => {
  it("shows non-overlapping labels and leaves them untouched", () => {
    const r = resolveLabelCollisions(
      [cand("a", [0, 0, 10, 10]), cand("b", [20, 0, 10, 10])],
      { mode: "hide" },
    );
    expect(r.decisions.get("a")).toBe("show");
    expect(r.decisions.get("b")).toBe("show");
    expect(r.shortened.size).toBe(0);
  });

  it("hides the lower-priority label of an overlapping pair", () => {
    const r = resolveLabelCollisions(
      [
        cand("low", [0, 0, 10, 10], { priority: 1 }),
        cand("high", [5, 5, 10, 10], { priority: 2 }),
      ],
      { mode: "hide" },
    );
    expect(r.decisions.get("high")).toBe("show");
    expect(r.decisions.get("low")).toBe("hide");
  });

  it("judges against DRAWN labels only: a hidden label blocks nothing", () => {
    // c overlaps b but not a; b loses to a, so c must still show.
    const r = resolveLabelCollisions(
      [
        cand("a", [0, 0, 10, 10], { priority: 3 }),
        cand("b", [8, 0, 10, 10], { priority: 2 }),
        cand("c", [14, 0, 10, 10], { priority: 1 }),
      ],
      { mode: "hide" },
    );
    expect(r.decisions.get("a")).toBe("show");
    expect(r.decisions.get("b")).toBe("hide");
    expect(r.decisions.get("c")).toBe("show");
  });

  it("breaks priority ties node before edge, then by id (deterministic)", () => {
    const same: [number, number, number, number] = [0, 0, 10, 10];
    const input = [
      cand("z-edge", same, { kind: "edge" }),
      cand("b", same),
      cand("a", same),
    ];
    const r1 = resolveLabelCollisions(input, { mode: "hide" });
    // Reversed input order, identical output.
    const r2 = resolveLabelCollisions([...input].reverse(), { mode: "hide" });
    expect(r1.decisions.get("a")).toBe("show");
    expect(r1.decisions.get("b")).toBe("hide");
    expect(r1.decisions.get("z-edge")).toBe("hide");
    expect([...r2.decisions.entries()].sort()).toEqual(
      [...r1.decisions.entries()].sort(),
    );
    // And an edge outranks a node only through priority, never by kind.
    const r3 = resolveLabelCollisions(
      [cand("n", same), cand("e", same, { kind: "edge", priority: 1 })],
      { mode: "hide" },
    );
    expect(r3.decisions.get("e")).toBe("show");
    expect(r3.decisions.get("n")).toBe("hide");
  });

  it("treats empty text or an unmeasured box as always shown", () => {
    const r = resolveLabelCollisions(
      [
        cand("a", [0, 0, 10, 10], { priority: 2 }),
        cand("none", [0, 0, 0, 0], { text: "" }),
        cand("unmeasured", [0, 0, 0, 0], { text: "x" }),
      ],
      { mode: "hide" },
    );
    expect(r.decisions.get("none")).toBe("show");
    expect(r.decisions.get("unmeasured")).toBe("show");
  });
});

describe("resolveLabelCollisions: shorten", () => {
  it("shortens a loser whose truncated box fits, with an ellipsis", () => {
    // 40 chars at 4px each = 160 wide, centered on x=0..160; the high
    // label sits over its right third. Shortened to 10 chars (40 wide,
    // centered at 60..100) it clears.
    const long = "a".repeat(40);
    const r = resolveLabelCollisions(
      [
        cand("high", [120, 0, 40, 10], { priority: 2 }),
        cand("low", [0, 0, 160, 10], { text: long }),
      ],
      { mode: "shorten", maxLength: 10 },
    );
    expect(r.decisions.get("low")).toBe("shorten");
    const short = r.shortened.get("low")!;
    expect(Array.from(short).length).toBe(10);
    expect(short.endsWith("…")).toBe(true);
    expect(short.startsWith("a".repeat(9))).toBe(true);
  });

  it("hides a loser when even the shortened box still overlaps", () => {
    const r = resolveLabelCollisions(
      [
        cand("high", [60, 0, 40, 10], { priority: 2 }),
        cand("low", [0, 0, 160, 10], { text: "a".repeat(40) }),
      ],
      { mode: "shorten", maxLength: 10 },
    );
    expect(r.decisions.get("low")).toBe("hide");
    expect(r.shortened.has("low")).toBe(false);
  });

  it("hides a loser already within maxLength (nothing to shorten)", () => {
    const r = resolveLabelCollisions(
      [
        cand("high", [0, 0, 10, 10], { priority: 2 }),
        cand("low", [5, 5, 10, 10], { text: "short" }),
      ],
      { mode: "shorten", maxLength: 16 },
    );
    expect(r.decisions.get("low")).toBe("hide");
  });

  it("places the SHORTENED box, so a later label can use the freed space", () => {
    const long = "a".repeat(40);
    const r = resolveLabelCollisions(
      [
        cand("high", [120, 0, 40, 10], { priority: 3 }),
        cand("mid", [0, 0, 160, 10], { priority: 2, text: long }),
        // Sits in the space "mid" vacated by shortening (0..60).
        cand("late", [0, 0, 50, 10], { priority: 1 }),
      ],
      { mode: "shorten", maxLength: 10 },
    );
    expect(r.decisions.get("mid")).toBe("shorten");
    expect(r.decisions.get("late")).toBe("show");
  });
});

describe("shortenLabel / shortenedBox", () => {
  it("returns the same string when it already fits", () => {
    const s = "fits";
    expect(shortenLabel(s, 10)).toBe(s);
    expect(shortenLabel("exactly16chars!!", 16)).toBe("exactly16chars!!");
  });

  it("truncates by code point and trims trailing space before the ellipsis", () => {
    expect(shortenLabel("hello world again", 7)).toBe("hello…");
    expect(shortenLabel("\u{1F600}\u{1F600}\u{1F600}", 2)).toBe("\u{1F600}…");
  });

  it("shrinks the box width by character ratio about the center", () => {
    const b = shortenedBox(
      { x: 0, y: 0, w: 100, h: 10 },
      "a".repeat(10),
      "aaaa…",
    );
    expect(b.w).toBeCloseTo(50);
    expect(b.x).toBeCloseTo(25);
    expect(b.h).toBe(10);
  });
});

describe("composeLabelPriority", () => {
  it("orders selected > hovered > explicit > node-before-edge > weight", () => {
    const p = composeLabelPriority;
    const edgeWeight = p({ kind: "edge", weight: 999 });
    const node = p({ kind: "node" });
    const explicitEdge = p({ kind: "edge", explicit: 1 });
    const hoveredEdge = p({ kind: "edge", hovered: true });
    const selectedEdge = p({ kind: "edge", selected: true });
    const selectedNodeExplicit = p({
      kind: "node",
      selected: true,
      explicit: 5,
    });
    expect(node).toBeGreaterThan(edgeWeight);
    expect(explicitEdge).toBeGreaterThan(p({ kind: "node", weight: 999 }));
    expect(hoveredEdge).toBeGreaterThan(p({ kind: "node", explicit: 99_999 }));
    expect(selectedEdge).toBeGreaterThan(
      p({ kind: "node", hovered: true, explicit: 99_999 }),
    );
    expect(selectedNodeExplicit).toBeGreaterThan(selectedEdge);
    // Negative explicit ranks sit below the default 0 but above
    // nothing in a higher tier.
    expect(p({ kind: "node", explicit: -3 })).toBeLessThan(node);
    expect(p({ kind: "edge", hovered: true, explicit: -3 })).toBeGreaterThan(
      p({ kind: "node", explicit: 99_999 }),
    );
  });

  it("clamps out-of-range and non-finite inputs instead of leaking tiers", () => {
    expect(composeLabelPriority({ kind: "edge", explicit: 1e9 })).toBeLessThan(
      composeLabelPriority({ kind: "edge", hovered: true }),
    );
    expect(composeLabelPriority({ kind: "node", weight: Number.NaN })).toBe(
      composeLabelPriority({ kind: "node" }),
    );
  });

  it("orderLabelCandidates is stable under input permutation", () => {
    const base = [
      cand("b", [0, 0, 1, 1], { priority: 1 }),
      cand("a", [0, 0, 1, 1], { priority: 1 }),
      cand("e", [0, 0, 1, 1], { priority: 1, kind: "edge" }),
      cand("c", [0, 0, 1, 1], { priority: 9 }),
    ];
    const ids = (xs: LabelCandidate[]) => xs.map((x) => x.id);
    expect(ids(orderLabelCandidates(base))).toEqual(["c", "a", "b", "e"]);
    expect(ids(orderLabelCandidates([...base].reverse()))).toEqual([
      "c",
      "a",
      "b",
      "e",
    ]);
  });
});
