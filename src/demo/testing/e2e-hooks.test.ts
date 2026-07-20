/**
 * The e2e hook channel must be INERT outside ?e2e=1 (it ships in the
 * demo bundle) and functional inside it.
 */
import { afterEach, describe, expect, it } from "vitest";
import { e2eEnabled, publishCanvas, publishScene } from "./e2e-hooks";

function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
}

afterEach(() => {
  setSearch("");
  delete window.__g3t;
});

describe("e2e hooks gating", () => {
  it("inert without the query param: no callback, no registry writes", () => {
    setSearch("");
    expect(e2eEnabled()).toBe(false);
    expect(publishCanvas("mbse")).toBeUndefined();
    publishScene("mbse", {
      input: { nodes: [], edges: [] },
      geometry: { nodes: {}, size: { width: 0, height: 0 } } as never,
    });
    expect(window.__g3t).toBeUndefined();
  });

  it("active with ?e2e=1: publishes canvases and scenes, clears on null", () => {
    setSearch("?e2e=1");
    expect(e2eEnabled()).toBe(true);
    const onReady = publishCanvas("mbse");
    expect(onReady).toBeDefined();
    const fakeCy = { nodes: () => [] } as never;
    onReady?.(fakeCy);
    expect(window.__g3t?.canvases.get("mbse")).toBe(fakeCy);
    const scene = {
      input: { nodes: [], edges: [] },
      geometry: { nodes: {}, size: { width: 0, height: 0 } } as never,
    };
    publishScene("mbse", scene);
    expect(window.__g3t?.scenes.get("mbse")).toBe(scene);
    publishScene("mbse", null);
    expect(window.__g3t?.scenes.has("mbse")).toBe(false);
  });
});
