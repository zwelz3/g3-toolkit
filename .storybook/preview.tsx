import type { Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import { useThemeStore } from "../src/theme/ThemeManager";
import { injectDesignTokens } from "../src/theme/design-tokens";
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
