/**
 * RangeSlider unit test. The dual-thumb slider was the fiddliest
 * browser-only piece of the auditor shell; its logic (thumb clamping,
 * fill geometry, event ticks) is DOM-assertable, so it is pinned here.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RangeSlider } from "./RangeSlider";

afterEach(cleanup);

const base = { min: 0, max: 100, start: 20, end: 80, ticks: [] };

describe("RangeSlider", () => {
  it("clamps the start thumb so it cannot pass the end thumb", () => {
    const onChange = vi.fn();
    render(<RangeSlider {...base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Window start"), {
      target: { value: "95" },
    });
    expect(onChange).toHaveBeenCalledWith(80, 80);
  });

  it("clamps the end thumb so it cannot pass the start thumb", () => {
    const onChange = vi.fn();
    render(<RangeSlider {...base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Window end"), {
      target: { value: "5" },
    });
    expect(onChange).toHaveBeenCalledWith(20, 20);
  });

  it("passes ordinary in-window moves through unclamped", () => {
    const onChange = vi.fn();
    render(<RangeSlider {...base} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Window start"), {
      target: { value: "40" },
    });
    expect(onChange).toHaveBeenCalledWith(40, 80);
  });

  it("draws the fill over the selected window", () => {
    const { container } = render(<RangeSlider {...base} onChange={() => {}} />);
    const fill = container.querySelector(".au-track-fill") as HTMLElement;
    expect(fill.style.left).toBe("20%");
    expect(fill.style.width).toBe("60%");
  });

  it("renders one positioned tick per provenance event", () => {
    const ticks = [
      { time: 0, kind: "generation" },
      { time: 50, kind: "start" },
      { time: 100, kind: "end" },
    ];
    const { container } = render(
      <RangeSlider {...base} ticks={ticks} onChange={() => {}} />,
    );
    const els = container.querySelectorAll(".au-tick");
    expect(els.length).toBe(3);
    expect((els[1] as HTMLElement).style.left).toBe("50%");
  });

  it("collapses gracefully when max <= min (no NaN geometry)", () => {
    const { container } = render(
      <RangeSlider
        min={5}
        max={5}
        start={5}
        end={5}
        ticks={[{ time: 5, kind: "start" }]}
        onChange={() => {}}
      />,
    );
    const fill = container.querySelector(".au-track-fill") as HTMLElement;
    expect(fill.style.left).toBe("0%");
    expect(fill.style.width).toBe("0%");
  });

  it("ticks carry glyphs and hover tooltips (6.3)", () => {
    render(
      <RangeSlider
        min={0}
        max={100}
        start={0}
        end={100}
        ticks={[
          { time: 10, kind: "generated", label: "Reqs: generated 2025-01-15" },
        ]}
        onChange={() => {}}
      />,
    );
    const tick = screen.getByTestId("au-tick");
    expect(tick.getAttribute("title")).toContain("generated");
    expect(tick.textContent).not.toBe("");
  });
});
