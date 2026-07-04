import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpecPort } from "./SpecPort";
import { DEFAULT_SPEC, serializeEncodingSpec } from "./encoding-spec";
import type { EncodingSpec } from "./encoding-spec";

describe("SpecPort (tier 3)", () => {
  it("round-trips: edited JSON applies as a parsed spec", () => {
    const onApply = vi.fn();
    render(<SpecPort spec={DEFAULT_SPEC} onApply={onApply} />);
    const box = screen.getByLabelText("Encoding spec JSON");
    const edited: EncodingSpec = {
      ...DEFAULT_SPEC,
      node: {
        ...DEFAULT_SPEC.node,
        size: { scale: { kind: "fixed", value: 22 } },
      },
    };
    fireEvent.change(box, {
      target: { value: serializeEncodingSpec(edited) },
    });
    fireEvent.click(screen.getByText("Apply JSON"));
    expect(onApply).toHaveBeenCalledWith(edited);
    expect(screen.queryByTestId("spec-port-error")).toBeNull();
  });

  it("surfaces malformed JSON without applying", () => {
    const onApply = vi.fn();
    render(<SpecPort spec={DEFAULT_SPEC} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText("Encoding spec JSON"), {
      target: { value: "{ not json" },
    });
    fireEvent.click(screen.getByText("Apply JSON"));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByTestId("spec-port-error")).toBeTruthy();
  });

  it("surfaces the reserved-channel rejection with the owner named", () => {
    const onApply = vi.fn();
    render(<SpecPort spec={DEFAULT_SPEC} onApply={onApply} />);
    fireEvent.change(screen.getByLabelText("Encoding spec JSON"), {
      target: {
        value:
          '{"version":1,"node":{},"edge":{},"effects":{"accent":{"driver":"confidence"}}}',
      },
    });
    fireEvent.click(screen.getByText("Apply JSON"));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByTestId("spec-port-error").textContent).toContain(
      "selection",
    );
  });

  it("tracks panel edits until the user dirties the draft", () => {
    const { rerender } = render(
      <SpecPort spec={DEFAULT_SPEC} onApply={() => {}} />,
    );
    const next: EncodingSpec = {
      ...DEFAULT_SPEC,
      node: {
        ...DEFAULT_SPEC.node,
        size: { scale: { kind: "fixed", value: 9 } },
      },
    };
    rerender(<SpecPort spec={next} onApply={() => {}} />);
    expect(
      (screen.getByLabelText("Encoding spec JSON") as HTMLTextAreaElement)
        .value,
    ).toContain('"value": 9');
  });
});
