import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useThemeStore, THEME_PRESETS, LIGHT_THEME } from "./ThemeManager";

describe("ThemeSwitcher", () => {
  it("renders a button per preset with the active one pressed", () => {
    useThemeStore.setState({ theme: LIGHT_THEME });
    render(<ThemeSwitcher />);
    const ids = Object.keys(THEME_PRESETS);
    for (const id of ids) {
      expect(
        document.querySelector(`[data-theme-option="${id}"]`),
      ).not.toBeNull();
    }
    expect(
      screen.getByRole("button", { name: THEME_PRESETS["light"]!.name }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("applies the theme through the store and notifies the host", () => {
    useThemeStore.setState({ theme: LIGHT_THEME });
    const onSelect = vi.fn();
    render(<ThemeSwitcher onSelect={onSelect} />);
    fireEvent.click(
      document.querySelector('[data-theme-option="dark"]') as HTMLElement,
    );
    expect(useThemeStore.getState().theme.id).toBe("dark");
    expect(onSelect).toHaveBeenCalledWith("dark");
    // aria-pressed follows the store.
    expect(
      document.querySelector('[data-theme-option="dark"]'),
    ).toHaveAttribute("aria-pressed", "true");
    useThemeStore.getState().setTheme("light");
  });
});
