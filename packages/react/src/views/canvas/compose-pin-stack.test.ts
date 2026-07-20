/**
 * composePinStack (12.1 contract). Two browser passes rejected the
 * data()-mapped-array approach; the pin indicator now writes literal
 * arrays as per-element style BYPASSES. Pins: badge-only vs
 * icon+badge stacks, the badge always LAST (rendered on top), and
 * PIN_BYPASS_PROPS covering exactly the written keys so unpin's
 * removeStyle restores the rule-driven appearance completely.
 */
import { describe, it, expect } from "vitest";
import {
  composePinStack,
  PIN_BYPASS_PROPS,
  PIN_INDICATOR_RULE,
} from "./CytoscapeCanvas";

function fakeNode(icon?: string) {
  const written: Record<string, unknown> = {};
  return {
    written,
    data: (k: string) => (k === "_icon" ? icon : undefined),
    style: (props: Record<string, unknown>) => Object.assign(written, props),
  };
}

describe("composePinStack (bypass contract)", () => {
  it("badge-only when no icon: single-image stack at the pin corner", () => {
    const n = fakeNode();
    composePinStack(n, "BADGE");
    expect(n.written["background-image"]).toEqual(["BADGE"]);
    expect(n.written["background-position-x"]).toEqual(["100%"]);
    expect(n.written["background-fit"]).toEqual(["none"]);
  });

  it("icon + badge: icon first (under), badge last (on top)", () => {
    const n = fakeNode("ICON");
    composePinStack(n, "BADGE");
    expect(n.written["background-image"]).toEqual(["ICON", "BADGE"]);
    expect(n.written["background-width"]).toEqual(["60%", "16px"]);
    expect(n.written["background-position-y"]).toEqual(["50%", "0%"]);
  });

  it("PIN_BYPASS_PROPS covers exactly the written keys (unpin restores fully)", () => {
    const n = fakeNode("ICON");
    composePinStack(n, "BADGE");
    expect(Object.keys(n.written).sort()).toEqual([...PIN_BYPASS_PROPS].sort());
  });

  it("the class rule maps nothing: the visual rides the bypass", () => {
    expect(PIN_INDICATOR_RULE.selector).toBe("node.g3t-pinned");
    const rule = PIN_INDICATOR_RULE as unknown as {
      style: Record<string, unknown>;
    };
    expect(Object.keys(rule.style)).toHaveLength(0);
  });
});
