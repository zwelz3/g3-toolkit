/**
 * Framework-agnostic design tokens (D6).
 *
 * Pure data: spacing, typography, shadows, radii, transitions. No React,
 * no DOM dependencies in the values themselves; the `injectDesignTokens()`
 * function does touch the DOM (write CSS custom properties to
 * documentElement) but that's optional and behind a guard.
 */
export {
  DESIGN_TOKENS,
  DARK_SHADOWS,
  injectDesignTokens,
} from "./design-tokens";
