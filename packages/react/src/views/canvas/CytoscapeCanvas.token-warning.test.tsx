/**
 * CytoscapeCanvas development-only design-token warning (issue #62).
 *
 * The probe must read the canvas's OWN container, which inherits the
 * `--g3t-*` tokens from whichever ancestor the theme was applied to
 * (`<html>` by default, a scoped container through `setThemeTarget`).
 * Probing `<html>` reported a scoped theme as missing and blamed
 * `style.css`, which has carried no color tokens since #24. Isolated
 * cytoscape mock so the shared canvas-test mock is untouched.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { UGM } from "@g3-toolkit/core";

const cy = {
  on: vi.fn(),
  one: vi.fn(),
  removeListener: vi.fn(),
  destroy: vi.fn(),
  nodes: vi.fn(() => ({ length: 0, forEach: vi.fn() })),
  edges: vi.fn(() => ({ length: 0, forEach: vi.fn() })),
  batch: vi.fn((fn: () => void) => fn()),
  style: vi.fn(() => ({ fromJson: vi.fn(() => ({ update: vi.fn() })) })),
  getElementById: vi.fn(() => ({ nonempty: () => false })),
  elements: vi.fn(() => ({ removeClass: vi.fn() })),
  pan: vi.fn(() => ({ x: 0, y: 0 })),
  zoom: vi.fn(() => 1),
  fit: vi.fn(),
  viewport: vi.fn(),
};
const cytoscapeFn = vi.fn((_opts?: unknown) => cy);
vi.mock("cytoscape", () => ({ default: cytoscapeFn, __esModule: true }));
vi.mock("cytoscape-fcose", () => ({ default: vi.fn(), __esModule: true }));

const { CytoscapeCanvas } = await import("./CytoscapeCanvas");

const TOKEN = "--g3t-bg-primary";

function tokenWarnings(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls
    .map((c) => String(c[0]))
    .filter((m) => m.includes("design tokens"));
}

function makeUgm(): UGM {
  const ugm = new UGM();
  ugm.addNode("a", { types: ["T"] });
  return ugm;
}

describe("CytoscapeCanvas design-token warning (#62)", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cytoscapeFn.mockClear();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    document.documentElement.style.removeProperty(TOKEN);
  });

  it("stays silent when the theme is scoped to a wrapper that contains the canvas (tokens absent from <html>)", () => {
    // A scoped theme (setThemeTarget) writes the tokens on a container,
    // never on <html>. The old <html> probe produced a false warning here.
    const wrapper = document.createElement("div");
    wrapper.style.setProperty(TOKEN, "#ffffff");
    document.body.appendChild(wrapper);
    expect(
      getComputedStyle(document.documentElement).getPropertyValue(TOKEN),
    ).toBe("");

    render(<CytoscapeCanvas ugm={makeUgm()} />, { container: wrapper });

    expect(tokenWarnings(warn)).toEqual([]);
    wrapper.remove();
  });

  it("stays silent when the theme is applied to <html> (the default target)", () => {
    document.documentElement.style.setProperty(TOKEN, "#ffffff");

    render(<CytoscapeCanvas ugm={makeUgm()} />);

    expect(tokenWarnings(warn)).toEqual([]);
  });

  it("warns once, naming the theme and the container, when the tokens are set nowhere", () => {
    render(<CytoscapeCanvas ugm={makeUgm()} />);

    const msgs = tokenWarnings(warn);
    expect(msgs).toHaveLength(1);
    const msg = msgs[0];
    expect(msg).toContain("[g3t] design tokens (--g3t-*) not found");
    expect(msg).toContain("this canvas's container");
    // The likely cause is a theme that was not applied, or was scoped to
    // a container that does not contain this canvas; style.css is still
    // mentioned because it is required too, but it is no longer blamed
    // for the tokens (it defines none).
    expect(msg).toContain("theme has probably not been applied");
    expect(msg).toContain("setThemeTarget");
    expect(msg).toContain('import "@g3-toolkit/react/style.css"');
    expect(msg).not.toContain("not found on :root");
  });
});
