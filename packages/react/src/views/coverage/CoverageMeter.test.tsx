/** CoverageMeter tests (flagship §2c). Render-level, jsdom. */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CoverageMeter, CoverageMeterList } from "./CoverageMeter";

const widthOf = (el: HTMLElement): number =>
  parseFloat(el.style.width.replace("%", "")) || 0;

describe("CoverageMeter", () => {
  it("renders label, track, and both bars", () => {
    render(
      <CoverageMeter
        label="Sustainment"
        substantiated={0.3}
        claimable={1.0}
        state="exposed"
        animate={false}
      />,
    );
    const root = screen.getByTestId("g3t-coverage-meter");
    expect(root.getAttribute("data-state")).toBe("exposed");
    expect(within(root).getByTestId("g3t-coverage-track")).toBeDefined();
    expect(within(root).getByTestId("g3t-coverage-solid")).toBeDefined();
    expect(within(root).getByTestId("g3t-coverage-ghost")).toBeDefined();
    expect(root.textContent).toContain("Sustainment");
  });

  it("places the ghost (claimable) ahead of the solid (substantiated)", () => {
    render(
      <CoverageMeter
        label="Sustainment"
        substantiated={0.3}
        claimable={1.0}
        state="exposed"
        animate={false}
      />,
    );
    const solid = screen.getByTestId("g3t-coverage-solid");
    const ghost = screen.getByTestId("g3t-coverage-ghost");
    expect(widthOf(solid)).toBe(30);
    expect(widthOf(ghost)).toBe(100);
    expect(widthOf(ghost)).toBeGreaterThan(widthOf(solid));
  });

  it("renders the exposure band sized to the claim run-past", () => {
    render(
      <CoverageMeter
        label="Sustainment"
        substantiated={0.3}
        claimable={1.0}
        state="exposed"
        animate={false}
      />,
    );
    const exp = screen.getByTestId("g3t-coverage-exposure");
    expect(exp.style.left).toBe("30%");
    expect(widthOf(exp)).toBe(70); // 100 - 30
  });

  it("omits the exposure band when claim does not exceed proof", () => {
    render(
      <CoverageMeter
        label="Digital Thread"
        substantiated={1.0}
        claimable={1.0}
        state="discriminator"
        animate={false}
      />,
    );
    expect(screen.queryByTestId("g3t-coverage-exposure")).toBeNull();
  });

  it("clamps a claimable below substantiated (no negative exposure)", () => {
    render(
      <CoverageMeter
        label="Odd"
        substantiated={0.8}
        claimable={0.4}
        animate={false}
      />,
    );
    const ghost = screen.getByTestId("g3t-coverage-ghost");
    expect(widthOf(ghost)).toBe(80); // raised to meet the solid
    expect(screen.queryByTestId("g3t-coverage-exposure")).toBeNull();
  });

  it("writes a descriptive aria-label including the exposure", () => {
    render(
      <CoverageMeter
        label="Sustainment"
        substantiated={0.3}
        claimable={1.0}
        state="exposed"
        animate={false}
      />,
    );
    const label = screen
      .getByTestId("g3t-coverage-meter")
      .getAttribute("aria-label");
    expect(label).toContain("30% substantiated");
    expect(label).toContain("100% claimable");
    expect(label).toContain("70% exposed");
    expect(label).toContain("exposed");
  });

  it("renders both values when showValues is set", () => {
    render(
      <CoverageMeter
        label="Sustainment"
        substantiated={0.3}
        claimable={1.0}
        animate={false}
      />,
    );
    expect(screen.getByTestId("g3t-coverage-values").textContent).toContain(
      "30%",
    );
    expect(screen.getByTestId("g3t-coverage-values").textContent).toContain(
      "100%",
    );
  });

  it("disables transitions when animate is false", () => {
    render(
      <CoverageMeter
        label="X"
        substantiated={0.5}
        claimable={0.6}
        animate={false}
      />,
    );
    expect(screen.getByTestId("g3t-coverage-solid").style.transition).toBe(
      "none",
    );
  });

  it("sets a width transition when animate is on (default)", () => {
    render(<CoverageMeter label="X" substantiated={0.5} claimable={0.6} />);
    expect(screen.getByTestId("g3t-coverage-solid").style.transition).toContain(
      "width",
    );
  });

  it("places fills at target immediately when animate is false (derived, no state write)", () => {
    render(
      <CoverageMeter
        label="X"
        substantiated={0.5}
        claimable={0.8}
        animate={false}
      />,
    );
    expect(screen.getByTestId("g3t-coverage-solid").style.width).toBe("50%");
    expect(screen.getByTestId("g3t-coverage-ghost").style.width).toBe("80%");
    expect(screen.getByTestId("g3t-coverage-exposure").style.width).toBe("30%");
  });

  it("snaps to target when animate flips off before the mount frame fires", () => {
    // Mount animating (fills start at 0%), then flip animate off before any
    // requestAnimationFrame runs: the derived at-target flag must place the
    // fills without the old synchronous setState-in-effect.
    const { rerender } = render(
      <CoverageMeter label="X" substantiated={0.5} claimable={0.8} />,
    );
    rerender(
      <CoverageMeter
        label="X"
        substantiated={0.5}
        claimable={0.8}
        animate={false}
      />,
    );
    expect(screen.getByTestId("g3t-coverage-solid").style.width).toBe("50%");
    expect(screen.getByTestId("g3t-coverage-ghost").style.width).toBe("80%");
    expect(screen.getByTestId("g3t-coverage-solid").style.transition).toBe(
      "none",
    );
  });
});

describe("CoverageMeterList", () => {
  it("renders one meter per row", () => {
    render(
      <CoverageMeterList
        animate={false}
        rows={[
          {
            label: "Digital Thread",
            substantiated: 1,
            claimable: 1,
            state: "discriminator",
          },
          {
            label: "Sustainment",
            substantiated: 0.3,
            claimable: 1,
            state: "exposed",
          },
          {
            label: "Cyber Resilience",
            substantiated: 0.42,
            claimable: 0.54,
            state: "gap",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("g3t-coverage-meter-list")).toBeDefined();
    expect(screen.getAllByTestId("g3t-coverage-meter").length).toBe(3);
    // The exposed and gap rows show an exposure band; the discriminator does not.
    expect(screen.getAllByTestId("g3t-coverage-exposure").length).toBe(2);
  });
});
