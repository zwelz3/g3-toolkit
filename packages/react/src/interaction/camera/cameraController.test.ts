/**
 * Camera controller tests (flagship §2a). jsdom cannot render Cytoscape,
 * so (as the existing canvas tests do) we spy on a mock `cy` and assert
 * the animate/fit/center calls the controller makes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Core } from "cytoscape";
import { createCameraController } from "./cameraController";

interface Coll {
  _ids: Set<string>;
  union(other: Coll): Coll;
  empty(): boolean;
  nonempty(): boolean;
}
const mkColl = (ids: Set<string>): Coll => ({
  _ids: ids,
  union(other) {
    return mkColl(new Set([...ids, ...other._ids]));
  },
  empty: () => ids.size === 0,
  nonempty: () => ids.size > 0,
});

function makeCy(present: Set<string>) {
  const animate = vi.fn();
  const fit = vi.fn();
  const center = vi.fn();
  const getElementById = vi.fn((id: string) =>
    mkColl(present.has(id) ? new Set([id]) : new Set<string>()),
  );
  const collection = vi.fn(() => mkColl(new Set<string>()));
  const elements = vi.fn(() => mkColl(new Set(["__all__"])));
  const zoom = vi.fn(() => 2);
  const width = vi.fn(() => 800);
  const height = vi.fn(() => 600);
  const pan = vi.fn();
  const cy = {
    animate,
    fit,
    center,
    getElementById,
    collection,
    elements,
    zoom,
    width,
    height,
    pan,
  };
  return { cy: cy as unknown as Core, animate, fit, center, elements, pan };
}

const PRESENT = new Set(["a.helios", "a.aegis-kg"]);

describe("createCameraController.focusNodes", () => {
  let m: ReturnType<typeof makeCy>;
  beforeEach(() => {
    m = makeCy(PRESENT);
  });

  it("animates a fit to the unioned present nodes with defaults", () => {
    createCameraController(m.cy).focusNodes(["a.helios", "a.aegis-kg"]);
    expect(m.animate).toHaveBeenCalledTimes(1);
    const arg = m.animate.mock.calls[0]![0] as {
      fit: { eles: Coll; padding: number };
      duration: number;
      easing: string;
    };
    expect([...arg.fit.eles._ids].sort()).toEqual(["a.aegis-kg", "a.helios"]);
    expect(arg.fit.padding).toBe(48);
    expect(arg.duration).toBe(500);
    expect(arg.easing).toBe("ease-in-out-cubic");
    expect(m.fit).not.toHaveBeenCalled();
  });

  it("ignores missing ids and no-ops when none are present", () => {
    createCameraController(m.cy).focusNodes(["nope.1", "nope.2"]);
    expect(m.animate).not.toHaveBeenCalled();
    expect(m.fit).not.toHaveBeenCalled();
  });

  it("ignores a missing id but still frames the present ones", () => {
    createCameraController(m.cy).focusNodes(["a.helios", "missing"]);
    const arg = m.animate.mock.calls[0]![0] as { fit: { eles: Coll } };
    expect([...arg.fit.eles._ids]).toEqual(["a.helios"]);
  });

  it("applies instantly (cy.fit) when animate is false", () => {
    createCameraController(m.cy).focusNodes(["a.helios"], { animate: false });
    expect(m.animate).not.toHaveBeenCalled();
    expect(m.fit).toHaveBeenCalledTimes(1);
    expect(m.fit.mock.calls[0]![1]).toBe(48); // padding
  });

  it("applies instantly when duration is 0", () => {
    createCameraController(m.cy).focusNodes(["a.helios"], { duration: 0 });
    expect(m.animate).not.toHaveBeenCalled();
    expect(m.fit).toHaveBeenCalledTimes(1);
  });

  it("passes through custom padding, duration, easing", () => {
    createCameraController(m.cy).focusNodes(["a.helios"], {
      padding: 80,
      duration: 250,
      easing: "linear",
    });
    const arg = m.animate.mock.calls[0]![0] as {
      fit: { padding: number };
      duration: number;
      easing: string;
    };
    expect(arg.fit.padding).toBe(80);
    expect(arg.duration).toBe(250);
    expect(arg.easing).toBe("linear");
  });

  it("honors controller-level defaults", () => {
    createCameraController(m.cy, { padding: 12, duration: 100 }).focusNodes([
      "a.helios",
    ]);
    const arg = m.animate.mock.calls[0]![0] as {
      fit: { padding: number };
      duration: number;
    };
    expect(arg.fit.padding).toBe(12);
    expect(arg.duration).toBe(100);
  });
});

describe("createCameraController other moves", () => {
  it("frameAll fits all elements", () => {
    const m = makeCy(PRESENT);
    createCameraController(m.cy).frameAll();
    expect(m.elements).toHaveBeenCalled();
    const arg = m.animate.mock.calls[0]![0] as { fit: { eles: Coll } };
    expect([...arg.fit.eles._ids]).toEqual(["__all__"]);
  });

  it("resetView fits all elements", () => {
    const m = makeCy(PRESENT);
    createCameraController(m.cy).resetView();
    const arg = m.animate.mock.calls[0]![0] as { fit: { eles: Coll } };
    expect([...arg.fit.eles._ids]).toEqual(["__all__"]);
  });

  it("panToNode centers a present node and keeps zoom", () => {
    const m = makeCy(PRESENT);
    createCameraController(m.cy).panToNode("a.helios");
    expect(m.animate).toHaveBeenCalledTimes(1);
    const arg = m.animate.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).toHaveProperty("center");
    expect(arg).not.toHaveProperty("fit");
  });

  it("panToNode no-ops on a missing node", () => {
    const m = makeCy(PRESENT);
    createCameraController(m.cy).panToNode("missing");
    expect(m.animate).not.toHaveBeenCalled();
    expect(m.center).not.toHaveBeenCalled();
  });

  it("panToNode centers instantly when animate is false", () => {
    const m = makeCy(PRESENT);
    createCameraController(m.cy).panToNode("a.helios", { animate: false });
    expect(m.animate).not.toHaveBeenCalled();
    expect(m.center).toHaveBeenCalledTimes(1);
  });
});

describe("createCameraController.panToPoint", () => {
  // zoom=2, viewport 800x600 -> center (400,300). Point (100,50) ->
  // pan = (400 - 100*2, 300 - 50*2) = (200, 200).
  it("animates a pan that centers the point and keeps zoom", () => {
    const m = makeCy(PRESENT);
    createCameraController(m.cy).panToPoint(100, 50);
    expect(m.animate).toHaveBeenCalledTimes(1);
    const arg = m.animate.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.pan).toEqual({ x: 200, y: 200 });
    expect(arg).not.toHaveProperty("fit");
    expect(arg).not.toHaveProperty("zoom");
    expect(m.pan).not.toHaveBeenCalled();
  });

  it("applies the pan instantly (cy.pan) when animate is false", () => {
    const m = makeCy(PRESENT);
    createCameraController(m.cy).panToPoint(100, 50, { animate: false });
    expect(m.animate).not.toHaveBeenCalled();
    expect(m.pan).toHaveBeenCalledTimes(1);
    expect(m.pan.mock.calls[0]![0]).toEqual({ x: 200, y: 200 });
  });
});
