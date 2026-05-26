import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  // TODO (P6): stories live at packages/react/src/**/*.stories.tsx after
  // the workspace move. Pointing them out correctly here exposes an
  // environmental dependency — vitest's storybook integration needs
  // a Playwright browser installed (`pnpm exec playwright install
  // chromium`). The corrected glob lands in the same change that
  // wires browser install into CI; until then, the glob is left at
  // the old src/** pattern so `pnpm test` doesn't fail in environments
  // without browsers.
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
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
