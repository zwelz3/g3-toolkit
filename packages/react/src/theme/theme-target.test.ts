/**
 * Theme target and dispose (issue #33).
 *
 * ThemeManager wrote `color-scheme` and every --g3t-* token inline on
 * document.documentElement, so mounting one graph view changed the
 * host page's color-scheme (scrollbars, form controls) and the tokens
 * outlived the view. These tests pin the three behaviors that close
 * the issue: the default still writes to <html> (compatibility), a
 * scoped target writes to that element and leaves <html> untouched,
 * and dispose / clearTheme put the element back the way the host had
 * it.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  useThemeStore,
  applyTheme,
  themeFromCssVariables,
  LIGHT_THEME,
  DARK_THEME,
} from "./ThemeManager";

const html = () => document.documentElement.style;

/** Inline --g3t-* names on an element (what a dispose must remove). */
function inlineTokens(el: HTMLElement): string[] {
  const names: string[] = [];
  for (let i = 0; i < el.style.length; i++) {
    const n = el.style.item(i);
    if (n.startsWith("--g3t-")) names.push(n);
  }
  return names;
}

function scrubRoot(): void {
  for (const n of inlineTokens(document.documentElement))
    html().removeProperty(n);
  html().removeProperty("color-scheme");
}

beforeEach(() => {
  useThemeStore.getState().clearTheme();
  useThemeStore.setState({ theme: LIGHT_THEME, target: "root" });
  scrubRoot();
});

afterEach(() => {
  useThemeStore.getState().clearTheme();
  useThemeStore.setState({ theme: LIGHT_THEME, target: "root" });
  scrubRoot();
});

describe("theme target: default root", () => {
  it("setTheme still writes color-scheme and tokens to <html>", () => {
    useThemeStore.getState().setTheme("dark");
    expect(html().getPropertyValue("color-scheme")).toBe("dark");
    expect(html().getPropertyValue("--g3t-bg-primary")).toBe(
      DARK_THEME.bgPrimary,
    );
    expect(html().getPropertyValue("--g3t-type-0")).toBe(
      DARK_THEME.typePalette[0],
    );
  });

  it("applyTheme with no options writes to <html> too", () => {
    const dispose = applyTheme(DARK_THEME);
    expect(html().getPropertyValue("color-scheme")).toBe("dark");
    expect(html().getPropertyValue("--g3t-accent-primary")).toBe(
      DARK_THEME.accentPrimary,
    );
    dispose();
  });
});

describe("theme target: scoped element", () => {
  it("store writes land on the target and <html> stays untouched", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
      useThemeStore.getState().setThemeTarget(container);
      useThemeStore.getState().setTheme("dark");
      expect(container.style.getPropertyValue("color-scheme")).toBe("dark");
      expect(container.style.getPropertyValue("--g3t-bg-primary")).toBe(
        DARK_THEME.bgPrimary,
      );
      expect(container.style.getPropertyValue("--g3t-type-7")).toBe(
        DARK_THEME.typePalette[7],
      );
      // The host page's scheme is its own business.
      expect(html().getPropertyValue("color-scheme")).toBe("");
      expect(inlineTokens(document.documentElement)).toEqual([]);
    } finally {
      container.remove();
    }
  });

  it("setThemeTarget moves an existing root write to the element", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    try {
      useThemeStore.getState().setTheme("dark");
      expect(html().getPropertyValue("color-scheme")).toBe("dark");
      useThemeStore.getState().setThemeTarget(container);
      // Root is restored, the element carries the current theme.
      expect(html().getPropertyValue("color-scheme")).toBe("");
      expect(inlineTokens(document.documentElement)).toEqual([]);
      expect(container.style.getPropertyValue("color-scheme")).toBe("dark");
      expect(container.style.getPropertyValue("--g3t-text-primary")).toBe(
        DARK_THEME.textPrimary,
      );
    } finally {
      container.remove();
    }
  });

  it("applyTheme({ target }) writes to the element only", () => {
    const container = document.createElement("div");
    const dispose = applyTheme(DARK_THEME, { target: container });
    expect(container.style.getPropertyValue("color-scheme")).toBe("dark");
    expect(container.style.getPropertyValue("--g3t-edge-color")).toBe(
      DARK_THEME.edgeColor,
    );
    expect(html().getPropertyValue("color-scheme")).toBe("");
    expect(inlineTokens(document.documentElement)).toEqual([]);
    dispose();
  });
});

