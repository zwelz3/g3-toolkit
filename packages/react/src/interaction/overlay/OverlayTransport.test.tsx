import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OverlayTransport } from "./OverlayTransport";
import type { OverlaySequence } from "./useOverlaySequence";

function sequence(over: Partial<OverlaySequence> = {}): OverlaySequence {
  return {
    index: 2,
    length: 7,
    isPlaying: false,
    play: vi.fn(),
    pause: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    goTo: vi.fn(),
    ...over,
  };
}

describe("OverlayTransport", () => {
  it("renders the three transport buttons and a 1-based readout", () => {
    const seq = sequence();
    render(<OverlayTransport sequence={seq} />);
    expect(
      screen.getByRole("group", { name: "Overlay sequence" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("overlay-transport-readout")).toHaveTextContent(
      "3 of 7",
    );
    fireEvent.click(screen.getByLabelText("Previous step"));
    fireEvent.click(screen.getByLabelText("Next step"));
    fireEvent.click(screen.getByLabelText("Play"));
    expect(seq.prev).toHaveBeenCalledTimes(1);
    expect(seq.next).toHaveBeenCalledTimes(1);
    expect(seq.play).toHaveBeenCalledTimes(1);
  });

  it("play-pause flips to pause while playing", () => {
    const seq = sequence({ isPlaying: true });
    render(<OverlayTransport sequence={seq} />);
    fireEvent.click(screen.getByLabelText("Pause"));
    expect(seq.pause).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Play")).toBeNull();
  });

  it("disables prev at the start and next at the end without loop", () => {
    const { rerender } = render(
      <OverlayTransport sequence={sequence({ index: 0 })} />,
    );
    expect(screen.getByLabelText("Previous step")).toBeDisabled();
    expect(screen.getByLabelText("Next step")).not.toBeDisabled();
    rerender(<OverlayTransport sequence={sequence({ index: 6 })} />);
    expect(screen.getByLabelText("Next step")).toBeDisabled();
    // With loop both ends move.
    rerender(
      <OverlayTransport
        sequence={sequence({ index: 6 })}
        loop
        onLoopChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Next step")).not.toBeDisabled();
  });

  it("is inert on an empty sequence", () => {
    render(<OverlayTransport sequence={sequence({ index: 0, length: 0 })} />);
    expect(screen.getByLabelText("Play")).toBeDisabled();
    expect(screen.getByTestId("overlay-transport-readout")).toHaveTextContent(
      "0 of 0",
    );
  });

  it("speed and loop controls render only when wired, and are controlled", () => {
    const onSpeedChange = vi.fn();
    const onLoopChange = vi.fn();
    const { rerender } = render(<OverlayTransport sequence={sequence()} />);
    expect(screen.queryByTestId("overlay-transport-speed")).toBeNull();
    expect(screen.queryByTestId("overlay-transport-loop")).toBeNull();
    rerender(
      <OverlayTransport
        sequence={sequence()}
        speedMs={1000}
        onSpeedChange={onSpeedChange}
        loop={false}
        onLoopChange={onLoopChange}
      />,
    );
    const speed = screen.getByLabelText("Step interval") as HTMLSelectElement;
    expect(speed.value).toBe("1000");
    fireEvent.change(speed, { target: { value: "250" } });
    expect(onSpeedChange).toHaveBeenCalledWith(250);
    const loop = screen.getByLabelText("Loop");
    expect(loop).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(loop);
    expect(onLoopChange).toHaveBeenCalledWith(true);
  });

  it("offers a speed outside the option list rather than showing a blank select", () => {
    render(
      <OverlayTransport
        sequence={sequence()}
        speedMs={750}
        onSpeedChange={() => {}}
      />,
    );
    const speed = screen.getByLabelText("Step interval") as HTMLSelectElement;
    expect(speed.value).toBe("750");
    expect(Array.from(speed.options).map((o) => o.textContent)).toContain(
      "750ms",
    );
  });

  it("each control is individually suppressible", () => {
    render(
      <OverlayTransport
        sequence={sequence()}
        speedMs={1000}
        onSpeedChange={() => {}}
        loop={false}
        onLoopChange={() => {}}
        showPrev={false}
        showReadout={false}
        showSpeed={false}
        showLoop={false}
      />,
    );
    expect(screen.queryByLabelText("Previous step")).toBeNull();
    expect(screen.queryByTestId("overlay-transport-readout")).toBeNull();
    expect(screen.queryByTestId("overlay-transport-speed")).toBeNull();
    expect(screen.queryByTestId("overlay-transport-loop")).toBeNull();
    expect(screen.getByLabelText("Next step")).toBeInTheDocument();
    expect(screen.getByLabelText("Play")).toBeInTheDocument();
  });

  it("labels and the readout are overridable", () => {
    render(
      <OverlayTransport
        sequence={sequence()}
        ariaLabel="Severity walkthrough"
        labels={{
          next: "Nächster",
          readout: (step, length) => `Schritt ${step}/${length}`,
        }}
      />,
    );
    expect(
      screen.getByRole("group", { name: "Severity walkthrough" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nächster")).toBeInTheDocument();
    expect(screen.getByTestId("overlay-transport-readout")).toHaveTextContent(
      "Schritt 3/7",
    );
  });

  it("is keyboard operable: buttons are focusable and the readout is a live region", () => {
    const seq = sequence();
    render(<OverlayTransport sequence={seq} />);
    const next = screen.getByLabelText("Next step");
    next.focus();
    expect(document.activeElement).toBe(next);
    // A native button activates on Enter/Space through click semantics;
    // what matters here is that nothing suppresses the native path.
    fireEvent.click(next);
    expect(seq.next).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("overlay-transport-readout")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});
