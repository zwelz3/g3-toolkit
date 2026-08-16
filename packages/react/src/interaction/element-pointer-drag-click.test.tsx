// Upstream R-1 (round 17, 2026-07-28): a click that ends a PAN must
// not fire onElementClick. Every consumer building an interactive
// structural scene was writing this suppression itself.
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { useElementPointerEvents } from "./element-pointer-events";

function Harness({
  onElementClick,
  threshold,
}: {
  onElementClick: () => void;
  threshold?: number;
}) {
  // Model space == client space here, so pixel deltas are model units.
  const props = useElementPointerEvents<{ elementId: string }, HTMLDivElement>(
    () => ({ elementId: "box" }),
    (client) => client,
    { onElementClick },
    threshold === undefined ? undefined : { clickDragThreshold: threshold },
  );
  return (
    <div data-testid="surface" {...props} style={{ width: 100, height: 100 }} />
  );
}

describe("click suppression after a drag", () => {
  it("fires the click when the pointer barely moved", () => {
    const onElementClick = vi.fn();
    const { getByTestId } = render(<Harness onElementClick={onElementClick} />);
    const el = getByTestId("surface");
    fireEvent.pointerDown(el, { clientX: 50, clientY: 50 });
    fireEvent.click(el, { clientX: 51, clientY: 51 });
    expect(onElementClick).toHaveBeenCalledOnce();
  });

  it("SUPPRESSES the click that ends a pan", () => {
    const onElementClick = vi.fn();
    const { getByTestId } = render(<Harness onElementClick={onElementClick} />);
    const el = getByTestId("surface");
    fireEvent.pointerDown(el, { clientX: 20, clientY: 20 });
    fireEvent.click(el, { clientX: 80, clientY: 60 });
    expect(onElementClick).not.toHaveBeenCalled();
  });

  it("threshold 0 restores fire-always for consumers who want it", () => {
    const onElementClick = vi.fn();
    const { getByTestId } = render(
      <Harness onElementClick={onElementClick} threshold={0} />,
    );
    const el = getByTestId("surface");
    fireEvent.pointerDown(el, { clientX: 20, clientY: 20 });
    fireEvent.click(el, { clientX: 80, clientY: 60 });
    expect(onElementClick).toHaveBeenCalledOnce();
  });

  it("a click with no preceding pointerdown still fires (keyboard/synthetic)", () => {
    const onElementClick = vi.fn();
    const { getByTestId } = render(<Harness onElementClick={onElementClick} />);
    fireEvent.click(getByTestId("surface"), { clientX: 10, clientY: 10 });
    expect(onElementClick).toHaveBeenCalledOnce();
  });
});

describe("R-10: screen-space slop, resolved per pointer type", () => {
  it("a touch tap survives a wobble that a mouse click would not", () => {
    const touch = vi.fn();
    const mouse = vi.fn();
    const { getByTestId, unmount } = render(<Harness onElementClick={touch} />);
    const el = getByTestId("surface");
    // 8px wobble: inside a finger's slop (12), outside a mouse's (4).
    fireEvent.pointerDown(el, {
      clientX: 50,
      clientY: 50,
      pointerType: "touch",
    });
    fireEvent.click(el, { clientX: 56, clientY: 55 });
    expect(touch).toHaveBeenCalledOnce();
    unmount();

    const second = render(<Harness onElementClick={mouse} />);
    const el2 = second.getByTestId("surface");
    fireEvent.pointerDown(el2, {
      clientX: 50,
      clientY: 50,
      pointerType: "mouse",
    });
    fireEvent.click(el2, { clientX: 56, clientY: 55 });
    expect(mouse).not.toHaveBeenCalled();
  });

  it("the threshold no longer depends on zoom (the model-unit defect)", () => {
    // toModel here divides by a zoom factor; under the old model-unit
    // comparison a 5px wobble at k=0.5 measured 10 units and killed
    // the tap. In screen space it is 5px at every zoom.
    const onElementClick = vi.fn();
    function Zoomed() {
      const props = useElementPointerEvents<
        { elementId: string },
        HTMLDivElement
      >(
        () => ({ elementId: "box" }),
        (client) => ({ x: client.x / 0.5, y: client.y / 0.5 }),
        { onElementClick },
      );
      return <div data-testid="z" {...props} />;
    }
    const { getByTestId } = render(<Zoomed />);
    const el = getByTestId("z");
    fireEvent.pointerDown(el, {
      clientX: 100,
      clientY: 100,
      pointerType: "mouse",
    });
    fireEvent.click(el, { clientX: 103, clientY: 100 });
    expect(onElementClick).toHaveBeenCalledOnce();
  });
});
