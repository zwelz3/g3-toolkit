export {
  useThemeStore,
  deriveCytoscapeStyle,
  deriveEChartsTheme,
  LIGHT_THEME,
  DARK_THEME,
  HIGH_CONTRAST_THEME,
  THEME_PRESETS,
  createTheme,
  contrastRatio,
} from "./ThemeManager";
export type { G3tTheme } from "./ThemeManager";
export { ThemeSwitcher } from "./ThemeSwitcher";
export type { ThemeSwitcherProps } from "./ThemeSwitcher";

// Design tokens moved to @g3t/core in P3.2 (they're pure data, framework-
// agnostic). Re-exported here for backwards compatibility.
export {
  DESIGN_TOKENS,
  DARK_SHADOWS,
  SEQUENTIAL_SCALE,
  DIVERGING_SCALE,
  scaleColor,
  prefersReducedMotion,
  injectDesignTokens,
} from "@g3t/core";
