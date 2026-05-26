import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  // Story locations: stories live next to source under packages/react/src/.
  // We do NOT glob packages/charts (no stories there yet) or src/demo
  // (demos render via DemoApp at pnpm dev). The path is relative to
  // .storybook/, hence the leading "../".
  stories: [
    "../packages/react/src/**/*.mdx",
    "../packages/react/src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp",
  ],
  framework: "@storybook/react-vite",
};
export default config;
