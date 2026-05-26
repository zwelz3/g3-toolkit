import type { Preview } from "@storybook/react-vite";
import { useEffect } from "react";
// Use package-level imports rather than reaching into source. After the
// Phase-2 workspace split the theme modules live in @g3t/react (for
// useThemeStore) and @g3t/core (for injectDesignTokens). Reaching into
// the source tree (../src/theme/...) targeted the pre-split layout and
// no longer resolves; importing from the packages also matches how
// consumers use the toolkit, which is what stories should demonstrate.
import { useThemeStore } from "@g3t/react";
import { injectDesignTokens } from "@g3t/core";
// Storybook serves from source, so reach into the package's CSS source
// file directly. The published packages export this same file as the
// './style.css' subpath ('@g3t/react/style.css'), but that resolves to
// dist/style.css which only exists after build. For dev mode this
// works against the live source file.
import "../packages/react/src/theme/g3t-base.css";

const withTheme = (Story: React.ComponentType, context: any) => {
  const themeId = context.globals.theme || "light";
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    setTheme(themeId);
    injectDesignTokens(themeId === "dark");
  }, [themeId, setTheme]);

  return (
    <div
      style={{
        background: "var(--g3t-bg-primary)",
        color: "var(--g3t-text-primary)",
        fontFamily: "var(--g3t-font)",
        minHeight: "100vh",
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      name: "Theme",
      description: "g3t color theme",
      defaultValue: "light",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "light", title: "☀ Light" },
          { value: "dark", title: "☾ Dark" },
          { value: "high-contrast", title: "◐ High Contrast" },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