describe("theme dispose and clearTheme", () => {
  it("dispose removes every inline property applyTheme set", () => {
    const container = document.createElement("div");
    const dispose = applyTheme(DARK_THEME, { target: container });
    expect(inlineTokens(container).length).toBeGreaterThan(20);
    dispose();
    expect(inlineTokens(container)).toEqual([]);
    expect(container.style.getPropertyValue("color-scheme")).toBe("");
    expect(container.getAttribute("style") ?? "").toBe("");
  });

  it("dispose restores the inline values the host had there", () => {
    const container = document.createElement("div");
    container.style.setProperty("color-scheme", "light");
    container.style.setProperty("--g3t-bg-primary", "hotpink");
    const dispose = applyTheme(DARK_THEME, { target: container });
    expect(container.style.getPropertyValue("color-scheme")).toBe("dark");
    expect(container.style.getPropertyValue("--g3t-bg-primary")).toBe(
      DARK_THEME.bgPrimary,
    );
    dispose();
    expect(container.style.getPropertyValue("color-scheme")).toBe("light");
    expect(container.style.getPropertyValue("--g3t-bg-primary")).toBe(
      "hotpink",
    );
    // Only the host's own properties survive.
    expect(inlineTokens(container)).toEqual(["--g3t-bg-primary"]);
  });

  it("clearTheme removes the store's writes from <html> and keeps state", () => {
    useThemeStore.getState().setTheme("dark");
    expect(html().getPropertyValue("color-scheme")).toBe("dark");
    useThemeStore.getState().clearTheme();
    expect(html().getPropertyValue("color-scheme")).toBe("");
    expect(inlineTokens(document.documentElement)).toEqual([]);
    expect(useThemeStore.getState().theme.id).toBe("dark");
    // A later setTheme writes again; clearTheme is not a one-way door.
    useThemeStore.getState().setTheme("light");
    expect(html().getPropertyValue("color-scheme")).toBe("light");
  });

  it("repeated store writes never leave a stale theme behind on dispose", () => {
    const container = document.createElement("div");
    container.style.setProperty("color-scheme", "light");
    useThemeStore.getState().setThemeTarget(container);
    useThemeStore.getState().setTheme("dark");
    useThemeStore.getState().setTheme("high-contrast");
    useThemeStore.getState().setTheme("dark");
    useThemeStore.getState().clearTheme();
    // The host's value, not an intermediate g3t theme's.
    expect(container.style.getPropertyValue("color-scheme")).toBe("light");
    expect(inlineTokens(container)).toEqual([]);
  });
});

describe("themeFromCssVariables", () => {
  it("reads the host's variables through computed style and fills the rest from the base", () => {
    const sheet = document.createElement("style");
    sheet.textContent =
      ":root { --app-bg: #101010; --app-fg: #fafafa; } " +
      ".app { --app-accent: #ff8800; --app-empty: ; }";
    document.head.appendChild(sheet);
    const el = document.createElement("div");
    el.className = "app";
    document.body.appendChild(el);
    try {
      const theme = themeFromCssVariables(
        el,
        {
          bgPrimary: "--app-bg",
          textPrimary: "--app-fg",
          accentPrimary: "--app-accent",
          // Resolves to nothing: the base value must survive.
          border: "--app-empty",
        },
        { id: "app", name: "App", colorScheme: "dark" },
      );
      expect(theme.id).toBe("app");
      expect(theme.colorScheme).toBe("dark");
      expect(theme.bgPrimary).toBe("#101010");
      expect(theme.textPrimary).toBe("#fafafa");
      expect(theme.accentPrimary).toBe("#ff8800");
      expect(theme.border).toBe(DARK_THEME.border);
      expect(theme.typePalette).toEqual(DARK_THEME.typePalette);
    } finally {
      el.remove();
      sheet.remove();
    }
  });

  it("defaults to the light base and an explicit base wins", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    try {
      const light = themeFromCssVariables(el, {}, { id: "a", name: "A" });
      expect(light.bgPrimary).toBe(LIGHT_THEME.bgPrimary);
      expect(light.colorScheme).toBe("light");
      const based = themeFromCssVariables(
        el,
        {},
        { id: "b", name: "B", base: DARK_THEME },
      );
      expect(based.bgPrimary).toBe(DARK_THEME.bgPrimary);
    } finally {
      el.remove();
    }
  });
});
