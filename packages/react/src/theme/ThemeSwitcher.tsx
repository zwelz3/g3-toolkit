/**
 * ThemeSwitcher: preset selection as a real component (review request,
 * 2026-06-11). Every shell wants this control; until now it was
 * improvised per page (the acceptance page's vanilla buttons), which
 * is exactly the per-app drift the design system exists to prevent.
 *
 * Applies themes through useThemeStore.setTheme (CSS-variable
 * injection included). The optional onSelect callback lets a host do
 * page-level work alongside (the acceptance page sets
 * document.documentElement.dataset.theme so its own chrome follows).
 */

import { useThemeStore, THEME_PRESETS } from "./ThemeManager";

export interface ThemeSwitcherProps {
  /** Called after the theme is applied (e.g. host page chrome sync). */
  onSelect?: (themeId: string) => void;
  className?: string;
}

export function ThemeSwitcher({ onSelect, className }: ThemeSwitcherProps) {
  const activeId = useThemeStore((s) => s.theme.id);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <div
      className={className}
      role="group"
      aria-label="Theme"
      data-testid="g3t-theme-switcher"
    >
      {Object.entries(THEME_PRESETS).map(([id, preset]) => (
        <button
          key={id}
          type="button"
          className="g3t-btn g3t-btn-ghost"
          data-theme-option={id}
          aria-pressed={activeId === id}
          onClick={() => {
            setTheme(id);
            onSelect?.(id);
          }}
        >
          {preset.name}
        </button>
      ))}
    </div>
  );
}
