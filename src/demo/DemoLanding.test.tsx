/**
 * DemoLanding test. The landing is the storefront; this pins it to what
 * actually ships: exactly one card per shell the router maps, card copy
 * that describes the current MBSE workbench (the old block-only demo's
 * copy regressed here once already), and the select wiring.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DemoLanding, SCENARIOS, CAPABILITY_SURFACES } from "./DemoLanding";

afterEach(cleanup);

describe("DemoLanding", () => {
  it("ships exactly the four routed scenarios", () => {
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual([
      "auditor",
      "biomedical",
      "mbse",
      "supply-chain",
    ]);
  });

  it("renders a card per scenario with its tags", () => {
    const { container } = render(<DemoLanding onSelect={() => {}} />);
    for (const s of SCENARIOS) {
      expect(screen.getByText(s.title)).toBeDefined();
      for (const tag of s.tags) {
        expect(container.textContent).toContain(tag);
      }
    }
  });

  it("describes the MBSE workbench that actually opens (not the retired block demo)", () => {
    const mbse = SCENARIOS.find((s) => s.id === "mbse");
    expect(mbse?.description).toContain("containment tree");
    expect(mbse?.description).toContain("IBD");
    // Retired-demo phrases must not resurface on the card.
    expect(mbse?.description).not.toContain("context-menu");
  });

  it("lists the capability surfaces beneath the scenarios (P1.4)", () => {
    expect(CAPABILITY_SURFACES.map((s) => s.id).sort()).toEqual([
      "analytics-dashboard",
      "scale",
      "schema-dashboard",
    ]);
    const { container } = render(<DemoLanding onSelect={() => {}} />);
    expect(container.textContent).toContain("Capability surfaces");
    for (const s of CAPABILITY_SURFACES) {
      expect(screen.getByText(s.title)).toBeDefined();
    }
  });

  it("hands a clicked capability surface to onSelect like any scenario", () => {
    const onSelect = vi.fn();
    render(<DemoLanding onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Analytics Dashboard"));
    expect(onSelect.mock.calls[0]?.[0]?.id).toBe("analytics-dashboard");
  });

  it("hands the clicked scenario to onSelect", () => {
    const onSelect = vi.fn();
    render(<DemoLanding onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Provenance Auditor"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]?.id).toBe("auditor");
  });
});
