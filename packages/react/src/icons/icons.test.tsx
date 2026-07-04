/**
 * Icon system tests (B1, design-system roadmap).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Icon } from "./Icon";
import { registerIcon, registerIconSet, listIcons } from "./index";

describe("Icon", () => {
  it("renders a registered icon with currentColor stroke", () => {
    render(<Icon name="check" />);
    const svg = screen.getByTestId("g3t-icon-check");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
  });

  it("is aria-hidden when decorative (no label)", () => {
    render(<Icon name="chevron-down" />);
    expect(
      screen.getByTestId("g3t-icon-chevron-down").getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("exposes role=img and aria-label when standalone", () => {
    render(<Icon name="close" label="Clear search" />);
    const svg = screen.getByTestId("g3t-icon-close");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Clear search");
  });

  it("sizes from the size prop", () => {
    render(<Icon name="play" size={20} />);
    expect(screen.getByTestId("g3t-icon-play").getAttribute("width")).toBe(
      "20",
    );
  });

  it("renders nothing and warns for unregistered names", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<Icon name="nonexistent-glyph" />);
    expect(container.firstChild).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("registry override swaps the renderer and restores on cleanup", () => {
    const restore = registerIcon("check", '<path d="M0 0h24v24H0z"/>');
    const { unmount } = render(<Icon name="check" />);
    expect(screen.getByTestId("g3t-icon-check").innerHTML).toContain("M0 0h24");
    unmount();
    restore();
    render(<Icon name="check" />);
    expect(
      screen
        .getByTestId("g3t-icon-check")
        .querySelector("path")
        ?.getAttribute("d"),
    ).toBe("M4.5 12.5l5 5 10-11");
  });

  it("ships the full default set", () => {
    const names = listIcons();
    for (const required of [
      "chevron-right",
      "chevron-down",
      "sort-asc",
      "sort-desc",
      "check",
      "close",
      "warning",
      "play",
      "pause",
      "lock",
      "settings",
    ]) {
      expect(names).toContain(required);
    }
  });
});

describe("icon sets (sanitize-by-default)", () => {
  const cleanSet = {
    icons: {
      agent: '<circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0114 0"/>',
      building:
        '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2"/>',
    },
    mappings: { driver: "types", values: { Person: "agent", Org: "building" } },
  };

  it("registers clean glyphs, returns mappings, and restores on unregister", () => {
    const result = registerIconSet(cleanSet);
    expect(result.registered.sort()).toEqual(["agent", "building"]);
    expect(result.rejected).toHaveLength(0);
    expect(result.mappings?.values["Person"]).toBe("agent");
    render(<Icon name="agent" />);
    expect(screen.getByTestId("g3t-icon-agent")).toBeTruthy();
    result.unregister();
    expect(listIcons()).not.toContain("agent");
  });

  it("rejects hostile glyphs by name with reasons; clean siblings register", () => {
    const result = registerIconSet({
      icons: {
        evil: '<path d="M0 0" onclick="alert(1)"/>',
        scripty: "<script>alert(1)</script>",
        foreign: "<foreignObject><div/></foreignObject>",
        linky: '<path d="M0 0" fill="url(#x)"/>',
        fine: '<path d="M4 4h16"/>',
      },
    });
    expect(result.registered).toEqual(["fine"]);
    const reasons = result.rejected
      .map((r) => `${r.icon}:${r.reason}`)
      .join("|");
    expect(reasons).toContain("evil:event handler");
    expect(reasons).toContain("scripty:element <script>");
    expect(reasons).toContain("foreign:element <foreignobject>");
    expect(reasons).toContain("linky:");
    expect(listIcons()).not.toContain("evil");
    result.unregister();
  });

  it("trusted mode bypasses the sanitizer (adopter-compiled sets only)", () => {
    const result = registerIconSet(
      { icons: { branded: '<path d="M2 2h20" data-brand="x"/>' } },
      { trust: "trusted" },
    );
    expect(result.registered).toEqual(["branded"]);
    result.unregister();
  });

  it("pre-mappings drop entries whose icon was rejected", () => {
    const result = registerIconSet({
      icons: { bad: "<script>1</script>", ok: '<path d="M1 1"/>' },
      mappings: { driver: "types", values: { Person: "bad", Org: "ok" } },
    });
    expect(result.mappings?.values).toEqual({ Org: "ok" });
    result.unregister();
  });
});
